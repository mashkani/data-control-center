import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChartDataControls } from '@/features/charts/ChartDataControls'
import type { ChartSpec } from '@/features/charts/chartUtils'
import { mkColumn, mkProfile } from '@/test/profileFixtures'

function baseSpec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    version: 4,
    datasetId: 'ds_001',
    chartType: 'bar',
    valueColumn: '',
    valueColumnInteger: false,
    binCount: 12,
    xColumn: 'region',
    xColumnBucketable: false,
    xColumnTemporalKind: null,
    yColumns: ['revenue'],
    aggregation: 'sum',
    bucket: 'none',
    filters: [],
    splitBy: '',
    yAxisScale: 'zero',
    yAxisMin: '',
    yAxisMax: '',
    referenceLines: [],
    showDataZoom: true,
    title: 'Bar',
    showLegend: true,
    smooth: false,
    showPoints: false,
    connectNulls: false,
    xAxisLabel: 'region',
    yAxisLabel: 'revenue',
    topN: 25,
    ...overrides,
  }
}

const profile = mkProfile({
  column_profiles: [
    mkColumn({ name: 'region', semantic_type: 'categorical', cardinality: 4 }),
    mkColumn({ name: 'revenue', semantic_type: 'numeric' }),
    mkColumn({ name: 'profit', semantic_type: 'numeric' }),
    mkColumn({ name: 'order_date', semantic_type: 'datetime' }),
  ],
  temporal_columns: [{ name: 'order_date', kind: 'continuous_datetime', confidence: 'high' }],
  primary_temporal_column: { name: 'order_date', kind: 'continuous_datetime', confidence: 'high' },
})

function renderControls(spec: ChartSpec, patchSpec = vi.fn()) {
  const view = render(
    <ChartDataControls
      profile={profile}
      spec={spec}
      patchSpec={patchSpec}
      temporalColumns={['order_date']}
      numericColumns={['revenue', 'profit']}
      categoryColumns={['region']}
      isBucketableTemporalColumn={(_profile, column) => column === 'order_date'}
      getTemporalKind={() => 'continuous_datetime'}
      getColumnIsInteger={() => false}
    />,
  )
  return { patchSpec, ...view }
}

describe('ChartDataControls', () => {
  it('shows count-only bar controls when aggregation is count without measure', () => {
    renderControls(baseSpec({ yColumns: [], aggregation: 'count' }))

    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Aggregation')).toBeInTheDocument()
    expect(screen.getByText('Top N')).toBeInTheDocument()
    expect(screen.getByText('Measure')).toBeInTheDocument()
  })

  it('updates top N when changed', () => {
    const { patchSpec } = renderControls(baseSpec())

    fireEvent.change(screen.getByDisplayValue('25'), { target: { value: '10' } })
    expect(patchSpec).toHaveBeenCalledWith({ topN: 10 })
  })

  it('patches bar category and measure selections', async () => {
    const user = userEvent.setup()
    const { patchSpec } = renderControls(baseSpec({ xColumn: 'region', yColumns: ['revenue'] }))

    await user.selectOptions(screen.getByDisplayValue('region'), 'region')
    expect(patchSpec).toHaveBeenCalledWith(
      expect.objectContaining({ xColumn: 'region', xAxisLabel: 'region' }),
    )

    await user.selectOptions(screen.getByDisplayValue('revenue'), 'profit')
    expect(patchSpec).toHaveBeenCalledWith(
      expect.objectContaining({ yColumns: ['profit'], yAxisLabel: 'profit' }),
    )
  })

  it('switches bar aggregation to count and back to sum', () => {
    const { patchSpec } = renderControls(baseSpec())
    const aggregationSelect = screen.getAllByRole('combobox')[2]

    fireEvent.change(aggregationSelect, { target: { value: 'count' } })
    expect(patchSpec).toHaveBeenCalledWith(
      expect.objectContaining({ aggregation: 'count', yColumns: [], yAxisLabel: 'Count' }),
    )

    patchSpec.mockClear()
    fireEvent.change(aggregationSelect, { target: { value: 'avg' } })
    expect(patchSpec).toHaveBeenCalledWith(
      expect.objectContaining({ aggregation: 'avg', yColumns: ['revenue'] }),
    )
  })

  it('renders histogram value and bin controls', () => {
    const { patchSpec } = renderControls(
      baseSpec({ chartType: 'histogram', valueColumn: 'revenue', title: 'revenue distribution' }),
    )

    expect(screen.getByText('Value column')).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue('12'), { target: { value: '20' } })
    expect(patchSpec).toHaveBeenCalledWith({ binCount: 20 })

    patchSpec.mockClear()
    fireEvent.change(screen.getByDisplayValue('revenue'), { target: { value: 'profit' } })
    expect(patchSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        valueColumn: 'profit',
        title: 'profit distribution',
      }),
    )
  })

  it('renders scatter axis controls', async () => {
    const user = userEvent.setup()
    const { patchSpec } = renderControls(
      baseSpec({
        chartType: 'scatter',
        xColumn: 'revenue',
        yColumns: ['profit'],
        title: 'profit vs revenue',
      }),
    )

    await user.selectOptions(screen.getByDisplayValue('revenue'), 'profit')
    expect(patchSpec).toHaveBeenCalledWith(
      expect.objectContaining({ xColumn: 'profit', xAxisLabel: 'profit' }),
    )

    await user.selectOptions(screen.getByDisplayValue('profit'), 'revenue')
    expect(patchSpec).toHaveBeenCalledWith(
      expect.objectContaining({ yColumns: ['revenue'], yAxisLabel: 'revenue' }),
    )
  })

  it('renders line chart axis, series, aggregation, and bucket controls', async () => {
    const user = userEvent.setup()
    const { patchSpec } = renderControls(
      baseSpec({
        chartType: 'line',
        xColumn: 'order_date',
        xColumnBucketable: true,
        yColumns: ['revenue'],
        aggregation: 'avg',
        bucket: 'month',
      }),
    )

    expect(screen.getByText('X axis')).toBeInTheDocument()
    expect(screen.getByText('Y variables')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /profit/i }))
    expect(patchSpec).toHaveBeenCalledWith({ yColumns: ['revenue', 'profit'] })

    patchSpec.mockClear()
    await user.selectOptions(screen.getByDisplayValue('Average'), 'none')
    expect(patchSpec).toHaveBeenCalledWith({ aggregation: 'none', bucket: 'none' })

    patchSpec.mockClear()
    await user.selectOptions(screen.getByDisplayValue('Month'), 'week')
    expect(patchSpec).toHaveBeenCalledWith({ bucket: 'week' })
  })

  it('shows a message when no numeric variables are available for line charts', () => {
    render(
      <ChartDataControls
        profile={profile}
        spec={baseSpec({ chartType: 'line', xColumn: 'order_date', yColumns: [] })}
        patchSpec={vi.fn()}
        temporalColumns={['order_date']}
        numericColumns={[]}
        categoryColumns={['region']}
        isBucketableTemporalColumn={() => true}
        getTemporalKind={() => 'continuous_datetime'}
        getColumnIsInteger={() => false}
      />,
    )

    expect(screen.getByText(/no numeric variables detected/i)).toBeInTheDocument()
  })

  it('limits line chart to one Y variable when splitBy is set', async () => {
    const user = userEvent.setup()
    const { patchSpec } = renderControls(
      baseSpec({
        chartType: 'line',
        xColumn: 'order_date',
        xColumnBucketable: true,
        yColumns: [],
        splitBy: 'region',
        aggregation: 'sum',
        bucket: 'month',
      }),
    )

    await user.click(screen.getByRole('checkbox', { name: /profit/i }))
    expect(patchSpec).toHaveBeenCalledWith({ yColumns: ['profit'] })
  })
})
