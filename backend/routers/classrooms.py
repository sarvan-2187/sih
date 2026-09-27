"""Institutional classrooms: verified faculty create a classroom, students join with a code (or an
emailed invite) and explicitly consent to faculty seeing their whole-platform learning activity.
Spec: docs/superpowers/specs/2026-09-27-student-analytics-and-classrooms-design.md (Part B)."""
import os
from datetime import datetime, timedelta
from statistics import mean
from typing import Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from auth import get_current_user, is_verified_staff, require_verified_staff, STAFF_ROLES
from database import get_db
from routers.educator_analytics import _lessons_by_course
from services.classroom_rules import (
    CONSENT_VERSION, NEVER_SHARED, SHARED_WITH_FACULTY, active_days, email_allowed, email_domain,
    generate_join_code, learning_summary, normalize_code, parse_invite_emails, platform_events, weak_topics,
)
from services.course_analytics import AT_RISK_IDLE_DAYS, utc_naive
from services.email_service import send_email

router = APIRouter(prefix="/api/classrooms", tags=["Classrooms"])
ACTIVE_MEMBER = {"removed_at": None}


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Classroom not found")


def _name(u: Optional[dict]) -> str:
    return (u or {}).get("full_name") or (u or {}).get("display_name") or "Student"


def _is_teacher(c: dict, uid: str) -> bool:
    return uid == c["owner_uid"] or uid in c.get("co_teacher_uids", [])


async def _teacher_classroom(classroom_id: str, user: dict, owner_only: bool = False) -> dict:
    c = await get_db().classrooms.find_one({"_id": _oid(classroom_id)})
    if not c or not _is_teacher(c, user["firebase_uid"]):
        raise HTTPException(status_code=404, detail="Classroom not found")
    if owner_only and c["owner_uid"] != user["firebase_uid"]:
        raise HTTPException(status_code=403, detail="Only the classroom owner can do this")
    return c


def _require_student(user: dict):
    if user.get("role") != "learner":
        raise HTTPException(status_code=403, detail="Only student accounts can join classrooms")


async def _unique_code(db) -> str:
    for _ in range(10):
        code = generate_join_code()
        if not await db.classrooms.find_one({"join_code": code}):
            return code
    raise HTTPException(status_code=500, detail="Could not generate a join code")


def _join_link(code: str) -> str:
    base = (os.getenv("FRONTEND_URL") or "http://localhost:5173").strip("'\" ").rstrip("/")
    return f"{base}/classrooms/join?code={code}"


# ---------------------------------------------------------------- teacher: manage

class ClassroomIn(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    description: str = Field(default="", max_length=500)


@router.post("")
async def create_classroom(body: ClassroomIn, user=Depends(require_verified_staff)):
    db = get_db()
    v = user.get("verification") or {}
    inst_email = (v.get("email_check") or {}).get("email") if (v.get("email_check") or {}).get("verified_at") else None
    doc = {
        "name": body.name.strip(), "description": body.description.strip(),
        "institution": (v.get("profile") or {}).get("institution") or "",
        # Joining is limited to the teacher's verified institutional email domain (none verified = open with code).
        "allowed_email_domains": [email_domain(inst_email)] if inst_email else [],
        "owner_uid": user["firebase_uid"], "co_teacher_uids": [], "join_code": await _unique_code(db),
        "status": "active", "created_at": datetime.utcnow(),
    }
    res = await db.classrooms.insert_one(doc)
    return {"id": str(res.inserted_id), "join_code": doc["join_code"]}


@router.get("")
async def list_classrooms(user=Depends(get_current_user)):
    """Teachers get classrooms they own/co-teach; students get classrooms they joined."""
    db = get_db()
    uid = user["firebase_uid"]
    if user.get("role") in STAFF_ROLES:
        if not is_verified_staff(user):
            raise HTTPException(status_code=403, detail="Identity verification required")
        items = await db.classrooms.find({"$or": [{"owner_uid": uid}, {"co_teacher_uids": uid}]}).sort("created_at", -1).to_list(200)
        counts = {c["_id"]: 0 for c in items}
        async for m in db.classroom_members.find({"classroom_id": {"$in": list(counts)}, **ACTIVE_MEMBER}, {"classroom_id": 1}):
            counts[m["classroom_id"]] += 1
        return {"as": "teacher", "classrooms": [{
            "id": str(c["_id"]), "name": c["name"], "institution": c.get("institution"), "status": c["status"],
            "join_code": c["join_code"], "members": counts[c["_id"]], "is_owner": c["owner_uid"] == uid,
        } for c in items]}
    memberships = await db.classroom_members.find({"student_uid": uid, **ACTIVE_MEMBER}).to_list(100)
    classes = {c["_id"]: c for c in await db.classrooms.find({"_id": {"$in": [m["classroom_id"] for m in memberships]}}).to_list(100)}
    owners = {u["firebase_uid"]: u for u in await db.users.find({"firebase_uid": {"$in": [c["owner_uid"] for c in classes.values()]}}).to_list(100)}
    return {"as": "student", "classrooms": [{
        "id": str(m["classroom_id"]), "name": classes[m["classroom_id"]]["name"],
        "institution": classes[m["classroom_id"]].get("institution"),
        "teacher": _name(owners.get(classes[m["classroom_id"]]["owner_uid"])), "joined_at": m["joined_at"],
    } for m in memberships if m["classroom_id"] in classes]}


@router.get("/{classroom_id}")
async def get_classroom(classroom_id: str, user=Depends(require_verified_staff)):
    db = get_db()
    c = await _teacher_classroom(classroom_id, user)
    teacher_uids = [c["owner_uid"], *c.get("co_teacher_uids", [])]
    teachers = {u["firebase_uid"]: u for u in await db.users.find({"firebase_uid": {"$in": teacher_uids}}).to_list(50)}
    invites = await db.classroom_invites.find({"classroom_id": c["_id"], "accepted_at": None}).sort("created_at", -1).to_list(500)
    return {
        "id": str(c["_id"]), "name": c["name"], "description": c.get("description", ""), "institution": c.get("institution"),
        "allowed_email_domains": c.get("allowed_email_domains", []), "status": c["status"],
        "join_code": c["join_code"], "join_link": _join_link(c["join_code"]),
        "is_owner": c["owner_uid"] == user["firebase_uid"],
        "teachers": [{"uid": t, "name": _name(teachers.get(t)), "email": (teachers.get(t) or {}).get("email"),
                      "role": "owner" if t == c["owner_uid"] else "co-teacher"} for t in teacher_uids],
        "pending_invites": [i["email"] for i in invites],
    }


class ClassroomPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=100)
    status: Optional[Literal["active", "archived"]] = None
    rotate_code: bool = False


@router.patch("/{classroom_id}")
async def update_classroom(classroom_id: str, body: ClassroomPatch, user=Depends(require_verified_staff)):
    db = get_db()
    c = await _teacher_classroom(classroom_id, user, owner_only=True)
    update = {k: v for k, v in {"name": body.name, "status": body.status}.items() if v is not None}
    if body.rotate_code:
        update["join_code"] = await _unique_code(db)
    if update:
        await db.classrooms.update_one({"_id": c["_id"]}, {"$set": update})
    return {"ok": True, **({"join_code": update["join_code"]} if "join_code" in update else {})}


class CoTeacherIn(BaseModel):
    email: str


@router.post("/{classroom_id}/co-teachers")
async def add_co_teacher(classroom_id: str, body: CoTeacherIn, user=Depends(require_verified_staff)):
    db = get_db()
    c = await _teacher_classroom(classroom_id, user, owner_only=True)
    teacher = await db.users.find_one({"email": body.email.strip().lower()})
    if not teacher or not is_verified_staff(teacher):
        raise HTTPException(status_code=404, detail="No verified educator or researcher with that email")
    if teacher["firebase_uid"] == c["owner_uid"]:
        raise HTTPException(status_code=400, detail="You already own this classroom")
    await db.classrooms.update_one({"_id": c["_id"]}, {"$addToSet": {"co_teacher_uids": teacher["firebase_uid"]}})
    return {"ok": True}


@router.delete("/{classroom_id}/co-teachers/{teacher_uid}")
async def remove_co_teacher(classroom_id: str, teacher_uid: str, user=Depends(require_verified_staff)):
    c = await _teacher_classroom(classroom_id, user, owner_only=True)
    await get_db().classrooms.update_one({"_id": c["_id"]}, {"$pull": {"co_teacher_uids": teacher_uid}})
    return {"ok": True}


class InvitesIn(BaseModel):
    emails: list[str] = Field(min_length=1, max_length=200)


@router.post("/{classroom_id}/invites")
async def invite_students(classroom_id: str, body: InvitesIn, user=Depends(require_verified_staff)):
    db = get_db()
    c = await _teacher_classroom(classroom_id, user)
    if c["status"] != "active":
        raise HTTPException(status_code=409, detail="This classroom is archived")
    accepted, rejected = parse_invite_emails(body.emails, c.get("allowed_email_domains", []))
    link = _join_link(c["join_code"])
    for email in accepted:
        try:  # unique (classroom_id, email): re-inviting just resends the email
            await db.classroom_invites.insert_one({"classroom_id": c["_id"], "email": email, "invited_by": user["firebase_uid"],
                                                   "created_at": datetime.utcnow(), "accepted_at": None})
        except DuplicateKeyError:
            pass
        try:
            await send_email(email, f"Join {c['name']} on Qrious",
                             f"{_name(user)} invited you to the classroom \"{c['name']}\" on Qrious.\n\nJoin here: {link}\n"
                             f"Or enter the code {c['join_code']} on the Classrooms page.")
        except Exception as e:
            print(f"[Classrooms] invite email failed for {email}: {e}")
    return {"invited": accepted, "rejected": rejected}


@router.delete("/{classroom_id}/members/{student_uid}")
async def remove_member(classroom_id: str, student_uid: str, user=Depends(require_verified_staff)):
    c = await _teacher_classroom(classroom_id, user)
    res = await get_db().classroom_members.update_one(
        {"classroom_id": c["_id"], "student_uid": student_uid, **ACTIVE_MEMBER},
        {"$set": {"removed_at": datetime.utcnow(), "removed_by": user["firebase_uid"]}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Student is not in this classroom")
    return {"ok": True}


# ---------------------------------------------------------------- student: join / leave

async def _classroom_by_code(code: str) -> dict:
    c = await get_db().classrooms.find_one({"join_code": normalize_code(code)})
    if not c:
        raise HTTPException(status_code=404, detail="No classroom with that code")
    return c


@router.get("/join/{code}")
async def join_preview(code: str, user=Depends(get_current_user)):
    c = await _classroom_by_code(code)
    owner = await get_db().users.find_one({"firebase_uid": c["owner_uid"]})
    member = await get_db().classroom_members.find_one({"classroom_id": c["_id"], "student_uid": user["firebase_uid"], **ACTIVE_MEMBER})
    return {
        "name": c["name"], "description": c.get("description", ""), "institution": c.get("institution"),
        "teacher": _name(owner), "status": c["status"], "already_member": bool(member),
        "is_student": user.get("role") == "learner",
        "email_allowed": email_allowed(user.get("email", ""), c.get("allowed_email_domains", [])),
        "allowed_email_domains": c.get("allowed_email_domains", []),
        "consent_version": CONSENT_VERSION, "shared": SHARED_WITH_FACULTY, "never_shared": NEVER_SHARED,
    }


class JoinIn(BaseModel):
    code: str
    consent: bool
    consent_version: str


@router.post("/join")
async def join_classroom(body: JoinIn, user=Depends(get_current_user)):
    _require_student(user)
    if not body.consent or body.consent_version != CONSENT_VERSION:
        raise HTTPException(status_code=400, detail="Please review and accept what will be shared with your faculty")
    db = get_db()
    c = await _classroom_by_code(body.code)
    if c["status"] != "active":
        raise HTTPException(status_code=409, detail="This classroom is archived and not accepting students")
    if not email_allowed(user.get("email", ""), c.get("allowed_email_domains", [])):
        raise HTTPException(status_code=403, detail=f"Join with your institution email ({', '.join('@' + d for d in c['allowed_email_domains'])})")
    now = datetime.utcnow()
    # Re-joining after leaving records fresh consent.
    await db.classroom_members.update_one(
        {"classroom_id": c["_id"], "student_uid": user["firebase_uid"]},
        {"$set": {"joined_at": now, "consent_version": CONSENT_VERSION, "consented_at": now, "removed_at": None, "removed_by": None}},
        upsert=True)
    await db.classroom_invites.update_many({"classroom_id": c["_id"], "email": (user.get("email") or "").lower(), "accepted_at": None},
                                           {"$set": {"accepted_at": now}})
    return {"ok": True, "id": str(c["_id"]), "name": c["name"]}


@router.post("/{classroom_id}/leave")
async def leave_classroom(classroom_id: str, user=Depends(get_current_user)):
    res = await get_db().classroom_members.update_one(
        {"classroom_id": _oid(classroom_id), "student_uid": user["firebase_uid"], **ACTIVE_MEMBER},
        {"$set": {"removed_at": datetime.utcnow(), "removed_by": user["firebase_uid"]}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="You are not in this classroom")
    return {"ok": True}


# ---------------------------------------------------------------- teacher: oversight

async def _topic_titles(slugs: set) -> dict:
    return {t["slug"]: t.get("title") for t in await get_db().roadmap_topics.find({"slug": {"$in": list(slugs)}}, {"slug": 1, "title": 1}).to_list(1000)}


@router.get("/{classroom_id}/analytics")
async def classroom_analytics(classroom_id: str, user=Depends(require_verified_staff)):
    db = get_db()
    c = await _teacher_classroom(classroom_id, user)
    members = await db.classroom_members.find({"classroom_id": c["_id"], **ACTIVE_MEMBER}).to_list(5000)
    uids = [m["student_uid"] for m in members]
    users = {u["firebase_uid"]: u for u in await db.users.find({"firebase_uid": {"$in": uids}}, {"firebase_uid": 1, "full_name": 1, "display_name": 1, "xp_total": 1}).to_list(len(uids) or 1)}
    streaks = {s["firebase_uid"]: s for s in await db.streaks.find({"firebase_uid": {"$in": uids}}).to_list(len(uids) or 1)}
    quizzes = await db.quiz_attempts.find({"firebase_uid": {"$in": uids}}, {"firebase_uid": 1, "topic_slug": 1, "score_pct": 1, "submitted_at": 1}).to_list(50000)
    assessments = await db.assessments.find({"firebase_uid": {"$in": uids}, "status": "completed"}, {"firebase_uid": 1, "type": 1, "score_pct": 1, "submitted_at": 1, "taken_at": 1}).to_list(20000)
    progress = await db.user_progress.find({"firebase_uid": {"$in": uids}}).to_list(50000)

    def by_uid(docs):
        grouped: dict[str, list] = {}
        for d in docs:
            grouped.setdefault(d["firebase_uid"], []).append(d)
        return grouped

    q_by, a_by, p_by = by_uid(quizzes), by_uid(assessments), by_uid(progress)
    now = datetime.utcnow()
    rows = []
    for m in members:
        uid = m["student_uid"]
        s = learning_summary((users.get(uid) or {}).get("xp_total", 0), streaks.get(uid), q_by.get(uid, []), a_by.get(uid, []), p_by.get(uid, []), now)
        rows.append({"student_uid": uid, "name": _name(users.get(uid)), "joined_at": m["joined_at"], **s})

    scores = [r["avg_quiz_score"] for r in rows if r["avg_quiz_score"] is not None]
    improvements = [r["improvement"] for r in rows if r["improvement"] is not None]
    cutoff = now - timedelta(days=AT_RISK_IDLE_DAYS)
    week = active_days([], 14, now)
    for uid in uids:
        for d in (streaks.get(uid) or {}).get("history_dates", []):
            if d in week:
                week[d] += 1
    return {
        "kpis": {
            "members": len(rows),
            "active_7d": sum(1 for r in rows if r["last_active"] and r["last_active"] >= cutoff),
            "avg_quiz_score": round(mean(scores), 1) if scores else None,
            "avg_improvement": round(mean(improvements), 1) if improvements else None,
            "topics_completed": sum(r["topics_completed"] for r in rows),
            "at_risk": sum(1 for r in rows if r["at_risk"]),
        },
        "active_students_by_day": week,
        "weak_topics": weak_topics(quizzes, await _topic_titles({q.get("topic_slug") for q in quizzes})),
        "students": sorted(rows, key=lambda r: (not r["at_risk"], r["name"])),
    }


@router.get("/{classroom_id}/students/{student_uid}/journey")
async def classroom_student_journey(classroom_id: str, student_uid: str, user=Depends(require_verified_staff)):
    db = get_db()
    c = await _teacher_classroom(classroom_id, user)
    member = await db.classroom_members.find_one({"classroom_id": c["_id"], "student_uid": student_uid, **ACTIVE_MEMBER})
    if not member:
        raise HTTPException(status_code=404, detail="Student is not in this classroom")
    await db.audit_log.insert_one({"action": "view_student_journey", "actor_uid": user["firebase_uid"], "classroom_id": c["_id"],
                                   "student_uid": student_uid, "at": datetime.utcnow()})

    student = await db.users.find_one({"firebase_uid": student_uid}) or {}
    streak = await db.streaks.find_one({"firebase_uid": student_uid})
    quizzes = await db.quiz_attempts.find({"firebase_uid": student_uid}, {"topic_slug": 1, "score_pct": 1, "submitted_at": 1}).sort("submitted_at", -1).to_list(500)
    assessments = await db.assessments.find({"firebase_uid": student_uid, "status": "completed"}, {"type": 1, "score_pct": 1, "submitted_at": 1, "taken_at": 1}).to_list(200)
    progress = await db.user_progress.find({"firebase_uid": student_uid}).to_list(1000)
    badges = await db.user_badges.find({"firebase_uid": student_uid}).to_list(500)
    topic_titles = await _topic_titles({q.get("topic_slug") for q in quizzes} | {p.get("topic_slug") for p in progress})
    badge_titles = {b["badge_id"]: b.get("title") for b in await db.badges.find({"badge_id": {"$in": [b.get("badge_id") for b in badges]}}).to_list(500)}

    # Progress in every course the student is enrolled in
    enrollments = await db.enrollments.find({"student_uid": student_uid}).to_list(200)
    courses = {x["_id"]: x for x in await db.courses.find({"_id": {"$in": [e["course_id"] for e in enrollments]}}).to_list(200)}
    lessons = await _lessons_by_course(list(courses))
    lesson_info = {l["id"]: (cid, l["title"]) for cid, ls in lessons.items() for l in ls}
    done = await db.lesson_progress.find({"student_uid": student_uid, "lesson_id": {"$in": [ObjectId(i) for i in lesson_info]}}).to_list(5000)
    done_by_course: dict[str, int] = {}
    events = platform_events(quizzes, assessments, progress, badges, topic_titles, badge_titles)
    for e in enrollments:
        if e["course_id"] in courses:
            events.append({"type": "enrolled", "at": utc_naive(e.get("enrolled_at")), "title": f"Enrolled in “{courses[e['course_id']].get('title')}”"})
    for d in done:
        cid, title = lesson_info[str(d["lesson_id"])]
        done_by_course[cid] = done_by_course.get(cid, 0) + 1
        events.append({"type": "lesson_completed", "at": utc_naive(d.get("completed_at")), "title": f"Completed “{title}”",
                       "detail": courses[ObjectId(cid)].get("title")})

    now = datetime.utcnow()
    return {
        "scope": "classroom",
        "student": {"uid": student_uid, "name": _name(student)},
        "classroom": {"id": str(c["_id"]), "name": c["name"]},
        "joined_at": member["joined_at"],
        "summary": learning_summary(student.get("xp_total", 0), streak, quizzes, assessments, progress, now),
        "courses": [{"title": courses[ObjectId(cid)].get("title"), "completed": done_by_course.get(cid, 0), "total": len(ls)}
                    for cid, ls in lessons.items()],
        "timeline": sorted((e for e in events if e["at"]), key=lambda e: e["at"], reverse=True)[:200],
        "activity_days": active_days((streak or {}).get("history_dates", []), 84, now),
    }
