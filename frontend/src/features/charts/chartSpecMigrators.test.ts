import { describe, expect, it } from 'vitest'
import { mkProfile } from '@/test/profileFixtures'
import { CHART_SPEC_VERSION, createDefaultChartSpec, normalizeChartSpec } from '@/features/charts/chartSpec'
import { migrateChartSpecFields, parseChartType } from '@/features/charts/chartSpecMigrators'

describe('chartSpecMigrators', () => {
  it('maps legacy v2 specs without chartType to line', () => {
    const base = createDefaultChartSpec('ds_001', undefined)
    expect(parseChartType({ version: 2, xColumn: 'year' }, 2, base)).toBe('line')
  })

  it('preserves explicit chart types', () => {
    const base = createDefaultChartSpec('ds_001', undefined)
    expect(parseChartType({ chartType: 'bar' }, 4, base)).toBe('bar')
    expect(parseChartType({ chartType: 'scatter' }, 4, base)).toBe('scatter')
  })

  it('falls back to the base chart type when version is 3+ and chartType is missing', () => {
    const base = createDefaultChartSpec('ds_001', undefined)
    expect(parseChartType({ version: 4 }, 4, base)).toBe(base.chartType)
  })

  it('infers histogram chart type for v3 specs with a value column', () => {
    const migrated = migrateChartSpecFields({ version: 3, valueColumn: 'revenue' }, 3)
    expect(migrated.chartType).toBe('histogram')
  })

  it('adds topN when migrating from v3', () => {
    const migrated = migrateChartSpecFields({ version: 3, chartType: 'bar', xColumn: 'region' }, 3)
    expect(migrated.topN).toBe(25)
  })

  it('normalizes v2 line specs to current version', () => {
    const profile = mkProfile()
    const spec = normalizeChartSpec({ version: 2, xColumn: 'year', yColumns: ['rating'] }, 'ds_001', profile)
    expect(spec.version).toBe(CHART_SPEC_VERSION)
    expect(spec.chartType).toBe('line')
  })

  it('normalizes v3 histogram specs to v4', () => {
    const profile = mkProfile()
    const spec = normalizeChartSpec({ version: 3, chartType: 'histogram', valueColumn: 'revenue' }, 'ds_001', profile)
    expect(spec.version).toBe(CHART_SPEC_VERSION)
    expect(spec.chartType).toBe('histogram')
    expect(spec.topN).toBe(25)
  })
})
