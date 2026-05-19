import { flexRender, type Table as TableInstance } from '@tanstack/react-table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ColumnProfile } from '@/api/types'
import type { ColumnsDensity } from '@/store/uiStore'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { columnRowSeverity } from '@/features/columns/columnsTableConstants'
import { cn } from '@/lib/utils'

type ColumnsTableProps = {
  activeId: string
  table: TableInstance<ColumnProfile>
  setSelectedColumn: (name: string) => void
  setDrawerOpen: (open: boolean) => void
  density: ColumnsDensity
}

export function ColumnsTable({
  activeId,
  table,
  setSelectedColumn,
  setDrawerOpen,
  density,
}: ColumnsTableProps) {
  const rowPadding = density === 'compact' ? 'py-1.5' : 'py-2.5'
  const stickyBg =
    'bg-[hsl(var(--bg-1))]/95 data-[severity=critical]:bg-[hsl(var(--severity-critical))]/[0.06] data-[severity=warning]:bg-[hsl(var(--severity-warning))]/[0.05] group-hover:bg-white/[0.04]'

  return (
    <Table>
      <caption className="sr-only">Columns for dataset {activeId}</caption>
      <THead className="sticky top-0 z-10 bg-[hsl(var(--bg-1))]/95 backdrop-blur">
        {table.getHeaderGroups().map((hg) => (
          <TR key={hg.id}>
            {hg.headers.map((h) => {
              const sorted = h.column.getIsSorted()
              const isName = h.column.id === 'name'
              return (
                <TH
                  key={h.id}
                  scope="col"
                  className={cn(
                    rowPadding,
                    isName &&
                      'sticky left-0 z-30 w-[min(28rem,40vw)] min-w-[12rem] max-w-[min(28rem,40vw)] border-r border-border-default bg-[hsl(var(--bg-1))]/95 backdrop-blur',
                  )}
                  aria-sort={
                    sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                  }
                >
                  {h.isPlaceholder ? null : h.column.getCanSort() ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 font-medium"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sorted === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 opacity-70" aria-hidden />
                      ) : sorted === 'desc' ? (
                        <ArrowDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                      ) : null}
                    </button>
                  ) : (
                    <span className="font-medium">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </span>
                  )}
                </TH>
              )
            })}
          </TR>
        ))}
      </THead>
      <TBody>
        {table.getRowModel().rows.map((row) => {
          const severity = columnRowSeverity(row.original.quality_flags)
          return (
            <TR
              key={row.id}
              data-severity={severity}
              className={cn(
                'group cursor-pointer',
                'data-[severity=critical]:bg-[hsl(var(--severity-critical))]/[0.06]',
                'data-[severity=warning]:bg-[hsl(var(--severity-warning))]/[0.05]',
                'hover:bg-white/[0.04]',
              )}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  const name = row.original.name
                  setSelectedColumn(name)
                  setDrawerOpen(true)
                }
              }}
              onClick={() => {
                const name = row.original.name
                setSelectedColumn(name)
                setDrawerOpen(true)
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <TD
                  key={cell.id}
                  data-severity={severity}
                  className={cn(
                    rowPadding,
                    cell.column.id === 'name' &&
                      cn(
                        'sticky left-0 z-20 w-[min(28rem,40vw)] min-w-[12rem] max-w-[min(28rem,40vw)] border-r border-border-default backdrop-blur',
                        stickyBg,
                      ),
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TD>
              ))}
            </TR>
          )
        })}
      </TBody>
    </Table>
  )
}
