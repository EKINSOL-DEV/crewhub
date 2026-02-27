import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MobileActivityPanel } from '@/components/mobile/MobileActivityPanel'

const fetchActivityEntries = vi.fn()
const subscribeToActivityUpdates = vi.fn(() => vi.fn())
const now = Date.now()
const sessionsMock = [{ key: 'agent:dev:main', updatedAt: now, label: 'Dev Session' }]
const agentsMock = [{ agent: { id: 'dev', name: 'Dev' } }]
const projectsMock = [{ id: 'p1', name: 'Project One', color: '#ff0' }]

vi.mock('@/hooks/useSessionsStream', () => ({
  useSessionsStream: () => ({ sessions: sessionsMock }),
}))
vi.mock('@/hooks/useAgentsRegistry', () => ({
  useAgentsRegistry: () => ({ agents: agentsMock }),
}))
vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({ projects: projectsMock }),
}))
vi.mock('@/services/activityService', () => ({
  fetchActivityEntries: (...args: any[]) => fetchActivityEntries(...args),
  subscribeToActivityUpdates: (...args: any[]) => subscribeToActivityUpdates(...args),
}))

describe('MobileActivityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchActivityEntries.mockResolvedValue([
      {
        id: 'e1',
        sessionKey: 'agent:dev:main',
        icon: '💬',
        description: 'Message sent',
        timestamp: Date.now(),
        type: 'message',
      },
      {
        id: 'e2',
        sessionKey: 'agent:dev:main',
        icon: '🔧',
        description: 'Tool called',
        timestamp: Date.now(),
        type: 'tool_call',
      },
    ])
  })

  it('loads feed, refreshes and goes back', async () => {
    const onBack = vi.fn()
    render(<MobileActivityPanel onBack={onBack} />)

    expect(await screen.findByText('Activity Feed')).toBeInTheDocument()
    await waitFor(() => expect(fetchActivityEntries).toHaveBeenCalled())

    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onBack).toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button')[1])
    await waitFor(() => expect(fetchActivityEntries).toHaveBeenCalled())
  })

  it('opens filter sheet and filters by event type', async () => {
    render(<MobileActivityPanel onBack={() => {}} />)
    await screen.findByText('Activity Feed')

    fireEvent.click(screen.getAllByRole('button')[2])
    expect(screen.getByText('Filter Activity')).toBeInTheDocument()
    fireEvent.click(screen.getByText('type'))
    fireEvent.click(screen.getByText('Tool Calls'))

    await waitFor(() => expect(screen.getByText(/1 event/)).toBeInTheDocument())
  })

  it('shows empty-state text when no events', async () => {
    fetchActivityEntries.mockResolvedValueOnce([])
    render(<MobileActivityPanel onBack={() => {}} />)
    await waitFor(() => expect(screen.getByText(/No recent activity/)).toBeInTheDocument())
  })
})
