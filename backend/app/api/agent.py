"""Natural-language data agent (local Ollama)."""

from __future__ import annotations

import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.api.deps import RegistryDep, SettingsDep
from app.models.api import AgentAskRequest
from app.services.agent import run_agent_ask_stream
from app.services.llm_models import validate_llm_model_override

router = APIRouter(prefix="/api", tags=["agent"])


@router.post("/agent/ask/stream")
def agent_ask_stream(
    body: AgentAskRequest,
    registry: RegistryDep,
    settings: SettingsDep,
):
    validate_llm_model_override(settings, body.model)

    def gen():
        for ev in run_agent_ask_stream(registry, settings, body):
            yield f"data: {json.dumps(ev)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
