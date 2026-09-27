"""Course-scoped student analytics for verified educators/researchers: only activity inside the
teacher's own courses (enrollment + lesson completions). Classroom scope (whole-platform learning
activity with student consent) is planned in docs/superpowers/specs/2026-09-27-student-analytics-and-classrooms-design.md."""
from datetime import datetime, timedelta
from statistics import mean
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException

from auth import require_verified_staff
from database import get_db
from services.course_analytics import (
    AT_RISK_IDLE_DAYS, course_timeline, daily_counts, lesson_funnel, student_summary, utc_naive,
)

router = APIRouter(prefix="/api/educator/analytics", tags=["Educator Analytics"])


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Course not found")


async def _owned_courses(user: dict, course_id: Optional[str]) -> list[dict]:
    query = {"owner_uid": user["firebase_uid"]}
    if course_id:
        query["_id"] = _oid(course_id)
    courses = await get_db().courses.find(query).sort("created_at", -1).to_list(200)
    if course_id and not courses:
        raise HTTPException(status_code=404, detail="Course not found")
    return courses


async def _lessons_by_course(course_ids: list[ObjectId]) -> dict[str, list[dict]]:
    """{course_id: [{id, title, module_id, module_title}]} in module order, then lesson order."""
    db = get_db()
    modules = await db.modules.find({"course_id": {"$in": course_ids}}).sort("order", 1).to_list(1000)
    module_by_id = {m["_id"]: m for m in modules}
    lessons = await db.lessons.find({"module_id": {"$in": list(module_by_id)}}).sort("order", 1).to_list(5000)
    module_rank = {m["_id"]: i for i, m in enumerate(modules)}
    lessons.sort(key=lambda l: (module_rank.get(l["module_id"], 0), l.get("order", 0)))
    result: dict[str, list[dict]] = {str(cid): [] for cid in course_ids}
    for l in lessons:
        m = module_by_id[l["module_id"]]
        result[str(m["course_id"])].append({"id": str(l["_id"]), "title": l.get("title", "Lesson"),
                                            "module_id": str(m["_id"]), "module_title": m.get("title", "Module")})
    return result


async def _student_rows(user: dict, course_id: Optional[str]):
    """One row per (enrolled student, owned course), computed with batch queries."""
    db = get_db()
    courses = await _owned_courses(user, course_id)
    course_ids = [c["_id"] for c in courses]
    lessons = await _lessons_by_course(course_ids)
    enrollments = await db.enrollments.find({"course_id": {"$in": course_ids}}).to_list(20000)
    uids = list({e["student_uid"] for e in enrollments})
    lesson_oids = [ObjectId(l["id"]) for ls in lessons.values() for l in ls]
    progress = await db.lesson_progress.find(
        {"lesson_id": {"$in": lesson_oids}, "student_uid": {"$in": uids}}).to_list(200000)
    names = {u["firebase_uid"]: u.get("full_name") or u.get("display_name") or "Student"
             for u in await db.users.find({"firebase_uid": {"$in": uids}}, {"firebase_uid": 1, "full_name": 1, "display_name": 1}).to_list(len(uids) or 1)}

    lesson_course = {l["id"]: cid for cid, ls in lessons.items() for l in ls}
    completions: dict[tuple[str, str], list[tuple[str, datetime]]] = {}
    for p in progress:
        lid = str(p["lesson_id"])
        completions.setdefault((p["student_uid"], lesson_course[lid]), []).append((lid, p.get("completed_at")))

    now = datetime.utcnow()
    titles = {str(c["_id"]): c.get("title", "Course") for c in courses}
    rows = []
    for e in enrollments:
        cid = str(e["course_id"])
        done = completions.get((e["student_uid"], cid), [])
        rows.append({"student_uid": e["student_uid"], "name": names.get(e["student_uid"], "Student"),
                     "course_id": cid, "course_title": titles[cid], "enrolled_at": utc_naive(e.get("enrolled_at")),
                     **student_summary(e.get("enrolled_at"), [t for _, t in done], len(lessons[cid]), now)})
    return courses, lessons, rows, completions


@router.get("/overview")
async def overview(course_id: Optional[str] = None, user=Depends(require_verified_staff)):
    courses, lessons, rows, completions = await _student_rows(user, course_id)
    now = datetime.utcnow()
    active_cutoff = now - timedelta(days=AT_RISK_IDLE_DAYS)
    funnel = None
    if course_id:
        counts: dict[str, int] = {}
        for (_, cid), done in completions.items():
            for lid in {lid for lid, _ in done}:
                counts[lid] = counts.get(lid, 0) + 1
        funnel = lesson_funnel(lessons[course_id], counts, len(rows))
    return {
        "courses": [{"id": str(c["_id"]), "title": c.get("title"), "status": c.get("status"),
                     "lessons": len(lessons[str(c["_id"])])} for c in courses],
        "kpis": {
            "enrollments": len(rows),
            "students": len({r["student_uid"] for r in rows}),
            "active_7d": len({r["student_uid"] for r in rows if r["last_active"] and r["last_active"] >= active_cutoff}),
            "avg_progress_pct": round(mean(r["progress_pct"] for r in rows), 1) if rows else 0.0,
            "completed": sum(1 for r in rows if r["total"] and r["completed"] >= r["total"]),
            "at_risk": sum(1 for r in rows if r["at_risk"]),
        },
        "enrollments_by_day": daily_counts((r["enrolled_at"] for r in rows), 30, now),
        "lesson_funnel": funnel,
    }


@router.get("/students")
async def students(course_id: Optional[str] = None, user=Depends(require_verified_staff)):
    _, _, rows, _ = await _student_rows(user, course_id)
    return sorted(rows, key=lambda r: (not r["at_risk"], -(r["last_active"] or datetime.min).timestamp()))


@router.get("/courses/{course_id}/students/{student_uid}")
async def student_journey(course_id: str, student_uid: str, user=Depends(require_verified_staff)):
    db = get_db()
    course = (await _owned_courses(user, course_id))[0]
    enrollment = await db.enrollments.find_one({"course_id": course["_id"], "student_uid": student_uid})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Student is not enrolled in this course")
    lessons = (await _lessons_by_course([course["_id"]]))[course_id]
    lessons_by_id = {l["id"]: l for l in lessons}
    progress = await db.lesson_progress.find(
        {"student_uid": student_uid, "lesson_id": {"$in": [ObjectId(l["id"]) for l in lessons]}}).to_list(5000)
    done = [(str(p["lesson_id"]), p.get("completed_at")) for p in progress]
    done_ids = {lid for lid, _ in done}
    student = await db.users.find_one({"firebase_uid": student_uid}, {"full_name": 1, "display_name": 1}) or {}

    modules: dict[str, dict] = {}
    for l in lessons:
        m = modules.setdefault(l["module_id"], {"title": l["module_title"], "completed": 0, "total": 0})
        m["total"] += 1
        m["completed"] += l["id"] in done_ids

    now = datetime.utcnow()
    return {
        "scope": "course",  # classroom scope (planned) appends platform-wide learning events to `timeline`
        "student": {"uid": student_uid, "name": student.get("full_name") or student.get("display_name") or "Student"},
        "course": {"id": course_id, "title": course.get("title")},
        "enrolled_at": utc_naive(enrollment.get("enrolled_at")),
        "summary": student_summary(enrollment.get("enrolled_at"), [t for _, t in done], len(lessons), now),
        "modules": list(modules.values()),
        "timeline": course_timeline(enrollment.get("enrolled_at"), done, lessons_by_id, len(lessons)),
        "activity_days": daily_counts((t for _, t in done), 84, now),
    }
