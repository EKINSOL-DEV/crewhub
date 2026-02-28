import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ConnectionConfig } from '@/components/onboarding/onboardingTypes'

// ─── Mocks ───────────────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon" />
  )
  return {
    Rocket: Icon,
    Sparkles: Icon,
    CheckCircle2: Icon,
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className }: any) => (
    <button onClick={onClick} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/onboarding/onboardingHelpers', () => ({
  getRuntimeIcon: (_type: string) => <span data-testid="runtime-icon" />,
}))

import { StepReady } from '@/components/onboarding/steps/StepReady'

// ─── Factories ────────────────────────────────────────────────────

function makeConnection(overrides?: Partial<ConnectionConfig>): ConnectionConfig {
  return {
    id: 'c1',
    name: 'My OpenClaw',
    type: 'openclaw',
    url: 'ws://localhost:18789',
    token: '',
    enabled: true,
    testStatus: 'success',
    sessions: 0,
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────

describe('StepReady — rendering', () => {
  it("renders the You're all set heading", () => {
    render(<StepReady connections={[]} onGoDashboard={vi.fn()} />)
    expect(screen.getByText("You're all set!")).toBeTruthy()
  })

  it('renders Go to dashboard button', () => {
    render(<StepReady connections={[]} onGoDashboard={vi.fn()} />)
    expect(screen.getByText(/Go to dashboard/)).toBeTruthy()
  })

  it('shows "No connections configured yet" when no connections', () => {
    render(<StepReady connections={[]} onGoDashboard={vi.fn()} />)
    expect(screen.getByText(/No connections configured yet/)).toBeTruthy()
  })

  it('shows enabled connection name and url', () => {
    const conn = makeConnection({ name: 'Home Server', url: 'ws://home:18789' })
    render(<StepReady connections={[conn]} onGoDashboard={vi.fn()} />)
    expect(screen.getByText('Home Server')).toBeTruthy()
    expect(screen.getByText('ws://home:18789')).toBeTruthy()
  })

  it('only shows enabled connections', () => {
    const conns = [
      makeConnection({ id: 'a', name: 'Enabled Bot', enabled: true }),
      makeConnection({ id: 'b', name: 'Disabled Bot', enabled: false }),
    ]
    render(<StepReady connections={conns} onGoDashboard={vi.fn()} />)
    expect(screen.getByText('Enabled Bot')).toBeTruthy()
    expect(screen.queryByText('Disabled Bot')).toBeNull()
  })

  it('shows session count when total > 0', () => {
    const conns = [makeConnection({ sessions: 3 }), makeConnection({ id: 'c2', sessions: 2 })]
    render(<StepReady connections={conns} onGoDashboard={vi.fn()} />)
    expect(screen.getByText(/5 active session/)).toBeTruthy()
  })

  it('shows plural "sessions" for count > 1', () => {
    const conns = [makeConnection({ sessions: 5 })]
    render(<StepReady connections={conns} onGoDashboard={vi.fn()} />)
    expect(screen.getByText(/5 active sessions/)).toBeTruthy()
  })

  it('shows singular "session" for count = 1', () => {
    const conns = [makeConnection({ sessions: 1 })]
    render(<StepReady connections={conns} onGoDashboard={vi.fn()} />)
    expect(screen.getByText(/1 active session\b/)).toBeTruthy()
  })

  it('does not show session count line when total is 0', () => {
    const conns = [makeConnection({ sessions: 0 })]
    render(<StepReady connections={conns} onGoDashboard={vi.fn()} />)
    expect(screen.queryByText(/active session/)).toBeNull()
  })

  it('shows checkmark for connections with testStatus=success', () => {
    const conns = [makeConnection({ testStatus: 'success' })]
    const { container } = render(<StepReady connections={conns} onGoDashboard={vi.fn()} />)
    // CheckCircle2 is rendered as icon
    expect(container.querySelectorAll('[data-testid="icon"]').length).toBeGreaterThan(0)
  })

  it('shows runtime icon for each connection', () => {
    const conns = [makeConnection()]
    render(<StepReady connections={conns} onGoDashboard={vi.fn()} />)
    expect(screen.getByTestId('runtime-icon')).toBeTruthy()
  })
})

describe('StepReady — interactions', () => {
  it('calls onGoDashboard when Go to dashboard is clicked', () => {
    const onGoDashboard = vi.fn()
    render(<StepReady connections={[]} onGoDashboard={onGoDashboard} />)
    fireEvent.click(screen.getByText(/Go to dashboard/))
    expect(onGoDashboard).toHaveBeenCalledOnce()
  })
})
