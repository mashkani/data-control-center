import { describe, expect, it } from 'vitest'
import {
  filterOperatorsForSemantic,
  filterValueDisabled,
  nativeSelectClassName,
} from '@/features/charts/chartControlOptions'

describe('chartControlOptions', () => {
  it('returns comparison operators for numeric and datetime columns', () => {
    const numeric = filterOperatorsForSemantic('numeric').map((item) => item.value)
    expect(numeric).toContain('gt')
    expect(numeric).toContain('is_null')
    expect(numeric).not.toContain('contains')

    const datetime = filterOperatorsForSemantic('datetime').map((item) => item.value)
    expect(datetime).toEqual(numeric)
  })

  it('returns text operators for text columns', () => {
    const operators = filterOperatorsForSemantic('text').map((item) => item.value)
    expect(operators).toContain('contains')
    expect(operators).toContain('starts_with')
    expect(operators).not.toContain('gt')
  })

  it('returns equality operators for categorical columns', () => {
    const operators = filterOperatorsForSemantic('categorical').map((item) => item.value)
    expect(operators).toEqual(['eq', 'neq', 'in', 'is_null', 'is_not_null'])
  })

  it('returns the full operator list for unknown semantic types', () => {
    const operators = filterOperatorsForSemantic('unknown')
    expect(operators.length).toBeGreaterThan(10)
    expect(operators.some((item) => item.value === 'contains')).toBe(true)
  })

  it('disables filter value inputs for null checks', () => {
    expect(filterValueDisabled('is_null')).toBe(true)
    expect(filterValueDisabled('is_not_null')).toBe(true)
    expect(filterValueDisabled('eq')).toBe(false)
  })

  it('adds disabled styling when nativeSelectClassName is disabled', () => {
    expect(nativeSelectClassName(true)).toContain('opacity-50')
    expect(nativeSelectClassName(false)).not.toContain('opacity-50')
  })
})
