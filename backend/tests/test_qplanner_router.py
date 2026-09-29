"""End-to-end checks for Qplanner's router against a fake Mongo.

The point of these is the failure path: a plan must still generate, persist and
read back correctly when the AI gateway is dead, because that is exactly what
happens with no provider keys configured. Scheduler invariants live in
tests/test_qplanner_schedule.py.

Style follows tests/test_verification_mentorship.py: a hand-rolled fake collection,
a patched get_db, and asyncio.run to drive the handlers directly.

Run: python -m pytest tests/test_qplanner_router.py -v
     python tests/test_qplanner_router.py
"""
import asyncio
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bson import ObjectId
from fastapi import HTTPException

from routers import qplanner_router as qp
from services import qplanner_ai

UID = "learner-test-uid"
TOKEN = {"uid": UID}


def _topic(slug, order, minutes=60, prereqs=(), domain="quantum-maths"):
    return {
        "slug": slug,
        "title": slug.upper(),
        "domain": domain,
        "order_index": order,
        "estimated_minutes": minutes,
        "prerequisites": list(prereqs),
        "content_refs": {
            "videos": [{"title": slug, "url": "https://example.test/" + slug}],
            "slides": [{"title": slug, "url": "/slides/" + slug + ".pdf"}],
            "quiz_topic_tag": slug + "-quiz",
            "flashcard_category": slug.upper(),
        },
    }


TOPICS = [
    _topic("a", 1),
    _topic("b", 2, prereqs=["a"]),
    _topic("c", 3, prereqs=["b"]),
]


# ---------------- fake Mongo ----------------

class _Collection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find(self, query=None):
        docs = self.docs

        class _Cursor:
            async def to_list(self, length=None):
                return list(docs[:length] if length else docs)

        return _Cursor()

    async def find_one(self, query):
        if "_id" in query:
            return next((d for d in self.docs if d.get("_id") == query["_id"]), None)
        return next(
            (d for d in self.docs if all(d.get(k) == v for k, v in query.items())), None
        )

    async def insert_one(self, doc):
        doc["_id"] = ObjectId()
        self.docs.append(doc)
        return type("R", (), {"inserted_id": doc["_id"]})()

    async def update_one(self, query, update):
        doc = await self.find_one(query)
        if doc is None:
            return
        for key, value in (update.get("$set") or {}).items():
            target = doc
            parts = key.split(".")
            for part in parts[:-1]:
                target = target[int(part)] if part.isdigit() else target.setdefault(part, {})
            last = parts[-1]
            if isinstance(target, list):
                target[int(last)] = value
            else:
                target[last] = value
        for key in (update.get("$unset") or {}):
            parts = key.split(".")
            target = doc
            for part in parts[:-1]:
                target = target.get(part, {})
            if isinstance(target, dict):
                target.pop(parts[-1], None)

    async def update_many(self, query, update):
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                doc.update(update.get("$set") or {})

    async def distinct(self, field, query=None):
        return sorted({d.get(field) for d in self.docs if d.get(field) is not None})


class _DB:
    def __init__(self, topics=TOPICS, progress=(), attempts=()):
        self.roadmap_topics = _Collection(topics)
        self.user_progress = _Collection(list(progress))
        self.quiz_attempts = _Collection(list(attempts))
        self.quiz_questions = _Collection()
        self.qplanner_plans = _Collection()


def _install(db, gateway_raises=True):
    """Point everything that reaches for a DB or the gateway at our fakes.

    topic_prefilter is patched as well as the router because the router imports
    its history readers by reference at import time.
    """
    import services.topic_prefilter as prefilter

    qp.get_db = lambda: db
    prefilter.get_db = lambda: db

    if gateway_raises:
        async def _chat(*args, **kwargs):
            raise RuntimeError("no provider configured")

        qplanner_ai.ai_gateway.chat = _chat


def _request(**overrides):
    payload = {
        "preset_slug": "quantum-foundations",
        "deadline": date.today() + timedelta(weeks=8),
        "weekly_minutes": 300,
        "study_days": [0, 2, 4],
        "target_domains": ["quantum-maths"],
    }
    payload.update(overrides)
    return qp.PlanRequest(**payload)


# ---------------- tests ----------------

def test_plan_generates_with_a_dead_gateway():
    """The demo-day safety net: no provider keys must still yield a usable plan."""
    db = _DB()
    _install(db)

    result = asyncio.run(qp.create_plan(_request(), TOKEN))
    plan = result["data"]

    assert result["error"] is None
    assert plan["ai_generated"] is False, "a dead gateway must be reported, not hidden"
    assert plan["strategy_note"], "deterministic copy still has to say something"
    assert plan["sprints"], "a plan with no sprints is not a plan"
    assert all(s["title"] for s in plan["sprints"]), "every sprint needs a title"
    assert plan["target_slugs"] == ["a", "b", "c"]
    assert len(db.qplanner_plans.docs) == 1


def test_generated_plan_respects_prerequisites_and_budget():
    db = _DB()
    _install(db)
    plan = asyncio.run(qp.create_plan(_request(weekly_minutes=60), TOKEN))["data"]

    ordered = [slug for sprint in plan["sprints"] for slug in sprint["topic_slugs"]]
    assert ordered == ["a", "b", "c"], "a chain of prerequisites must stay in order"
    assert all(s["planned_minutes"] <= 60 for s in plan["sprints"])
    assert plan["sprints"][0]["status"] == "active"
    assert plan["sprints"][1]["status"] == "locked"


def test_completed_topics_drop_out_of_the_plan():
    db = _DB(progress=[{"firebase_uid": UID, "topic_slug": "a", "status": "completed"}])
    _install(db)
    plan = asyncio.run(qp.create_plan(_request(), TOKEN))["data"]
    assert plan["target_slugs"] == ["b", "c"], "already-completed work must not be re-planned"


def test_generating_a_second_plan_archives_the_first():
    db = _DB()
    _install(db)
    asyncio.run(qp.create_plan(_request(), TOKEN))
    asyncio.run(qp.create_plan(_request(weekly_minutes=600), TOKEN))

    statuses = sorted(d["status"] for d in db.qplanner_plans.docs)
    assert statuses == ["active", "archived"], "only one plan may be active"


def test_ticking_a_task_moves_drift():
    db = _DB()
    _install(db)
    plan = asyncio.run(qp.create_plan(_request(), TOKEN))["data"]
    first_task = plan["days"][0]["tasks"][0]["task_id"]

    result = asyncio.run(qp.complete_task(first_task, TOKEN))["data"]
    assert result["completed"] is True
    assert result["drift"]["completed"] == 1

    result = asyncio.run(qp.uncomplete_task(first_task, TOKEN))["data"]
    assert result["completed"] is False
    assert result["drift"]["completed"] == 0


def test_ticking_an_unknown_task_is_rejected():
    db = _DB()
    _install(db)
    asyncio.run(qp.create_plan(_request(), TOKEN))
    try:
        asyncio.run(qp.complete_task("1999-01-01:nope:learn_video", TOKEN))
    except HTTPException as exc:
        assert exc.status_code == 404
    else:
        raise AssertionError("an unknown task id must 404")


def test_reconcile_credits_work_done_elsewhere():
    """A topic completed on the roadmap page credits its plan tasks, so the learner
    never ticks the same box twice."""
    db = _DB()
    _install(db)
    asyncio.run(qp.create_plan(_request(), TOKEN))

    db.user_progress.docs.append(
        {"firebase_uid": UID, "topic_slug": "a", "status": "completed"}
    )
    plan = asyncio.run(qp.get_plan(TOKEN))["data"]

    credited = {tid for tid in plan["completed_tasks"] if ":a:" in tid}
    assert credited, "completing topic 'a' must credit its plan tasks"
    assert plan["drift"]["completed"] == len(credited)


def test_past_deadline_is_rejected():
    db = _DB()
    _install(db)
    try:
        asyncio.run(qp.create_plan(_request(deadline=date.today()), TOKEN))
    except HTTPException as exc:
        assert exc.status_code == 400
    else:
        raise AssertionError("a deadline of today or earlier must 400")


def test_goal_with_nothing_left_to_learn_is_rejected():
    db = _DB(progress=[
        {"firebase_uid": UID, "topic_slug": slug, "status": "completed"}
        for slug in ("a", "b", "c")
    ])
    _install(db)
    try:
        asyncio.run(qp.create_plan(_request(), TOKEN))
    except HTTPException as exc:
        assert exc.status_code == 400
    else:
        raise AssertionError("a fully completed goal must 400 rather than store an empty plan")


def test_preview_does_not_persist_anything():
    db = _DB()
    _install(db)
    preview = asyncio.run(qp.preview_plan(_request(), TOKEN))["data"]

    assert preview["topic_count"] == 3
    assert preview["sprint_count"] >= 1
    assert "feasible" in preview["feasibility"]
    assert db.qplanner_plans.docs == [], "preview must not write a plan"


def test_no_active_plan_is_a_404():
    db = _DB()
    _install(db)
    try:
        asyncio.run(qp.get_plan(TOKEN))
    except HTTPException as exc:
        assert exc.status_code == 404
    else:
        raise AssertionError("asking for a plan that does not exist must 404")


def test_study_days_must_not_be_empty():
    try:
        _request(study_days=[9, -1])
    except Exception as exc:
        assert "study day" in str(exc)
    else:
        raise AssertionError("a plan with no valid study day must be rejected at validation")


def test_mastery_drives_emphasis():
    """The AI-free half of 'AI-driven customization': a topic the learner already
    scores well on is scheduled lighter, a weak one deeper."""
    assert qplanner_ai.baseline_emphasis(["a", "b", "c"], {"a": 95.0, "b": 20.0}) == {
        "a": "light", "b": "deep", "c": "normal",
    }


# ---------------- the schema the provider validates (regression: 2026-09-27 400s) ----------------

def test_schema_sent_to_provider_constrains_levels_and_drops_index():
    """Groq validates tool-call arguments against this schema server-side. A free-form
    emphasis map let the model write prose instead of a level, and a required sprint
    `index` it did not send got the whole call rejected with a 400."""
    schema = qplanner_ai.PlanNarrative.model_json_schema()
    level = schema["$defs"]["TopicEmphasis"]["properties"]["level"]
    assert level["enum"] == ["light", "normal", "deep"]
    assert schema["properties"]["emphasis"]["type"] == "array"
    assert "index" not in schema["$defs"]["SprintCopy"]["properties"]


def test_invalid_emphasis_level_is_rejected():
    from pydantic import ValidationError

    try:
        qplanner_ai.TopicEmphasis(slug="a", level="extremely-deep")
    except ValidationError:
        pass
    else:
        raise AssertionError("an emphasis level outside light/normal/deep must not validate")


def test_model_emphasis_merges_and_ignores_unknown_slugs():
    narrative = qplanner_ai.PlanNarrative(emphasis=[
        qplanner_ai.TopicEmphasis(slug="a", level="deep"),
        qplanner_ai.TopicEmphasis(slug="not-in-the-plan", level="light"),
    ])
    merged = qplanner_ai.merge_emphasis(narrative, {"a": "normal", "b": "normal"})
    assert merged == {"a": "deep", "b": "normal"}


def test_sprint_copy_maps_by_position_and_falls_back_when_short():
    from services.qplanner_schedule import index_topics

    sprints = [
        {"index": 0, "topic_slugs": ["a"], "planned_minutes": 60},
        {"index": 1, "topic_slugs": ["b"], "planned_minutes": 60},
    ]
    narrative = qplanner_ai.PlanNarrative(sprints=[qplanner_ai.SprintCopy(title="First steps")])
    merged = qplanner_ai.merge_sprint_copy(narrative, sprints, index_topics(TOPICS))

    assert merged[0]["title"] == "First steps"
    assert merged[1]["title"] == "B", "a sprint the model skipped falls back to its topic's title"


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("PASS " + name)
            except Exception as exc:  # noqa: BLE001 - self-check runner
                failures += 1
                print("FAIL " + name + ": " + repr(exc))
    print(("FAILURES: " + str(failures)) if failures else "all router checks passed")
    sys.exit(1 if failures else 0)


def test_day_minutes_replace_weekly_budget_and_study_days():
    from datetime import date as _date
    from routers.qplanner_router import PlanRequest
    from services.qplanner_ai import baseline_emphasis

    req = PlanRequest(preset_slug="algorithms-sprint", day_minutes=[60, 0, 60, 0, 60, 90, 0])
    assert req.weekly_minutes == 270
    assert req.study_days == [0, 2, 4, 5]
    assert req.deadline is None

    try:
        PlanRequest(preset_slug="algorithms-sprint", day_minutes=[0] * 7)
        assert False, "an all-zero week must be rejected"
    except ValueError:
        pass
    try:
        PlanRequest(preset_slug="x", weekly_minutes=300, start_date=_date(2000, 1, 1))
        assert False, "a start date in the past must be rejected"
    except ValueError:
        pass

    # declared level only fills in for topics with no quiz history
    emphasis = baseline_emphasis(["a", "b"], {"a": 95.0}, {"a": "deep", "b": "deep"})
    assert emphasis == {"a": "light", "b": "deep"}
