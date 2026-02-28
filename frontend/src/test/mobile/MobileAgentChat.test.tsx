/**
 * MobileAgentChat Tests
 * Tests for the mobile streaming agent chat interface
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { MobileAgentChat } from '@/components/mobile/MobileAgentChat'
import type { ChatMessageData } from '@/hooks/useStreamingChat'

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  API_BASE: 'http://localhost:8091/api',
}))

const mockSendMessage = vi.fn()
const mockLoadOlderMessages = vi.fn().mockResolvedValue(undefined)
let mockMessages: ChatMessageData[] = []
let mockIsSending = false
let mockStreamingId: string | null = null
let mockError: string | null = null
let mockHasMore = false
let mockIsLoadingHistory = false

vi.mock('@/hooks/useStreamingChat', () => ({
  useStreamingChat: () => ({
    messages: mockMessages,
    isSending: mockIsSending,
    streamingMessageId: mockStreamingId,
    error: mockError,
    sendMessage: mockSendMessage,
    setMessages: vi.fn(),
    hasMore: mockHasMore,
    isLoadingHistory: mockIsLoadingHistory,
    loadOlderMessages: mockLoadOlderMessages,
  }),
}))

const mockStartRecording = vi.fn()
const mockStopAndSend = vi.fn()
const mockCancelRecording = vi.fn()
let mockIsRecording = false
let mockMicSupported = true
let mockMicPreparing = false
let mockRecDuration = 0
let mockRecError: string | null = null

vi.mock('@/hooks/useVoiceRecorder', () => ({
  useVoiceRecorder: (_cb: any) => ({
    isRecording: mockIsRecording,
    isPreparing: mockMicPreparing,
    duration: mockRecDuration,
    error: mockRecError,
    isSupported: mockMicSupported,
    startRecording: mockStartRecording,
    stopAndSend: mockStopAndSend,
    cancelRecording: mockCancelRecording,
  }),
  formatDuration: (secs: number) => `${secs}s`,
}))

vi.mock('@/components/chat/ChatMessageBubble', () => ({
  ChatMessageBubble: ({ msg }: any) => (
    <div data-testid="message-bubble" data-role={msg.role} data-content={msg.content}>
      {msg.content}
    </div>
  ),
}))

vi.mock('@/components/mobile/ChatHeader3DAvatar', () => ({
  ChatHeader3DAvatar: ({ icon }: any) => <div data-testid="chat-avatar">{icon}</div>,
}))

vi.mock('@/components/mobile/ActiveTasksOverlay', () => ({
  ActiveTasksBadge: ({ count, onClick }: any) => (
    <button data-testid="tasks-badge" onClick={onClick}>
      {count} tasks
    </button>
  ),
  ActiveTasksOverlay: ({ onClose }: any) => (
    <div data-testid="tasks-overlay">
      <button onClick={onClose}>Close Tasks</button>
    </div>
  ),
}))

vi.mock('@/components/mobile/AgentCameraView', () => ({
  AgentCameraView: () => <div data-testid="camera-view" />,
}))

vi.mock('@/components/world3d/utils/botVariants', () => ({
  getBotConfigFromSession: () => ({
    color: '#6366f1',
    expression: 'happy' as const,
    icon: '🤖',
    variant: 'worker' as const,
    accessory: 'crown' as const,
    chestDisplay: 'tool' as const,
    label: 'Bot',
  }),
}))

vi.mock('@/lib/formatters', () => ({
  formatFileSize: (size: number) => `${size}B`,
}))

// Mock fetch for file uploads
const mockFetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  mockMessages = []
  mockIsSending = false
  mockStreamingId = null
  mockError = null
  mockHasMore = false
  mockIsLoadingHistory = false
  mockIsRecording = false
  mockMicSupported = true
  mockMicPreparing = false
  mockRecDuration = 0
  mockRecError = null
  globalThis.fetch = mockFetch as any
  mockFetch.mockResolvedValue(
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
})

// ── Default props ─────────────────────────────────────────────────────────

const defaultProps = {
  sessionKey: 'agent:dev:main',
  agentName: 'Dev Agent',
  agentIcon: '🤖',
  agentColor: '#6366f1',
  subagentSessions: [],
  onBack: vi.fn(),
  onOpenSettings: vi.fn(),
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('MobileAgentChat', () => {
  describe('header rendering', () => {
    it('renders agent name in header', () => {
      render(<MobileAgentChat {...defaultProps} />)
      expect(screen.getByText('Dev Agent')).toBeInTheDocument()
    })

    it('shows Online status when idle', () => {
      render(<MobileAgentChat {...defaultProps} />)
      expect(screen.getByText('Online')).toBeInTheDocument()
    })

    it('shows Thinking when isSending', () => {
      mockIsSending = true
      render(<MobileAgentChat {...defaultProps} />)
      expect(screen.getByText('Thinking…')).toBeInTheDocument()
    })

    it('calls onBack when back button is clicked', () => {
      const onBack = vi.fn()
      render(<MobileAgentChat {...defaultProps} onBack={onBack} />)
      // First button is the back arrow
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])
      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('renders settings button when onOpenSettings is provided', () => {
      const onOpenSettings = vi.fn()
      render(<MobileAgentChat {...defaultProps} onOpenSettings={onOpenSettings} />)
      const settingsBtn = screen.getByTitle('Settings')
      fireEvent.click(settingsBtn)
      expect(onOpenSettings).toHaveBeenCalledTimes(1)
    })

    it('does not render settings button when onOpenSettings is not provided', () => {
      render(<MobileAgentChat {...defaultProps} onOpenSettings={undefined} />)
      expect(screen.queryByTitle('Settings')).not.toBeInTheDocument()
    })
  })

  describe('tasks overlay', () => {
    it('renders tasks badge with subagent count', () => {
      const sessions = [
        { key: 's1', updatedAt: Date.now(), label: 'Sub1' } as any,
        { key: 's2', updatedAt: Date.now(), label: 'Sub2' } as any,
      ]
      render(<MobileAgentChat {...defaultProps} subagentSessions={sessions} />)
      expect(screen.getByText('2 tasks')).toBeInTheDocument()
    })

    it('opens tasks overlay when tasks badge is clicked', async () => {
      const sessions = [{ key: 's1', updatedAt: Date.now(), label: 'Sub1' } as any]
      render(<MobileAgentChat {...defaultProps} subagentSessions={sessions} />)

      fireEvent.click(screen.getByTestId('tasks-badge'))
      expect(screen.getByTestId('tasks-overlay')).toBeInTheDocument()
    })

    it('closes tasks overlay when close button is clicked', async () => {
      const sessions = [{ key: 's1', updatedAt: Date.now(), label: 'Sub1' } as any]
      render(<MobileAgentChat {...defaultProps} subagentSessions={sessions} />)

      fireEvent.click(screen.getByTestId('tasks-badge'))
      expect(screen.getByTestId('tasks-overlay')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Close Tasks'))
      expect(screen.queryByTestId('tasks-overlay')).not.toBeInTheDocument()
    })
  })

  describe('messages list', () => {
    it('renders chat messages', () => {
      mockMessages = [
        { id: 'm1', role: 'user', content: 'Hello agent', timestamp: Date.now() },
        { id: 'm2', role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
      ]
      render(<MobileAgentChat {...defaultProps} />)
      const bubbles = screen.getAllByTestId('message-bubble')
      expect(bubbles).toHaveLength(2)
      expect(bubbles[0]).toHaveAttribute('data-content', 'Hello agent')
      expect(bubbles[1]).toHaveAttribute('data-content', 'Hi there!')
    })

    it('shows error banner when chat error occurs', () => {
      mockError = 'Connection lost'
      render(<MobileAgentChat {...defaultProps} />)
      expect(screen.getByText(/Connection lost/)).toBeInTheDocument()
    })

    it('shows load older button when hasMore is true', () => {
      mockHasMore = true
      render(<MobileAgentChat {...defaultProps} />)
      expect(screen.getByText('↑ Load older')).toBeInTheDocument()
    })

    it('calls loadOlderMessages when load button clicked', async () => {
      mockHasMore = true
      render(<MobileAgentChat {...defaultProps} />)
      fireEvent.click(screen.getByText('↑ Load older'))
      await waitFor(() => expect(mockLoadOlderMessages).toHaveBeenCalledTimes(1))
    })

    it('shows empty state text when no messages', () => {
      mockMessages = []
      render(<MobileAgentChat {...defaultProps} />)
      expect(screen.getByText(`Say hello to ${defaultProps.agentName}!`)).toBeInTheDocument()
    })
  })

  describe('input area', () => {
    it('renders textarea for input', () => {
      render(<MobileAgentChat {...defaultProps} />)
      expect(screen.getByPlaceholderText(/Dev Agent/i)).toBeInTheDocument()
    })

    it('updates input value when user types', () => {
      render(<MobileAgentChat {...defaultProps} />)
      const textarea = screen.getByPlaceholderText(/Dev Agent/i) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Hello world' } })
      expect(textarea.value).toBe('Hello world')
    })

    it('shows send button when input has text', () => {
      render(<MobileAgentChat {...defaultProps} />)
      const textarea = screen.getByPlaceholderText(/Dev Agent/i)
      fireEvent.change(textarea, { target: { value: 'Hi' } })
      expect(screen.getByText('➤')).toBeInTheDocument()
    })

    it('sends message when send button is clicked', async () => {
      render(<MobileAgentChat {...defaultProps} />)
      const textarea = screen.getByPlaceholderText(/Dev Agent/i)
      fireEvent.change(textarea, { target: { value: 'Test message' } })
      fireEvent.click(screen.getByText('➤'))
      await waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith('Test message'))
    })

    it('sends message on Enter key', async () => {
      render(<MobileAgentChat {...defaultProps} />)
      const textarea = screen.getByPlaceholderText(/Dev Agent/i)
      fireEvent.change(textarea, { target: { value: 'Enter send' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })
      await waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith('Enter send'))
    })

    it('does not send on Shift+Enter', () => {
      render(<MobileAgentChat {...defaultProps} />)
      const textarea = screen.getByPlaceholderText(/Dev Agent/i)
      fireEvent.change(textarea, { target: { value: 'Multi line' } })
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('shows paperclip button for file attachment', () => {
      const { container } = render(<MobileAgentChat {...defaultProps} />)
      // The attach button has a Paperclip svg with class 'lucide-paperclip'
      const paperclipSvg = container.querySelector('svg.lucide-paperclip')
      expect(paperclipSvg).not.toBeNull()
    })
  })

  describe('voice recording', () => {
    it('renders mic button when mic is supported', () => {
      mockMicSupported = true
      render(<MobileAgentChat {...defaultProps} />)
      expect(screen.getByTitle('Voice message')).toBeInTheDocument()
    })

    it('does not render mic button when mic is not supported', () => {
      mockMicSupported = false
      render(<MobileAgentChat {...defaultProps} />)
      expect(screen.queryByTitle('Voice message')).not.toBeInTheDocument()
    })

    it('calls startRecording when mic button is clicked', () => {
      mockMicSupported = true
      render(<MobileAgentChat {...defaultProps} />)
      fireEvent.click(screen.getByTitle('Voice message'))
      expect(mockStartRecording).toHaveBeenCalledTimes(1)
    })

    it('shows stop and cancel buttons when recording', () => {
      mockIsRecording = true
      render(<MobileAgentChat {...defaultProps} />)
      expect(screen.getByTitle('Stop & send voice message')).toBeInTheDocument()
      expect(screen.getByTitle('Cancel recording')).toBeInTheDocument()
    })

    it('calls stopAndSend when stop button is clicked while recording', () => {
      mockIsRecording = true
      render(<MobileAgentChat {...defaultProps} />)
      fireEvent.click(screen.getByTitle('Stop & send voice message'))
      expect(mockStopAndSend).toHaveBeenCalledTimes(1)
    })

    it('calls cancelRecording when cancel is clicked while recording', () => {
      mockIsRecording = true
      render(<MobileAgentChat {...defaultProps} />)
      fireEvent.click(screen.getByTitle('Cancel recording'))
      expect(mockCancelRecording).toHaveBeenCalledTimes(1)
    })

    it('shows preparing icon when mic is preparing', () => {
      mockMicPreparing = true
      render(<MobileAgentChat {...defaultProps} />)
      expect(screen.getByText('⏳')).toBeInTheDocument()
    })
  })

  describe('uses session key in agent color fallback', () => {
    it('renders without agentColor prop (uses fallback)', () => {
      render(<MobileAgentChat {...defaultProps} agentColor={null} agentIcon={null} />)
      // Should use first letter of agentName as icon fallback
      expect(screen.getByText('D')).toBeInTheDocument() // 'D' for 'Dev Agent'
    })
  })
})
