import { describe, expect, it, beforeEach } from 'vitest'
import {
  readSavedAskModel,
  saveAskModel,
  scopeSummary,
  type AskScope,
} from '@/features/ask/askComposerState'

describe('askComposerState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reads and saves model preference', () => {
    expect(readSavedAskModel()).toBe('')
    saveAskModel('llama3.2:3b')
    expect(readSavedAskModel()).toBe('llama3.2:3b')
  })

  it('summarizes dataset scope', () => {
    expect(scopeSummary('all', 3)).toBe('All datasets')
    const partial: AskScope = new Set(['ds_a', 'ds_b'])
    expect(scopeSummary(partial, 3)).toBe('2/3 datasets')
  })
})
