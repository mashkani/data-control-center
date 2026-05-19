import { describe, expect, it } from 'vitest'
import { buildColumnRoleMap, columnMeasureRole } from '@/features/columns/columnRoleUtils'
import { mkColumn, mkProfile } from '@/test/profileFixtures'

describe('columnMeasureRole', () => {
  it('returns true for numeric columns without structural roles', () => {
    expect(columnMeasureRole(mkColumn({ semantic_type: 'numeric' }), [])).toBe(true)
  })

  it('returns false when structural roles already exist', () => {
    expect(columnMeasureRole(mkColumn({ semantic_type: 'numeric' }), ['grain key'])).toBe(false)
  })

  it('returns false for non-numeric columns', () => {
    expect(columnMeasureRole(mkColumn({ semantic_type: 'text' }), [])).toBe(false)
  })
})

describe('buildColumnRoleMap', () => {
  it('assigns measure to all non-structural numeric columns', () => {
    const profile = mkProfile({
      primary_grain_key_columns: ['player_id', 'year'],
      entity_id_columns: [{ name: 'player_id', confidence: 'high' }],
      primary_temporal_column: { name: 'year', kind: 'discrete_period', confidence: 'high' },
      temporal_columns: [{ name: 'year', kind: 'discrete_period', confidence: 'high' }],
      measure_candidates: [{ name: 'defensive_awareness', score: 0.9, confidence: 'high' }],
      column_profiles: [
        mkColumn({ name: 'player_id', semantic_type: 'id_like' }),
        mkColumn({ name: 'year', semantic_type: 'numeric' }),
        mkColumn({ name: 'gk_reflexes', semantic_type: 'numeric', null_pct: 87 }),
        mkColumn({ name: 'age', semantic_type: 'numeric', null_pct: 0.3 }),
        mkColumn({ name: 'height_cm', semantic_type: 'numeric', null_pct: 0.3 }),
        mkColumn({ name: 'defensive_awareness', semantic_type: 'numeric', null_pct: 1.3 }),
        mkColumn({ name: 'notes', semantic_type: 'text' }),
      ],
    })

    const roles = buildColumnRoleMap(profile)

    expect(roles.get('player_id')).toEqual(['grain key', 'entity id'])
    expect(roles.get('year')).toEqual(['grain key', 'time'])
    expect(roles.get('gk_reflexes')).toEqual(['measure'])
    expect(roles.get('age')).toEqual(['measure'])
    expect(roles.get('height_cm')).toEqual(['measure'])
    expect(roles.get('defensive_awareness')).toEqual(['measure'])
    expect(roles.get('notes')).toBeUndefined()
  })
})
