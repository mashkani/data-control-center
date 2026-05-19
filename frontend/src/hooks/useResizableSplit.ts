import { useCallback, useEffect, useRef, useState } from 'react'

type UseResizableSplitOptions = {
  height: number
  onHeightChange: (height: number) => void
  minHeight?: number
  maxHeight?: number
}

export function useResizableSplit({
  height,
  onHeightChange,
  minHeight = 120,
  maxHeight = 720,
}: UseResizableSplitOptions) {
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)
  const startHeight = useRef(height)

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      startY.current = event.clientY
      startHeight.current = height
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [height],
  )

  useEffect(() => {
    if (!dragging) return

    const onMove = (event: PointerEvent) => {
      const delta = event.clientY - startY.current
      const next = Math.min(maxHeight, Math.max(minHeight, startHeight.current + delta))
      onHeightChange(next)
    }

    const onUp = () => setDragging(false)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, maxHeight, minHeight, onHeightChange])

  return {
    dragging,
    handleProps: {
      role: 'separator' as const,
      'aria-orientation': 'horizontal' as const,
      'aria-valuenow': height,
      tabIndex: 0,
      onPointerDown,
      className: dragging
        ? 'h-1.5 cursor-row-resize bg-border-accent'
        : 'h-1.5 cursor-row-resize bg-border-default hover:bg-border-accent',
    },
  }
}
