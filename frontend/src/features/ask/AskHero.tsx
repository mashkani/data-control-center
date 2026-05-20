import { MessageSquarePlus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AskHero({
  onStartNewChat,
}: {
  onStartNewChat?: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8" data-testid="ask-hero">
      <div className="w-full max-w-4xl space-y-6 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] shadow-[0_18px_60px_rgba(0,0,0,0.32)]">
            <Sparkles className="h-5 w-5 text-[hsl(var(--accent))]" aria-hidden />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-medium tracking-tight text-white sm:text-3xl">
              What should we ask?
              <span className="sr-only">Ask your data</span>
            </h2>
            <p className="mx-auto max-w-xl text-sm leading-6 text-white/55">
              Ask your local data in plain language. The assistant drafts read-only SQL, runs it
              locally, and summarizes the result.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-white/45">
          {onStartNewChat ? (
            <Button type="button" variant="ghost" size="sm" className="gap-1 text-white/55 hover:text-white" onClick={onStartNewChat}>
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Start new chat
            </Button>
          ) : null}
          <span>Tip: use ⌘+Enter to send · ↑ to recall your last question</span>
        </div>
      </div>
    </div>
  )
}
