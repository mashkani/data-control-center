import { MessageSquare, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/format'
import type { AskOptionsFocus } from '@/features/ask/askComposerState'
import { scopeSummary, type AskScope } from '@/features/ask/askComposerState'
import { cn } from '@/lib/utils'

export function AskContextBar({
  modelLabel,
  maxRows,
  scope,
  datasetCount,
  profileUpdatedAt,
  onOpenSettings,
  onRefreshProfile,
  refreshDisabled,
  onOpenChats,
  showChatsButton,
  hidden,
}: {
  modelLabel: string
  maxRows: number
  scope: AskScope
  datasetCount: number
  profileUpdatedAt?: number
  onOpenSettings: (focus: AskOptionsFocus | null) => void
  onRefreshProfile?: () => void
  refreshDisabled?: boolean
  onOpenChats?: () => void
  showChatsButton?: boolean
  hidden?: boolean
}) {
  if (hidden) return null

  const scopeLabel = scopeSummary(scope, datasetCount)

  return (
    <div
      className="mx-auto flex w-full max-w-5xl shrink-0 flex-wrap items-center gap-2 px-4 py-3 text-white/60"
      data-testid="ask-context-bar"
    >
      {showChatsButton && onOpenChats ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 rounded-full border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 md:hidden"
          onClick={onOpenChats}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chats
        </Button>
      ) : null}

      <button
        type="button"
        className={chipClass}
        onClick={() => onOpenSettings('model')}
        title="Model"
      >
        {modelLabel}
      </button>
      <button
        type="button"
        className={chipClass}
        onClick={() => onOpenSettings('rows')}
        title="Max preview rows"
      >
        {maxRows} rows
      </button>
      {datasetCount > 0 ? (
        <button
          type="button"
          className={chipClass}
          onClick={() => onOpenSettings('scope')}
          title="Dataset scope"
        >
          {scopeLabel}
        </button>
      ) : null}

      {profileUpdatedAt != null ? (
        <span className="text-[10px] text-white/40">
          Profile {formatRelativeTime(profileUpdatedAt)}
        </span>
      ) : null}

      {onRefreshProfile ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-7 gap-1 rounded-full text-xs text-white/50 hover:bg-white/10 hover:text-white"
          disabled={refreshDisabled}
          onClick={onRefreshProfile}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh profile
        </Button>
      ) : null}
    </div>
  )
}

const chipClass = cn(
  'rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1',
  'text-[11px] text-white/55 hover:bg-white/10 hover:text-white',
)
