import { render, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { useOpenInSql } from '@/hooks/useOpenInSql'
import { useUiStore } from '@/store/uiStore'

vi.mock('@/lib/sql', () => ({
  formatAnalyticsSql: vi.fn((sql: string) => {
    if (sql.includes('bad')) throw new Error('format failed')
    return sql.trim()
  }),
}))

function PathProbe() {
  const location = useLocation()
  return <div data-testid="path">{location.pathname}</div>
}

function Harness({ sql }: { sql: string }) {
  const open = useOpenInSql()
  return (
    <>
      <PathProbe />
      <button type="button" onClick={() => open(sql)}>
        Open SQL
      </button>
    </>
  )
}

describe('useOpenInSql', () => {
  it('stores formatted SQL and navigates to the SQL page', async () => {
    const user = userEvent.setup()
    useUiStore.setState({ pendingQuery: null })

    const { getByRole, getByTestId } = render(
      <MemoryRouter initialEntries={['/charts']}>
        <Routes>
          <Route path="*" element={<Harness sql="  select 1  " />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(getByRole('button', { name: 'Open SQL' }))
    expect(useUiStore.getState().pendingQuery).toBe('select 1')
    expect(getByTestId('path')).toHaveTextContent('/sql')
  })

  it('falls back to raw SQL when formatting fails', () => {
    useUiStore.setState({ pendingQuery: null })

    const { result } = renderHook(() => useOpenInSql(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    })

    result.current('bad sql')
    expect(useUiStore.getState().pendingQuery).toBe('bad sql')
  })
})
