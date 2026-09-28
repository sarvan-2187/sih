"""Q-Rating round lifecycle: the only place that writes a rating.

Mirrors the shape of services/xp_engine.py - a single writer appending to an
idempotent ledger, so replaying it cannot double-count. finalize_round() is safe
to call any number of times: the unique index on qrating_history.idempotent_key
turns every call after the first into a no-op.

All rating math lives in rating_engine (pure, tested separately); this module is
only responsible for reading state, calling that math, and persisting the result.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence

from pymongo.errors import DuplicateKeyError

from services.badge_engine import badge_engine
from services.xp_engine import xp_engine
from services.qrating import graders, rating_engine as engine
from services.qrating.task_seed import ROUND_1_TASKS, public_task
from services.qrating.tiers import crossed_tiers, get_tier

logger = logging.getLogger(__name__)

SCHEDULED = "scheduled"
LIVE = "live"
ENDED = "ended"
FINALIZED = "finalized"

# One submission per task per learner per this many seconds. Stops a script from
# brute-forcing a grader; generous enough that nobody notices while thinking.
SUBMISSION_COOLDOWN_SECONDS = 30

DEFAULT_DURATION_MINUTES = 90


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: Optional[datetime]) -> Optional[datetime]:
    """Mongo hands back naive datetimes; compare everything in UTC."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# --- seeding ----------------------------------------------------------------

async def ensure_tasks_seeded(db) -> int:
    """Upsert the seeded task bank. Idempotent, keyed on slug.

    Difficulty is only set on insert: once a round has calibrated a task against
    real solvers, that learned value must not be overwritten by the seed guess.
    """
    if db is None:
        return 0
    for task in ROUND_1_TASKS:
        body = {key: value for key, value in task.items() if key != "difficulty"}
        await db.qrating_tasks.update_one(
            {"slug": task["slug"]},
            {"$set": body, "$setOnInsert": {"difficulty": task["difficulty"]}},
            upsert=True,
        )
    return len(ROUND_1_TASKS)


# --- profiles ---------------------------------------------------------------

def _default_profile(firebase_uid: str) -> Dict[str, Any]:
    return {
        "firebase_uid": firebase_uid,
        "rating": engine.DEFAULT_RATING,
        "rd": engine.DEFAULT_RD,
        "peak_rating": engine.DEFAULT_RATING,
        "rounds_played": 0,
        "pillar_ratings": {},
        "contest_streak": {"current": 0, "longest": 0, "last_round_number": None},
        "is_public": True,
    }


async def get_profile(db, firebase_uid: str) -> Dict[str, Any]:
    """Current rating state, creating the default on first read."""
    doc = await db.qrating_profiles.find_one({"firebase_uid": firebase_uid})
    if doc is None:
        doc = _default_profile(firebase_uid)
        try:
            await db.qrating_profiles.insert_one(dict(doc))
        except DuplicateKeyError:  # concurrent first read; re-read the winner
            doc = await db.qrating_profiles.find_one({"firebase_uid": firebase_uid})
    doc.pop("_id", None)
    return {**doc, **get_tier(doc.get("rating", engine.DEFAULT_RATING))}


# --- rounds -----------------------------------------------------------------

def round_phase(round_doc: Dict[str, Any], now: Optional[datetime] = None) -> str:
    """Where a round is in its life, derived from the clock, not from a flag.

    A stored status can go stale (a worker dies, nobody calls finalize); the
    timestamps cannot. FINALIZED is the one real state transition.
    """
    if round_doc.get("status") == FINALIZED:
        return FINALIZED
    now = now or _utcnow()
    starts_at = _aware(round_doc.get("starts_at"))
    ends_at = _aware(round_doc.get("ends_at"))
    if starts_at and now < starts_at:
        return SCHEDULED
    if ends_at and now >= ends_at:
        return ENDED
    return LIVE


async def create_round(db, round_number: int, title: str, starts_at: datetime,
                       task_slugs: Sequence[str],
                       duration_minutes: int = DEFAULT_DURATION_MINUTES,
                       season_id: Optional[str] = None) -> Dict[str, Any]:
    """Schedule a round. Idempotent on round_number."""
    starts_at = _aware(starts_at)
    doc = {
        "round_number": round_number,
        "title": title,
        "starts_at": starts_at,
        "ends_at": starts_at + timedelta(minutes=duration_minutes),
        "duration_minutes": duration_minutes,
        "tasks": [{"slug": slug, "label": "Q%d" % (i + 1)}
                  for i, slug in enumerate(task_slugs)],
        "status": SCHEDULED,
        "season_id": season_id,
        "created_at": _utcnow(),
    }
    await db.qrating_rounds.update_one({"round_number": round_number},
                                       {"$set": doc}, upsert=True)
    return await db.qrating_rounds.find_one({"round_number": round_number})


async def round_tasks(db, round_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Full task documents for a round, in the round's order."""
    slugs = [entry["slug"] for entry in round_doc.get("tasks", [])]
    docs = {doc["slug"]: doc
            async for doc in db.qrating_tasks.find({"slug": {"$in": slugs}})}
    ordered = []
    for entry in round_doc.get("tasks", []):
        doc = docs.get(entry["slug"])
        if doc:
            ordered.append({**doc, "label": entry.get("label")})
    return ordered


async def public_round_tasks(db, round_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Tasks as a learner may see them: no graders, no hidden tests, no answers."""
    return [{**public_task(task), "label": task.get("label")}
            for task in await round_tasks(db, round_doc)]


async def register(db, round_doc: Dict[str, Any], firebase_uid: str) -> bool:
    """Sign up for a round. True if this call created the registration."""
    result = await db.qrating_registrations.update_one(
        {"round_id": round_doc["_id"], "firebase_uid": firebase_uid},
        {"$setOnInsert": {"round_id": round_doc["_id"], "firebase_uid": firebase_uid,
                          "registered_at": _utcnow()}},
        upsert=True,
    )
    return result.upserted_id is not None


async def is_registered(db, round_doc: Dict[str, Any], firebase_uid: str) -> bool:
    return await db.qrating_registrations.find_one(
        {"round_id": round_doc["_id"], "firebase_uid": firebase_uid}) is not None


# --- submissions ------------------------------------------------------------

async def submit(db, round_doc: Optional[Dict[str, Any]], task: Dict[str, Any],
                 firebase_uid: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Grade a submission and append it to the immutable log.

    A submission is RATED only when it lands inside a live round. Practice and
    post-round submissions are graded identically and stored identically, just
    flagged unrated - the learner gets the same feedback, the rating does not move.
    """
    now = _utcnow()
    phase = round_phase(round_doc, now) if round_doc else None
    is_rated = bool(round_doc) and phase == LIVE

    query = {"firebase_uid": firebase_uid, "task_id": task["_id"],
             "round_id": round_doc["_id"] if round_doc else None}
    last = await db.qrating_submissions.find_one(query, sort=[("submitted_at", -1)])
    if last is not None:
        age = (now - _aware(last["submitted_at"])).total_seconds()
        if age < SUBMISSION_COOLDOWN_SECONDS:
            return {"verdict": "rate_limited", "score": 0, "cooldown_seconds":
                    int(SUBMISSION_COOLDOWN_SECONDS - age),
                    "detail": "Wait %d more seconds before submitting this task again."
                              % int(SUBMISSION_COOLDOWN_SECONDS - age)}

    if is_rated:
        # Submitting is consent to compete; nobody should lose a solve because
        # they forgot to press Register.
        await register(db, round_doc, firebase_uid)

    result = graders.grade(task, payload)

    elapsed = 0
    if round_doc:
        starts_at = _aware(round_doc.get("starts_at"))
        if starts_at:
            elapsed = max(0, int((now - starts_at).total_seconds()))

    attempt_no = await db.qrating_submissions.count_documents(query) + 1
    inserted = await db.qrating_submissions.insert_one({
        "round_id": round_doc["_id"] if round_doc else None,
        "task_id": task["_id"],
        "task_slug": task["slug"],
        "firebase_uid": firebase_uid,
        "payload": payload,
        "verdict": result["verdict"],
        "score": result["score"],
        "detail": result.get("detail"),
        "elapsed_seconds": elapsed,
        "attempt_no": attempt_no,
        "is_rated": is_rated,
        "submitted_at": now,
    })

    return {**result, "is_rated": is_rated, "attempt_no": attempt_no,
            "elapsed_seconds": elapsed,
            # The id lets an accepted hardware solution be re-run on real silicon.
            "submission_id": str(inserted.inserted_id)}


async def _rated_submissions(db, round_id) -> Dict[str, List[Dict[str, Any]]]:
    """Every rated submission in a round, grouped by learner."""
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    cursor = db.qrating_submissions.find({"round_id": round_id, "is_rated": True})
    async for doc in cursor:
        grouped.setdefault(doc["firebase_uid"], []).append(doc)
    return grouped


async def live_standings(db, round_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Standings computed on the fly - used while a round is running.

    Ranks only people who actually submitted something. Registering and then not
    turning up is not a performance, so it neither scores nor costs rating.
    """
    tasks = await round_tasks(db, round_doc)
    points = {task["_id"]: task["points"] for task in tasks}
    grouped = await _rated_submissions(db, round_doc["_id"])

    rows = []
    for uid, submissions in grouped.items():
        scored = engine.score_participant(points, submissions)
        rows.append({"firebase_uid": uid, **scored})
    return engine.rank_participants(rows)


# --- finalization -----------------------------------------------------------

def _task_results(tasks: Sequence[Dict[str, Any]],
                  per_task: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Pair each task's difficulty with whether this learner solved it."""
    solved = {entry["task_id"]: entry["solved"] for entry in per_task}
    return [{"difficulty": task.get("difficulty", engine.DEFAULT_RATING),
             "solved": bool(solved.get(task["_id"])),
             "pillar": task["pillar"]}
            for task in tasks]


def _next_streak(streak: Dict[str, Any], round_number: int) -> Dict[str, Any]:
    """Consecutive-rounds-attended streak, the weekly habit hook."""
    last = (streak or {}).get("last_round_number")
    current = (streak or {}).get("current", 0)
    longest = (streak or {}).get("longest", 0)
    if last == round_number:
        return dict(streak)  # already counted; finalize ran twice
    current = current + 1 if last == round_number - 1 else 1
    return {"current": current, "longest": max(longest, current),
            "last_round_number": round_number}


async def finalize_round(db, round_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Score the round, move every participant's rating, and close it.

    Safe to call repeatedly. The per-participant ledger row carries a unique
    idempotent_key, so a second call finds the row already there and skips that
    participant entirely rather than moving their rating twice.
    """
    round_id = round_doc["_id"]
    round_number = round_doc["round_number"]
    tasks = await round_tasks(db, round_doc)
    points = {task["_id"]: task["points"] for task in tasks}

    grouped = await _rated_submissions(db, round_id)
    if not grouped:
        await db.qrating_rounds.update_one(
            {"_id": round_id}, {"$set": {"status": FINALIZED, "finalized_at": _utcnow()}})
        return {"round_number": round_number, "participants": 0, "changes": []}

    scored: Dict[str, Dict[str, Any]] = {}
    participants = []
    for uid, submissions in grouped.items():
        result = engine.score_participant(points, submissions)
        scored[uid] = result
        profile = await get_profile(db, uid)
        participants.append({
            "firebase_uid": uid,
            "rating": profile.get("rating", engine.DEFAULT_RATING),
            "rounds_played": profile.get("rounds_played", 0),
            "score": result["score"],
            "penalty_seconds": result["penalty_seconds"],
        })

    ranked = engine.rank_participants(participants)
    task_results = {row["firebase_uid"]: _task_results(tasks, scored[row["firebase_uid"]]["per_task"])
                    for row in ranked}
    updates = engine.apply_round(ranked, task_results)

    changes = []
    for row in ranked:
        uid = row["firebase_uid"]
        change = updates[uid]
        key = "qrating_round_%s_%s" % (round_number, uid)

        try:
            await db.qrating_history.insert_one({
                "firebase_uid": uid,
                "round_id": round_id,
                "round_number": round_number,
                "old_rating": change["old_rating"],
                "new_rating": change["new_rating"],
                "delta": change["delta"],
                "rank": row["rank"],
                "participants": len(ranked),
                "score": row["score"],
                "penalty_seconds": row["penalty_seconds"],
                "rd": change["rd"],
                "mode": change["mode"],
                "reason": "contest",
                "idempotent_key": key,
                "created_at": _utcnow(),
            })
        except DuplicateKeyError:
            # Already settled for this learner - leave their rating alone.
            continue

        await db.qrating_standings.update_one(
            {"round_id": round_id, "firebase_uid": uid},
            {"$set": {"round_id": round_id, "firebase_uid": uid, "rank": row["rank"],
                      "score": row["score"], "penalty_seconds": row["penalty_seconds"],
                      "per_task": scored[uid]["per_task"],
                      "rating_delta": change["delta"],
                      "new_rating": change["new_rating"],
                      "finalized_at": _utcnow()}},
            upsert=True,
        )

        profile = await get_profile(db, uid)
        pillar_ratings = dict(profile.get("pillar_ratings") or {})
        for pillar in ("simulation", "algorithmic", "hardware"):
            subset = [r for r in task_results[uid] if r["pillar"] == pillar]
            if subset:
                pillar_ratings[pillar] = engine.pillar_rating(
                    pillar_ratings.get(pillar), profile.get("rounds_played", 0), subset)

        promotions = crossed_tiers(change["old_rating"], change["new_rating"])
        await db.qrating_profiles.update_one(
            {"firebase_uid": uid},
            {"$set": {
                "rating": change["new_rating"],
                "rd": change["rd"],
                "rounds_played": change["rounds_played"],
                "peak_rating": max(profile.get("peak_rating", 0), change["new_rating"]),
                "tier": get_tier(change["new_rating"])["tier"],
                "pillar_ratings": pillar_ratings,
                "contest_streak": _next_streak(profile.get("contest_streak"), round_number),
                "updated_at": _utcnow(),
            }},
            upsert=True,
        )

        # XP and badges stay on the existing engines - one currency, one ledger.
        await xp_engine.award_xp(
            db=db, firebase_uid=uid, source="qrating_contest",
            amount=25 + row["score"] // 10, source_ref_id=round_id,
            idempotent_key=key,
        )
        try:
            await badge_engine.check_and_award_badges(db, uid)
        except Exception as exc:  # a badge must never break a settlement
            logger.warning("badge check failed for %s after round %s: %s",
                           uid, round_number, exc)

        changes.append({"firebase_uid": uid, "rank": row["rank"],
                        "promotions": promotions, **change})

    # Only calibrate when this call actually settled the round. On a repeat call
    # every ledger row already exists, so recalibrating would drift difficulties
    # a second time off a single round's evidence.
    if changes:
        await _calibrate_difficulties(db, tasks, ranked, task_results)
    await db.qrating_rounds.update_one(
        {"_id": round_id}, {"$set": {"status": FINALIZED, "finalized_at": _utcnow()}})

    return {"round_number": round_number, "participants": len(ranked), "changes": changes}


async def _calibrate_difficulties(db, tasks, ranked, task_results) -> None:
    """Move each task's difficulty toward what the field actually did with it."""
    ratings = {row["firebase_uid"]: row["rating"] for row in ranked}
    for index, task in enumerate(tasks):
        solvers, non_solvers = [], []
        for uid, results in task_results.items():
            (solvers if results[index]["solved"] else non_solvers).append(ratings[uid])
        new_difficulty = engine.calibrate_difficulty(
            task.get("difficulty", engine.DEFAULT_RATING), solvers, non_solvers)
        await db.qrating_tasks.update_one({"_id": task["_id"]},
                                          {"$set": {"difficulty": new_difficulty}})


async def finalize_if_due(db, round_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Settle a round that has ended but was never finalized.

    Lets the first person to open the standings close the round, so a missed
    admin call or a dead scheduler cannot leave ratings hanging.
    """
    if round_phase(round_doc) == ENDED:
        return await finalize_round(db, round_doc)
    return {}
