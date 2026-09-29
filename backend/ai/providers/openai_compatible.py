"""One adapter for every provider that speaks the OpenAI chat/completions
wire format. Groq, Gemini (via its documented /v1beta/openai compat layer),
Mistral, NVIDIA NIM, Kimi/Moonshot, and Z.AI's GLM API all do — verified
against each provider's own docs, not assumed (see docs/AI_GATEWAY.md). A
future self-hosted vLLM server is OpenAI-compatible by design too, so it
subclasses this directly as well (providers/vllm.py).

This is the one place request/response/error-mapping logic for all six+
providers lives — per-provider files under providers/ are pure configuration
(base_url, default model, display name), not duplicated logic.
"""
from __future__ import annotations

import json
import time
import uuid
from typing import AsyncIterator, Optional, Type

import openai
from pydantic import BaseModel, ValidationError

from ai.exceptions import (
    AIAuthenticationError,
    AIInvalidRequestError,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
    AIUnavailableError,
)
from ai.models import AIResponse, ChatMessage, StreamChunk

_STRUCTURED_OUTPUT_TOOL_NAME = "emit_result"


class OpenAICompatibleProvider:
    def __init__(
        self,
        name: str,
        api_key: str,
        base_url: str,
        default_model: str,
        request_timeout: float = 30.0,
        connect_timeout: float = 10.0,
    ):
        self._name = name
        self._default_model = default_model
        # max_retries=0: retry/backoff is owned centrally by
        # ai/resilience/retry.py so the circuit breaker sees every real
        # attempt — the SDK's own built-in retry would otherwise hide
        # failures from it.
        self._client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=openai.Timeout(request_timeout, connect=connect_timeout),
            max_retries=0,
        )

    @property
    def name(self) -> str:
        return self._name

    def _resolve_model(self, model: Optional[str]) -> str:
        return model or self._default_model

    @staticmethod
    def _to_openai_messages(messages: list[ChatMessage]) -> list[dict]:
        return [{"role": m.role, "content": m.content} for m in messages]

    def _map_error(self, exc: Exception) -> AIProviderError:
        if isinstance(exc, openai.RateLimitError):
            return AIRateLimitError(str(exc), self._name)
        if isinstance(exc, openai.AuthenticationError):
            return AIAuthenticationError(str(exc), self._name)
        if isinstance(exc, openai.PermissionDeniedError):
            return AIAuthenticationError(str(exc), self._name)
        if isinstance(exc, openai.APITimeoutError):
            return AITimeoutError(str(exc), self._name)
        if isinstance(exc, openai.NotFoundError):
            # Almost always an unknown/misconfigured model id for THIS
            # provider — another provider's own default model is unaffected,
            # so this is worth retrying against the chain rather than failing
            # the whole request outright.
            return AIInvalidRequestError(str(exc), self._name, retryable=True)
        if isinstance(exc, openai.BadRequestError):
            return AIInvalidRequestError(str(exc), self._name, retryable=False)
        if isinstance(exc, (openai.APIConnectionError, openai.InternalServerError, openai.APIStatusError)):
            return AIUnavailableError(str(exc), self._name)
        return AIUnavailableError(f"unmapped error: {exc}", self._name)

    def _tool_parameters(self, response_model) -> dict:
        """JSON Schema sent as the structured-output tool's parameters. Overridden by
        providers whose endpoint rejects parts of Pydantic's schema output (Gemini)."""
        return response_model.model_json_schema()

    async def chat(
        self,
        messages: list[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.4,
        max_tokens: Optional[int] = None,
        response_model: Optional[Type[BaseModel]] = None,
    ) -> AIResponse:
        resolved_model = self._resolve_model(model)
        kwargs: dict = {
            "model": resolved_model,
            "messages": self._to_openai_messages(messages),
            "temperature": temperature,
        }
        if max_tokens:
            kwargs["max_tokens"] = max_tokens

        tool_schema = None
        if response_model is not None:
            tool_schema = {
                "type": "function",
                "function": {
                    "name": _STRUCTURED_OUTPUT_TOOL_NAME,
                    "description": f"Emit the result as {response_model.__name__}.",
                    "parameters": self._tool_parameters(response_model),
                },
            }
            kwargs["tools"] = [tool_schema]
            kwargs["tool_choice"] = {"type": "function", "function": {"name": _STRUCTURED_OUTPUT_TOOL_NAME}}

        start = time.monotonic()
        try:
            completion = await self._client.chat.completions.create(**kwargs)
        except openai.APIError as exc:
            raise self._map_error(exc) from exc
        latency_ms = (time.monotonic() - start) * 1000

        choice = completion.choices[0]
        content = choice.message.content or ""
        parsed: Optional[BaseModel] = None

        if response_model is not None:
            parsed = self._extract_structured(choice, content, response_model)

        usage = completion.usage
        return AIResponse(
            content=content,
            provider=self._name,
            model=resolved_model,
            latency_ms=latency_ms,
            input_tokens=getattr(usage, "prompt_tokens", None) if usage else None,
            output_tokens=getattr(usage, "completion_tokens", None) if usage else None,
            total_tokens=getattr(usage, "total_tokens", None) if usage else None,
            parsed=parsed,
        )

    def _extract_structured(self, choice, content: str, response_model: Type[BaseModel]) -> BaseModel:
        """Providers are supposed to honor a forced `tool_choice`, but not
        every OpenAI-compatible backend is equally strict about it — this
        falls back to parsing `content` as raw JSON so a provider that
        answered in prose instead of a tool call still has a chance to
        validate. Either path failing raises AIInvalidRequestError, which
        the gateway's structured-output repair retry (config.py's
        AI_STRUCTURED_OUTPUT_REPAIR_RETRIES) catches and re-prompts against."""
        raw_args = None
        tool_calls = getattr(choice.message, "tool_calls", None)
        if tool_calls:
            raw_args = tool_calls[0].function.arguments
        else:
            raw_args = content

        try:
            data = json.loads(raw_args)
            return response_model.model_validate(data)
        except (json.JSONDecodeError, ValidationError, TypeError) as exc:
            raise AIInvalidRequestError(
                f"structured output did not validate against {response_model.__name__}: {exc}",
                self._name,
                retryable=False,
            ) from exc

    async def stream(
        self,
        messages: list[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.4,
        max_tokens: Optional[int] = None,
    ) -> AsyncIterator[StreamChunk]:
        resolved_model = self._resolve_model(model)
        kwargs: dict = {
            "model": resolved_model,
            "messages": self._to_openai_messages(messages),
            "temperature": temperature,
            "stream": True,
        }
        if max_tokens:
            kwargs["max_tokens"] = max_tokens

        try:
            stream = await self._client.chat.completions.create(**kwargs)
            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta.content or ""
                finished = chunk.choices[0].finish_reason is not None
                if delta or finished:
                    yield StreamChunk(delta=delta, provider=self._name, model=resolved_model, done=finished)
        except openai.APIError as exc:
            raise self._map_error(exc) from exc

    async def health_check(self) -> bool:
        """Best-effort reachability probe via GET /models — cheap (no tokens
        billed) on every provider tested against (Groq confirmed directly).
        Some OpenAI-compatible backends don't implement /models faithfully;
        a failure here degrades the reported health but never blocks actual
        chat() calls, which have their own independent failure handling."""
        try:
            await self._client.models.list()
            return True
        except Exception:
            return False
