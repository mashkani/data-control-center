import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ColumnProfile, DatasetSummary } from '@/api/types'
import { Input } from '@/components/ui/input'
import { useDatasetProfile } from '@/hooks/useDatasetProfile'
import { quoteIdent } from '@/lib/sql'
import { cn } from '@/lib/utils'

const COLUMN_SEARCH_THRESHOLD = 20

export function SchemaDatasetBlock({
  summary,
  expanded,
  onToggle,
  onInsert,
}: {
  summary: DatasetSummary
  expanded: boolean
  onToggle: () => void
  onInsert: (s: string) => void
}) {
  const [columnSearch, setColumnSearch] = useState('')
  const pq = useDatasetProfile(expanded ? summary.dataset_id : null)

  const cols: ColumnProfile[] = useMemo(
    () => pq.data?.column_profiles ?? [],
    [pq.data?.column_profiles],
  )
  const viewIdent = quoteIdent(summary.view_name)

  const filteredCols = useMemo(() => {
    const q = columnSearch.trim().toLowerCase()
    if (!q) return cols
    return cols.filter((c) => c.name.toLowerCase().includes(q))
  }, [cols, columnSearch])

  return (
    <div className="rounded-lg border border-border-default bg-white/[0.03]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left hover:bg-white/5"
      >
        <span className="truncate font-mono text-white/90">{summary.name}</span>
        <span className="shrink-0 text-fg-muted">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border-default px-2 py-1">
          {cols.length > COLUMN_SEARCH_THRESHOLD ? (
            <Input
              value={columnSearch}
              onChange={(e) => setColumnSearch(e.target.value)}
              placeholder="Search columns…"
              className="mb-1 h-7 text-xs"
              aria-label="Search columns"
            />
          ) : null}
          <ul className="max-h-48 overflow-auto">
            {pq.isPendingProfile && (
              <li className="py-1 text-[hsl(var(--fg-muted))]">
                {pq.jobProgress != null && pq.jobProgress > 0
                  ? `Profiling… ${Math.round(pq.jobProgress * 100)}%`
                  : 'Profiling…'}
              </li>
            )}
            {pq.isError && <li className="py-1 text-red-300">{(pq.error as Error).message}</li>}
            {filteredCols.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left font-mono hover:bg-white/10',
                  )}
                  onClick={() => onInsert(`${viewIdent}.${quoteIdent(c.name)} `)}
                  title="Insert at cursor"
                >
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 text-[10px] text-[hsl(var(--fg-muted))]">{c.physical_type}</span>
                </button>
              </li>
            ))}
            {filteredCols.length === 0 && !pq.isPendingProfile ? (
              <li className="py-1 text-[10px] text-fg-muted">No matching columns.</li>
            ) : null}
          </ul>
        </div>
      )}
    </div>
  )
}
