import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { DatasetProfile } from '@/api/types'
import { Button } from '@/components/ui/button'

export function SuggestedPrompts({
  profile,
  onPick,
  collapsed = false,
}: {
  profile: DatasetProfile | undefined
  onPick: (text: string) => void
  collapsed?: boolean
}) {
  const [expanded, setExpanded] = useState(!collapsed)

  if (!profile) return null

  const prompts: string[] = []
  prompts.push(`How many rows are in this dataset?`)
  if (profile.primary_temporal_column?.name) {
    prompts.push(
      `What is the date range of column ${profile.primary_temporal_column.name}?`,
    )
  }
  const cat = profile.column_profiles.find((c) => c.semantic_type === 'categorical')
  if (cat) {
    prompts.push(`What are the top 10 most frequent values in ${cat.name}?`)
  }
  const highNull = [...profile.column_profiles].sort((a, b) => b.null_pct - a.null_pct)[0]
  if (highNull && highNull.null_pct > 5) {
    prompts.push(`Which columns have the highest null percentage?`)
  }
  if (profile.main_numeric_measures.length) {
    const m = profile.main_numeric_measures[0]
    prompts.push(`Show basic summary statistics (min, max, avg) for ${m}.`)
  }

  const uniq = [...new Set(prompts)].slice(0, 6)
  if (uniq.length === 0) return null

  const showCollapsed = collapsed && !expanded

  return (
    <div className="shrink-0">
      <div
        className={
          showCollapsed
            ? 'flex items-center gap-1'
            : 'flex max-h-24 flex-wrap gap-2 overflow-y-auto'
        }
      >
        {uniq.map((p) => (
          <Button
            key={p}
            type="button"
            variant="outline"
            size="sm"
            className={
              showCollapsed
                ? 'h-7 shrink-0 whitespace-nowrap text-xs'
                : 'h-auto max-w-full whitespace-normal py-1.5 text-left text-xs'
            }
            onClick={() => onPick(p)}
          >
            {p}
          </Button>
        ))}
      </div>
      {collapsed ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-6 gap-0.5 px-1 text-[10px] text-fg-muted"
          aria-label={expanded ? 'Collapse suggested prompts' : 'Expand suggested prompts'}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Less' : 'More prompts'}
        </Button>
      ) : null}
    </div>
  )
}
