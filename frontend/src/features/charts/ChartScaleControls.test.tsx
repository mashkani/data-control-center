import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChartScaleControls, ChartSplitControls } from '@/features/charts/ChartScaleControls'
import { createDefaultChartSpec } from '@/features/charts/chartUtils'
import { mkProfile } from '@/test/profileFixtures'

describe('ChartScaleControls', () => {
  it('updates manual Y scale bounds and reference lines', async () => {
    const user = userEvent.setup()
    const patchSpec = vi.fn()
    const spec = {
      ...createDefaultChartSpec('ds_001', undefined),
      chartType: 'line' as const,
      yAxisScale: 'manual' as const,
      yAxisMin: '0',
      yAxisMax: '100',
      referenceLines: [{ id: 'ref-1', label: 'Target', value: '50' }],
    }

    render(<ChartScaleControls spec={spec} patchSpec={patchSpec} />)

    fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '10' } })
    expect(patchSpec).toHaveBeenCalledWith({ yAxisMin: '10' })

    fireEvent.change(screen.getByDisplayValue('Target'), { target: { value: 'Goal' } })
    expect(patchSpec).toHaveBeenCalledWith({
      referenceLines: [expect.objectContaining({ label: 'Goal' })],
    })

    await user.click(screen.getByRole('button', { name: /remove reference line/i }))
    expect(patchSpec).toHaveBeenCalledWith({ referenceLines: [] })

    patchSpec.mockClear()
    await user.click(screen.getByRole('button', { name: /add reference line/i }))
    expect(patchSpec).toHaveBeenCalledWith({
      referenceLines: [
        ...spec.referenceLines,
        expect.objectContaining({ label: 'Reference', value: '' }),
      ],
    })
  })
})

describe('ChartSplitControls', () => {
  it('sets splitBy and trims Y columns for line charts', async () => {
    const user = userEvent.setup()
    const patchSpec = vi.fn()
    const profile = mkProfile()
    const spec = {
      ...createDefaultChartSpec('ds_001', profile),
      chartType: 'line' as const,
      yColumns: ['revenue', 'profit'],
      splitBy: '',
    }

    render(
      <ChartSplitControls
        profile={profile}
        spec={spec}
        patchSpec={patchSpec}
        splitColumns={['region']}
        splitWarning={false}
        splitCardinality={12}
        getColumnSemanticType={() => 'categorical'}
      />,
    )

    await user.selectOptions(screen.getByDisplayValue('None'), 'region')
    expect(patchSpec).toHaveBeenCalledWith({
      splitBy: 'region',
      yColumns: ['revenue'],
    })
  })

  it('shows a warning when split cardinality is high', () => {
    const spec = { ...createDefaultChartSpec('ds_001', undefined), splitBy: 'region' }

    render(
      <ChartSplitControls
        profile={mkProfile()}
        spec={spec}
        patchSpec={vi.fn()}
        splitColumns={['region']}
        splitWarning
        splitCardinality={250}
        getColumnSemanticType={() => 'categorical'}
      />,
    )

    expect(screen.getByText(/legend may be dense/i)).toBeInTheDocument()
  })
})
