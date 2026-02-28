/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ActiveTasksOverlay, ActiveTasksBadge } from '@/components/mobile/ActiveTasksOverlay'
import type { CrewSession } from '@/lib/api'

const fetchSessionHistory = vi.fn()
const subscribeToActivityUpdates = vi.fn(() => vi.fn())

vi.mock('@/services/activityService', () => ({
  fetchSessionHistory: (...args: any[]) => fetchSessionHistory(...args),
  subscribeToActivityUpdates: (...args: any[]) => subscribeToActivityUpdates(...args),
}))

const now = Date.now()
const sessions: CrewSession[] = [
  {
    key: 'agent:dev:subagent:aaaa1111',
    sessionId: '1',
    kind: 'agent',
    channel: 'whatsapp',
    label: 'Builder',
    model: 'sonnet',
    updatedAt: now - 1_000,
  },
  {
    key: 'agent:dev:subagent:bbbb2222',
    sessionId: '2',
    kind: 'agent',
    channel: 'whatsapp',
    label: 'Reviewer',
    updatedAt: now - 700_000,
  },
]

describe('ActiveTasksOverlay', () => {
  beforeEach(() => {
    fetchSessionHistory.mockReset()
    subscribeToActivityUpdates.mockClear()
    fetchSessionHistory.mockResolvedValue({
      messages: [
        { role: 'assistant', content: '**done** `ok`', timestamp: now },
        { role: 'tool', content: 'tool content' },
      ],
    })
  })

  it('renders running/idle sections and opens task logs', async () => {
    const onClose = vi.fn()
    render(<ActiveTasksOverlay sessions={sessions} onClose={onClose} />)

    expect(screen.getByText(/Running \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Idle \(1\)/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Builder'))

    await waitFor(() => {
      expect(fetchSessionHistory).toHaveBeenCalledWith('agent:dev:subagent:aaaa1111', {
        limit: 100,
      })
    })
    expect(subscribeToActivityUpdates).toHaveBeenCalled()

    await waitFor(() => expect(screen.getByText('done')).toBeInTheDocument())
    expect(screen.getByText('ok')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByText('Active Tasks')).toBeInTheDocument()
  })

  it('renders badge only when count > 0', () => {
    const onClick = vi.fn()
    const { rerender } = render(<ActiveTasksBadge count={2} onClick={onClick} />)
    fireEvent.click(screen.getByText('2'))
    expect(onClick).toHaveBeenCalled()

    rerender(<ActiveTasksBadge count={0} onClick={onClick} />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
