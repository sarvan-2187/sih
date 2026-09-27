import asyncio
import hashlib
import hmac
from datetime import datetime

import pytest
from bson import ObjectId
from fastapi import HTTPException

from auth import is_verified_staff, require_verified_staff
from services.verification_rules import (
    didit_simple_signature_ok, hash_code, is_institutional_email, missing_requirements, names_match, public_verification,
)
from routers import admin as admin_router, mentorship as mentorship_router, verification as verification_router


# ---------------- fake Mongo (dotted keys, $in, $ne) ----------------

def _get(doc, path):
    for part in path.split("."):
        doc = doc.get(part) if isinstance(doc, dict) else None
    return doc


def _matches(doc, query):
    for key, cond in query.items():
        value = _get(doc, key)
        if isinstance(cond, dict) and "$in" in cond:
            if value not in cond["$in"]:
                return False
        elif isinstance(cond, dict) and "$ne" in cond:
            if value == cond["$ne"]:
                return False
        elif value != cond:
            return False
    return True


class _Collection:
    def __init__(self, docs=None):
        self.docs = docs or []
        self.updates = []

    async def find_one(self, query):
        return next((d for d in self.docs if _matches(d, query)), None)

    async def update_one(self, query, update):
        self.updates.append((query, update))

    async def insert_one(self, doc):
        doc["_id"] = ObjectId()
        self.docs.append(doc)
        return type("R", (), {"inserted_id": doc["_id"]})()


class _DB:
    def __init__(self, users=(), mentorships=()):
        self.users = _Collection(list(users))
        self.mentorships = _Collection(list(mentorships))
        self.mentorship_messages = _Collection()


def run(coro):
    return asyncio.run(coro)


APPROVED = {"status": "approved"}
MENTOR = {"firebase_uid": "prof", "role": "educator", "verification": APPROVED, "email": "prof@uni.edu"}
MENTEE = {"firebase_uid": "res", "role": "researcher", "verification": APPROVED}


# ---------------- pure rules ----------------

def test_institutional_email_rejects_free_mail():
    assert is_institutional_email("prof@amrita.edu")
    assert is_institutional_email("a.b@cse.iitm.ac.in")
    assert not is_institutional_email("prof@gmail.com")
    assert not is_institutional_email("not-an-email")


def test_names_match():
    assert names_match("RAVI KUMAR SHARMA", "Dr. Ravi Sharma") is True
    assert names_match("Ravi Sharma", "Anita Rao") is False
    assert names_match("", "Ravi Sharma") is None


def test_missing_requirements_by_role():
    complete = {"profile": {"institution": "U", "designation": "Prof"}, "email_check": {"verified_at": datetime.utcnow()},
                "id_check": {"status": "Approved"}}
    assert missing_requirements("educator", complete) == ["orcid_or_proof"]
    assert missing_requirements("educator", {**complete, "proof_key": "k"}) == []
    assert missing_requirements("researcher", {**complete, "proof_key": "k"}) == ["orcid"]
    assert missing_requirements("researcher", {**complete, "orcid": {"orcid": "0000"}}) == []


def test_public_verification_hides_secrets():
    v = public_verification({"orcid_state": "s", "proof_key": "k", "email_check": {"email": "e", "code_hash": "h", "attempts": 2}})
    assert "orcid_state" not in v and "proof_key" not in v and v["has_proof"]
    assert v["email_check"] == {"email": "e", "verified_at": None, "code_sent": True}


def test_didit_signature():
    sig = hmac.new(b"sec", b"100:s1:Approved:status.updated", hashlib.sha256).hexdigest()
    assert didit_simple_signature_ok("sec", sig, "100", "s1", "Approved", "status.updated", now=150)
    assert not didit_simple_signature_ok("sec", sig, "100", "s1", "Declined", "status.updated", now=150)
    assert not didit_simple_signature_ok("sec", sig, "100", "s1", "Approved", "status.updated", now=1000)


# ---------------- access control ----------------

def test_unverified_educator_is_blocked():
    assert not is_verified_staff({"role": "educator", "verification": {"status": "pending"}})
    assert is_verified_staff(MENTOR) and is_verified_staff(MENTEE)
    with pytest.raises(HTTPException) as exc:
        run(require_verified_staff({"role": "educator"}))
    assert exc.value.detail == "Identity verification required"
    with pytest.raises(HTTPException):
        run(require_verified_staff({"role": "admin"}))


def test_submit_requires_all_steps(monkeypatch):
    monkeypatch.setattr(verification_router, "get_db", lambda: _DB())
    with pytest.raises(HTTPException) as exc:
        run(verification_router.submit_verification(user={"firebase_uid": "u", "role": "educator", "verification": {}}))
    assert exc.value.status_code == 400


def test_email_code_wrong_then_right(monkeypatch):
    db = _DB()
    monkeypatch.setattr(verification_router, "get_db", lambda: db)
    user = {"firebase_uid": "u", "role": "educator", "verification": {"email_check": {
        "email": "p@uni.edu", "code_hash": hash_code("u", "123456"), "attempts": 0,
        "expires_at": datetime(2999, 1, 1)}}}
    with pytest.raises(HTTPException):
        run(verification_router.confirm_email_code(verification_router.CodeIn(code="000000"), user=user))
    run(verification_router.confirm_email_code(verification_router.CodeIn(code="123456"), user=user))
    assert db.users.updates[-1][1]["$set"]["verification.email_check"]["verified_at"]


def test_admin_decides_only_pending(monkeypatch):
    db = _DB(users=[MENTOR])
    monkeypatch.setattr(admin_router, "get_db", lambda: db)
    with pytest.raises(HTTPException) as exc:
        run(admin_router.decide("prof", admin_router.DecisionIn(decision="approve"), admin={"firebase_uid": "a"}))
    assert exc.value.status_code == 409


def test_only_researchers_request_mentorship(monkeypatch):
    monkeypatch.setattr(mentorship_router, "get_db", lambda: _DB(users=[MENTOR]))
    body = mentorship_router.MentorshipRequestIn(mentor_uid="prof", topic="VQE", message="Please guide my thesis work")
    with pytest.raises(HTTPException) as exc:
        run(mentorship_router.request_mentorship(body, user=MENTOR))
    assert exc.value.status_code == 403
    assert run(mentorship_router.request_mentorship(body, user=MENTEE))["status"] == "pending"


def test_mentorship_respond_and_messaging_rules(monkeypatch):
    m = {"_id": ObjectId(), "mentor_uid": "prof", "mentee_uid": "res", "status": "pending"}
    db = _DB(users=[MENTOR, MENTEE], mentorships=[m])
    monkeypatch.setattr(mentorship_router, "get_db", lambda: db)
    mid = str(m["_id"])
    with pytest.raises(HTTPException) as exc:  # mentee cannot answer own request
        run(mentorship_router.respond(mid, mentorship_router.RespondIn(accept=True), user=MENTEE))
    assert exc.value.status_code == 403
    with pytest.raises(HTTPException) as exc:  # no chat before acceptance
        run(mentorship_router.post_message(mid, mentorship_router.MessageIn(body="hi"), user=MENTEE))
    assert exc.value.status_code == 409
    with pytest.raises(HTTPException) as exc:  # strangers are locked out
        run(mentorship_router.list_messages(mid, user={"firebase_uid": "x", "role": "researcher", "verification": APPROVED}))
    assert exc.value.status_code == 403
    m["status"] = "accepted"
    assert run(mentorship_router.post_message(mid, mentorship_router.MessageIn(body="hi"), user=MENTEE))["body"] == "hi"
