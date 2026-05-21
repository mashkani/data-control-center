import type { EChartsCoreOption } from 'echarts'
import type { DatasetProfile, QueryResult } from '@/api/types'
import { chartAxisLabelStyle, chartPalette, chartTooltip, hslFromRootVar } from '@/lib/chartTheme'
import { formatAnalyticsSql, quoteIdent } from '@/lib/sql'

export const CHART_MAX_ROWS = 5000

export type ChartAggregation = 'none' | 'sum' | 'avg' | 'min' | 'max'
export type ChartBucket = 'none' | 'day' | 'week' | 'month' | 'quarter' | 'year'

export type ChartSpec = {
  datasetId: string
  chartType: 'line'
  xColumn: string
  xColumnBucketable: boolean
  yColumns: string[]
  aggregation: ChartAggregation
  bucket: ChartBucket
  title: string
  showLegend: boolean
  smooth: boolean
  showPoints: boolean
  connectNulls: boolean
  xAxisLabel: string
  yAxisLabel: string
}

export type ChartDataPoint = {
  x: string | number
  values: Record<string, number | null>
}

export type ChartValidation = {
  valid: boolean
  reason: string | null
}

export function getTemporalColumnNames(profile: DatasetProfile | undefined): string[] {
  if (!profile) return []
  const names = new Set<string>()
  if (profile.primary_temporal_column?.name) names.add(profile.primary_temporal_column.name)
  for (const c of profile.temporal_columns) names.add(c.name)
  for (const c of profile.column_profiles) {
    if (c.semantic_type === 'datetime') names.add(c.name)
  }
  return [...names]
}

export function isBucketableTemporalColumn(profile: DatasetProfile | undefined, column: string): boolean {
  if (!profile || !column) return false
  const temporalInfo = [
    ...(profile.primary_temporal_column ? [profile.primary_temporal_column] : []),
    ...profile.temporal_columns,
  ].find((c) => c.name === column)
  if (temporalInfo) return temporalInfo.kind === 'continuous_datetime'
  return profile.column_profiles.some((c) => c.name === column && c.semantic_type === 'datetime')
}

export function getNumericColumnNames(profile: DatasetProfile | undefined): string[] {
  if (!profile) return []
  const numeric = new Set(
    profile.column_profiles.filter((c) => c.semantic_type === 'numeric').map((c) => c.name),
  )
  if (!numeric.size && profile.measure_candidates.length) {
    return profile.measure_candidates.map((c) => c.name)
  }

  const ordered: string[] = []
  for (const c of profile.measure_candidates) {
    if (numeric.has(c.name) && !ordered.includes(c.name)) ordered.push(c.name)
  }
  for (const name of numeric) {
    if (!ordered.includes(name)) ordered.push(name)
  }
  return ordered
}

export function createDefaultChartSpec(datasetId: string, profile: DatasetProfile | undefined): ChartSpec {
  const xColumn = getTemporalColumnNames(profile)[0] ?? ''
  const yColumns = getNumericColumnNames(profile).filter((name) => name !== xColumn).slice(0, 3)
  const xColumnBucketable = isBucketableTemporalColumn(profile, xColumn)
  return {
    datasetId,
    chartType: 'line',
    xColumn,
    xColumnBucketable,
    yColumns,
    aggregation: 'avg',
    bucket: xColumnBucketable ? 'month' : 'none',
    title: profile?.name ? `${profile.name} trends` : 'Dataset trends',
    showLegend: true,
    smooth: false,
    showPoints: false,
    connectNulls: false,
    xAxisLabel: xColumn,
    yAxisLabel: '',
  }
}

export function validateChartSpec(spec: ChartSpec, viewName: string | undefined): ChartValidation {
  if (!spec.datasetId || !viewName) return { valid: false, reason: 'Select a dataset to build a chart.' }
  if (!spec.xColumn) return { valid: false, reason: 'Choose a temporal column for the X axis.' }
  if (!spec.yColumns.length) return { valid: false, reason: 'Choose at least one numeric variable.' }
  return { valid: true, reason: null }
}

function xExpression(spec: ChartSpec): string {
  const quoted = quoteIdent(spec.xColumn)
  if (spec.aggregation === 'none' || spec.bucket === 'none' || !spec.xColumnBucketable) return quoted
  return `date_trunc('${spec.bucket}', ${quoted})`
}

function aggregationExpression(aggregation: Exclude<ChartAggregation, 'none'>, column: string): string {
  return `${aggregation}(${quoteIdent(column)})`
}

export function buildLineChartSql(spec: ChartSpec, viewName: string): string {
  const view = quoteIdent(viewName)
  const xExpr = xExpression(spec)
  const xAlias = quoteIdent('x')
  const where = `${quoteIdent(spec.xColumn)} IS NOT NULL`
  const aggregation = spec.aggregation

  if (aggregation === 'none') {
    const selectCols = spec.yColumns.map((column) => quoteIdent(column)).join(', ')
    return formatAnalyticsSql(
      `SELECT ${xExpr} AS ${xAlias}, ${selectCols} FROM ${view} WHERE ${where} ORDER BY ${xAlias} LIMIT ${CHART_MAX_ROWS};`,
    )
  }

  const selectMeasures = spec.yColumns
    .map((column) => `${aggregationExpression(aggregation, column)} AS ${quoteIdent(column)}`)
    .join(', ')
  return formatAnalyticsSql(
    `SELECT ${xExpr} AS ${xAlias}, ${selectMeasures} FROM ${view} WHERE ${where} GROUP BY 1 ORDER BY ${xAlias} LIMIT ${CHART_MAX_ROWS};`,
  )
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizeX(value: unknown): string | number {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

export function queryResultToChartData(result: QueryResult | undefined, yColumns: string[]): ChartDataPoint[] {
  if (!result?.rows.length || result.error) return []
  return result.rows.map((row) => {
    const values: Record<string, number | null> = {}
    for (const column of yColumns) values[column] = toNumberOrNull(row[column])
    return { x: normalizeX(row.x), values }
  })
}

export function buildLineChartOption(spec: ChartSpec, data: ChartDataPoint[]): EChartsCoreOption {
  const palette = chartPalette()
  return {
    color: palette,
    backgroundColor: 'transparent',
    title: spec.title
      ? {
          text: spec.title,
          left: 8,
          top: 0,
          textStyle: { color: hslFromRootVar('--fg'), fontSize: 14, fontWeight: 600 },
        }
      : undefined,
    grid: { left: 16, right: 20, top: spec.title ? 54 : 28, bottom: 42, containLabel: true },
    legend: spec.showLegend
      ? {
          top: spec.title ? 26 : 0,
          right: 8,
          textStyle: { color: hslFromRootVar('--fg-muted'), fontSize: 11 },
        }
      : undefined,
    tooltip: { ...chartTooltip(), trigger: 'axis' },
    xAxis: {
      type: 'category',
      name: spec.xAxisLabel,
      nameLocation: 'middle',
      nameGap: 28,
      data: data.map((point) => point.x),
      axisLabel: { ...chartAxisLabelStyle(), hideOverlap: true },
      axisLine: { lineStyle: { color: hslFromRootVar('--border-triple') } },
    },
    yAxis: {
      type: 'value',
      name: spec.yAxisLabel,
      nameLocation: 'middle',
      nameGap: 44,
      axisLabel: chartAxisLabelStyle(),
      splitLine: { lineStyle: { color: hslFromRootVar('--border-triple', 0.4) } },
    },
    series: spec.yColumns.map((column) => ({
      name: column,
      type: 'line',
      data: data.map((point) => point.values[column]),
      smooth: spec.smooth,
      showSymbol: spec.showPoints,
      connectNulls: spec.connectNulls,
      lineStyle: { width: 2 },
      emphasis: { focus: 'series' },
    })),
  }
}
