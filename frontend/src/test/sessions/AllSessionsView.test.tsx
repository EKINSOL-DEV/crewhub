import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AllSessionsView } from '@/components/sessions/AllSessionsView'

vi.mock('@/lib/minionUtils', () => ({
  hasActiveSubagents: (session: any) => session.key === 'agent:main:super',
}))

vi.mock('@/components/sessions/LogViewer', () => ({
  LogViewer: ({ session, open }: any) => (
    <div data-testid="log-viewer">{open && session ? `open:${session.key}` : 'closed'}</div>
  ),
}))

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
})

describe('AllSessionsView', () => {
  const sessions: any[] = [
    {
      key: 'agent:main:alpha',
      displayName: 'Alpha',
      updatedAt: 995_000,
      totalTokens: 1500,
      model: 'gpt-4',
    },
    {
      key: 'agent:main:aborted',
      label: 'Aborty',
      updatedAt: 900_000,
      totalTokens: 10,
      abortedLastRun: true,
    },
    {
      key: 'agent:main:super',
      label: 'Supervisor',
      updatedAt: 900_000,
      totalTokens: 500,
    },
  ]

  it('renders sessions, filters, sorts, and opens log viewer', () => {
    render(<AllSessionsView sessions={sessions as any} />)

    expect(screen.getByText('3 of 3 sessions')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Aborted')).toBeInTheDocument()
    expect(screen.getByText('Supervising')).toBeInTheDocument()
    expect(screen.getByText('1.5K')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search sessions...'), {
      target: { value: 'alpha' },
    })
    expect(screen.getByText('1 of 3 sessions')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /tokens/i }))
    fireEvent.click(screen.getByRole('button', { name: /tokens/i }))

    fireEvent.click(screen.getByRole('button', { name: '' }))
    expect(screen.getByTestId('log-viewer')).toHaveTextContent('open:agent:main:alpha')
  })

  it('shows empty state when no session matches', () => {
    render(<AllSessionsView sessions={sessions as any} />)
    fireEvent.change(screen.getByPlaceholderText('Search sessions...'), {
      target: { value: 'not-found' },
    })
    expect(screen.getByText('No sessions found')).toBeInTheDocument()
  })
})
