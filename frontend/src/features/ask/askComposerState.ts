export type AskScope = 'all' | Set<string>
export type AskOptionsFocus = 'model' | 'rows' | 'scope'

const ASK_MODEL_KEY = 'dcc-ask-llm-model'

export function readSavedAskModel(): string {
  try {
    return localStorage.getItem(ASK_MODEL_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveAskModel(model: string): void {
  try {
    localStorage.setItem(ASK_MODEL_KEY, model)
  } catch {
    // Ignore storage failures; model selection still works for the active session.
  }
}

export function scopeSummary(scope: AskScope, datasetCount: number): string {
  if (scope === 'all' || datasetCount === 0) return 'All datasets'
  const selected = scope.size
  return `${selected}/${datasetCount} datasets`
}
