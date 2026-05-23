"""Parquet metadata row counts via DuckDB."""

from pathlib import Path

import duckdb

from app.config import Settings
from app.services.workspace import Workspace


def _settings(tmp_path: Path) -> Settings:
    return Settings(workspace_db_path=tmp_path / "ws.duckdb")


def test_query_parquet_row_count_from_metadata(tmp_path: Path) -> None:
    pq = tmp_path / "rows.parquet"
    con = duckdb.connect()
    con.execute(f"COPY (SELECT * FROM range(42)) TO '{pq}' (FORMAT PARQUET)")
    con.close()

    ws = Workspace(_settings(tmp_path))
    try:
        assert ws.query_parquet_row_count(pq) == 42
    finally:
        ws.close()


def test_query_parquet_row_count_returns_none_when_metadata_empty(tmp_path: Path, monkeypatch) -> None:
    ws = Workspace(_settings(tmp_path))
    pq = tmp_path / "empty.parquet"
    pq.write_bytes(b"not parquet")

    class FakeCon:
        def execute(self, _sql: str):
            class R:
                def fetchone(self):
                    return None

            return R()

    def fake_read_db():
        from contextlib import contextmanager

        @contextmanager
        def cm():
            yield FakeCon()

        return cm()

    monkeypatch.setattr(ws._engine, "read_db", fake_read_db)
    try:
        assert ws.query_parquet_row_count(pq) is None
    finally:
        ws.close()


def test_query_parquet_row_count_returns_none_for_missing_file(tmp_path: Path) -> None:
    ws = Workspace(_settings(tmp_path))
    try:
        assert ws.query_parquet_row_count(tmp_path / "missing.parquet") is None
    finally:
        ws.close()
