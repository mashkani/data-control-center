import type { ChartSpec, ChartType } from '@/features/charts/chartSpec'

const DEFAULT_BAR_TOP_N = 25

const CHART_TYPES: ChartType[] = ['histogram', 'line', 'bar', 'scatter']

function isChartType(value: unknown): value is ChartType {
  return typeof value === 'string' && CHART_TYPES.includes(value as ChartType)
}

/** Resolve chart type from persisted spec version and fields (v2+). */
export function parseChartType(raw: Partial<ChartSpec>, rawVersion: number, base: ChartSpec): ChartType {
  if (isChartType(raw.chartType)) return raw.chartType
  if (rawVersion < 3) return 'line'
  return base.chartType
}

/** Apply version-specific field defaults before merging into a full ChartSpec. */
export function migrateChartSpecFields(raw: Partial<ChartSpec>, rawVersion: number): Partial<ChartSpec> {
  const migrated: Partial<ChartSpec> = { ...raw }
  if (rawVersion < 4) {
    if (migrated.topN == null || !Number.isFinite(Number(migrated.topN))) {
      migrated.topN = DEFAULT_BAR_TOP_N
    }
    if (rawVersion >= 3 && !isChartType(migrated.chartType) && migrated.valueColumn) {
      migrated.chartType = 'histogram'
    }
  }
  return migrated
}
