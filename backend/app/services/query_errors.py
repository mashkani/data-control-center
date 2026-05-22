"""Sanitized user-facing messages for query execution failures."""

from __future__ import annotations

from app.services.source_errors import MISSING_DATASET_SOURCE_MESSAGE, is_missing_dataset_source_error

MSG_QUERY_FAILED = "Query failed."
MSG_QUERY_TIMEOUT = "Query timed out."
MSG_BINDER_GROUPING = "Query could not run: aggregation or grouping is invalid for this SQL."
MSG_CONVERSION = "Query could not run: a value could not be converted to the expected type."
MSG_CATALOG = "Query could not run: a referenced column or table was not found."
MSG_SYNTAX = "Query could not run: SQL syntax is invalid."


def sanitize_query_execution_error(exc: Exception) -> str:
    if is_missing_dataset_source_error(exc):
        return MISSING_DATASET_SOURCE_MESSAGE

    msg = str(exc)
    lower = msg.lower()
    exc_name = type(exc).__name__.lower()

    if "timeout" in lower or "timed out" in lower:
        return MSG_QUERY_TIMEOUT

    if "binder" in lower or "group by" in lower or exc_name == "binderexception":
        return MSG_BINDER_GROUPING

    if (
        "conversion" in lower
        or "could not convert" in lower
        or exc_name == "conversionexception"
        or ("cast" in lower and "error" in lower)
    ):
        return MSG_CONVERSION

    if (
        "catalog" in lower
        or exc_name == "catalogexception"
        or (
            ("not found" in lower or "does not exist" in lower)
            and ("column" in lower or "table" in lower or "relation" in lower)
        )
    ):
        return MSG_CATALOG

    if (
        "parser" in lower
        or "syntax error" in lower
        or exc_name == "parserexception"
        or ("syntax" in lower and "error" in lower)
    ):
        return MSG_SYNTAX

    return MSG_QUERY_FAILED
