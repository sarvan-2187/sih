"""Central, env-driven configuration for the AI Gateway.

Nothing here is a secret by accident: `ProviderConfig.api_key` is read from
env at process start and never logged (see gateway.py/registry.py — log
statements print provider *names*, never `config.api_key`). If a provider's
key is absent, `ProviderConfig.enabled` is False and registry.py simply
skips it — the application must still start (see §8 of the task spec).

Model IDs below are best-effort current defaults (Groq's were confirmed live
against https://api.groq.com/openai/v1/models on 2026-07-26; Gemini/Mistral/
NVIDIA/Kimi/Z.AI defaults are documented-stable model families as of this
writing, not independently re-verified against each provider's own live
catalog). Every one is overridable via env — see .env.example — because
provider catalogs change faster than this file will.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional

from dotenv import load_dotenv

from ai.models import AITask

# Same independently-redundant load_dotenv() call every other service module
# in this repo makes (database.py, groq_service.py, storage_service.py) —
# safe to call more than once per process, and means `ai/` never silently
# depends on import order elsewhere to see its own env vars.
load_dotenv()


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    return float(raw) if raw else default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    return int(raw) if raw else default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [p.strip() for p in raw.split(",") if p.strip()]


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_key: Optional[str]
    base_url: str
    default_model: str
    enabled: bool = field(init=False)

    def __post_init__(self):
        object.__setattr__(self, "enabled", bool(self.api_key))


def _provider_config(name: str, key_env: str, base_url: str, model_env: str, default_model: str) -> ProviderConfig:
    return ProviderConfig(
        name=name,
        api_key=os.getenv(key_env) or None,
        base_url=os.getenv(f"{name.upper()}_BASE_URL", base_url),
        default_model=os.getenv(model_env, default_model),
    )


def load_provider_configs() -> dict[str, ProviderConfig]:
    """Rebuilt from current env on every call (cheap, a handful of dicts) so
    tests can monkeypatch os.environ without needing a reload/restart."""
    configs = {
        "groq": _provider_config(
            "groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1",
            "GROQ_MODEL", "openai/gpt-oss-120b",
        ),
        "gemini": _provider_config(
            "gemini", "GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai",
            "GEMINI_MODEL", "gemini-2.5-flash",
        ),
        "mistral": _provider_config(
            "mistral", "MISTRAL_API_KEY", "https://api.mistral.ai/v1",
            "MISTRAL_MODEL", "mistral-small-latest",
        ),
        "nvidia": _provider_config(
            "nvidia", "NVIDIA_API_KEY", "https://integrate.api.nvidia.com/v1",
            "NVIDIA_MODEL", "meta/llama-3.3-70b-instruct",
        ),
        "kimi": _provider_config(
            "kimi", "KIMI_API_KEY", "https://api.moonshot.ai/v1",
            "KIMI_MODEL", "kimi-k2-turbo-preview",
        ),
        "zai": _provider_config(
            "zai", "Z_API_KEY", "https://api.z.ai/api/paas/v4",
            "ZAI_MODEL", "glm-4.6",
        ),
    }
    if _env_bool("VLLM_ENABLED", False):
        vllm_base_url = os.getenv("VLLM_BASE_URL")
        if vllm_base_url:
            configs["vllm"] = ProviderConfig(
                name="vllm",
                # vLLM's OpenAI-compatible server accepts any bearer token (often
                # unchecked) — treat it as present-but-optional, not a hard
                # requirement for `enabled`, since a self-hosted deployment may
                # not gate on a key at all.
                api_key=os.getenv("VLLM_API_KEY") or "not-required",
                base_url=vllm_base_url,
                default_model=os.getenv("VLLM_MODEL", ""),
            )
    return configs


# --------------------------------------------------------------------------
# Routing policy
# --------------------------------------------------------------------------

DEFAULT_PROVIDER_PRIORITY = _env_list(
    "AI_PROVIDER_PRIORITY", ["groq", "gemini", "mistral", "nvidia", "kimi", "zai"]
)

# Per-task provider ORDER override. Tasks not listed here fall back to
# DEFAULT_PROVIDER_PRIORITY. Reasoning, per the research in
# PLANS/ai-provider-resilience.md: Groq stays first everywhere it's
# competitive (fastest, cheapest, already proven in this codebase) — the
# override here is which provider leads for tasks Groq's catalog is a weaker
# fit for.
#
# MANIM deliberately does NOT lead with Kimi (removed after a live
# side-by-side test, see PLANS/qstudio-animation.md §0/§8): every Kimi call
# failed on account billing ("org ... suspended due to insufficient
# balance"), so Kimi's actual capability for this task is untested, not
# confirmed good. Groq (gpt-oss-120b) handled the same structured-output
# call correctly in 3 of 4 live attempts (one malformed-nesting failure,
# which `AIGateway._attempt_with_repair`'s repair-retry now catches — see
# that method's comment). MANIM's actual LLM call is JSON block-sequencing,
# not code generation, so it behaves like SLIDES/BRIEFING, not CODE — falls
# through to DEFAULT_PROVIDER_PRIORITY (Groq-first) rather than getting its
# own entry here. Revisit once Kimi's billing is fixed and it can actually
# be tested.
#
# CODE's own order was later set explicitly once it got a real caller
# (QPilot, qBook's per-cell AI assistant, backend/routers/qbook_router.py —
# see PLANS/qbook-qpilot.md): Mistral first, then Groq, remaining providers
# kept in their prior relative order.
TASK_PROVIDER_ORDER: dict[AITask, list[str]] = {
    AITask.CODE: ["mistral", "groq", "kimi", "gemini", "nvidia", "zai"],
    AITask.REASONING: ["groq", "gemini", "mistral", "nvidia", "kimi", "zai"],
}

# Per-(task, provider) model override — lets a task ask a provider for a
# different model than that provider's own default without maintaining a
# full task x provider matrix. Absent entries just use the provider's
# configured default_model.
TASK_MODEL_OVERRIDE: dict[tuple[AITask, str], str] = {
    (AITask.CHAT, "groq"): "openai/gpt-oss-20b",
    (AITask.QUIZ, "groq"): "openai/gpt-oss-20b",
    (AITask.FLASHCARDS, "groq"): "openai/gpt-oss-20b",
    (AITask.SUMMARIZATION, "groq"): "openai/gpt-oss-20b",
    (AITask.MINDMAP, "groq"): "openai/gpt-oss-20b",
    (AITask.REASONING, "groq"): "openai/gpt-oss-120b",
    (AITask.BRIEFING, "groq"): "openai/gpt-oss-120b",
    (AITask.STUDY_GUIDE, "groq"): "openai/gpt-oss-120b",
    (AITask.BLOG_POST, "groq"): "openai/gpt-oss-120b",
    (AITask.QCOMPARE, "groq"): "openai/gpt-oss-120b",
    (AITask.VIDEO_SCRIPT, "groq"): "openai/gpt-oss-120b",
    (AITask.AUDIO_SCRIPT, "groq"): "openai/gpt-oss-120b",
    (AITask.SLIDES, "groq"): "openai/gpt-oss-120b",
    (AITask.PLANNER, "groq"): "openai/gpt-oss-120b",
}

# --------------------------------------------------------------------------
# Resilience / timeouts
# --------------------------------------------------------------------------

AI_REQUEST_TIMEOUT_SECONDS = _env_float("AI_REQUEST_TIMEOUT_SECONDS", 30.0)
AI_CONNECT_TIMEOUT_SECONDS = _env_float("AI_CONNECT_TIMEOUT_SECONDS", 10.0)

AI_MAX_PROVIDER_RETRIES = _env_int("AI_MAX_PROVIDER_RETRIES", 2)
AI_RETRY_BASE_DELAY_SECONDS = _env_float("AI_RETRY_BASE_DELAY_SECONDS", 0.5)
AI_RETRY_MAX_DELAY_SECONDS = _env_float("AI_RETRY_MAX_DELAY_SECONDS", 8.0)

AI_CIRCUIT_FAILURE_THRESHOLD = _env_int("AI_CIRCUIT_FAILURE_THRESHOLD", 5)
AI_CIRCUIT_COOLDOWN_SECONDS = _env_float("AI_CIRCUIT_COOLDOWN_SECONDS", 60.0)

AI_GATEWAY_ENABLED = _env_bool("AI_GATEWAY_ENABLED", True)

# Structured-output repair retry (a generation that returned invalid
# JSON/schema mismatch gets one corrective follow-up before being counted as
# a real failure) — same one-retry philosophy already proven in
# qstudio_service/pipeline.py::_generate_slide_script, generalized here so
# every provider/task gets it instead of it being hand-rolled per call site.
AI_STRUCTURED_OUTPUT_REPAIR_RETRIES = _env_int("AI_STRUCTURED_OUTPUT_REPAIR_RETRIES", 1)

# --------------------------------------------------------------------------
# Application-level rate limiting (ai/rate_limit.py) — OFF by default per the
# task spec's "do not introduce arbitrary restrictive quotas unless
# configurable." Turning this on only takes effect for callers that pass an
# `identity` into ai_gateway.chat(...); callers that don't are simply never
# rate-limited (no identity to key on), same as today.
# --------------------------------------------------------------------------

AI_RATE_LIMIT_ENABLED = _env_bool("AI_RATE_LIMIT_ENABLED", False)
AI_RATE_LIMIT_PER_USER_PER_MINUTE = _env_int("AI_RATE_LIMIT_PER_USER_PER_MINUTE", 20)
AI_RATE_LIMIT_EXPENSIVE_PER_DAY = _env_int("AI_RATE_LIMIT_EXPENSIVE_PER_DAY", 50)

# Tasks expensive enough to warrant the daily cap above, on top of the
# per-minute cap every task gets.
AI_RATE_LIMIT_EXPENSIVE_TASKS = frozenset({
    AITask.REASONING.value, AITask.CODE.value, AITask.MANIM.value,
    AITask.VIDEO_SCRIPT.value, AITask.AUDIO_SCRIPT.value, AITask.SLIDES.value,
})
