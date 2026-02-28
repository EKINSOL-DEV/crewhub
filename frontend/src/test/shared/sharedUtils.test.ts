/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import {
  SHARED_ROOM_KEYWORDS,
  containsAnyKeyword,
  detectLegacyRoomByModel,
} from '@/lib/roomRoutingShared'
import { buildKanbanColumns, groupTasksByStatus } from '@/components/shared/kanbanShared'
import {
  NATIVE_DIALOG_CLASSNAME,
  closeOnDialogBackdropClick,
  useNativeDialogSync,
} from '@/components/shared/nativeDialog'
import { generateRoomId } from '@/components/shared/roomUtils'
import {
  calculateUsageTotals,
  parseSessionHistory,
  useSessionHistory,
} from '@/components/shared/sessionHistoryUtils'
import { api } from '@/lib/api'

vi.mock('@/lib/api', async (orig) => {
  const actual = await orig<typeof import('@/lib/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      getSessionHistory: vi.fn(),
    },
  }
})

describe('shared utility modules', () => {
  it('matches keywords and detects legacy model rooms', () => {
    expect(containsAnyKeyword('please implement this feature', SHARED_ROOM_KEYWORDS.dev)).toBe(true)
    expect(containsAnyKeyword('totally unrelated', SHARED_ROOM_KEYWORDS.automation)).toBe(false)

    expect(detectLegacyRoomByModel('Anthropic/Claude-Opus-4')).toBe('dev-room')
    expect(detectLegacyRoomByModel('OpenAI/GPT-5.2')).toBe('thinking-room')
    expect(detectLegacyRoomByModel('gemini-pro')).toBeUndefined()
  })

  it('builds kanban columns and groups tasks sorted by priority then updated_at desc', () => {
    const colors = {
      todo: '#1',
      in_progress: '#2',
      review: '#3',
      blocked: '#4',
      done: '#5',
    }

    const columns = buildKanbanColumns(colors)
    expect(columns).toHaveLength(5)
    expect(columns[0]).toMatchObject({ status: 'todo', color: '#1' })

    const tasks: any[] = [
      { id: '1', status: 'todo', priority: 'high', updated_at: 1000 },
      { id: '2', status: 'todo', priority: 'urgent', updated_at: 500 },
      { id: '3', status: 'todo', priority: 'urgent', updated_at: 2000 },
      { id: '4', status: 'done', priority: 'low', updated_at: 1 },
      { id: '5', status: 'unknown', priority: 'low', updated_at: 1 },
    ]

    const grouped = groupTasksByStatus(tasks as any)
    expect(grouped.todo.map((t: any) => t.id)).toEqual(['3', '2', '1'])
    expect(grouped.done.map((t: any) => t.id)).toEqual(['4'])
    expect(grouped.review).toEqual([])
  })

  it('syncs native dialog open state and closes on backdrop click only', () => {
    const dialog = {
      open: false,
      showModal: vi.fn(function (this: any) {
        this.open = true
      }),
      close: vi.fn(function (this: any) {
        this.open = false
      }),
    }
    const ref = { current: dialog } as any

    const { rerender } = renderHook(({ isOpen }) => useNativeDialogSync(ref, isOpen), {
      initialProps: { isOpen: true },
    })
    expect(dialog.showModal).toHaveBeenCalledTimes(1)

    rerender({ isOpen: false })
    expect(dialog.close).toHaveBeenCalledTimes(1)

    const onClose = vi.fn()
    closeOnDialogBackdropClick({ target: 'same', currentTarget: 'same' } as any, onClose)
    closeOnDialogBackdropClick({ target: 'inner', currentTarget: 'outer' } as any, onClose)
    expect(onClose).toHaveBeenCalledTimes(1)

    expect(NATIVE_DIALOG_CLASSNAME).toContain('backdrop:bg-black/50')
  })

  it('generates normalized room ids', () => {
    expect(generateRoomId('Research Lab')).toBe('research-lab-room')
    expect(generateRoomId('  !! Alpha__42  ')).toBe('alpha-42-room')
  })

  it('parses session history and calculates usage totals', () => {
    const parsed = parseSessionHistory([
      { type: 'noop' },
      {
        type: 'message',
        model: 'fallback/model',
        timestamp: '2024-01-01T00:00:00.000Z',
        message: {
          role: 'assistant',
          content: 'hello',
          usage: { input: 2, output: 3, totalTokens: 5, cost: { total: 0.12 } },
        },
      },
      {
        type: 'message',
        message: {
          content: { invalid: true },
        },
      },
    ])

    expect(parsed).toHaveLength(2)
    expect(parsed[0].content?.[0]).toEqual({ type: 'text', text: 'hello' })
    expect(parsed[1].role).toBe('unknown')
    expect(parsed[1].content).toEqual([])

    expect(calculateUsageTotals(parsed as any)).toEqual({
      input: 2,
      output: 3,
      total: 5,
      cost: 0.12,
    })
  })

  it('useSessionHistory handles empty key, success, and errors', async () => {
    ;(api.getSessionHistory as any).mockResolvedValueOnce({
      messages: [{ type: 'message', message: { role: 'assistant', content: 'ok' } }],
    })
    const { result, rerender } = renderHook(({ keyValue }) => useSessionHistory(keyValue), {
      initialProps: { keyValue: undefined as string | undefined },
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.messages).toEqual([])

    rerender({ keyValue: 'sess-1' })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.messages).toHaveLength(1)
    ;(api.getSessionHistory as any).mockRejectedValueOnce(new Error('boom'))
    rerender({ keyValue: 'sess-2' })
    await waitFor(() => expect(result.current.error).toBe('boom'))
  })
})
