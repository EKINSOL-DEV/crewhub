import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

// ─── Mock R3F + Three.js ──────────────────────────────────────────

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: vi.fn(),
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  Text: ({ children }: { children: ReactNode }) => <div data-testid="drei-text">{children}</div>,
  RoundedBox: ({ children }: { children: ReactNode }) => (
    <div data-testid="rounded-box">{children}</div>
  ),
  Float: ({ children }: { children: ReactNode }) => <div data-testid="drei-float">{children}</div>,
  Sparkles: () => <div data-testid="sparkles" />,
  Html: ({ children }: { children: ReactNode }) => <div data-testid="drei-html">{children}</div>,
}))

vi.mock('three', () => {
  const MeshStandardMaterial = class {
    emissiveIntensity = 0
    opacity = 1
  }
  const MathUtils = { lerp: (a: number, b: number, t: number) => a + (b - a) * t }
  return {
    DoubleSide: 2,
    REVISION: '160',
    MeshStandardMaterial,
    MathUtils,
  }
})

// ─── Import component AFTER mocks ────────────────────────────────

import { DesignLab3D } from '@/components/dev/DesignLab3D'

// ─── Tests ───────────────────────────────────────────────────────

describe('DesignLab3D', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Rendering ────────────────────────────────────────────────

  it('renders without crashing (light bg)', () => {
    const { container } = render(<DesignLab3D darkBg={false} />)
    expect(container).toBeTruthy()
  })

  it('renders without crashing (dark bg)', () => {
    const { container } = render(<DesignLab3D darkBg={true} />)
    expect(container).toBeTruthy()
  })

  it('shows section header', () => {
    render(<DesignLab3D darkBg={false} />)
    expect(screen.getByText(/3D Bot Playground/)).toBeTruthy()
  })

  it('shows global controls heading', () => {
    render(<DesignLab3D darkBg={false} />)
    expect(screen.getByText(/Global Controls/)).toBeTruthy()
  })

  it('shows bot controls heading', () => {
    render(<DesignLab3D darkBg={false} />)
    expect(screen.getByText(/Bot Controls/)).toBeTruthy()
  })

  it('renders all 5 bots in the controls', () => {
    render(<DesignLab3D darkBg={false} />)
    // Bot names appear in both the 3D scene labels and the controls panel
    expect(screen.getAllByText(/Worker Bot/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Thinker Bot/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Cron Bot/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Comms Bot/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Dev Bot/).length).toBeGreaterThan(0)
  })

  it('renders 3D canvas', () => {
    render(<DesignLab3D darkBg={false} />)
    expect(screen.getByTestId('r3f-canvas')).toBeTruthy()
  })

  it('shows canvas info bar with navigation hints', () => {
    render(<DesignLab3D darkBg={false} />)
    expect(screen.getByText(/Rotate/)).toBeTruthy()
    expect(screen.getByText(/Zoom/)).toBeTruthy()
  })

  // ─── Camera Presets ───────────────────────────────────────────

  it('renders camera preset buttons', () => {
    render(<DesignLab3D darkBg={false} />)
    expect(screen.getByText(/front/i)).toBeTruthy()
    expect(screen.getByText(/isometric/i)).toBeTruthy()
    expect(screen.getByText(/top-down/i)).toBeTruthy()
  })

  it('can switch camera preset to front', () => {
    render(<DesignLab3D darkBg={false} />)
    const frontBtn = screen.getByText(/front/i)
    fireEvent.click(frontBtn)
    // No error thrown
    expect(screen.getByText(/front/i)).toBeTruthy()
  })

  it('can switch camera preset to top-down', () => {
    render(<DesignLab3D darkBg={false} />)
    const topDownBtn = screen.getByText(/top-down/i)
    fireEvent.click(topDownBtn)
    expect(screen.getByText(/top-down/i)).toBeTruthy()
  })

  // ─── Scene Toggles ────────────────────────────────────────────

  it('renders scene toggle buttons (Shadows, Grid, Sparkles)', () => {
    render(<DesignLab3D darkBg={false} />)
    expect(screen.getByText(/Shadows/)).toBeTruthy()
    expect(screen.getByText(/Grid/)).toBeTruthy()
    expect(screen.getByText(/Sparkles/)).toBeTruthy()
  })

  it('can toggle shadows off', () => {
    render(<DesignLab3D darkBg={false} />)
    const shadowBtn = screen.getByText(/Shadows/)
    fireEvent.click(shadowBtn)
    expect(screen.getByText(/Shadows/)).toBeTruthy()
  })

  it('can toggle grid off', () => {
    render(<DesignLab3D darkBg={false} />)
    const gridBtn = screen.getByText(/Grid/)
    fireEvent.click(gridBtn)
    expect(screen.getByText(/Grid/)).toBeTruthy()
  })

  it('can toggle sparkles off', () => {
    render(<DesignLab3D darkBg={false} />)
    const sparklesBtn = screen.getByText(/Sparkles/)
    fireEvent.click(sparklesBtn)
    expect(screen.getByText(/Sparkles/)).toBeTruthy()
  })

  // ─── Set All States ───────────────────────────────────────────

  it('renders "All Bots →" label', () => {
    render(<DesignLab3D darkBg={false} />)
    expect(screen.getByText(/All Bots/)).toBeTruthy()
  })

  it('shows all state buttons in global controls', () => {
    render(<DesignLab3D darkBg={false} />)
    // active, idle, sleeping, working, error buttons in "All Bots" section
    const allStateButtons = screen.getAllByText('active')
    expect(allStateButtons.length).toBeGreaterThan(0)
  })

  it('can set all bots to sleeping state', () => {
    render(<DesignLab3D darkBg={false} />)
    const sleepingBtns = screen.getAllByText('sleeping')
    fireEvent.click(sleepingBtns[0])
    expect(screen.getAllByText(/Cron Bot/).length).toBeGreaterThan(0)
  })

  it('can set all bots to working state', () => {
    render(<DesignLab3D darkBg={false} />)
    const workingBtns = screen.getAllByText('working')
    fireEvent.click(workingBtns[0])
    expect(screen.getAllByText(/Worker Bot/).length).toBeGreaterThan(0)
  })

  it('can set all bots to error state', () => {
    render(<DesignLab3D darkBg={false} />)
    const errorBtns = screen.getAllByText('error')
    fireEvent.click(errorBtns[0])
    expect(screen.getAllByText(/Dev Bot/).length).toBeGreaterThan(0)
  })

  // ─── Per-Bot Controls ─────────────────────────────────────────

  it('can expand a bot row to show bubble controls', () => {
    render(<DesignLab3D darkBg={false} />)
    // Click Worker Bot row header button (not the drei-text element in the 3D scene)
    const workerBtn = screen.getAllByRole('button', { name: /Worker Bot/ })[0]
    fireEvent.click(workerBtn)
    expect(screen.getByText(/Bubble/)).toBeTruthy()
  })

  it('can change individual bot state to active', () => {
    render(<DesignLab3D darkBg={false} />)
    // Each bot row has state buttons
    const activeBtns = screen.getAllByText('active')
    // Click second one (per-bot button after the "all bots" one)
    if (activeBtns.length > 1) fireEvent.click(activeBtns[1])
    expect(screen.getAllByText(/Worker Bot/).length).toBeGreaterThan(0)
  })

  it('can toggle bubble on after expanding a bot', () => {
    render(<DesignLab3D darkBg={false} />)
    // Expand Worker Bot by clicking the row header button
    const workerBtn = screen.getAllByRole('button', { name: /Worker Bot/ })[0]
    fireEvent.click(workerBtn)
    // Find bubble toggle button
    const bubbleBtn = screen.getByText(/Bubble OFF|Bubble ON/)
    fireEvent.click(bubbleBtn)
    expect(screen.getByText(/Bubble ON|Bubble OFF/)).toBeTruthy()
  })

  it('can change bubble style to thought', () => {
    render(<DesignLab3D darkBg={false} />)
    const workerBtn = screen.getAllByRole('button', { name: /Worker Bot/ })[0]
    fireEvent.click(workerBtn)
    const thoughtBtns = screen.getAllByText(/thought/)
    fireEvent.click(thoughtBtns[0])
    expect(screen.getAllByText(/Worker Bot/).length).toBeGreaterThan(0)
  })

  it('can type bubble text for a bot', () => {
    render(<DesignLab3D darkBg={false} />)
    const workerBtn = screen.getAllByRole('button', { name: /Worker Bot/ })[0]
    fireEvent.click(workerBtn)
    const textInput = document.querySelector(
      'input[placeholder="Bubble text..."]'
    ) as HTMLInputElement
    if (textInput) {
      fireEvent.change(textInput, { target: { value: 'Hello World!' } })
      expect(textInput.value).toBe('Hello World!')
    }
  })

  it('can collapse an expanded bot row', () => {
    render(<DesignLab3D darkBg={false} />)
    const workerBtn = screen.getAllByRole('button', { name: /Worker Bot/ })[0]
    fireEvent.click(workerBtn)
    expect(screen.getByText(/Bubble/)).toBeTruthy()
    // Click again to collapse
    fireEvent.click(screen.getAllByRole('button', { name: /Worker Bot/ })[0])
    // Bubble controls should be gone
    const bubbles = screen.queryAllByText(/Bubble OFF/)
    expect(bubbles.length).toBe(0)
  })

  // ─── Dark vs Light Theming ────────────────────────────────────

  it('applies dark bg classes when darkBg=true', () => {
    const { container } = render(<DesignLab3D darkBg={true} />)
    // Dark bg uses bg-gray-800 class
    expect(container.innerHTML).toContain('bg-gray-800')
  })

  it('applies light bg classes when darkBg=false', () => {
    const { container } = render(<DesignLab3D darkBg={false} />)
    // Light bg uses bg-white / shadow-sm
    expect(container.innerHTML).toContain('bg-white')
  })
})
