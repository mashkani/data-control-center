import { Eye, Info, Rows3, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip } from '@/components/ui/tooltip'
import type { ColumnQualityFilter, ColumnsDensity } from '@/store/uiStore'
import { cn } from '@/lib/utils'
import {
  COLUMN_TOOLBAR_IDS,
  CQ_OPTIONS,
  SEM_OPTIONS,
  edaSampleSummary,
} from '@/features/columns/columnsTableConstants'

type ColumnsToolbarProps = {
  activeId: string
  columnSearch: string
  setColumnSearch: (value: string) => void
  semanticFilter: string
  setSemanticFilter: (value: string) => void
  columnQualityFilter: ColumnQualityFilter
  setColumnQualityFilter: (value: ColumnQualityFilter) => void
  hiddenCols: string[]
  toggleColVis: (datasetId: string, columnId: string) => void
  columnsDensity: ColumnsDensity
  setColumnsDensity: (value: ColumnsDensity) => void
  filteredCount: number
  totalCols: number
  sampleRows: number | null | undefined
  fullRows: number | null | undefined
  summaryParts: string[]
  clearAllFilters: () => void
}

export function ColumnsToolbar({
  activeId,
  columnSearch,
  setColumnSearch,
  semanticFilter,
  setSemanticFilter,
  columnQualityFilter,
  setColumnQualityFilter,
  hiddenCols,
  toggleColVis,
  columnsDensity,
  setColumnsDensity,
  filteredCount,
  totalCols,
  sampleRows,
  fullRows,
  summaryParts,
  clearAllFilters,
}: ColumnsToolbarProps) {
  const semanticLabel =
    SEM_OPTIONS.find((opt) => opt.value === semanticFilter)?.label ?? 'All types'
  const edaSummary = edaSampleSummary(sampleRows, fullRows)
  const hasActiveFilters = summaryParts.length > 0

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-3 border-b border-border-default/80 bg-[hsl(var(--bg-1))]/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
        <div className="relative min-w-[180px] flex-1 lg:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
            aria-hidden
          />
          <Input
            placeholder="Column name…"
            value={columnSearch}
            onChange={(e) => setColumnSearch(e.target.value)}
            className="h-8 pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1">
              Type: {semanticLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>Semantic type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={semanticFilter} onValueChange={setSemanticFilter}>
              {SEM_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex flex-wrap items-center gap-1 rounded-full border border-border-default/80 bg-white/[0.02] p-0.5">
          {CQ_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setColumnQualityFilter(opt.value)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs transition',
                columnQualityFilter === opt.value
                  ? 'bg-white/12 text-white'
                  : 'text-[hsl(var(--fg-muted))] hover:bg-white/5 hover:text-white',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs text-[hsl(var(--fg-muted))]">
            <span className="tabular-nums text-fg">{filteredCount}</span> of{' '}
            <span className="tabular-nums text-fg">{totalCols}</span> columns
          </span>
          <Tooltip content={edaSummary}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="EDA sample details"
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1">
                <Eye className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Visible in table</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMN_TOOLBAR_IDS.map(({ id, label }) => (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={!hiddenCols.includes(id)}
                  onCheckedChange={() => toggleColVis(activeId, id)}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip content={columnsDensity === 'compact' ? 'Comfortable density' : 'Compact density'}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label={
                columnsDensity === 'compact' ? 'Switch to comfortable density' : 'Switch to compact density'
              }
              onClick={() =>
                setColumnsDensity(columnsDensity === 'compact' ? 'comfortable' : 'compact')
              }
            >
              <Rows3 className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {summaryParts.map((part) => (
            <button
              key={part}
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] text-fg hover:bg-white/12"
              onClick={() => {
                if (part.startsWith('name contains')) setColumnSearch('')
                else if (part.startsWith('type:')) setSemanticFilter('all')
                else if (part.startsWith('quality:')) setColumnQualityFilter('all')
              }}
            >
              {part}
              <X className="h-3 w-3 opacity-70" aria-hidden />
            </button>
          ))}
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearAllFilters}>
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export { ColumnsToolbar as ColumnsFilters }
