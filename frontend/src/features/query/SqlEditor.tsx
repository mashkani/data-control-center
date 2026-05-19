import { useCallback, useEffect, useImperativeHandle, useMemo, forwardRef } from 'react'
import type { RefObject } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { sql } from '@codemirror/lang-sql'
import { Prec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export type SqlEditorHandle = {
  getSelectedText: () => string
}

export const SqlEditor = forwardRef<
  SqlEditorHandle,
  {
    value: string
    onChange: (value: string) => void
    onRun: () => void
    onFormat?: () => void
    onSave?: () => void
    onSelectionChange?: (selection: string) => void
    editorRef: RefObject<ReactCodeMirrorRef | null>
    height?: number | string
  }
>(function SqlEditor(
  { value, onChange, onRun, onFormat, onSave, onSelectionChange, editorRef, height = 200 },
  ref,
) {
  const runFromShortcut = useCallback(
    (event: Pick<KeyboardEvent, 'defaultPrevented' | 'key' | 'metaKey' | 'ctrlKey' | 'preventDefault' | 'shiftKey'>) => {
      if (event.defaultPrevented) return false
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        onFormat?.()
        return true
      }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        onSave?.()
        return true
      }
      if (event.key !== 'Enter') return false
      if (!event.metaKey && !event.ctrlKey) return false
      event.preventDefault()
      onRun()
      return true
    },
    [onFormat, onRun, onSave],
  )

  const notifySelection = useCallback(
    (view: EditorView) => {
      const selected = view.state.sliceDoc(
        view.state.selection.main.from,
        view.state.selection.main.to,
      )
      onSelectionChange?.(selected.trim())
    },
    [onSelectionChange],
  )

  useImperativeHandle(ref, () => ({
    getSelectedText: () => {
      const view = editorRef.current?.view
      if (!view) return ''
      return view.state
        .sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
        .trim()
    },
  }))

  useEffect(() => {
    if (!onSelectionChange) return
    const view = editorRef.current?.view
    if (!view) return
    const selected = view.state
      .sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
      .trim()
    onSelectionChange(selected)
  }, [editorRef, onSelectionChange, value])

  const extensions = useMemo(
    () => [
      vscodeDark,
      sql(),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet) notifySelection(update.view)
      }),
      Prec.highest(
        EditorView.domEventHandlers({
          keydown: (event) => runFromShortcut(event),
        }),
      ),
    ],
    [notifySelection, runFromShortcut],
  )

  return (
    <div
      className="overflow-hidden rounded-xl border border-border-default"
      onKeyDownCapture={(event) => {
        runFromShortcut(event.nativeEvent)
      }}
    >
      <CodeMirror
        value={value}
        height={typeof height === 'number' ? `${height}px` : height}
        theme="none"
        extensions={extensions}
        onChange={onChange}
        ref={editorRef}
        className="text-sm [&_.cm-editor]:rounded-lg"
        basicSetup={{ lineNumbers: true, foldGutter: false }}
      />
    </div>
  )
})
