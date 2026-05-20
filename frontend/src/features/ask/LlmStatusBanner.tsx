import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'

/** Setup docs: docs/user-guide.md#ask-tab */
const LLM_SETUP_DOC =
  'https://github.com/hypertrial/data-control-center/blob/main/docs/user-guide.md#ask-tab'

export function LlmStatusBanner() {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  if (!data?.llm || data.llm.reachable) return null

  return (
    <div
      role="status"
      className="relative z-20 mx-auto mt-2 w-[calc(100%-2rem)] max-w-5xl shrink-0 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100/80"
    >
      <p>
        Ollama is not reachable at the configured endpoint, so{' '}
        <strong className="text-white">Ask</strong> may not work. Columns, Samples, and SQL are unaffected.
      </p>
      <p className="mt-1">
        <a
          href={LLM_SETUP_DOC}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-white underline decoration-white/25 underline-offset-2 hover:decoration-white"
        >
          Local LLM setup (README)
        </a>
        {' · '}
        Configured model: <span className="font-mono text-xs">{data.llm.model}</span>
      </p>
      {data.llm.detail ? (
        <p className="mt-1 font-mono text-xs text-amber-100/70" title={data.llm.detail}>
          {data.llm.detail}
        </p>
      ) : null}
    </div>
  )
}
