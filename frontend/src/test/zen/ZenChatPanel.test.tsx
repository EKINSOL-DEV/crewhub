import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ZenChatPanel } from '@/components/zen/ZenChatPanel'

const mockSendMessage = vi.fn()
const mockLoadOlder = vi.fn()
const mockStartRecording = vi.fn()
const mockStopAndSend = vi.fn()
const mockCancelRecording = vi.fn()

let streamingState: any
let voiceState: any

vi.mock('@/hooks/useStreamingChat', () => ({
  useStreamingChat: () => streamingState,
}))

vi.mock('@/components/chat/ChatMessageBubble', () => ({
  ChatMessageBubble: ({ msg }: any) => (
    <div>
      {msg.role}:{msg.id}
    </div>
  ),
}))

vi.mock('@/components/zen/PixelAvatar', () => ({
  PixelAvatar: ({ agentName, status }: any) => (
    <div>
      {agentName}-{status}
    </div>
  ),
}))

vi.mock('@/components/zen/ImageDropZone', () => ({
  ImageDropZone: ({ children }: any) => <div>{children}</div>,
  ImagePreviews: ({ images }: any) => <div>images:{images.length}</div>,
}))

vi.mock('@/hooks/useVoiceRecorder', () => ({
  useVoiceRecorder: () => voiceState,
  formatDuration: (s: number) => `${s}s`,
}))

describe('ZenChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    streamingState = {
      messages: [],
      isSending: false,
      streamingMessageId: null,
      error: null,
      sendMessage: mockSendMessage,
      loadOlderMessages: mockLoadOlder,
      hasMore: false,
      isLoadingHistory: false,
    }
    voiceState = {
      isRecording: false,
      isPreparing: false,
      duration: 0,
      error: null,
      isSupported: true,
      startRecording: mockStartRecording,
      stopAndSend: mockStopAndSend,
      cancelRecording: mockCancelRecording,
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ agents: [{ id: 'a1', name: 'Alpha', icon: '🤖' }] }),
      })
    )
  })

  it('shows no-agent state and allows selecting fixed agent', async () => {
    const onSelectAgent = vi.fn()
    render(
      <ZenChatPanel
        sessionKey={null}
        agentName={null}
        agentIcon={null}
        onSelectAgent={onSelectAgent}
      />
    )

    expect(screen.getByText('Select an Agent')).toBeInTheDocument()
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByText('Alpha'))
    expect(onSelectAgent).toHaveBeenCalledWith('a1', 'Alpha', '🤖')
  })

  it('sends text messages and supports loading older', async () => {
    streamingState.hasMore = true
    render(<ZenChatPanel sessionKey="agent:a1:main" agentName="Alpha" agentIcon="🤖" />)

    fireEvent.click(screen.getByText('↑ Load older messages'))
    expect(mockLoadOlder).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByPlaceholderText(/Message Alpha/i), { target: { value: 'hello' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith('hello'))
  })

  it('notifies status changes and supports recording controls', () => {
    const onStatusChange = vi.fn()
    voiceState.isRecording = true
    voiceState.duration = 3

    render(
      <ZenChatPanel
        sessionKey="agent:a1:main"
        agentName="Alpha"
        agentIcon="🤖"
        onStatusChange={onStatusChange}
      />
    )

    expect(onStatusChange).toHaveBeenCalledWith('idle')
    fireEvent.click(screen.getByLabelText('Stop & send voice message'))
    fireEvent.click(screen.getByLabelText('Cancel recording'))
    expect(mockStopAndSend).toHaveBeenCalledTimes(1)
    expect(mockCancelRecording).toHaveBeenCalledTimes(1)
  })
})
