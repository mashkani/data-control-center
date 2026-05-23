"""Profiler I/O: lazy frames and frame input collection."""

from __future__ import annotations


import polars as pl

from app.config import Settings
from app.services.profiler.budget import ProfileTimeBudget
from app.services.registry import RegisteredDataset
from app.services.workspace import Workspace

LARGE_FILE_SAMPLE_WARNING = (
    "File exceeds the heavy-scan size threshold; null and duplicate metrics use a bounded sample."
)


def _file_size_bytes(ds: RegisteredDataset) -> int:
    if ds.file_size_bytes is not None:
        return ds.file_size_bytes
    return ds.source_path.stat().st_size


def _resolve_row_count(
    ds: RegisteredDataset,
    settings: Settings,
    workspace: Workspace | None,
    lf: pl.LazyFrame,
) -> int:
    if workspace is not None and ds.format == "parquet" and settings.profile_use_parquet_metadata_count:
        meta_rows = workspace.query_parquet_row_count(ds.source_path)
        if meta_rows is not None:
            return meta_rows
    if workspace is not None:
        counted = workspace.query_count(ds.view_name, settings.registration_count_timeout_seconds)
        if counted is not None:
            return counted
    row = lf.select(pl.len().alias("_row_count")).collect()
    return int(row["_row_count"][0])


def _lazy_frame_for(ds: RegisteredDataset) -> pl.LazyFrame:
    p = ds.source_path
    if ds.format == "parquet":
        return pl.scan_parquet(p)
    if ds.format == "csv":
        return pl.scan_csv(p, infer_schema_length=10_000, try_parse_dates=True)
    if ds.format == "json":
        suf = p.suffix.lower()
        if suf in (".jsonl", ".ndjson"):
            return pl.scan_ndjson(p, infer_schema_length=10_000)
        return pl.read_json(p).lazy()
    raise ValueError(f"Unsupported format: {ds.format}")


def _stats_from_sample(df_sample: pl.DataFrame, names: list[str]) -> pl.DataFrame:
    stats_exprs = [pl.len().alias("_row_count")]
    stats_exprs.extend(pl.col(col).null_count().alias(f"__nulls_{idx}") for idx, col in enumerate(names))
    return df_sample.select(stats_exprs)


def _collect_profile_frame_inputs(
    ds: RegisteredDataset,
    settings: Settings,
    workspace: Workspace | None = None,
    budget: ProfileTimeBudget | None = None,
) -> tuple[
    pl.LazyFrame,
    list[str],
    list[pl.DataType],
    pl.DataFrame,
    int,
    int,
    pl.DataFrame,
    int,
    bool,
]:
    if budget is not None:
        budget.check()

    lf = _lazy_frame_for(ds)
    schema = lf.collect_schema()
    names = schema.names()
    dtypes = [schema[n] for n in names]
    heavy_scan = _file_size_bytes(ds) > settings.profile_heavy_scan_max_bytes

    sample_n = min(
        settings.profile_structure_sample_max_rows,
        max(settings.profile_structure_sample_min_rows, 1),
    )

    if heavy_scan:
        row_count = _resolve_row_count(ds, settings, workspace, lf)
        sample_n = min(sample_n, max(row_count, 1))
        df_sample = lf.head(sample_n).collect()
        if budget is not None:
            budget.check()
        stats = _stats_from_sample(df_sample, names)
    else:
        stats_exprs = [pl.len().alias("_row_count")]
        stats_exprs.extend(pl.col(col).null_count().alias(f"__nulls_{idx}") for idx, col in enumerate(names))
        if budget is not None:
            budget.check()
        stats = lf.select(stats_exprs).collect()
        row_count = int(stats["_row_count"][0])
        sample_n = min(
            settings.profile_structure_sample_max_rows,
            max(settings.profile_structure_sample_min_rows, row_count),
        )
        df_sample = lf.head(sample_n).collect()

    col_count = len(names)
    profile_sample_rows = len(df_sample)
    return lf, names, dtypes, stats, row_count, col_count, df_sample, profile_sample_rows, heavy_scan
