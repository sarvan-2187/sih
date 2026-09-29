"""Every roadmap topic must have multiple-choice questions, or its sprint quiz and practice
quiz fail with "No quiz questions exist yet for this sprint's topics" (seen 2026-09-29).

Run: python -m pytest tests/test_quiz_coverage.py -v
"""
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.quiz_seed import SEED_QUESTIONS
from services.roadmap_seed import SEED_TOPICS

# The failure condition is zero: the sprint quiz takes multiple choice only. Several original
# topics still have just 1-2 MCQs -- thin, but not broken.
MIN_MCQ_PER_TOPIC = 1


def _mcq_count_by_topic():
    counts = Counter()
    for question in SEED_QUESTIONS:
        if question.get("type") != "mcq":
            continue
        for slug in {question["topic_slug"], *(question.get("tags") or [])}:
            counts[slug] += 1
    return counts


def test_every_roadmap_topic_has_enough_multiple_choice_questions():
    counts = _mcq_count_by_topic()
    short = {t["slug"]: counts[t["slug"]] for t in SEED_TOPICS if counts[t["slug"]] < MIN_MCQ_PER_TOPIC}
    assert not short, f"topics with fewer than {MIN_MCQ_PER_TOPIC} MCQs: {short}"


def test_correct_answer_is_always_one_of_the_options():
    for question in SEED_QUESTIONS:
        if question.get("type") != "mcq":
            continue
        ids = [option["id"] for option in question["options"]]
        assert question["correct_answer"] in ids, question["prompt"]
        assert len(ids) == len(set(ids)), question["prompt"]


def test_no_duplicate_prompts_within_a_topic():
    # the seeder upserts on (prompt, topic_slug), so a duplicate would silently overwrite
    keys = [(q["prompt"], q["topic_slug"]) for q in SEED_QUESTIONS]
    duplicates = [key for key, n in Counter(keys).items() if n > 1]
    assert not duplicates, duplicates
