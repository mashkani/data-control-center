import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

function RoutePageTransitionFrame({ children }: { children: ReactNode }) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      data-testid="route-page-transition"
      className={cn(
        'h-full',
        'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
      )}
    >
      {children}
    </div>
  )
}

/** Fade/slide primary route content on pathname change (Tailwind only). */
export function RoutePageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <RoutePageTransitionFrame key={pathname}>{children}</RoutePageTransitionFrame>
}
