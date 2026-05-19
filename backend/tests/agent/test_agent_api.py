"""Agent HTTP route tests."""


def test_agent_ask_stream_http_endpoint(client, monkeypatch) -> None:
    def fake_stream(r, s, b):  # noqa: ANN001
        yield {"type": "answer", "data": {"answer": "ok"}}
        yield {"type": "done", "data": {}}

    monkeypatch.setattr("app.api.agent.run_agent_ask_stream", fake_stream)
    r = client.post("/api/agent/ask/stream", json={"question": "hello"})
    assert r.status_code == 200
    assert "data:" in r.text
    assert '"answer"' in r.text


def test_agent_ask_stream_rejects_unknown_installed_model(client, monkeypatch) -> None:
    def fail_stream(r, s, b):  # noqa: ANN001
        raise AssertionError("stream should not start")

    monkeypatch.setattr("app.api.agent.run_agent_ask_stream", fail_stream)
    monkeypatch.setattr(
        "app.api.agent.list_llm_models",
        lambda settings: None,
        raising=False,
    )

    from app.models.api import LlmModelsResponse

    monkeypatch.setattr(
        "app.services.llm_models.list_llm_models",
        lambda settings: LlmModelsResponse(
            default_model="qwen3:4b",
            models=[],
            reachable=True,
            detail=None,
        ),
    )
    r = client.post("/api/agent/ask/stream", json={"question": "hello", "model": "missing:model"})
    assert r.status_code == 400
    assert "not installed" in r.text
