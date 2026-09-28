import random
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Dict, Any, List, Optional
from bson import ObjectId

from database import get_db
from auth import get_verified_firebase_user
from services.quiz_attempt_service import grade_and_record_attempt

router = APIRouter(prefix="/api/v1/learning/quiz", tags=["Quiz Engine"])

def format_doc(doc: Any) -> Any:
    """Recursively converts BSON ObjectId instances to strings for clean JSON serialization."""
    if isinstance(doc, dict):
        return {k: format_doc(v) for k, v in doc.items()}
    elif isinstance(doc, list):
        return [format_doc(item) for item in doc]
    elif isinstance(doc, ObjectId):
        return str(doc)
    return doc

def strip_sensitive_answers(question: Dict[str, Any]) -> Dict[str, Any]:
    """
    CRITICAL SECURITY MANDATE: Strips correct_answer and wrong_answer_feedback
    before sending question payloads to the client on quiz start.
    """
    q_copy = format_doc(dict(question))
    q_copy.pop("correct_answer", None)
    q_copy.pop("wrong_answer_feedback", None)
    
    # Shuffle options if present
    if "options" in q_copy and isinstance(q_copy["options"], list):
        shuffled_options = list(q_copy["options"])
        random.shuffle(shuffled_options)
        q_copy["options"] = shuffled_options
        
    return q_copy

@router.get("/topics/{slug}/start", summary="Start a quiz session for a topic (returns randomized questions without correct_answer)")
async def start_quiz(
    slug: str,
    difficulty: Optional[str] = Query(None, description="easy | medium | hard"),
    count: int = Query(5, ge=1, le=20),
    decoded_token: dict = Depends(get_verified_firebase_user)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    slug_clean = slug.strip().lower()
    alt_slug = slug_clean.replace("qcomm-", "") if "qcomm-" in slug_clean else f"qcomm-{slug_clean}"
    
    query: Dict[str, Any] = {
        "$or": [
            {"topic_slug": slug_clean},
            {"tags": slug_clean},
            {"topic_slug": alt_slug},
            {"tags": alt_slug}
        ]
    }
    if difficulty:
        query["difficulty"] = difficulty.lower()
        
    cursor = db.quiz_questions.find(query)
    all_matching_questions = await cursor.to_list(length=100)
    
    if not all_matching_questions:
        # Check if topic_slug matches with prefix or exact
        cursor_prefix = db.quiz_questions.find({"topic_slug": {"$regex": f"^{slug_clean}", "$options": "i"}})
        all_matching_questions = await cursor_prefix.to_list(length=100)

    if not all_matching_questions:
        raise HTTPException(
            status_code=404, 
            detail=f"No quiz questions found strictly for topic '{slug}'."
        )
        
    # Sample randomized questions up to requested count
    sample_size = min(count, len(all_matching_questions))
    selected_questions = random.sample(all_matching_questions, sample_size)
    
    # Strip correct_answer from all questions in payload
    safe_questions = [strip_sensitive_answers(q) for q in selected_questions]
    
    return {
        "data": {
            "topic_slug": slug,
            "questions": safe_questions,
            "total_questions": len(safe_questions)
        },
        "meta": None,
        "error": None
    }

@router.post("/attempts", summary="Submit quiz attempt answers for server-side grading & XP award")
async def submit_quiz_attempt(
    payload: Dict[str, Any],
    decoded_token: dict = Depends(get_verified_firebase_user)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    firebase_uid = decoded_token.get("uid")
    topic_slug = payload.get("topic_slug", "general")
    answers_input = payload.get("answers", [])  # List of { question_id, selected, time_taken_s }
    mode = payload.get("mode", "practice")
    
    if not answers_input:
        raise HTTPException(status_code=400, detail="No answers provided in payload")
        
    # Grading, persistence, XP, streak, badges and cache invalidation all live in
    # services/quiz_attempt_service.py so Qplanner's sprint quiz runs the identical
    # path instead of a second copy that could drift or double-award XP.
    result = await grade_and_record_attempt(
        db=db,
        firebase_uid=firebase_uid,
        topic_slug=topic_slug,
        answers_input=answers_input,
        mode=mode,
        started_at=payload.get("started_at"),
    )
    new_badges = result.pop("new_badges")

    return {
        "data": result,
        "meta": {"new_badges": new_badges},
        "error": None
    }

@router.get("/attempts", summary="Get paginated quiz attempt history for authenticated user")
async def get_quiz_attempts(
    topic: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    decoded_token: dict = Depends(get_verified_firebase_user)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    firebase_uid = decoded_token.get("uid")
    query: Dict[str, Any] = {"firebase_uid": firebase_uid}
    if topic:
        query["topic_slug"] = topic
        
    total_count = await db.quiz_attempts.count_documents(query)
    skip = (page - 1) * limit
    
    cursor = db.quiz_attempts.find(query).sort("submitted_at", -1).skip(skip).limit(limit)
    attempts = await cursor.to_list(length=limit)
    
    formatted_attempts = [format_doc(a) for a in attempts]
    
    return {
        "data": formatted_attempts,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total_count
        },
        "error": None
    }

@router.get("/attempts/{attempt_id}/review", summary="Get full detailed review of a quiz attempt with correct answers")
async def review_quiz_attempt(
    attempt_id: str,
    decoded_token: dict = Depends(get_verified_firebase_user)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    if not ObjectId.is_valid(attempt_id):
        raise HTTPException(status_code=400, detail="Invalid attempt ID format")
        
    attempt = await db.quiz_attempts.find_one({"_id": ObjectId(attempt_id)})
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")
        
    firebase_uid = decoded_token.get("uid")
    if attempt.get("firebase_uid") != firebase_uid:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot access another user's attempt review")
        
    # Fetch questions
    q_ids = attempt.get("question_ids", [])
    q_query_ids = []
    for qid in q_ids:
        q_query_ids.append(qid)
        if isinstance(qid, str) and ObjectId.is_valid(qid):
            q_query_ids.append(ObjectId(qid))
        elif isinstance(qid, ObjectId):
            q_query_ids.append(str(qid))
            
    questions_cursor = db.quiz_questions.find({"_id": {"$in": q_query_ids}})
    questions_list = await questions_cursor.to_list(length=len(q_ids) * 2 + 1)
    questions_by_id = {str(q["_id"]): format_doc(q) for q in questions_list}
    
    review_items = []
    for ans in attempt.get("answers", []):
        qid = str(ans.get("question_id"))
        q_doc = questions_by_id.get(qid, {})
        
        review_items.append({
            "question_id": qid,
            "prompt": q_doc.get("prompt", ""),
            "type": q_doc.get("type", "mcq"),
            "difficulty": q_doc.get("difficulty", "easy"),
            "options": q_doc.get("options", []),
            "selected_answer": ans.get("selected"),
            "correct_answer": q_doc.get("correct_answer"),
            "is_correct": ans.get("correct", False),
            "xp_earned": ans.get("xp_earned", 0),
            "explanation": q_doc.get("explanation", ""),
            "time_taken_s": ans.get("time_taken_s", 0)
        })
        
    attempt_fmt = format_doc(dict(attempt))
    attempt_fmt["review_items"] = review_items
    
    return {
        "data": attempt_fmt,
        "meta": None,
        "error": None
    }

@router.get("/leaderboard", summary="Get topic or global quiz leaderboard")
async def get_quiz_leaderboard(
    topic: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    decoded_token: dict = Depends(get_verified_firebase_user)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    firebase_uid = decoded_token.get("uid")
    current_user_doc = await db.users.find_one({"firebase_uid": firebase_uid})
    if current_user_doc and current_user_doc.get("role") == "educator":
        return {
            "data": [],
            "meta": {"total": 0, "is_educator": True},
            "error": None
        }
        
    match_stage = {"topic_slug": topic} if topic else {}
    
    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {}},
        {
            "$group": {
                "_id": "$firebase_uid",
                "total_score": {"$sum": "$score"},
                "total_xp": {"$sum": "$xp_earned"},
                "attempts_count": {"$sum": 1},
                "avg_score_pct": {"$avg": "$score_pct"}
            }
        },
        {"$sort": {"total_xp": -1}},
        {"$limit": limit}
    ]
    
    agg_results = await db.quiz_attempts.aggregate(pipeline).to_list(length=limit)
    
    # Fetch user display names (excluding educators)
    uids = [res["_id"] for res in agg_results]
    users_cursor = db.users.find({"firebase_uid": {"$in": uids}, "role": {"$ne": "educator"}})
    users_list = await users_cursor.to_list(length=len(uids))
    users_by_uid = {u["firebase_uid"]: u for u in users_list}
    
    leaderboard = []
    rank = 1
    for res in agg_results:
        uid = res["_id"]
        u_doc = users_by_uid.get(uid)
        if not u_doc or u_doc.get("role") == "educator":
            continue
        leaderboard.append({
            "rank": rank,
            "firebase_uid": uid,
            "display_name": u_doc.get("display_name") or u_doc.get("full_name") or f"Quantum Learner #{rank}",
            "total_score": res["total_score"],
            "total_xp": res["total_xp"],
            "attempts_count": res["attempts_count"],
            "avg_score_pct": round(res["avg_score_pct"], 1)
        })
        rank += 1
        
    return {
        "data": leaderboard,
        "meta": None,
        "error": None
    }
