import { useMemo } from 'react'
import { Copy, Link2, RefreshCw, Trash2 } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { sql as sqlLang } from '@codemirror/lang-sql'
import { EditorView } from '@codemirror/view'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { QueryErrorBanner } from '@/components/ui/query-error-banner'
import type { AskTurn as AskTurnType, QueryResult } from '@/api/types'
import { AskResultTable } from '@/features/ask/AskResultTable'
import { stripTrailingLimit } from '@/features/ask/askTableUtils'
import { AskStageTimeline } from '@/features/ask/AskStageTimeline'
import type { AskSqlAttempt, AskStageEntry } from '@/hooks/useAskStream'
import { shouldShowStreamingModelNote } from '@/features/ask/askTurnDisplay'
import { formatAnalyticsSql } from '@/lib/sql'
import { toast } from 'sonner'

function formatElapsedMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function SqlBlock({
  sql,
  onOpenInSql,
}: {
  sql: string
  onOpenInSql: (sql: string) => void
}) {
  const displaySql = useMemo(() => {
    try {
      return formatAnalyticsSql(sql)
    } catch {
      return sql
    }
  }, [sql])

  const extensions = useMemo(
    () => [
      vscodeDark,
      sqlLang(),
      EditorView.editable.of(false),
      EditorView.theme({
        '&': { backgroundColor: 'transparent' },
        '.cm-scroller': { overflow: 'auto' },
      }),
    ],
    [],
  )

  return (
    <details open className="group rounded-2xl border border-white/10 bg-black/20">
      <summary className="cursor-pointer list-none px-4 py-3 marker:hidden">
        <span className="text-xs font-medium text-white/55">Generated SQL</span>
      </summary>
      <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 pb-3">
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenInSql(sql)}>
          Open in SQL
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenInSql(stripTrailingLimit(sql))}
        >
          Open without LIMIT
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(displaySql)
            toast.success('SQL copied')
          }}
        >
          Copy
        </Button>
      </div>
      <div className="overflow-hidden border-t border-white/10">
        <CodeMirror
          value={displaySql}
          height="120px"
          theme="none"
          extensions={extensions}
          editable={false}
          className="text-xs [&_.cm-editor]:rounded-lg"
          basicSetup={{ lineNumbers: true, foldGutter: false }}
        />
      </div>
    </details>
  )
}

function adaptAttemptsToTimeline(attempts: Record<string, unknown>[]): AskSqlAttempt[] {
  const out: AskSqlAttempt[] = []
  let i = 0
  for (const a of attempts) {
    i += 1
    const sqlStr = typeof a.sql === 'string' ? a.sql : ''
    const err =
      typeof a.error === 'string' ? a.error : a.error != null ? String(a.error) : 'error'
    const att = typeof a.attempt === 'number' ? a.attempt : i
    out.push({ sql: sqlStr, error: err, attempt: att })
  }
  return out
}

function TurnMetaSummary({
  model,
  attemptCount,
  elapsedMs,
}: {
  model?: string | null
  attemptCount: number
  elapsedMs?: number | null
}) {
  const attemptLabel = attemptCount === 1 ? '1 attempt' : `${attemptCount} attempts`
  const parts = [
    model ?? null,
    attemptCount > 0 ? attemptLabel : null,
    elapsedMs != null ? formatElapsedMs(elapsedMs) : null,
  ].filter(Boolean)
  return <div className="text-[10px] text-white/40">{parts.join(' · ')}</div>
}

function TurnActionToolbar({
  answer,
  onCopyAnswer,
  onCopyMarkdown,
  onRegenerate,
  onDelete,
  onAnchor,
}: {
  answer: string
  onCopyAnswer: () => void
  onCopyMarkdown: () => void
  onRegenerate?: () => void
  onDelete?: () => void
  onAnchor: () => void
}) {
  return (
    <div className="flex flex-wrap gap-1 text-white/50">
      {answer ? (
        <>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 rounded-full px-2 text-xs text-white/55 hover:bg-white/10 hover:text-white" onClick={onCopyAnswer}>
            <Copy className="h-3 w-3" />
            Copy answer
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 rounded-full px-2 text-xs text-white/55 hover:bg-white/10 hover:text-white" onClick={onCopyMarkdown}>
            Copy markdown
          </Button>
        </>
      ) : null}
      {onRegenerate ? (
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 rounded-full px-2 text-xs text-white/55 hover:bg-white/10 hover:text-white" onClick={onRegenerate}>
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </Button>
      ) : null}
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 rounded-full px-2 text-xs text-white/55 hover:bg-white/10 hover:text-white" onClick={onAnchor}>
        <Link2 className="h-3 w-3" />
        Anchor
      </Button>
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 rounded-full px-2 text-xs text-white/45 hover:bg-white/10 hover:text-[hsl(var(--status-error))]"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </Button>
      ) : null}
    </div>
  )
}

export function AskTurnCard({
  turn,
  onOpenInSql,
  onRetry,
  onDelete,
}: {
  turn: AskTurnType
  onOpenInSql: (sql: string) => void
  onRetry?: (question: string, model?: string | null) => void
  onDelete?: (turnId: string) => void
}) {
  const attempts = adaptAttemptsToTimeline(turn.attempts ?? [])
  const stages: AskStageEntry[] =
    attempts.length > 0
      ? [
          { name: 'context', at: 0 },
          { name: 'draft_sql', at: 0 },
          { name: 'execute', at: 0 },
          { name: 'summarize', at: 0 },
        ]
      : []

  const displayAnswer = turn.answer ?? ''
  const showDebugTimeline = !!turn.error && attempts.length > 0

  const anchorTurn = () => {
    window.location.hash = `turn=${turn.turn_id}`
    document.getElementById(`turn-${turn.turn_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div id={`turn-${turn.turn_id}`} className="w-full max-w-5xl scroll-mt-4 space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[min(42rem,90%)] rounded-[1.35rem] bg-[#2f3033] px-4 py-3 text-sm leading-6 text-white/95 shadow-[0_10px_40px_rgba(0,0,0,0.22)]">
          {turn.question}
        </div>
      </div>

      <div className="space-y-3 rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
        <TurnMetaSummary
          model={turn.model}
          attemptCount={attempts.length}
          elapsedMs={turn.elapsed_ms}
        />
        <TurnActionToolbar
          answer={displayAnswer}
          onCopyAnswer={() => {
            void navigator.clipboard.writeText(displayAnswer)
            toast.success('Answer copied')
          }}
          onCopyMarkdown={() => {
            void navigator.clipboard.writeText(displayAnswer)
            toast.success('Markdown copied')
          }}
          onRegenerate={onRetry ? () => onRetry(turn.question, turn.model) : undefined}
          onDelete={onDelete ? () => onDelete(turn.turn_id) : undefined}
          onAnchor={anchorTurn}
        />

        {showDebugTimeline ? (
          <AskStageTimeline
            stages={stages}
            sqlAttempts={attempts}
            totalMs={turn.elapsed_ms ?? null}
            busy={false}
          />
        ) : null}
        {turn.error ? <QueryErrorBanner message={turn.error} /> : null}
        {turn.sql ? <SqlBlock sql={turn.sql} onOpenInSql={onOpenInSql} /> : null}
        {turn.query_result && !turn.query_result.error ? (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <AskResultTable queryResult={turn.query_result} />
          </div>
        ) : null}
        {turn.query_result?.error ? <QueryErrorBanner message={turn.query_result.error} /> : null}
        {displayAnswer ? (
          <div className="rounded-2xl bg-black/15 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wider text-white/40">Answer</div>
            <div className="prose prose-invert prose-sm mt-2 max-w-none text-white/90 [&_p]:my-2 [&_ul]:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayAnswer}</ReactMarkdown>
            </div>
          </div>
        ) : null}
        {turn.error && onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-white/10 bg-white/[0.04]"
            onClick={() => onRetry(turn.question, turn.model)}
          >
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function StreamingAskCard({
  question,
  busy,
  stages,
  sqlAttempts,
  sql,
  explanation,
  queryResult,
  answer,
  error,
  streamingPreview,
  model,
  totalMs,
  onOpenInSql,
  onRetry,
}: {
  question: string
  busy: boolean
  stages: AskStageEntry[]
  sqlAttempts: AskSqlAttempt[]
  sql: string | null
  explanation: string | null
  queryResult: QueryResult | null
  answer: string | null
  error: string | null
  streamingPreview: string
  model: string | null
  totalMs: number | null
  onOpenInSql: (sql: string) => void
  onRetry?: (q: string, model?: string | null) => void
}) {
  const displayAnswer = answer || streamingPreview || ''
  const showModelNote = shouldShowStreamingModelNote(explanation, answer)
  return (
    <div className="w-full max-w-5xl space-y-3" aria-busy={busy}>
      <div className="flex justify-end">
        <div className="max-w-[min(42rem,90%)] rounded-[1.35rem] bg-[#2f3033] px-4 py-3 text-sm leading-6 text-white/95 shadow-[0_10px_40px_rgba(0,0,0,0.22)]">
          {question}
        </div>
      </div>
      <div className="space-y-3 rounded-[1.6rem] border border-dashed border-white/15 bg-white/[0.05] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
        {model ? (
          <TurnMetaSummary model={model} attemptCount={0} elapsedMs={totalMs} />
        ) : null}

        {(busy || stages.length > 0) && (
          <AskStageTimeline stages={stages} sqlAttempts={sqlAttempts} totalMs={totalMs} busy={busy} />
        )}
        {showModelNote ? (
          <div className="rounded-2xl bg-black/15 px-4 py-3">
            <div className="text-xs font-medium text-white/40">Model note</div>
            <p className="mt-1 text-sm text-white/90">{explanation}</p>
          </div>
        ) : null}
        {error ? <QueryErrorBanner message={error} /> : null}
        {sql ? <SqlBlock sql={sql} onOpenInSql={onOpenInSql} /> : null}
        {queryResult && !queryResult.error ? (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <AskResultTable queryResult={queryResult} />
          </div>
        ) : null}
        {queryResult?.error ? <QueryErrorBanner message={queryResult.error} /> : null}
        {displayAnswer ? (
          <div
            role="region"
            aria-live="polite"
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-white/40">Answer</div>
            <div className="prose prose-invert prose-sm mt-2 max-w-none text-white/90 [&_p]:my-2 [&_ul]:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayAnswer}</ReactMarkdown>
            </div>
          </div>
        ) : null}
        {error && onRetry && !busy ? (
          <Button type="button" variant="outline" size="sm" className="rounded-full border-white/10 bg-white/[0.04]" onClick={() => onRetry(question, model)}>
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  )
}
