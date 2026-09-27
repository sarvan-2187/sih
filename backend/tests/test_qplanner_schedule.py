"""Invariants for Qplanner's scheduler (services/qplanner_schedule.py).

Plain asserts, no fixtures, no TestClient -- same style as
tests/test_topic_prefilter.py. Everything under test is pure, so these run
without a DB, a provider key or a simulator.

Run: python -m pytest tests/test_qplanner_schedule.py -v
     python tests/test_qplanner_schedule.py        (same checks, no pytest)
"""
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.qplanner_presets import PRESETS, get_preset
from services.qplanner_schedule import (
    MIN_TOPIC_MINUTES,
    apply_emphasis,
    build_topic_tasks,
    compute_drift,
    expand_days,
    feasibility,
    index_topics,
    minutes_by_slug,
    pack_sprints,
    prereq_closure,
    sprint_dates,
    study_dates,
    topics_for_domains,
    topological_layers,
)

MONDAY = date(2026, 9, 28)  # weekday() == 0, so study_days offsets are easy to reason about


def _topic(slug, order, minutes=60, prereqs=(), domain="quantum-computing", refs=None):
    return {
        "slug": slug,
        "title": slug.replace("-", " ").title(),
        "domain": domain,
        "order_index": order,
        "estimated_minutes": minutes,
        "prerequisites": list(prereqs),
        "content_refs": refs if refs is not None else {
            "videos": [{"title": slug, "url": "https://example.test/" + slug}],
            "slides": [{"title": slug, "url": "/slides/" + slug + ".pdf"}],
            "quiz_topic_tag": slug + "-quiz",
            "flashcard_category": slug.title(),
        },
    }


# a -> b -> d, a -> c -> d  (a diamond, so layers are non-trivial)
DIAMOND = [
    _topic("a", 1),
    _topic("b", 2, prereqs=["a"]),
    _topic("c", 3, prereqs=["a"]),
    _topic("d", 4, prereqs=["b", "c"]),
]


# ---------------------------------------------------------------------------
# Selection and closure
# ---------------------------------------------------------------------------

def test_topics_for_domains_none_means_everything():
    by_slug = index_topics(DIAMOND + [_topic("m1", 9, domain="quantum-maths")])
    assert topics_for_domains(by_slug, None) == set(by_slug)
    assert topics_for_domains(by_slug, ["quantum-maths"]) == {"m1"}


def test_closure_pulls_transitive_prerequisites():
    by_slug = index_topics(DIAMOND)
    # asking only for the deepest topic must drag in every ancestor
    assert prereq_closure(by_slug, ["d"], []) == {"a", "b", "c", "d"}


def test_closure_stops_at_completed_topics():
    by_slug = index_topics(DIAMOND)
    # b completed => b is out, and a is NOT pulled back in through b
    assert prereq_closure(by_slug, ["d"], ["b"]) == {"a", "c", "d"}
    # every ancestor completed => only the target remains
    assert prereq_closure(by_slug, ["d"], ["a", "b", "c"]) == {"d"}
    # the target itself completed => nothing to plan
    assert prereq_closure(by_slug, ["d"], ["d"]) == set()


def test_closure_ignores_unknown_slugs():
    by_slug = index_topics(DIAMOND)
    assert prereq_closure(by_slug, ["d", "does-not-exist"], []) == {"a", "b", "c", "d"}


# ---------------------------------------------------------------------------
# Ordering -- the invariant the whole feature rests on
# ---------------------------------------------------------------------------

def _assert_prereqs_precede(by_slug, ordered_slugs):
    """No topic may appear before any of its prerequisites that is also planned."""
    seen = set()
    planned = set(ordered_slugs)
    for slug in ordered_slugs:
        for prereq in by_slug[slug].get("prerequisites") or []:
            if prereq in planned:
                assert prereq in seen, slug + " scheduled before its prerequisite " + prereq
        seen.add(slug)


def test_topological_layers_respect_prerequisites():
    by_slug = index_topics(DIAMOND)
    layers = topological_layers(by_slug, ["a", "b", "c", "d"])
    assert layers == [["a"], ["b", "c"], ["d"]]
    _assert_prereqs_precede(by_slug, [s for layer in layers for s in layer])


def test_topological_layers_treat_unplanned_prerequisites_as_satisfied():
    by_slug = index_topics(DIAMOND)
    # 'a' was completed and dropped by the closure, so b/c must still be schedulable
    layers = topological_layers(by_slug, ["b", "c", "d"])
    assert layers == [["b", "c"], ["d"]]


def test_topological_layers_raise_on_cycle():
    cyclic = index_topics([
        _topic("x", 1, prereqs=["y"]),
        _topic("y", 2, prereqs=["x"]),
    ])
    try:
        topological_layers(cyclic, ["x", "y"])
    except ValueError as exc:
        assert "cycle" in str(exc)
    else:
        raise AssertionError("a prerequisite cycle must raise")


def test_real_roadmap_orders_every_topic_after_its_prerequisites():
    from services.roadmap_seed import SEED_TOPICS

    by_slug = index_topics(SEED_TOPICS)
    layers = topological_layers(by_slug, by_slug)
    ordered = [s for layer in layers for s in layer]
    assert len(ordered) == len(by_slug)
    _assert_prereqs_precede(by_slug, ordered)


# ---------------------------------------------------------------------------
# Emphasis -- the AI layer's only lever on the schedule
# ---------------------------------------------------------------------------

def test_apply_emphasis_scales_and_clamps():
    assert apply_emphasis(100, "normal") == 100
    assert apply_emphasis(100, None) == 100
    assert apply_emphasis(100, "light") == 60
    assert apply_emphasis(100, "deep") == 130
    # a garbage value from the model must not warp the plan
    assert apply_emphasis(100, "extremely-deep") == 100
    # clamp: 'light' on an already-short topic still leaves a doable task
    assert apply_emphasis(20, "light") == MIN_TOPIC_MINUTES


def test_minutes_by_slug_applies_per_topic_emphasis():
    by_slug = index_topics(DIAMOND)
    mins = minutes_by_slug(by_slug, ["a", "b"], {"a": "light", "b": "deep"})
    assert mins == {"a": 36, "b": 78}


def test_minutes_by_slug_defaults_missing_estimate():
    by_slug = index_topics([{"slug": "z", "title": "Z", "content_refs": {}}])
    assert minutes_by_slug(by_slug, ["z"]) == {"z": 30}


# ---------------------------------------------------------------------------
# Packing
# ---------------------------------------------------------------------------

def test_pack_sprints_never_exceeds_the_weekly_budget():
    layers = [["a"], ["b"], ["c"], ["d"]]
    mins = {"a": 60, "b": 60, "c": 60, "d": 60}
    sprints = pack_sprints(layers, mins, weekly_minutes=120)
    assert [s["topic_slugs"] for s in sprints] == [["a", "b"], ["c", "d"]]
    assert all(s["planned_minutes"] <= 120 for s in sprints)
    assert [s["index"] for s in sprints] == [0, 1]


def test_pack_sprints_keeps_prerequisite_order_across_sprints():
    by_slug = index_topics(DIAMOND)
    layers = topological_layers(by_slug, ["a", "b", "c", "d"])
    sprints = pack_sprints(layers, minutes_by_slug(by_slug, ["a", "b", "c", "d"]), 90)
    _assert_prereqs_precede(by_slug, [s for sp in sprints for s in sp["topic_slugs"]])


def test_oversized_topic_gets_its_own_sprint_rather_than_being_dropped():
    sprints = pack_sprints([["small"], ["huge"], ["small2"]],
                           {"small": 30, "huge": 500, "small2": 30}, weekly_minutes=60)
    placed = [s for sp in sprints for s in sp["topic_slugs"]]
    assert placed == ["small", "huge", "small2"]
    huge = next(sp for sp in sprints if "huge" in sp["topic_slugs"])
    assert huge["topic_slugs"] == ["huge"]  # alone, over budget, but not lost


def test_pack_sprints_places_every_topic_exactly_once():
    by_slug = index_topics(DIAMOND)
    slugs = ["a", "b", "c", "d"]
    sprints = pack_sprints(topological_layers(by_slug, slugs), minutes_by_slug(by_slug, slugs), 70)
    placed = [s for sp in sprints for s in sp["topic_slugs"]]
    assert sorted(placed) == sorted(slugs)
    assert len(placed) == len(set(placed))


def test_pack_sprints_handles_an_empty_plan():
    assert pack_sprints([], {}, 300) == []


# ---------------------------------------------------------------------------
# Days and tasks
# ---------------------------------------------------------------------------

def test_sprint_dates_are_consecutive_weeks():
    assert sprint_dates(MONDAY, 0) == {"start_date": "2026-09-28", "end_date": "2026-10-04"}
    assert sprint_dates(MONDAY, 2)["start_date"] == (MONDAY + timedelta(days=14)).isoformat()


def test_study_dates_only_land_on_chosen_weekdays():
    dates = study_dates(MONDAY, 0, [0, 2, 4])  # Mon/Wed/Fri
    assert [d.weekday() for d in dates] == [0, 2, 4]
    assert len(dates) == 3


def test_study_dates_fall_back_when_no_weekday_matches():
    assert study_dates(MONDAY, 0, []) == [MONDAY]


def test_expand_days_only_uses_chosen_study_days():
    by_slug = index_topics(DIAMOND)
    slugs = ["a", "b", "c", "d"]
    mins = minutes_by_slug(by_slug, slugs)
    sprints = pack_sprints(topological_layers(by_slug, slugs), mins, 120)
    days = expand_days(sprints, by_slug, mins, MONDAY, [1, 3])  # Tue/Thu only
    assert days
    for day in days:
        assert date.fromisoformat(day["date"]).weekday() in (1, 3)


def test_expand_days_keeps_prerequisites_on_the_same_or_earlier_day():
    by_slug = index_topics(DIAMOND)
    slugs = ["a", "b", "c", "d"]
    mins = minutes_by_slug(by_slug, slugs)
    sprints = pack_sprints(topological_layers(by_slug, slugs), mins, 300)
    days = expand_days(sprints, by_slug, mins, MONDAY, [0, 1, 2, 3, 4])

    first_seen = {}
    for day in days:
        for task in day["tasks"]:
            first_seen.setdefault(task["topic_slug"], day["date"])
    for slug in slugs:
        for prereq in by_slug[slug]["prerequisites"]:
            assert first_seen[prereq] <= first_seen[slug]


def test_task_minutes_sum_back_to_the_topic_budget():
    tasks = build_topic_tasks("2026-09-28", DIAMOND[0], 80)
    assert len(tasks) == 4
    assert sum(t["minutes"] for t in tasks) == 80
    assert [t["kind"] for t in tasks] == [
        "learn_video", "read_slides", "practice_quiz", "revise_flashcards",
    ]
    assert tasks[0]["task_id"] == "2026-09-28:a:learn_video"


def test_missing_content_kinds_are_skipped_and_their_share_redistributed():
    video_only = _topic("v", 1, refs={"videos": [{"title": "v", "url": "https://example.test/v"}]})
    tasks = build_topic_tasks("2026-09-28", video_only, 80)
    assert [t["kind"] for t in tasks] == ["learn_video"]
    assert tasks[0]["minutes"] == 80  # the absent kinds' share went here, nothing evaporated


def test_topic_with_no_content_emits_no_tasks():
    assert build_topic_tasks("2026-09-28", _topic("empty", 1, refs={}), 60) == []


def test_task_ids_are_unique_across_a_whole_plan():
    from services.roadmap_seed import SEED_TOPICS

    by_slug = index_topics(SEED_TOPICS)
    closure = prereq_closure(by_slug, by_slug, [])
    mins = minutes_by_slug(by_slug, closure)
    sprints = pack_sprints(topological_layers(by_slug, closure), mins, 360)
    days = expand_days(sprints, by_slug, mins, MONDAY, [0, 2, 4])
    ids = [t["task_id"] for d in days for t in d["tasks"]]
    assert len(ids) == len(set(ids))
    assert ids  # the real roadmap must actually produce tasks


# ---------------------------------------------------------------------------
# Feasibility
# ---------------------------------------------------------------------------

def test_feasibility_uses_the_real_sprint_count_not_just_the_minute_total():
    # 4 hours of content, 11 weeks available, plenty of weekly hours -- but
    # prerequisite layers forced 12 sprints, so it does NOT fit.
    verdict = feasibility(240, MONDAY, MONDAY + timedelta(weeks=10), 600, sprints_needed=12)
    assert verdict["weeks_available"] == 11
    assert verdict["weeks_needed"] == 12
    assert verdict["feasible"] is False


def test_feasibility_flags_too_few_weekly_minutes():
    verdict = feasibility(1200, MONDAY, MONDAY + timedelta(weeks=2), 60, sprints_needed=2)
    assert verdict["feasible"] is False
    assert verdict["suggested_weekly_minutes"] > 60


def test_feasibility_passes_when_pace_and_weeks_both_suffice():
    verdict = feasibility(600, MONDAY, MONDAY + timedelta(weeks=4), 300, sprints_needed=2)
    assert verdict["feasible"] is True


def test_every_preset_is_feasible_at_its_own_defaults():
    """The intake form opens on these numbers, so they must not open on a warning."""
    from services.roadmap_seed import SEED_TOPICS

    by_slug = index_topics(SEED_TOPICS)
    for preset in PRESETS:
        closure = prereq_closure(by_slug, topics_for_domains(by_slug, preset["target_domains"]), [])
        mins = minutes_by_slug(by_slug, closure)
        sprints = pack_sprints(topological_layers(by_slug, closure), mins,
                               preset["default_weekly_minutes"])
        deadline = MONDAY + timedelta(weeks=preset["default_weeks"])
        verdict = feasibility(sum(mins.values()), MONDAY, deadline,
                              preset["default_weekly_minutes"], sprints_needed=len(sprints))
        assert verdict["feasible"], preset["slug"] + " infeasible at its own defaults: " + str(verdict)


def test_get_preset_rejects_unknown_slugs():
    assert get_preset("full-roadmap") is not None
    assert get_preset("nope") is None


# ---------------------------------------------------------------------------
# Drift
# ---------------------------------------------------------------------------

DRIFT_DAYS = [
    {"date": "2026-09-28", "sprint_index": 0, "tasks": [
        {"task_id": "t1", "minutes": 30}, {"task_id": "t2", "minutes": 30}]},
    {"date": "2026-09-30", "sprint_index": 0, "tasks": [{"task_id": "t3", "minutes": 30}]},
    {"date": "2026-10-05", "sprint_index": 1, "tasks": [{"task_id": "t4", "minutes": 30}]},
]


def test_drift_on_track():
    drift = compute_drift(DRIFT_DAYS, ["t1", "t2", "t3"], date(2026, 9, 30))
    assert drift["status"] == "on_track"
    assert (drift["expected"], drift["completed"], drift["total"], drift["delta"]) == (3, 3, 4, 0)


def test_drift_behind():
    drift = compute_drift(DRIFT_DAYS, ["t1"], date(2026, 9, 30))
    assert drift["status"] == "behind"
    assert drift["delta"] == -2


def test_drift_ahead_counts_work_done_early():
    drift = compute_drift(DRIFT_DAYS, ["t1", "t2", "t3", "t4"], date(2026, 9, 30))
    assert drift["status"] == "ahead"
    assert drift["delta"] == 1


def test_drift_on_an_untouched_future_plan_is_on_track():
    drift = compute_drift(DRIFT_DAYS, [], date(2026, 9, 27))
    assert drift == {"status": "on_track", "expected": 0, "completed": 0, "total": 4, "delta": 0}


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("PASS " + name)
            except Exception as exc:  # noqa: BLE001 - self-check runner, report and continue
                failures += 1
                print("FAIL " + name + ": " + repr(exc))
    print(("FAILURES: " + str(failures)) if failures else "all scheduler checks passed")
    sys.exit(1 if failures else 0)
