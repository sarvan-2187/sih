"""Normalized types shared by every provider adapter and the gateway itself.

Nothing outside `ai/` should ever need a provider SDK's own request/response
types — everything crossing the gateway boundary is one of these.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Literal, NamedTuple, Optional

from pydantic import BaseModel, Field


class AITask(str, Enum):
    """Workload categories used to pick a routing policy (see config.py).

    Not every task has a live caller yet (CODE has no dedicated feature today;
    MANIM doesn't exist yet — see PLANS/qstudio-animation.md) but routing for
    them is defined now so adding the feature later is a call-site change, not
    a gateway change.
    """
    CHAT = "chat"
    RAG = "rag"
    REASONING = "reasoning"
    CODE = "code"
    SUMMARIZATION = "summarization"
    QUIZ = "quiz"
    FLASHCARDS = "flashcards"
    MINDMAP = "mindmap"
    BRIEFING = "briefing"
    STUDY_GUIDE = "study_guide"
    BLOG_POST = "blog_post"
    QCOMPARE = "qcompare"
    VIDEO_SCRIPT = "video_script"
    AUDIO_SCRIPT = "audio_script"
    SLIDES = "slides"
    MANIM = "manim"
    PLANNER = "planner"


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class RouteTarget(NamedTuple):
    """One entry in a resolved provider chain — `model=None` means "use that
    provider's own configured default model" (see config.py's
    TASK_MODEL_OVERRIDE)."""
    provider: str
    model: Optional[str] = None


class AIResponse(BaseModel):
    content: str
    provider: str
    model: str

    latency_ms: Optional[float] = None

    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    total_tokens: Optional[int] = None

    cached: bool = False
    fallback_used: bool = False
    retry_count: int = 0

    # Populated only when `chat()` was called with `response_model=...` and the
    # provider's output validated successfully against it. `content` still
    # holds the raw text either way, so callers that don't care about
    # structured parsing keep working unchanged.
    parsed: Optional[BaseModel] = None

    model_config = {"arbitrary_types_allowed": True}


class StreamChunk(BaseModel):
    delta: str
    provider: str
    model: str
    done: bool = False


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class ProviderHealth(BaseModel):
    configured: bool
    available: bool
    circuit: CircuitState
    consecutive_failures: int = 0


class GatewayHealth(BaseModel):
    gateway: Literal["healthy", "degraded", "unavailable"]
    providers: dict[str, ProviderHealth]


class UsageRecord(BaseModel):
    """One row per gateway call — see ai/usage.py. Kept flat/JSON-friendly so it
    drops into MongoDB (the `ai_usage` collection) without a custom encoder."""
    request_id: str
    task: str
    provider: str
    model: str
    status: Literal["success", "failure"]
    latency_ms: float
    retry_count: int
    fallback_used: bool
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    error_type: Optional[str] = None
    timestamp: Any = None  # datetime, set by usage.py at insert time
