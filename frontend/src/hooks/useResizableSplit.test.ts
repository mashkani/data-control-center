import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResizableSplit } from '@/hooks/useResizableSplit'

describe('useResizableSplit', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('updates height while dragging', () => {
    const onHeightChange = vi.fn()
    const { result } = renderHook(() =>
      useResizableSplit({ height: 200, onHeightChange, minHeight: 100, maxHeight: 400 }),
    )

    const target = document.createElement('div')
    target.setPointerCapture = vi.fn()

    act(() => {
      result.current.handleProps.onPointerDown?.({
        clientY: 10,
        pointerId: 1,
        preventDefault: vi.fn(),
        currentTarget: target,
      } as unknown as React.PointerEvent<HTMLDivElement>)
    })

    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientY: 40 }))
    })

    expect(onHeightChange).toHaveBeenCalledWith(230)

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup'))
    })
  })

  it('clamps height to min and max', () => {
    const onHeightChange = vi.fn()
    const { result } = renderHook(() =>
      useResizableSplit({ height: 200, onHeightChange, minHeight: 150, maxHeight: 220 }),
    )

    const target = document.createElement('div')
    target.setPointerCapture = vi.fn()

    act(() => {
      result.current.handleProps.onPointerDown?.({
        clientY: 0,
        pointerId: 2,
        preventDefault: vi.fn(),
        currentTarget: target,
      } as unknown as React.PointerEvent<HTMLDivElement>)
    })
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientY: 500 }))
    })
    expect(onHeightChange).toHaveBeenCalledWith(220)

    onHeightChange.mockClear()
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientY: -500 }))
    })
    expect(onHeightChange).toHaveBeenCalledWith(150)
  })
})
