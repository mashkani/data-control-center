import { qualityScoreSeverity, type SeverityKey } from '@/lib/tokens'
import { cn } from '@/lib/utils'

function severityBarClass(sev: SeverityKey): string {
  if (sev === 'critical') return 'bg-[hsl(var(--severity-critical))]'
  if (sev === 'warning') return 'bg-[hsl(var(--severity-warning))]'
  return 'bg-[hsl(var(--severity-ok))]'
}

function severityTextClass(sev: SeverityKey): string {
  if (sev === 'critical') return 'text-[hsl(var(--severity-critical))]'
  if (sev === 'warning') return 'text-[hsl(var(--severity-warning))]'
  return 'text-[hsl(var(--severity-ok))]'
}

function severityLabel(sev: SeverityKey): string {
  if (sev === 'ok') return 'Healthy'
  return sev
}

/** Inline score + bar for section headers (e.g. Quality page overview). */
export function QualityScoreSummary({
  score,
  className,
}: {
  score: number | null | undefined
  className?: string
}) {
  if (score == null) {
    return <span className={cn('tabular-nums text-2xl font-semibold', className)}>—</span>
  }
  const sev = qualityScoreSeverity(score)
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-baseline gap-2 tabular-nums">
        <span className="text-2xl font-semibold">{score}</span>
        <span className="text-sm text-[hsl(var(--fg-muted))]">/100</span>
        <span
          className={cn(
            'text-[10px] font-medium uppercase tracking-wider',
            severityTextClass(sev),
          )}
        >
          {severityLabel(sev)}
        </span>
      </div>
      <div className="h-2.5 max-w-xs overflow-hidden rounded-full bg-white/10">
        <div
          className={cn('h-full rounded-full transition-all', severityBarClass(sev))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
