"""Qplanner: turns a learning goal into weekly sprints and daily tasks.

The schedule is built entirely by services/qplanner_schedule.py (pure, classical,
sub-second) and dressed by services/qplanner_ai.py (one gateway call, always with
a deterministic fallback). This router is the I/O shell around those two: read the
roadmap and the learner's history, run the scheduler, persist one document.

See PLANS/qplanner.md.
"""
import random
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from auth import get_verified_firebase_user
from database import get_db
from routers.quiz import strip_sensitive_answers
from services import qplanner_ai
from services import qplanner_schedule as sched
from services.qplanner_presets import PRESETS, get_preset
from services.quiz_attempt_service import grade_and_record_attempt
# The learner-history readers the session recommender already uses. Underscore-
# prefixed by module convention, but they are exactly the queries a planner needs
# and re-typing those aggregations here would be a second thing to keep in sync.
from services.topic_prefilter import (
    _fetch_completed_slugs as fetch_completed_slugs,
    _fetch_mastery_map as fetch_mastery_map,
    _fetch_topics as fetch_topics,
)

router = APIRouter(prefix="/api/v1/qplanner", tags=["QPlanner"])

SPRINT_QUIZ_QUESTION_COUNT = 10
DAYS_IN_WEEK = 7


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class PlanRequest(BaseModel):
    preset_slug: str
    deadline: date
    weekly_minutes: int = Field(ge=30, le=3000)
    study_days: List[int] = Field(default_factory=lambda: [0, 2, 4])
    # lets a learner narrow a preset without us inventing another one
    target_domains: Optional[List[str]] = None

    @field_validator("study_days")
    @classmethod
    def _clean_study_days(cls, value: List[int]) -> List[int]:
        days = sorted({d for d in value if 0 <= d < DAYS_IN_WEEK})
        if not days:
            raise ValueError("pick at least one study day (0 = Monday .. 6 = Sunday)")
        return days


class SprintQuizSubmission(BaseModel):
    answers: List[Dict[str, Any]]
    started_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_db():
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    return db


def _envelope(data: Any, meta: Any = None) -> Dict[str, Any]:
    return {"data": data, "meta": meta, "error": None}


def _serialize(plan: Dict[str, Any]) -> Dict[str, Any]:
    plan = dict(plan)
    plan["id"] = str(plan.pop("_id"))
    if plan.get("replanned_from"):
        plan["replanned_from"] = str(plan["replanned_from"])
    for field in ("created_at", "updated_at"):
        if isinstance(plan.get(field), datetime):
            plan[field] = plan[field].isoformat()
    for sprint in plan.get("sprints", []):
        quiz = sprint.get("quiz")
        if quiz and isinstance(quiz.get("submitted_at"), datetime):
            quiz["submitted_at"] = quiz["submitted_at"].isoformat()
    return plan


def _build_schedule(
    topics_by_slug: Dict[str, Dict[str, Any]],
    closure: Any,
    emphasis: Dict[str, str],
    weekly_minutes: int,
    start: date,
    study_days: List[int],
) -> Dict[str, Any]:
    """The pure half of plan generation, run once for the emphasis baseline and
    again if the model adjusted any topic's emphasis. It is arithmetic over ~93
    topics, so running it twice costs nothing."""
    minutes = sched.minutes_by_slug(topics_by_slug, closure, emphasis)
    layers = sched.topological_layers(topics_by_slug, closure)
    sprints = sched.pack_sprints(layers, minutes, weekly_minutes)
    days = sched.expand_days(sprints, topics_by_slug, minutes, start, study_days)
    return {"minutes": minutes, "sprints": sprints, "days": days}


def _apply_sprint_copy(
    sprints: List[Dict[str, Any]],
    copy: List[Dict[str, Any]],
    start: date,
) -> List[Dict[str, Any]]:
    by_index = {entry["index"]: entry for entry in copy}
    decorated = []
    for sprint in sprints:
        written = by_index.get(sprint["index"], {})
        decorated.append({
            **sprint,
            **sched.sprint_dates(start, sprint["index"]),
            "title": written.get("title") or ("Sprint " + str(sprint["index"] + 1)),
            "focus_line": written.get("focus_line", ""),
            "why_it_matters": written.get("why_it_matters", ""),
            "quiz": None,
        })
    return decorated


def _sprint_view(plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Sprint status is derived, never stored: a sprint is completed once its quiz
    is passed, the first unfinished one is active, the rest are locked. Deriving it
    means a plan can never disagree with its own quiz results."""
    view = []
    active_assigned = False
    for sprint in plan.get("sprints", []):
        quiz = sprint.get("quiz") or {}
        if quiz.get("passed"):
            status = "completed"
        elif not active_assigned:
            status = "active"
            active_assigned = True
        else:
            status = "locked"
        view.append({**sprint, "status": status})
    return view


async def _reconcile_completions(db, plan: Dict[str, Any]) -> Dict[str, Any]:
    """Credit plan tasks for work the learner did elsewhere in the app, so they
    never tick the same box twice.

    Two signals: a roadmap topic marked completed credits every task for that
    topic, and any quiz attempt on a topic credits its practice task. Flashcard
    reviews are not auto-credited -- flashcard_reviews keys on the card, not on the
    topic's category, so there is no cheap join back to a task.
    """
    completed_tasks = dict(plan.get("completed_tasks") or {})
    if not plan.get("days"):
        return completed_tasks

    uid = plan["firebase_uid"]
    completed_topics = await fetch_completed_slugs(db, uid)
    try:
        quizzed_slugs = set(await db.quiz_attempts.distinct("topic_slug", {"firebase_uid": uid}))
    except Exception:
        quizzed_slugs = set()

    now = datetime.utcnow()
    added = False
    for day in plan["days"]:
        for task in day["tasks"]:
            task_id = task["task_id"]
            if task_id in completed_tasks:
                continue
            slug = task["topic_slug"]
            if slug in completed_topics or (task["kind"] == "practice_quiz" and slug in quizzed_slugs):
                completed_tasks[task_id] = {"completed_at": now, "source": "derived"}
                added = True

    if added:
        await db.qplanner_plans.update_one(
            {"_id": plan["_id"]},
            {"$set": {"completed_tasks": completed_tasks, "updated_at": now}},
        )
        plan["completed_tasks"] = completed_tasks
    return completed_tasks


def _plan_response(plan: Dict[str, Any], completed_tasks: Dict[str, Any], today: date) -> Dict[str, Any]:
    serialized = _serialize(plan)
    serialized["sprints"] = _sprint_view(plan)
    serialized["completed_tasks"] = sorted(completed_tasks)
    serialized["drift"] = sched.compute_drift(plan.get("days", []), completed_tasks, today)
    today_str = today.isoformat()
    serialized["today"] = next(
        (day for day in plan.get("days", []) if day["date"] == today_str),
        {"date": today_str, "sprint_index": None, "tasks": []},
    )
    serialized["next_up"] = next(
        (day for day in plan.get("days", []) if day["date"] > today_str), None,
    )
    return serialized


async def _active_plan_or_404(db, uid: str) -> Dict[str, Any]:
    plan = await db.qplanner_plans.find_one({"firebase_uid": uid, "status": "active"})
    if not plan:
        raise HTTPException(status_code=404, detail="No active plan")
    return plan


async def _load_context(db, uid: str, payload: PlanRequest) -> Dict[str, Any]:
    preset = get_preset(payload.preset_slug)
    if preset is None:
        raise HTTPException(status_code=404, detail="Unknown preset '" + payload.preset_slug + "'")

    topics_by_slug = sched.index_topics(await fetch_topics(db))
    if not topics_by_slug:
        raise HTTPException(status_code=503, detail="Roadmap topics are unavailable")

    domains = payload.target_domains if payload.target_domains is not None else preset["target_domains"]
    targets = sched.topics_for_domains(topics_by_slug, domains)
    completed = await fetch_completed_slugs(db, uid)
    return {
        "preset": preset,
        "topics_by_slug": topics_by_slug,
        "domains": domains,
        "targets": targets,
        "completed": completed,
        "mastery": await fetch_mastery_map(db, uid),
        "closure": sched.prereq_closure(topics_by_slug, targets, completed),
    }


async def _generate_plan(
    db,
    uid: str,
    payload: PlanRequest,
    replanned_from: Optional[ObjectId] = None,
) -> Dict[str, Any]:
    today = date.today()
    if payload.deadline <= today:
        raise HTTPException(status_code=400, detail="Deadline must be in the future")

    context = await _load_context(db, uid, payload)
    closure = context["closure"]
    if not closure:
        raise HTTPException(
            status_code=400,
            detail="You have already completed every topic in this goal -- pick a wider one",
        )

    topics_by_slug = context["topics_by_slug"]
    planned_slugs = sorted(closure)

    # Pass 1: deterministic emphasis, so there is a real skeleton to show the model.
    baseline = qplanner_ai.baseline_emphasis(planned_slugs, context["mastery"])
    schedule = _build_schedule(
        topics_by_slug, closure, baseline, payload.weekly_minutes, today, payload.study_days,
    )

    narrative = await qplanner_ai.generate_narrative(
        goal_label=context["preset"]["label"],
        sprints=schedule["sprints"],
        topics_by_slug=topics_by_slug,
        mastery_map=context["mastery"],
        planned_slugs=planned_slugs,
        deadline=payload.deadline.isoformat(),
        weekly_minutes=payload.weekly_minutes,
        identity=uid,
    )

    # Pass 2: only when the model actually moved an emphasis, since that changes minutes.
    if narrative["emphasis"] != baseline:
        schedule = _build_schedule(
            topics_by_slug, closure, narrative["emphasis"],
            payload.weekly_minutes, today, payload.study_days,
        )

    sprints = _apply_sprint_copy(schedule["sprints"], narrative["sprints"], today)
    now = datetime.utcnow()

    doc = {
        "firebase_uid": uid,
        "status": "active",
        "preset_slug": context["preset"]["slug"],
        "goal_label": context["preset"]["label"],
        "target_domains": context["domains"],
        "target_slugs": planned_slugs,
        "start_date": today.isoformat(),
        "deadline": payload.deadline.isoformat(),
        "weekly_minutes": payload.weekly_minutes,
        "study_days": payload.study_days,
        "ai_generated": narrative["ai_generated"],
        "strategy_note": narrative["strategy_note"],
        "personalized_tips": narrative["personalized_tips"],
        "emphasis": narrative["emphasis"],
        "sprints": sprints,
        "days": schedule["days"],
        "completed_tasks": {},
        "replanned_from": replanned_from,
        "feasibility": sched.feasibility(
            sum(schedule["minutes"].values()), today, payload.deadline,
            payload.weekly_minutes, sprints_needed=len(sprints),
        ),
        "created_at": now,
        "updated_at": now,
    }

    # ponytail: archive-then-insert rather than a unique partial index, so two
    # simultaneous POSTs could briefly leave two active plans. Add the partial
    # index if that ever actually happens.
    await db.qplanner_plans.update_many(
        {"firebase_uid": uid, "status": "active"},
        {"$set": {"status": "archived", "updated_at": now}},
    )
    result = await db.qplanner_plans.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/presets", summary="Goal presets the intake form opens on")
async def list_presets(decoded_token: dict = Depends(get_verified_firebase_user)):
    return _envelope(PRESETS)


@router.post("/plan/preview", summary="Topic count, sprint count and feasibility without saving anything")
async def preview_plan(
    payload: PlanRequest,
    decoded_token: dict = Depends(get_verified_firebase_user),
):
    """Powers the live readout under the intake form's weekly-hours slider. Purely
    deterministic -- no gateway call, so it is safe to hit on every slider move."""
    db = _require_db()
    uid = decoded_token.get("uid")

    context = await _load_context(db, uid, payload)
    closure = context["closure"]
    today = date.today()

    emphasis = qplanner_ai.baseline_emphasis(sorted(closure), context["mastery"])
    schedule = _build_schedule(
        context["topics_by_slug"], closure, emphasis,
        payload.weekly_minutes, today, payload.study_days,
    )
    total_minutes = sum(schedule["minutes"].values())

    return _envelope({
        "goal_label": context["preset"]["label"],
        "topic_count": len(closure),
        "already_completed": len(context["targets"] & set(context["completed"])),
        "sprint_count": len(schedule["sprints"]),
        "total_minutes": total_minutes,
        "feasibility": sched.feasibility(
            total_minutes, today, payload.deadline, payload.weekly_minutes,
            sprints_needed=len(schedule["sprints"]),
        ),
    })


@router.post("/plan", summary="Generate a study plan, archiving any previous active one")
async def create_plan(
    payload: PlanRequest,
    decoded_token: dict = Depends(get_verified_firebase_user),
):
    db = _require_db()
    uid = decoded_token.get("uid")
    plan = await _generate_plan(db, uid, payload)
    return _envelope(_plan_response(plan, {}, date.today()))


@router.get("/plan", summary="The active plan, with drift and today's tasks")
async def get_plan(decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _require_db()
    uid = decoded_token.get("uid")
    plan = await _active_plan_or_404(db, uid)
    completed = await _reconcile_completions(db, plan)
    return _envelope(_plan_response(plan, completed, date.today()))


@router.post("/plan/tasks/{task_id}/complete", summary="Tick a task")
async def complete_task(task_id: str, decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _require_db()
    uid = decoded_token.get("uid")
    plan = await _active_plan_or_404(db, uid)

    known = {t["task_id"] for day in plan.get("days", []) for t in day["tasks"]}
    if task_id not in known:
        raise HTTPException(status_code=404, detail="No such task in the active plan")

    now = datetime.utcnow()
    await db.qplanner_plans.update_one(
        {"_id": plan["_id"]},
        {"$set": {
            "completed_tasks." + task_id: {"completed_at": now, "source": "manual"},
            "updated_at": now,
        }},
    )
    plan.setdefault("completed_tasks", {})[task_id] = {"completed_at": now, "source": "manual"}
    return _envelope({
        "task_id": task_id,
        "completed": True,
        "drift": sched.compute_drift(plan["days"], plan["completed_tasks"], date.today()),
    })


@router.post("/plan/tasks/{task_id}/uncomplete", summary="Untick a task")
async def uncomplete_task(task_id: str, decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _require_db()
    uid = decoded_token.get("uid")
    plan = await _active_plan_or_404(db, uid)

    now = datetime.utcnow()
    await db.qplanner_plans.update_one(
        {"_id": plan["_id"]},
        {"$unset": {"completed_tasks." + task_id: ""}, "$set": {"updated_at": now}},
    )
    plan.get("completed_tasks", {}).pop(task_id, None)
    return _envelope({
        "task_id": task_id,
        "completed": False,
        "drift": sched.compute_drift(plan.get("days", []), plan.get("completed_tasks", {}), date.today()),
    })


@router.get("/plan/sprints/{index}/quiz", summary="Sprint quiz questions, drawn from the sprint's topics")
async def start_sprint_quiz(
    index: int,
    count: int = Query(SPRINT_QUIZ_QUESTION_COUNT, ge=1, le=30),
    decoded_token: dict = Depends(get_verified_firebase_user),
):
    db = _require_db()
    uid = decoded_token.get("uid")
    plan = await _active_plan_or_404(db, uid)

    sprint = next((s for s in plan.get("sprints", []) if s["index"] == index), None)
    if sprint is None:
        raise HTTPException(status_code=404, detail="No sprint " + str(index) + " in the active plan")

    slugs = sprint["topic_slugs"]
    questions = await db.quiz_questions.find(
        {"$or": [{"topic_slug": {"$in": slugs}}, {"tags": {"$in": slugs}}]}
    ).to_list(length=200)
    if not questions:
        raise HTTPException(
            status_code=404, detail="No quiz questions exist yet for this sprint's topics",
        )

    selected = random.sample(questions, min(count, len(questions)))
    return _envelope({
        "sprint_index": index,
        "sprint_title": sprint.get("title", ""),
        "topic_slugs": slugs,
        "questions": [strip_sensitive_answers(q) for q in selected],
        "total_questions": len(selected),
        "pass_mark_pct": sched.SPRINT_QUIZ_PASS_PCT,
    })


@router.post("/plan/sprints/{index}/quiz", summary="Grade a sprint quiz and unlock the next sprint on a pass")
async def submit_sprint_quiz(
    index: int,
    payload: SprintQuizSubmission,
    decoded_token: dict = Depends(get_verified_firebase_user),
):
    db = _require_db()
    uid = decoded_token.get("uid")
    plan = await _active_plan_or_404(db, uid)

    position = next(
        (i for i, s in enumerate(plan.get("sprints", [])) if s["index"] == index), None,
    )
    if position is None:
        raise HTTPException(status_code=404, detail="No sprint " + str(index) + " in the active plan")
    if not payload.answers:
        raise HTTPException(status_code=400, detail="No answers provided")

    # Same grading, XP, streak and badge path as a normal quiz attempt. topic_slug is
    # the synthetic "qplanner-sprint" because the attempt spans several topics:
    # per-topic mastery keeps coming from single-topic attempts, while analytics'
    # concept matrix still sees these answers through their per-question concept tags.
    result = await grade_and_record_attempt(
        db=db,
        firebase_uid=uid,
        topic_slug="qplanner-sprint",
        answers_input=payload.answers,
        mode="sprint_quiz",
        started_at=payload.started_at,
        extra={
            "plan_id": plan["_id"],
            "sprint_index": index,
            "sprint_topic_slugs": plan["sprints"][position]["topic_slugs"],
        },
    )
    new_badges = result.pop("new_badges")
    passed = result["score_pct"] >= sched.SPRINT_QUIZ_PASS_PCT

    now = datetime.utcnow()
    quiz_record = {
        "attempt_id": result["attempt_id"],
        "score_pct": result["score_pct"],
        "passed": passed,
        "submitted_at": now,
    }
    await db.qplanner_plans.update_one(
        {"_id": plan["_id"]},
        {"$set": {"sprints." + str(position) + ".quiz": quiz_record, "updated_at": now}},
    )
    plan["sprints"][position]["quiz"] = dict(quiz_record, submitted_at=now.isoformat())

    return _envelope(
        {**result, "passed": passed, "pass_mark_pct": sched.SPRINT_QUIZ_PASS_PCT,
         "sprints": _sprint_view(plan)},
        meta={"new_badges": new_badges},
    )


@router.post("/plan/replan", summary="Rebuild the plan from today, keeping what has been completed")
async def replan(
    payload: Optional[PlanRequest] = None,
    decoded_token: dict = Depends(get_verified_firebase_user),
):
    """Drift never reshuffles a plan on its own -- this is the learner asking for it.
    Topics they have completed since drop out of the closure, so the rebuilt plan is
    shorter, not merely shifted."""
    db = _require_db()
    uid = decoded_token.get("uid")
    previous = await _active_plan_or_404(db, uid)

    if payload is None:
        payload = PlanRequest(
            preset_slug=previous["preset_slug"],
            deadline=date.fromisoformat(previous["deadline"]),
            weekly_minutes=previous["weekly_minutes"],
            study_days=previous["study_days"],
            target_domains=previous.get("target_domains"),
        )

    plan = await _generate_plan(db, uid, payload, replanned_from=previous["_id"])
    return _envelope(_plan_response(plan, {}, date.today()))


@router.delete("/plan", summary="Archive the active plan")
async def archive_plan(decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _require_db()
    uid = decoded_token.get("uid")
    plan = await _active_plan_or_404(db, uid)
    await db.qplanner_plans.update_one(
        {"_id": plan["_id"]},
        {"$set": {"status": "archived", "updated_at": datetime.utcnow()}},
    )
    return _envelope({"archived": str(plan["_id"])})
