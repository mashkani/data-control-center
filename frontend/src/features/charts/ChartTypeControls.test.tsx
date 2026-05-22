import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChartTypeControls } from '@/features/charts/ChartTypeControls'
import { createDefaultChartSpec } from '@/features/charts/chartUtils'
import { mkColumn, mkProfile } from '@/test/profileFixtures'

function profileWithCategories() {
  return mkProfile({
    column_profiles: [
      mkColumn({ name: 'region', semantic_type: 'categorical', cardinality: 4 }),
      mkColumn({ name: 'revenue', semantic_type: 'numeric' }),
    ],
    measure_candidates: [{ name: 'revenue', score: 0.9, confidence: 'high' }],
    temporal_columns: [],
    primary_temporal_column: null,
  })
}

describe('ChartTypeControls', () => {
  it('switches to bar chart with count-only defaults', async () => {
    const user = userEvent.setup()
    const profile = profileWithCategories()
    const spec = createDefaultChartSpec('ds_001', profile)
    const patchSpec = vi.fn()

    render(
      <ChartTypeControls
        profile={profile}
        spec={spec}
        patchSpec={patchSpec}
        temporalColumns={[]}
        numericColumns={['revenue']}
        categoryColumns={['region']}
        isBucketableTemporalColumn={() => false}
        getTemporalKind={() => null}
        getColumnIsInteger={() => false}
      />,
    )

    await user.selectOptions(screen.getByLabelText('Chart type'), 'bar')
    expect(patchSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        chartType: 'bar',
        xColumn: 'region',
        yColumns: ['revenue'],
        aggregation: 'sum',
      }),
    )
  })
})
