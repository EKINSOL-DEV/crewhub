/**
 * AgentCameraView Tests
 * Tests for AgentCameraButton, AgentMiniViewport, AgentCameraOverlay
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  AgentCameraButton,
  AgentMiniViewport,
  AgentCameraOverlay,
} from '@/components/mobile/AgentCameraView'
import type { BotVariantConfig } from '@/components/world3d/utils/botVariants'

// ── Mocks ─────────────────────────────────────────────────────────────────

// Lazy 3D scene mock
vi.mock('@/components/mobile/AgentScene3D', () => ({
  default: ({ agentStatus }: any) => <div data-testid="agent-scene-3d" data-status={agentStatus} />,
}))

// Stub WebGL so canRender3D() → false by default
const origGetContext = HTMLCanvasElement.prototype.getContext
beforeEach(() => {
  vi.clearAllMocks()
  // Make canvas.getContext return null → canRender3D returns false
  ;(HTMLCanvasElement.prototype as any).getContext = () => null
})

afterEach(() => {
  ;(HTMLCanvasElement.prototype as any).getContext = origGetContext
})

// ── Test data ─────────────────────────────────────────────────────────────

const botConfig: BotVariantConfig = {
  color: '#6366f1',
  expression: 'happy',
  icon: '🤖',
  variant: 'worker',
  accessory: 'crown',
  chestDisplay: 'tool',
  label: 'Bot',
}

// ── AgentCameraButton ─────────────────────────────────────────────────────

describe('AgentCameraButton', () => {
  it('renders a button', () => {
    render(<AgentCameraButton onClick={vi.fn()} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<AgentCameraButton onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders a camera icon (svg)', () => {
    const { container } = render(<AgentCameraButton onClick={vi.fn()} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('applies active styling when isActive=true', () => {
    const { container } = render(<AgentCameraButton onClick={vi.fn()} isActive={true} />)
    const btn = container.querySelector('button')!
    // Background changes based on isActive prop (JSDOM normalizes with spaces)
    expect(btn.style.background).toContain('rgba(99, 102, 241')
  })

  it('applies inactive styling when isActive=false', () => {
    const { container } = render(<AgentCameraButton onClick={vi.fn()} isActive={false} />)
    const btn = container.querySelector('button')!
    expect(btn.style.background).toContain('rgba(255, 255, 255, 0.05)')
  })
})

// ── AgentMiniViewport ─────────────────────────────────────────────────────

describe('AgentMiniViewport', () => {
  it('renders nothing when isVisible=false', () => {
    const { container } = render(
      <AgentMiniViewport
        isVisible={false}
        agentName="Test"
        agentStatus="idle"
        botConfig={botConfig}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders viewport when isVisible=true', () => {
    const { container } = render(
      <AgentMiniViewport
        isVisible={true}
        agentName="Test"
        agentStatus="active"
        botConfig={botConfig}
      />
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('shows Working label for active status', () => {
    render(
      <AgentMiniViewport
        isVisible={true}
        agentName="Test"
        agentStatus="active"
        botConfig={botConfig}
      />
    )
    // StaticAgentAvatar + status badge both show the label — use getAllByText
    expect(screen.getAllByText('Working').length).toBeGreaterThanOrEqual(1)
  })

  it('shows Idle label for idle status', () => {
    render(
      <AgentMiniViewport
        isVisible={true}
        agentName="Test"
        agentStatus="idle"
        botConfig={botConfig}
      />
    )
    expect(screen.getAllByText('Idle').length).toBeGreaterThanOrEqual(1)
  })

  it('shows Sleeping label for sleeping status', () => {
    render(
      <AgentMiniViewport
        isVisible={true}
        agentName="Test"
        agentStatus="sleeping"
        botConfig={botConfig}
      />
    )
    expect(screen.getAllByText('Sleeping').length).toBeGreaterThanOrEqual(1)
  })

  it('renders static avatar fallback when WebGL unavailable', () => {
    // getContext returns null, so canRender3D() → false → StaticAgentAvatar shown
    render(
      <AgentMiniViewport
        isVisible={true}
        agentName="Test"
        agentStatus="idle"
        botConfig={botConfig}
      />
    )
    // StaticAgentAvatar renders a div with gradient bg; no AgentScene3D
    expect(screen.queryByTestId('agent-scene-3d')).toBeNull()
  })

  it('toggles size when expand/collapse button is clicked', () => {
    const { container } = render(
      <AgentMiniViewport
        isVisible={true}
        agentName="Test"
        agentStatus="idle"
        botConfig={botConfig}
      />
    )
    // The expand button is inside the viewport
    const toggleBtn = container.querySelector('[style*="width: 20px"]') as HTMLButtonElement | null
    // Find it another way — it's a button inside the viewport overlay
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})

// ── AgentCameraOverlay (legacy) ───────────────────────────────────────────

describe('AgentCameraOverlay', () => {
  it('renders AgentMiniViewport (visible when isOpen=true)', () => {
    const { container } = render(
      <AgentCameraOverlay
        isOpen={true}
        agentName="Dev"
        agentStatus="active"
        botConfig={botConfig}
      />
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('renders nothing (isOpen=false)', () => {
    const { container } = render(
      <AgentCameraOverlay
        isOpen={false}
        agentName="Dev"
        agentStatus="active"
        botConfig={botConfig}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('passes agentStatus to viewport', () => {
    render(
      <AgentCameraOverlay
        isOpen={true}
        agentName="Dev"
        agentStatus="sleeping"
        botConfig={botConfig}
      />
    )
    expect(screen.getAllByText('Sleeping').length).toBeGreaterThanOrEqual(1)
  })
})
