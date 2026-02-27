import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const subscribeMock = vi.fn()

vi.mock('@/lib/sseManager', () => ({
  sseManager: {
    subscribe: subscribeMock,
  },
}))

vi.mock('@/lib/api', () => ({
  API_BASE: '/api',
}))

describe('useProjects', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    subscribeMock.mockReturnValue(vi.fn())
  })

  it('fetches projects on mount and exposes refresh', async () => {
    const fetchMock = vi.fn()
    ;(globalThis as any).fetch = fetchMock

    const projects = [{ id: 'p1', name: 'Project 1', updated_at: 1, status: 'active', rooms: [] }]
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ projects }) })

    const { useProjects } = await import('../../hooks/useProjects')
    const { result } = renderHook(() => useProjects())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.projects).toEqual(projects)
    expect(result.current.error).toBe(null)

    await act(async () => {
      await result.current.refresh()
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.any(Object))
  })

  it('handles fetch errors and SSE-triggered refresh', async () => {
    const fetchMock = vi.fn()
    ;(globalThis as any).fetch = fetchMock

    fetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ projects: [] }) })

    let roomsRefresh: (() => void) | undefined
    subscribeMock.mockImplementation((event: string, handler: () => void) => {
      if (event === 'rooms-refresh') roomsRefresh = handler
      return vi.fn()
    })

    const { useProjects } = await import('../../hooks/useProjects')
    const { result } = renderHook(() => useProjects())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('network down')

    await act(async () => {
      roomsRefresh?.()
    })

    await waitFor(() => expect(result.current.error).toBe(null))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('deleteProject and fetchOverview return expected success/error shapes', async () => {
    const fetchMock = vi.fn()
    ;(globalThis as any).fetch = fetchMock

    // initial load
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ projects: [] }) })

    const { useProjects } = await import('../../hooks/useProjects')
    const { result } = renderHook(() => useProjects())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // delete success + refresh
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ projects: [] }) })

    await act(async () => {
      const res = await result.current.deleteProject('p1')
      expect(res).toEqual({ success: true })
    })

    // delete failure
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ detail: 'cannot delete' }) })
    await act(async () => {
      const res = await result.current.deleteProject('p1')
      expect(res).toEqual({ success: false, error: 'cannot delete' })
    })

    // overview success
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ projects: [{ id: 'p1' }] }) })
    await act(async () => {
      const res = await result.current.fetchOverview()
      expect(res).toEqual({ success: true, projects: [{ id: 'p1' }] })
    })

    // overview failure
    fetchMock.mockRejectedValueOnce(new Error('oops'))
    await act(async () => {
      const res = await result.current.fetchOverview()
      expect(res).toEqual({ success: false, error: 'oops', projects: [] })
    })
  })
})
