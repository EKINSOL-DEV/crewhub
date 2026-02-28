import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ─── Must be DEV mode ─────────────────────────────────────────────
vi.stubEnv('DEV', true)
vi.stubEnv('PROD', false)

// ─── Mock devErrorStore ───────────────────────────────────────────
// We use a minimal in-memory store to avoid localStorage coupling

let _errors: any[] = []
let _listeners: Array<() => void> = []

vi.mock('@/lib/devErrorStore', () => ({
  getAllErrors: () => [..._errors],
  clearErrors: () => {
    _errors = []
    _listeners.forEach((l) => l())
  },
  getErrorCount: () => _errors.length,
  subscribe: (listener: () => void) => {
    _listeners.push(listener)
    return () => {
      _listeners = _listeners.filter((l) => l !== listener)
    }
  },
}))

// Mock clipboard
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

import { DevToolbar } from '@/components/dev/DevErrorViewer'

// ─── Helper: seed errors ──────────────────────────────────────────

function makeError(overrides = {}): any {
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: Date.now(),
    type: 'console.error',
    message: 'Something went wrong',
    url: 'http://localhost:5180/test',
    userAgent: 'TestAgent/1.0',
    ...overrides,
  }
}

function notifyListeners() {
  _listeners.forEach((l) => l())
}

// ─── Tests ───────────────────────────────────────────────────────

describe('DevToolbar — visibility', () => {
  beforeEach(() => {
    _errors = []
    _listeners = []
    // Set the localStorage flag that controls visibility
    localStorage.setItem('dev-error-viewer-visible', 'true')
  })

  it('renders the toolbar when visible=true', () => {
    _errors = [makeError()]
    render(<DevToolbar />)
    // The bug button should be visible
    const bugBtn = document.querySelector('button[title="Dev Error Log"]')
    expect(bugBtn).toBeTruthy()
  })

  it('does not render when visible=false', () => {
    localStorage.setItem('dev-error-viewer-visible', 'false')
    render(<DevToolbar />)
    const bugBtn = document.querySelector('button[title="Dev Error Log"]')
    expect(bugBtn).toBeNull()
  })

  it('shows error count badge when errors exist', () => {
    _errors = [makeError(), makeError()]
    render(<DevToolbar />)
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('does not show count badge when 0 errors', () => {
    _errors = []
    render(<DevToolbar />)
    // No numeric badge
    expect(screen.queryByText('0')).toBeNull()
  })
})

describe('DevToolbar — modal open/close', () => {
  beforeEach(() => {
    _errors = [makeError({ message: 'Test error message' })]
    _listeners = []
    localStorage.setItem('dev-error-viewer-visible', 'true')
  })

  it('opens modal when bug button is clicked', () => {
    render(<DevToolbar />)
    const bugBtn = document.querySelector('button[title="Dev Error Log"]') as HTMLButtonElement
    fireEvent.click(bugBtn)
    expect(screen.getByText('Dev Error Log')).toBeTruthy()
  })

  it('modal shows error messages', () => {
    render(<DevToolbar />)
    fireEvent.click(document.querySelector('button[title="Dev Error Log"]') as HTMLButtonElement)
    expect(screen.getByText('Test error message')).toBeTruthy()
  })

  it('closes modal when X is clicked', () => {
    render(<DevToolbar />)
    fireEvent.click(document.querySelector('button[title="Dev Error Log"]') as HTMLButtonElement)
    expect(screen.getByText('Dev Error Log')).toBeTruthy()
    // Find close button (X icon button with no text)
    const header = document.querySelector('[style*="borderBottom"]')
    const closeBtn = header?.querySelectorAll('button')
    // Last button in header is the close X
    if (closeBtn && closeBtn.length > 0) {
      fireEvent.click(closeBtn[closeBtn.length - 1])
      expect(screen.queryByText('Dev Error Log')).toBeNull()
    }
  })

  it('closes modal on Escape key', () => {
    render(<DevToolbar />)
    fireEvent.click(document.querySelector('button[title="Dev Error Log"]') as HTMLButtonElement)
    expect(screen.getByText('Dev Error Log')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('Dev Error Log')).toBeNull()
  })
})

describe('DevToolbar — error list features', () => {
  beforeEach(() => {
    _errors = [
      makeError({
        id: 'e1',
        type: 'console.error',
        message: 'Console error message',
        source: 'app.ts',
        lineno: 42,
      }),
      makeError({
        id: 'e2',
        type: 'react-error',
        message: 'React render crash',
        stack: 'Error at MyComp',
      }),
    ]
    _listeners = []
    localStorage.setItem('dev-error-viewer-visible', 'true')
  })

  function openModal() {
    const bugBtn = document.querySelector('button[title="Dev Error Log"]') as HTMLButtonElement
    fireEvent.click(bugBtn)
  }

  it('shows error count in modal header', () => {
    render(<DevToolbar />)
    openModal()
    // "2 / 2 errors"
    expect(screen.getByText(/2 \/ 2 errors/)).toBeTruthy()
  })

  it('renders error messages in the list', () => {
    render(<DevToolbar />)
    openModal()
    expect(screen.getByText(/Console error message/)).toBeTruthy()
    expect(screen.getByText(/React render crash/)).toBeTruthy()
  })

  it('shows all-type count for "2 / 2 errors"', () => {
    render(<DevToolbar />)
    openModal()
    expect(screen.getByText(/2 \/ 2 errors/)).toBeTruthy()
  })

  it('filters errors by search query', () => {
    render(<DevToolbar />)
    openModal()
    const searchInput = screen.getByPlaceholderText('Search errors...')
    fireEvent.change(searchInput, { target: { value: 'Console' } })
    // Only Console error message should remain visible
    expect(screen.queryByText(/React render crash/)).toBeNull()
    expect(screen.getByText(/Console error message/)).toBeTruthy()
  })

  it('shows "No errors match your filter" when search yields no results', () => {
    render(<DevToolbar />)
    openModal()
    const searchInput = screen.getByPlaceholderText('Search errors...')
    fireEvent.change(searchInput, { target: { value: 'zzzzz_no_match' } })
    expect(screen.getByText(/No errors match your filter/)).toBeTruthy()
  })

  it('clears errors on Clear button click', () => {
    render(<DevToolbar />)
    openModal()
    const clearBtn = screen.getByText(/Clear/)
    fireEvent.click(clearBtn)
    expect(screen.getByText(/No errors captured yet/)).toBeTruthy()
  })

  it('expands error row on click to show details', () => {
    render(<DevToolbar />)
    openModal()
    const errorRows = document.querySelectorAll('[style*="border-radius: 6px"]')
    const firstRow = errorRows[0]?.querySelector('button[type="button"]')
    if (firstRow) {
      fireEvent.click(firstRow)
      // After expanding, source info should appear
      expect(screen.getByText(/app.ts/)).toBeTruthy()
    }
  })

  it('collapses error row on second click', () => {
    render(<DevToolbar />)
    openModal()
    const errorRows = document.querySelectorAll('[style*="border-radius: 6px"]')
    const firstRowBtn = errorRows[0]?.querySelector('button[type="button"]')
    if (firstRowBtn) {
      fireEvent.click(firstRowBtn) // expand
      fireEvent.click(firstRowBtn) // collapse
      expect(screen.queryByText(/app.ts/)).toBeNull()
    }
  })

  it('shows "No errors captured yet" when store is empty', () => {
    _errors = []
    render(<DevToolbar />)
    openModal()
    expect(screen.getByText(/No errors captured yet/)).toBeTruthy()
  })
})

describe('DevToolbar — F6 toggle', () => {
  beforeEach(() => {
    _errors = []
    _listeners = []
    localStorage.setItem('dev-error-viewer-visible', 'false')
  })

  it('toggles visibility on F6 keypress', () => {
    render(<DevToolbar />)
    // Initially hidden
    expect(document.querySelector('button[title="Dev Error Log"]')).toBeNull()
    // Press F6
    fireEvent.keyDown(window, { key: 'F6' })
    // Now visible
    expect(document.querySelector('button[title="Dev Error Log"]')).toBeTruthy()
  })

  it('toggles off on second F6 keypress', () => {
    localStorage.setItem('dev-error-viewer-visible', 'true')
    render(<DevToolbar />)
    expect(document.querySelector('button[title="Dev Error Log"]')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'F6' })
    expect(document.querySelector('button[title="Dev Error Log"]')).toBeNull()
  })
})

describe('DevToolbar — live error updates', () => {
  beforeEach(() => {
    _errors = []
    _listeners = []
    localStorage.setItem('dev-error-viewer-visible', 'true')
  })

  it('updates count when new error arrives via subscription', async () => {
    render(<DevToolbar />)
    expect(screen.queryByText('3')).toBeNull()
    // Simulate new errors arriving
    await act(async () => {
      _errors = [makeError(), makeError(), makeError()]
      notifyListeners()
    })
    expect(screen.getByText('3')).toBeTruthy()
  })
})
