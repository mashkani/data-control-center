import * as React from 'react'
import { cn } from '@/lib/utils'

type TabsContext = {
  value: string
  onValueChange: (v: string) => void
}

const TabsCtx = React.createContext<TabsContext | null>(null)

export function Tabs({
  value,
  onValueChange,
  className,
  children,
}: {
  value: string
  onValueChange: (v: string) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <TabsCtx.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsCtx.Provider>
  )
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex h-10 items-center gap-1 rounded-lg border border-border-default bg-surface-1/80 p-1',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(TabsCtx)
  if (!ctx) throw new Error('TabsTrigger outside Tabs')
  const active = ctx.value === value
  return (
    <button
      type="button"
      role="tab"
      onClick={() => ctx.onValueChange(value)}
      aria-selected={active}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm transition-[color,background-color,box-shadow] duration-150 ease-out',
        'motion-reduce:transition-none',
        active ? 'bg-surface-2 text-fg shadow-sm ring-1 ring-white/10' : 'text-fg-muted hover:bg-white/5 hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(TabsCtx)
  if (!ctx) throw new Error('TabsContent outside Tabs')
  const active = ctx.value === value
  return (
    <div
      role="tabpanel"
      hidden={!active}
      aria-hidden={!active}
      className={cn(
        'mt-4 transition-opacity duration-150 ease-out motion-reduce:transition-none',
        active ? 'opacity-100' : 'hidden opacity-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
