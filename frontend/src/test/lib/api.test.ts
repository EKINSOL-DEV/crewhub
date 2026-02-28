/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('api lib', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    ;(window as any).__TAURI__ = undefined
    ;(window as any).__CREWHUB_BACKEND_URL__ = undefined
    ;(globalThis as any).fetch = vi.fn()
  })

  it('API_BASE ignores localhost backend in browser mode', async () => {
    localStorage.setItem('crewhub_backend_url', 'http://localhost:8091')
    const mod = await import('../../lib/api')
    expect(mod.API_BASE).toBe('/api')
  })

  it('api.getSessions and session aliases call expected URLs', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ sessions: [] }),
    })
    const { api } = await import('../../lib/api')

    await api.getSessions(30)
    await api.getMinions()
    await api.getSessionHistory('a/b', 10)
    await api.getMinionHistory('x y', 5)

    const calls = (globalThis.fetch as any).mock.calls.map((c: any[]) => c[0])
    expect(calls.some((u: string) => u.includes('/sessions?active_minutes=30'))).toBe(true)
    expect(calls.some((u: string) => u.includes('/sessions/a%2Fb/history?limit=10'))).toBe(true)
    expect(calls.some((u: string) => u.includes('/sessions/x%20y/history?limit=5'))).toBe(true)
  })

  it('fetchJSON throws on !ok and handles 204 through delete API', async () => {
    const { sessionDisplayNameApi } = await import('../../lib/api')
    ;(globalThis.fetch as any).mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(sessionDisplayNameApi.get('s')).rejects.toThrow('HTTP error! status: 500')
    ;(globalThis.fetch as any).mockResolvedValueOnce({ ok: true, status: 204 })
    await expect(sessionDisplayNameApi.delete('s')).resolves.toBeUndefined()
  })

  it('backup helpers success and failure', async () => {
    const { exportBackup, importBackup, createBackup, listBackups } = await import('../../lib/api')

    const fakeBlob = new Blob(['x'])
    ;(globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: true, blob: async () => fakeBlob })
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ filename: 'a.db', size: 1, created_at: 't' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ filename: 'a.db', size: 1, created_at: 't' }],
      })

    await expect(exportBackup()).resolves.toBe(fakeBlob)
    await expect(importBackup(new File(['{}'], 'in.json'))).rejects.toThrow('Import failed: 400')
    await expect(importBackup(new File(['{}'], 'in.json'))).resolves.toEqual({ success: true })
    await expect(createBackup()).resolves.toEqual({ filename: 'a.db', size: 1, created_at: 't' })
    await expect(listBackups()).resolves.toHaveLength(1)
  })

  it('admin key api includes header and handles getSelf error', async () => {
    localStorage.setItem('crewhub_admin_key', 'k-admin')
    const { apiKeyApi } = await import('../../lib/api')

    ;(globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ keys: [] }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'nope',
        statusText: 'Forbidden',
      })
      .mockResolvedValueOnce({ ok: false, status: 401 })

    await expect(apiKeyApi.list()).resolves.toEqual({ keys: [] })
    const firstHeaders = (globalThis.fetch as any).mock.calls[0][1].headers
    expect(firstHeaders['X-API-Key']).toBe('k-admin')

    await expect(apiKeyApi.create({ name: 'x', scopes: ['admin'] })).rejects.toThrow(
      'HTTP 403: nope'
    )
    await expect(apiKeyApi.getSelf('raw')).rejects.toThrow('HTTP 401')
  })
})
