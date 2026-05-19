"""Build full dataset profile."""

from __future__ import annotations

import time

from app.config import Settings
from app.models.api import (
    DatasetProfile,
    MetricScope,
    SemanticType,
    StructureConfidence,
    TemporalKind,
)
from app.services.profiler.patterns import CURRENT_PROFILE_STRUCTURE_VERSION
from app.services.profiler.columns import _derive_column_profiles
from app.services.profiler.full_metrics import FullProfileMetrics, collect_full_profile_metrics
from app.services.profiler.io import _collect_profile_frame_inputs
from app.services.profiler.quality import _build_profile_narrative, _detect_quality_issues, _severity_order
from app.services.profiler.structure import (
    _build_grain_key_candidates,
    _build_key_candidate_pool,
    _merge_entity_candidates,
    _pick_primary_grain_columns,
    _rank_measure_candidates,
)
from app.services.registry import RegisteredDataset
from app.services.workspace import Workspace
from app.telemetry import emit

def _sample_duplicate_row_pct(row_count: int, col_count: int, df_sample) -> float | None:
    if row_count > 0 and col_count and len(df_sample):
        try:
            dups_sample = int(df_sample.is_duplicated().sum())
            return round(dups_sample / len(df_sample) * 100, 4)
        except Exception:
            return None
    return None


def _apply_full_top_values(col_profiles, full_column_metrics: dict[str, object], row_count: int) -> None:
    for c in col_profiles:
        metric = full_column_metrics.get(c.name)
        top_values = getattr(metric, "top_values", None) if metric is not None else None
        if top_values is None:
            continue
        c.top_values = top_values
        if top_values:
            raw = top_values[0]["value"]
            c.top_value = "(null)" if raw is None else str(raw)
            c.top_count = int(top_values[0].get("count", 0))
            c.top_pct = round(c.top_count / row_count * 100, 4) if row_count else None


def build_profile(
    ds: RegisteredDataset,
    settings: Settings,
    workspace: Workspace | None = None,
) -> DatasetProfile:
    profiling_started = time.monotonic()
    _lf, names, dtypes, stats, row_count, col_count, df_sample, profile_sample_rows = _collect_profile_frame_inputs(
        ds, settings
    )
    sample_n = profile_sample_rows
    metric_scope = MetricScope.full if profile_sample_rows == row_count else MetricScope.sample
    total_cells = row_count * col_count if col_count else 0
    full_metrics = None
    if workspace is not None and row_count > 0:
        try:
            full_metrics = collect_full_profile_metrics(
                workspace,
                settings,
                ds.view_name,
                names,
                dtypes,
                row_count,
                grain_candidates=[],
                top_value_columns=[],
            )
        except Exception:  # noqa: BLE001
            full_metrics = FullProfileMetrics(
                warnings=["Full profile metrics were unavailable; sample metrics are shown."]
            )

    semantic_started = time.monotonic()
    col_profiles, null_cells, temporal_cols, entity_candidates = _derive_column_profiles(
        names,
        dtypes,
        stats,
        row_count,
        df_sample,
        sample_n,
        profile_sample_rows,
        metric_scope,
        full_metrics.column_metrics if full_metrics is not None else None,
    )

    sample_dup_pct = _sample_duplicate_row_pct(row_count, col_count, df_sample)
    dup_pct = full_metrics.duplicate_row_pct if full_metrics and full_metrics.duplicate_row_pct is not None else sample_dup_pct
    dup_scope = (
        MetricScope.full
        if full_metrics and full_metrics.duplicate_row_pct is not None
        else metric_scope
        if dup_pct is not None
        else None
    )

    missing_cell_pct = (
        round(null_cells / total_cells * 100, 4) if total_cells else None
    )

    semantic_elapsed_ms = int((time.monotonic() - semantic_started) * 1000)

    temporal_cols.sort(
        key=lambda x: (x.confidence == StructureConfidence.high, x.kind == TemporalKind.continuous_datetime),
        reverse=True,
    )
    primary_temporal = temporal_cols[0] if temporal_cols else None
    primary_date = primary_temporal.name if primary_temporal else None

    measure_started = time.monotonic()
    measure_candidates = _rank_measure_candidates(df_sample, col_profiles)
    measure_elapsed_ms = int((time.monotonic() - measure_started) * 1000)
    measures = [c.name for c in measure_candidates[:8]]

    entity_final = _merge_entity_candidates(entity_candidates, col_profiles)
    entity_name_set = {e.name for e in entity_final}
    id_column_names = [e.name for e in entity_final]

    key_candidate_pool = _build_key_candidate_pool(
        col_profiles,
        temporal_cols,
        settings.profile_structure_max_key_candidates,
    )
    key_search_started = time.monotonic()
    grain_candidates = _build_grain_key_candidates(
        df_sample=df_sample,
        candidate_cols=key_candidate_pool,
        high_threshold=settings.profile_structure_high_confidence_threshold,
        medium_threshold=settings.profile_structure_medium_confidence_threshold,
        max_pair_checks=settings.profile_structure_max_pair_checks,
        max_triple_checks=settings.profile_structure_max_triple_checks,
    )
    key_search_elapsed_ms = int((time.monotonic() - key_search_started) * 1000)
    top_value_columns = [
        c.name
        for c in col_profiles
        if c.semantic_type in (SemanticType.categorical, SemanticType.boolean_like)
    ]
    if workspace is not None and row_count > 0 and (top_value_columns or grain_candidates):
        try:
            later_full_metrics = collect_full_profile_metrics(
                workspace,
                settings,
                ds.view_name,
                names,
                dtypes,
                row_count,
                grain_candidates=grain_candidates,
                top_value_columns=top_value_columns,
                include_duplicate=False,
                include_columns=False,
            )
        except Exception:  # noqa: BLE001
            later_full_metrics = FullProfileMetrics(
                warnings=["Full profile metrics were unavailable; sample metrics are shown."]
            )
        if full_metrics is not None:
            for name, metric in later_full_metrics.column_metrics.items():
                existing = full_metrics.column_metrics.get(name)
                if existing is None:
                    full_metrics.column_metrics[name] = metric
                else:
                    existing.top_values = metric.top_values
            if later_full_metrics.grain_candidates is not None:
                full_metrics.grain_candidates = later_full_metrics.grain_candidates
            full_metrics.warnings = list(dict.fromkeys([*full_metrics.warnings, *later_full_metrics.warnings]))

    if full_metrics is not None:
        _apply_full_top_values(col_profiles, full_metrics.column_metrics, row_count)
    grain_key_scope = MetricScope.sample if metric_scope == MetricScope.sample else MetricScope.full
    if full_metrics is not None and full_metrics.grain_candidates is not None:
        grain_candidates = full_metrics.grain_candidates
        grain_key_scope = MetricScope.full
    else:
        grain_key_scope = metric_scope
    primary_grain = _pick_primary_grain_columns(grain_candidates, entity_name_set, primary_date)
    key_candidates: list[str] = []
    for g in grain_candidates:
        key_candidates.extend(g.columns)
    key_candidates = list(dict.fromkeys(key_candidates))

    issues = _detect_quality_issues(
        ds,
        col_profiles,
        row_count,
        null_cells,
        total_cells,
        sample_n,
        primary_grain_columns=primary_grain,
    )

    penalty = sum(i.score_impact for i in issues)
    quality_score = max(0.0, min(100.0, 100.0 - penalty))

    narrative_parts = _build_profile_narrative(
        ds,
        row_count,
        col_count,
        primary_grain,
        id_column_names,
        primary_date,
        measures,
        issues,
    )

    structure_warnings: list[str] = []
    if not primary_grain:
        structure_warnings.append("No high-confidence row grain key was identified in bounded analysis.")
    if primary_temporal is None:
        structure_warnings.append("No temporal axis was detected; trends may require manual column selection.")
    primary_grain_conf = next(
        (g.confidence for g in grain_candidates if list(g.columns) == primary_grain),
        grain_candidates[0].confidence if grain_candidates else None,
    )
    if primary_grain_conf == StructureConfidence.medium:
        scope_label = "full-table" if grain_key_scope == MetricScope.full else "sample-based"
        structure_warnings.append(f"Primary grain key confidence is medium ({scope_label} uniqueness).")
    profile_metric_warnings = full_metrics.warnings if full_metrics is not None else []

    emit(
        "profile.structure.inference",
        dataset_id=ds.dataset_id,
        row_count=row_count,
        column_count=col_count,
        temporal_candidates=len(temporal_cols),
        entity_candidates=len(entity_final),
        grain_candidates=len(grain_candidates),
        semantic_elapsed_ms=semantic_elapsed_ms,
        key_search_elapsed_ms=key_search_elapsed_ms,
        measure_elapsed_ms=measure_elapsed_ms,
        elapsed_ms=int((time.monotonic() - profiling_started) * 1000),
    )

    return DatasetProfile(
        dataset_id=ds.dataset_id,
        name=ds.source_path.name,
        rows=row_count,
        columns=col_count,
        profiler_sample_rows=profile_sample_rows,
        file_size_bytes=ds.file_size_bytes,
        missing_cell_pct=missing_cell_pct,
        duplicate_row_pct=dup_pct,
        duplicate_row_pct_scope=dup_scope,
        profile_metric_warnings=profile_metric_warnings,
        numeric_column_count=len({c.name for c in col_profiles if c.semantic_type == SemanticType.numeric}),
        categorical_column_count=len(
            {c.name for c in col_profiles if c.semantic_type == SemanticType.categorical}
        ),
        datetime_column_count=len(
            {c.name for c in col_profiles if c.semantic_type == SemanticType.datetime}
        ),
        quality_score=round(quality_score, 2),
        narrative="\n\n".join(narrative_parts),
        likely_grain=(
            f"One row per {primary_grain[0]}."
            if len(primary_grain) == 1
            else f"One row per {' + '.join(primary_grain)}."
            if primary_grain
            else None
        ),
        main_numeric_measures=measures,
        structure_version=CURRENT_PROFILE_STRUCTURE_VERSION,
        grain_key_scope=grain_key_scope,
        temporal_columns=temporal_cols,
        entity_id_columns=entity_final[:15],
        grain_key_candidates=grain_candidates[:15],
        primary_grain_key_columns=primary_grain,
        primary_temporal_column=primary_temporal,
        measure_candidates=measure_candidates[:20],
        structure_warnings=structure_warnings,
        column_profiles=col_profiles,
        quality_issues=sorted(
            issues,
            key=lambda x: (-_severity_order(x.severity), -x.score_impact),
        ),
    )
