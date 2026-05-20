"""Parse and validate agent model outputs."""

from __future__ import annotations

import json
from typing import Any

from pydantic import ValidationError

from app.models.api import AgentSqlDraft, QueryResult

def _load_json_object(content: str) -> Any:
    """Load a JSON object, tolerating model-added thinking text around it."""
    stripped = content.strip()
    if not stripped:
        raise json.JSONDecodeError("empty response", content, 0)
    decoder = json.JSONDecoder()
    try:
        return decoder.raw_decode(stripped)[0]
    except json.JSONDecodeError:
        start = stripped.find("{")
        if start < 0:
            raise
        return decoder.raw_decode(stripped[start:])[0]


def parse_sql_draft(content: str) -> tuple[AgentSqlDraft | None, str | None]:
    try:
        obj = _load_json_object(content)
    except json.JSONDecodeError as e:
        return None, f"Model returned invalid JSON: {e}"
    if not isinstance(obj, dict):
        return None, "Model JSON must be an object with sql and optional explanation."
    try:
        return AgentSqlDraft.model_validate(obj), None
    except ValidationError as e:
        return None, f"Invalid SQL draft payload: {e}"


def parse_summary_answer(content: str) -> tuple[str | None, str | None]:
    try:
        obj = _load_json_object(content)
    except json.JSONDecodeError as e:
        return None, f"Invalid summary JSON: {e}"
    if not isinstance(obj, dict):
        return None, "Summary JSON must be an object."
    ans = obj.get("answer")
    if isinstance(ans, str) and ans.strip():
        return ans.strip(), None
    return None, "Summary missing answer field."


def _result_preview_for_summary(result_json: dict[str, Any], max_chars: int) -> str:
    raw = json.dumps(result_json, default=str)
    if len(raw) <= max_chars:
        return raw
    return raw[: max_chars - 20] + "\n... (truncated)"


def _format_answer_value(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _row_preview(row: dict[str, Any], max_items: int = 3) -> str:
    parts = [
        f"{key}: {_format_answer_value(value)}"
        for key, value in list(row.items())[:max_items]
    ]
    return "; ".join(parts)


def _default_answer(draft: AgentSqlDraft, qres: QueryResult) -> str:
    _ = draft
    if qres.row_count == 0:
        return "No matching rows were found."

    if qres.rows:
        preview = _row_preview(qres.rows[0])
        if qres.row_count == 1:
            return f"{preview}." if preview else "Found 1 row."
        return (
            f"Found {qres.row_count} rows. First result: {preview}."
            if preview
            else f"Found {qres.row_count} rows."
        )

    return f"Found {qres.row_count} row{'s' if qres.row_count != 1 else ''}."
