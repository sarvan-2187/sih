"""Grade a set of quiz answers, persist the attempt, and fire the side effects.

Extracted from routers/quiz.py's submit handler so Qplanner's sprint quiz can
reuse it instead of re-implementing the XP / streak / badge / cache-invalidation
sequence. Two copies of that sequence is how a scoring change ends up awarding XP
twice, so both callers route through here.

routers/quiz.py owns single-topic practice attempts; routers/qplanner_router.py
owns sprint attempts that span several topics. The only difference between them
is `topic_slug`, `mode` and whatever `extra` fields the caller wants on the stored
document -- the grading and the rewards are identical.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId

from routers.analytics import invalidate_analytics_cache
from services.badge_engine import badge_engine
from services.quiz_grading_service import quiz_grading_service
from services.streak_engine import streak_engine
from services.xp_engine import xp_engine

POINTS_PER_QUESTION = 10


async def grade_and_record_attempt(
    db,
    firebase_uid: str,
    topic_slug: str,
    answers_input: List[Dict[str, Any]],
    mode: str = "practice",
    started_at: Optional[Any] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Returns the graded result plus `new_badges`; callers wrap it in their own
    response envelope. Answers whose question_id does not resolve are skipped, so
    a stale client cannot inflate a score with made-up ids."""
    question_ids = [
        ObjectId(answer["question_id"])
        for answer in answers_input
        if answer.get("question_id") and ObjectId.is_valid(answer["question_id"])
    ]
    questions = await db.quiz_questions.find({"_id": {"$in": question_ids}}).to_list(
        length=len(question_ids) or 1
    )
    questions_by_id = {str(q["_id"]): q for q in questions}

    graded_answers: List[Dict[str, Any]] = []
    total_score = 0
    max_score = 0
    total_xp_earned = 0

    for answer in answers_input:
        question_id = answer.get("question_id")
        question = questions_by_id.get(question_id)
        if not question:
            continue

        selected = answer.get("selected")
        is_correct, xp_earned, explanation = quiz_grading_service.grade_question(question, selected)

        total_score += POINTS_PER_QUESTION if is_correct else 0
        max_score += POINTS_PER_QUESTION
        total_xp_earned += int(xp_earned)

        graded_answers.append({
            "question_id": ObjectId(question_id) if ObjectId.is_valid(question_id) else question_id,
            "selected": selected,
            "correct": is_correct,
            "xp_earned": int(xp_earned),
            "explanation": explanation,
            "time_taken_s": answer.get("time_taken_s", 0),
            # carried through so analytics.py's concept_mastery_matrix keeps working
            # for sprint attempts exactly as it does for single-topic ones
            "concept": question.get("concept") or question.get("topic_slug"),
        })

    now = datetime.utcnow()
    score_pct = round((total_score / max_score) * 100) if max_score > 0 else 0

    attempt_doc = {
        "firebase_uid": firebase_uid,
        "topic_slug": topic_slug,
        "question_ids": question_ids,
        "answers": graded_answers,
        "score": total_score,
        "max_score": max_score,
        "score_pct": score_pct,
        "xp_earned": total_xp_earned,
        "started_at": started_at or now,
        "submitted_at": now,
        "mode": mode,
    }
    attempt_doc.update(extra or {})

    insert_result = await db.quiz_attempts.insert_one(attempt_doc)
    attempt_id = str(insert_result.inserted_id)

    xp_result = await xp_engine.award_xp(
        db=db,
        firebase_uid=firebase_uid,
        source="quiz",
        amount=total_xp_earned,
        source_ref_id=attempt_id,
        idempotent_key="quiz_attempt_" + attempt_id,
    )

    await streak_engine.record_daily_activity(db, firebase_uid)
    new_badges = await badge_engine.check_and_award_badges(db, firebase_uid)
    invalidate_analytics_cache(firebase_uid)

    return {
        "attempt_id": attempt_id,
        "topic_slug": topic_slug,
        "score": total_score,
        "max_score": max_score,
        "score_pct": score_pct,
        "xp_earned": total_xp_earned,
        "user_xp_total": xp_result["xp_total"],
        "user_level": xp_result["level"],
        "submitted_at": now.isoformat(),
        "new_badges": new_badges,
    }
