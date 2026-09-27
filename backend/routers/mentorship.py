"""Mentorship: verified researchers request mentorship from verified educators (professors),
then chat in a per-mentorship message thread (frontend polls)."""
from datetime import datetime
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import require_verified_staff
from database import get_db

router = APIRouter(prefix="/api", tags=["Mentorship"])
OPEN_STATUSES = ["pending", "accepted"]


def _mentor_card(u: dict) -> dict:
    profile = (u.get("verification") or {}).get("profile") or {}
    return {
        "uid": u["firebase_uid"], "full_name": u.get("full_name") or u.get("display_name"),
        "institution": profile.get("institution"), "designation": profile.get("designation"),
        "department": profile.get("department"), "research_areas": profile.get("research_areas", []),
        "orcid": ((u.get("verification") or {}).get("orcid") or {}).get("orcid"),
    }


def _require_researcher(user: dict):
    if user.get("role") != "researcher":
        raise HTTPException(status_code=403, detail="Only researchers can request mentorship")


@router.get("/mentors")
async def list_mentors(q: str = "", user=Depends(require_verified_staff)):
    _require_researcher(user)
    mentors = await get_db().users.find({"role": "educator", "verification.status": "approved"}).to_list(500)
    cards = [_mentor_card(m) for m in mentors]
    if q.strip():
        # ponytail: in-memory filter over verified mentors; move to a Mongo text index if mentors reach thousands.
        needle = q.strip().lower()
        cards = [c for c in cards if needle in " ".join(filter(None, [
            c["full_name"], c["institution"], c["department"], c["designation"], *c["research_areas"]])).lower()]
    return cards


class MentorshipRequestIn(BaseModel):
    mentor_uid: str
    topic: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=10, max_length=1000)


@router.post("/mentorships")
async def request_mentorship(body: MentorshipRequestIn, user=Depends(require_verified_staff)):
    _require_researcher(user)
    db = get_db()
    mentor = await db.users.find_one({"firebase_uid": body.mentor_uid, "role": "educator", "verification.status": "approved"})
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    if await db.mentorships.find_one({"mentor_uid": body.mentor_uid, "mentee_uid": user["firebase_uid"], "status": {"$in": OPEN_STATUSES}}):
        raise HTTPException(status_code=409, detail="You already have an open request with this mentor")
    doc = {"mentor_uid": body.mentor_uid, "mentee_uid": user["firebase_uid"], "topic": body.topic.strip(),
           "message": body.message.strip(), "status": "pending", "response_note": None,
           "created_at": datetime.utcnow(), "responded_at": None}
    res = await db.mentorships.insert_one(doc)
    return {"id": str(res.inserted_id), "status": "pending"}


@router.get("/mentorships")
async def list_mentorships(user=Depends(require_verified_staff)):
    db = get_db()
    uid = user["firebase_uid"]
    items = await db.mentorships.find({"$or": [{"mentor_uid": uid}, {"mentee_uid": uid}]}).sort("created_at", -1).to_list(200)
    other_uids = {m["mentee_uid"] if m["mentor_uid"] == uid else m["mentor_uid"] for m in items}
    others = {u["firebase_uid"]: u for u in await db.users.find({"firebase_uid": {"$in": list(other_uids)}}).to_list(len(other_uids) or 1)}
    result = []
    for m in items:
        is_mentor = m["mentor_uid"] == uid
        other = others.get(m["mentee_uid"] if is_mentor else m["mentor_uid"], {"firebase_uid": ""})
        card = _mentor_card(other)
        if m["status"] == "accepted":
            card["email"] = other.get("email")  # contact details only after acceptance
        result.append({"id": str(m["_id"]), "as": "mentor" if is_mentor else "mentee", "counterpart": card,
                       **{k: m.get(k) for k in ("topic", "message", "status", "response_note", "created_at", "responded_at")}})
    return result


async def _load(mentorship_id: str, user: dict) -> dict:
    try:
        oid = ObjectId(mentorship_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Mentorship not found")
    m = await get_db().mentorships.find_one({"_id": oid})
    if not m:
        raise HTTPException(status_code=404, detail="Mentorship not found")
    if user["firebase_uid"] not in (m["mentor_uid"], m["mentee_uid"]):
        raise HTTPException(status_code=403, detail="Not your mentorship")
    return m


class RespondIn(BaseModel):
    accept: bool
    note: str = Field(default="", max_length=500)


@router.post("/mentorships/{mentorship_id}/respond")
async def respond(mentorship_id: str, body: RespondIn, user=Depends(require_verified_staff)):
    m = await _load(mentorship_id, user)
    if m["mentor_uid"] != user["firebase_uid"]:
        raise HTTPException(status_code=403, detail="Only the mentor can respond")
    if m["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already answered")
    status = "accepted" if body.accept else "declined"
    await get_db().mentorships.update_one({"_id": m["_id"]}, {"$set": {
        "status": status, "response_note": body.note.strip() or None, "responded_at": datetime.utcnow()}})
    return {"ok": True, "status": status}


def _require_accepted(m: dict):
    if m["status"] != "accepted":
        raise HTTPException(status_code=409, detail="Messaging opens once the mentor accepts")


@router.get("/mentorships/{mentorship_id}/messages")
async def list_messages(mentorship_id: str, after: Optional[datetime] = None, user=Depends(require_verified_staff)):
    m = await _load(mentorship_id, user)
    _require_accepted(m)
    query = {"mentorship_id": m["_id"]}
    if after:
        query["created_at"] = {"$gt": after}
    msgs = await get_db().mentorship_messages.find(query).sort("created_at", 1).to_list(500)
    return [{"id": str(x["_id"]), "sender_uid": x["sender_uid"], "body": x["body"], "created_at": x["created_at"]} for x in msgs]


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


@router.post("/mentorships/{mentorship_id}/messages")
async def post_message(mentorship_id: str, body: MessageIn, user=Depends(require_verified_staff)):
    m = await _load(mentorship_id, user)
    _require_accepted(m)
    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message is empty")
    doc = {"mentorship_id": m["_id"], "sender_uid": user["firebase_uid"], "body": text, "created_at": datetime.utcnow()}
    res = await get_db().mentorship_messages.insert_one(doc)
    return {"id": str(res.inserted_id), "sender_uid": doc["sender_uid"], "body": text, "created_at": doc["created_at"]}
