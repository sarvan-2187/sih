"""Q-Rating tiers — the visible ladder a learner climbs.

Same shape as XPEngine.get_level_rank: rating in, presentation out. Kept
separate from the rating math so the ladder can be re-flavoured without
touching anything that computes a number.
"""

from typing import Any, Dict, List

# (floor, name, hex colour). Ordered low -> high; floors are inclusive.
TIERS: List[tuple] = [
    (0, "Novice", "#94a3b8"),              # slate
    (1200, "Apprentice", "#22c55e"),       # green
    (1400, "Entangler", "#06b6d4"),        # cyan
    (1600, "Expert", "#3b82f6"),           # blue
    (1900, "Master", "#a855f7"),           # purple
    (2200, "Quantum Grandmaster", "#f59e0b"),  # amber
]


def get_tier(rating: float) -> Dict[str, Any]:
    """Tier for a rating, plus progress toward the next one.

    `next_tier` / `next_tier_at` are None at the top of the ladder, where
    `progress_pct` is 100.
    """
    idx = 0
    for i, (floor, _, _) in enumerate(TIERS):
        if rating >= floor:
            idx = i
    floor, name, colour = TIERS[idx]

    if idx + 1 < len(TIERS):
        next_floor, next_name, _ = TIERS[idx + 1]
        span = next_floor - floor
        progress = ((rating - floor) / span) * 100 if span > 0 else 100.0
        progress = min(100.0, max(0.0, progress))
    else:
        next_floor, next_name, progress = None, None, 100.0

    return {
        "tier": name,
        "tier_index": idx,
        "colour": colour,
        "tier_floor": floor,
        "next_tier": next_name,
        "next_tier_at": next_floor,
        "progress_pct": round(progress, 1),
    }


def tier_name(rating: float) -> str:
    return get_tier(rating)["tier"]


def crossed_tiers(old_rating: float, new_rating: float) -> List[str]:
    """Tier names newly reached going from old -> new. Empty on a drop."""
    old_idx = get_tier(old_rating)["tier_index"]
    new_idx = get_tier(new_rating)["tier_index"]
    if new_idx <= old_idx:
        return []
    return [TIERS[i][1] for i in range(old_idx + 1, new_idx + 1)]


def ladder() -> List[Dict[str, Any]]:
    """The full ladder, for the tier-progression UI."""
    return [
        {
            "tier": name,
            "colour": colour,
            "from_rating": floor,
            "to_rating": TIERS[i + 1][0] - 1 if i + 1 < len(TIERS) else None,
        }
        for i, (floor, name, colour) in enumerate(TIERS)
    ]
