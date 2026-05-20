import { useMemo, useState } from 'react'
import {
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useDatasetProfile } from '@/hooks/useDatasetProfile'
import { useUiStore } from '@/store/uiStore'
import { formatCount, formatPercent } from '@/lib/format'
import {
  buildColumnRoleMap,
  metricScopeLabel,
  roleSortKey,
  sortOptionalNumber,
} from '@/features/columns/columnRoleUtils'
import { colHelper } from '@/features/columns/columnsTableConstants'
import { DistributionCell, NullBar, TypeIcon } from '@/features/columns/ColumnsTableCells'
import { Badge } from '@/components/ui/badge'

const EMPTY_HIDDEN: string[] = []

export function useColumnsTable() {
  const activeId = useUiStore((s) => s.activeDatasetId)
  const columnSearch = useUiStore((s) => s.columnSearch)
  const setColumnSearch = useUiStore((s) => s.setColumnSearch)
  const semanticFilter = useUiStore((s) => s.semanticFilter)
  const setSemanticFilter = useUiStore((s) => s.setSemanticFilter)
  const columnQualityFilter = useUiStore((s) => s.columnQualityFilter)
  const setColumnQualityFilter = useUiStore((s) => s.setColumnQualityFilter)
  const selectedColumn = useUiStore((s) => s.selectedColumn)
  const setSelectedColumn = useUiStore((s) => s.setSelectedColumn)
  const drawerOpen = useUiStore((s) => s.columnDrawerOpen)
  const setDrawerOpen = useUiStore((s) => s.setColumnDrawerOpen)
  const hiddenMap = useUiStore((s) => s.columnsTableHidden)
  const hiddenCols = activeId ? (hiddenMap[activeId] ?? EMPTY_HIDDEN) : EMPTY_HIDDEN
  const toggleColVis = useUiStore((s) => s.toggleColumnTableVisibility)
  const columnsDensity = useUiStore((s) => s.columnsDensity)
  const setColumnsDensity = useUiStore((s) => s.setColumnsDensity)

  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])

  const profile = useDatasetProfile(activeId)
  const q = {
    data: profile.data,
    isLoading: profile.isPendingProfile,
    isError: profile.isError,
    error: profile.error,
    refetch: profile.refetch,
  }

  const datasetsQ = useQuery({ queryKey: ['datasets'], queryFn: api.listDatasets })
  const activeViewName = useMemo(
    () => datasetsQ.data?.find((d) => d.dataset_id === activeId)?.view_name ?? '',
    [datasetsQ.data, activeId],
  )

  const columnRoleMap = useMemo(() => buildColumnRoleMap(q.data), [q.data])

  const hasAnyRole = useMemo(() => {
    const profiles = q.data?.column_profiles ?? []
    for (const col of profiles) {
      const roles = columnRoleMap.get(col.name) ?? []
      if (roles.length) return true
    }
    return false
  }, [q.data, columnRoleMap])

  const allColumnDefs = useMemo(
    () => [
      colHelper.accessor('name', {
        header: 'Column',
        cell: (ctx) => {
          const name = ctx.getValue()
          const r = ctx.row.original
          return (
            <div className="flex min-w-0 max-w-[min(32rem,70vw)] items-start gap-2">
              <TypeIcon sem={r.semantic_type} />
              <div className="min-w-0">
                <span className="block min-w-0 truncate font-mono text-sm" title={name}>
                  {name}
                </span>
                <span
                  className="block truncate font-mono text-[10px] text-[hsl(var(--fg-muted))]"
                  title={r.physical_type}
                >
                  {r.physical_type}
                </span>
              </div>
            </div>
          )
        },
      }),
      colHelper.accessor((r) => roleSortKey(columnRoleMap.get(r.name) ?? []), {
        id: 'role_col',
        header: 'Role',
        sortingFn: sortOptionalNumber,
        cell: (ctx) => {
          const roles = columnRoleMap.get(ctx.row.original.name) ?? []
          if (!roles.length) return <span className="text-[hsl(var(--fg-muted))]">—</span>
          return (
            <div
              className="flex max-w-[min(14rem,28vw)] min-w-0 flex-wrap gap-1"
              title={roles.join(', ')}
            >
              {roles.map((role) => (
                <Badge
                  key={role}
                  variant="info"
                  className="max-w-full truncate px-1.5 py-0 text-[10px] font-normal"
                  title={role}
                >
                  {role}
                </Badge>
              ))}
            </div>
          )
        },
      }),
      colHelper.accessor((r) => r.null_count ?? null, {
        id: 'missing',
        header: 'Missing',
        sortingFn: sortOptionalNumber,
        cell: (ctx) => {
          const r = ctx.row.original
          return (
            <div className="flex min-w-[150px] flex-col gap-1">
              <span className="tabular-nums text-xs text-fg">{formatCount(r.null_count)} null</span>
              <NullBar pct={r.null_pct} />
            </div>
          )
        },
      }),
      colHelper.accessor((r) => r.unique_pct ?? null, {
        id: 'unique_pct',
        header: 'Unique',
        sortingFn: sortOptionalNumber,
        cell: (ctx) => {
          const r = ctx.row.original
          const scope = metricScopeLabel(r.metric_scope)
          return (
            <div className="min-w-[110px] text-xs" title={`Uniqueness is based on the ${scope}.`}>
              <span className="tabular-nums text-fg">{formatCount(r.unique_count)}</span>
              <span className="text-[hsl(var(--fg-muted))]"> · </span>
              <span className="tabular-nums text-fg">{formatPercent(r.unique_pct)}</span>
              {r.metric_scope === 'sample' ? (
                <span className="ml-1 text-[10px] text-[hsl(var(--fg-muted))]">sample</span>
              ) : null}
            </div>
          )
        },
      }),
      colHelper.accessor((r) => {
        if (r.std_value == null || r.std_value === '') return null
        const n = Number(r.std_value)
        return Number.isFinite(n) ? n : null
      }, {
        id: 'distribution',
        header: 'Distribution',
        sortingFn: sortOptionalNumber,
        cell: (ctx) => <DistributionCell row={ctx.row.original} />,
      }),
      colHelper.accessor('quality_flags', {
        header: 'Flags',
        sortingFn: (ra, rb, colId) => {
          const a = (ra.getValue(colId) as string[]).length
          const b = (rb.getValue(colId) as string[]).length
          return a === b ? 0 : a < b ? -1 : 1
        },
        cell: (ctx) => {
          const flags = ctx.getValue()
          if (!flags.length) return <span className="text-[hsl(var(--fg-muted))]">—</span>
          return (
            <div
              className="flex max-w-[min(14rem,30vw)] min-w-0 flex-wrap gap-1"
              title={flags.join(', ')}
            >
              {flags.map((f) => (
                <Badge key={f} variant="warning" className="max-w-full truncate font-normal" title={f}>
                  {f}
                </Badge>
              ))}
            </div>
          )
        },
      }),
    ],
    [columnRoleMap],
  )

  const columns = useMemo(
    () =>
      allColumnDefs.filter((c) => {
        const id = String(c.id)
        if (hiddenCols.includes(id)) return false
        if (id === 'role_col' && !hasAnyRole) return false
        return true
      }),
    [allColumnDefs, hiddenCols, hasAnyRole],
  )

  const data = useMemo(() => {
    let rows = q.data?.column_profiles ?? []
    if (columnSearch.trim()) {
      const s = columnSearch.toLowerCase()
      rows = rows.filter((r) => r.name.toLowerCase().includes(s))
    }
    if (semanticFilter !== 'all') {
      rows = rows.filter((r) => r.semantic_type === semanticFilter)
    }
    if (columnQualityFilter === 'has_flags') {
      rows = rows.filter((r) => r.quality_flags.length > 0)
    }
    if (columnQualityFilter === 'critical_only') {
      rows = rows.filter(
        (r) =>
          r.quality_flags.includes('high_missingness') || r.quality_flags.includes('id_with_nulls'),
      )
    }
    return rows
  }, [q.data, columnSearch, semanticFilter, columnQualityFilter])

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table useReactTable
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const selected = useMemo(
    () => data.find((c) => c.name === selectedColumn) ?? null,
    [data, selectedColumn],
  )

  const totalCols = q.data?.column_profiles.length ?? 0
  const sampleRows = q.data?.profiler_sample_rows
  const fullRows = q.data?.rows

  const summaryParts = useMemo(() => {
    const bits: string[] = []
    if (columnSearch.trim()) bits.push(`name contains "${columnSearch.trim()}"`)
    if (semanticFilter !== 'all') {
      const label = semanticFilter.replaceAll('_', ' ')
      bits.push(`type: ${label}`)
    }
    if (columnQualityFilter === 'has_flags') bits.push('quality: has flags')
    if (columnQualityFilter === 'critical_only') bits.push('quality: critical flags')
    return bits
  }, [columnSearch, semanticFilter, columnQualityFilter])

  const clearAllFilters = () => {
    setColumnSearch('')
    setSemanticFilter('all')
    setColumnQualityFilter('all')
  }

  return {
    activeId,
    columnSearch,
    setColumnSearch,
    semanticFilter,
    setSemanticFilter,
    columnQualityFilter,
    setColumnQualityFilter,
    setSelectedColumn,
    setDrawerOpen,
    hiddenCols,
    toggleColVis,
    columnsDensity,
    setColumnsDensity,
    q,
    activeViewName,
    table,
    selected,
    drawerOpen,
    totalCols,
    sampleRows,
    fullRows,
    summaryParts,
    clearAllFilters,
    hasAnyRole,
    data,
  }
}
