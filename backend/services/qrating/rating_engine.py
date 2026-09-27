"""Q-Rating math.

Pure functions only - no DB, no I/O. Everything here is deterministic and
directly unit-testable; the DB writer lives in rounds_service.finalize_round().

Two paths compute a rating change:

  * peer       - Codeforces-style seed model. Your expected finishing place is
                 predicted from the ratings of everyone else in the round; you
                 gain or lose by beating or missing it. Needs a real field to
                 mean anything.
  * difficulty - each task is an opponent rated at its own difficulty; solving
                 is a win, not solving is a loss. Used when the field is too
                 small for the peer model, and always used for pillar
                 sub-ratings.
"""

import math
from typing import Any, Dict, Iterable, List, Optional, Sequence

DEFAULT_RATING = 1200.0
DEFAULT_RD = 350.0
MIN_RD = 80.0
MAX_DELTA = 400.0

# Below this, peer ranks carry no signal - fall back to task difficulty.
PEER_MIN_PARTICIPANTS = 10

# A brand-new account has no rating worth ranking against. Its first rounds are
# scored against task difficulty instead, which anchors it to an absolute level;
# peer ranking takes over once there is something to rank. Without this the pool
# is zero-sum from an all-1200 start and every rating stays squashed around the
# mean no matter how good anyone actually is.
CALIBRATION_ROUNDS = 3

# Wrong submissions on a task you eventually solve cost this much (ICPC convention).
WRONG_SUBMISSION_PENALTY_SECONDS = 300

ACCEPTED = "accepted"


# --- Elo primitives ---------------------------------------------------------

def expected_win(rating: float, opponent_rating: float) -> float:
    """Probability `rating` beats `opponent_rating`."""
    return 1.0 / (1.0 + math.pow(10.0, (opponent_rating - rating) / 400.0))


def seed(rating: float, other_ratings: Sequence[float]) -> float:
    """Expected finishing place for `rating` against `other_ratings`.

    1 + the expected number of participants who finish ahead of you.
    """
    return 1.0 + sum(expected_win(other, rating) for other in other_ratings)


def rating_for_seed(target_seed: float, other_ratings: Sequence[float]) -> float:
    """Inverse of seed(): the rating whose expected place is `target_seed`.

    Binary search - seed() is monotonically decreasing in rating, so this is
    well-defined. Bounds are deliberately wide so no real rating clips them.
    """
    low, high = 0.0, 5000.0
    for _ in range(60):  # cheaper than a convergence check, and exact enough
        mid = (low + high) / 2.0
        if seed(mid, other_ratings) > target_seed:
            low = mid  # mid places too low -> needs a higher rating
        else:
            high = mid
    return (low + high) / 2.0


def k_factor(rounds_played: int) -> float:
    """Volatility multiplier. New accounts move fast so they calibrate quickly."""
    return 40.0 if rounds_played < 5 else 20.0


def peer_scale(rounds_played: int) -> float:
    """Fraction of the gap to the target rating applied per round."""
    return 0.75 if rounds_played < 5 else 0.5


def shrink_rd(rounds_played: int) -> float:
    """Rating deviation after `rounds_played` rounds - the displayed band."""
    return max(MIN_RD, DEFAULT_RD / math.sqrt(rounds_played + 1))


def _clamp_delta(delta: float) -> float:
    return max(-MAX_DELTA, min(MAX_DELTA, delta))


# --- Contest scoring --------------------------------------------------------

def score_participant(
    task_points: Dict[str, int],
    submissions: Iterable[Dict[str, Any]],
) -> Dict[str, Any]:
    """Points, penalty and per-task breakdown for one participant.

    `submissions` are that participant's rated submissions in any order, each
    {task_id, verdict, elapsed_seconds} where elapsed_seconds is measured from
    the round start. A task scores on its first accepted submission; wrong
    submissions before that cost WRONG_SUBMISSION_PENALTY_SECONDS each. Wrong
    submissions on a task never solved cost nothing - nobody should be punished
    for attacking a problem they could not crack.
    """
    ordered = sorted(submissions, key=lambda s: s.get("elapsed_seconds", 0))

    per_task: Dict[str, Dict[str, Any]] = {
        task_id: {"task_id": task_id, "points": 0, "solved": False,
                  "solved_at": None, "wrong_attempts": 0, "penalty_seconds": 0}
        for task_id in task_points
    }

    for sub in ordered:
        task_id = sub.get("task_id")
        entry = per_task.get(task_id)
        if entry is None or entry["solved"]:
            continue  # unknown task, or already solved - later attempts are noise
        if sub.get("verdict") == ACCEPTED:
            elapsed = int(sub.get("elapsed_seconds", 0))
            entry["solved"] = True
            entry["solved_at"] = elapsed
            entry["points"] = task_points[task_id]
            entry["penalty_seconds"] = (
                elapsed + entry["wrong_attempts"] * WRONG_SUBMISSION_PENALTY_SECONDS
            )
        else:
            entry["wrong_attempts"] += 1

    breakdown = list(per_task.values())
    return {
        "score": sum(t["points"] for t in breakdown),
        "penalty_seconds": sum(t["penalty_seconds"] for t in breakdown),
        "per_task": breakdown,
    }


def rank_participants(participants: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Assign ranks: score descending, then penalty_seconds ascending.

    Ties share a rank and consume the places behind them (1, 2, 2, 4) - two
    people who did identically must not be separated by an arbitrary decision.
    Returns new dicts; the input is not mutated.
    """
    ordered = sorted(
        (dict(p) for p in participants),
        key=lambda p: (-p.get("score", 0), p.get("penalty_seconds", 0)),
    )
    prev_key = None
    prev_rank = 0
    for i, p in enumerate(ordered):
        key = (p.get("score", 0), p.get("penalty_seconds", 0))
        rank = prev_rank if key == prev_key else i + 1
        p["rank"] = rank
        prev_key, prev_rank = key, rank
    return ordered


# --- Rating updates ---------------------------------------------------------

def peer_deltas(
    ranked: Sequence[Dict[str, Any]],
    eligible: Optional[Iterable[str]] = None,
) -> Dict[str, float]:
    """Rating deltas from finishing place vs. expected place.

    `ranked` entries need firebase_uid, rating, rounds_played, rank. Everyone in
    `ranked` counts toward the seeds - you are ranked against the whole field -
    but only `eligible` uids receive a delta (default: all of them). A zero-sum
    correction across the eligible set keeps the pool from inflating: if everyone
    beats expectation then the expectation was wrong, not the field.
    """
    ratings = [float(p["rating"]) for p in ranked]
    allowed = None if eligible is None else set(eligible)
    deltas: Dict[str, float] = {}

    for i, p in enumerate(ranked):
        if allowed is not None and p["firebase_uid"] not in allowed:
            continue
        rating = float(p["rating"])
        others = ratings[:i] + ratings[i + 1:]
        own_seed = seed(rating, others)
        # Geometric mean of expected and actual place: one lucky round cannot
        # carry you, one bad round cannot sink you.
        target = math.sqrt(own_seed * float(p["rank"]))
        target_rating = rating_for_seed(target, others)
        delta = peer_scale(int(p.get("rounds_played", 0))) * (target_rating - rating)
        deltas[p["firebase_uid"]] = delta

    if deltas:
        correction = -sum(deltas.values()) / len(deltas)
        deltas = {uid: _clamp_delta(d + correction) for uid, d in deltas.items()}
    return deltas


def difficulty_delta(
    rating: float,
    rounds_played: int,
    task_results: Sequence[Dict[str, Any]],
) -> float:
    """Rating delta from solving/not solving tasks of known difficulty.

    `task_results` entries need difficulty and solved. Every task in the round
    counts, including untouched ones - skipping a task you should have solved is
    information about your level.
    """
    k = k_factor(rounds_played)
    delta = 0.0
    for task in task_results:
        expected = expected_win(rating, float(task["difficulty"]))
        actual = 1.0 if task.get("solved") else 0.0
        delta += k * (actual - expected)
    return _clamp_delta(delta)


def apply_round(
    ranked: Sequence[Dict[str, Any]],
    task_results_by_uid: Dict[str, Sequence[Dict[str, Any]]],
) -> Dict[str, Dict[str, Any]]:
    """Rating updates for a whole round, picking the path each learner supports.

    Learners with fewer than CALIBRATION_ROUNDS rounds are always scored against
    task difficulty; the rest are scored on peer rank once enough of them are
    calibrated. A single round can therefore mix both modes.

    `ranked` entries need firebase_uid, rating, rounds_played, rank.
    Returns {uid: {old_rating, new_rating, delta, rd, rounds_played, mode}}.
    """
    calibrated = [p for p in ranked
                  if int(p.get("rounds_played", 0)) >= CALIBRATION_ROUNDS]
    use_peer = len(calibrated) >= PEER_MIN_PARTICIPANTS
    peer = (peer_deltas(ranked, eligible=[p["firebase_uid"] for p in calibrated])
            if use_peer else {})

    out: Dict[str, Dict[str, Any]] = {}
    for p in ranked:
        uid = p["firebase_uid"]
        old = float(p["rating"])
        rounds_played = int(p.get("rounds_played", 0))
        if uid in peer:
            delta = peer[uid]
            mode = "peer"
        else:
            delta = difficulty_delta(old, rounds_played, task_results_by_uid.get(uid, []))
            mode = "difficulty"
        new_rounds = rounds_played + 1
        out[uid] = {
            "old_rating": round(old, 2),
            "new_rating": round(max(0.0, old + delta), 2),
            "delta": round(delta, 2),
            "rd": round(shrink_rd(new_rounds), 2),
            "rounds_played": new_rounds,
            "mode": mode,
        }
    return out


def pillar_rating(
    current: Optional[float],
    rounds_played: int,
    task_results: Sequence[Dict[str, Any]],
) -> float:
    """Per-pillar sub-rating. Always the difficulty path - a pillar contributes
    too few tasks per round for peer ranks to say anything."""
    base = DEFAULT_RATING if current is None else float(current)
    if not task_results:
        return round(base, 2)
    return round(max(0.0, base + difficulty_delta(base, rounds_played, task_results)), 2)


def calibrate_difficulty(
    difficulty: float,
    solver_ratings: Sequence[float],
    non_solver_ratings: Sequence[float],
    k: float = 32.0,
) -> float:
    """Nudge a task's difficulty toward what the field actually did with it.

    Harder than predicted (fewer solves than expected) pushes difficulty up.
    Lets a hand-guessed initial difficulty converge over a few rounds.
    """
    all_ratings = list(solver_ratings) + list(non_solver_ratings)
    if not all_ratings:
        return round(difficulty, 2)
    expected = sum(expected_win(r, difficulty) for r in all_ratings) / len(all_ratings)
    actual = len(solver_ratings) / len(all_ratings)
    return round(difficulty + k * (expected - actual), 2)
