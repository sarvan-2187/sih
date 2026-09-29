"""Gemini's OpenAI-compatible endpoint rejects tool schemas that use `$ref` into `$defs`
(400 INVALID_ARGUMENT, seen 2026-09-29 on QStudio's mind map), which is how Pydantic writes
any nested model. GeminiProvider inlines the references; these pin that behaviour.

Run: python -m pytest tests/test_gemini_schema.py -v
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai.providers.gemini import SCHEMA_MAX_RECURSION, inline_schema_refs
from models.qstudio import FlashcardsResult, MindMapResult
from services.qplanner_ai import PlanNarrative


def _has_ref(schema) -> bool:
    text = json.dumps(schema)
    return '"$ref"' in text or '"$defs"' in text


def test_every_nested_schema_we_send_ends_up_ref_free():
    for model in (MindMapResult, FlashcardsResult, PlanNarrative):
        assert _has_ref(model.model_json_schema()), f"{model.__name__} should start with $refs"
        assert not _has_ref(inline_schema_refs(model.model_json_schema())), model.__name__


def test_non_recursive_nesting_is_inlined_in_full():
    schema = inline_schema_refs(PlanNarrative.model_json_schema())
    level = schema["properties"]["emphasis"]["items"]["properties"]["level"]
    assert level["enum"] == ["light", "normal", "deep"], "inlining must keep the enum Gemini enforces"
    assert "title" in schema["properties"]["sprints"]["items"]["properties"]


def test_recursive_mind_map_is_unrolled_to_a_bounded_depth():
    schema = inline_schema_refs(MindMapResult.model_json_schema())

    def first_node(node):
        """The outermost object that has a `children` array."""
        if isinstance(node, dict):
            if "children" in node.get("properties", {}):
                return node
            for value in node.values():
                found = first_node(value)
                if found:
                    return found
        return None

    node = first_node(schema)
    depth = 0
    while node is not None and "children" in node.get("properties", {}):
        depth += 1
        node = node["properties"]["children"]["items"]
    assert depth == SCHEMA_MAX_RECURSION
    assert node == {"type": "object"}, "past the limit the node is a bare object, not a dangling $ref"


def test_input_schema_is_not_mutated():
    original = MindMapResult.model_json_schema()
    snapshot = json.dumps(original, sort_keys=True)
    inline_schema_refs(original)
    assert json.dumps(original, sort_keys=True) == snapshot
