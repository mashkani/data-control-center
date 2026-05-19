import type { ColumnProfile, DatasetProfile, HistogramBin, QualityIssue } from '@/api/types'

export function mkHistogramBin(overrides: Partial<HistogramBin> = {}): HistogramBin {
  return {
    lower_bound: 0,
    upper_bound: 10,
    left_closed: false,
    right_closed: true,
    count: 3,
    pct_non_null: 30,
    ...overrides,
  }
}

export function mkProfile(overrides: Partial<DatasetProfile> = {}): DatasetProfile {
  return {
    dataset_id: 'ds_001',
    name: 'Demo',
    rows: 10,
    columns: 2,
    profiler_sample_rows: 10,
    file_size_bytes: 500,
    missing_cell_pct: 1,
    duplicate_row_pct: 0,
    duplicate_row_pct_scope: 'full',
    profile_metric_warnings: [],
    numeric_column_count: 1,
    categorical_column_count: 1,
    datetime_column_count: 0,
    quality_score: 90,
    narrative: '**Hi** there',
    likely_grain: 'One row per id.',
    main_numeric_measures: ['x'],
    structure_version: 'v6',
    grain_key_scope: 'full',
    temporal_columns: [{ name: 'created', kind: 'continuous_datetime', confidence: 'high' }],
    entity_id_columns: [{ name: 'id', confidence: 'high' }],
    grain_key_candidates: [{ columns: ['id'], uniqueness_ratio: 1, confidence: 'high', rank: 1 }],
    primary_grain_key_columns: ['id'],
    primary_temporal_column: { name: 'created', kind: 'continuous_datetime', confidence: 'high' },
    measure_candidates: [{ name: 'x', score: 0.9, confidence: 'high' }],
    structure_warnings: [],
    column_profiles: [],
    quality_issues: [],
    ...overrides,
  }
}

export function mkColumn(overrides: Partial<ColumnProfile> = {}): ColumnProfile {
  return {
    name: 'col_a',
    physical_type: 'Int64',
    semantic_type: 'numeric',
    null_pct: 0,
    non_null_count: 10,
    null_count: 0,
    unique_count: 10,
    unique_pct: 100,
    cardinality: 10,
    min_value: '0',
    max_value: '9',
    mean_value: '4.5',
    std_value: '2.872',
    median_value: '4',
    p25_value: '2',
    p75_value: '7',
    top_value: null,
    top_count: null,
    top_pct: null,
    top_values: [{ value: 1, count: 2 }],
    quality_flags: ['high_missingness'],
    histogram: null,
    metric_scope: 'full',
    ...overrides,
  }
}

export function mkIssue(overrides: Partial<QualityIssue> = {}): QualityIssue {
  return {
    id: 'i1',
    severity: 'warning',
    category: 'x',
    title: 'T',
    description: 'D',
    why_it_matters: 'W',
    affected_columns: [],
    examples: [],
    suggested_sql: null,
    score_impact: 1,
    ...overrides,
  }
}
