import asyncio
from datetime import datetime, timedelta

import pytest
from bson import ObjectId
from fastapi import HTTPException

from services.classroom_rules import (
    CONSENT_VERSION, email_allowed, learning_summary, normalize_code, parse_invite_emails, platform_events, weak_topics,
)
from routers import classrooms

NOW = datetime(2026, 9, 27, 12, 0)


# ---------------- pure rules ----------------

def test_email_domain_rules():
    assert email_allowed("a@amrita.edu", ["amrita.edu"])
    assert email_allowed("a@ch.students.amrita.edu", ["amrita.edu"])
    assert not email_allowed("a@notamrita.edu", ["amrita.edu"])
    assert not email_allowed("a@gmail.com", ["amrita.edu"])
    assert email_allowed("a@gmail.com", [])  # no domain configured: open with the code


def test_parse_invites_dedupes_and_rejects():
    ok, bad = parse_invite_emails(["A@amrita.edu", "a@amrita.edu", "x@gmail.com", "nope", ""], ["amrita.edu"])
    assert ok == ["a@amrita.edu"]
    assert {b["email"] for b in bad} == {"x@gmail.com", "nope"}


def test_normalize_code():
    assert normalize_code(" abcd-ef23 ") == "ABCDEF23"


def test_learning_summary_improvement_and_risk():
    quizzes = [{"score_pct": 60, "submitted_at": NOW - timedelta(days=2)}, {"score_pct": 80, "submitted_at": NOW - timedelta(days=1)}]
    assessments = [{"type": "pre", "score_pct": 40, "submitted_at": NOW - timedelta(days=9)},
                   {"type": "post", "score_pct": 75, "submitted_at": NOW - timedelta(days=1)}]
    s = learning_summary(300, {"current_streak": 3, "max_streak": 5}, quizzes, assessments, [{"status": "completed"}], NOW)
    assert s["avg_quiz_score"] == 70.0 and s["improvement"] == 35.0 and s["topics_completed"] == 1 and s["at_risk"] is False
    assert learning_summary(0, None, [], [], [], NOW)["at_risk"] is True


def test_weak_topics_and_events():
    qs = [{"topic_slug": "a", "score_pct": 40}, {"topic_slug": "a", "score_pct": 50}, {"topic_slug": "b", "score_pct": 90},
          {"topic_slug": "b", "score_pct": 80}, {"topic_slug": "c", "score_pct": 10}]
    assert [t["topic_slug"] for t in weak_topics(qs, {})] == ["a", "b"]  # "c" has only 1 attempt
    events = platform_events([{"topic_slug": "a", "score_pct": 50, "submitted_at": NOW}], [],
                             [{"topic_slug": "a", "status": "completed", "started_at": NOW, "completed_at": NOW}],
                             [{"badge_id": "first_topic", "unlocked_at": NOW}], {"a": "Qubits"}, {"first_topic": "Quantum Pioneer"})
    assert {e["type"] for e in events} == {"quiz_attempt", "topic_started", "topic_completed", "badge_earned"}
    assert any("Quantum Pioneer" in e["title"] for e in events)


# ---------------- access control (fake DB) ----------------

class _Coll:
    def __init__(self, docs=()):
        self.docs = list(docs)
        self.writes = []

    async def find_one(self, q, *a):
        return next((d for d in self.docs if all(d.get(k) == v for k, v in q.items())), None)

    async def update_one(self, q, u, upsert=False):
        self.writes.append((q, u))
        return type("R", (), {"matched_count": int(await self.find_one(q) is not None)})()

    async def update_many(self, q, u):
        self.writes.append((q, u))

    async def insert_one(self, doc):
        self.writes.append(doc)


class _DB:
    def __init__(self, classrooms_=(), members=(), users=()):
        self.classrooms = _Coll(classrooms_)
        self.classroom_members = _Coll(members)
        self.classroom_invites = _Coll()
        self.users = _Coll(users)
        self.audit_log = _Coll()


CID = ObjectId()
CLASS = {"_id": CID, "name": "CSE-A", "owner_uid": "prof", "co_teacher_uids": ["co"], "join_code": "ABCD2345",
         "status": "active", "allowed_email_domains": ["amrita.edu"]}
PROF = {"firebase_uid": "prof", "role": "educator", "verification": {"status": "approved"}}
STUDENT = {"firebase_uid": "s1", "role": "learner", "email": "s1@amrita.edu"}


def run(coro):
    return asyncio.run(coro)


def join(code="ABCD2345", consent=True, version=CONSENT_VERSION):
    return classrooms.JoinIn(code=code, consent=consent, consent_version=version)


def test_join_requires_consent_student_role_and_domain(monkeypatch):
    db = _DB(classrooms_=[CLASS])
    monkeypatch.setattr(classrooms, "get_db", lambda: db)
    with pytest.raises(HTTPException) as exc:
        run(classrooms.join_classroom(join(consent=False), user=STUDENT))
    assert exc.value.status_code == 400
    with pytest.raises(HTTPException) as exc:  # stale consent text
        run(classrooms.join_classroom(join(version="old"), user=STUDENT))
    assert exc.value.status_code == 400
    with pytest.raises(HTTPException) as exc:
        run(classrooms.join_classroom(join(), user={**STUDENT, "email": "s1@gmail.com"}))
    assert exc.value.status_code == 403
    with pytest.raises(HTTPException) as exc:
        run(classrooms.join_classroom(join(), user={**PROF, "email": "p@amrita.edu"}))
    assert exc.value.status_code == 403
    assert run(classrooms.join_classroom(join("abcd-2345"), user=STUDENT))["name"] == "CSE-A"
    member_write = next(w for w in db.classroom_members.writes if isinstance(w, tuple))
    assert member_write[1]["$set"]["consent_version"] == CONSENT_VERSION


def test_archived_classroom_rejects_joins(monkeypatch):
    monkeypatch.setattr(classrooms, "get_db", lambda: _DB(classrooms_=[{**CLASS, "status": "archived"}]))
    with pytest.raises(HTTPException) as exc:
        run(classrooms.join_classroom(join(), user=STUDENT))
    assert exc.value.status_code == 409


def test_only_teachers_see_classroom_and_only_consented_members(monkeypatch):
    db = _DB(classrooms_=[CLASS], members=[{"classroom_id": CID, "student_uid": "left", "removed_at": datetime.utcnow()}])
    monkeypatch.setattr(classrooms, "get_db", lambda: db)
    stranger = {"firebase_uid": "other-prof", "role": "educator", "verification": {"status": "approved"}}
    with pytest.raises(HTTPException) as exc:
        run(classrooms.classroom_student_journey(str(CID), "s1", user=stranger))
    assert exc.value.status_code == 404
    with pytest.raises(HTTPException) as exc:  # student who left: no more oversight
        run(classrooms.classroom_student_journey(str(CID), "left", user=PROF))
    assert exc.value.detail == "Student is not in this classroom"
    assert db.audit_log.writes == []


def test_co_teacher_cannot_do_owner_actions(monkeypatch):
    monkeypatch.setattr(classrooms, "get_db", lambda: _DB(classrooms_=[CLASS]))
    co = {"firebase_uid": "co", "role": "educator", "verification": {"status": "approved"}}
    with pytest.raises(HTTPException) as exc:
        run(classrooms.update_classroom(str(CID), classrooms.ClassroomPatch(rotate_code=True), user=co))
    assert exc.value.status_code == 403
