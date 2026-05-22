import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChartDisplayControls } from '@/features/charts/ChartDisplayControls'
import { createDefaultChartSpec } from '@/features/charts/chartUtils'

describe('ChartDisplayControls', () => {
  it('updates title, axis labels, and line display toggles', async () => {
    const user = userEvent.setup()
    const patchSpec = vi.fn()
    const spec = { ...createDefaultChartSpec('ds_001', undefined), chartType: 'line' as const, title: 'Trends' }

    render(<ChartDisplayControls spec={spec} patchSpec={patchSpec} />)

    fireEvent.change(screen.getByDisplayValue('Trends'), { target: { value: 'Revenue trend' } })
    expect(patchSpec).toHaveBeenCalledWith({ title: 'Revenue trend' })

    await user.click(screen.getByRole('checkbox', { name: /smooth/i }))
    expect(patchSpec).toHaveBeenCalledWith({ smooth: true })
  })
})
