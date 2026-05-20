import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AskHero } from '@/features/ask/AskHero'

describe('AskHero', () => {
  it('starts a new chat from the hero CTA', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<AskHero onStartNewChat={onStart} />)
    await user.click(screen.getByRole('button', { name: /Start new chat/i }))
    expect(onStart).toHaveBeenCalled()
  })
})
