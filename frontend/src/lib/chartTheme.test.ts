import { afterEach, describe, expect, it } from 'vitest'
import { chartAxisLabelStyle, chartPalette, chartTooltip, hslFromRootVar } from '@/lib/chartTheme'

describe('chartTheme', () => {
  const originalDocument = globalThis.document

  afterEach(() => {
    globalThis.document = originalDocument
  })

  it('uses fallback colors when document is unavailable', () => {
    Reflect.deleteProperty(globalThis, 'document')
    expect(hslFromRootVar('--accent')).toBe('hsl(0, 0%, 45%)')
    expect(hslFromRootVar('--accent', 0.5)).toBe('hsla(0, 0%, 45%, 0.35)')
    expect(chartPalette().length).toBe(5)
    expect(chartTooltip()).toMatchObject({ borderWidth: 1 })
    expect(chartAxisLabelStyle()).toEqual({ color: 'hsl(0, 0%, 45%)', fontSize: 11 })
  })
})
