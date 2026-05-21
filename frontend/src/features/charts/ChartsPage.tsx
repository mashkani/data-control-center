import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { LineChart, Play, RotateCcw, Terminal } from 'lucide-react'
import { api } from '@/api/client'
import type { DatasetProfile } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QueryErrorBanner } from '@/components/ui/query-error-banner'
import { PageContainer } from '@/components/ui/section'
import { CardSkeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { useDisposableEChart } from '@/hooks/useDisposableEChart'
import { useOpenInSql } from '@/hooks/useOpenInSql'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'
import {
  buildLineChartOption,
  buildLineChartSql,
  CHART_MAX_ROWS,
  createDefaultChartSpec,
  getNumericColumnNames,
  getTemporalColumnNames,
  isBucketableTemporalColumn,
  queryResultToChartData,
  validateChartSpec,
  type ChartAggregation,
  type ChartBucket,
  type ChartSpec,
} from '@/features/charts/chartUtils'

const AGGREGATIONS: Array<{ value: ChartAggregation; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'avg', label: 'Average' },
  { value: 'sum', label: 'Sum' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
]

const BUCKETS: Array<{ value: ChartBucket; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs text-fg-muted">
      <span className="block font-medium text-fg">{label}</span>
      {children}
    </label>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex h-8 items-center gap-2 rounded-md border border-border-default bg-black/20 px-2 text-xs text-fg">
      <input
        type="checkbox"
        className="h-4 w-4 accent-[hsl(var(--accent))]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

function nativeSelectClassName(disabled?: boolean): string {
  return cn(
    'h-8 w-full rounded-md border border-border-default bg-black/30 px-2 text-sm text-fg outline-none',
    'focus:border-border-accent focus:ring-2 focus:ring-[hsl(var(--accent)_/_0.18)]',
    disabled && 'cursor-not-allowed opacity-50',
  )
}

function ChartsWorkspace({
  activeId,
  profile,
  viewName,
}: {
  activeId: string
  profile: DatasetProfile
  viewName: string | undefined
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const openInSql = useOpenInSql()
  const [spec, setSpec] = useState<ChartSpec>(() => createDefaultChartSpec(activeId, profile))
  const [hasRun, setHasRun] = useState(false)
  const [lastRunSql, setLastRunSql] = useState('')
  const runChart = useMutation({ mutationFn: api.runQuery })

  const temporalColumns = useMemo(() => getTemporalColumnNames(profile), [profile])
  const numericColumns = useMemo(() => getNumericColumnNames(profile), [profile])

  const validation = useMemo(() => validateChartSpec(spec, viewName), [spec, viewName])
  const generatedSql = useMemo(
    () => (validation.valid && viewName ? buildLineChartSql(spec, viewName) : ''),
    [spec, validation.valid, viewName],
  )
  const chartData = useMemo(
    () => queryResultToChartData(runChart.data, spec.yColumns),
    [runChart.data, spec.yColumns],
  )
  const option = useMemo(() => buildLineChartOption(spec, chartData), [spec, chartData])
  const canRenderChart = hasRun && chartData.length > 0 && !runChart.data?.error
  const settingsChanged = hasRun && !!generatedSql && !!lastRunSql && generatedSql !== lastRunSql

  useDisposableEChart(chartRef, canRenderChart, () => option, [option, canRenderChart])

  const patchSpec = (patch: Partial<ChartSpec>) => {
    setSpec((cur) => ({ ...cur, ...patch }))
  }

  const execute = () => {
    if (!validation.valid || !generatedSql) return
    setHasRun(true)
    setLastRunSql(generatedSql)
    runChart.mutate({ sql: generatedSql, max_rows: CHART_MAX_ROWS })
  }

  const runError = runChart.isError ? (runChart.error as Error).message : runChart.data?.error

  return (
    <PageContainer className="flex h-full min-h-[calc(100vh-9rem)] flex-col gap-3 overflow-hidden p-4 space-y-0">
      <div className="flex flex-none flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-fg">
            <LineChart className="h-4 w-4 text-fg-muted" aria-hidden />
            Charts
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            Build a multi-variable line chart from the active dataset.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setSpec(createDefaultChartSpec(activeId, profile))}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset
          </Button>
          <Tooltip content="Open generated SQL in the SQL tab">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={!generatedSql}
              onClick={() => openInSql(generatedSql)}
            >
              <Terminal className="h-3.5 w-3.5" aria-hidden />
              SQL
            </Button>
          </Tooltip>
          <Button
            size="sm"
            className="gap-1"
            loading={runChart.isPending}
            disabled={!validation.valid || runChart.isPending}
            onClick={execute}
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            Run chart
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[20rem_minmax(0,1fr)] 2xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-hidden rounded-lg border border-border-default bg-black/20 p-2.5">
          <div className="grid max-h-full gap-2 overflow-y-auto pr-1">
            <Field label="X axis">
              <select
                className={nativeSelectClassName()}
                value={spec.xColumn}
                onChange={(e) => {
                  const xColumn = e.target.value
                  const xColumnBucketable = isBucketableTemporalColumn(profile, xColumn)
                  patchSpec({
                    xColumn,
                    xColumnBucketable,
                    xAxisLabel: xColumn,
                    bucket: xColumnBucketable ? spec.bucket : 'none',
                  })
                }}
              >
                {temporalColumns.length === 0 ? <option value="">No temporal columns</option> : null}
                {temporalColumns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </Field>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-fg">Y variables</legend>
              <div className="max-h-36 space-y-0.5 overflow-auto rounded-md border border-border-default bg-black/20 p-2">
                {numericColumns.length === 0 ? (
                  <p className="text-xs text-fg-muted">No numeric variables detected.</p>
                ) : (
                  numericColumns.map((column) => (
                    <label key={column} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs text-fg">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[hsl(var(--accent))]"
                        checked={spec.yColumns.includes(column)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...spec.yColumns, column]
                            : spec.yColumns.filter((name) => name !== column)
                          patchSpec({ yColumns: next })
                        }}
                      />
                      <span className="min-w-0 truncate" title={column}>
                        {column}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Aggregation">
                <select
                  className={nativeSelectClassName()}
                  value={spec.aggregation}
                  onChange={(e) => {
                    const aggregation = e.target.value as ChartAggregation
                    patchSpec({ aggregation, bucket: aggregation === 'none' ? 'none' : spec.bucket })
                  }}
                >
                  {AGGREGATIONS.map((aggregation) => (
                    <option key={aggregation.value} value={aggregation.value}>
                      {aggregation.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bucket">
                <select
                  className={nativeSelectClassName(spec.aggregation === 'none' || !spec.xColumnBucketable)}
                  value={spec.bucket}
                  disabled={spec.aggregation === 'none' || !spec.xColumnBucketable}
                  onChange={(e) => patchSpec({ bucket: e.target.value as ChartBucket })}
                >
                  {BUCKETS.map((bucket) => (
                    <option key={bucket.value} value={bucket.value}>
                      {bucket.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Title">
              <Input className="h-8" value={spec.title} onChange={(e) => patchSpec({ title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="X label">
                <Input className="h-8" value={spec.xAxisLabel} onChange={(e) => patchSpec({ xAxisLabel: e.target.value })} />
              </Field>
              <Field label="Y label">
                <Input className="h-8" value={spec.yAxisLabel} onChange={(e) => patchSpec({ yAxisLabel: e.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ToggleField label="Legend" checked={spec.showLegend} onChange={(showLegend) => patchSpec({ showLegend })} />
              <ToggleField label="Smooth" checked={spec.smooth} onChange={(smooth) => patchSpec({ smooth })} />
              <ToggleField label="Points" checked={spec.showPoints} onChange={(showPoints) => patchSpec({ showPoints })} />
              <ToggleField
                label="Connect nulls"
                checked={spec.connectNulls}
                onChange={(connectNulls) => patchSpec({ connectNulls })}
              />
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border-default bg-black/20">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default px-3 py-2">
            <div className="text-sm font-medium text-fg">Preview</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              {settingsChanged ? <span>Settings changed</span> : null}
              {runChart.data?.truncated ? (
                <span className="rounded-full border border-border-default bg-black/30 px-2 py-0.5">
                  Truncated at {formatCount(CHART_MAX_ROWS)} rows
                </span>
              ) : null}
              {runChart.data && !runChart.data.error ? (
                <span className="tabular-nums">{formatCount(runChart.data.row_count)} rows</span>
              ) : null}
            </div>
          </div>

          {!validation.valid ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-fg-muted">
              {validation.reason}
            </div>
          ) : runError ? (
            <div className="p-4">
              <QueryErrorBanner message={runError} onRetry={execute} />
            </div>
          ) : !hasRun ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-fg-muted">
              Configure the chart and run it to preview results.
            </div>
          ) : runChart.isPending ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-fg-muted">
              Running chart query…
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-fg-muted">
              The chart query returned no plottable rows.
            </div>
          ) : (
            <div ref={chartRef} className="min-h-[24rem] flex-1" data-testid="charts-preview" />
          )}
        </section>
      </div>
    </PageContainer>
  )
}

export function ChartsPage() {
  const activeId = useUiStore((s) => s.activeDatasetId)
  const dsQ = useQuery({ queryKey: ['datasets'], queryFn: api.listDatasets })
  const profileQ = useQuery({
    queryKey: ['profile', activeId],
    queryFn: () => api.fetchDatasetProfile(activeId!),
    enabled: !!activeId,
  })

  const activeSummary = useMemo(
    () => dsQ.data?.find((d) => d.dataset_id === activeId),
    [dsQ.data, activeId],
  )

  if (!activeId) {
    return (
      <PageContainer>
        <p className="text-sm text-fg-muted">Select a dataset.</p>
      </PageContainer>
    )
  }

  if (dsQ.isLoading || profileQ.isLoading) {
    return (
      <PageContainer>
        <CardSkeleton />
        <CardSkeleton />
      </PageContainer>
    )
  }

  if (dsQ.isError) {
    return (
      <PageContainer>
        <QueryErrorBanner message={(dsQ.error as Error).message} onRetry={() => void dsQ.refetch()} />
      </PageContainer>
    )
  }

  if (profileQ.isError) {
    return (
      <PageContainer>
        <QueryErrorBanner message={(profileQ.error as Error).message} onRetry={() => void profileQ.refetch()} />
      </PageContainer>
    )
  }

  return (
    <ChartsWorkspace
      key={`${activeId}:${profileQ.dataUpdatedAt}`}
      activeId={activeId}
      profile={profileQ.data!}
      viewName={activeSummary?.view_name}
    />
  )
}
