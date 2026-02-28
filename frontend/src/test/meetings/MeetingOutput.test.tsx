/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MeetingOutput } from '@/components/meetings/MeetingOutput'

const showToast = vi.fn()

vi.mock('@/components/markdown/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: any) => <div data-testid="md">{content}</div>,
}))
vi.mock('@/lib/toast', () => ({ showToast: (...args: any[]) => showToast(...args) }))
vi.mock('@/lib/parseMeetingOutput', () => ({
  parseMeetingOutput: () => ({
    summary: 'sum',
    actionItems: [
      { id: 'a1', text: 'Do thing', assignee: 'agent-dev', priority: 'high', checked: false },
      { id: 'a2', text: 'Second', assignee: null, priority: 'low', checked: false },
    ],
  }),
}))

const meeting: any = {
  title: 'Weekly',
  outputMd: '## Summary\nHello\n## Action Items\n- [ ] Do thing',
  meetingId: 'm1',
  rounds: [{ roundNum: 1, topic: 'A', turns: [{ agentName: 'Bot', response: 'Hi' }] }],
  durationSeconds: 12,
  outputPath: '/tmp/out.md',
  project_id: 'p1',
}

describe('MeetingOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    )
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: any) => {
        if (
          String(url).includes('/action-items') &&
          !String(url).includes('/execute') &&
          !String(url).includes('/to-planner')
        ) {
          return { ok: true, json: async () => ({ items: [] }) } as any
        }
        return { ok: true, json: async () => ({}) } as any
      })
    )
  })

  it('renders structured view, copies output and can close', async () => {
    const onClose = vi.fn()
    render(<MeetingOutput meeting={meeting} onClose={onClose} />)

    expect(screen.getByText(/Weekly/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('📋 Copy'))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())

    fireEvent.click(screen.getByTitle('Close (Esc)'))
    expect(onClose).toHaveBeenCalled()
  })

  it('supports actions view planner/execute transitions', async () => {
    render(<MeetingOutput meeting={meeting} onClose={() => {}} />)

    fireEvent.click(screen.getByText('Actions'))
    fireEvent.click(screen.getAllByText('➕ Planner')[0])
    fireEvent.click(screen.getByText('🤖 Execute'))

    await waitFor(() => expect(showToast).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalled()
  })

  it('shows output error and retry button when no markdown', async () => {
    const retry = vi.fn(async () => {})
    render(
      <MeetingOutput
        meeting={{ ...meeting, outputMd: '' }}
        outputError="boom"
        onRetryFetch={retry}
        onClose={() => {}}
      />
    )

    expect(screen.getByText(/boom/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Retry/))
    await waitFor(() => expect(retry).toHaveBeenCalled())
  })
})
