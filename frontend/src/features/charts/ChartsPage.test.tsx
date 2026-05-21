import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ChartsPage } from '@/features/charts/ChartsPage'
import { useUiStore } from '@/store/uiStore'
import { mkColumn, mkProfile } from '@/test/profileFixtures'

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}))

const h = vi.hoisted(() => ({
  listDatasets: vi.fn(),
  fetchDatasetProfile: vi.fn(),
  runQuery: vi.fn(),
}))

vi.mock('@/api/client', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/api/client')>()
  return {
    ...mod,
    api: {
      ...mod.api,
      listDatasets: h.listDatasets,
      fetchDatasetProfile: h.fetchDatasetProfile,
      runQuery: h.runQuery,
    },
  }
})

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={280}>{ui}</TooltipProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const dsRow = {
  dataset_id: 'ds_001',
  name: 'orders.csv',
  view_name: 'orders',
  source_path: '/p/orders.csv',
  format: 'csv',
  row_count: 24,
  column_count: 3,
  file_size_bytes: 100,
}

function chartableProfile() {
  return mkProfile({
    dataset_id: 'ds_001',
    name: 'Orders',
    primary_temporal_column: { name: 'order_date', kind: 'continuous_datetime', confidence: 'high' },
    temporal_columns: [{ name: 'order_date', kind: 'continuous_datetime', confidence: 'high' }],
    measure_candidates: [
      { name: 'revenue', score: 0.9, confidence: 'high' },
      { name: 'profit', score: 0.8, confidence: 'high' },
    ],
    column_profiles: [
      mkColumn({ name: 'order_date', semantic_type: 'datetime' }),
      mkColumn({ name: 'revenue', semantic_type: 'numeric' }),
      mkColumn({ name: 'profit', semantic_type: 'numeric' }),
    ],
  })
}

describe('ChartsPage', () => {
  beforeEach(() => {
    h.listDatasets.mockResolvedValue([dsRow])
    h.fetchDatasetProfile.mockResolvedValue(chartableProfile())
    h.runQuery.mockResolvedValue({
      columns: [{ name: 'x', type: null }, { name: 'revenue', type: null }, { name: 'profit', type: null }],
      rows: [{ x: '2026-01-01', revenue: 10, profit: 4 }],
      row_count: 1,
      truncated: false,
      error: null,
    })
    useUiStore.setState({ activeDatasetId: 'ds_001' })
  })

  it('renders select-dataset empty state', () => {
    useUiStore.setState({ activeDatasetId: null })
    wrap(<ChartsPage />)
    expect(screen.getByText('Select a dataset.')).toBeInTheDocument()
  })

  it('shows invalid guidance when no numeric variables exist', async () => {
    h.fetchDatasetProfile.mockResolvedValue(
      mkProfile({
        primary_temporal_column: { name: 'created_at', kind: 'continuous_datetime', confidence: 'high' },
        temporal_columns: [{ name: 'created_at', kind: 'continuous_datetime', confidence: 'high' }],
        measure_candidates: [],
        column_profiles: [mkColumn({ name: 'created_at', semantic_type: 'datetime' })],
      }),
    )

    wrap(<ChartsPage />)

    expect(await screen.findByText(/Choose at least one numeric variable/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Run chart/i })).toBeDisabled()
  })

  it('preselects temporal and numeric defaults from the profile', async () => {
    wrap(<ChartsPage />)

    await waitFor(() => expect(screen.getByLabelText('X axis')).toHaveValue('order_date'))
    expect(screen.getByLabelText('revenue')).toBeChecked()
    expect(screen.getByLabelText('profit')).toBeChecked()
    expect(screen.getByDisplayValue('Orders trends')).toBeInTheDocument()
  })

  it('runs the chart query only after clicking Run chart', async () => {
    const user = userEvent.setup()
    wrap(<ChartsPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: /Run chart/i })).toBeEnabled())
    expect(h.runQuery).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Run chart/i }))

    await waitFor(() => expect(h.runQuery).toHaveBeenCalledTimes(1))
    expect(h.runQuery.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        max_rows: 5000,
        sql: expect.stringContaining('avg(revenue) as revenue'),
      }),
    )
  })

  it('shows a truncation warning from the query result', async () => {
    const user = userEvent.setup()
    h.runQuery.mockResolvedValue({
      columns: [{ name: 'x', type: null }, { name: 'revenue', type: null }],
      rows: [{ x: '2026-01-01', revenue: 10 }],
      row_count: 5000,
      truncated: true,
      error: null,
    })

    wrap(<ChartsPage />)
    await user.click(await screen.findByRole('button', { name: /Run chart/i }))

    expect(await screen.findByText(/Truncated at 5,000 rows/i)).toBeInTheDocument()
  })
})
