"""List and validate local Ollama models."""

from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings
from app.errors import CODES, AppError
from app.models.api import LlmModelInfo, LlmModelsResponse
from app.services.ollama_http import parse_ollama_error_detail

_TAGS_PATH = "/api/tags"
_MODEL_LIST_TIMEOUT_SEC = 2.0


def list_llm_models(settings: Settings) -> LlmModelsResponse:
    """Return locally installed Ollama models, with sanitized failure details."""
    base = settings.llm_base_url.rstrip("/")
    timeout = httpx.Timeout(_MODEL_LIST_TIMEOUT_SEC)
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.get(f"{base}{_TAGS_PATH}")
    except httpx.TimeoutException:
        return LlmModelsResponse(
            default_model=settings.llm_model,
            models=[],
            reachable=False,
            detail="Timed out waiting for local LLM.",
        )
    except httpx.RequestError:
        return LlmModelsResponse(
            default_model=settings.llm_model,
            models=[],
            reachable=False,
            detail="Could not reach local LLM endpoint.",
        )

    if response.status_code != 200:
        return LlmModelsResponse(
            default_model=settings.llm_model,
            models=[],
            reachable=False,
            detail=parse_ollama_error_detail(response) or f"HTTP {response.status_code}",
        )

    try:
        payload: Any = response.json()
    except ValueError:
        return LlmModelsResponse(
            default_model=settings.llm_model,
            models=[],
            reachable=False,
            detail="Local LLM returned an invalid model list.",
        )

    raw_models = payload.get("models") if isinstance(payload, dict) else None
    models: list[LlmModelInfo] = []
    if isinstance(raw_models, list):
        for item in raw_models:
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            if not isinstance(name, str) or not name.strip():
                continue
            modified_at = item.get("modified_at")
            size = item.get("size")
            models.append(
                LlmModelInfo(
                    name=name.strip(),
                    modified_at=modified_at if isinstance(modified_at, str) else None,
                    size=size if isinstance(size, int) else None,
                )
            )

    return LlmModelsResponse(
        default_model=settings.llm_model,
        models=models,
        reachable=True,
        detail=None,
    )


def effective_llm_model(settings: Settings, requested_model: str | None) -> str:
    model = (requested_model or "").strip()
    return model or settings.llm_model


def validate_llm_model_override(settings: Settings, requested_model: str | None) -> str:
    """
    Validate a user-selected model only when local Ollama can list installed models.

    The configured default is allowed through even if it is not in /api/tags so the
    existing model-not-found hint remains available for default configuration issues.
    """
    model = effective_llm_model(settings, requested_model)
    if not requested_model or model == settings.llm_model:
        return model

    listing = list_llm_models(settings)
    if not listing.reachable:
        return model

    installed = {m.name for m in listing.models}
    if model not in installed:
        raise AppError(
            status_code=400,
            code=CODES.BAD_REQUEST,
            message=f"Selected Ollama model is not installed: {model}",
            details={"model": model},
        )
    return model
