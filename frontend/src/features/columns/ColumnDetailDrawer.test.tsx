import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ColumnDetailDrawer } from '@/features/columns/ColumnDetailDrawer'
import { mkColumn, mkHistogramBin } from '@/test/profileFixtures'

const setOptionMock = vi.fn()

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: setOptionMock,
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}))

describe('ColumnDetailDrawer', () => {
  it('compacts histogram bucket labels for the side panel chart', () => {
    setOptionMock.mockClear()
    const col = mkColumn({
      histogram: [
        mkHistogramBin({ lower_bound: null, upper_bound: 5, right_closed: true, count: 2, pct_non_null: 20 }),
        mkHistogramBin({ lower_bound: 12.333333333333332, upper_bound: 19.666666666666664, count: 7, pct_non_null: 70 }),
        mkHistogramBin({ lower_bound: 78.33333333333333, upper_bound: null, right_closed: false, count: 1, pct_non_null: 10 }),
      ],
    })
    render(
      <MemoryRouter>
        <ColumnDetailDrawer open onOpenChange={vi.fn()} column={col} viewName="metrics" />
      </MemoryRouter>,
    )

    const option = setOptionMock.mock.calls.at(-1)?.[0] as {
      xAxis?: { data?: string[]; axisLabel?: { interval?: number | string; hideOverlap?: boolean } }
      yAxis?: { axisLabel?: { formatter?: (value: number) => string } }
      series?: Array<{ data?: number[] }>
      tooltip?: { formatter?: (params: { dataIndex: number }[]) => string }
    }
    expect(option.xAxis?.data).toEqual(['<= 5', '12.33-19.67', '> 78.33'])
    expect(option.xAxis?.axisLabel?.interval).toBe(0)
    expect(option.xAxis?.axisLabel?.hideOverlap).toBe(false)
    expect(option.yAxis?.axisLabel?.formatter?.(12.5)).toBe('12.5%')
    expect(option.series?.[0]?.data).toEqual([20, 70, 10])
    expect(option.tooltip?.formatter?.([{ dataIndex: 1 }])).toContain('(12.33, 19.67]')
    expect(option.tooltip?.formatter?.([{ dataIndex: 1 }])).toContain('Percent: 70.00%')
    expect(option.tooltip?.formatter?.([{ dataIndex: 1 }])).toContain('Count: 7')
  })

  it('returns null without column', () => {
    const { container } = render(
      <MemoryRouter>
        <ColumnDetailDrawer open onOpenChange={vi.fn()} column={null} viewName="" />
      </MemoryRouter>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('stats tab lists describe metrics', async () => {
    const user = userEvent.setup()
    const col = mkColumn({
      mean_value: '3.5',
      p25_value: '1',
      top_value: 'mode-x',
      top_count: 2,
      top_pct: 40,
    })
    render(
      <MemoryRouter>
        <ColumnDetailDrawer open onOpenChange={vi.fn()} column={col} viewName="metrics" />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Stats' }))
    expect(screen.getByText(/Unique \(full table\)/)).toBeInTheDocument()
    expect(screen.getByText('3.5')).toBeInTheDocument()
    expect(screen.getByText('mode-x')).toBeInTheDocument()
  })

  it('labels sampled metrics when column scope is sample', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ColumnDetailDrawer open onOpenChange={vi.fn()} column={mkColumn({ metric_scope: 'sample' })} viewName="metrics" />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Stats' }))
    expect(screen.getByText(/Unique \(sample\)/)).toBeInTheDocument()
    expect(screen.getByText(/Distribution and uniqueness metrics below use the sample/)).toBeInTheDocument()
  })

  it('renders sheet and triggers chart', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const col = mkColumn({
      top_values: [
        { value: 'a', count: 3 },
        { value: null, count: 1 },
      ],
      min_value: null,
      max_value: null,
      unique_count: null,
      cardinality: null,
    })
    render(
      <MemoryRouter>
        <ColumnDetailDrawer open onOpenChange={onOpenChange} column={col} viewName="metrics" />
      </MemoryRouter>,
    )
    expect(screen.getByText('col_a')).toBeInTheDocument()
    window.dispatchEvent(new Event('resize'))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
