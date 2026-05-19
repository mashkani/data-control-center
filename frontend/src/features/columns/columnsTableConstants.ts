import { createColumnHelper } from '@tanstack/react-table'
import type { ColumnProfile } from '@/api/types'

export const colHelper = createColumnHelper<ColumnProfile>()

export const SEM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'categorical', label: 'Categorical' },
  { value: 'datetime', label: 'Datetime' },
  { value: 'id_like', label: 'ID-like' },
  { value: 'boolean_like', label: 'Boolean' },
  { value: 'text', label: 'Text' },
  { value: 'unknown', label: 'Unknown' },
]

export const CQ_OPTIONS: Array<{ value: 'all' | 'has_flags' | 'critical_only'; label: string }> = [
  { value: 'all', label: 'Any' },
  { value: 'has_flags', label: 'Has flags' },
  { value: 'critical_only', label: 'Critical' },
]

export const COLUMN_TOOLBAR_IDS: Array<{ id: string; label: string }> = [
  { id: 'name', label: 'Column' },
  { id: 'role_col', label: 'Role' },
  { id: 'missing', label: 'Missing' },
  { id: 'unique_pct', label: 'Unique' },
  { id: 'range_col', label: 'Range' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'quality_flags', label: 'Flags' },
]

export const CRITICAL_COLUMN_FLAGS = ['high_missingness', 'id_with_nulls'] as const

export function columnRowSeverity(flags: string[]): 'critical' | 'warning' | 'none' {
  if (flags.some((f) => CRITICAL_COLUMN_FLAGS.includes(f as (typeof CRITICAL_COLUMN_FLAGS)[number]))) {
    return 'critical'
  }
  if (flags.length > 0) return 'warning'
  return 'none'
}

export function edaSampleSummary(
  sampleRows: number | null | undefined,
  fullRows: number | null | undefined,
): string {
  if (sampleRows != null && fullRows != null && sampleRows < fullRows) {
    return `EDA stats use the first ${sampleRows.toLocaleString()} rows (sample; full table has ${fullRows.toLocaleString()} rows). Uniqueness and distributions follow this sample.`
  }
  if (sampleRows != null && fullRows != null && sampleRows === fullRows) {
    return `EDA stats use all ${fullRows.toLocaleString()} rows in this table.`
  }
  return 'EDA stats follow the profiler sample window for large datasets.'
}
