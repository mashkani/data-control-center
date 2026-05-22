"""sanitize_query_execution_error categorization."""

from __future__ import annotations

from app.services.query_errors import (
    MSG_BINDER_GROUPING,
    MSG_CATALOG,
    MSG_CONVERSION,
    MSG_QUERY_FAILED,
    MSG_QUERY_TIMEOUT,
    MSG_SYNTAX,
    sanitize_query_execution_error,
)
from app.services.source_errors import MISSING_DATASET_SOURCE_MESSAGE


def test_sanitize_missing_source() -> None:
    exc = RuntimeError('IO Error: No files found that match the pattern "/private/x.parquet"')
    assert sanitize_query_execution_error(exc) == MISSING_DATASET_SOURCE_MESSAGE
    assert "/private" not in sanitize_query_execution_error(exc)


def test_sanitize_timeout() -> None:
    assert sanitize_query_execution_error(RuntimeError("statement timeout")) == MSG_QUERY_TIMEOUT


def test_sanitize_binder_grouping() -> None:
    msg = 'Binder Error: column "sort_value" must appear in the GROUP BY clause'
    assert sanitize_query_execution_error(RuntimeError(msg)) == MSG_BINDER_GROUPING


def test_sanitize_conversion() -> None:
    assert sanitize_query_execution_error(RuntimeError("Conversion Error: could not convert")) == MSG_CONVERSION


def test_sanitize_catalog() -> None:
    assert sanitize_query_execution_error(RuntimeError("Catalog Error: column x does not exist")) == MSG_CATALOG


def test_sanitize_syntax() -> None:
    assert sanitize_query_execution_error(RuntimeError("Parser Error: syntax error at or near")) == MSG_SYNTAX


def test_sanitize_default() -> None:
    assert sanitize_query_execution_error(RuntimeError("something unexpected")) == MSG_QUERY_FAILED
