/* eslint-disable @typescript-eslint/no-explicit-any, sonarjs/no-duplicate-string */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// ─── Mock lucide-react ────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon" />
  )
  return {
    Zap: Icon,
    Terminal: Icon,
    Bot: Icon,
    Cable: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    AlertCircle: Icon,
  }
})

// ─── Mock UI badge ────────────────────────────────────────────────

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span className={className} data-variant={variant}>
      {children}
    </span>
  ),
}))

import {
  getRuntimeIcon,
  getRuntimeLabel,
  getStatusBadge,
  candidateToConnection,
} from '@/components/onboarding/onboardingHelpers'
import type { DiscoveryCandidate } from '@/lib/api'

// ─── getRuntimeLabel ─────────────────────────────────────────────

describe('getRuntimeLabel', () => {
  it('returns "OpenClaw" for openclaw', () => {
    expect(getRuntimeLabel('openclaw')).toBe('OpenClaw')
  })

  it('returns "Claude Code" for claude_code', () => {
    expect(getRuntimeLabel('claude_code')).toBe('Claude Code')
  })

  it('returns "Codex CLI" for codex_cli', () => {
    expect(getRuntimeLabel('codex_cli')).toBe('Codex CLI')
  })

  it('returns the raw type for unknown runtimes', () => {
    expect(getRuntimeLabel('some_custom_runtime')).toBe('some_custom_runtime')
    expect(getRuntimeLabel('')).toBe('')
    expect(getRuntimeLabel('langchain')).toBe('langchain')
  })
})

// ─── getRuntimeIcon ───────────────────────────────────────────────

describe('getRuntimeIcon', () => {
  it('renders an element for openclaw', () => {
    const { container } = render(<>{getRuntimeIcon('openclaw')}</>)
    expect(container.querySelector('[data-testid="icon"]')).toBeTruthy()
  })

  it('renders an element for claude_code', () => {
    const { container } = render(<>{getRuntimeIcon('claude_code')}</>)
    expect(container.querySelector('[data-testid="icon"]')).toBeTruthy()
  })

  it('renders an element for codex_cli', () => {
    const { container } = render(<>{getRuntimeIcon('codex_cli')}</>)
    expect(container.querySelector('[data-testid="icon"]')).toBeTruthy()
  })

  it('renders a fallback icon for unknown runtime', () => {
    const { container } = render(<>{getRuntimeIcon('unknown_runtime')}</>)
    expect(container.querySelector('[data-testid="icon"]')).toBeTruthy()
  })

  it('renders a fallback for empty string', () => {
    const { container } = render(<>{getRuntimeIcon('')}</>)
    expect(container.querySelector('[data-testid="icon"]')).toBeTruthy()
  })
})

// ─── getStatusBadge ───────────────────────────────────────────────

describe('getStatusBadge', () => {
  it('renders "Reachable" for reachable status', () => {
    const { container } = render(<>{getStatusBadge('reachable')}</>)
    expect(container.textContent).toContain('Reachable')
  })

  it('renders "Installed" for installed status', () => {
    const { container } = render(<>{getStatusBadge('installed')}</>)
    expect(container.textContent).toContain('Installed')
  })

  it('renders "Auth Required" for auth_required status', () => {
    const { container } = render(<>{getStatusBadge('auth_required')}</>)
    expect(container.textContent).toContain('Auth Required')
  })

  it('renders "Unreachable" for unreachable status', () => {
    const { container } = render(<>{getStatusBadge('unreachable')}</>)
    expect(container.textContent).toContain('Unreachable')
  })

  it('renders "Unknown" for any other status', () => {
    const { container } = render(<>{getStatusBadge('something_else')}</>)
    expect(container.textContent).toContain('Unknown')
  })

  it('renders "Unknown" for empty string', () => {
    const { container } = render(<>{getStatusBadge('')}</>)
    expect(container.textContent).toContain('Unknown')
  })
})

// ─── candidateToConnection ────────────────────────────────────────

function makeCandidate(overrides?: Partial<DiscoveryCandidate>): DiscoveryCandidate {
  return {
    runtime_type: 'openclaw',
    status: 'reachable',
    confidence: 'high',
    target: {
      url: 'ws://localhost:18789',
      host: 'localhost',
      port: 18789,
    },
    metadata: {
      active_sessions: 3,
      version: '1.0.0',
    },
    evidence: ['port-scan', 'config-file'],
    ...overrides,
  } as DiscoveryCandidate
}

describe('candidateToConnection', () => {
  it('uses candidate target.url when present', () => {
    const candidate = makeCandidate({
      target: { url: 'ws://example.com:18789', host: 'example.com', port: 18789 },
    })
    const conn = candidateToConnection(candidate, 0)
    expect(conn.url).toBe('ws://example.com:18789')
  })

  it('builds URL from host+port when url is missing', () => {
    const candidate = makeCandidate({ target: { host: '192.168.1.55', port: 9000 } as any })
    const conn = candidateToConnection(candidate, 0)
    expect(conn.url).toContain('192.168.1.55')
    expect(conn.url).toContain('9000')
  })

  it('uses localhost when no host provided', () => {
    const candidate = makeCandidate({ target: { port: 3000 } as any })
    const conn = candidateToConnection(candidate, 0)
    expect(conn.url).toContain('localhost')
  })

  it('returns id using index', () => {
    const conn = candidateToConnection(makeCandidate(), 2)
    expect(conn.id).toContain('2')
  })

  it('sets enabled=true for reachable candidates', () => {
    const candidate = makeCandidate({ status: 'reachable' })
    const conn = candidateToConnection(candidate, 0)
    expect(conn.enabled).toBe(true)
  })

  it('sets enabled=false for non-reachable candidates', () => {
    const candidate = makeCandidate({ status: 'installed' })
    const conn = candidateToConnection(candidate, 0)
    expect(conn.enabled).toBe(false)
  })

  it('sets testStatus=success for reachable candidates', () => {
    const candidate = makeCandidate({ status: 'reachable' })
    const conn = candidateToConnection(candidate, 0)
    expect(conn.testStatus).toBe('success')
  })

  it('sets testStatus=idle for non-reachable candidates', () => {
    const candidate = makeCandidate({ status: 'unreachable' })
    const conn = candidateToConnection(candidate, 0)
    expect(conn.testStatus).toBe('idle')
  })

  it('preserves session count from metadata', () => {
    const candidate = makeCandidate({ metadata: { active_sessions: 7, version: '2.0' } })
    const conn = candidateToConnection(candidate, 0)
    expect(conn.sessions).toBe(7)
  })

  it('includes runtime label in name', () => {
    const candidate = makeCandidate({ runtime_type: 'claude_code' })
    const conn = candidateToConnection(candidate, 0)
    expect(conn.name).toContain('Claude Code')
  })

  it('sets token to empty string', () => {
    const conn = candidateToConnection(makeCandidate(), 0)
    expect(conn.token).toBe('')
  })

  it('sets type from runtime_type', () => {
    const candidate = makeCandidate({ runtime_type: 'codex_cli' })
    const conn = candidateToConnection(candidate, 0)
    expect(conn.type).toBe('codex_cli')
  })
})
