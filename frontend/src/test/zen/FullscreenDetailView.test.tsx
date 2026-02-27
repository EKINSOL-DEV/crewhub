import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FullscreenDetailView } from '@/components/zen/FullscreenDetailView'

let historyState: any

vi.mock('@/components/shared/sessionHistoryUtils', () => ({
  useSessionHistory: () => historyState,
}))

vi.mock('@/components/shared/SessionHistoryView', () => ({
  SessionHistoryView: ({ messages, emptyText, loadingText, error }: any) => (
    <div>
      <div>history-count:{messages.length}</div>
      {emptyText && <div>{emptyText}</div>}
      {loadingText && <div>{loadingText}</div>}
      {error && <div>{error}</div>}
    </div>
  ),
}))

describe('FullscreenDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    historyState = {
      messages: [
        { id: 'm1', timestamp: 2, content: [{ type: 'text', text: 'hello world' }] },
        { id: 'm2', timestamp: 1, content: [{ type: 'text', text: 'other' }] },
      ],
      loading: false,
      error: null,
      usageTotals: { total: 12, input: 7, output: 5, cost: 0.01 },
    }
  })

  it('renders session details and filter controls', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <FullscreenDetailView
        type="session"
        session={
          {
            key: 'agent:a1:main',
            displayName: 'Agent One',
            label: 'A1',
            model: 'opus',
            channel: 'direct',
            kind: 'agent',
            updatedAt: Date.now(),
            contextTokens: 22,
            totalTokens: 55,
          } as any
        }
        onClose={onClose}
      />
    )

    expect(screen.getByText('Agent One')).toBeInTheDocument()
    expect(screen.getByText(/2 of 2 messages/)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Filter messages...'), {
      target: { value: 'hello' },
    })
    expect(screen.getByText(/1 of 2 messages/)).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Close (Esc)'))
    expect(onClose).toHaveBeenCalledTimes(1)

    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('handles activity mode and escape key close', () => {
    const onClose = vi.fn()
    render(
      <FullscreenDetailView
        type="activity"
        task={
          {
            id: 't1',
            title: 'Run task',
            status: 'running',
            sessionKey: 'agent:a1:main',
            agentName: 'Agent One',
            agentIcon: '🤖',
          } as any
        }
        session={null}
        onClose={onClose}
      />
    )

    expect(screen.getAllByText('Run task').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Running/).length).toBeGreaterThan(0)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
