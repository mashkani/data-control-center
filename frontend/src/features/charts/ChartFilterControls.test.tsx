import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChartFilterControls } from '@/features/charts/ChartFilterControls'
import { createDefaultChartSpec } from '@/features/charts/chartUtils'
import { mkColumn, mkProfile } from '@/test/profileFixtures'

describe('ChartFilterControls', () => {
  const profile = mkProfile({
    column_profiles: [
      mkColumn({ name: 'region', semantic_type: 'categorical' }),
      mkColumn({ name: 'revenue', semantic_type: 'numeric' }),
    ],
  })

  it('adds, edits, and removes filters', async () => {
    const user = userEvent.setup()
    const patchSpec = vi.fn()
    const spec = {
      ...createDefaultChartSpec('ds_001', profile),
      filters: [{ id: 'filter-1', column: 'region', operator: 'eq' as const, value: 'EMEA' }],
    }

    render(
      <ChartFilterControls
        profile={profile}
        spec={spec}
        patchSpec={patchSpec}
        filterColumns={['region', 'revenue']}
        getColumnSemanticType={(_profile, column) => (column === 'revenue' ? 'numeric' : 'categorical')}
      />,
    )

    await user.click(screen.getByRole('button', { name: /add filter/i }))
    expect(patchSpec).toHaveBeenCalledWith({
      filters: [
        ...spec.filters,
        expect.objectContaining({ column: 'region', operator: 'eq', value: '' }),
      ],
    })

    fireEvent.change(screen.getByDisplayValue('EMEA'), { target: { value: 'APAC' } })
    expect(patchSpec).toHaveBeenCalledWith({
      filters: [expect.objectContaining({ id: 'filter-1', value: 'APAC' })],
    })

    patchSpec.mockClear()
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'revenue' } })
    expect(patchSpec).toHaveBeenCalledWith({
      filters: [expect.objectContaining({ column: 'revenue', operator: 'eq' })],
    })

    await user.click(screen.getByRole('button', { name: /remove filter/i }))
    expect(patchSpec).toHaveBeenCalledWith({ filters: [] })
  })

  it('disables add filter when no columns are available', () => {
    render(
      <ChartFilterControls
        profile={profile}
        spec={createDefaultChartSpec('ds_001', profile)}
        patchSpec={vi.fn()}
        filterColumns={[]}
        getColumnSemanticType={() => 'categorical'}
      />,
    )

    expect(screen.getByRole('button', { name: /add filter/i })).toBeDisabled()
  })
})
