from ai.config import ProviderConfig
import copy

from ai.providers.openai_compatible import OpenAICompatibleProvider

# How many times one model may nest inside itself before the inlined schema stops
# (a mind map's root -> children -> grandchildren is 3). Only self-referencing models
# ever reach this; ordinary nested models are always inlined in full.
SCHEMA_MAX_RECURSION = 3


def inline_schema_refs(schema: dict, max_recursion: int = SCHEMA_MAX_RECURSION) -> dict:
    """Replace every `$ref` with the definition it points to and drop `$defs`.

    Gemini's OpenAI-compatible endpoint answers 400 INVALID_ARGUMENT for tool schemas
    that use `$ref` into `$defs`, which is how Pydantic writes ANY nested model (seen
    2026-09-29 on QStudio's mind map). Self-referencing models such as MindMapNode are
    unrolled `max_recursion` levels deep; past that the node is left as a bare object,
    which Pydantic still validates on the way back.
    """
    defs = schema.get("$defs", {})

    def walk(node, used: dict):
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/$defs/"):
                name = ref.rsplit("/", 1)[-1]
                depth = used.get(name, 0)
                if depth >= max_recursion or name not in defs:
                    return {"type": "object"}
                return walk(defs[name], {**used, name: depth + 1})
            return {key: walk(value, used) for key, value in node.items() if key != "$defs"}
        if isinstance(node, list):
            return [walk(item, used) for item in node]
        return node

    return walk(copy.deepcopy(schema), {})



class GeminiProvider(OpenAICompatibleProvider):
    """Google's documented OpenAI-compatibility layer
    (https://ai.google.dev/gemini-api/docs/openai) at
    generativelanguage.googleapis.com/v1beta/openai — NOT the native Gemini
    endpoint (which uses a different request shape entirely). Chosen instead
    of the google-genai SDK specifically so Gemini can share
    OpenAICompatibleProvider's request/error-mapping logic with every other
    provider rather than needing its own bespoke adapter."""

    def _tool_parameters(self, response_model) -> dict:
        return inline_schema_refs(response_model.model_json_schema())

    def __init__(self, config: ProviderConfig, request_timeout: float, connect_timeout: float):
        super().__init__(
            name="gemini",
            api_key=config.api_key,
            base_url=config.base_url,
            default_model=config.default_model,
            request_timeout=request_timeout,
            connect_timeout=connect_timeout,
        )
