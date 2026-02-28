/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  DesktopActivityFeed,
  DesktopActivityFeedButton,
  useDesktopActivityFeed,
} from '@/components/desktop/DesktopActivityFeed'

const openChat = vi.fn()
const fetchActivityEntries = vi.fn()
const subscribeToActivityUpdates = vi.fn(() => vi.fn())
const now = Date.now()
const sessionsMock = [
  { key: 'agent:dev:main', updatedAt: now, label: 'Dev Main', displayName: 'Dev' },
  { key: 'agent:ops:main', updatedAt: now, label: 'Ops Main', displayName: 'Ops' },
]
const agentsMock = [{ agent: { id: 'dev', name: 'Dev' } }, { agent: { id: 'ops', name: 'Ops' } }]

vi.mock('@/contexts/ChatContext', () => ({ useChatContext: () => ({ openChat }) }))
vi.mock('@/hooks/useSessionsStream', () => ({
  useSessionsStream: () => ({ sessions: sessionsMock }),
}))
vi.mock('@/hooks/useAgentsRegistry', () => ({
  useAgentsRegistry: () => ({ agents: agentsMock }),
}))
vi.mock('@/services/activityService', () => ({
  fetchActivityEntries: (...args: any[]) => fetchActivityEntries(...args),
  subscribeToActivityUpdates: (...args: any[]) => subscribeToActivityUpdates(...args),
}))

function HookProbe() {
  const state = useDesktopActivityFeed()
  return <button onClick={state.toggle}>{String(state.isOpen)}</button>
}

describe('DesktopActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchActivityEntries.mockImplementation(async (key: string) => [
      {
        id: `${key}-1`,
        sessionKey: key,
        icon: '⚙️',
        description: `${key} event`,
        timestamp: Date.now(),
        type: 'message',
      },
    ])
  })

  it('loads events, subscribes and opens chat on click', async () => {
    render(<DesktopActivityFeed isOpen onClose={() => {}} />)

    expect(await screen.findByText('Activity Feed')).toBeInTheDocument()
    await waitFor(() => expect(fetchActivityEntries).toHaveBeenCalled())
    expect(subscribeToActivityUpdates).toHaveBeenCalled()

    fireEvent.click(screen.getByText('agent:dev:main event'))
    expect(openChat).toHaveBeenCalledWith('agent:dev:main', 'Dev', undefined, undefined)
  })

  it('filters by agent from dropdown', async () => {
    render(<DesktopActivityFeed isOpen onClose={() => {}} />)
    await screen.findByText('Activity Feed')

    fireEvent.click(screen.getByText('All Agents'))
    fireEvent.click(screen.getByText('Dev'))
    expect(screen.getByText(/filtered/)).toBeInTheDocument()
  })

  it('renders toggle button and hook persists state', () => {
    render(<DesktopActivityFeedButton isOpen={false} onClick={() => {}} eventCount={2} />)
    expect(screen.getByTitle('Show Activity Feed')).toBeInTheDocument()

    render(<HookProbe />)
    fireEvent.click(screen.getByText('false'))
    expect(localStorage.getItem('crewhub-desktop-activity-feed-open')).toBe('true')
  })
})
