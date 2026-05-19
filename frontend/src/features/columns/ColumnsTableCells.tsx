import type { ReactNode } from 'react'
import {
  Calendar,
  CaseSensitive,
  Hash,
  HelpCircle,
  KeyRound,
  Tags,
  ToggleLeft,
} from 'lucide-react'
import type { ColumnProfile, SemanticType } from '@/api/types'
import { formatEdaNumericString } from '@/lib/format'
import { cn } from '@/lib/utils'

export function TypeIcon({ sem }: { sem: SemanticType }) {
  const cls = 'h-3.5 w-3.5 shrink-0 text-[hsl(var(--fg-muted))]'
  const wrap = (label: string, node: ReactNode) => (
    <span title={label} className="inline-flex">
      {node}
    </span>
  )
  switch (sem) {
    case 'numeric':
      return wrap('Numeric', <Hash className={cls} aria-hidden />)
    case 'categorical':
      return wrap('Categorical', <Tags className={cls} aria-hidden />)
    case 'datetime':
      return wrap('Datetime', <Calendar className={cls} aria-hidden />)
    case 'boolean_like':
      return wrap('Boolean-like', <ToggleLeft className={cls} aria-hidden />)
    case 'id_like':
      return wrap('ID-like', <KeyRound className={cls} aria-hidden />)
    case 'text':
      return wrap('Text', <CaseSensitive className={cls} aria-hidden />)
    default:
      return wrap('Unknown', <HelpCircle className={cls} aria-hidden />)
  }
}

export function NullBar({ pct }: { pct: number }) {
  const warm =
    pct > 30
      ? 'bg-[hsl(var(--severity-critical))]'
      : pct > 10
        ? 'bg-[hsl(var(--severity-warning))]'
        : 'bg-[hsl(var(--severity-info))]'
  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10" title={`${pct.toFixed(2)}% null`}>
        <div className={cn('h-full rounded-full transition-all', warm)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="tabular-nums text-xs text-[hsl(var(--fg-muted))]">{pct.toFixed(1)}</span>
    </div>
  )
}

function toFiniteNumber(value: string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function RangeBar({
  min,
  p25,
  median,
  p75,
  max,
}: {
  min: string | null | undefined
  p25: string | null | undefined
  median: string | null | undefined
  p75: string | null | undefined
  max: string | null | undefined
}) {
  const minN = toFiniteNumber(min)
  const maxN = toFiniteNumber(max)
  if (minN == null || maxN == null || minN === maxN) return null

  const span = maxN - minN
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - minN) / span) * 100))
  const p25N = toFiniteNumber(p25)
  const medN = toFiniteNumber(median)
  const p75N = toFiniteNumber(p75)

  return (
    <div className="mt-1.5">
      <div className="relative h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-white/10">
        {p25N != null && p75N != null ? (
          <div
            className="absolute top-0 h-full bg-white/20"
            style={{ left: `${pct(p25N)}%`, width: `${Math.max(0, pct(p75N) - pct(p25N))}%` }}
            title={`IQR ${p25 ?? ''}–${p75 ?? ''}`}
          />
        ) : null}
        {medN != null ? (
          <div
            className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-white/60"
            style={{ left: `${pct(medN)}%` }}
            title={`median ${median ?? ''}`}
          />
        ) : null}
      </div>
      <div className="mt-0.5 flex max-w-[120px] justify-between gap-1 font-mono text-[9px] text-[hsl(var(--fg-muted))]">
        <span className="truncate">{formatEdaNumericString(min)}</span>
        <span className="truncate">{formatEdaNumericString(max)}</span>
      </div>
    </div>
  )
}

export function DistributionCell({ row }: { row: ColumnProfile }) {
  const mean = row.mean_value
  const std = row.std_value
  const hasStats = Boolean(mean || std)
  const hasRange =
    row.min_value != null ||
    row.max_value != null ||
    row.p25_value != null ||
    row.p75_value != null ||
    row.median_value != null

  if (!hasStats && !hasRange) {
    return <span className="text-[hsl(var(--fg-muted))]">—</span>
  }

  return (
    <div className="min-w-[140px] max-w-[12rem] text-xs">
      {hasStats ? (
        <div
          className="truncate font-mono text-fg"
          title={`mean ${mean ?? '—'} · std ${std ?? '—'}`}
        >
          {mean ? <>μ {formatEdaNumericString(mean)}</> : null}
          {mean && std ? <span aria-hidden> · </span> : null}
          {std ? <>σ {formatEdaNumericString(std)}</> : null}
        </div>
      ) : null}
      <RangeBar
        min={row.min_value}
        p25={row.p25_value}
        median={row.median_value}
        p75={row.p75_value}
        max={row.max_value}
      />
    </div>
  )
}
