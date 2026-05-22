import { describe, expect, it } from 'vitest'
import type { QueryResult } from '@/api/types'
import { mkColumn, mkProfile } from '@/test/profileFixtures'
import {
  buildBarChartOption,
  buildChartOption,
  buildHistogramChartOption,
  buildLineChartOption,
  buildScatterChartOption,
  createDefaultChartSpec,
  getCategoryColumnNames,
  getDefaultCategoryColumn,
  getDefaultScatterColumns,
  getNumericColumnNames,
  getTemporalColumnNames,
  normalizeChartSpec,
  queryResultToChartData,
  sortColumnNamesAsc,
  validateChartSpec,
  type ChartSpec,
} from '@/features/charts/chartUtils'

function baseSpec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    version: 4,
    datasetId: 'ds_001',
    chartType: 'line',
    valueColumn: 'gross revenue',
    valueColumnInteger: false,
    binCount: 12,
    xColumn: 'order date',
    xColumnBucketable: true,
    xColumnTemporalKind: 'continuous_datetime',
    yColumns: ['gross revenue', 'profit'],
    aggregation: 'avg',
    bucket: 'month',
    filters: [],
    splitBy: '',
    yAxisScale: 'auto',
    yAxisMin: '',
    yAxisMax: '',
    referenceLines: [],
    showDataZoom: true,
    title: 'Trends',
    showLegend: true,
    smooth: false,
    showPoints: false,
    connectNulls: false,
    xAxisLabel: 'order date',
    yAxisLabel: '',
    topN: 25,
    ...overrides,
  }
}

describe('chartUtils', () => {
  it('sorts column names for chart pickers in ascending locale order', () => {
    expect(sortColumnNamesAsc(['z', 'a', 'm'])).toEqual(['a', 'm', 'z'])
    expect(sortColumnNamesAsc(['b', 'a'])).toEqual(['a', 'b'])
  })

  it('selects histogram defaults from profile metadata', () => {
    const profile = mkProfile({
      name: 'Orders',
      primary_temporal_column: { name: 'order_date', kind: 'continuous_datetime', confidence: 'high' },
      temporal_columns: [{ name: 'created_at', kind: 'continuous_datetime', confidence: 'medium' }],
      measure_candidates: [
        { name: 'profit', score: 0.95, confidence: 'high' },
        { name: 'revenue', score: 0.9, confidence: 'high' },
      ],
      column_profiles: [
        mkColumn({ name: 'revenue', semantic_type: 'numeric' }),
        mkColumn({
          name: 'profit',
          semantic_type: 'numeric',
          histogram: [{ lower_bound: 0, upper_bound: 10, left_closed: false, right_closed: true, count: 1, pct_non_null: 100 }],
        }),
        mkColumn({ name: 'status', semantic_type: 'categorical' }),
      ],
    })

    expect(getTemporalColumnNames(profile)).toEqual(['order_date', 'created_at'])
    expect(getNumericColumnNames(profile)).toEqual(['profit', 'revenue'])

    const spec = createDefaultChartSpec('ds_001', profile)
    expect(spec.chartType).toBe('histogram')
    expect(spec.valueColumn).toBe('profit')
    expect(spec.valueColumnInteger).toBe(true)
    expect(spec.binCount).toBe(12)
    expect(spec.xColumn).toBe('order_date')
    expect(spec.xColumnBucketable).toBe(false)
    expect(spec.yColumns).toEqual(['profit', 'revenue'])
    expect(spec.aggregation).toBe('avg')
    expect(spec.bucket).toBe('none')
    expect(spec.title).toBe('profit distribution')
  })

  it('normalizes legacy line specs and preserves discrete temporal bucket behavior', () => {
    const profile = mkProfile({
      primary_temporal_column: { name: 'year', kind: 'discrete_period', confidence: 'high' },
      temporal_columns: [{ name: 'year', kind: 'discrete_period', confidence: 'high' }],
      measure_candidates: [{ name: 'rating', score: 0.9, confidence: 'high' }],
      column_profiles: [
        mkColumn({ name: 'year', semantic_type: 'numeric' }),
        mkColumn({ name: 'rating', semantic_type: 'numeric' }),
      ],
    })

    const spec = normalizeChartSpec({ version: 2, xColumn: 'year', yColumns: ['rating'] }, 'ds_001', profile)
    expect(spec.chartType).toBe('line')
    expect(spec.xColumn).toBe('year')
    expect(spec.xColumnBucketable).toBe(false)
    expect(spec.bucket).toBe('none')
  })

  it('validates missing dataset, x axis, and y variables', () => {
    expect(validateChartSpec(baseSpec({ datasetId: '' }), 'orders').reason).toMatch(/Select a dataset/i)
    expect(validateChartSpec(baseSpec({ xColumn: '' }), 'orders').reason).toMatch(/temporal column/i)
    expect(validateChartSpec(baseSpec({ yColumns: [] }), 'orders').reason).toMatch(/numeric variable/i)
    expect(validateChartSpec(baseSpec(), 'orders')).toEqual({ valid: true, reason: null })
  })

  it('validates histogram value column and bins', () => {
    expect(validateChartSpec(baseSpec({ chartType: 'histogram', valueColumn: '' }), 'orders').reason).toMatch(/numeric variable/i)
    expect(validateChartSpec(baseSpec({ chartType: 'histogram', binCount: 0 }), 'orders').reason).toMatch(/bins/i)
    expect(validateChartSpec(baseSpec({ chartType: 'histogram' }), 'orders')).toEqual({ valid: true, reason: null })
  })

  it('uses a time axis for raw continuous datetime charts', () => {
    const option = buildLineChartOption(
      baseSpec({ aggregation: 'none', bucket: 'none' }),
      [{ x: '2026-01-01T00:00:00Z', values: { 'gross revenue': 10, profit: 4 } }],
    )

    expect(option.xAxis).toEqual(expect.objectContaining({ type: 'time', data: undefined }))
    expect(option.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ data: [['2026-01-01T00:00:00Z', 10]] }),
      ]),
    )
  })

  it('maps y-axis scale modes to explicit ECharts axis options', () => {
    const data = [{ x: '2026-01-01T00:00:00Z', values: { 'gross revenue': 48, profit: 46 } }]

    expect(buildLineChartOption(baseSpec({ yAxisScale: 'auto' }), data).yAxis).toEqual(
      expect.objectContaining({ scale: true }),
    )
    expect(buildLineChartOption(baseSpec({ yAxisScale: 'auto' }), data).yAxis).not.toEqual(
      expect.objectContaining({ min: 0 }),
    )
    expect(buildLineChartOption(baseSpec({ yAxisScale: 'zero' }), data).yAxis).toEqual(
      expect.objectContaining({ min: 0, scale: false }),
    )
    expect(
      buildLineChartOption(baseSpec({ yAxisScale: 'manual', yAxisMin: '40', yAxisMax: '50' }), data).yAxis,
    ).toEqual(expect.objectContaining({ min: 40, max: 50, scale: true }))
  })

  it('maps split-by rows into series values', () => {
    const spec = baseSpec({ yColumns: ['rating'], splitBy: 'team', aggregation: 'avg' })
    const result: QueryResult = {
      columns: [{ name: 'x', type: null }, { name: 'split', type: null }, { name: 'value', type: null }],
      rows: [
        { x: 2025, split: 'A', value: 10 },
        { x: 2025, split: 'B', value: '12' },
      ],
      row_count: 2,
      truncated: false,
      error: null,
    }
    expect(queryResultToChartData(result, spec)).toEqual([{ x: 2025, values: { A: 10, B: 12 } }])
  })

  it('maps histogram rows into grouped chart data and renders bar options', () => {
    const spec = baseSpec({ chartType: 'histogram', splitBy: 'region', xAxisLabel: 'revenue', yAxisLabel: 'Count' })
    const result: QueryResult = {
      columns: [
        { name: 'bin_index', type: null },
        { name: 'lower_bound', type: null },
        { name: 'upper_bound', type: null },
        { name: 'split', type: null },
        { name: 'count', type: null },
      ],
      rows: [
        { bin_index: 0, lower_bound: 0, upper_bound: 10, split: 'East', count: 4 },
        { bin_index: 0, lower_bound: 0, upper_bound: 10, split: 'West', count: '2' },
        { bin_index: 1, lower_bound: 10, upper_bound: 20, split: 'East', count: 0 },
      ],
      row_count: 3,
      truncated: false,
      error: null,
    }

    const data = queryResultToChartData(result, spec)
    expect(data).toEqual([
      { x: '0 - 10', lowerBound: 0, upperBound: 10, values: { East: 4, West: 2 } },
      { x: '10 - 20', lowerBound: 10, upperBound: 20, values: { East: 0 } },
    ])

    const option = buildHistogramChartOption(spec, data)
    expect(option.xAxis).toEqual(expect.objectContaining({ type: 'category', data: ['0 - 10', '10 - 20'] }))
    expect(option.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'East', type: 'bar', data: [4, 0] }),
        expect.objectContaining({ name: 'West', type: 'bar', data: [2, 0] }),
      ]),
    )
    expect((option.tooltip as { formatter: (params: unknown) => string }).formatter([
      { axisValueLabel: '0 - 10', seriesName: 'East', value: 4 },
      { axisValueLabel: '0 - 10', seriesName: 'West', value: 2 },
    ])).toContain('0 - 10')
  })

  it('defaults to bar chart when categorical columns exist without numerics', () => {
    const profile = mkProfile({
      numeric_column_count: 0,
      measure_candidates: [],
      temporal_columns: [],
      primary_temporal_column: null,
      column_profiles: [
        mkColumn({ name: 'region', semantic_type: 'categorical', cardinality: 4 }),
        mkColumn({ name: 'status', semantic_type: 'categorical', cardinality: 2 }),
      ],
    })

    expect(getCategoryColumnNames(profile)).toEqual(['region', 'status'])
    expect(getDefaultCategoryColumn(profile)).toBe('region')

    const spec = createDefaultChartSpec('ds_001', profile)
    expect(spec.chartType).toBe('bar')
    expect(spec.xColumn).toBe('region')
    expect(spec.yColumns).toEqual([])
    expect(spec.aggregation).toBe('count')
    expect(spec.topN).toBe(25)
    expect(spec.title).toBe('region by count')
  })

  it('provides scatter column defaults from numeric profile columns', () => {
    const profile = mkProfile({
      measure_candidates: [
        { name: 'height', score: 0.9, confidence: 'high' },
        { name: 'weight', score: 0.8, confidence: 'high' },
      ],
      temporal_columns: [],
      primary_temporal_column: null,
      column_profiles: [
        mkColumn({ name: 'height', semantic_type: 'numeric' }),
        mkColumn({ name: 'weight', semantic_type: 'numeric' }),
      ],
    })

    expect(getDefaultScatterColumns(profile)).toEqual({ x: 'height', y: 'weight' })
    const spec = createDefaultChartSpec('ds_001', profile)
    expect(spec.chartType).toBe('histogram')
  })

  it('validates bar and scatter specs', () => {
    const profile = mkProfile({
      column_profiles: [
        mkColumn({ name: 'region', semantic_type: 'categorical', cardinality: 4 }),
        mkColumn({ name: 'revenue', semantic_type: 'numeric' }),
        mkColumn({ name: 'profit', semantic_type: 'numeric' }),
      ],
    })

    expect(validateChartSpec(baseSpec({ chartType: 'bar', xColumn: '' }), 'orders', profile).reason).toMatch(/category/i)
    expect(
      validateChartSpec(
        baseSpec({ chartType: 'bar', xColumn: 'region', yColumns: [], aggregation: 'sum' }),
        'orders',
        profile,
      ).reason,
    ).toMatch(/Count aggregation|measure/i)
    expect(
      validateChartSpec(baseSpec({ chartType: 'bar', xColumn: 'region', yColumns: [], aggregation: 'count' }), 'orders', profile),
    ).toEqual({ valid: true, reason: null })
    expect(
      validateChartSpec(baseSpec({ chartType: 'scatter', xColumn: 'revenue', yColumns: ['revenue'] }), 'orders', profile).reason,
    ).toMatch(/different numeric/i)
    expect(
      validateChartSpec(baseSpec({ chartType: 'scatter', xColumn: 'revenue', yColumns: ['profit'], aggregation: 'none' }), 'orders', profile),
    ).toEqual({ valid: true, reason: null })
  })

  it('maps scatter rows and renders scatter options', () => {
    const result: QueryResult = {
      columns: [{ name: 'x', type: null }, { name: 'y', type: null }],
      rows: [
        { x: 1, y: 2 },
        { x: '3', y: '4' },
      ],
      row_count: 2,
      truncated: false,
      error: null,
    }
    const spec = baseSpec({ chartType: 'scatter', xColumn: 'gross revenue', yColumns: ['profit'], aggregation: 'none' })
    expect(queryResultToChartData(result, spec)).toEqual([
      { x: 1, values: { profit: 2 } },
      { x: 3, values: { profit: 4 } },
    ])

    const option = buildScatterChartOption(spec, queryResultToChartData(result, spec))
    expect(option.xAxis).toEqual(expect.objectContaining({ type: 'value' }))
    expect(option.series).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'scatter', data: [[1, 2], [3, 4]] })]),
    )
  })

  it('maps bar rows and renders category bar options', () => {
    const spec = baseSpec({ chartType: 'bar', xColumn: 'region', yColumns: [], aggregation: 'count' })
    const result: QueryResult = {
      columns: [{ name: 'x', type: null }, { name: 'count', type: null }],
      rows: [
        { x: 'East', count: 4 },
        { x: 'West', count: 2 },
      ],
      row_count: 2,
      truncated: false,
      error: null,
    }
    const data = queryResultToChartData(result, spec)
    expect(data).toEqual([
      { x: 'East', values: { Count: 4 } },
      { x: 'West', values: { Count: 2 } },
    ])
    const option = buildBarChartOption(spec, data)
    expect(option.xAxis).toEqual(expect.objectContaining({ type: 'category', data: ['East', 'West'] }))
    expect(option.series).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Count', type: 'bar', data: [4, 2] })]),
    )
  })

  it('renders grouped bar chart options for split series', () => {
    const spec = baseSpec({
      chartType: 'bar',
      xColumn: 'region',
      yColumns: ['gross revenue'],
      aggregation: 'avg',
      splitBy: 'team',
      topN: 5,
    })
    const result: QueryResult = {
      columns: [{ name: 'x', type: null }, { name: 'split', type: null }, { name: 'value', type: null }],
      rows: [
        { x: 'East', split: 'A', value: 10 },
        { x: 'East', split: 'B', value: 12 },
      ],
      row_count: 2,
      truncated: false,
      error: null,
    }
    const data = queryResultToChartData(result, spec)
    expect(data).toEqual([{ x: 'East', values: { A: 10, B: 12 } }])
    const option = buildBarChartOption(spec, data)
    expect(option.legend).toBeDefined()
    expect(option.series).toHaveLength(2)
    expect(buildChartOption(spec, data).series).toHaveLength(2)
  })

  it('renders scatter split legend and adjusts point opacity by row count', () => {
    const spec = baseSpec({
      chartType: 'scatter',
      xColumn: 'gross revenue',
      yColumns: ['profit'],
      splitBy: 'region',
      aggregation: 'none',
      showLegend: true,
    })
    const splitResult: QueryResult = {
      columns: [{ name: 'x', type: null }, { name: 'y', type: null }, { name: 'split', type: null }],
      rows: [{ x: 1, y: 2, split: 'East' }],
      row_count: 1,
      truncated: false,
      error: null,
    }
    const splitData = queryResultToChartData(splitResult, spec)
    const splitOption = buildScatterChartOption(spec, splitData)
    expect(splitOption.legend).toBeDefined()

    const dense = Array.from({ length: 250 }, (_, index) => ({
      x: index,
      values: { profit: index },
    }))
    expect((buildScatterChartOption(spec, dense).series as Array<{ itemStyle: { opacity: number } }>)[0]?.itemStyle.opacity).toBe(
      0.55,
    )

    const veryDense = Array.from({ length: 900 }, (_, index) => ({
      x: index,
      values: { profit: index },
    }))
    expect(
      (buildScatterChartOption(spec, veryDense).series as Array<{ itemStyle: { opacity: number } }>)[0]?.itemStyle.opacity,
    ).toBe(0.35)
  })

  it('normalizes bar and scatter specs from saved JSON', () => {
    const profile = mkProfile({
      column_profiles: [
        mkColumn({ name: 'region', semantic_type: 'categorical', cardinality: 4 }),
        mkColumn({ name: 'revenue', semantic_type: 'numeric' }),
        mkColumn({ name: 'profit', semantic_type: 'numeric' }),
      ],
    })
    const bar = normalizeChartSpec(
      { version: 4, chartType: 'bar', xColumn: 'region', yColumns: [], aggregation: 'count', topN: 40 },
      'ds_001',
      profile,
    )
    expect(bar.chartType).toBe('bar')
    expect(bar.topN).toBe(40)
    expect(bar.yColumns).toEqual([])

    const scatter = normalizeChartSpec(
      { version: 4, chartType: 'scatter', xColumn: 'revenue', yColumns: ['profit', 'revenue'], splitBy: 'region' },
      'ds_001',
      profile,
    )
    expect(scatter.aggregation).toBe('none')
    expect(scatter.referenceLines).toEqual([])
    expect(scatter.yColumns).toEqual(['profit'])
  })

  it('rejects invalid bar topN and non-category X columns', () => {
    const profile = mkProfile({
      column_profiles: [
        mkColumn({ name: 'region', semantic_type: 'categorical', cardinality: 4 }),
        mkColumn({ name: 'order_date', semantic_type: 'datetime' }),
        mkColumn({ name: 'revenue', semantic_type: 'numeric' }),
      ],
    })
    expect(
      validateChartSpec(
        baseSpec({ chartType: 'bar', xColumn: 'region', yColumns: [], aggregation: 'count', topN: 0 }),
        'orders',
        profile,
      ).reason,
    ).toMatch(/Top N/i)
    expect(
      validateChartSpec(baseSpec({ chartType: 'bar', xColumn: 'order_date', yColumns: [], aggregation: 'count' }), 'orders', profile)
        .reason,
    ).toMatch(/categorical/i)
  })

  it('normalizes v3 specs to v4 with topN', () => {
    const profile = mkProfile({
      column_profiles: [mkColumn({ name: 'revenue', semantic_type: 'numeric' })],
    })
    const spec = normalizeChartSpec({ version: 3, chartType: 'histogram', valueColumn: 'revenue' }, 'ds_001', profile)
    expect(spec.version).toBe(4)
    expect(spec.topN).toBe(25)
  })

  it('maps query rows into chart data and coerces numeric strings', () => {
    const result: QueryResult = {
      columns: [{ name: 'x', type: null }, { name: 'revenue', type: null }],
      rows: [
        { x: '2026-01-01', revenue: '12.5', profit: null },
        { x: '2026-02-01', revenue: 'bad', profit: 4 },
      ],
      row_count: 2,
      truncated: false,
      error: null,
    }

    expect(queryResultToChartData(result, ['revenue', 'profit'])).toEqual([
      { x: '2026-01-01', values: { revenue: 12.5, profit: null } },
      { x: '2026-02-01', values: { revenue: null, profit: 4 } },
    ])
  })
})
