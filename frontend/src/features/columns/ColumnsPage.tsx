import { PageContainer } from '@/components/ui/section'
import { TableSkeleton } from '@/components/ui/skeleton'
import { QueryErrorBanner } from '@/components/ui/query-error-banner'
import { ColumnDetailDrawer } from '@/features/columns/ColumnDetailDrawer'
import { ColumnsToolbar } from '@/features/columns/ColumnsToolbar'
import { ColumnsTable } from '@/features/columns/ColumnsTable'
import { useColumnsTable } from '@/features/columns/useColumnsTable'

export function ColumnsPage() {
  const {
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
    data,
  } = useColumnsTable()

  if (!activeId) {
    return (
      <PageContainer>
        <p className="text-sm text-[hsl(var(--fg-muted))]">Select a dataset.</p>
      </PageContainer>
    )
  }

  if (q.isLoading) {
    return (
      <PageContainer>
        <TableSkeleton rows={8} cols={10} />
      </PageContainer>
    )
  }

  if (q.isError) {
    return (
      <PageContainer>
        <QueryErrorBanner message={(q.error as Error).message} onRetry={() => void q.refetch()} />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <ColumnsToolbar
        activeId={activeId}
        columnSearch={columnSearch}
        setColumnSearch={setColumnSearch}
        semanticFilter={semanticFilter}
        setSemanticFilter={setSemanticFilter}
        columnQualityFilter={columnQualityFilter}
        setColumnQualityFilter={setColumnQualityFilter}
        hiddenCols={hiddenCols}
        toggleColVis={toggleColVis}
        columnsDensity={columnsDensity}
        setColumnsDensity={setColumnsDensity}
        filteredCount={data.length}
        totalCols={totalCols}
        sampleRows={sampleRows}
        fullRows={fullRows}
        summaryParts={summaryParts}
        clearAllFilters={clearAllFilters}
      />

      <ColumnsTable
        activeId={activeId}
        table={table}
        setSelectedColumn={setSelectedColumn}
        setDrawerOpen={setDrawerOpen}
        density={columnsDensity}
      />

      <ColumnDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        column={selected}
        viewName={activeViewName}
      />
    </PageContainer>
  )
}
