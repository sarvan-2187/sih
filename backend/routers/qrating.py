"""Q-Rating: weekly quantum contests and the competency rating they produce.

Response envelope matches the rest of the learning routers ({data, meta, error},
see routers/puzzles.py). All rating writes go through
services.qrating.rounds_service - nothing here computes a rating itself.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_verified_firebase_user, require_role
from database import get_db
from services.badge_engine import badge_engine
from services.qbraid_service import qbraid_service
from services.qiskit_service import ensure_measurements, qiskit_service
from services.qrating import rounds_service as rs
from services.qrating.tiers import get_tier, ladder
from services.xp_engine import xp_engine

router = APIRouter(prefix="/api/v1/qrating", tags=["Q-Rating"])
require_admin = require_role("admin")


def ok(data: Any, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"data": data, "meta": meta, "error": None}


def _db():
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    return db


def _oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail="Malformed id")
    return ObjectId(value)


async def _round_or_404(db, round_id: str) -> Dict[str, Any]:
    doc = await db.qrating_rounds.find_one({"_id": _oid(round_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Round not found")
    return doc


def _serialize_round(doc: Dict[str, Any]) -> Dict[str, Any]:
    phase = rs.round_phase(doc)
    return {
        "id": str(doc["_id"]),
        "round_number": doc.get("round_number"),
        "title": doc.get("title"),
        "starts_at": doc.get("starts_at"),
        "ends_at": doc.get("ends_at"),
        "duration_minutes": doc.get("duration_minutes"),
        "task_count": len(doc.get("tasks") or []),
        "phase": phase,
        "season_id": doc.get("season_id"),
    }


async def _display_names(db, uids: List[str]) -> Dict[str, str]:
    """Leaderboards need names, and users live in the existing users collection."""
    names: Dict[str, str] = {}
    async for user in db.users.find({"firebase_uid": {"$in": uids}}):
        label = (user.get("display_name") or user.get("full_name")
                 or (user.get("email") or "").split("@")[0] or "Quantum Learner")
        names[user["firebase_uid"]] = label
    return {uid: names.get(uid, "Quantum Learner") for uid in uids}


# --- rounds -----------------------------------------------------------------

@router.get("/rounds", summary="Upcoming and past rounds")
async def list_rounds(decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _db()
    docs = await db.qrating_rounds.find({}).sort("starts_at", -1).to_list(length=50)
    rounds = [_serialize_round(doc) for doc in docs]
    upcoming = [r for r in rounds if r["phase"] == rs.SCHEDULED]
    return ok(rounds, {
        "total": len(rounds),
        # The countdown on the dashboard needs the next one, not all of them.
        "next_round": min(upcoming, key=lambda r: r["starts_at"]) if upcoming else None,
        "live_round": next((r for r in rounds if r["phase"] == rs.LIVE), None),
    })


@router.get("/rounds/{round_id}", summary="One round, with your entry state")
async def get_round(round_id: str, decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _db()
    doc = await _round_or_404(db, round_id)
    uid = decoded_token.get("uid")
    return ok({
        **_serialize_round(doc),
        "registered": await rs.is_registered(db, doc, uid),
        "seconds_until_start": max(0, int((rs._aware(doc["starts_at"])
                                           - datetime.now(timezone.utc)).total_seconds())),
        "seconds_remaining": max(0, int((rs._aware(doc["ends_at"])
                                        - datetime.now(timezone.utc)).total_seconds())),
    })


@router.post("/rounds/{round_id}/register", summary="Enter a round")
async def register_for_round(round_id: str,
                             decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _db()
    doc = await _round_or_404(db, round_id)
    if rs.round_phase(doc) in (rs.ENDED, rs.FINALIZED):
        raise HTTPException(status_code=409, detail="This round has already finished")
    created = await rs.register(db, doc, decoded_token.get("uid"))
    return ok({"registered": True, "newly_registered": created})


@router.get("/rounds/{round_id}/tasks", summary="The round's tasks")
async def get_round_tasks(round_id: str,
                          decoded_token: dict = Depends(get_verified_firebase_user)):
    """Withheld until the clock starts - this is the anti-leak gate. Everything
    returned is already stripped of graders, hidden tests and expected answers."""
    db = _db()
    doc = await _round_or_404(db, round_id)
    if rs.round_phase(doc) == rs.SCHEDULED:
        raise HTTPException(status_code=403,
                            detail="Tasks unlock when the round starts")
    return ok(await rs.public_round_tasks(db, doc))


# --- submitting -------------------------------------------------------------

class SubmissionIn(BaseModel):
    task_slug: str
    round_id: Optional[str] = None
    # Circuit tasks send gates+num_qubits or qasm; algorithmic tasks send source_code.
    gates: Optional[List[Dict[str, Any]]] = None
    num_qubits: Optional[int] = None
    qasm: Optional[str] = None
    source_code: Optional[str] = None


@router.post("/submissions", summary="Submit a solution and get a verdict")
async def create_submission(body: SubmissionIn,
                            decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _db()
    task = await db.qrating_tasks.find_one({"slug": body.task_slug})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    round_doc = None
    if body.round_id:
        round_doc = await _round_or_404(db, body.round_id)
        if rs.round_phase(round_doc) == rs.SCHEDULED:
            raise HTTPException(status_code=403, detail="This round has not started")
        if not any(entry["slug"] == body.task_slug for entry in round_doc.get("tasks", [])):
            raise HTTPException(status_code=400, detail="That task is not in this round")

    payload = {key: value for key, value in body.model_dump().items()
               if key in ("gates", "num_qubits", "qasm", "source_code") and value is not None}
    if not payload:
        raise HTTPException(status_code=400,
                            detail="Send a circuit (gates or qasm) or source_code")

    result = await rs.submit(db, round_doc, task, decoded_token.get("uid"), payload)
    if result["verdict"] == "rate_limited":
        raise HTTPException(status_code=429, detail=result["detail"])
    return ok(result)


@router.get("/rounds/{round_id}/standings", summary="Live or final standings")
async def get_standings(round_id: str,
                        decoded_token: dict = Depends(get_verified_firebase_user)):
    """While a round runs these are computed live. Once it has ended, the first
    read settles it - so a missed admin call cannot leave ratings hanging."""
    db = _db()
    doc = await _round_or_404(db, round_id)

    settled = await rs.finalize_if_due(db, doc)
    if settled:
        doc = await _round_or_404(db, round_id)

    phase = rs.round_phase(doc)
    if phase == rs.FINALIZED:
        rows = await db.qrating_standings.find(
            {"round_id": doc["_id"]}).sort("rank", 1).to_list(length=500)
        rows = [{"firebase_uid": r["firebase_uid"], "rank": r["rank"], "score": r["score"],
                 "penalty_seconds": r["penalty_seconds"], "per_task": r.get("per_task"),
                 "rating_delta": r.get("rating_delta"), "new_rating": r.get("new_rating")}
                for r in rows]
    else:
        rows = await rs.live_standings(db, doc)

    names = await _display_names(db, [r["firebase_uid"] for r in rows])
    uid = decoded_token.get("uid")
    for row in rows:
        row["display_name"] = names.get(row["firebase_uid"])
        row["is_you"] = row["firebase_uid"] == uid
    return ok(rows, {"phase": phase, "total": len(rows),
                     "your_row": next((r for r in rows if r["is_you"]), None)})


@router.post("/rounds/{round_id}/finalize", summary="Settle a round (admin)")
async def finalize(round_id: str, admin=Depends(require_admin)):
    db = _db()
    doc = await _round_or_404(db, round_id)
    if rs.round_phase(doc) == rs.LIVE:
        raise HTTPException(status_code=409, detail="This round is still running")
    return ok(await rs.finalize_round(db, doc))


# --- the number itself ------------------------------------------------------

async def _rating_history(db, uid: str, limit: int = 50) -> List[Dict[str, Any]]:
    rows = await db.qrating_history.find({"firebase_uid": uid}).sort(
        "created_at", 1).to_list(length=limit)
    return [{"round_number": r.get("round_number"), "old_rating": r["old_rating"],
             "new_rating": r["new_rating"], "delta": r["delta"], "rank": r.get("rank"),
             "participants": r.get("participants"), "score": r.get("score"),
             "mode": r.get("mode"), "at": r.get("created_at")} for r in rows]


@router.get("/me", summary="Your Q-Rating")
async def my_rating(decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _db()
    uid = decoded_token.get("uid")
    profile = await rs.get_profile(db, uid)
    history = await _rating_history(db, uid)
    return ok({
        "rating": profile["rating"],
        "rd": profile["rd"],
        "peak_rating": profile.get("peak_rating"),
        "rounds_played": profile.get("rounds_played", 0),
        "pillar_ratings": profile.get("pillar_ratings") or {},
        "contest_streak": profile.get("contest_streak") or {},
        "is_public": profile.get("is_public", True),
        "tier": profile["tier"],
        "colour": profile["colour"],
        "next_tier": profile["next_tier"],
        "next_tier_at": profile["next_tier_at"],
        "progress_pct": profile["progress_pct"],
        "history": history,
    }, {"unrated": profile.get("rounds_played", 0) == 0, "ladder": ladder()})


@router.get("/leaderboard", summary="Global Q-Rating leaderboard")
async def leaderboard(limit: int = 50,
                      decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _db()
    # Only rated learners appear: an untouched 1200 is a placeholder, not a result.
    docs = await db.qrating_profiles.find({"rounds_played": {"$gte": 1}}).sort(
        "rating", -1).to_list(length=max(1, min(limit, 200)))
    names = await _display_names(db, [d["firebase_uid"] for d in docs])
    uid = decoded_token.get("uid")
    rows = [{
        "rank": index + 1,
        "firebase_uid": doc["firebase_uid"],
        "display_name": names.get(doc["firebase_uid"]),
        "rating": doc["rating"],
        "rounds_played": doc.get("rounds_played", 0),
        "is_you": doc["firebase_uid"] == uid,
        **get_tier(doc["rating"]),
    } for index, doc in enumerate(docs)]
    return ok(rows, {"total": len(rows)})


# --- the verifiable part ----------------------------------------------------

@router.get("/public/{handle}", summary="Public, auditable Q-Rating profile")
async def public_profile(handle: str):
    """The only unauthenticated route in this router, and the reason the number
    is verifiable rather than merely asserted: anyone given a handle can see how
    every point was earned - which round, which rank, which delta.

    Exposes nothing but the rating record. Opt-in via is_public.
    """
    db = _db()
    profile = await db.qrating_profiles.find_one({"handle": handle, "is_public": True})
    if not profile:
        raise HTTPException(status_code=404, detail="No public Q-Rating profile for that handle")

    uid = profile["firebase_uid"]
    names = await _display_names(db, [uid])
    return ok({
        "handle": handle,
        "display_name": names.get(uid),
        "rating": profile["rating"],
        "rd": profile.get("rd"),
        "peak_rating": profile.get("peak_rating"),
        "rounds_played": profile.get("rounds_played", 0),
        "pillar_ratings": profile.get("pillar_ratings") or {},
        **get_tier(profile["rating"]),
        # The ledger. Every row is immutable and was written at settlement time.
        "ledger": await _rating_history(db, uid, limit=200),
    })


class ProfileSettingsIn(BaseModel):
    handle: Optional[str] = Field(default=None, min_length=3, max_length=30,
                                  pattern=r"^[a-zA-Z0-9_-]+$")
    is_public: Optional[bool] = None


@router.patch("/me/settings", summary="Claim a handle or change visibility")
async def update_settings(body: ProfileSettingsIn,
                          decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _db()
    uid = decoded_token.get("uid")
    await rs.get_profile(db, uid)  # make sure a profile exists to patch

    changes: Dict[str, Any] = {}
    if body.handle is not None:
        taken = await db.qrating_profiles.find_one({"handle": body.handle,
                                                    "firebase_uid": {"$ne": uid}})
        if taken:
            raise HTTPException(status_code=409, detail="That handle is taken")
        changes["handle"] = body.handle
    if body.is_public is not None:
        changes["is_public"] = body.is_public
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to change")

    await db.qrating_profiles.update_one({"firebase_uid": uid}, {"$set": changes})
    return ok(await rs.get_profile(db, uid))


# --- practice ---------------------------------------------------------------

@router.get("/tasks/practice", summary="Unrated practice archive")
async def practice_tasks(decoded_token: dict = Depends(get_verified_firebase_user)):
    """Everything from past rounds, always open and never rated - practice keeps
    the contest rating scarce and the archive useful forever."""
    db = _db()
    live_or_upcoming = set()
    async for doc in db.qrating_rounds.find({}):
        if rs.round_phase(doc) in (rs.SCHEDULED, rs.LIVE):
            live_or_upcoming.update(entry["slug"] for entry in doc.get("tasks", []))

    from services.qrating.task_seed import public_task
    tasks = []
    async for task in db.qrating_tasks.find({}):
        # Never hand out a task that is about to be, or currently being, contested.
        if task["slug"] in live_or_upcoming:
            continue
        tasks.append({**public_task(task), "difficulty": round(task.get("difficulty", 1200))})
    return ok(tasks, {"total": len(tasks)})


# --- admin ------------------------------------------------------------------

class RoundIn(BaseModel):
    round_number: int
    title: str
    starts_at: datetime
    task_slugs: List[str] = Field(min_length=1)
    duration_minutes: int = rs.DEFAULT_DURATION_MINUTES
    season_id: Optional[str] = None


@router.post("/admin/seed", summary="Seed the task bank (admin)")
async def seed_tasks(admin=Depends(require_admin)):
    db = _db()
    return ok({"tasks_seeded": await rs.ensure_tasks_seeded(db)})


@router.post("/admin/rounds", summary="Schedule a round (admin)")
async def create_round(body: RoundIn, admin=Depends(require_admin)):
    db = _db()
    known = {doc["slug"] async for doc in db.qrating_tasks.find({})}
    missing = [slug for slug in body.task_slugs if slug not in known]
    if missing:
        raise HTTPException(status_code=400, detail="Unknown task slugs: %s" % ", ".join(missing))
    doc = await rs.create_round(db, body.round_number, body.title, body.starts_at,
                                body.task_slugs, body.duration_minutes, body.season_id)
    return ok(_serialize_round(doc))


# --- optional real-hardware verification ------------------------------------
# Deliberately separate from scoring. qBraid jobs are asynchronous, rate limited
# and cost credits, so a live round can never wait on one: this awards a badge
# and nothing else. See services/qrating/graders.grade_hardware for how the
# scored version works (a device noise model, graded instantly).

QBRAID_DAILY_JOB_LIMIT = int(os.getenv("QBRAID_DAILY_JOB_LIMIT", "5"))


async def _submission_or_404(db, submission_id: str, firebase_uid: str) -> Dict[str, Any]:
    doc = await db.qrating_submissions.find_one({"_id": _oid(submission_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Submission not found")
    if doc["firebase_uid"] != firebase_uid:
        raise HTTPException(status_code=403, detail="You can only verify your own submissions")
    return doc


class HardwareRunIn(BaseModel):
    device_id: str
    shots: int = Field(default=1024, ge=1, le=4096)


@router.post("/submissions/{submission_id}/hardware", summary="Run an accepted solution on real hardware")
async def run_on_hardware(submission_id: str, body: HardwareRunIn,
                          decoded_token: dict = Depends(get_verified_firebase_user)):
    db = _db()
    uid = decoded_token.get("uid")
    submission = await _submission_or_404(db, submission_id, uid)

    if submission.get("verdict") != "accepted":
        raise HTTPException(status_code=409,
                            detail="Only an accepted solution can be run on hardware")
    if submission.get("hardware_job_id"):
        return ok({"job_id": str(submission["hardware_job_id"]), "already_submitted": True})

    qasm = (submission.get("payload") or {}).get("qasm")
    if not qasm:
        gates = (submission.get("payload") or {}).get("gates")
        num_qubits = (submission.get("payload") or {}).get("num_qubits")
        if not gates or not num_qubits:
            raise HTTPException(status_code=400, detail="This submission has no circuit to run")
        qasm = qiskit_service.circuit_to_qasm2(gates, int(num_qubits))

    # Share the existing per-user daily budget rather than opening a second tap.
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    used = await db.quantum_hw_jobs.count_documents({"user_id": uid, "created_at": {"$gte": since}})
    if used >= QBRAID_DAILY_JOB_LIMIT:
        raise HTTPException(status_code=429,
                            detail="Daily real-hardware run limit reached (%d/day)."
                                   % QBRAID_DAILY_JOB_LIMIT)

    try:
        job_qrn = qbraid_service.submit_job(ensure_measurements(qasm), body.device_id, body.shots)
    except RuntimeError as exc:  # no funded credits for that device
        raise HTTPException(status_code=402, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Hardware submission failed: %s" % exc)

    now = datetime.now(timezone.utc)
    job = await db.quantum_hw_jobs.insert_one({
        "user_id": uid, "device_id": body.device_id, "shots": body.shots, "qasm": qasm,
        "qbraid_job_qrn": job_qrn, "status": "queued", "result": None,
        "source": "qrating", "qrating_submission_id": submission["_id"],
        "created_at": now, "updated_at": now,
    })
    await db.qrating_submissions.update_one(
        {"_id": submission["_id"]}, {"$set": {"hardware_job_id": job.inserted_id}})
    return ok({"job_id": str(job.inserted_id), "status": "queued", "already_submitted": False})


@router.get("/submissions/{submission_id}/hardware", summary="Check a real-hardware run")
async def check_hardware_run(submission_id: str,
                             decoded_token: dict = Depends(get_verified_firebase_user)):
    """Polls qBraid, and on first completion marks the submission verified and
    awards the badge. Never touches the score."""
    db = _db()
    uid = decoded_token.get("uid")
    submission = await _submission_or_404(db, submission_id, uid)

    job_id = submission.get("hardware_job_id")
    if not job_id:
        raise HTTPException(status_code=404, detail="No hardware run for this submission")
    job = await db.quantum_hw_jobs.find_one({"_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Hardware job not found")

    if job["status"] not in ("completed", "failed"):
        try:
            live = qbraid_service.get_job_result(job["qbraid_job_qrn"])
            await db.quantum_hw_jobs.update_one({"_id": job_id}, {"$set": {
                "status": live["status"], "result": live["counts"], "cost": live.get("cost"),
                "error_message": live.get("error_message"),
                "updated_at": datetime.now(timezone.utc)}})
            job = {**job, "status": live["status"], "result": live["counts"]}
        except Exception as exc:
            # A failed poll is not a failed job - report the last known state.
            print("[qrating] hardware poll failed for %s: %s" % (job_id, exc), flush=True)

    newly_unlocked: List[Dict[str, Any]] = []
    if job["status"] == "completed" and not submission.get("hardware_verified"):
        await db.qrating_submissions.update_one(
            {"_id": submission["_id"]},
            {"$set": {"hardware_verified": True,
                      "hardware_verified_at": datetime.now(timezone.utc)}})
        await xp_engine.award_xp(db=db, firebase_uid=uid, source="qrating_hardware", amount=50,
                                 source_ref_id=submission["_id"],
                                 idempotent_key="qrating_hw_%s" % submission["_id"])
        newly_unlocked = await badge_engine.check_and_award_badges(db, uid)

    return ok({
        "status": job["status"],
        "device_id": job.get("device_id"),
        "counts": job.get("result"),
        "error_message": job.get("error_message"),
        "hardware_verified": job["status"] == "completed",
        "newly_unlocked_badges": newly_unlocked,
    })
