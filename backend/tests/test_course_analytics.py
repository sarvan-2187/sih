import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from bson import ObjectId
from fastapi import HTTPException

from services.course_analytics import course_timeline, daily_counts, lesson_funnel, student_summary
from routers import educator_analytics

NOW = datetime(2026, 9, 27, 12, 0)


def test_student_summary_progress_and_at_risk():
    enrolled = NOW - timedelta(days=20)
    idle = student_summary(enrolled, [NOW - timedelta(days=10)], 4, NOW)
    assert idle["progress_pct"] == 25.0 and idle["at_risk"] is True
    active = student_summary(enrolled, [NOW - timedelta(days=1)], 4, NOW)
    assert active["at_risk"] is False
    # tz-aware completion times (as written by the app) compare fine with naive `now`
    done = student_summary(enrolled, [datetime(2026, 9, 1, tzinfo=timezone.utc)] * 2, 2, NOW)
    assert done["progress_pct"] == 100.0 and done["at_risk"] is False
    assert student_summary(enrolled, [], 0, NOW)["progress_pct"] == 0.0


def test_lesson_funnel_and_daily_counts():
    funnel = lesson_funnel([{"id": "a", "title": "A"}, {"id": "b", "title": "B"}], {"a": 3, "b": 1}, 4)
    assert [f["completed_pct"] for f in funnel] == [75.0, 25.0]
    counts = daily_counts([NOW, NOW - timedelta(days=1), NOW - timedelta(days=40)], 30, NOW)
    assert len(counts) == 30 and counts["2026-09-27"] == 1 and counts["2026-09-26"] == 1 and sum(counts.values()) == 2


def test_course_timeline_marks_completion_newest_first():
    lessons = {"a": {"title": "Qubits"}, "b": {"title": "Gates"}}
    events = course_timeline(NOW - timedelta(days=5), [("a", NOW - timedelta(days=3)), ("b", NOW - timedelta(days=1))], lessons, 2)
    assert [e["type"] for e in events] == ["course_completed", "lesson_completed", "lesson_completed", "enrolled"]
    assert "Gates" in events[1]["title"]


# ---------------- access control (fake DB) ----------------

class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *a, **k):
        return self

    async def to_list(self, n=None):
        return self.docs


class _Coll:
    def __init__(self, docs):
        self.docs = docs

    def _match(self, d, q):
        return all(d.get(k) == v for k, v in q.items() if not isinstance(v, dict))

    def find(self, q, *a):
        return _Cursor([d for d in self.docs if self._match(d, q)])

    async def find_one(self, q, *a):
        return next((d for d in self.docs if self._match(d, q)), None)


class _DB:
    def __init__(self, courses=(), enrollments=()):
        self.courses = _Coll(list(courses))
        self.enrollments = _Coll(list(enrollments))
        self.modules = _Coll([])
        self.lessons = _Coll([])
        self.lesson_progress = _Coll([])
        self.users = _Coll([])


TEACHER = {"firebase_uid": "t1", "role": "educator", "verification": {"status": "approved"}}


def test_cannot_view_other_teachers_course(monkeypatch):
    cid = ObjectId()
    monkeypatch.setattr(educator_analytics, "get_db", lambda: _DB(courses=[{"_id": cid, "owner_uid": "someone-else"}]))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(educator_analytics.student_journey(str(cid), "s1", user=TEACHER))
    assert exc.value.status_code == 404


def test_cannot_view_student_not_enrolled(monkeypatch):
    cid = ObjectId()
    monkeypatch.setattr(educator_analytics, "get_db", lambda: _DB(courses=[{"_id": cid, "owner_uid": "t1"}]))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(educator_analytics.student_journey(str(cid), "stranger", user=TEACHER))
    assert exc.value.detail == "Student is not enrolled in this course"
