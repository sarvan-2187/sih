"""Qplanner goal presets -- the "named plan" intake model (see PLANS/qplanner.md).

Hardcoded module constant, matching roadmap_seed.SEED_TOPICS' convention: this is
reference data that ships with the code, not user content, so it needs no
collection and no seeding step.

`default_weekly_minutes` / `default_weeks` are sized against the real seeded
roadmap (quantum-maths 7.8h + quantum-physics 8.2h, quantum-computing 39.6h,
all five domains 111.1h) so the intake form opens on a feasible combination.
The learner can move both, and qplanner_schedule.feasibility() recomputes the
truth either way -- these are starting points, not constraints.
"""
from typing import Any, Dict, List, Optional

# None == every domain in the roadmap.
PRESETS: List[Dict[str, Any]] = [
    {
        "slug": "quantum-foundations",
        "label": "Quantum Foundations",
        "tagline": "The maths and physics everything else stands on.",
        "target_domains": ["quantum-maths", "quantum-physics"],
        "default_weeks": 4,
        "default_weekly_minutes": 240,   # 4 h/week over 4 weeks == 16h, matches the 16h of content
    },
    {
        "slug": "algorithms-sprint",
        "label": "Algorithms Sprint",
        "tagline": "Gates, circuits and the canonical quantum algorithms.",
        "target_domains": ["quantum-computing"],
        "default_weeks": 6,
        "default_weekly_minutes": 420,   # 7 h/week over 6 weeks == 42h vs 39.6h of content
    },
    {
        "slug": "full-roadmap",
        "label": "Complete Quantum Roadmap",
        "tagline": "All 93 topics, maths through quantum machine learning.",
        "target_domains": None,
        "default_weeks": 20,
        "default_weekly_minutes": 360,   # 6 h/week over 20 weeks == 120h vs 111h of content
    },
]

_BY_SLUG = {p["slug"]: p for p in PRESETS}


def get_preset(slug: str) -> Optional[Dict[str, Any]]:
    return _BY_SLUG.get(slug)
