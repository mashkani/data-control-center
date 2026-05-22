import type { ColumnProfile, DatasetProfile, SemanticType } from '@/api/types'
import { migrateChartSpecFields, parseChartType } from '@/features/charts/chartSpecMigrators'


export const CHART_MAX_ROWS = 5000
export const CHART_SPEC_VERSION = 4
export const DEFAULT_HISTOGRAM_BINS = 12
export const DEFAULT_BAR_TOP_N = 25

export type ChartAggregation =
  | 'none'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'median'
  | 'stddev'
  | 'p25'
  | 'p75'
  | 'count'
  | 'count_distinct'
export type ChartBucket = 'none' | 'day' | 'week' | 'month' | 'quarter' | 'year'
export type ChartFilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'starts_with'
  | 'in'
  | 'is_null'
  | 'is_not_null'
export type ChartYAxisScale = 'auto' | 'zero' | 'manual'
export type ChartType = 'histogram' | 'line' | 'bar' | 'scatter'

export type ChartFilter = {
  id: string
  column: string
  operator: ChartFilterOperator
  value: string
}

export type ChartReferenceLine = {
  id: string
  label: string
  value: string
}

export type ChartSpec = {
  version: number
  datasetId: string
  chartType: ChartType
  valueColumn: string
  valueColumnInteger: boolean
  binCount: number
  xColumn: string
  xColumnBucketable: boolean
  xColumnTemporalKind: 'continuous_datetime' | 'discrete_period' | null
  yColumns: string[]
  aggregation: ChartAggregation
  bucket: ChartBucket
  filters: ChartFilter[]
  splitBy: string
  yAxisScale: ChartYAxisScale
  yAxisMin: string
  yAxisMax: string
  referenceLines: ChartReferenceLine[]
  showDataZoom: boolean
  title: string
  showLegend: boolean
  smooth: boolean
  showPoints: boolean
  connectNulls: boolean
  xAxisLabel: string
  yAxisLabel: string
  topN: number
}

export type ChartDataPoint = {
  x: string | number
  values: Record<string, number | null>
  lowerBound?: number | null
  upperBound?: number | null
}

export type ChartValidation = {
  valid: boolean
  reason: string | null
}

function uniqueNames(names: string[]): string[] {
  return [...new Set(names.filter(Boolean))]
}

/** Ascending locale order for column pickers in the Charts UI. */
export function sortColumnNamesAsc(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b))
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

function columnProfile(profile: DatasetProfile | undefined, column: string): ColumnProfile | undefined {
  return profile?.column_profiles.find((c) => c.name === column)
}

export function getColumnSemanticType(profile: DatasetProfile | undefined, column: string): SemanticType | 'unknown' {
  return columnProfile(profile, column)?.semantic_type ?? 'unknown'
}

function isIntegerPhysicalType(physicalType: string | undefined): boolean {
  return /\bU?Int(8|16|32|64)\b|BIGINT|INTEGER|SMALLINT|TINYINT|HUGEINT|UBIGINT|UINTEGER|USMALLINT|UTINYINT/i.test(physicalType ?? '')
}

export function getColumnIsInteger(profile: DatasetProfile | undefined, column: string): boolean {
  return isIntegerPhysicalType(columnProfile(profile, column)?.physical_type)
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

export function getTemporalKind(
  profile: DatasetProfile | undefined,
  column: string,
): 'continuous_datetime' | 'discrete_period' | null {
  if (!profile || !column) return null
  const temporalInfo = [
    ...(profile.primary_temporal_column ? [profile.primary_temporal_column] : []),
    ...profile.temporal_columns,
  ].find((c) => c.name === column)
  if (temporalInfo) return temporalInfo.kind
  return columnProfile(profile, column)?.semantic_type === 'datetime' ? 'continuous_datetime' : null
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

function getDefaultHistogramColumn(profile: DatasetProfile | undefined, numericColumns = getNumericColumnNames(profile)): string {
  return numericColumns.find((name) => (columnProfile(profile, name)?.histogram?.length ?? 0) > 0) ?? numericColumns[0] ?? ''
}

export function getSplitColumnNames(profile: DatasetProfile | undefined): string[] {
  if (!profile) return []
  return profile.column_profiles
    .filter((c) => ['categorical', 'boolean_like', 'id_like'].includes(c.semantic_type))
    .map((c) => c.name)
}

export function getCategoryColumnNames(profile: DatasetProfile | undefined): string[] {
  if (!profile) return []
  return profile.column_profiles
    .filter(
      (c) =>
        ['categorical', 'boolean_like', 'id_like'].includes(c.semantic_type) ||
        (c.semantic_type === 'text' && (c.cardinality ?? 999) <= 50),
    )
    .map((c) => c.name)
}

export function isCategoryColumn(profile: DatasetProfile | undefined, column: string): boolean {
  return column ? getCategoryColumnNames(profile).includes(column) : false
}

export function getDefaultCategoryColumn(profile: DatasetProfile | undefined): string {
  const names = getCategoryColumnNames(profile)
  const preferred = names.find((name) => {
    const cardinality = getColumnCardinality(profile, name)
    return cardinality != null && cardinality >= 2 && cardinality <= 50
  })
  return preferred ?? names[0] ?? ''
}

export function getDefaultScatterColumns(profile: DatasetProfile | undefined): { x: string; y: string } {
  const numeric = getNumericColumnNames(profile)
  return { x: numeric[0] ?? '', y: numeric[1] ?? numeric[0] ?? '' }
}

export function isBarCountOnly(spec: ChartSpec): boolean {
  return spec.aggregation === 'count' && !spec.yColumns[0]
}

export function getFilterColumnNames(profile: DatasetProfile | undefined): string[] {
  if (!profile) return []
  return profile.column_profiles.map((c) => c.name)
}

export function getColumnCardinality(profile: DatasetProfile | undefined, column: string): number | null {
  return columnProfile(profile, column)?.cardinality ?? null
}

function buildChartSpec(
  datasetId: string,
  profile: DatasetProfile | undefined,
  chartType: ChartType,
  partial: Partial<ChartSpec> = {},
): ChartSpec {
  const temporalX = getTemporalColumnNames(profile)[0] ?? ''
  const numericColumns = getNumericColumnNames(profile)
  const categoryColumn = getDefaultCategoryColumn(profile)
  const scatterColumns = getDefaultScatterColumns(profile)
  const valueColumn = getDefaultHistogramColumn(profile, numericColumns)
  const lineX = temporalX
  const lineYColumns = numericColumns.filter((name) => name !== lineX).slice(0, 3)
  const lineBucketable = isBucketableTemporalColumn(profile, lineX)
  const barMeasure = numericColumns[0] ?? ''
  const barCountOnly = !barMeasure

  const xColumn =
    chartType === 'bar'
      ? categoryColumn
      : chartType === 'scatter'
        ? scatterColumns.x
        : chartType === 'histogram'
          ? temporalX
          : lineX
  const yColumns =
    chartType === 'scatter'
      ? scatterColumns.y ? [scatterColumns.y] : []
      : chartType === 'bar'
        ? barCountOnly
          ? []
          : [barMeasure]
        : chartType === 'histogram'
          ? lineYColumns
          : lineYColumns
  const xColumnBucketable = chartType === 'line' ? lineBucketable : false
  const xColumnTemporalKind = chartType === 'line' ? getTemporalKind(profile, lineX) : null

  return {
    version: CHART_SPEC_VERSION,
    datasetId,
    chartType,
    valueColumn,
    valueColumnInteger: getColumnIsInteger(profile, valueColumn),
    binCount: DEFAULT_HISTOGRAM_BINS,
    xColumn,
    xColumnBucketable,
    xColumnTemporalKind,
    yColumns,
    aggregation:
      chartType === 'bar'
        ? barCountOnly
          ? 'count'
          : 'sum'
        : chartType === 'scatter'
          ? 'none'
          : 'avg',
    bucket: chartType === 'line' && lineBucketable ? 'month' : 'none',
    filters: [],
    splitBy: '',
    topN: DEFAULT_BAR_TOP_N,
    yAxisScale: chartType === 'histogram' || chartType === 'bar' ? 'zero' : 'auto',
    yAxisMin: '',
    yAxisMax: '',
    referenceLines: [],
    showDataZoom: chartType !== 'scatter',
    title:
      chartType === 'histogram'
        ? valueColumn
          ? `${valueColumn} distribution`
          : 'Dataset distribution'
        : chartType === 'bar'
          ? categoryColumn
            ? barCountOnly
              ? `${categoryColumn} by count`
              : `${categoryColumn} by ${barMeasure}`
            : 'Category comparison'
          : chartType === 'scatter'
            ? scatterColumns.x && scatterColumns.y
              ? `${scatterColumns.y} vs ${scatterColumns.x}`
              : 'Scatter plot'
            : profile?.name
              ? `${profile.name} trends`
              : 'Dataset trends',
    showLegend: true,
    smooth: false,
    showPoints: false,
    connectNulls: false,
    xAxisLabel:
      chartType === 'histogram'
        ? valueColumn
        : chartType === 'bar'
          ? categoryColumn
          : chartType === 'scatter'
            ? scatterColumns.x
            : lineX,
    yAxisLabel:
      chartType === 'histogram' || (chartType === 'bar' && barCountOnly)
        ? 'Count'
        : chartType === 'scatter'
          ? scatterColumns.y
          : '',
    ...partial,
  }
}

export function createDefaultChartSpec(datasetId: string, profile: DatasetProfile | undefined): ChartSpec {
  const numericColumns = getNumericColumnNames(profile)
  const valueColumn = getDefaultHistogramColumn(profile, numericColumns)
  const categoryColumn = getDefaultCategoryColumn(profile)
  const temporalX = getTemporalColumnNames(profile)[0] ?? ''
  const scatterColumns = getDefaultScatterColumns(profile)

  let chartType: ChartType = 'line'
  if (valueColumn) chartType = 'histogram'
  else if (categoryColumn) chartType = 'bar'
  else if (temporalX) chartType = 'line'
  else if (scatterColumns.x && scatterColumns.y && scatterColumns.x !== scatterColumns.y) chartType = 'scatter'

  return buildChartSpec(datasetId, profile, chartType)
}

export function normalizeChartSpec(
  raw: Partial<ChartSpec> | undefined,
  datasetId: string,
  profile: DatasetProfile | undefined,
): ChartSpec {
  const base = createDefaultChartSpec(datasetId, profile)
  if (!raw || typeof raw !== 'object') return base
  const rawVersion = typeof raw.version === 'number' ? raw.version : 2
  const migrated = migrateChartSpecFields(raw, rawVersion)
  const chartType = parseChartType(migrated, rawVersion, base)
  const normalizedBase = buildChartSpec(datasetId, profile, chartType)
  const yColumns = uniqueNames(Array.isArray(migrated.yColumns) ? migrated.yColumns : normalizedBase.yColumns)
  const splitBy = typeof migrated.splitBy === 'string' ? migrated.splitBy : ''
  const xColumn = typeof migrated.xColumn === 'string' ? migrated.xColumn : normalizedBase.xColumn
  const valueColumn = typeof migrated.valueColumn === 'string'
    ? migrated.valueColumn
    : chartType === 'histogram'
      ? getDefaultHistogramColumn(profile)
      : normalizedBase.valueColumn
  const binCount = Number(migrated.binCount)
  const topN = Number(migrated.topN)
  const valueColumnInteger = typeof migrated.valueColumnInteger === 'boolean'
    ? migrated.valueColumnInteger
    : getColumnIsInteger(profile, valueColumn)
  const limitedYColumns =
    splitBy && yColumns.length > 1 && chartType !== 'histogram' ? yColumns.slice(0, 1) : yColumns

  const spec: ChartSpec = {
    ...normalizedBase,
    ...migrated,
    version: CHART_SPEC_VERSION,
    datasetId,
    chartType,
    valueColumn,
    valueColumnInteger,
    binCount: Number.isInteger(binCount) && binCount > 0 ? Math.min(binCount, 100) : DEFAULT_HISTOGRAM_BINS,
    topN: Number.isInteger(topN) && topN > 0 ? Math.min(topN, 100) : DEFAULT_BAR_TOP_N,
    yColumns: limitedYColumns,
    filters: Array.isArray(raw.filters) ? raw.filters : [],
    referenceLines: Array.isArray(raw.referenceLines) ? raw.referenceLines : [],
    splitBy,
    xColumn,
    xColumnBucketable: chartType === 'line' ? isBucketableTemporalColumn(profile, xColumn) : false,
    xColumnTemporalKind: chartType === 'line' ? getTemporalKind(profile, xColumn) : null,
  }

  if (chartType === 'scatter') {
    spec.aggregation = 'none'
    spec.bucket = 'none'
    spec.referenceLines = []
    spec.smooth = false
    spec.showPoints = false
    spec.connectNulls = false
    if (splitBy && spec.yColumns.length > 1) spec.yColumns = spec.yColumns.slice(0, 1)
  }

  if (chartType === 'bar' && spec.aggregation === 'count' && !spec.yColumns[0]) {
    spec.yColumns = []
  }

  return spec
}

function validateManualYScale(spec: ChartSpec): ChartValidation {
  if (spec.yAxisScale !== 'manual') return { valid: true, reason: null }
  const min = Number(spec.yAxisMin)
  const max = Number(spec.yAxisMax)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return { valid: false, reason: 'Manual Y scale requires a numeric min smaller than max.' }
  }
  return { valid: true, reason: null }
}

export function validateChartSpec(
  spec: ChartSpec,
  viewName: string | undefined,
  profile?: DatasetProfile,
): ChartValidation {
  if (!spec.datasetId || !viewName) return { valid: false, reason: 'Select a dataset to build a chart.' }

  if (spec.chartType === 'histogram') {
    if (!spec.valueColumn) return { valid: false, reason: 'Choose a numeric variable for the histogram.' }
    if (!Number.isInteger(spec.binCount) || spec.binCount < 1 || spec.binCount > 100) {
      return { valid: false, reason: 'Histogram bins must be an integer from 1 to 100.' }
    }
    return validateManualYScale(spec)
  }

  if (spec.chartType === 'bar') {
    if (!spec.xColumn) return { valid: false, reason: 'Choose a category column for the bar chart.' }
    if (profile && !isCategoryColumn(profile, spec.xColumn)) {
      return { valid: false, reason: 'Bar charts require a categorical column on the X axis.' }
    }
    if (!isBarCountOnly(spec) && !spec.yColumns[0]) {
      return { valid: false, reason: 'Choose a numeric measure or use Count aggregation.' }
    }
    if (spec.aggregation === 'none') {
      return { valid: false, reason: 'Choose an aggregation for the bar chart.' }
    }
    if (!Number.isInteger(spec.topN) || spec.topN < 1 || spec.topN > 100) {
      return { valid: false, reason: 'Top N must be an integer from 1 to 100.' }
    }
    if (spec.splitBy && !isBarCountOnly(spec) && spec.yColumns.length !== 1) {
      return { valid: false, reason: 'Split bar charts support exactly one measure.' }
    }
    return validateManualYScale(spec)
  }

  if (spec.chartType === 'scatter') {
    if (!spec.xColumn || !spec.yColumns[0]) {
      return { valid: false, reason: 'Choose numeric X and Y variables for the scatter plot.' }
    }
    if (spec.xColumn === spec.yColumns[0]) {
      return { valid: false, reason: 'Scatter plots require two different numeric columns.' }
    }
    if (profile) {
      const numeric = getNumericColumnNames(profile)
      if (!numeric.includes(spec.xColumn) || !numeric.includes(spec.yColumns[0])) {
        return { valid: false, reason: 'Scatter plots require numeric columns for X and Y.' }
      }
    }
    if (spec.splitBy && spec.yColumns.length !== 1) {
      return { valid: false, reason: 'Split scatter plots support exactly one Y variable.' }
    }
    return validateManualYScale(spec)
  }

  if (!spec.xColumn) return { valid: false, reason: 'Choose a temporal column for the X axis.' }
  if (!spec.yColumns.length) return { valid: false, reason: 'Choose at least one numeric variable.' }
  if (spec.splitBy && spec.yColumns.length !== 1) {
    return { valid: false, reason: 'Split charts support exactly one Y variable.' }
  }
  const manual = validateManualYScale(spec)
  if (!manual.valid) return manual
  for (const line of spec.referenceLines) {
    if (line.value.trim() && !Number.isFinite(Number(line.value))) {
      return { valid: false, reason: 'Reference line values must be numeric.' }
    }
  }
  return { valid: true, reason: null }
}
