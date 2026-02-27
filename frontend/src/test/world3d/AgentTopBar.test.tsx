import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentTopBar } from '@/components/world3d/AgentTopBar'
import type { CrewSession } from '@/lib/api'

const focusBot = vi.fn()
const openChat = vi.fn()
let worldLevel: 'world' | 'firstperson' | 'bot' = 'world'

vi.mock('@/contexts/WorldFocusContext', () => ({
  useWorldFocus: () => ({ state: { level: worldLevel }, focusBot }),
}))

vi.mock('@/contexts/ChatContext', () => ({
  useChatContext: () => ({ openChat }),
}))

function session(key: string, updatedAt: number, label?: string): CrewSession {
  return { key, sessionId: key, kind: 'agent', channel: 'whatsapp', updatedAt, label }
}

const getBotConfig = (_key: string, label?: string) => ({
  color: '#6366f1',
  expression: 'happy' as const,
  icon: '🤖',
  variant: 'worker' as const,
  accessory: 'crown' as const,
  chestDisplay: 'tool' as const,
  label: label || 'Bot',
})

describe('AgentTopBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-27T12:00:00Z'))
    worldLevel = 'world'
    focusBot.mockReset()
    openChat.mockReset()
    localStorage.clear()
  })

  it('hides when world focus is firstperson', () => {
    worldLevel = 'firstperson'
    const { container } = render(
      <AgentTopBar
        sessions={[session('agent:main:main', Date.now(), 'Assistent')]}
        getBotConfig={getBotConfig}
        getRoomForSession={() => 'hq'}
        defaultRoomId="hq"
        isActivelyRunning={() => false}
        displayNames={new Map()}
        rooms={[{ id: 'hq', name: 'HQ' }]}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders assistant and opens/focuses chat on click', () => {
    render(
      <AgentTopBar
        sessions={[session('agent:main:main', Date.now(), 'Assistent')]}
        getBotConfig={getBotConfig}
        getRoomForSession={() => 'hq'}
        defaultRoomId="hq"
        isActivelyRunning={(key) => key === 'agent:main:main'}
        displayNames={new Map()}
        rooms={[{ id: 'hq', name: 'Headquarters' }]}
      />
    )

    fireEvent.click(screen.getByTitle('Fly to Assistent'))
    expect(focusBot).toHaveBeenCalledWith('agent:main:main', 'hq')
    expect(openChat).toHaveBeenCalledWith('agent:main:main', 'Assistent', '🤖', '#6366f1')
  })

  it('shows picker entries, supports pinning and unpinning', () => {
    const sessions = [
      session('agent:main:main', Date.now(), 'Assistent'),
      session('agent:alice:main', Date.now() - 1_000, 'Alice'),
      session('agent:alice:subagent:123', Date.now() - 2_000, 'Alice Child'),
    ]

    render(
      <AgentTopBar
        sessions={sessions}
        getBotConfig={getBotConfig}
        getRoomForSession={(key) => (key.includes('alice') ? 'room-a' : 'hq')}
        defaultRoomId="hq"
        isActivelyRunning={() => false}
        displayNames={new Map()}
        rooms={[
          { id: 'hq', name: 'Headquarters' },
          { id: 'room-a', name: 'Room A' },
        ]}
        agentRuntimes={
          [
            {
              agent: { id: 'a', name: 'Alice', agent_session_key: 'agent:alice:main' },
              session: sessions[1],
            },
            {
              agent: {
                id: 'b',
                name: 'Bob',
                agent_session_key: 'agent:bob:main',
                default_room_id: 'hq',
              },
              session: null,
            },
          ] as any
        }
      />
    )

    fireEvent.click(screen.getByTitle('Browse agents'))
    expect(screen.getByText('Fixed Agents')).toBeInTheDocument()
    expect(screen.getByText('Recently Active')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()

    const aliceItem = screen.getAllByRole('button', { name: /Alice/i })[0]
    fireEvent.mouseEnter(aliceItem)
    fireEvent.click(screen.getByTitle('Pin to top bar'))

    expect(localStorage.getItem('crewhub-pinned-agent')).toBe('agent:alice:main')
    expect(screen.getByTitle(/Fly to Alice/i)).toBeInTheDocument()

    const flyAlice = screen.getByTitle(/Fly to Alice/i)
    fireEvent.mouseEnter(flyAlice)
    fireEvent.click(screen.getByTitle('Unpin agent'))
    expect(localStorage.getItem('crewhub-pinned-agent')).toBeNull()
  })
})
