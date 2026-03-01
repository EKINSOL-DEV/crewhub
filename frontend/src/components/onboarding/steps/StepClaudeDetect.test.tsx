/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ClaudeCodeDetectResult } from '@/lib/api'

// ─── Mocks ───────────────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon" />
  )
  return {
    CheckCircle2: Icon,
    XCircle: Icon,
    Loader2: Icon,
    RefreshCw: Icon,
    ArrowRight: Icon,
    AlertTriangle: Icon,
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, className }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}))

const mockDetect = vi.fn()

vi.mock('@/lib/api', () => ({
  detectClaudeCode: (...args: any[]) => mockDetect(...args),
}))

import { StepClaudeDetect } from './StepClaudeDetect'

// ─── Factories ────────────────────────────────────────────────────

function makeResult(overrides?: Partial<ClaudeCodeDetectResult>): ClaudeCodeDetectResult {
  return {
    found: true,
    cli_path: '/usr/local/bin/claude',
    projects_dir_exists: true,
    session_count: 3,
    status: 'found',
    cli_available: true,
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────

describe('StepClaudeDetect — loading state', () => {
  beforeEach(() => {
    mockDetect.mockReset()
    // Never resolve — keeps component in loading state
    mockDetect.mockReturnValue(new Promise(() => {}))
  })

  it('shows scanning text while loading', () => {
    render(<StepClaudeDetect onContinue={vi.fn()} />)
    expect(screen.getByText('Scanning...')).toBeTruthy()
  })

  it('shows the heading', () => {
    render(<StepClaudeDetect onContinue={vi.fn()} />)
    expect(screen.getByText('Detecting Claude Code')).toBeTruthy()
  })
})

describe('StepClaudeDetect — found state', () => {
  beforeEach(() => {
    mockDetect.mockReset()
    mockDetect.mockResolvedValue(makeResult())
  })

  it('shows success message when found', async () => {
    render(<StepClaudeDetect onContinue={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Claude Code Found!')).toBeTruthy()
    })
  })

  it('shows CLI path', async () => {
    render(<StepClaudeDetect onContinue={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('/usr/local/bin/claude')).toBeTruthy()
    })
  })

  it('shows session count', async () => {
    render(<StepClaudeDetect onContinue={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/3 existing sessions/)).toBeTruthy()
    })
  })

  it('calls onContinue when Continue is clicked', async () => {
    const onContinue = vi.fn()
    render(<StepClaudeDetect onContinue={onContinue} />)
    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Continue'))
    expect(onContinue).toHaveBeenCalledOnce()
  })
})

describe('StepClaudeDetect — not-found state', () => {
  beforeEach(() => {
    mockDetect.mockReset()
    mockDetect.mockResolvedValue(
      makeResult({
        found: false,
        cli_path: null,
        projects_dir_exists: false,
        session_count: 0,
        status: 'not_found',
        cli_available: false,
      })
    )
  })

  it('shows not-found message', async () => {
    render(<StepClaudeDetect onContinue={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Claude Code Not Found')).toBeTruthy()
    })
  })

  it('shows install command', async () => {
    render(<StepClaudeDetect onContinue={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('npm install -g @anthropic-ai/claude-code')).toBeTruthy()
    })
  })

  it('shows Skip for now button', async () => {
    render(<StepClaudeDetect onContinue={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Skip for now')).toBeTruthy()
    })
  })
})

describe('StepClaudeDetect — dir_only state', () => {
  beforeEach(() => {
    mockDetect.mockReset()
    mockDetect.mockResolvedValue(
      makeResult({
        found: false,
        cli_path: null,
        projects_dir_exists: true,
        session_count: 0,
        status: 'dir_only',
        cli_available: false,
      })
    )
  })

  it('shows partial detection message', async () => {
    render(<StepClaudeDetect onContinue={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Claude Code Partially Detected')).toBeTruthy()
    })
  })

  it('shows install command', async () => {
    render(<StepClaudeDetect onContinue={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('npm install -g @anthropic-ai/claude-code')).toBeTruthy()
    })
  })

  it('shows Continue Anyway button', async () => {
    const onContinue = vi.fn()
    render(<StepClaudeDetect onContinue={onContinue} />)
    await waitFor(() => {
      expect(screen.getByText(/Continue Anyway/)).toBeTruthy()
    })
    fireEvent.click(screen.getByText(/Continue Anyway/))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('shows Retry button', async () => {
    render(<StepClaudeDetect onContinue={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeTruthy()
    })
  })
})

describe('StepClaudeDetect — retry', () => {
  it('calls detect again when Retry is clicked', async () => {
    mockDetect.mockReset()
    mockDetect.mockResolvedValue(
      makeResult({
        found: false,
        cli_path: null,
        projects_dir_exists: false,
        session_count: 0,
        status: 'not_found',
        cli_available: false,
      })
    )

    render(<StepClaudeDetect onContinue={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeTruthy()
    })

    mockDetect.mockResolvedValue(makeResult())
    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByText('Claude Code Found!')).toBeTruthy()
    })
    // Initial call + retry
    expect(mockDetect).toHaveBeenCalledTimes(2)
  })
})
