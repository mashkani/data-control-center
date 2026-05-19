import * as React from 'react'
import { cn } from '@/lib/utils'

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  containerClassName?: string
}

export function Table({ className, containerClassName, ...props }: TableProps) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-lg border border-border-default',
        containerClassName,
      )}
    >
      <table className={cn('w-full text-left text-sm', className)} {...props} />
    </div>
  )
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-white/5 text-[hsl(var(--fg-muted))]', className)} {...props} />
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-white/10', className)} {...props} />
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-white/5', className)} {...props} />
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('px-3 py-2 font-medium whitespace-nowrap', className)}
      {...props}
    />
  )
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2 align-top', className)} {...props} />
}
