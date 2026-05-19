import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/** Scrollable main region; resets scroll to top when the pathname changes. */
export function MainScrollRegion({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 })
  }, [pathname])

  return (
    <main ref={mainRef} className="min-h-0 flex-1 overflow-auto" data-testid="main-scroll-region">
      {children}
    </main>
  )
}
