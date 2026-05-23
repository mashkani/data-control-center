"""Heavy-scan profiling path for large local files."""

from pathlib import Path

import polars as pl

from app.config import Settings
from app.services.profiler.budget import ProfileTimeBudget
from app.services.profiler.io import _collect_profile_frame_inputs
from app.services.registry import RegisteredDataset
from app.services.workspace import Workspace


def _settings(tmp_path: Path) -> Settings:
    return Settings(workspace_db_path=tmp_path / "ws.duckdb")


def test_heavy_scan_uses_metadata_row_count_and_sample_stats(tmp_path: Path) -> None:
    pq = tmp_path / "wide.parquet"
    pl.DataFrame({"a": list(range(100)), "b": list(range(100))}).write_parquet(pq)
    settings = _settings(tmp_path)
    reported_size = settings.profile_heavy_scan_max_bytes + 1

    ws = Workspace(settings)
    ws.register_file_view("v_heavy", pq, "parquet")
    ds = RegisteredDataset(
        dataset_id="ds_heavy",
        source_path=pq,
        source_label=pq.name,
        view_name="v_heavy",
        format="parquet",
        row_count=None,
        column_count=2,
        file_size_bytes=reported_size,
    )

    try:
        _lf, names, _dtypes, stats, row_count, col_count, df_sample, profile_sample_rows, heavy_scan = (
            _collect_profile_frame_inputs(
                ds,
                settings,
                ws,
                ProfileTimeBudget(settings, reported_size),
            )
        )
    finally:
        ws.close()

    assert heavy_scan is True
    assert row_count == 100
    assert col_count == 2
    assert len(names) == 2
    assert profile_sample_rows == len(df_sample)
    assert profile_sample_rows <= settings.profile_structure_sample_max_rows
    assert int(stats["_row_count"][0]) == profile_sample_rows


def test_resolve_row_count_uses_bounded_duckdb_count(tmp_path: Path) -> None:
    pq = tmp_path / "counted.parquet"
    pl.DataFrame({"x": [1, 2, 3, 4, 5]}).write_parquet(pq)
    settings = Settings(
        workspace_db_path=tmp_path / "ws2.duckdb",
        profile_use_parquet_metadata_count=False,
    )
    ws = Workspace(settings)
    ws.register_file_view("v_cnt", pq, "parquet")
    ds = RegisteredDataset(
        dataset_id="ds_cnt",
        source_path=pq,
        source_label=pq.name,
        view_name="v_cnt",
        format="parquet",
        row_count=None,
        column_count=1,
        file_size_bytes=pq.stat().st_size,
    )
    lf = pl.scan_parquet(pq)
    from app.services.profiler.io import _resolve_row_count

    try:
        assert _resolve_row_count(ds, settings, ws, lf) == 5
    finally:
        ws.close()


def test_resolve_row_count_falls_back_to_lazy_len(tmp_path: Path) -> None:
    pq = tmp_path / "tiny.parquet"
    pl.DataFrame({"x": [1, 2, 3]}).write_parquet(pq)
    ds = RegisteredDataset(
        dataset_id="ds_fb",
        source_path=pq,
        source_label=pq.name,
        view_name="v_fb",
        format="parquet",
        row_count=None,
        column_count=1,
        file_size_bytes=None,
    )
    lf = pl.scan_parquet(pq)
    settings = Settings(profile_use_parquet_metadata_count=False)
    from app.services.profiler.io import _resolve_row_count

    assert _resolve_row_count(ds, settings, None, lf) == 3


def test_file_size_bytes_from_stat(tmp_path: Path) -> None:
    pq = tmp_path / "s.parquet"
    pl.DataFrame({"x": [1]}).write_parquet(pq)
    ds = RegisteredDataset(
        dataset_id="ds_s",
        source_path=pq,
        source_label=pq.name,
        view_name="v",
        format="parquet",
        row_count=None,
        column_count=1,
        file_size_bytes=None,
    )
    from app.services.profiler.io import _file_size_bytes

    assert _file_size_bytes(ds) == pq.stat().st_size
