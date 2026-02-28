/* eslint-disable sonarjs/no-duplicate-string */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useActiveTasks } from '@/hooks/useActiveTasks'
import type { CrewSession } from '@/lib/api'

const { subscribeMock } = vi.hoisted(() => ({
  subscribeMock: vi.fn(),
}))
let sessionRemovedHandler: ((event: MessageEvent) => void) | null = null

vi.mock('@/lib/sseManager', () => ({
  sseManager: {
    subscribe: subscribeMock,
  },
}))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('useActiveTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscribeMock.mockImplementation((event: string, handler: (e: MessageEvent) => void) => {
      if (event === 'session-removed') sessionRemovedHandler = handler
      return vi.fn()
    })
  })

  it('tracks running subagent sessions', async () => {
    const sessions: CrewSession[] = [
      {
        key: 'agent:dev:subagent:abc-123',
        kind: 'agent',
        channel: 'whatsapp',
        updatedAt: Date.now(),
        sessionId: '1',
        label: 'fix tests',
      },
    ]

    const { result } = renderHook(() => useActiveTasks({ sessions, enabled: true }))

    await waitFor(() => {
      expect(result.current.runningTasks).toHaveLength(1)
      expect(result.current.runningTasks[0].title).toBe('fix tests')
      expect(result.current.runningTasks[0].agentName).toBe('dev')
    })
  })

  it('marks task done on session-removed event and fades it out', async () => {
    const sessions: CrewSession[] = [
      {
        key: 'agent:dev:subagent:abc-123',
        kind: 'agent',
        channel: 'whatsapp',
        updatedAt: Date.now(),
        sessionId: '1',
      },
    ]

    const { result } = renderHook(() =>
      useActiveTasks({ sessions, enabled: true, fadeOutDuration: 50 })
    )

    await waitFor(() => expect(result.current.runningTasks).toHaveLength(1))

    act(() => {
      sessionRemovedHandler?.({
        data: JSON.stringify({ key: 'agent:dev:subagent:abc-123' }),
      } as MessageEvent)
    })

    await waitFor(() => {
      expect(result.current.doneTasks).toHaveLength(1)
      expect(result.current.doneTasks[0].status).toBe('done')
    })

    await sleep(1200)

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(0)
    })
  })

  it('returns lower opacity for done tasks over time', async () => {
    const sessions: CrewSession[] = [
      {
        key: 'agent:dev:subagent:abc-123',
        kind: 'agent',
        channel: 'whatsapp',
        updatedAt: Date.now(),
        sessionId: '1',
      },
    ]

    const { result } = renderHook(() =>
      useActiveTasks({ sessions, enabled: true, fadeOutDuration: 2000 })
    )

    await waitFor(() => expect(result.current.runningTasks).toHaveLength(1))

    act(() => {
      sessionRemovedHandler?.({
        data: JSON.stringify({ key: 'agent:dev:subagent:abc-123' }),
      } as MessageEvent)
    })

    await waitFor(() => expect(result.current.doneTasks).toHaveLength(1))

    const doneTask = result.current.doneTasks[0]
    const initial = result.current.getTaskOpacity(doneTask)

    await sleep(120)

    const later = result.current.getTaskOpacity(doneTask)
    expect(initial).toBeGreaterThanOrEqual(later)
  })
})
