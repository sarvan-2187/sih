"""Pure calculations for course-scoped student analytics (no DB) — see
docs/superpowers/specs/2026-09-27-student-analytics-and-classrooms-design.md (Part A)."""
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

AT_RISK_IDLE_DAYS = 7
AT_RISK_MAX_PROGRESS = 50


def utc_naive(dt: Optional[datetime]) -> Optional[datetime]:
    """Mongo returns naive UTC, code writes aware UTC; compare everything as naive UTC."""
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def student_summary(enrolled_at: datetime, completion_times: list[datetime], total_lessons: int, now: datetime) -> dict:
    enrolled_at = utc_naive(enrolled_at)
    times = [utc_naive(t) for t in completion_times if t]
    completed = min(len(times), total_lessons) if total_lessons else len(times)
    progress = round(completed / total_lessons * 100, 1) if total_lessons else 0.0
    last_active = max(times) if times else enrolled_at
    idle = last_active is None or (utc_naive(now) - last_active) > timedelta(days=AT_RISK_IDLE_DAYS)
    return {
        "completed": completed, "total": total_lessons, "progress_pct": progress,
        "last_active": last_active, "at_risk": progress < AT_RISK_MAX_PROGRESS and idle,
    }


def lesson_funnel(lessons: list[dict], completions_by_lesson: dict, enrolled_count: int) -> list[dict]:
    """lessons: ordered [{id, title, module_title}]; completions_by_lesson: {lesson_id: count}."""
    return [{
        "lesson_id": l["id"], "title": l["title"], "module_title": l.get("module_title"),
        "completed": completions_by_lesson.get(l["id"], 0),
        "completed_pct": round(completions_by_lesson.get(l["id"], 0) / enrolled_count * 100, 1) if enrolled_count else 0.0,
    } for l in lessons]


def daily_counts(times: Iterable[datetime], days: int, now: datetime) -> dict[str, int]:
    today = utc_naive(now).date()
    counts = {(today - timedelta(days=i)).isoformat(): 0 for i in range(days - 1, -1, -1)}
    for t in times:
        key = utc_naive(t).date().isoformat() if t else None
        if key in counts:
            counts[key] += 1
    return counts


def course_timeline(enrolled_at: datetime, completions: list[tuple[str, datetime]], lessons_by_id: dict, total_lessons: int) -> list[dict]:
    """completions: [(lesson_id, completed_at)]; lessons_by_id: {id: {title, module_title}}. Newest first."""
    events = [{"type": "enrolled", "at": utc_naive(enrolled_at), "title": "Enrolled in the course"}]
    ordered = sorted(((lid, utc_naive(t)) for lid, t in completions if t), key=lambda x: x[1])
    for lid, at in ordered:
        lesson = lessons_by_id.get(lid, {})
        events.append({"type": "lesson_completed", "at": at, "title": f"Completed “{lesson.get('title', 'Lesson')}”",
                       "detail": lesson.get("module_title")})
    if total_lessons and len({lid for lid, _ in ordered}) >= total_lessons:
        events.append({"type": "course_completed", "at": ordered[-1][1], "title": "Finished the course"})
    # "Finished the course" shares its timestamp with the last lesson; list it first.
    return sorted(events, key=lambda e: (e["at"] or datetime.min, e["type"] == "course_completed"), reverse=True)
