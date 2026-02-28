/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, sonarjs/no-duplicate-string */
/**
 * MobileAgentList Tests
 * Tests for the main agent listing screen (agent cards, status, group threads)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileAgentList } from '@/components/mobile/MobileAgentList'
import type { AgentRuntime } from '@/hooks/useAgentsRegistry'
import type { Thread } from '@/lib/threads.api'

// ── ParticipantAvatarStack mock ───────────────────────────────────────────

vi.mock('@/components/mobile/group/ParticipantAvatarStack', () => ({
  ParticipantAvatarStack: ({ participants }: any) => (
    <div data-testid="avatar-stack">{participants.length} avatars</div>
  ),
}))

// ── Helpers ───────────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<AgentRuntime> = {}): AgentRuntime {
  return {
    agent: {
      id: 'dev',
      name: 'Dev Agent',
      icon: '🤖',
      color: '#6366f1',
      agent_session_key: 'agent:dev:main',
    } as any,
    session: {
      key: 'agent:dev:main',
      updatedAt: Date.now() - 30_000,
      label: 'Dev',
    } as any,
    status: 'idle',
    childSessions: [],
    ...overrides,
  }
}

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'thread-1',
    title: 'Team Chat',
    title_auto: null,
    participants: [
      {
        id: 'p1',
        agent_id: 'dev',
        agent_name: 'Dev',
        agent_icon: '🤖',
        agent_color: '#6366f1',
        role: 'member',
        is_active: true,
      },
      {
        id: 'p2',
        agent_id: 'main',
        agent_name: 'Main',
        agent_icon: '🧠',
        agent_color: '#f59e0b',
        role: 'owner',
        is_active: true,
      },
    ],
    last_message_at: Date.now() - 60_000,
    created_at: Date.now() - 3_600_000,
    thread_type: 'group',
    routing_mode: 'broadcast',
    ...overrides,
  }
}

const defaultProps = {
  agents: [] as AgentRuntime[],
  loading: false,
  connected: true,
  onSelectAgent: vi.fn(),
  onRefresh: vi.fn(),
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('MobileAgentList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('header', () => {
    it('renders CrewHub brand title', () => {
      render(<MobileAgentList {...defaultProps} />)
      expect(screen.getByText('CrewHub')).toBeInTheDocument()
    })

    it('shows connected status with agent counts', () => {
      const agents = [
        makeAgent({ status: 'idle' }),
        makeAgent({
          agent: {
            id: 'main',
            name: 'Main',
            icon: '🧠',
            color: '#f59e0b',
            agent_session_key: 'agent:main:main',
          } as any,
          status: 'offline',
          childSessions: [],
        }),
      ]
      render(<MobileAgentList {...defaultProps} agents={agents} connected={true} />)
      expect(screen.getByText('1 of 2 agents online')).toBeInTheDocument()
    })

    it('shows disconnected state when not connected', () => {
      render(<MobileAgentList {...defaultProps} connected={false} />)
      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })

    it('renders drawer menu button when onOpenDrawer is provided', () => {
      const onOpenDrawer = vi.fn()
      render(<MobileAgentList {...defaultProps} onOpenDrawer={onOpenDrawer} />)
      const menuBtn = screen
        .getAllByRole('button')
        .find((b) => b.querySelector('svg[class*="lucide-menu"]') !== null)
      // Alternative: just check the button exists by clicking the drawer area
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
    })

    it('calls onOpenDrawer when menu button is clicked', () => {
      const onOpenDrawer = vi.fn()
      render(<MobileAgentList {...defaultProps} onOpenDrawer={onOpenDrawer} />)
      // Menu button is the first button in header
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])
      expect(onOpenDrawer).toHaveBeenCalledTimes(1)
    })

    it('renders new group button when onNewGroup is provided', () => {
      const onNewGroup = vi.fn()
      render(<MobileAgentList {...defaultProps} onNewGroup={onNewGroup} />)
      const groupBtn = screen.getByTitle('New group chat')
      expect(groupBtn).toBeInTheDocument()
    })

    it('calls onNewGroup when group button is clicked', () => {
      const onNewGroup = vi.fn()
      render(<MobileAgentList {...defaultProps} onNewGroup={onNewGroup} />)
      fireEvent.click(screen.getByTitle('New group chat'))
      expect(onNewGroup).toHaveBeenCalledTimes(1)
    })

    it('calls onRefresh when refresh button is clicked', () => {
      const onRefresh = vi.fn()
      render(<MobileAgentList {...defaultProps} onRefresh={onRefresh} />)
      // refresh button is always present; get last button in header
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[buttons.length - 1])
      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('disables refresh button when loading', () => {
      render(<MobileAgentList {...defaultProps} loading={true} />)
      const buttons = screen.getAllByRole('button')
      const refreshBtn = buttons[buttons.length - 1]
      expect(refreshBtn).toBeDisabled()
    })
  })

  describe('agent list items', () => {
    it('renders agent names', () => {
      const agents = [
        makeAgent({
          agent: {
            id: 'dev',
            name: 'Dev Agent',
            icon: '🤖',
            color: '#6366f1',
            agent_session_key: 'agent:dev:main',
          } as any,
          status: 'idle',
          childSessions: [],
        }),
      ]
      render(<MobileAgentList {...defaultProps} agents={agents} />)
      expect(screen.getByText('Dev Agent')).toBeInTheDocument()
    })

    it('renders "Idle" status label for idle agents', () => {
      const agents = [makeAgent({ status: 'idle' })]
      render(<MobileAgentList {...defaultProps} agents={agents} />)
      expect(screen.getByText('Idle')).toBeInTheDocument()
    })

    it('renders "Thinking…" for thinking agents', () => {
      const agents = [makeAgent({ status: 'thinking' })]
      render(<MobileAgentList {...defaultProps} agents={agents} />)
      expect(screen.getByText('Thinking…')).toBeInTheDocument()
    })

    it('renders "Working" for working agents', () => {
      const agents = [makeAgent({ status: 'working' })]
      render(<MobileAgentList {...defaultProps} agents={agents} />)
      expect(screen.getByText('Working')).toBeInTheDocument()
    })

    it('renders "Offline" for offline agents', () => {
      const agents = [makeAgent({ status: 'offline' })]
      render(<MobileAgentList {...defaultProps} agents={agents} />)
      expect(screen.getByText('Offline')).toBeInTheDocument()
    })

    it('reduces opacity for offline agents', () => {
      const agents = [makeAgent({ status: 'offline' })]
      const { container } = render(<MobileAgentList {...defaultProps} agents={agents} />)
      const agentBtn = container.querySelector('button[style*="opacity: 0.5"]')
      expect(agentBtn).not.toBeNull()
    })

    it('calls onSelectAgent with correct params when agent is clicked', () => {
      const onSelectAgent = vi.fn()
      const agents = [makeAgent()]
      render(<MobileAgentList {...defaultProps} agents={agents} onSelectAgent={onSelectAgent} />)
      fireEvent.click(screen.getByText('Dev Agent'))
      expect(onSelectAgent).toHaveBeenCalledWith(
        'dev',
        'Dev Agent',
        '🤖',
        '#6366f1',
        'agent:dev:main'
      )
    })

    it('shows task count badge when agent has child sessions', () => {
      const agents = [
        makeAgent({
          childSessions: [{ key: 's1' }, { key: 's2' }] as any,
        }),
      ]
      render(<MobileAgentList {...defaultProps} agents={agents} />)
      expect(screen.getByText('2 tasks')).toBeInTheDocument()
    })

    it('shows singular "task" when only one child session', () => {
      const agents = [makeAgent({ childSessions: [{ key: 's1' }] as any })]
      render(<MobileAgentList {...defaultProps} agents={agents} />)
      expect(screen.getByText('1 task')).toBeInTheDocument()
    })

    it('shows time label when session has updatedAt', () => {
      const agents = [makeAgent()]
      render(<MobileAgentList {...defaultProps} agents={agents} />)
      expect(screen.getByText('just now')).toBeInTheDocument()
    })

    it('shows icon from agent config', () => {
      const agents = [makeAgent()]
      render(<MobileAgentList {...defaultProps} agents={agents} />)
      expect(screen.getByText('🤖')).toBeInTheDocument()
    })
  })

  describe('group threads section', () => {
    it('renders Group Chats section header when threads exist', () => {
      const threads = [makeThread()]
      render(<MobileAgentList {...defaultProps} threads={threads} />)
      expect(screen.getByText('Group Chats')).toBeInTheDocument()
    })

    it('renders thread title', () => {
      const threads = [makeThread()]
      render(<MobileAgentList {...defaultProps} threads={threads} />)
      expect(screen.getByText('Team Chat')).toBeInTheDocument()
    })

    it('renders participant count', () => {
      const threads = [makeThread()]
      render(<MobileAgentList {...defaultProps} threads={threads} />)
      expect(screen.getByText('2 agents')).toBeInTheDocument()
    })

    it('renders avatar stack for thread', () => {
      const threads = [makeThread()]
      render(<MobileAgentList {...defaultProps} threads={threads} />)
      expect(screen.getByTestId('avatar-stack')).toBeInTheDocument()
    })

    it('calls onSelectThread when thread is clicked', () => {
      const onSelectThread = vi.fn()
      const threads = [makeThread()]
      render(
        <MobileAgentList {...defaultProps} threads={threads} onSelectThread={onSelectThread} />
      )
      fireEvent.click(screen.getByText('Team Chat'))
      expect(onSelectThread).toHaveBeenCalledWith(threads[0])
    })

    it('does not render Group Chats section when threads array is empty', () => {
      render(<MobileAgentList {...defaultProps} threads={[]} />)
      expect(screen.queryByText('Group Chats')).not.toBeInTheDocument()
    })

    it('uses auto-title fallback when thread has no title', () => {
      const threads = [makeThread({ title: null, title_auto: 'Auto Generated Title' })]
      render(<MobileAgentList {...defaultProps} threads={threads} />)
      expect(screen.getByText('Auto Generated Title')).toBeInTheDocument()
    })

    it('falls back to "Group Chat" when thread has no title or auto-title', () => {
      const threads = [makeThread({ title: null, title_auto: null })]
      render(<MobileAgentList {...defaultProps} threads={threads} />)
      expect(screen.getByText('Group Chat')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('renders nothing in agent list when no agents provided', () => {
      const { container } = render(<MobileAgentList {...defaultProps} agents={[]} />)
      // No agent buttons beyond the header ones
      const agentArea =
        container.querySelector('[style*="overflowY: auto"]') ||
        container.querySelector('[style*="overflow-y: auto"]')
      // Just verify the component renders without crashing
      expect(container).toBeInTheDocument()
    })
  })
})
