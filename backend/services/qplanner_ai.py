"""Qplanner's AI layer: the only part of a plan the model gets to write.

The schedule itself is decided by qplanner_schedule.py -- prerequisite order,
sprint packing and day placement are arithmetic, not judgement. The model
contributes two things on top of that skeleton:

  * `emphasis` -- per topic, one of light/normal/deep, which scales that topic's
    planned minutes (qplanner_schedule.apply_emphasis). A deterministic baseline
    is computed from quiz mastery first; the model may adjust it, and anything it
    returns is validated against the planned slugs before it is used.
  * sprint copy -- title, focus line, why-it-matters, plus an overall strategy
    note and a few tips.

Every one of those has a deterministic fallback, so a dead provider costs a plan
its prose, never its existence.
"""
from typing import Any, Dict, List, Literal, Optional, Sequence

from pydantic import BaseModel, Field

from ai import AITask, ChatMessage, ai_gateway

# Mastery thresholds for the deterministic emphasis baseline. STRONG mirrors
# topic_prefilter.WEAK_MASTERY_THRESHOLD so "strong enough to skim" means the same
# thing to the planner as "not worth recommending" does to the session recommender.
STRONG_MASTERY = 70.0
WEAK_MASTERY = 40.0
MAX_TIPS = 3

QPLANNER_SYSTEM_PROMPT = """You are a study coach for Qrious, a quantum computing learning platform.

You are given a study plan that has ALREADY been scheduled: the sprints, their
topics and their order are fixed and correct (they respect prerequisites and the
learner's weekly time budget). Do not reorder, add or remove anything.

Your job is to make the plan feel written for this learner:

1. `emphasis`: a list with one {"slug", "level"} object per topic slug, where
   level is exactly one of "light", "normal" or "deep".
   - "light" when their quiz mastery for that topic is already strong (>= 70).
   - "deep" when they have attempted it and scored poorly (< 40).
   - "normal" otherwise, including topics they have never been quizzed on.
   A suggested baseline is provided; change it only where the learner's data
   justifies it. Copy each slug exactly as written.
2. `sprints`: a list with exactly one object per sprint, in the same order the
   sprints are listed. Each has a short `title` (max 6 words, concrete, no
   "Sprint 1" numbering), a `focus_line` (one sentence on what they will be able
   to do by the end) and `why_it_matters` (one sentence connecting it to the goal).
3. `strategy_note`: 2-3 sentences on how to approach this plan overall.
4. `personalized_tips`: up to 3 short, specific tips based on their weak areas.

Be concrete and plain. No emoji, no hype, no motivational filler."""


# Structured output goes out as a tool call that the provider validates against this schema
# SERVER-SIDE, before our repair retry can run -- a schema the model misreads is a hard 400.
# So every field is described, the only hard-required fields are ones the model cannot get
# wrong, and nothing is keyed by a dynamic map. Two real failures shaped this (2026-09-27):
#   * `emphasis: Dict[str, str]` let the model write free text ("Focus on foundations...")
#     instead of light/normal/deep; now a Literal, which becomes an enum the provider enforces.
#   * `SprintCopy.index` was required and the model sent `slug` instead, so Groq rejected the
#     whole call. Sprints are now matched by position instead.

class TopicEmphasis(BaseModel):
    slug: str = Field(description="A topic slug copied exactly from the plan.")
    level: Literal["light", "normal", "deep"]


class SprintCopy(BaseModel):
    title: str = Field(description="Max 6 words, concrete, no 'Sprint 1' style numbering.")
    focus_line: str = Field(default="", description="One sentence: what they can do by the end of it.")
    why_it_matters: str = Field(default="", description="One sentence connecting this sprint to the goal.")


class PlanNarrative(BaseModel):
    strategy_note: str = Field(default="", description="2-3 sentences on how to approach the plan.")
    personalized_tips: List[str] = Field(default_factory=list, description="Up to 3 short, specific tips.")
    emphasis: List[TopicEmphasis] = Field(
        default_factory=list, description="One entry per topic slug in the plan.",
    )
    sprints: List[SprintCopy] = Field(
        default_factory=list,
        description="Exactly one entry per sprint, in the same order the sprints were given.",
    )


# ---------------------------------------------------------------------------
# Deterministic layer -- also the fallback when the gateway is unavailable
# ---------------------------------------------------------------------------

def baseline_emphasis(
    slugs: Sequence[str],
    mastery_map: Dict[str, float],
    unquizzed: Optional[Dict[str, str]] = None,
) -> Dict[str, str]:
    """Threshold rule over average quiz score per topic. A topic the learner has
    never been quizzed on takes the level they declared for its subject
    (`unquizzed`), else "normal" -- guessing "deep" for it would inflate every new
    plan. Real quiz scores always beat the declared level."""
    unquizzed = unquizzed or {}
    emphasis: Dict[str, str] = {}
    for slug in slugs:
        score = mastery_map.get(slug)
        if score is None:
            emphasis[slug] = unquizzed.get(slug, "normal")
        elif score >= STRONG_MASTERY:
            emphasis[slug] = "light"
        elif score < WEAK_MASTERY:
            emphasis[slug] = "deep"
        else:
            emphasis[slug] = "normal"
    return emphasis


def deterministic_sprint_copy(
    sprints: Sequence[Dict[str, Any]],
    topics_by_slug: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Titles built from the sprint's own topics, so a plan with no AI copy still
    reads like a plan rather than 'Sprint 3'."""
    copy: List[Dict[str, Any]] = []
    for sprint in sprints:
        titles = [
            topics_by_slug[s].get("title", s)
            for s in sprint["topic_slugs"] if s in topics_by_slug
        ]
        lead = titles[0] if titles else "Study"
        extra = len(titles) - 1
        copy.append({
            "index": sprint["index"],
            "title": lead if extra <= 0 else lead + " (+" + str(extra) + " more)",
            "focus_line": "; ".join(titles),
            "why_it_matters": "",
        })
    return copy


def deterministic_narrative(
    sprints: Sequence[Dict[str, Any]],
    topics_by_slug: Dict[str, Dict[str, Any]],
    emphasis: Dict[str, str],
) -> Dict[str, Any]:
    weak = sorted(s for s, level in emphasis.items() if level == "deep")
    tips: List[str] = []
    if weak:
        names = [topics_by_slug.get(s, {}).get("title", s) for s in weak[:MAX_TIPS]]
        tips.append("Give extra time to: " + ", ".join(names) + ".")
    tips.append("Finish each sprint's quiz before moving on -- it unlocks the next sprint.")

    return {
        "strategy_note": (
            "Work through the sprints in order; each one only contains topics whose "
            "prerequisites you have already covered."
        ),
        "personalized_tips": tips[:MAX_TIPS],
        "emphasis": emphasis,
        "sprints": deterministic_sprint_copy(sprints, topics_by_slug),
        "ai_generated": False,
    }


# ---------------------------------------------------------------------------
# Merge -- the model never gets to hand back something the scheduler can't use
# ---------------------------------------------------------------------------

def merge_emphasis(narrative: PlanNarrative, baseline: Dict[str, str]) -> Dict[str, str]:
    """Take the model's emphasis only for slugs that are actually in the plan and
    only for the three values the scheduler understands. Anything else keeps the
    deterministic baseline -- apply_emphasis would ignore a bad value anyway, but
    dropping it here keeps the stored plan honest about what was applied."""
    merged = dict(baseline)
    for item in narrative.emphasis or []:
        # `level` is already a Literal, so only an unknown slug can be wrong here.
        if item.slug in merged:
            merged[item.slug] = item.level
    return merged


def merge_sprint_copy(
    narrative: PlanNarrative,
    sprints: Sequence[Dict[str, Any]],
    topics_by_slug: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Map the model's copy onto the real sprints by position. Sprint composition can
    shift after emphasis is applied (a lighter topic may pull the next one forward), so
    any sprint the model did not cover falls back to a deterministic title."""
    fallback = {c["index"]: c for c in deterministic_sprint_copy(sprints, topics_by_slug)}
    from_model = list(narrative.sprints or [])

    merged: List[Dict[str, Any]] = []
    for position, sprint in enumerate(sprints):
        index = sprint["index"]
        written = from_model[position] if position < len(from_model) else None
        if written and written.title.strip():
            merged.append({
                "index": index,
                "title": written.title.strip(),
                "focus_line": (written.focus_line or "").strip(),
                "why_it_matters": (written.why_it_matters or "").strip(),
            })
        else:
            merged.append(fallback[index])
    return merged


# ---------------------------------------------------------------------------
# Gateway call
# ---------------------------------------------------------------------------

def build_messages(
    goal_label: str,
    sprints: Sequence[Dict[str, Any]],
    topics_by_slug: Dict[str, Dict[str, Any]],
    mastery_map: Dict[str, float],
    baseline: Dict[str, str],
    deadline: str,
    weekly_minutes: int,
) -> List[ChatMessage]:
    lines = [
        "Goal: " + goal_label,
        "Deadline: " + deadline,
        "Weekly budget: " + str(round(weekly_minutes / 60, 1)) + " hours",
        "",
        "Sprints (fixed):",
    ]
    for sprint in sprints:
        lines.append(
            "  Sprint " + str(sprint["index"]) + " (" + str(sprint["planned_minutes"]) + " min):"
        )
        for slug in sprint["topic_slugs"]:
            topic = topics_by_slug.get(slug, {})
            score = mastery_map.get(slug)
            mastery = "never quizzed" if score is None else "quiz average " + str(round(score)) + "%"
            lines.append(
                "    - " + slug + " | " + topic.get("title", slug)
                + " | " + mastery + " | baseline emphasis: " + baseline.get(slug, "normal")
            )

    return [
        ChatMessage(role="system", content=QPLANNER_SYSTEM_PROMPT),
        ChatMessage(role="user", content="\n".join(lines)),
    ]


async def generate_narrative(
    goal_label: str,
    sprints: Sequence[Dict[str, Any]],
    topics_by_slug: Dict[str, Dict[str, Any]],
    mastery_map: Dict[str, float],
    planned_slugs: Sequence[str],
    deadline: str,
    weekly_minutes: int,
    identity: Optional[str] = None,
    unquizzed: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Returns the narrative dict plus `ai_generated`, which the router stores on
    the plan so the UI can be honest about whether a model wrote this copy.

    Unlike every other gateway call in this codebase, failures are swallowed here
    rather than left to main.py's AIGatewayError -> 503 handler: a provider outage
    must cost the learner some prose, not their plan. That is the whole reason the
    deterministic layer above exists.
    """
    baseline = baseline_emphasis(planned_slugs, mastery_map, unquizzed)
    if not sprints:
        return deterministic_narrative(sprints, topics_by_slug, baseline)

    try:
        response = await ai_gateway.chat(
            messages=build_messages(
                goal_label, sprints, topics_by_slug, mastery_map,
                baseline, deadline, weekly_minutes,
            ),
            task=AITask.PLANNER,
            response_model=PlanNarrative,
            identity=identity,
        )
        narrative: PlanNarrative = response.parsed
    except Exception as exc:  # noqa: BLE001 - see docstring: a plan must outlive its prose
        print("[Qplanner] narrative generation failed, using deterministic copy: " + repr(exc))
        return deterministic_narrative(sprints, topics_by_slug, baseline)

    return {
        "strategy_note": (narrative.strategy_note or "").strip(),
        "personalized_tips": [
            tip.strip() for tip in (narrative.personalized_tips or []) if tip.strip()
        ][:MAX_TIPS],
        "emphasis": merge_emphasis(narrative, baseline),
        "sprints": merge_sprint_copy(narrative, sprints, topics_by_slug),
        "ai_generated": True,
    }
