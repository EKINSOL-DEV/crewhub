/* eslint-disable @typescript-eslint/no-explicit-any, sonarjs/no-duplicate-string */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentChatWindow } from '@/components/chat/AgentChatWindow'

const chatCtx = {
  closeChat: vi.fn(),
  minimizeChat: vi.fn(),
  toggleInternals: vi.fn(),
  focusChat: vi.fn(),
  updatePosition: vi.fn(),
  updateSize: vi.fn(),
  onFocusAgent: vi.fn(),
  windows: [{ sessionKey: 'agent:dev:main', showInternals: false }],
}

const streaming = {
  messages: [] as any[],
  isSending: false,
  streamingMessageId: null as string | null,
  error: null as string | null,
  sendMessage: vi.fn(),
  loadOlderMessages: vi.fn(),
  hasMore: false,
  isLoadingHistory: false,
}

const voice = {
  isRecording: false,
  isPreparing: false,
  duration: 0,
  error: null as string | null,
  isSupported: true,
  startRecording: vi.fn(),
  stopAndSend: vi.fn(),
  cancelRecording: vi.fn(),
}

vi.mock('react-rnd', () => ({
  Rnd: ({ children, onMouseDown }: any) => <div onMouseDown={onMouseDown}>{children}</div>,
}))

vi.mock('@/contexts/ChatContext', () => ({
  MIN_SIZE: { width: 300, height: 300 },
  useChatContext: () => chatCtx,
}))
vi.mock('@/hooks/useStreamingChat', () => ({ useStreamingChat: () => streaming }))
vi.mock('@/hooks/useVoiceRecorder', () => ({
  useVoiceRecorder: () => voice,
  formatDuration: (d: number) => `0:${String(d).padStart(2, '0')}`,
}))
vi.mock('@/components/chat/ChatMessageBubble', () => ({
  ChatMessageBubble: ({ msg }: any) => <div>{msg.content}</div>,
}))

describe('AgentChatWindow', () => {
  beforeEach(() => {
    Object.values(chatCtx).forEach((v) => typeof v === 'function' && (v as any).mockReset?.())
    Object.values(streaming).forEach((v) => typeof v === 'function' && (v as any).mockReset?.())
    Object.values(voice).forEach((v) => typeof v === 'function' && (v as any).mockReset?.())
    streaming.messages = []
    streaming.error = null
    streaming.isSending = false
    streaming.hasMore = false
    streaming.isLoadingHistory = false
    voice.isRecording = false
    voice.error = null
  })

  it('sends message via Enter and shows empty state', () => {
    render(
      <AgentChatWindow
        sessionKey="agent:dev:main"
        agentName="Dev"
        agentIcon="🧪"
        agentColor="#111111"
        position={{ x: 0, y: 0 }}
        size={{ width: 480, height: 580 }}
        zIndex={20}
      />
    )

    expect(screen.getByText('Say hello to Dev!')).toBeInTheDocument()
    const input = screen.getByPlaceholderText('Message Dev…')
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(streaming.sendMessage).toHaveBeenCalledWith('hello')
  })

  it('handles header actions and history loading', () => {
    streaming.hasMore = true
    render(
      <AgentChatWindow
        sessionKey="agent:dev:main"
        agentName="Dev"
        agentIcon={null}
        agentColor={null}
        position={{ x: 0, y: 0 }}
        size={{ width: 480, height: 580 }}
        zIndex={20}
      />
    )

    fireEvent.click(screen.getByText('↑ Load older messages'))
    expect(streaming.loadOlderMessages).toHaveBeenCalled()

    fireEvent.click(screen.getByText('🧠'))
    fireEvent.click(screen.getByText('─'))
    fireEvent.click(screen.getByText('✕'))
    fireEvent.click(screen.getByText('🎯'))

    expect(chatCtx.toggleInternals).toHaveBeenCalledWith('agent:dev:main')
    expect(chatCtx.minimizeChat).toHaveBeenCalledWith('agent:dev:main')
    expect(chatCtx.closeChat).toHaveBeenCalledWith('agent:dev:main')
    expect(chatCtx.onFocusAgent).toHaveBeenCalledWith('agent:dev:main')
  })

  it('renders recording mode controls and escape cancels recording', () => {
    voice.isRecording = true
    voice.duration = 8

    render(
      <AgentChatWindow
        sessionKey="agent:dev:main"
        agentName="Dev"
        agentIcon={null}
        agentColor={null}
        position={{ x: 0, y: 0 }}
        size={{ width: 480, height: 580 }}
        zIndex={20}
      />
    )

    expect(screen.getByText('0:08')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Stop & send voice message'))
    fireEvent.click(screen.getByTitle('Cancel recording'))
    expect(voice.stopAndSend).toHaveBeenCalled()
    expect(voice.cancelRecording).toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(voice.cancelRecording).toHaveBeenCalledTimes(2)
  })
})
