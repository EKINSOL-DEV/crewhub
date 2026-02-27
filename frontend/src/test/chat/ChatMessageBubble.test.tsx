import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  ChatMessageBubble,
  ThinkingBlock,
  ToolCallBlock,
  renderMarkdown,
} from '@/components/chat/ChatMessageBubble'
import type { ChatMessageData } from '@/hooks/useStreamingChat'

vi.mock('@/components/chat/ImageThumbnail', () => ({
  ImageThumbnail: ({ attachment }: any) => <div>img:{attachment.path}</div>,
}))
vi.mock('@/components/chat/VideoThumbnail', () => ({
  VideoThumbnail: ({ attachment }: any) => <div>vid:{attachment.path}</div>,
}))
vi.mock('@/components/chat/AudioMessage', () => ({
  AudioMessage: ({ url }: any) => <div>aud:{url}</div>,
}))

const baseMsg: ChatMessageData = {
  id: 'm1',
  role: 'assistant',
  content: 'hello',
  timestamp: Date.now(),
}

describe('ChatMessageBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders markdown and blocks unsafe links', () => {
    const html = renderMarkdown('[ok](https://example.com) [bad](javascript:alert(1)) `x`')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('href="#"')
    expect(html).toContain('<code class="chat-md-inline-code"')
  })

  it('renders inline float variant with tools, thinking and streaming cursor', () => {
    const msg: ChatMessageData = {
      ...baseMsg,
      content: 'plain text',
      thinking: ['think'],
      tools: [{ name: 'web_search', status: 'done', input: { q: 'x' }, result: 'ok' }],
      isStreaming: true,
    }

    render(<ChatMessageBubble msg={msg} variant="float" showThinking showToolDetails />)

    expect(screen.getByText('think')).toBeInTheDocument()
    expect(screen.getByText(/web_search/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /web_search/i }))
    expect(screen.getByText(/"q": "x"/)).toBeInTheDocument()
    expect(screen.getByText(/→ ok/)).toBeInTheDocument()
    expect(screen.getByText('▋')).toBeInTheDocument()
  })

  it('renders zen/system and mobile/user styles paths', () => {
    render(
      <ChatMessageBubble msg={{ ...baseMsg, role: 'system', content: 'sys msg' }} variant="zen" />
    )
    expect(screen.getByText('sys msg')).toBeInTheDocument()

    render(<ChatMessageBubble msg={{ ...baseMsg, role: 'user', content: 'me' }} variant="mobile" />)
    expect(screen.getByText('me')).toBeInTheDocument()
  })

  it('expands long thinking block and tool details', () => {
    const long = 'a'.repeat(520)
    render(<ThinkingBlock content={long} zenMode />)
    expect(screen.getByText(/expand/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /thinking/i }))
    expect(screen.getByText(/collapse/)).toBeInTheDocument()

    render(
      <ToolCallBlock
        tool={{ name: 't', status: 'error', input: { a: 1 }, result: 'no' }}
        showDetails
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /t ✗/i }))
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument()
  })
})
