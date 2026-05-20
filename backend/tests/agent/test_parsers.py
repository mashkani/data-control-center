"""Agent tests."""

from __future__ import annotations

from app.models.api import AgentAskRequest, AgentSqlDraft, QueryResult
from app.services.agent import (
    _default_answer,
    _empty_result_retry_prompt,
    _result_preview_for_summary,
    _should_retry_empty_result,
    _sql_retry_prompt,
    _summary_messages,
    parse_sql_draft,
    parse_summary_answer,
)

def test_parse_sql_draft_ok() -> None:
    d, err = parse_sql_draft('{"sql":"SELECT 1","explanation":"x"}')
    assert err is None
    assert d and d.sql == "SELECT 1"


def test_parse_sql_draft_extracts_wrapped_json() -> None:
    d, err = parse_sql_draft(
        '<think>skip this</think>\n{"sql":"SELECT 1","explanation":"x"}'
    )
    assert err is None
    assert d and d.sql == "SELECT 1"


def test_parse_sql_draft_bad_json() -> None:
    d, err = parse_sql_draft("not-json")
    assert d is None
    assert err and "json" in err.lower()


def test_parse_sql_draft_empty_response() -> None:
    d, err = parse_sql_draft("")
    assert d is None
    assert err and "empty response" in err


def test_parse_sql_draft_not_object() -> None:
    d, err = parse_sql_draft('"string"')
    assert d is None
    assert err and "object" in err.lower()


def test_parse_sql_draft_validation_error() -> None:
    d, err = parse_sql_draft('{"sql":1}')
    assert d is None
    assert err and "Invalid SQL draft" in err


def test_parse_summary_answer_ok() -> None:
    a, err = parse_summary_answer('{"answer":"hello"}')
    assert err is None
    assert a == "hello"


def test_parse_summary_answer_extracts_wrapped_json() -> None:
    a, err = parse_summary_answer('text before {"answer":"hello"}')
    assert err is None
    assert a == "hello"


def test_parse_summary_answer_bad() -> None:
    a, err = parse_summary_answer("{}")
    assert a is None
    assert err


def test_parse_summary_answer_not_object() -> None:
    a, err = parse_summary_answer("[1]")
    assert a is None
    assert err and "object" in err.lower()


def test_result_preview_for_summary_truncates() -> None:
    big = {"x": "y" * 5000}
    s = _result_preview_for_summary(big, max_chars=50)
    assert "truncated" in s
    assert len(s) <= 50


def test_summary_messages_request_direct_answer_without_sql_process() -> None:
    messages = _summary_messages(
        AgentAskRequest(question="Who is the highest rated player?"),
        (
            '{"columns":[{"name":"player_name"},{"name":"overall"}],'
            '"rows":[{"player_name":"Robert Lewandowski","overall":92}]}'
        ),
    )
    system = messages[0]["content"]
    user = messages[1]["content"]
    assert "directly" in system
    assert "the query selects" in system
    assert "SQL used" in system
    assert "SQL used" not in user
    assert "SELECT" not in user


def test_default_answer_compacts_empty_one_row_and_multi_row_results() -> None:
    draft = AgentSqlDraft(sql="SELECT 1", explanation="verbose process")

    empty = QueryResult(columns=[], rows=[], row_count=0, truncated=False, error=None)
    assert _default_answer(draft, empty) == "No matching rows were found."

    one = QueryResult(
        columns=[],
        rows=[{"player_name": "Robert Lewandowski", "overall": 92}],
        row_count=1,
        truncated=False,
        error=None,
    )
    assert _default_answer(draft, one) == "player_name: Robert Lewandowski; overall: 92."

    many = QueryResult(
        columns=[],
        rows=[{"region": "West", "revenue": 100}, {"region": "East", "revenue": 80}],
        row_count=2,
        truncated=False,
        error=None,
    )
    assert _default_answer(draft, many) == "Found 2 rows. First result: region: West; revenue: 100."

    typed = QueryResult(
        columns=[],
        rows=[{"active": True, "note": None, "label": False}],
        row_count=1,
        truncated=False,
        error=None,
    )
    assert _default_answer(draft, typed) == "active: true; note: null; label: false."

    blank_row = QueryResult(
        columns=[],
        rows=[{}],
        row_count=1,
        truncated=False,
        error=None,
    )
    assert _default_answer(draft, blank_row) == "Found 1 row."

    count_only = QueryResult(columns=[], rows=[], row_count=3, truncated=False, error=None)
    assert _default_answer(draft, count_only) == "Found 3 rows."


def test_sql_retry_prompt_explains_group_by_aggregate_error() -> None:
    prompt = _sql_retry_prompt("Binder Error: GROUP BY clause cannot contain aggregates!")
    assert "aggregate functions in GROUP BY" in prompt
    assert "raw dimension columns" in prompt


def test_empty_result_retry_helpers() -> None:
    assert _should_retry_empty_result("SELECT * FROM t WHERE x IS NOT NULL")
    assert _should_retry_empty_result("SELECT x FROM t HAVING COUNT(*) > 1")
    assert not _should_retry_empty_result("SELECT * FROM t")
    assert "remove them" in _empty_result_retry_prompt()
