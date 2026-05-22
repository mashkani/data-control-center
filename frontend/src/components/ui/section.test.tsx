import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageContainer, Section } from '@/components/ui/section'

describe('Section', () => {
  it('renders optional header content and children', () => {
    render(
      <Section title="Overview" description="Dataset summary" action={<button type="button">Action</button>}>
        <p>Body</p>
      </Section>,
    )

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText('Dataset summary')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('renders children without a header when metadata is omitted', () => {
    render(
      <Section>
        <p>Only body</p>
      </Section>,
    )

    expect(screen.getByText('Only body')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})

describe('PageContainer', () => {
  it('wraps page content with layout classes', () => {
    const { container } = render(<PageContainer>Page</PageContainer>)
    expect(container.firstChild).toHaveClass('space-y-6')
    expect(screen.getByText('Page')).toBeInTheDocument()
  })
})
