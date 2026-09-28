"""Optional real-hardware verification.

The contract under test: running on real silicon is a badge, never a score. It
must not be able to change a verdict, a rating, or the standings.
"""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from qrating_fake_db import FakeDB
from routers import qrating
from services.badge_engine import badge_engine
from services.qrating import rounds_service as rs
from services.qrating.task_seed import ROUND_1_TASKS

GHZ = [
    {"name": "H", "target": 0},
    {"name": "CNOT", "target": 1, "control": 0},
    {"name": "CNOT", "target": 2, "control": 1},
]
TOKEN = {"uid": "u1"}


def run(coro):
    return asyncio.run(coro)


class FakeQbraid:
    """Stands in for qbraid_service: one queued poll, then completed."""

    def __init__(self, fail_submit=None):
        self.polls = 0
        self.fail_submit = fail_submit
        self.submitted = []

    def submit_job(self, qasm, device_id, shots):
        if self.fail_submit:
            raise self.fail_submit
        self.submitted.append((qasm, device_id, shots))
        return "qrn:job:1"

    def get_job_result(self, qrn):
        self.polls += 1
        if self.polls < 2:
            return {"status": "queued", "counts": None, "cost": None, "error_message": None}
        return {"status": "completed", "counts": {"000": 4000, "111": 4100},
                "cost": 0.0, "error_message": None}


async def _accepted_submission(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr(qrating, "get_db", lambda: db)
    await rs.ensure_tasks_seeded(db)
    # main.py seeds the badge catalogue on startup; do the same here so badge
    # awards are exercised rather than silently skipped.
    await badge_engine.seed_badges(db)
    await db.users.insert_one({"firebase_uid": "u1", "display_name": "Ada"})
    round_doc = await rs.create_round(
        db, 1, "Weekly Round 1", datetime.now(timezone.utc) - timedelta(minutes=5),
        [t["slug"] for t in ROUND_1_TASKS])
    body = qrating.SubmissionIn(task_slug="ghz-on-real-silicon", round_id=str(round_doc["_id"]),
                                gates=GHZ, num_qubits=3)
    result = (await qrating.create_submission(body, TOKEN))["data"]
    assert result["verdict"] == "accepted"
    submission = await db.qrating_submissions.find_one({"firebase_uid": "u1"})
    return db, submission


def test_an_accepted_solution_can_be_sent_to_real_hardware(monkeypatch):
    async def scenario():
        db, submission = await _accepted_submission(monkeypatch)
        fake = FakeQbraid()
        monkeypatch.setattr(qrating, "qbraid_service", fake)

        started = (await qrating.run_on_hardware(
            str(submission["_id"]), qrating.HardwareRunIn(device_id="ionq:ionq:sim:simulator"),
            TOKEN))["data"]
        assert started["status"] == "queued" and started["already_submitted"] is False
        # The circuit was converted to QASM and given measurements before sending.
        qasm = fake.submitted[0][0]
        assert "OPENQASM" in qasm and "measure" in qasm

        # First poll: still queued, so no badge yet.
        pending = (await qrating.check_hardware_run(str(submission["_id"]), TOKEN))["data"]
        assert pending["status"] == "queued" and pending["hardware_verified"] is False
        assert pending["newly_unlocked_badges"] == []

        # Second poll: completed, so verified, XP paid and badge unlocked.
        done = (await qrating.check_hardware_run(str(submission["_id"]), TOKEN))["data"]
        assert done["status"] == "completed" and done["hardware_verified"] is True
        assert done["counts"] == {"000": 4000, "111": 4100}
        assert "qrating_silicon_verified" in [b["badge_id"] for b in done["newly_unlocked_badges"]]

        stored = await db.qrating_submissions.find_one({"_id": submission["_id"]})
        assert stored["hardware_verified"] is True
        # Verdict and score untouched: hardware is a badge, not points.
        assert stored["verdict"] == "accepted" and stored["score"] == 1000
    run(scenario())


def test_polling_again_does_not_pay_out_twice(monkeypatch):
    async def scenario():
        db, submission = await _accepted_submission(monkeypatch)
        monkeypatch.setattr(qrating, "qbraid_service", FakeQbraid())
        await qrating.run_on_hardware(str(submission["_id"]),
                                      qrating.HardwareRunIn(device_id="d"), TOKEN)
        for _ in range(4):
            await qrating.check_hardware_run(str(submission["_id"]), TOKEN)
        assert await db.xp_history.count_documents(
            {"firebase_uid": "u1", "source": "qrating_hardware"}) == 1
        assert await db.user_badges.count_documents(
            {"firebase_uid": "u1", "badge_id": "qrating_silicon_verified"}) == 1
    run(scenario())


def test_a_rejected_solution_cannot_be_run_on_hardware(monkeypatch):
    async def scenario():
        db, _ = await _accepted_submission(monkeypatch)
        rs.SUBMISSION_COOLDOWN_SECONDS = 0
        try:
            round_doc = await db.qrating_rounds.find_one({"round_number": 1})
            bad = qrating.SubmissionIn(task_slug="ghz-on-real-silicon",
                                       round_id=str(round_doc["_id"]),
                                       gates=[{"name": "H", "target": 0}], num_qubits=3)
            await qrating.create_submission(bad, TOKEN)
        finally:
            rs.SUBMISSION_COOLDOWN_SECONDS = 30
        rejected = await db.qrating_submissions.find_one({"verdict": {"$ne": "accepted"}})
        with pytest.raises(HTTPException) as exc:
            await qrating.run_on_hardware(str(rejected["_id"]),
                                          qrating.HardwareRunIn(device_id="d"), TOKEN)
        assert exc.value.status_code == 409
    run(scenario())


def test_you_cannot_run_someone_elses_submission(monkeypatch):
    async def scenario():
        db, submission = await _accepted_submission(monkeypatch)
        with pytest.raises(HTTPException) as exc:
            await qrating.run_on_hardware(str(submission["_id"]),
                                          qrating.HardwareRunIn(device_id="d"), {"uid": "u2"})
        assert exc.value.status_code == 403
    run(scenario())


def test_resubmitting_returns_the_existing_job(monkeypatch):
    async def scenario():
        db, submission = await _accepted_submission(monkeypatch)
        fake = FakeQbraid()
        monkeypatch.setattr(qrating, "qbraid_service", fake)
        first = (await qrating.run_on_hardware(str(submission["_id"]),
                 qrating.HardwareRunIn(device_id="d"), TOKEN))["data"]
        second = (await qrating.run_on_hardware(str(submission["_id"]),
                  qrating.HardwareRunIn(device_id="d"), TOKEN))["data"]
        assert second["already_submitted"] is True
        assert second["job_id"] == first["job_id"]
        assert len(fake.submitted) == 1  # the device is only ever charged once
    run(scenario())


def test_the_daily_hardware_budget_is_shared_with_the_rest_of_the_app(monkeypatch):
    async def scenario():
        db, submission = await _accepted_submission(monkeypatch)
        monkeypatch.setattr(qrating, "qbraid_service", FakeQbraid())
        # The learner already spent today's budget in the playground.
        for _ in range(qrating.QBRAID_DAILY_JOB_LIMIT):
            await db.quantum_hw_jobs.insert_one(
                {"user_id": "u1", "created_at": datetime.now(timezone.utc)})
        with pytest.raises(HTTPException) as exc:
            await qrating.run_on_hardware(str(submission["_id"]),
                                          qrating.HardwareRunIn(device_id="d"), TOKEN)
        assert exc.value.status_code == 429
    run(scenario())


def test_an_unfunded_device_reports_402_not_a_crash(monkeypatch):
    async def scenario():
        db, submission = await _accepted_submission(monkeypatch)
        monkeypatch.setattr(qrating, "qbraid_service",
                            FakeQbraid(fail_submit=RuntimeError("no funded credits")))
        with pytest.raises(HTTPException) as exc:
            await qrating.run_on_hardware(str(submission["_id"]),
                                          qrating.HardwareRunIn(device_id="ionq:qpu"), TOKEN)
        assert exc.value.status_code == 402
        assert "credits" in exc.value.detail
    run(scenario())


def test_checking_before_running_is_a_clean_404(monkeypatch):
    async def scenario():
        db, submission = await _accepted_submission(monkeypatch)
        with pytest.raises(HTTPException) as exc:
            await qrating.check_hardware_run(str(submission["_id"]), TOKEN)
        assert exc.value.status_code == 404
    run(scenario())
