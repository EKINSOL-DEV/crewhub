/**
 * GroupThreadChat Tests
 * Tests for the mobile group thread chat interface
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GroupThreadChat } from '@/components/mobile/group'
import type { Thread, ThreadMessage } from '@/lib/threads.api'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockSendMessage = vi.fn().mockResolvedValue(undefined)
const mockLoadOlderMessages = vi.fn().mockResolvedValue(undefined)

let mockMessages: ThreadMessage[] = []
let mockIsSending = false
let mockError: string | null = null
let mockHasMore = false
let mockIsLoadingHistory = false

vi.mock('@/hooks/useThreadChat', () => ({
  useThreadChat: () => ({
    messages: mockMessages,
    isSending: mockIsSending,
    error: mockError,
    hasMore: mockHasMore,
    isLoadingHistory: mockIsLoadingHistory,
    sendMessage: mockSendMessage,
    loadOlderMessages: mockLoadOlderMessages,
  }),
}))

vi.mock('@/components/mobile/group/ParticipantAvatarStack', () => ({
  ParticipantAvatarStack: ({ participants }: any) => (
    <div data-testid="avatar-stack">{participants.length} avatars</div>
  ),
}))

vi.mock('@/components/mobile/group/ParticipantListSheet', () => ({
  ParticipantListSheet: ({ onClose }: any) => (
    <div data-testid="participant-sheet">
      <button onClick={onClose}>Close Sheet</button>
    </div>
  ),
}))

vi.mock('@/components/mobile/group/RoutingSelector', () => ({
  RoutingSelector: ({ mode, onModeChange }: any) => (
    <div data-testid="routing-selector" data-mode={mode}>
      <button onClick={() => onModeChange('targeted')}>Target</button>
    </div>
  ),
}))

vi.mock('@/lib/formatters', () => ({
  formatShortTimestamp: (ts: number) => new Date(ts).toLocaleTimeString(),
}))

// ── Thread fixture ─────────────────────────────────────────────────────────

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'thread-abc',
    title: 'Dev Team',
    title_auto: null,
    participants: [
      {
        id: 'p1',
        agent_id: 'dev',
        agent_name: 'Dev Agent',
        agent_icon: '🤖',
        agent_color: '#6366f1',
        role: 'owner',
        is_active: true,
      },
      {
        id: 'p2',
        agent_id: 'main',
        agent_name: 'Main Agent',
        agent_icon: '🧠',
        agent_color: '#f59e0b',
        role: 'member',
        is_active: true,
      },
    ],
    last_message_at: Date.now(),
    created_at: Date.now(),
    thread_type: 'group',
    routing_mode: 'broadcast',
    ...overrides,
  }
}

const defaultProps = {
  thread: makeThread(),
  onBack: vi.fn(),
  onRemoveParticipant: vi.fn(),
  onAddParticipants: vi.fn(),
  onRename: vi.fn(),
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GroupThreadChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMessages = []
    mockIsSending = false
    mockError = null
    mockHasMore = false
    mockIsLoadingHistory = false
  })

  describe('header', () => {
    it('renders thread title', () => {
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByText('Dev Team')).toBeInTheDocument()
    })

    it('shows agent count in subtitle', () => {
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByText('2 of 2 online')).toBeInTheDocument()
    })

    it('shows "Agents thinking…" when isSending', () => {
      mockIsSending = true
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByText('Agents thinking…')).toBeInTheDocument()
    })

    it('renders avatar stack in header', () => {
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByTestId('avatar-stack')).toBeInTheDocument()
    })

    it('calls onBack when back button (ArrowLeft) is clicked with stopPropagation', () => {
      const onBack = vi.fn()
      render(<GroupThreadChat {...defaultProps} onBack={onBack} />)
      // The back button is NESTED inside the outer header button
      // buttons[0] = outer header button, buttons[1] = inner back button
      const buttons = screen.getAllByRole('button')
      // Find the back button — it has transparent background and contains ArrowLeft
      const backBtn = buttons[1]
      fireEvent.click(backBtn)
      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('opens participant sheet when outer header button is clicked', () => {
      render(<GroupThreadChat {...defaultProps} />)
      // Outer header button is the first button (contains avatar stack + title)
      const headerBtn = screen.getAllByRole('button')[0]
      fireEvent.click(headerBtn)
      expect(screen.getByTestId('participant-sheet')).toBeInTheDocument()
    })

    it('closes participant sheet when close is clicked', () => {
      render(<GroupThreadChat {...defaultProps} />)
      const headerBtn = screen.getAllByRole('button')[0]
      fireEvent.click(headerBtn)
      expect(screen.getByTestId('participant-sheet')).toBeInTheDocument()
      fireEvent.click(screen.getByText('Close Sheet'))
      expect(screen.queryByTestId('participant-sheet')).not.toBeInTheDocument()
    })

    it('uses auto-title fallback when title is null', () => {
      const thread = makeThread({ title: null, title_auto: 'Auto Title' })
      render(<GroupThreadChat {...defaultProps} thread={thread} />)
      expect(screen.getByText('Auto Title')).toBeInTheDocument()
    })
  })

  describe('messages list', () => {
    it('shows empty state when no messages', () => {
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByText('Start chatting with the crew!')).toBeInTheDocument()
    })

    it('renders user messages', () => {
      mockMessages = [
        {
          id: 'm1',
          role: 'user',
          content: 'Hello crew!',
          created_at: Date.now(),
          thread_id: 'thread-abc',
        },
      ] as any
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByText('Hello crew!')).toBeInTheDocument()
    })

    it('renders assistant messages with agent name', () => {
      mockMessages = [
        {
          id: 'm2',
          role: 'assistant',
          content: 'On it!',
          created_at: Date.now(),
          thread_id: 'thread-abc',
          agent_id: 'dev',
          agent_name: 'Dev Agent',
        },
      ] as any
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByText('Dev Agent')).toBeInTheDocument()
    })

    it('renders system messages in italic style', () => {
      mockMessages = [
        {
          id: 'm3',
          role: 'system',
          content: 'Dev Agent joined',
          created_at: Date.now(),
          thread_id: 'thread-abc',
        },
      ] as any
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByText('Dev Agent joined')).toBeInTheDocument()
    })

    it('shows "Agents are thinking…" indicator when isSending', () => {
      mockIsSending = true
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByText('Agents are thinking…')).toBeInTheDocument()
    })

    it('shows error banner when error occurs', () => {
      mockError = 'Connection timeout'
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByText('Connection timeout')).toBeInTheDocument()
    })

    it('shows load older button when hasMore is true', () => {
      mockHasMore = true
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByText('↑ Load older')).toBeInTheDocument()
    })

    it('calls loadOlderMessages when load button is clicked', async () => {
      mockHasMore = true
      render(<GroupThreadChat {...defaultProps} />)
      fireEvent.click(screen.getByText('↑ Load older'))
      await waitFor(() => expect(mockLoadOlderMessages).toHaveBeenCalledTimes(1))
    })
  })

  describe('routing selector', () => {
    it('renders routing selector', () => {
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByTestId('routing-selector')).toBeInTheDocument()
    })

    it('passes initial routing mode to selector', () => {
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByTestId('routing-selector')).toHaveAttribute('data-mode', 'broadcast')
    })
  })

  describe('input area', () => {
    it('renders textarea placeholder', () => {
      render(<GroupThreadChat {...defaultProps} />)
      expect(screen.getByPlaceholderText('Message the crew…')).toBeInTheDocument()
    })

    it('updates input when user types', () => {
      render(<GroupThreadChat {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('Message the crew…') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Hello!' } })
      expect(textarea.value).toBe('Hello!')
    })

    it('sends message when send button is clicked', async () => {
      render(<GroupThreadChat {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('Message the crew…')
      fireEvent.change(textarea, { target: { value: 'Test message' } })
      fireEvent.click(screen.getByText('➤'))
      // In broadcast mode with no targets, targets arg is undefined
      await waitFor(() =>
        expect(mockSendMessage).toHaveBeenCalledWith('Test message', 'broadcast', undefined)
      )
    })

    it('sends message on Enter key', async () => {
      render(<GroupThreadChat {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('Message the crew…')
      fireEvent.change(textarea, { target: { value: 'Enter send' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })
      await waitFor(() =>
        expect(mockSendMessage).toHaveBeenCalledWith('Enter send', 'broadcast', undefined)
      )
    })

    it('does not send on Shift+Enter', () => {
      render(<GroupThreadChat {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('Message the crew…')
      fireEvent.change(textarea, { target: { value: 'New line' } })
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('disables send button when input is empty', () => {
      render(<GroupThreadChat {...defaultProps} />)
      const sendBtn = screen.getByText('➤').closest('button')!
      expect(sendBtn).toBeDisabled()
    })

    it('disables textarea when isSending', () => {
      mockIsSending = true
      render(<GroupThreadChat {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('Message the crew…')
      expect(textarea).toBeDisabled()
    })
  })
})
