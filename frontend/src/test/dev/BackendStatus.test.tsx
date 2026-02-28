/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// ─── Setup: force DEV mode ────────────────────────────────────────
// The component checks `import.meta.env.DEV` to short-circuit.
// We patch the env before importing.
vi.stubEnv('DEV', true)

// ─── Reset fetch mock ─────────────────────────────────────────────
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ─── Import after env stub ────────────────────────────────────────
import { BackendStatus } from '@/components/dev/BackendStatus'

// ─── Tests ───────────────────────────────────────────────────────

describe('BackendStatus — DEV mode', () => {
  it('renders a span element', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ uptime_human: '5m 30s' }),
    }) as any

    await act(async () => {
      render(<BackendStatus />)
    })
    const span = document.querySelector('span')
    expect(span).toBeTruthy()
  })

  it('displays uptime when health check succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ uptime_human: '1h 2m' }),
    }) as any

    await act(async () => {
      render(<BackendStatus />)
    })
    expect(screen.getByText(/uptime: 1h 2m/)).toBeTruthy()
  })

  it('shows "backend unreachable" when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as any

    await act(async () => {
      render(<BackendStatus />)
    })
    expect(screen.getByText('backend unreachable')).toBeTruthy()
  })

  it('shows "backend unreachable" when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as any

    await act(async () => {
      render(<BackendStatus />)
    })
    expect(screen.getByText('backend unreachable')).toBeTruthy()
  })

  it('has text-muted-foreground class when reachable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ uptime_human: '10s' }),
    }) as any

    await act(async () => {
      render(<BackendStatus />)
    })
    const span = document.querySelector('span')
    expect(span?.className).toContain('text-muted-foreground')
  })

  it('has text-red-500 class when unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fail')) as any

    await act(async () => {
      render(<BackendStatus />)
    })
    const span = document.querySelector('span')
    expect(span?.className).toContain('text-red-500')
  })

  it('polls /api/health endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ uptime_human: '3m' }),
    }) as any
    global.fetch = fetchMock

    await act(async () => {
      render(<BackendStatus />)
    })

    // Advance timer by 60s to trigger interval
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('calls fetch with /api/health path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ uptime_human: null }),
    }) as any
    global.fetch = fetchMock

    await act(async () => {
      render(<BackendStatus />)
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({}))
  })

  it('shows empty statusText when reachable but no uptime data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as any

    await act(async () => {
      render(<BackendStatus />)
    })
    // statusText is '' when reachable but no uptime_human
    const span = document.querySelector('span')
    expect(span?.textContent).toBe('')
  })
})
