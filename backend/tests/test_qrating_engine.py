"""Q-Rating engine tests. Pure functions, no DB - same style as test_course_analytics.py."""

import pytest

from services.qrating import rating_engine as e
from services.qrating.tiers import crossed_tiers, get_tier, ladder


# --- Elo primitives ---------------------------------------------------------

def test_expected_win_is_symmetric_and_monotonic():
    assert e.expected_win(1200, 1200) == pytest.approx(0.5)
    assert e.expected_win(1600, 1200) + e.expected_win(1200, 1600) == pytest.approx(1.0)
    # A 400-point edge is the classic 10:1 odds.
    assert e.expected_win(1600, 1200) == pytest.approx(10 / 11)


def test_seed_and_inverse_round_trip():
    others = [1000.0, 1200.0, 1400.0, 1800.0]
    # Middle of an even field expects the middle place.
    assert e.seed(1200, [1200] * 4) == pytest.approx(3.0)
    for rating in (900.0, 1200.0, 1750.0, 2400.0):
        target = e.seed(rating, others)
        assert e.rating_for_seed(target, others) == pytest.approx(rating, abs=0.5)


def test_stronger_rating_expects_a_better_place():
    others = [1200.0] * 9
    assert e.seed(1800, others) < e.seed(1200, others) < e.seed(800, others)


def test_rd_shrinks_with_experience_and_floors():
    assert e.shrink_rd(0) == pytest.approx(e.DEFAULT_RD)
    assert e.shrink_rd(5) < e.shrink_rd(1) < e.shrink_rd(0)
    assert e.shrink_rd(10000) == e.MIN_RD


# --- Scoring and ranking ----------------------------------------------------

POINTS = {"q1": 300, "q2": 500, "q3": 800, "q4": 1000}


def test_score_counts_first_accept_and_penalises_earlier_wrongs():
    result = e.score_participant(POINTS, [
        {"task_id": "q1", "verdict": "accepted", "elapsed_seconds": 420},
        {"task_id": "q2", "verdict": "wrong_answer", "elapsed_seconds": 900},
        {"task_id": "q2", "verdict": "accepted", "elapsed_seconds": 1440},
    ])
    assert result["score"] == 800
    assert result["penalty_seconds"] == 420 + 1440 + 300


def test_wrong_attempts_on_an_unsolved_task_are_free():
    result = e.score_participant(POINTS, [
        {"task_id": "q4", "verdict": "wrong_answer", "elapsed_seconds": 100},
        {"task_id": "q4", "verdict": "timeout", "elapsed_seconds": 200},
    ])
    assert result["score"] == 0 and result["penalty_seconds"] == 0


def test_submissions_after_a_solve_do_not_change_anything():
    result = e.score_participant(POINTS, [
        {"task_id": "q1", "verdict": "accepted", "elapsed_seconds": 60},
        {"task_id": "q1", "verdict": "wrong_answer", "elapsed_seconds": 90},
    ])
    assert result["score"] == 300 and result["penalty_seconds"] == 60


def test_score_is_order_independent():
    subs = [
        {"task_id": "q2", "verdict": "accepted", "elapsed_seconds": 1440},
        {"task_id": "q2", "verdict": "wrong_answer", "elapsed_seconds": 900},
    ]
    assert e.score_participant(POINTS, subs) == e.score_participant(POINTS, list(reversed(subs)))


def test_ranking_uses_score_then_penalty_and_shares_ties():
    ranked = e.rank_participants([
        {"firebase_uid": "slow", "score": 800, "penalty_seconds": 3000},
        {"firebase_uid": "fast", "score": 800, "penalty_seconds": 1000},
        {"firebase_uid": "top", "score": 1300, "penalty_seconds": 5000},
        {"firebase_uid": "tie_a", "score": 300, "penalty_seconds": 100},
        {"firebase_uid": "tie_b", "score": 300, "penalty_seconds": 100},
    ])
    by_uid = {p["firebase_uid"]: p["rank"] for p in ranked}
    assert by_uid == {"top": 1, "fast": 2, "slow": 3, "tie_a": 4, "tie_b": 4}


# --- Peer-relative rating ---------------------------------------------------

def _equal_field(n, rating=1200.0, rounds_played=10):
    return [
        {"firebase_uid": "u%d" % i, "rating": rating,
         "rounds_played": rounds_played, "rank": i + 1}
        for i in range(n)
    ]


def test_beating_your_seed_gains_and_missing_it_loses():
    deltas = e.peer_deltas(_equal_field(10))
    # In an all-equal field the expected place is 5.5, so 1st gains and last loses.
    assert deltas["u0"] > 0
    assert deltas["u9"] < 0
    # Monotonic in rank: finishing higher is never worth less.
    ordered = [deltas["u%d" % i] for i in range(10)]
    assert ordered == sorted(ordered, reverse=True)


def test_peer_deltas_are_zero_sum():
    ranked = [
        {"firebase_uid": "a", "rating": 1500.0, "rounds_played": 10, "rank": 1},
        {"firebase_uid": "b", "rating": 1200.0, "rounds_played": 10, "rank": 2},
        {"firebase_uid": "c", "rating": 1900.0, "rounds_played": 10, "rank": 3},
        {"firebase_uid": "d", "rating": 1000.0, "rounds_played": 2, "rank": 4},
    ]
    assert sum(e.peer_deltas(ranked).values()) == pytest.approx(0.0, abs=1e-6)


def test_a_favourite_who_wins_gains_less_than_an_underdog_who_wins():
    favourite = e.peer_deltas([
        {"firebase_uid": "star", "rating": 2000.0, "rounds_played": 10, "rank": 1},
        {"firebase_uid": "b", "rating": 1200.0, "rounds_played": 10, "rank": 2},
        {"firebase_uid": "c", "rating": 1200.0, "rounds_played": 10, "rank": 3},
    ])["star"]
    underdog = e.peer_deltas([
        {"firebase_uid": "star", "rating": 1000.0, "rounds_played": 10, "rank": 1},
        {"firebase_uid": "b", "rating": 1800.0, "rounds_played": 10, "rank": 2},
        {"firebase_uid": "c", "rating": 1800.0, "rounds_played": 10, "rank": 3},
    ])["star"]
    assert underdog > favourite


def test_new_accounts_move_faster_than_veterans():
    rookie = e.peer_deltas(_equal_field(10, rounds_played=0))["u0"]
    veteran = e.peer_deltas(_equal_field(10, rounds_played=50))["u0"]
    assert rookie > veteran


# --- Task-difficulty rating -------------------------------------------------

def test_solving_above_your_level_gains_more_than_solving_below_it():
    hard = e.difficulty_delta(1200, 10, [{"difficulty": 1600, "solved": True}])
    easy = e.difficulty_delta(1200, 10, [{"difficulty": 800, "solved": True}])
    assert hard > easy > 0


def test_failing_below_your_level_hurts_more_than_failing_above_it():
    missed_easy = e.difficulty_delta(1600, 10, [{"difficulty": 1000, "solved": False}])
    missed_hard = e.difficulty_delta(1600, 10, [{"difficulty": 2200, "solved": False}])
    assert missed_easy < missed_hard < 0


def test_solving_exactly_at_your_level_is_worth_half_the_k_factor():
    assert e.difficulty_delta(1500, 10, [{"difficulty": 1500, "solved": True}]) == pytest.approx(10.0)


def test_delta_is_capped():
    tasks = [{"difficulty": 3000, "solved": True}] * 100
    assert e.difficulty_delta(500, 0, tasks) == e.MAX_DELTA


# --- Whole-round application ------------------------------------------------

def test_small_field_uses_the_difficulty_fallback():
    task_results = {
        "u%d" % i: [{"difficulty": 1400, "solved": i < 3},
                    {"difficulty": 1600, "solved": i == 0}]
        for i in range(6)
    }
    out = e.apply_round(_equal_field(6), task_results)
    assert {r["mode"] for r in out.values()} == {"difficulty"}
    # The only person who solved both gains; the people who solved nothing lose.
    assert out["u0"]["delta"] > 0 > out["u5"]["delta"]


def test_full_field_uses_the_peer_model():
    out = e.apply_round(_equal_field(10), {})
    assert {r["mode"] for r in out.values()} == {"peer"}
    assert out["u0"]["delta"] > 0 > out["u9"]["delta"]


def test_apply_round_increments_experience_and_tightens_rd():
    out = e.apply_round(_equal_field(10, rounds_played=3), {})
    assert all(r["rounds_played"] == 4 for r in out.values())
    assert all(r["rd"] == pytest.approx(e.shrink_rd(4), abs=0.01) for r in out.values())


def test_rating_never_goes_negative():
    ranked = [{"firebase_uid": "x", "rating": 5.0, "rounds_played": 0, "rank": 1}]
    out = e.apply_round(ranked, {"x": [{"difficulty": 2500, "solved": False}] * 4})
    assert out["x"]["new_rating"] >= 0.0


# --- Pillars and difficulty calibration -------------------------------------

def test_pillar_rating_starts_at_default_and_moves_on_evidence():
    assert e.pillar_rating(None, 0, []) == pytest.approx(e.DEFAULT_RATING)
    up = e.pillar_rating(None, 0, [{"difficulty": 1400, "solved": True}])
    down = e.pillar_rating(None, 0, [{"difficulty": 1400, "solved": False}])
    assert up > e.DEFAULT_RATING > down


def test_calibration_raises_difficulty_when_a_task_proves_harder_than_predicted():
    # A field of 1400s should usually solve a 1200-rated task; none did.
    raised = e.calibrate_difficulty(1200, solver_ratings=[], non_solver_ratings=[1400.0] * 5)
    assert raised > 1200
    lowered = e.calibrate_difficulty(1200, solver_ratings=[1400.0] * 5, non_solver_ratings=[])
    assert lowered < 1200


def test_calibration_is_stable_when_reality_matches_prediction():
    # Equal ratings predict a 50% solve rate; half solved it.
    same = e.calibrate_difficulty(1400, solver_ratings=[1400.0], non_solver_ratings=[1400.0])
    assert same == pytest.approx(1400.0, abs=0.01)


def test_calibration_with_no_participants_is_a_no_op():
    assert e.calibrate_difficulty(1350, [], []) == pytest.approx(1350.0)


# --- Tiers ------------------------------------------------------------------

def test_tier_boundaries():
    assert get_tier(0)["tier"] == "Novice"
    assert get_tier(1199)["tier"] == "Novice"
    assert get_tier(1200)["tier"] == "Apprentice"
    assert get_tier(1400)["tier"] == "Entangler"
    assert get_tier(1600)["tier"] == "Expert"
    assert get_tier(1900)["tier"] == "Master"
    assert get_tier(2200)["tier"] == "Quantum Grandmaster"
    assert get_tier(9999)["tier"] == "Quantum Grandmaster"


def test_tier_progress_and_top_of_ladder():
    mid = get_tier(1500)
    assert mid["progress_pct"] == 50.0 and mid["next_tier"] == "Expert"
    top = get_tier(2500)
    assert top["next_tier"] is None and top["progress_pct"] == 100.0


def test_crossed_tiers_reports_promotions_only():
    assert crossed_tiers(1390, 1610) == ["Entangler", "Expert"]
    assert crossed_tiers(1700, 1500) == []
    assert crossed_tiers(1500, 1550) == []


def test_ladder_is_contiguous():
    rungs = ladder()
    assert len(rungs) == 6
    for lower, upper in zip(rungs, rungs[1:]):
        assert lower["to_rating"] + 1 == upper["from_rating"]
    assert rungs[-1]["to_rating"] is None


# --- Calibration phase ------------------------------------------------------

def test_new_accounts_are_scored_against_difficulty_even_in_a_full_field():
    ranked = _equal_field(12, rounds_played=0)
    tr = {p["firebase_uid"]: [{"difficulty": 1400, "solved": True}] for p in ranked}
    out = e.apply_round(ranked, tr)
    assert {r["mode"] for r in out.values()} == {"difficulty"}
    # Nobody is held back by the pool being zero-sum: all of them solved a task
    # above their rating, so all of them gain.
    assert all(r["delta"] > 0 for r in out.values())


def test_one_round_can_mix_both_modes():
    ranked = _equal_field(10, rounds_played=10)
    rookie = {"firebase_uid": "rookie", "rating": 1200.0, "rounds_played": 0, "rank": 11}
    ranked.append(rookie)
    tr = {"rookie": [{"difficulty": 1600, "solved": True}]}
    out = e.apply_round(ranked, tr)
    assert out["rookie"]["mode"] == "difficulty"
    assert out["u0"]["mode"] == "peer"


def test_peer_mode_needs_enough_calibrated_participants():
    # 20 people, but only 9 of them have enough history -> nobody is peer-rated.
    ranked = _equal_field(9, rounds_played=10) + [
        {"firebase_uid": "new%d" % i, "rating": 1200.0, "rounds_played": 1, "rank": 10 + i}
        for i in range(11)
    ]
    out = e.apply_round(ranked, {})
    assert {r["mode"] for r in out.values()} == {"difficulty"}


def test_peer_deltas_stay_zero_sum_over_the_eligible_subset():
    ranked = _equal_field(4, rounds_played=10)
    deltas = e.peer_deltas(ranked, eligible=["u0", "u1"])
    assert set(deltas) == {"u0", "u1"}
    assert sum(deltas.values()) == pytest.approx(0.0, abs=1e-6)
