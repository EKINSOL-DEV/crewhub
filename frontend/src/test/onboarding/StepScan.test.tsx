/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DiscoveryCandidate, ScanResult } from '@/lib/api'

// ─── Mocks ───────────────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon" />
  )
  return {
    Search: Icon,
    Loader2: Icon,
    RefreshCw: Icon,
    CheckCircle2: Icon,
    Sparkles: Icon,
    ArrowRight: Icon,
    Zap: Icon,
    Terminal: Icon,
    ExternalLink: Icon,
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className, asChild }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span className={className} data-variant={variant}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/onboarding/onboardingHelpers', () => ({
  getRuntimeIcon: (_type: string) => <span data-testid="runtime-icon" />,
  getRuntimeLabel: (type: string) =>
    type === 'openclaw' ? 'OpenClaw' : type === 'claude_code' ? 'Claude Code' : type,
  getStatusBadge: (status: string) => <span data-testid={`status-${status}`}>{status}</span>,
}))

import { StepScan } from '@/components/onboarding/steps/StepScan'

// ─── Factories ────────────────────────────────────────────────────

function makeCandidate(overrides?: Partial<DiscoveryCandidate>): DiscoveryCandidate {
  return {
    runtime_type: 'openclaw',
    status: 'reachable',
    confidence: 'high',
    target: { url: 'ws://localhost:18789', host: 'localhost', port: 18789 },
    metadata: { active_sessions: 2, version: '1.2.3' },
    evidence: ['port-scan'],
    ...overrides,
  } as DiscoveryCandidate
}

const defaultScanResult: ScanResult = {
  scan_duration_ms: 342,
  candidates: [],
  errors: [],
  scanned_at: new Date().toISOString(),
}

function renderScan(props?: Partial<Parameters<typeof StepScan>[0]>) {
  const onScanAgain = vi.fn()
  const onConnect = vi.fn()
  const onContinue = vi.fn()
  const onDemo = vi.fn()
  render(
    <StepScan
      scanning={false}
      scanResult={null}
      candidates={[]}
      onScanAgain={onScanAgain}
      onConnect={onConnect}
      onContinue={onContinue}
      onDemo={onDemo}
      {...props}
    />
  )
  return { onScanAgain, onConnect, onContinue, onDemo }
}

// ─── Tests ───────────────────────────────────────────────────────

describe('StepScan — scanning state', () => {
  it('shows scanning heading while scanning', () => {
    renderScan({ scanning: true })
    expect(screen.getByText(/Scanning for agent runtimes/)).toBeTruthy()
  })

  it('shows scanning description while scanning', () => {
    renderScan({ scanning: true })
    expect(screen.getByText(/Checking localhost ports/)).toBeTruthy()
  })

  it('disables "Scan again" button while scanning', () => {
    renderScan({ scanning: true })
    const btn = screen.getByText(/Scan again/)
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('StepScan — no results', () => {
  it('shows "No runtimes found" when scan done and no candidates', () => {
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates: [] })
    expect(screen.getByText('No runtimes found')).toBeTruthy()
  })

  it('shows "No agent runtimes detected" explanation', () => {
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates: [] })
    expect(screen.getByText(/No agent runtimes detected/)).toBeTruthy()
  })

  it('shows "Use demo data" button when nothing found', () => {
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates: [] })
    expect(screen.getByText(/Use demo data/)).toBeTruthy()
  })

  it('calls onDemo when "Use demo data" is clicked', () => {
    const { onDemo } = renderScan({
      scanning: false,
      scanResult: defaultScanResult,
      candidates: [],
    })
    fireEvent.click(screen.getByText(/Use demo data/))
    expect(onDemo).toHaveBeenCalledOnce()
  })

  it('does NOT show Continue button when no reachable candidates', () => {
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates: [] })
    expect(screen.queryByText(/^Continue$/)).toBeNull()
  })
})

describe('StepScan — with results', () => {
  it('shows "Discovery Results" heading', () => {
    const candidates = [makeCandidate()]
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates })
    expect(screen.getByText('Discovery Results')).toBeTruthy()
  })

  it('shows scan duration', () => {
    const candidates = [makeCandidate()]
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates })
    expect(screen.getByText(/342ms/)).toBeTruthy()
  })

  it('shows Connect button for reachable candidates', () => {
    const candidates = [makeCandidate({ status: 'reachable' })]
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates })
    expect(screen.getByText('Connect')).toBeTruthy()
  })

  it('calls onConnect with candidate and index when Connect is clicked', () => {
    const candidate = makeCandidate({ status: 'reachable' })
    const { onConnect } = renderScan({
      scanning: false,
      scanResult: defaultScanResult,
      candidates: [candidate],
    })
    fireEvent.click(screen.getByText('Connect'))
    expect(onConnect).toHaveBeenCalledWith(candidate, 0)
  })

  it('shows Continue button when reachable candidates exist', () => {
    const candidates = [makeCandidate({ status: 'reachable' })]
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates })
    expect(screen.getByText('Continue')).toBeTruthy()
  })

  it('calls onContinue when Continue is clicked', () => {
    const candidates = [makeCandidate({ status: 'reachable' })]
    const { onContinue } = renderScan({
      scanning: false,
      scanResult: defaultScanResult,
      candidates,
    })
    fireEvent.click(screen.getByText('Continue'))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('shows candidate version when available', () => {
    const candidates = [makeCandidate({ metadata: { active_sessions: 1, version: '2.5.0' } })]
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates })
    expect(screen.getByText(/2.5.0/)).toBeTruthy()
  })

  it('shows evidence chips', () => {
    const candidates = [makeCandidate({ evidence: ['port-scan', 'config-file'] })]
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates })
    expect(screen.getByText('port-scan')).toBeTruthy()
    expect(screen.getByText('config-file')).toBeTruthy()
  })

  it('shows candidate URL', () => {
    const candidates = [
      makeCandidate({ target: { url: 'ws://192.168.1.5:18789', host: 'host', port: 18789 } }),
    ]
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates })
    expect(screen.getByText(/192.168.1.5/)).toBeTruthy()
  })

  it('shows session count when available', () => {
    const candidates = [makeCandidate({ metadata: { active_sessions: 5, version: '1.0' } })]
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates })
    expect(screen.getByText(/5 active session/)).toBeTruthy()
  })

  it('shows confidence badge when not high confidence', () => {
    const candidates = [makeCandidate({ confidence: 'low' })]
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates })
    expect(screen.getByText(/low confidence/)).toBeTruthy()
  })

  it('does NOT show confidence badge for high confidence', () => {
    const candidates = [makeCandidate({ confidence: 'high' })]
    renderScan({ scanning: false, scanResult: defaultScanResult, candidates })
    expect(screen.queryByText(/high confidence/)).toBeNull()
  })
})

describe('StepScan — Scan again', () => {
  it('calls onScanAgain when Scan again is clicked', () => {
    const { onScanAgain } = renderScan({ scanning: false })
    fireEvent.click(screen.getByText(/Scan again/))
    expect(onScanAgain).toHaveBeenCalledOnce()
  })
})
