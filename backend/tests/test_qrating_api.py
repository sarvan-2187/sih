"""Q-Rating router tests.

Calls the endpoint functions directly with a fake database patched in, the same
approach as test_lms_security_fixes.py - no HTTP client and no Firebase needed,
so the security gates are tested rather than mocked away.
"""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from qrating_fake_db import FakeDB
from routers import qrating
from services.qrating import rounds_service as rs
from services.qrating.task_seed import ROUND_1_TASKS

GHZ = [
    {"name": "H", "target": 0},
    {"name": "CNOT", "target": 1, "control": 0},
    {"name": "CNOT", "target": 2, "control": 1},
]
TOKEN = {"uid": "u1"}
OTHER = {"uid": "u2"}


def run(coro):
    return asyncio.run(coro)


async def _setup(monkeypatch, minutes_ago=5, duration=90):
    db = FakeDB()
    monkeypatch.setattr(qrating, "get_db", lambda: db)
    monkeypatch.setattr(rs, "get_profile", rs.get_profile)  # keep the real one
    await rs.ensure_tasks_seeded(db)
    starts_at = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
    round_doc = await rs.create_round(db, 1, "Weekly Round 1", starts_at,
                                      [t["slug"] for t in ROUND_1_TASKS],
                                      duration_minutes=duration)
    await db.users.insert_one({"firebase_uid": "u1", "display_name": "Ada"})
    await db.users.insert_one({"firebase_uid": "u2", "display_name": "Grace"})
    return db, round_doc


# --- the anti-leak gate -----------------------------------------------------

def test_tasks_are_withheld_until_the_round_starts(monkeypatch):
    async def scenario():
        db, round_doc = await _setup(monkeypatch, minutes_ago=-10)  # starts in 10 min
        assert rs.round_phase(round_doc) == rs.SCHEDULED
        with pytest.raises(HTTPException) as exc:
            await qrating.get_round_tasks(str(round_doc["_id"]), TOKEN)
        assert exc.value.status_code == 403
    run(scenario())


def test_tasks_are_served_once_live_and_carry_no_answers(monkeypatch):
    async def scenario():
        db, round_doc = await _setup(monkeypatch)
        body = await qrating.get_round_tasks(str(round_doc["_id"]), TOKEN)
        tasks = body["data"]
        assert [t["label"] for t in tasks] == ["Q1", "Q2", "Q3", "Q4"]
        blob = repr(tasks)
        for secret in ("expected", "grader", "tests", "difficulty"):
            assert secret not in blob
        # Budgets must still be visible - they are part of the problem.
        hardware = next(t for t in tasks if t["pillar"] == "hardware")
        assert hardware["constraints"]["max_two_qubit_gates"] == 2
    run(scenario())


def test_a_bad_round_id_is_a_clean_error(monkeypatch):
    async def scenario():
        await _setup(monkeypatch)
        with pytest.raises(HTTPException) as exc:
            await qrating.get_round_tasks("not-an-objectid", TOKEN)
        assert exc.value.status_code == 400
    run(scenario())


# --- submitting -------------------------------------------------------------

def test_submitting_a_correct_circuit_scores_it(monkeypatch):
    async def scenario():
        db, round_doc = await _setup(monkeypatch)
        body = qrating.SubmissionIn(task_slug="ghz-three-qubit",
                                    round_id=str(round_doc["_id"]),
                                    gates=GHZ, num_qubits=3)
        out = (await qrating.create_submission(body, TOKEN))["data"]
        assert out["verdict"] == "accepted" and out["is_rated"] is True
    run(scenario())


def test_a_task_from_another_round_is_refused(monkeypatch):
    async def scenario():
        db, round_doc = await _setup(monkeypatch)
        await db.qrating_tasks.insert_one({"slug": "orphan", "pillar": "simulation",
                                          "points": 100, "grader": {}})
        body = qrating.SubmissionIn(task_slug="orphan", round_id=str(round_doc["_id"]),
                                    gates=GHZ, num_qubits=3)
        with pytest.raises(HTTPException) as exc:
            await qrating.create_submission(body, TOKEN)
        assert exc.value.status_code == 400
    run(scenario())


def test_an_empty_submission_is_refused(monkeypatch):
    async def scenario():
        db, round_doc = await _setup(monkeypatch)
        body = qrating.SubmissionIn(task_slug="ghz-three-qubit",
                                    round_id=str(round_doc["_id"]))
        with pytest.raises(HTTPException) as exc:
            await qrating.create_submission(body, TOKEN)
        assert exc.value.status_code == 400
    run(scenario())


def test_resubmitting_too_fast_returns_429(monkeypatch):
    async def scenario():
        db, round_doc = await _setup(monkeypatch)
        body = qrating.SubmissionIn(task_slug="ghz-three-qubit",
                                    round_id=str(round_doc["_id"]),
                                    gates=GHZ, num_qubits=3)
        await qrating.create_submission(body, TOKEN)
        with pytest.raises(HTTPException) as exc:
            await qrating.create_submission(body, TOKEN)
        assert exc.value.status_code == 429
    run(scenario())


def test_an_unknown_task_is_404(monkeypatch):
    async def scenario():
        await _setup(monkeypatch)
        body = qrating.SubmissionIn(task_slug="does-not-exist", gates=GHZ, num_qubits=3)
        with pytest.raises(HTTPException) as exc:
            await qrating.create_submission(body, TOKEN)
        assert exc.value.status_code == 404
    run(scenario())


# --- standings and lazy settlement ------------------------------------------

async def _played(monkeypatch):
    """A live round where u1 solved two tasks and u2 one, then the clock runs out."""
    db, round_doc = await _setup(monkeypatch)
    rs.SUBMISSION_COOLDOWN_SECONDS = 0
    try:
        for token, slug, payload in (
            (TOKEN, "ghz-three-qubit", {"gates": GHZ, "num_qubits": 3}),
            (TOKEN, "grover-iterations", {"source_code":
                "import math\ndef grover_iterations(n, m):\n"
                "    return int(math.floor((math.pi / 4) * math.sqrt((2 ** n) / m)))\n"}),
            (OTHER, "ghz-three-qubit", {"gates": GHZ, "num_qubits": 3}),
        ):
            await qrating.create_submission(
                qrating.SubmissionIn(task_slug=slug, round_id=str(round_doc["_id"]),
                                     **payload), token)
    finally:
        rs.SUBMISSION_COOLDOWN_SECONDS = 30
    return db, round_doc


def test_live_standings_name_people_and_mark_your_row(monkeypatch):
    async def scenario():
        db, round_doc = await _played(monkeypatch)
        body = await qrating.get_standings(str(round_doc["_id"]), TOKEN)
        assert body["meta"]["phase"] == rs.LIVE
        rows = body["data"]
        assert [r["display_name"] for r in rows] == ["Ada", "Grace"]
        assert rows[0]["is_you"] is True and rows[1]["is_you"] is False
        assert body["meta"]["your_row"]["rank"] == 1
        # Nothing is settled while the round is live.
        assert await db.qrating_history.count_documents({}) == 0
    run(scenario())


def test_reading_standings_after_time_settles_the_round(monkeypatch):
    async def scenario():
        db, round_doc = await _played(monkeypatch)
        # The clock runs out without any admin action.
        await db.qrating_rounds.update_one(
            {"_id": round_doc["_id"]},
            {"$set": {"ends_at": datetime.now(timezone.utc) - timedelta(minutes=1)}})

        body = await qrating.get_standings(str(round_doc["_id"]), TOKEN)
        assert body["meta"]["phase"] == rs.FINALIZED
        assert await db.qrating_history.count_documents({}) == 2
        rows = body["data"]
        assert rows[0]["rating_delta"] > rows[1]["rating_delta"]

        # Reading again must not move anything a second time.
        ratings = [(await rs.get_profile(db, uid))["rating"] for uid in ("u1", "u2")]
        await qrating.get_standings(str(round_doc["_id"]), TOKEN)
        assert [(await rs.get_profile(db, uid))["rating"] for uid in ("u1", "u2")] == ratings
        assert await db.qrating_history.count_documents({}) == 2
    run(scenario())


def test_admin_cannot_finalize_a_running_round(monkeypatch):
    async def scenario():
        db, round_doc = await _played(monkeypatch)
        with pytest.raises(HTTPException) as exc:
            await qrating.finalize(str(round_doc["_id"]), admin={"role": "admin"})
        assert exc.value.status_code == 409
    run(scenario())


# --- the number -------------------------------------------------------------

def test_me_reports_an_unrated_newcomer_honestly(monkeypatch):
    async def scenario():
        await _setup(monkeypatch)
        body = await qrating.my_rating(TOKEN)
        assert body["data"]["rating"] == 1200.0
        assert body["data"]["rounds_played"] == 0
        assert body["meta"]["unrated"] is True
        assert body["data"]["history"] == []
        assert len(body["meta"]["ladder"]) == 6
    run(scenario())


def test_me_reports_pillars_and_history_after_a_round(monkeypatch):
    async def scenario():
        db, round_doc = await _played(monkeypatch)
        await db.qrating_rounds.update_one(
            {"_id": round_doc["_id"]},
            {"$set": {"ends_at": datetime.now(timezone.utc) - timedelta(minutes=1)}})
        await qrating.get_standings(str(round_doc["_id"]), TOKEN)

        body = await qrating.my_rating(TOKEN)
        data = body["data"]
        assert body["meta"]["unrated"] is False
        assert data["rounds_played"] == 1
        assert len(data["history"]) == 1
        assert data["history"][0]["rank"] == 1
        # Solved simulation, never touched hardware.
        assert data["pillar_ratings"]["simulation"] > 1200 > data["pillar_ratings"]["hardware"]
        assert data["contest_streak"]["current"] == 1
        assert data["tier"] and data["colour"]
    run(scenario())


def test_the_leaderboard_only_lists_rated_learners(monkeypatch):
    async def scenario():
        db, round_doc = await _played(monkeypatch)
        # Someone who has never competed has a placeholder 1200, not a result.
        await rs.get_profile(db, "lurker")
        assert (await qrating.leaderboard(50, TOKEN))["data"] == []

        await db.qrating_rounds.update_one(
            {"_id": round_doc["_id"]},
            {"$set": {"ends_at": datetime.now(timezone.utc) - timedelta(minutes=1)}})
        await qrating.get_standings(str(round_doc["_id"]), TOKEN)

        rows = (await qrating.leaderboard(50, TOKEN))["data"]
        assert [r["firebase_uid"] for r in rows] == ["u1", "u2"]
        assert [r["rank"] for r in rows] == [1, 2]
        assert "lurker" not in [r["firebase_uid"] for r in rows]
        assert rows[0]["tier"]
    run(scenario())


# --- the verifiable public profile ------------------------------------------

def test_a_handle_must_be_claimed_before_the_public_page_exists(monkeypatch):
    async def scenario():
        await _setup(monkeypatch)
        with pytest.raises(HTTPException) as exc:
            await qrating.public_profile("ada")
        assert exc.value.status_code == 404

        await qrating.update_settings(qrating.ProfileSettingsIn(handle="ada"), TOKEN)
        body = await qrating.public_profile("ada")
        assert body["data"]["handle"] == "ada"
        assert body["data"]["display_name"] == "Ada"
        assert body["data"]["rating"] == 1200.0
    run(scenario())


def test_a_private_profile_is_not_publicly_readable(monkeypatch):
    async def scenario():
        await _setup(monkeypatch)
        await qrating.update_settings(qrating.ProfileSettingsIn(handle="ada"), TOKEN)
        await qrating.update_settings(qrating.ProfileSettingsIn(is_public=False), TOKEN)
        with pytest.raises(HTTPException) as exc:
            await qrating.public_profile("ada")
        assert exc.value.status_code == 404
    run(scenario())


def test_handles_are_unique(monkeypatch):
    async def scenario():
        await _setup(monkeypatch)
        await qrating.update_settings(qrating.ProfileSettingsIn(handle="ada"), TOKEN)
        with pytest.raises(HTTPException) as exc:
            await qrating.update_settings(qrating.ProfileSettingsIn(handle="ada"), OTHER)
        assert exc.value.status_code == 409
        # Re-claiming your own handle is not a conflict.
        await qrating.update_settings(qrating.ProfileSettingsIn(handle="ada"), TOKEN)
    run(scenario())


def test_handles_reject_junk():
    for bad in ("ab", "has space", "sql';--", "a" * 31):
        with pytest.raises(Exception):
            qrating.ProfileSettingsIn(handle=bad)
    assert qrating.ProfileSettingsIn(handle="ada-lovelace_42").handle == "ada-lovelace_42"


def test_the_public_page_shows_the_whole_ledger(monkeypatch):
    async def scenario():
        db, round_doc = await _played(monkeypatch)
        await db.qrating_rounds.update_one(
            {"_id": round_doc["_id"]},
            {"$set": {"ends_at": datetime.now(timezone.utc) - timedelta(minutes=1)}})
        await qrating.get_standings(str(round_doc["_id"]), TOKEN)
        await qrating.update_settings(qrating.ProfileSettingsIn(handle="ada"), TOKEN)

        data = (await qrating.public_profile("ada"))["data"]
        # This is the audit trail an institution checks: how each point was earned.
        assert len(data["ledger"]) == 1
        entry = data["ledger"][0]
        assert entry["round_number"] == 1 and entry["rank"] == 1
        assert entry["old_rating"] == 1200.0
        assert entry["new_rating"] == data["rating"]
        assert entry["delta"] == pytest.approx(data["rating"] - 1200.0, abs=0.01)
        assert entry["participants"] == 2 and entry["score"] == 800
        assert data["pillar_ratings"] and data["tier"]
    run(scenario())


def test_settings_with_nothing_to_change_is_refused(monkeypatch):
    async def scenario():
        await _setup(monkeypatch)
        with pytest.raises(HTTPException) as exc:
            await qrating.update_settings(qrating.ProfileSettingsIn(), TOKEN)
        assert exc.value.status_code == 400
    run(scenario())


# --- practice archive -------------------------------------------------------

def test_practice_never_serves_a_task_that_is_still_being_contested(monkeypatch):
    async def scenario():
        db, round_doc = await _setup(monkeypatch)
        # Round 1 is live, so all four of its tasks are off limits.
        assert (await qrating.practice_tasks(TOKEN))["data"] == []

        await db.qrating_rounds.update_one(
            {"_id": round_doc["_id"]},
            {"$set": {"ends_at": datetime.now(timezone.utc) - timedelta(minutes=1),
                      "status": rs.FINALIZED}})
        tasks = (await qrating.practice_tasks(TOKEN))["data"]
        assert len(tasks) == 4
        # The archive shows difficulty (it is useful there) but still no answers.
        assert all("difficulty" in t for t in tasks)
        assert "expected" not in repr(tasks) and "grader" not in repr(tasks)
    run(scenario())


def test_practice_hides_tasks_from_an_upcoming_round(monkeypatch):
    async def scenario():
        db, round_doc = await _setup(monkeypatch, minutes_ago=-60)  # starts in an hour
        assert rs.round_phase(round_doc) == rs.SCHEDULED
        assert (await qrating.practice_tasks(TOKEN))["data"] == []
    run(scenario())


# --- admin ------------------------------------------------------------------

def test_scheduling_a_round_rejects_unknown_tasks(monkeypatch):
    async def scenario():
        await _setup(monkeypatch)
        body = qrating.RoundIn(round_number=2, title="Round 2",
                               starts_at=datetime.now(timezone.utc) + timedelta(days=7),
                               task_slugs=["ghz-three-qubit", "nope"])
        with pytest.raises(HTTPException) as exc:
            await qrating.create_round(body, admin={"role": "admin"})
        assert exc.value.status_code == 400
        assert "nope" in exc.value.detail
    run(scenario())


def test_scheduling_a_round_sets_its_window(monkeypatch):
    async def scenario():
        await _setup(monkeypatch)
        starts_at = datetime.now(timezone.utc) + timedelta(days=7)
        body = qrating.RoundIn(round_number=2, title="Round 2", starts_at=starts_at,
                               task_slugs=["ghz-three-qubit", "grover-iterations"],
                               duration_minutes=90)
        data = (await qrating.create_round(body, admin={"role": "admin"}))["data"]
        assert data["round_number"] == 2 and data["task_count"] == 2
        assert data["phase"] == rs.SCHEDULED
        assert data["ends_at"] - data["starts_at"] == timedelta(minutes=90)
    run(scenario())


def test_the_rounds_list_surfaces_the_next_and_live_round(monkeypatch):
    async def scenario():
        await _setup(monkeypatch)  # round 1 is live
        await qrating.create_round(
            qrating.RoundIn(round_number=2, title="Round 2",
                            starts_at=datetime.now(timezone.utc) + timedelta(days=7),
                            task_slugs=["ghz-three-qubit"]), admin={"role": "admin"})
        meta = (await qrating.list_rounds(TOKEN))["meta"]
        assert meta["total"] == 2
        assert meta["live_round"]["round_number"] == 1
        assert meta["next_round"]["round_number"] == 2
    run(scenario())


def test_you_cannot_register_for_a_finished_round(monkeypatch):
    async def scenario():
        db, round_doc = await _setup(monkeypatch, minutes_ago=200, duration=90)
        with pytest.raises(HTTPException) as exc:
            await qrating.register_for_round(str(round_doc["_id"]), TOKEN)
        assert exc.value.status_code == 409
    run(scenario())


def test_registering_twice_is_harmless(monkeypatch):
    async def scenario():
        db, round_doc = await _setup(monkeypatch)
        first = await qrating.register_for_round(str(round_doc["_id"]), TOKEN)
        second = await qrating.register_for_round(str(round_doc["_id"]), TOKEN)
        assert first["data"]["newly_registered"] is True
        assert second["data"]["newly_registered"] is False
        assert await db.qrating_registrations.count_documents({}) == 1
    run(scenario())
