"""Qplanner's scheduler: goal -> weekly sprints -> daily tasks.

Everything here is pure -- dicts in, dicts out, no DB, no LLM, no clock (today is
always passed in). That split mirrors topic_prefilter.build_candidates (pure) vs
get_weak_topic_candidates (I/O) and is what makes the invariants in
tests/test_qplanner_schedule.py cheap to assert.

Deliberately classical: packing is a sequential greedy fill over topologically
ordered layers. That is not a knapsack -- services/learning_qaoa.py picks the best
SUBSET for one session, whereas a plan has to place EVERY topic in the closure
into some sprint -- so none of the QAOA pipeline is reused here.

ponytail: greedy fill can leave a sprint a few minutes under budget where
first-fit-decreasing would have squeezed in one more topic. Fine while sprints run
~5 topics; revisit if utilisation ever looks bad.
"""
from datetime import date, timedelta
from math import ceil
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set

EMPHASIS_FACTOR = {"light": 0.6, "normal": 1.0, "deep": 1.3}
DEFAULT_EMPHASIS = "normal"
MIN_TOPIC_MINUTES = 15
DEFAULT_TOPIC_MINUTES = 30  # matches topic_prefilter's fallback for a topic with no estimated_minutes

# How a topic's minutes split across the four task kinds. Kinds whose content_refs
# are absent get dropped and their share is redistributed over the kinds that
# remain, so a day's minutes always sum back to the topic's budget.
TASK_KIND_SHARE = {
    "learn_video": 0.45,
    "read_slides": 0.25,
    "practice_quiz": 0.20,
    "revise_flashcards": 0.10,
}
TASK_KINDS: Sequence[str] = tuple(TASK_KIND_SHARE)
SPRINT_DAYS = 7
SPRINT_QUIZ_PASS_PCT = 70.0


# ---------------------------------------------------------------------------
# Topic selection
# ---------------------------------------------------------------------------

def index_topics(topics: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {t["slug"]: t for t in topics if t.get("slug")}


def topics_for_domains(
    topics_by_slug: Dict[str, Dict[str, Any]],
    target_domains: Optional[Sequence[str]],
) -> Set[str]:
    """target_domains=None means the whole roadmap (the 'full-roadmap' preset)."""
    if target_domains is None:
        return set(topics_by_slug)
    wanted = set(target_domains)
    return {
        slug for slug, topic in topics_by_slug.items()
        if (topic.get("domain") or "quantum-computing") in wanted
    }


def prereq_closure(
    topics_by_slug: Dict[str, Dict[str, Any]],
    target_slugs: Iterable[str],
    completed_slugs: Iterable[str],
) -> Set[str]:
    """Target topics plus every transitive prerequisite, minus anything already
    completed. A completed topic terminates the walk: its own prerequisites are
    satisfied by definition, so they do not get pulled back into the plan.

    In the seeded roadmap no prerequisite crosses a domain boundary, so for the
    current presets the closure only ever adds topics from the same domain -- but
    the walk is written generally because prerequisites are data, not code.
    """
    completed = set(completed_slugs)
    result: Set[str] = set()
    stack = [s for s in target_slugs if s in topics_by_slug and s not in completed]

    while stack:
        slug = stack.pop()
        if slug in result:
            continue
        result.add(slug)
        for prereq in topics_by_slug[slug].get("prerequisites") or []:
            if prereq in topics_by_slug and prereq not in completed and prereq not in result:
                stack.append(prereq)
    return result


def topological_layers(
    topics_by_slug: Dict[str, Dict[str, Any]],
    slugs: Iterable[str],
) -> List[List[str]]:
    """Kahn's algorithm over the induced subgraph. Prerequisites outside `slugs` are
    treated as satisfied -- prereq_closure only drops a prerequisite when the
    learner has completed it.

    Layer N holds topics whose prerequisites all sit in layers < N, so walking
    layers in order (and topics within a layer by order_index) can never place a
    topic before one of its prerequisites. Raises ValueError on a cycle;
    roadmap_seed.validate_dag guards the seed data against that.
    """
    selected = {s for s in slugs if s in topics_by_slug}
    pending = {
        slug: {p for p in (topics_by_slug[slug].get("prerequisites") or []) if p in selected}
        for slug in selected
    }

    def order_key(slug: str) -> Any:
        return (topics_by_slug[slug].get("order_index", 0), slug)

    layers: List[List[str]] = []
    done: Set[str] = set()
    while pending:
        ready = sorted((s for s, deps in pending.items() if deps <= done), key=order_key)
        if not ready:
            raise ValueError("prerequisite cycle among topics: " + ", ".join(sorted(pending)))
        layers.append(ready)
        done.update(ready)
        for slug in ready:
            del pending[slug]
    return layers


# ---------------------------------------------------------------------------
# Minutes
# ---------------------------------------------------------------------------

def apply_emphasis(topic_minutes: int, emphasis: Optional[str]) -> int:
    """The one place the AI layer's per-topic emphasis touches the schedule: strong
    mastery shrinks a topic, a weak one stretches it. Clamped so a 'light' short
    topic never collapses into a task nobody can actually do."""
    factor = EMPHASIS_FACTOR.get(emphasis or DEFAULT_EMPHASIS, 1.0)
    return max(MIN_TOPIC_MINUTES, int(round(topic_minutes * factor)))


def minutes_by_slug(
    topics_by_slug: Dict[str, Dict[str, Any]],
    slugs: Iterable[str],
    emphasis: Optional[Dict[str, str]] = None,
) -> Dict[str, int]:
    emphasis = emphasis or {}
    return {
        slug: apply_emphasis(
            int(topics_by_slug[slug].get("estimated_minutes") or DEFAULT_TOPIC_MINUTES),
            emphasis.get(slug),
        )
        for slug in slugs if slug in topics_by_slug
    }


# ---------------------------------------------------------------------------
# Sprints
# ---------------------------------------------------------------------------

def pack_sprints(
    layers: Sequence[Sequence[str]],
    minutes: Dict[str, int],
    weekly_minutes: int,
) -> List[Dict[str, Any]]:
    """Sequential greedy fill: add topics in topological order until the next one
    would breach the weekly budget, then open a new sprint. A topic bigger than the
    entire weekly budget gets a sprint to itself rather than being dropped -- the
    learner over-runs that one week, which is honest, instead of the plan silently
    omitting a required topic.
    """
    budget = max(1, int(weekly_minutes))
    sprints: List[Dict[str, Any]] = []
    current: List[str] = []
    current_minutes = 0

    def flush() -> None:
        nonlocal current, current_minutes
        if current:
            sprints.append({
                "index": len(sprints),
                "topic_slugs": current,
                "planned_minutes": current_minutes,
            })
            current, current_minutes = [], 0

    for layer in layers:
        for slug in layer:
            cost = minutes.get(slug, DEFAULT_TOPIC_MINUTES)
            if current and current_minutes + cost > budget:
                flush()
            current.append(slug)
            current_minutes += cost
    flush()
    return sprints


def sprint_dates(start_date: date, index: int) -> Dict[str, str]:
    first = start_date + timedelta(days=SPRINT_DAYS * index)
    return {
        "start_date": first.isoformat(),
        "end_date": (first + timedelta(days=SPRINT_DAYS - 1)).isoformat(),
    }


# ---------------------------------------------------------------------------
# Daily tasks
# ---------------------------------------------------------------------------

def available_task_refs(topic: Dict[str, Any]) -> Dict[str, Any]:
    """Which task kinds this topic can actually produce, and the ref each needs. A
    kind with no backing content is skipped rather than emitted as a dead task."""
    refs = topic.get("content_refs") or {}
    available: Dict[str, Any] = {}

    videos = refs.get("videos") or []
    if videos:
        available["learn_video"] = videos[0]
    slides = refs.get("slides") or []
    if slides:
        available["read_slides"] = slides[0]
    if refs.get("quiz_topic_tag"):
        available["practice_quiz"] = {"quiz_topic_tag": refs["quiz_topic_tag"]}
    if refs.get("flashcard_category"):
        available["revise_flashcards"] = {"flashcard_category": refs["flashcard_category"]}
    return available


def build_topic_tasks(date_str: str, topic: Dict[str, Any], total_minutes: int) -> List[Dict[str, Any]]:
    """Split one topic's budget across the kinds it has content for, redistributing
    the missing kinds' share so the emitted minutes still sum to total_minutes."""
    available = available_task_refs(topic)
    if not available:
        return []

    share_total = sum(TASK_KIND_SHARE[kind] for kind in available)
    kinds = [kind for kind in TASK_KINDS if kind in available]
    tasks: List[Dict[str, Any]] = []
    assigned = 0

    for position, kind in enumerate(kinds):
        if position == len(kinds) - 1:
            minutes = max(1, total_minutes - assigned)  # last kind absorbs the rounding
        else:
            minutes = max(1, int(round(total_minutes * TASK_KIND_SHARE[kind] / share_total)))
        assigned += minutes
        tasks.append({
            "task_id": date_str + ":" + topic["slug"] + ":" + kind,
            "topic_slug": topic["slug"],
            "title": topic.get("title", topic["slug"]),
            "kind": kind,
            "minutes": minutes,
            "ref": available[kind],
        })
    return tasks


def study_dates(start_date: date, sprint_index: int, study_days: Sequence[int]) -> List[date]:
    """The dates inside one sprint week that the learner said they study on
    (0 == Monday). Falls back to the sprint's first day so a sprint always has
    somewhere to put its work even if study_days is empty or misaligned."""
    wanted = set(study_days)
    first = start_date + timedelta(days=SPRINT_DAYS * sprint_index)
    dates = [first + timedelta(days=offset) for offset in range(SPRINT_DAYS)]
    hit = [d for d in dates if d.weekday() in wanted]
    return hit or [first]


def expand_days(
    sprints: Sequence[Dict[str, Any]],
    topics_by_slug: Dict[str, Dict[str, Any]],
    minutes: Dict[str, int],
    start_date: date,
    study_days: Sequence[int],
) -> List[Dict[str, Any]]:
    """Spread each sprint's topics across that week's study days, in sprint order so
    a topic never lands on an earlier day than its prerequisite, then emit the task
    rows. Days that end up with no topics are omitted entirely."""
    days: List[Dict[str, Any]] = []

    for sprint in sprints:
        dates = study_dates(start_date, sprint["index"], study_days)
        slugs = [s for s in sprint["topic_slugs"] if s in topics_by_slug]
        if not slugs:
            continue
        target = max(1, ceil(sprint["planned_minutes"] / len(dates)))

        buckets: List[List[str]] = [[] for _ in dates]
        slot = 0
        slot_minutes = 0
        for slug in slugs:
            cost = minutes.get(slug, DEFAULT_TOPIC_MINUTES)
            # move on once this day has had its share, but never past the last day
            if buckets[slot] and slot_minutes + cost > target and slot < len(dates) - 1:
                slot += 1
                slot_minutes = 0
            buckets[slot].append(slug)
            slot_minutes += cost

        for day_date, bucket in zip(dates, buckets):
            if not bucket:
                continue
            date_str = day_date.isoformat()
            tasks: List[Dict[str, Any]] = []
            for slug in bucket:
                tasks.extend(build_topic_tasks(
                    date_str, topics_by_slug[slug], minutes.get(slug, DEFAULT_TOPIC_MINUTES),
                ))
            if tasks:
                days.append({"date": date_str, "sprint_index": sprint["index"], "tasks": tasks})
    return days


# ---------------------------------------------------------------------------
# Feasibility and drift
# ---------------------------------------------------------------------------

def feasibility(
    total_minutes: int,
    start_date: date,
    deadline: date,
    weekly_minutes: int,
    sprints_needed: Optional[int] = None,
) -> Dict[str, Any]:
    """Can this much content fit before the deadline at the stated pace? Reported to
    the learner before they commit, so 'extend the deadline or raise the hours' is
    their call rather than something the scheduler quietly decides for them.

    `sprints_needed` is len(pack_sprints(...)) and is the authoritative answer:
    prerequisite layers can force more weeks than total_minutes/weekly_minutes
    suggests, because a topic cannot share a sprint with its own prerequisite.
    total_minutes/weekly_minutes is only the lower bound, used as the
    'raise your hours to this' hint.
    """
    span_days = max(1, (deadline - start_date).days + 1)
    weeks_available = max(1, ceil(span_days / SPRINT_DAYS))
    required = ceil(total_minutes / weeks_available) if total_minutes else 0
    weeks_needed = sprints_needed if sprints_needed is not None else (
        ceil(total_minutes / max(1, weekly_minutes)) if total_minutes else 0
    )
    return {
        "total_minutes": total_minutes,
        "weeks_available": weeks_available,
        "weeks_needed": weeks_needed,
        "required_weekly_minutes": required,
        "suggested_weekly_minutes": required,
        "feasible": weeks_needed <= weeks_available and required <= max(1, weekly_minutes),
    }


def compute_drift(
    days: Sequence[Dict[str, Any]],
    completed_task_ids: Iterable[str],
    today: date,
) -> Dict[str, Any]:
    """Reported, never acted on -- the schedule stays exactly as generated and the
    learner decides whether to re-plan (see PLANS/qplanner.md)."""
    completed_ids = set(completed_task_ids)
    today_str = today.isoformat()

    expected = 0
    completed = 0
    total = 0
    for day in days:
        due = day["date"] <= today_str
        for task in day["tasks"]:
            total += 1
            if due:
                expected += 1
            if task["task_id"] in completed_ids:
                completed += 1

    delta = completed - expected
    status = "on_track" if delta == 0 else ("ahead" if delta > 0 else "behind")
    return {
        "status": status,
        "expected": expected,
        "completed": completed,
        "total": total,
        "delta": delta,
    }
