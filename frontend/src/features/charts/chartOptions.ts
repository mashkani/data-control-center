import type { EChartsCoreOption } from 'echarts'
import type { QueryResult } from '@/api/types'
import { chartAxisLabelStyle, chartPalette, chartTooltip, hslFromRootVar } from '@/lib/chartTheme'
import { isBarCountOnly, type ChartDataPoint, type ChartSpec } from '@/features/charts/chartSpec'

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

function formatBinValue(value: number | null): string {
  if (value == null) return ''
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function histogramBinLabel(lower: number | null, upper: number | null): string {
  if (lower != null && upper != null && lower === upper) return formatBinValue(lower)
  return `${formatBinValue(lower)} - ${formatBinValue(upper)}`
}

function queryResultToHistogramData(result: QueryResult | undefined, spec: ChartSpec): ChartDataPoint[] {
  if (!result?.rows.length || result.error) return []

  if (spec.splitBy) {
    const byBin = new Map<string, ChartDataPoint>()
    for (const row of result.rows) {
      const lowerBound = toNumberOrNull(row.lower_bound)
      const upperBound = toNumberOrNull(row.upper_bound)
      const x = histogramBinLabel(lowerBound, upperBound)
      const split = String(row.split ?? '(blank)')
      const point = byBin.get(x) ?? { x, values: {}, lowerBound, upperBound }
      point.values[split] = toNumberOrNull(row.count) ?? 0
      byBin.set(x, point)
    }
    return [...byBin.values()]
  }

  return result.rows.map((row) => {
    const lowerBound = toNumberOrNull(row.lower_bound)
    const upperBound = toNumberOrNull(row.upper_bound)
    return {
      x: histogramBinLabel(lowerBound, upperBound),
      lowerBound,
      upperBound,
      values: { Count: toNumberOrNull(row.count) ?? 0 },
    }
  })
}

function barValueFromRow(row: Record<string, unknown>, spec: ChartSpec, yColumns: string[]): number | null {
  if (isBarCountOnly(spec)) return toNumberOrNull(row.count)
  return toNumberOrNull(row.value ?? row[yColumns[0] ?? 'value'])
}

function queryResultToBarData(result: QueryResult | undefined, spec: ChartSpec): ChartDataPoint[] {
  if (!result?.rows.length || result.error) return []
  const yColumns = spec.yColumns
  const seriesKey = isBarCountOnly(spec) ? 'Count' : yColumns[0] ?? 'value'

  if (spec.splitBy) {
    const byX = new Map<string | number, Record<string, number | null>>()
    for (const row of result.rows) {
      const x = normalizeX(row.x)
      const split = String(row.split ?? '(blank)')
      const values = byX.get(x) ?? {}
      values[split] = barValueFromRow(row, spec, yColumns)
      byX.set(x, values)
    }
    return [...byX.entries()].map(([x, values]) => ({ x, values }))
  }

  return result.rows.map((row) => ({
    x: normalizeX(row.x),
    values: { [seriesKey]: barValueFromRow(row, spec, yColumns) },
  }))
}

function queryResultToScatterData(result: QueryResult | undefined, spec: ChartSpec): ChartDataPoint[] {
  if (!result?.rows.length || result.error) return []
  const yColumn = spec.yColumns[0] ?? 'y'

  const points: ChartDataPoint[] = []
  if (spec.splitBy) {
    for (const row of result.rows) {
      const x = toNumberOrNull(row.x)
      if (x == null) continue
      const split = String(row.split ?? '(blank)')
      points.push({ x, values: { [split]: toNumberOrNull(row.y ?? row[yColumn]) } })
    }
    return points
  }

  for (const row of result.rows) {
    const x = toNumberOrNull(row.x)
    const y = toNumberOrNull(row.y ?? row[yColumn])
    if (x == null || y == null) continue
    points.push({ x, values: { [yColumn]: y } })
  }
  return points
}

export function queryResultToChartData(result: QueryResult | undefined, specOrColumns: ChartSpec | string[]): ChartDataPoint[] {
  if (!result?.rows.length || result.error) return []
  const spec = Array.isArray(specOrColumns) ? null : specOrColumns
  if (spec?.chartType === 'histogram') return queryResultToHistogramData(result, spec)
  if (spec?.chartType === 'bar') return queryResultToBarData(result, spec)
  if (spec?.chartType === 'scatter') return queryResultToScatterData(result, spec)
  const yColumns = Array.isArray(specOrColumns) ? specOrColumns : specOrColumns.yColumns

  if (spec?.splitBy) {
    const byX = new Map<string | number, Record<string, number | null>>()
    for (const row of result.rows) {
      const x = normalizeX(row.x)
      const split = String(row.split ?? '(blank)')
      const values = byX.get(x) ?? {}
      values[split] = toNumberOrNull(row.value ?? row[yColumns[0] ?? 'value'])
      byX.set(x, values)
    }
    return [...byX.entries()].map(([x, values]) => ({ x, values }))
  }

  return result.rows.map((row) => {
    const values: Record<string, number | null> = {}
    for (const column of yColumns) values[column] = toNumberOrNull(row[column])
    return { x: normalizeX(row.x), values }
  })
}

function seriesNames(spec: ChartSpec, data: ChartDataPoint[]): string[] {
  if (spec.chartType === 'bar' && isBarCountOnly(spec) && !spec.splitBy) return ['Count']
  if (spec.chartType === 'bar' && !spec.splitBy) return spec.yColumns.length ? spec.yColumns : ['Count']
  if (spec.chartType === 'scatter' && !spec.splitBy) return spec.yColumns.length ? spec.yColumns : ['y']
  if (!spec.splitBy) return spec.yColumns
  const names = new Set<string>()
  for (const point of data) {
    for (const name of Object.keys(point.values)) names.add(name)
  }
  return [...names]
}

function yAxisBounds(spec: ChartSpec): Record<string, number | boolean> {
  if (spec.yAxisScale === 'zero') return { min: 0, scale: false }
  if (spec.yAxisScale === 'manual') return { min: Number(spec.yAxisMin), max: Number(spec.yAxisMax), scale: true }
  return { scale: true }
}

function referenceMarkLine(spec: ChartSpec) {
  const lines = spec.referenceLines
    .filter((line) => line.value.trim() && Number.isFinite(Number(line.value)))
    .map((line) => ({
      name: line.label || line.value,
      yAxis: Number(line.value),
      label: { formatter: line.label || line.value },
    }))
  return lines.length ? { symbol: 'none', lineStyle: { type: 'dashed' }, data: lines } : undefined
}

export function buildLineChartOption(spec: ChartSpec, data: ChartDataPoint[]): EChartsCoreOption {
  const palette = chartPalette()
  const names = seriesNames(spec, data)
  const timeAxis = spec.xColumnTemporalKind === 'continuous_datetime'
  const markLine = referenceMarkLine(spec)
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
    grid: { left: 16, right: 24, top: spec.title ? 58 : 34, bottom: spec.showDataZoom ? 72 : 42, containLabel: true },
    legend: spec.showLegend
      ? {
          type: 'scroll',
          top: spec.title ? 28 : 0,
          right: 8,
          textStyle: { color: hslFromRootVar('--fg-muted'), fontSize: 11 },
        }
      : undefined,
    tooltip: {
      ...chartTooltip(),
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      valueFormatter: (value: unknown) =>
        typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : String(value ?? ''),
    },
    dataZoom: spec.showDataZoom
      ? [
          { type: 'inside', xAxisIndex: 0 },
          { type: 'slider', xAxisIndex: 0, height: 18, bottom: 18 },
        ]
      : undefined,
    xAxis: {
      type: timeAxis ? 'time' : 'category',
      name: spec.xAxisLabel,
      nameLocation: 'middle',
      nameGap: 28,
      data: timeAxis ? undefined : data.map((point) => point.x),
      axisLabel: { ...chartAxisLabelStyle(), hideOverlap: true },
      axisLine: { lineStyle: { color: hslFromRootVar('--border-triple') } },
    },
    yAxis: {
      type: 'value',
      name: spec.yAxisLabel,
      nameLocation: 'middle',
      nameGap: 44,
      ...yAxisBounds(spec),
      axisLabel: chartAxisLabelStyle(),
      splitLine: { lineStyle: { color: hslFromRootVar('--border-triple', 0.4) } },
    },
    series: names.map((name, index) => ({
      name,
      type: 'line',
      data: timeAxis ? data.map((point) => [point.x, point.values[name]]) : data.map((point) => point.values[name]),
      smooth: spec.smooth,
      showSymbol: spec.showPoints,
      connectNulls: spec.connectNulls,
      lineStyle: { width: 2 },
      emphasis: { focus: 'series' },
      markLine: index === 0 ? markLine : undefined,
    })),
  }
}

function histogramSeriesNames(spec: ChartSpec, data: ChartDataPoint[]): string[] {
  if (!spec.splitBy) return ['Count']
  const names = new Set<string>()
  for (const point of data) {
    for (const name of Object.keys(point.values)) names.add(name)
  }
  return [...names]
}

function histogramTooltipFormatter(params: unknown): string {
  const items = Array.isArray(params) ? params : [params]
  const first = items[0] as { axisValueLabel?: string; name?: string; dataIndex?: number } | undefined
  const label = first?.axisValueLabel ?? first?.name ?? ''
  const rows = items
    .map((item) => {
      const param = item as { marker?: string; seriesName?: string; value?: unknown }
      const value = typeof param.value === 'number' && Number.isFinite(param.value)
        ? param.value.toLocaleString()
        : String(param.value ?? '')
      return `${param.marker ?? ''}${param.seriesName ?? 'Count'}: ${value}`
    })
    .join('<br/>')
  return label ? `${label}<br/>${rows}` : rows
}

export function buildHistogramChartOption(spec: ChartSpec, data: ChartDataPoint[]): EChartsCoreOption {
  const names = histogramSeriesNames(spec, data)
  return {
    color: chartPalette(),
    backgroundColor: 'transparent',
    title: spec.title
      ? {
          text: spec.title,
          left: 8,
          top: 0,
          textStyle: { color: hslFromRootVar('--fg'), fontSize: 14, fontWeight: 600 },
        }
      : undefined,
    grid: { left: 16, right: 24, top: spec.title ? 58 : 34, bottom: spec.showDataZoom ? 72 : 42, containLabel: true },
    legend: spec.showLegend && spec.splitBy
      ? {
          type: 'scroll',
          top: spec.title ? 28 : 0,
          right: 8,
          textStyle: { color: hslFromRootVar('--fg-muted'), fontSize: 11 },
        }
      : undefined,
    tooltip: {
      ...chartTooltip(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: histogramTooltipFormatter,
      valueFormatter: (value: unknown) =>
        typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : String(value ?? ''),
    },
    dataZoom: spec.showDataZoom
      ? [
          { type: 'inside', xAxisIndex: 0 },
          { type: 'slider', xAxisIndex: 0, height: 18, bottom: 18 },
        ]
      : undefined,
    xAxis: {
      type: 'category',
      name: spec.xAxisLabel,
      nameLocation: 'middle',
      nameGap: 36,
      data: data.map((point) => point.x),
      axisLabel: { ...chartAxisLabelStyle(), hideOverlap: true },
      axisLine: { lineStyle: { color: hslFromRootVar('--border-triple') } },
    },
    yAxis: {
      type: 'value',
      name: spec.yAxisLabel,
      nameLocation: 'middle',
      nameGap: 44,
      ...yAxisBounds(spec),
      axisLabel: chartAxisLabelStyle(),
      splitLine: { lineStyle: { color: hslFromRootVar('--border-triple', 0.4) } },
    },
    series: names.map((name) => ({
      name,
      type: 'bar',
      data: data.map((point) => point.values[name] ?? 0),
      barGap: spec.splitBy ? '10%' : '0%',
      barCategoryGap: spec.splitBy ? '20%' : '0%',
      emphasis: { focus: 'series' },
    })),
  }
}

function categoryBarTooltipFormatter(params: unknown): string {
  const items = Array.isArray(params) ? params : [params]
  const first = items[0] as { axisValueLabel?: string; name?: string } | undefined
  const label = first?.axisValueLabel ?? first?.name ?? ''
  const rows = items
    .map((item) => {
      const param = item as { marker?: string; seriesName?: string; value?: unknown }
      const value = typeof param.value === 'number' && Number.isFinite(param.value)
        ? param.value.toLocaleString()
        : String(param.value ?? '')
      return `${param.marker ?? ''}${param.seriesName ?? ''}: ${value}`
    })
    .join('<br/>')
  return label ? `${label}<br/>${rows}` : rows
}

export function buildBarChartOption(spec: ChartSpec, data: ChartDataPoint[]): EChartsCoreOption {
  const names = seriesNames(spec, data)
  return {
    color: chartPalette(),
    backgroundColor: 'transparent',
    title: spec.title
      ? {
          text: spec.title,
          left: 8,
          top: 0,
          textStyle: { color: hslFromRootVar('--fg'), fontSize: 14, fontWeight: 600 },
        }
      : undefined,
    grid: { left: 16, right: 24, top: spec.title ? 58 : 34, bottom: spec.showDataZoom ? 72 : 42, containLabel: true },
    legend: spec.showLegend && (spec.splitBy || names.length > 1)
      ? {
          type: 'scroll',
          top: spec.title ? 28 : 0,
          right: 8,
          textStyle: { color: hslFromRootVar('--fg-muted'), fontSize: 11 },
        }
      : undefined,
    tooltip: {
      ...chartTooltip(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: categoryBarTooltipFormatter,
    },
    dataZoom: spec.showDataZoom
      ? [
          { type: 'inside', xAxisIndex: 0 },
          { type: 'slider', xAxisIndex: 0, height: 18, bottom: 18 },
        ]
      : undefined,
    xAxis: {
      type: 'category',
      name: spec.xAxisLabel,
      nameLocation: 'middle',
      nameGap: 36,
      data: data.map((point) => point.x),
      axisLabel: { ...chartAxisLabelStyle(), hideOverlap: true, rotate: data.length > 12 ? 35 : 0 },
      axisLine: { lineStyle: { color: hslFromRootVar('--border-triple') } },
    },
    yAxis: {
      type: 'value',
      name: spec.yAxisLabel,
      nameLocation: 'middle',
      nameGap: 44,
      ...yAxisBounds(spec),
      axisLabel: chartAxisLabelStyle(),
      splitLine: { lineStyle: { color: hslFromRootVar('--border-triple', 0.4) } },
    },
    series: names.map((name) => ({
      name,
      type: 'bar',
      data: data.map((point) => point.values[name] ?? 0),
      barGap: spec.splitBy ? '10%' : '0%',
      barCategoryGap: spec.splitBy ? '20%' : '0%',
      emphasis: { focus: 'series' },
    })),
  }
}

export function buildScatterChartOption(spec: ChartSpec, data: ChartDataPoint[]): EChartsCoreOption {
  const names = seriesNames(spec, data)
  const pointOpacity = data.length > 800 ? 0.35 : data.length > 200 ? 0.55 : 0.85
  return {
    color: chartPalette(),
    backgroundColor: 'transparent',
    title: spec.title
      ? {
          text: spec.title,
          left: 8,
          top: 0,
          textStyle: { color: hslFromRootVar('--fg'), fontSize: 14, fontWeight: 600 },
        }
      : undefined,
    grid: { left: 16, right: 24, top: spec.title ? 58 : 34, bottom: 42, containLabel: true },
    legend: spec.showLegend && spec.splitBy
      ? {
          type: 'scroll',
          top: spec.title ? 28 : 0,
          right: 8,
          textStyle: { color: hslFromRootVar('--fg-muted'), fontSize: 11 },
        }
      : undefined,
    tooltip: {
      ...chartTooltip(),
      trigger: 'item',
      valueFormatter: (value: unknown) =>
        typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : String(value ?? ''),
    },
    dataZoom: spec.showDataZoom ? [{ type: 'inside', xAxisIndex: 0, yAxisIndex: 0 }] : undefined,
    xAxis: {
      type: 'value',
      name: spec.xAxisLabel,
      nameLocation: 'middle',
      nameGap: 28,
      scale: true,
      axisLabel: chartAxisLabelStyle(),
      axisLine: { lineStyle: { color: hslFromRootVar('--border-triple') } },
      splitLine: { lineStyle: { color: hslFromRootVar('--border-triple', 0.4) } },
    },
    yAxis: {
      type: 'value',
      name: spec.yAxisLabel,
      nameLocation: 'middle',
      nameGap: 44,
      scale: true,
      ...yAxisBounds(spec),
      axisLabel: chartAxisLabelStyle(),
      splitLine: { lineStyle: { color: hslFromRootVar('--border-triple', 0.4) } },
    },
    series: names.map((name) => ({
      name,
      type: 'scatter',
      symbolSize: 7,
      itemStyle: { opacity: pointOpacity },
      emphasis: { focus: 'series' },
      data: data
        .filter((point) => point.values[name] != null)
        .map((point) => [point.x, point.values[name]] as [number, number]),
    })),
  }
}

export function buildChartOption(spec: ChartSpec, data: ChartDataPoint[]): EChartsCoreOption {
  switch (spec.chartType) {
    case 'histogram':
      return buildHistogramChartOption(spec, data)
    case 'bar':
      return buildBarChartOption(spec, data)
    case 'scatter':
      return buildScatterChartOption(spec, data)
    default:
      return buildLineChartOption(spec, data)
  }
}
