/* eslint-disable @typescript-eslint/no-explicit-any, sonarjs/no-duplicate-string */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ─── Mocks ───────────────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon" />
  )
  return {
    Search: Icon,
    Zap: Icon,
    Cable: Icon,
    Sparkles: Icon,
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className }: any) => (
    <button onClick={onClick} data-variant={variant} data-size={size} className={className}>
      {children}
    </button>
  ),
}))

import { StepWelcome } from '@/components/onboarding/steps/StepWelcome'

// ─── Tests ───────────────────────────────────────────────────────

describe('StepWelcome', () => {
  function renderWelcome(overrides?: Record<string, any>) {
    const onScan = vi.fn()
    const onDemo = vi.fn()
    const onManual = vi.fn()
    const onOpenClawWizard = vi.fn()
    render(
      <StepWelcome
        onScan={onScan}
        onDemo={onDemo}
        onManual={onManual}
        onOpenClawWizard={onOpenClawWizard}
        {...overrides}
      />
    )
    return { onScan, onDemo, onManual, onOpenClawWizard }
  }

  // ─── Rendering ──────────────────────────────────────────────

  it('renders the main heading', () => {
    renderWelcome()
    expect(screen.getByText('Welcome to CrewHub')).toBeTruthy()
  })

  it('renders the subtitle', () => {
    renderWelcome()
    expect(screen.getByText(/Monitor and orchestrate/)).toBeTruthy()
  })

  it('renders Connect to OpenClaw button', () => {
    renderWelcome()
    expect(screen.getByText('Connect to OpenClaw')).toBeTruthy()
  })

  it('renders Auto-scan button', () => {
    renderWelcome()
    expect(screen.getByText('Auto-scan for agents')).toBeTruthy()
  })

  it('renders Demo mode button', () => {
    renderWelcome()
    expect(screen.getByText('Demo mode')).toBeTruthy()
  })

  it('renders Manual setup button', () => {
    renderWelcome()
    expect(screen.getByText('Manual setup')).toBeTruthy()
  })

  it('shows the disclaimer text about LAN scanning', () => {
    renderWelcome()
    expect(screen.getByText(/LAN scanning requires permission/)).toBeTruthy()
  })

  it('renders the CrewHub logo img', () => {
    renderWelcome()
    const img = document.querySelector('img[alt="CrewHub"]')
    expect(img).toBeTruthy()
  })

  // ─── Click Handlers ──────────────────────────────────────────

  it('calls onOpenClawWizard when Connect to OpenClaw is clicked', () => {
    const { onOpenClawWizard } = renderWelcome()
    fireEvent.click(screen.getByText('Connect to OpenClaw'))
    expect(onOpenClawWizard).toHaveBeenCalledOnce()
  })

  it('calls onScan when Auto-scan is clicked', () => {
    const { onScan } = renderWelcome()
    fireEvent.click(screen.getByText('Auto-scan for agents'))
    expect(onScan).toHaveBeenCalledOnce()
  })

  it('calls onDemo when Demo mode is clicked', () => {
    const { onDemo } = renderWelcome()
    fireEvent.click(screen.getByText('Demo mode'))
    expect(onDemo).toHaveBeenCalledOnce()
  })

  it('calls onManual when Manual setup is clicked', () => {
    const { onManual } = renderWelcome()
    fireEvent.click(screen.getByText('Manual setup'))
    expect(onManual).toHaveBeenCalledOnce()
  })

  it('does not call other handlers when one is clicked', () => {
    const { onScan, onDemo, onManual } = renderWelcome()
    fireEvent.click(screen.getByText('Connect to OpenClaw'))
    expect(onScan).not.toHaveBeenCalled()
    expect(onDemo).not.toHaveBeenCalled()
    expect(onManual).not.toHaveBeenCalled()
  })
})
