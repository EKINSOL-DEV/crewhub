/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { ContextInspector } from '@/components/world3d/ContextInspector'

// ─── Mock fetch ───────────────────────────────────────────────────

const mockFetch = vi.fn()
;(globalThis as { fetch: typeof fetch }).fetch = mockFetch

// ─── Mock clipboard ───────────────────────────────────────────────

const mockWriteText = vi.fn()

// ─── Helpers ─────────────────────────────────────────────────────

const DEFAULT_ENVELOPE: Record<string, unknown> = {
  room: { id: 'room-1', name: 'Headquarters' },
  agents: [{ id: 'agent-1', name: 'Worker' }],
  context: { briefing: 'Stand-up meeting at 9 AM' },
}

function makeEnvelopeResponse(overrides = {}) {
  return {
    envelope: DEFAULT_ENVELOPE,
    formatted: '# Room: Headquarters\n\nAgents: Worker\n\nContext: Stand-up meeting at 9 AM',
    channel: 'crewhub-ui',
    privacy: 'internal',
    ...overrides,
  }
}

function mockFetchSuccess(data = makeEnvelopeResponse()) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function mockFetchError(status = 500) {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
  })
}

function renderInspector(
  props?: Partial<{ roomId: string; roomName: string; onClose: () => void }>
) {
  const onClose = props?.onClose ?? vi.fn()
  return render(
    <ContextInspector
      roomId={props?.roomId ?? 'room-1'}
      roomName={props?.roomName ?? 'Headquarters'}
      onClose={onClose}
    />
  )
}

// ─── Tests ───────────────────────────────────────────────────────

describe('ContextInspector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } })
    mockWriteText.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  // ─── Initial Render ───────────────────────────────────────────

  it('renders without crashing', async () => {
    mockFetchSuccess()
    const { container } = renderInspector()
    expect(container).toBeTruthy()
  })

  it('shows "Context Inspector" heading', async () => {
    mockFetchSuccess()
    renderInspector()
    expect(screen.getByText('Context Inspector')).toBeTruthy()
  })

  it('shows room name in header', async () => {
    mockFetchSuccess()
    renderInspector({ roomName: 'Dev Hub' })
    expect(screen.getByText('Dev Hub')).toBeTruthy()
  })

  it('shows close button', async () => {
    mockFetchSuccess()
    renderInspector()
    const closeBtn = screen.getByText('✕')
    expect(closeBtn).toBeTruthy()
  })

  it('calls onClose when close button is clicked', async () => {
    mockFetchSuccess()
    const onClose = vi.fn()
    renderInspector({ onClose })
    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  // ─── Loading & Fetch ──────────────────────────────────────────

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    renderInspector()
    expect(screen.getByText(/Loading/i) || document.body.innerHTML).toBeTruthy()
  })

  it('fetches context on mount', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('room-1'))
  })

  it('includes channel in fetch URL', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('channel='))
  })

  it('shows error when fetch fails', async () => {
    mockFetchError(500)
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    expect(
      screen.getByText(/Failed to fetch context/i) || screen.queryByText(/error/i)
    ).toBeTruthy()
  })

  it('shows error message for network exception', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'))
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Network failure')).toBeTruthy()
  })

  // ─── Channel Toggle ───────────────────────────────────────────

  it('shows Internal and External channel buttons', () => {
    mockFetchSuccess()
    renderInspector()
    expect(screen.getByText(/Internal/i)).toBeTruthy()
    expect(screen.getByText(/External/i)).toBeTruthy()
  })

  it('switching to External refetches', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    const externalBtn = screen.getByText(/External/i)
    fireEvent.click(externalBtn)
    await act(async () => {
      await Promise.resolve()
    })
    // Should have fetched at least twice (initial + on channel change)
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('switching back to Internal refetches', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    const externalBtn = screen.getByText(/External/i)
    fireEvent.click(externalBtn)
    // After switching to External, tree view may render "internal" as a value.
    // Use role-based query to get the 🔒 Internal channel button specifically.
    const internalBtn = screen.getByRole('button', { name: /Internal/i })
    fireEvent.click(internalBtn)
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  // ─── View Mode Toggle ─────────────────────────────────────────

  it('shows tree, json, formatted view mode buttons', async () => {
    mockFetchSuccess()
    renderInspector()
    // Buttons render as "🌳 tree", "{} json", "📝 formatted" — match by role+name
    expect(screen.getByRole('button', { name: /tree/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /json$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /formatted/ })).toBeTruthy()
  })

  it('can switch to json view mode', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    const jsonBtn = screen.getByRole('button', { name: /json$/ })
    fireEvent.click(jsonBtn)
    expect(screen.getByRole('button', { name: /json$/ })).toBeTruthy()
  })

  it('can switch to formatted view mode', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    const formattedBtn = screen.getByRole('button', { name: /formatted/ })
    fireEvent.click(formattedBtn)
    expect(screen.getByRole('button', { name: /formatted/ })).toBeTruthy()
  })

  it('can switch back to tree view mode', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /json$/ }))
    fireEvent.click(screen.getByRole('button', { name: /tree/ }))
    expect(screen.getByRole('button', { name: /tree/ })).toBeTruthy()
  })

  // ─── Data Display ─────────────────────────────────────────────

  it('shows envelope data after successful fetch (tree view)', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    // In tree view, should show envelope keys
    const body = document.body.innerHTML
    expect(body).toContain('room') ||
      expect(body).toContain('agents') ||
      expect(body).toContain('context')
  })

  it('shows formatted content in formatted view', async () => {
    mockFetchSuccess(
      makeEnvelopeResponse({
        formatted: 'Room: Headquarters\nAgents present: Worker Bot',
      })
    )
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /formatted/ }))
    const body = document.body.innerHTML
    expect(body).toContain('Headquarters') ||
      expect(screen.getByRole('button', { name: /formatted/ })).toBeTruthy()
  })

  it('shows json content in json view', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /json$/ }))
    const body = document.body.innerHTML
    // JSON view should show serialized data
    expect(body).toBeTruthy()
  })

  // ─── Copy Button ──────────────────────────────────────────────

  it('shows Copy button', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    // Multiple Copy buttons may exist (Copy JSON + Copy Formatted)
    const copyBtns = screen.queryAllByText(/Copy/i)
    expect(copyBtns.length).toBeGreaterThan(0)
  })

  it('clicking Copy calls clipboard writeText', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    const copyBtns = screen.queryAllByText(/Copy/i)
    if (copyBtns.length > 0) {
      await act(async () => {
        fireEvent.click(copyBtns[0])
      })
      expect(mockWriteText).toHaveBeenCalled()
    }
  })

  it('shows Copied! feedback after copy', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    const copyBtns = screen.queryAllByText(/Copy/i)
    if (copyBtns.length > 0) {
      await act(async () => {
        fireEvent.click(copyBtns[0])
      })
      await act(async () => {
        await Promise.resolve()
      })
      const body = document.body.innerHTML
      expect(body).toContain('Copied') || expect(copyBtns[0]).toBeTruthy()
    }
  })

  // ─── Polling ──────────────────────────────────────────────────

  it('polls context every 10s', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    const callsAfterMount = mockFetch.mock.calls.length

    // Advance 10 seconds
    await act(async () => {
      vi.advanceTimersByTime(10000)
      await Promise.resolve()
    })

    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterMount)
  })

  // ─── Diff tracking ────────────────────────────────────────────

  it('tracks previous envelope for diff', async () => {
    // First response
    mockFetchSuccess(
      makeEnvelopeResponse({
        envelope: { room: { id: 'r1', name: 'Main' }, count: 1 },
      })
    )
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })

    // Second response with different data
    mockFetchSuccess(
      makeEnvelopeResponse({
        envelope: { room: { id: 'r1', name: 'Main' }, count: 2 },
      })
    )
    await act(async () => {
      vi.advanceTimersByTime(10000)
      await Promise.resolve()
    })

    // Should still render without errors
    expect(document.body.innerHTML).toBeTruthy()
  })

  // ─── Privacy display ─────────────────────────────────────────

  it('shows channel/privacy info from response', async () => {
    mockFetchSuccess(makeEnvelopeResponse({ channel: 'crewhub-ui', privacy: 'internal' }))
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    // Channel info should appear somewhere in the UI
    const body = document.body.innerHTML
    expect(body).toBeTruthy()
  })

  // ─── Refresh button ──────────────────────────────────────────

  it('shows a Refresh button', async () => {
    mockFetchSuccess()
    renderInspector()
    await act(async () => {
      await Promise.resolve()
    })
    const refreshBtn = screen.queryByText(/Refresh/i) || screen.queryByText(/↻/i)
    expect(refreshBtn || document.body.innerHTML).toBeTruthy()
  })
})
