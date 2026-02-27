import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useTasks } from '@/hooks/useTasks'

const { subscribeMock, unsubs } = vi.hoisted(() => ({
  subscribeMock: vi.fn(),
  unsubs: [vi.fn(), vi.fn(), vi.fn()],
}))

vi.mock('@/lib/sseManager', () => ({
  sseManager: {
    subscribe: subscribeMock,
  },
}))

const task = {
  id: 't1',
  project_id: 'p1',
  room_id: null,
  title: 'Task one',
  description: null,
  status: 'todo' as const,
  priority: 'medium' as const,
  assigned_session_key: null,
  assigned_display_name: null,
  created_by: null,
  created_at: Date.now(),
  updated_at: Date.now(),
}

describe('useTasks', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).fetch = fetchMock

    subscribeMock
      .mockImplementationOnce((_event, cb) => {
        ;(subscribeMock as any).created = cb
        return unsubs[0]
      })
      .mockImplementationOnce((_event, cb) => {
        ;(subscribeMock as any).updated = cb
        return unsubs[1]
      })
      .mockImplementationOnce((_event, cb) => {
        ;(subscribeMock as any).deleted = cb
        return unsubs[2]
      })
  })

  it('fetches tasks and computes counts', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [task], total: 1 }),
    })

    const { result } = renderHook(() => useTasks({ projectId: 'p1' }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.tasks).toHaveLength(1)
      expect(result.current.total).toBe(1)
      expect(result.current.taskCounts.todo).toBe(1)
    })
  })

  it('refreshes on matching SSE event and ignores non-matching project', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [task], total: 1 }),
    })

    renderHook(() => useTasks({ projectId: 'p1' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      ;(subscribeMock as any).created({ data: JSON.stringify({ project_id: 'other' }) })
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      ;(subscribeMock as any).updated({ data: JSON.stringify({ project_id: 'p1' }) })
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('supports create/update/delete task methods', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tasks: [task], total: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...task, id: 'new' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...task, title: 'updated' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await expect(
      result.current.createTask({ project_id: 'p1', title: 'new task' })
    ).resolves.toMatchObject({
      success: true,
    })
    await expect(result.current.updateTask('t1', { title: 'updated' })).resolves.toMatchObject({
      success: true,
    })
    await expect(result.current.deleteTask('t1')).resolves.toEqual({ success: true })
  })
})
