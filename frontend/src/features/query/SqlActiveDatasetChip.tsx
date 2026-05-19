import type { DatasetSummary } from '@/api/types'
import { useDatasetProfile } from '@/hooks/useDatasetProfile'
import { formatCount, formatDatasetFormat } from '@/lib/format'

export function SqlActiveDatasetChip({
  summary,
}: {
  summary: DatasetSummary | undefined
}) {
  const { data: profile } = useDatasetProfile(summary?.dataset_id ?? null)

  if (!summary) {
    return (
      <div className="rounded-lg border border-dashed border-border-default px-3 py-2 text-xs text-fg-muted">
        No active dataset — select one from the header.
      </div>
    )
  }

  const rows = profile?.rows ?? summary.row_count
  const cols = profile?.columns ?? summary.column_count

  return (
    <div
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border-default bg-black/25 px-3 py-1.5 text-xs"
      data-testid="sql-active-dataset-chip"
    >
      <span className="font-medium text-fg">{summary.name}</span>
      <span className="text-fg-muted">·</span>
      <span className="text-fg-muted">
        {formatCount(rows)} rows · {formatCount(cols)} cols
      </span>
      <span className="text-fg-muted">·</span>
      <span className="font-mono text-[10px] uppercase text-fg-muted">
        {formatDatasetFormat(summary.format)}
      </span>
    </div>
  )
}
