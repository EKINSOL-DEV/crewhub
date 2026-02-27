import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SessionHistoryView } from '@/components/shared/SessionHistoryView'

const writeText = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(navigator, {
    clipboard: { writeText },
  })
})

describe('SessionHistoryView', () => {
  const messages: any[] = [
    {
      role: 'assistant',
      model: 'openai/gpt-5',
      timestamp: Date.now(),
      usage: { totalTokens: 1200 },
      content: [
        { type: 'text', text: 'hello filter target world' },
        { type: 'thinking', thinking: 'internal chain' },
        { type: 'tool_use', name: 'search', arguments: { q: 'abc' } },
        { type: 'tool_result', isError: false, content: [{ type: 'text', text: 'done' }] },
      ],
    },
    {
      role: 'toolResult',
      content: [{ type: 'tool_result', isError: true, content: [{ type: 'text', text: 'oops' }] }],
    },
  ]

  it('renders loading, error and empty states', () => {
    const { rerender } = render(
      <SessionHistoryView messages={[]} loading loadingText="Please wait" />
    )
    expect(screen.getByText('Please wait')).toBeInTheDocument()

    rerender(<SessionHistoryView messages={[]} error="Failed" />)
    expect(screen.getByText(/Failed/)).toBeInTheDocument()

    rerender(<SessionHistoryView messages={[]} emptyText="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('renders messages, supports highlighting, expansion and copy', () => {
    render(<SessionHistoryView messages={messages as any} filterText="target" />)

    expect(screen.getByText('🤖 Assistant')).toBeInTheDocument()
    expect(screen.getByText('🔧 Tool')).toBeInTheDocument()
    expect(screen.getByText('target')).toBeInTheDocument() // highlighted with <mark>
    expect(screen.getByText('gpt-5')).toBeInTheDocument()
    expect(screen.getByText(/tok/)).toBeInTheDocument()

    fireEvent.click(screen.getAllByTitle('Copy')[0])
    expect(writeText).toHaveBeenCalledWith('hello filter target world')

    fireEvent.click(screen.getByRole('button', { name: /💭 Thinking/ }))
    expect(screen.getByText('internal chain')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /🔧 search/ }))
    expect(screen.getByText(/"q": "abc"/)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Result/ })[0])
    expect(screen.getByText('done')).toBeInTheDocument()
  })

  it('supports reverse order and hiding copy button', () => {
    const local = [
      { role: 'user', content: [{ type: 'text', text: 'first' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'second' }] },
    ]

    const { container } = render(
      <SessionHistoryView messages={local as any} reverseOrder showCopyButton={false} />
    )

    const roleNodes = container.querySelectorAll('.zen-sd-message-role')
    expect(roleNodes[0]?.textContent).toContain('Assistant')
    expect(screen.queryByTitle('Copy')).not.toBeInTheDocument()
  })
})
