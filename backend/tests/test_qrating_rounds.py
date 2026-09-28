"""Q-Rating round lifecycle tests.

Uses asyncio.run rather than pytest-asyncio, matching this repo's existing
convention (see test_ai_gateway.py), with the in-memory database from
qrating_fake_db.py.
"""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from qrating_fake_db import FakeDB
from services.qrating import rounds_service as rs
from services.qrating.task_seed import ROUND_1_TASKS

GHZ = [
    {"name": "H", "target": 0},
    {"name": "CNOT", "target": 1, "control": 0},
    {"name": "CNOT", "target": 2, "control": 1},
]
GROVER_OK = ("import math\n"
             "def grover_iterations(n, m):\n"
             "    return int(math.floor((math.pi / 4) * math.sqrt((2 ** n) / m)))\n")
GROVER_BAD = "def grover_iterations(n, m):\n    return 0\n"


def run(coro):
    return asyncio.run(coro)


async def _fixture(minutes_ago=10, duration=90):
    """A live round with the seeded bank, started `minutes_ago` minutes ago."""
    db = FakeDB()
    await rs.ensure_tasks_seeded(db)
    starts_at = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
    round_doc = await rs.create_round(
        db, 1, "Weekly Round 1", starts_at,
        [t["slug"] for t in ROUND_1_TASKS], duration_minutes=duration)
    tasks = {t["slug"]: t for t in await rs.round_tasks(db, round_doc)}
    return db, round_doc, tasks


# --- seeding and phases -----------------------------------------------------

def test_seeding_is_idempotent_and_preserves_learned_difficulty():
    async def scenario():
        db = FakeDB()
        assert await rs.ensure_tasks_seeded(db) == 4
        # A round calibrated this task; re-seeding must not clobber that.
        await db.qrating_tasks.update_one({"slug": "grover-iterations"},
                                         {"$set": {"difficulty": 1502.0}})
        await rs.ensure_tasks_seeded(db)
        assert await db.qrating_tasks.count_documents({}) == 4
        doc = await db.qrating_tasks.find_one({"slug": "grover-iterations"})
        assert doc["difficulty"] == 1502.0
    run(scenario())


def test_round_phase_follows_the_clock():
    now = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)
    doc = {"starts_at": now + timedelta(minutes=5), "ends_at": now + timedelta(minutes=95)}
    assert rs.round_phase(doc, now) == rs.SCHEDULED
    doc = {"starts_at": now - timedelta(minutes=5), "ends_at": now + timedelta(minutes=85)}
    assert rs.round_phase(doc, now) == rs.LIVE
    doc = {"starts_at": now - timedelta(minutes=95), "ends_at": now - timedelta(minutes=5)}
    assert rs.round_phase(doc, now) == rs.ENDED
    # A finalized round stays finalized regardless of the clock.
    assert rs.round_phase({**doc, "status": rs.FINALIZED}, now) == rs.FINALIZED


def test_naive_timestamps_from_mongo_are_handled():
    now = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)
    naive = {"starts_at": datetime(2026, 9, 27, 11, 55), "ends_at": datetime(2026, 9, 27, 13, 25)}
    assert rs.round_phase(naive, now) == rs.LIVE


def test_new_profile_starts_at_the_default_rating():
    async def scenario():
        db = FakeDB()
        profile = await rs.get_profile(db, "newcomer")
        assert profile["rating"] == 1200.0
        assert profile["rounds_played"] == 0
        assert profile["tier"] == "Apprentice"
        # Reading twice must not create two profiles.
        await rs.get_profile(db, "newcomer")
        assert await db.qrating_profiles.count_documents({}) == 1
    run(scenario())


# --- serving tasks ----------------------------------------------------------

def test_served_tasks_are_ordered_labelled_and_stripped():
    async def scenario():
        db, round_doc, _ = await _fixture()
        served = await rs.public_round_tasks(db, round_doc)
        assert [t["label"] for t in served] == ["Q1", "Q2", "Q3", "Q4"]
        assert [t["pillar"] for t in served] == [
            "simulation", "algorithmic", "algorithmic", "hardware"]
        for task in served:
            assert "grader" not in task and "difficulty" not in task
    run(scenario())


# --- submitting -------------------------------------------------------------

def test_a_solve_inside_a_live_round_is_rated_and_logged():
    async def scenario():
        db, round_doc, tasks = await _fixture(minutes_ago=7)
        out = await rs.submit(db, round_doc, tasks["ghz-three-qubit"], "u1",
                              {"gates": GHZ, "num_qubits": 3})
        assert out["verdict"] == "accepted" and out["is_rated"] is True
        assert out["score"] == 300
        # Elapsed time is measured from the round start, not from the request.
        assert 6 * 60 <= out["elapsed_seconds"] <= 8 * 60
        assert await db.qrating_submissions.count_documents({"is_rated": True}) == 1
        # Submitting counts as entering, so a forgotten Register cannot cost a solve.
        assert await rs.is_registered(db, round_doc, "u1")
    run(scenario())


def test_practice_outside_a_round_is_graded_but_unrated():
    async def scenario():
        db, _, tasks = await _fixture()
        out = await rs.submit(db, None, tasks["ghz-three-qubit"], "u1",
                              {"gates": GHZ, "num_qubits": 3})
        assert out["verdict"] == "accepted" and out["is_rated"] is False
    run(scenario())


def test_a_submission_after_the_round_ends_is_unrated():
    async def scenario():
        db, round_doc, tasks = await _fixture(minutes_ago=200, duration=90)
        assert rs.round_phase(round_doc) == rs.ENDED
        out = await rs.submit(db, round_doc, tasks["ghz-three-qubit"], "u1",
                              {"gates": GHZ, "num_qubits": 3})
        assert out["verdict"] == "accepted" and out["is_rated"] is False
    run(scenario())


def test_rapid_resubmission_is_refused():
    async def scenario():
        db, round_doc, tasks = await _fixture()
        first = await rs.submit(db, round_doc, tasks["grover-iterations"], "u1",
                                {"source_code": GROVER_BAD})
        assert first["verdict"] == "wrong_answer"
        second = await rs.submit(db, round_doc, tasks["grover-iterations"], "u1",
                                 {"source_code": GROVER_OK})
        assert second["verdict"] == "rate_limited"
        assert second["cooldown_seconds"] > 0
        # The refused attempt is not recorded, so it costs no penalty.
        assert await db.qrating_submissions.count_documents({}) == 1
        # A different task is unaffected.
        other = await rs.submit(db, round_doc, tasks["ghz-three-qubit"], "u1",
                                {"gates": GHZ, "num_qubits": 3})
        assert other["verdict"] == "accepted"
    run(scenario())


def test_attempt_numbers_increment_per_task():
    async def scenario():
        db, round_doc, tasks = await _fixture()
        a = await rs.submit(db, round_doc, tasks["grover-iterations"], "u1",
                            {"source_code": GROVER_BAD})
        rs.SUBMISSION_COOLDOWN_SECONDS = 0  # cooldown is not what is under test
        try:
            b = await rs.submit(db, round_doc, tasks["grover-iterations"], "u1",
                                {"source_code": GROVER_OK})
        finally:
            rs.SUBMISSION_COOLDOWN_SECONDS = 30
        assert (a["attempt_no"], b["attempt_no"]) == (1, 2)
    run(scenario())


# --- standings --------------------------------------------------------------

def test_live_standings_rank_by_score_then_penalty():
    async def scenario():
        db, round_doc, tasks = await _fixture()
        rs.SUBMISSION_COOLDOWN_SECONDS = 0
        try:
            # u1 solves Q1 and Q2; u2 only Q1; u3 registers but never submits.
            await rs.submit(db, round_doc, tasks["ghz-three-qubit"], "u1",
                            {"gates": GHZ, "num_qubits": 3})
            await rs.submit(db, round_doc, tasks["grover-iterations"], "u1",
                            {"source_code": GROVER_OK})
            await rs.submit(db, round_doc, tasks["ghz-three-qubit"], "u2",
                            {"gates": GHZ, "num_qubits": 3})
            await rs.register(db, round_doc, "u3")
        finally:
            rs.SUBMISSION_COOLDOWN_SECONDS = 30

        standings = await rs.live_standings(db, round_doc)
        assert [row["firebase_uid"] for row in standings] == ["u1", "u2"]
        assert [row["rank"] for row in standings] == [1, 2]
        assert standings[0]["score"] == 800 and standings[1]["score"] == 300
        # Registering without submitting is not a performance.
        assert "u3" not in [row["firebase_uid"] for row in standings]
    run(scenario())


# --- finalization -----------------------------------------------------------

async def _played_round(minutes_ago=100, duration=90):
    """A finished round: u1 solved two tasks, u2 one, u3 nothing but attended."""
    db, round_doc, tasks = await _fixture(minutes_ago=minutes_ago, duration=duration)
    rs.SUBMISSION_COOLDOWN_SECONDS = 0
    try:
        live = {**round_doc, "status": "live",
                "starts_at": datetime.now(timezone.utc) - timedelta(minutes=5),
                "ends_at": datetime.now(timezone.utc) + timedelta(minutes=85)}
        await rs.submit(db, live, tasks["ghz-three-qubit"], "u1", {"gates": GHZ, "num_qubits": 3})
        await rs.submit(db, live, tasks["grover-iterations"], "u1", {"source_code": GROVER_OK})
        await rs.submit(db, live, tasks["ghz-three-qubit"], "u2", {"gates": GHZ, "num_qubits": 3})
        await rs.submit(db, live, tasks["grover-iterations"], "u3", {"source_code": GROVER_BAD})
    finally:
        rs.SUBMISSION_COOLDOWN_SECONDS = 30
    return db, round_doc, tasks


def test_finalizing_moves_ratings_and_writes_one_ledger_row_each():
    async def scenario():
        db, round_doc, _ = await _played_round()
        summary = await rs.finalize_round(db, round_doc)
        assert summary["participants"] == 3
        assert await db.qrating_history.count_documents({}) == 3

        # Small field -> the difficulty path, and the winner gains on the loser.
        assert {c["mode"] for c in summary["changes"]} == {"difficulty"}
        by_uid = {c["firebase_uid"]: c for c in summary["changes"]}
        assert by_uid["u1"]["delta"] > by_uid["u2"]["delta"] > by_uid["u3"]["delta"]
        assert by_uid["u1"]["rank"] == 1 and by_uid["u3"]["rank"] == 3

        profile = await rs.get_profile(db, "u1")
        assert profile["rating"] == by_uid["u1"]["new_rating"]
        assert profile["rounds_played"] == 1
        assert profile["peak_rating"] == profile["rating"]
        # Solving the simulation task but not the hardware one shows up per pillar.
        assert profile["pillar_ratings"]["simulation"] > 1200
        assert profile["pillar_ratings"]["hardware"] < 1200
    run(scenario())


def test_finalizing_twice_changes_nothing_the_second_time():
    async def scenario():
        db, round_doc, _ = await _played_round()
        first = await rs.finalize_round(db, round_doc)
        ratings_after_first = {uid: (await rs.get_profile(db, uid))["rating"]
                               for uid in ("u1", "u2", "u3")}

        second = await rs.finalize_round(db, round_doc)

        assert second["changes"] == []
        assert await db.qrating_history.count_documents({}) == 3
        for uid, rating in ratings_after_first.items():
            profile = await rs.get_profile(db, uid)
            assert profile["rating"] == rating
            assert profile["rounds_played"] == 1
        assert first["participants"] == 3
    run(scenario())


def test_finalizing_writes_standings_with_per_task_detail():
    async def scenario():
        db, round_doc, _ = await _played_round()
        await rs.finalize_round(db, round_doc)
        row = await db.qrating_standings.find_one({"round_id": round_doc["_id"],
                                                   "firebase_uid": "u1"})
        assert row["rank"] == 1 and row["score"] == 800
        assert sum(1 for entry in row["per_task"] if entry["solved"]) == 2
        assert row["rating_delta"] != 0
    run(scenario())


def test_finalizing_awards_xp_through_the_existing_engine():
    async def scenario():
        db, round_doc, _ = await _played_round()
        await rs.finalize_round(db, round_doc)
        entries = await db.xp_history.find({"firebase_uid": "u1"}).to_list(None)
        assert len(entries) == 1
        assert entries[0]["source"] == "qrating_contest"
        assert entries[0]["amount"] == 25 + 800 // 10
        # And a second finalize must not pay out again.
        await rs.finalize_round(db, round_doc)
        assert await db.xp_history.count_documents({"firebase_uid": "u1"}) == 1
    run(scenario())


def test_task_difficulty_is_calibrated_against_the_field():
    async def scenario():
        db, round_doc, tasks = await _played_round()
        before = {slug: task["difficulty"] for slug, task in tasks.items()}
        await rs.finalize_round(db, round_doc)
        # Nobody solved the hardware task, so it proved harder than its guess.
        after = await db.qrating_tasks.find_one({"slug": "ghz-on-real-silicon"})
        assert after["difficulty"] > before["ghz-on-real-silicon"]
        # Two of three solved the easy simulation task, so it drifts down.
        easy = await db.qrating_tasks.find_one({"slug": "ghz-three-qubit"})
        assert easy["difficulty"] < before["ghz-three-qubit"]
    run(scenario())


def test_an_empty_round_finalizes_cleanly():
    async def scenario():
        db, round_doc, _ = await _fixture(minutes_ago=200)
        summary = await rs.finalize_round(db, round_doc)
        assert summary["participants"] == 0 and summary["changes"] == []
        stored = await db.qrating_rounds.find_one({"_id": round_doc["_id"]})
        assert stored["status"] == rs.FINALIZED
    run(scenario())


def test_finalize_if_due_only_settles_an_ended_round():
    async def scenario():
        db, live_round, _ = await _fixture(minutes_ago=5, duration=90)
        assert await rs.finalize_if_due(db, live_round) == {}
        stored = await db.qrating_rounds.find_one({"_id": live_round["_id"]})
        assert stored["status"] != rs.FINALIZED

        db2, ended_round, _ = await _played_round()
        summary = await rs.finalize_if_due(db2, ended_round)
        assert summary["participants"] == 3
    run(scenario())


def test_contest_streak_counts_consecutive_rounds():
    assert rs._next_streak(None, 1) == {"current": 1, "longest": 1, "last_round_number": 1}
    carried = rs._next_streak({"current": 3, "longest": 5, "last_round_number": 7}, 8)
    assert carried == {"current": 4, "longest": 5, "last_round_number": 8}
    # A skipped week resets the run but keeps the record.
    broken = rs._next_streak({"current": 4, "longest": 5, "last_round_number": 7}, 9)
    assert broken == {"current": 1, "longest": 5, "last_round_number": 9}
    # Finalizing the same round twice must not inflate the streak.
    same = {"current": 4, "longest": 5, "last_round_number": 8}
    assert rs._next_streak(same, 8) == same


def test_refinalizing_does_not_drift_task_difficulty_again():
    async def scenario():
        db, round_doc, _ = await _played_round()
        await rs.finalize_round(db, round_doc)
        once = {doc["slug"]: doc["difficulty"]
                async for doc in db.qrating_tasks.find({})}
        await rs.finalize_round(db, round_doc)
        twice = {doc["slug"]: doc["difficulty"]
                 async for doc in db.qrating_tasks.find({})}
        assert once == twice
    run(scenario())


def test_finalizing_unlocks_the_contest_badges():
    async def scenario():
        from services.badge_engine import badge_engine
        db, round_doc, _ = await _played_round()
        await badge_engine.seed_badges(db)  # main.py does this at startup

        await rs.finalize_round(db, round_doc)

        winner = {doc["badge_id"] async for doc in db.user_badges.find({"firebase_uid": "u1"})}
        assert "qrating_first_round" in winner
        assert "qrating_round_winner" in winner
        assert "qrating_podium" in winner

        # Third place gets the participation badge but not the winner's.
        third = {doc["badge_id"] async for doc in db.user_badges.find({"firebase_uid": "u3"})}
        assert "qrating_first_round" in third
        assert "qrating_round_winner" not in third
        # Only three people competed, so third place is still a podium.
        assert "qrating_podium" in third

        # Nobody reached 1400, so no tier badge yet.
        assert "qrating_tier_entangler" not in winner
    run(scenario())


def test_tier_badges_follow_peak_rating_not_current_rating():
    async def scenario():
        from services.badge_engine import badge_engine
        db = FakeDB()
        await badge_engine.seed_badges(db)
        # Someone who once reached Expert but has since dropped back keeps the badge.
        await db.qrating_profiles.insert_one({
            "firebase_uid": "u1", "rating": 1301, "peak_rating": 1655,
            "rounds_played": 8, "contest_streak": {"current": 2}})
        unlocked = {b["badge_id"] for b in await badge_engine.check_and_award_badges(db, "u1")}
        assert "qrating_tier_expert" in unlocked
        assert "qrating_tier_entangler" in unlocked
        assert "qrating_tier_master" not in unlocked
        assert "qrating_rounds_5" in unlocked
        assert "qrating_rounds_25" not in unlocked
    run(scenario())


def test_submitting_returns_an_id_the_hardware_run_can_use():
    async def scenario():
        db, round_doc, tasks = await _fixture()
        out = await rs.submit(db, round_doc, tasks["ghz-on-real-silicon"], "u1",
                              {"gates": GHZ, "num_qubits": 3})
        assert out["verdict"] == "accepted"
        from bson import ObjectId
        assert ObjectId.is_valid(out["submission_id"])
        stored = await db.qrating_submissions.find_one({"_id": ObjectId(out["submission_id"])})
        assert stored is not None and stored["task_slug"] == "ghz-on-real-silicon"
    run(scenario())
