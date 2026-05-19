"""Local LLM metadata endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import SettingsDep
from app.models.api import LlmModelsResponse
from app.services.llm_models import list_llm_models

router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.get("/models", response_model=LlmModelsResponse)
def llm_models(settings: SettingsDep) -> LlmModelsResponse:
    return list_llm_models(settings)
