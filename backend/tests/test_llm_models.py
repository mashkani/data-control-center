"""Tests for local Ollama model listing."""

from __future__ import annotations

from unittest.mock import MagicMock

import httpx
import pytest

from app.config import Settings
from app.models.api import LlmModelInfo, LlmModelsResponse
from app.services.llm_models import list_llm_models, validate_llm_model_override


def test_list_llm_models_reachable(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(llm_base_url="http://127.0.0.1:11434", llm_model="qwen3:4b")

    class FakeClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> FakeClient:
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def get(self, url: str) -> httpx.Response:
            assert url.endswith("/api/tags")
            return httpx.Response(
                200,
                json={
                    "models": [
                        {
                            "name": "qwen3:4b",
                            "modified_at": "2026-01-01T00:00:00Z",
                            "size": 123,
                        },
                        {"name": "llama3.2:3b"},
                    ]
                },
            )

    monkeypatch.setattr(httpx, "Client", FakeClient)
    out = list_llm_models(settings)
    assert out.reachable is True
    assert out.default_model == "qwen3:4b"
    assert [m.name for m in out.models] == ["qwen3:4b", "llama3.2:3b"]
    assert out.models[0].size == 123


def test_list_llm_models_request_error_is_sanitized(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(llm_model="qwen3:4b")

    class FakeClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> FakeClient:
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def get(self, url: str) -> httpx.Response:
            raise httpx.ConnectError("connection refused: /private/path/token", request=MagicMock())

    monkeypatch.setattr(httpx, "Client", FakeClient)
    out = list_llm_models(settings)
    assert out.reachable is False
    assert out.models == []
    assert out.detail == "Could not reach local LLM endpoint."


def test_list_llm_models_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(llm_model="qwen3:4b")

    class FakeClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> FakeClient:
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def get(self, url: str) -> httpx.Response:
            raise httpx.TimeoutException("timeout", request=MagicMock())

    monkeypatch.setattr(httpx, "Client", FakeClient)
    out = list_llm_models(settings)
    assert out.reachable is False
    assert out.detail == "Timed out waiting for local LLM."


def test_list_llm_models_non_200_and_invalid_json(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(llm_model="qwen3:4b")

    class ErrorClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> ErrorClient:
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def get(self, url: str) -> httpx.Response:
            return httpx.Response(502, json={"error": "upstream failed"})

    monkeypatch.setattr(httpx, "Client", ErrorClient)
    out = list_llm_models(settings)
    assert out.reachable is False
    assert out.detail == "upstream failed"

    class BadJsonClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> BadJsonClient:
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def get(self, url: str) -> httpx.Response:
            return httpx.Response(200, text="not json")

    monkeypatch.setattr(httpx, "Client", BadJsonClient)
    out = list_llm_models(settings)
    assert out.reachable is False
    assert out.detail == "Local LLM returned an invalid model list."


def test_list_llm_models_skips_invalid_items(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(llm_model="qwen3:4b")

    class FakeClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> FakeClient:
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def get(self, url: str) -> httpx.Response:
            return httpx.Response(
                200,
                json={"models": [None, {"name": ""}, {"name": " qwen3:4b ", "size": "bad"}]},
            )

    monkeypatch.setattr(httpx, "Client", FakeClient)
    out = list_llm_models(settings)
    assert [m.name for m in out.models] == ["qwen3:4b"]
    assert out.models[0].size is None


def test_validate_llm_model_override_rejects_unknown_when_reachable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(llm_model="qwen3:4b")

    class FakeClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> FakeClient:
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def get(self, url: str) -> httpx.Response:
            return httpx.Response(200, json={"models": [{"name": "qwen3:4b"}]})

    monkeypatch.setattr(httpx, "Client", FakeClient)
    with pytest.raises(Exception) as exc:
        validate_llm_model_override(settings, "missing:model")
    assert "not installed" in str(exc.value)


def test_validate_llm_model_override_uses_default_without_listing() -> None:
    settings = Settings(llm_model="qwen3:4b")
    assert validate_llm_model_override(settings, None) == "qwen3:4b"
    assert validate_llm_model_override(settings, "qwen3:4b") == "qwen3:4b"


def test_validate_llm_model_override_accepts_installed_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(llm_model="qwen3:4b")

    class FakeClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> FakeClient:
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def get(self, url: str) -> httpx.Response:
            return httpx.Response(200, json={"models": [{"name": "llama3.2:3b"}]})

    monkeypatch.setattr(httpx, "Client", FakeClient)
    assert validate_llm_model_override(settings, "llama3.2:3b") == "llama3.2:3b"


def test_validate_llm_model_override_allows_unknown_when_unreachable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(llm_model="qwen3:4b")

    class FakeClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

        def __enter__(self) -> FakeClient:
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def get(self, url: str) -> httpx.Response:
            raise httpx.ConnectError("nope", request=MagicMock())

    monkeypatch.setattr(httpx, "Client", FakeClient)
    assert validate_llm_model_override(settings, "llama3.2:3b") == "llama3.2:3b"


def test_llm_models_http_endpoint(client, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.api.llm.list_llm_models",
        lambda settings: LlmModelsResponse(
            default_model="qwen3:4b",
            models=[LlmModelInfo(name="qwen3:4b")],
            reachable=True,
            detail=None,
        ),
    )
    r = client.get("/api/llm/models")
    assert r.status_code == 200
    assert r.json()["models"][0]["name"] == "qwen3:4b"
