import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ActionInSql } from '@/components/ActionInSql'
import { useUiStore } from '@/store/uiStore'

describe('ActionInSql', () => {
  it('opens the SQL editor with the provided query', async () => {
    const user = userEvent.setup()
    useUiStore.setState({ pendingQuery: null })

    render(
      <MemoryRouter>
        <ActionInSql sql="select 1">Open in SQL</ActionInSql>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Open in SQL' }))
    expect(useUiStore.getState().pendingQuery).toBe('select 1;')
  })
})
