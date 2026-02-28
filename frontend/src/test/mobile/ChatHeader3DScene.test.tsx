/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, sonarjs/no-duplicate-string */
/**
 * ChatHeader3DScene Tests
 * Tests for the Three.js scene rendered inside the chat header avatar strip
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChatHeader3DScene from '@/components/mobile/ChatHeader3DScene'
import type { BotVariantConfig } from '@/components/world3d/utils/botVariants'

// ── R3F + Three.js Mocks ──────────────────────────────────────────────────

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, dpr, gl, frameloop, style }: any) => (
    <div
      data-testid="r3f-canvas"
      data-dpr={JSON.stringify(dpr)}
      data-frameloop={frameloop}
      style={style}
    >
      {children}
    </div>
  ),
  useFrame: (_cb: any) => {},
}))

vi.mock('@react-three/drei', () => ({
  RoundedBox: ({ children, args }: any) => (
    <div data-testid="rounded-box" data-args={JSON.stringify(args)}>
      {children}
    </div>
  ),
  PerspectiveCamera: ({ fov, position }: any) => (
    <div data-testid="perspective-camera" data-fov={fov} data-position={JSON.stringify(position)} />
  ),
}))

vi.mock('three', () => ({
  DoubleSide: 2,
  Color: class {
    private v: string
    constructor(v: string) {
      this.v = v
    }
    multiplyScalar() {
      return this
    }
    getHexString() {
      return '6366f1'
    }
  },
}))

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

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ChatHeader3DScene', () => {
  describe('scene setup', () => {
    it('renders an R3F Canvas', () => {
      render(<ChatHeader3DScene botConfig={botConfig} agentStatus="idle" />)
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
    })

    it('sets frameloop to "always"', () => {
      render(<ChatHeader3DScene botConfig={botConfig} agentStatus="idle" />)
      expect(screen.getByTestId('r3f-canvas')).toHaveAttribute('data-frameloop', 'always')
    })

    it('renders a PerspectiveCamera with fov=50', () => {
      render(<ChatHeader3DScene botConfig={botConfig} agentStatus="idle" />)
      expect(screen.getByTestId('perspective-camera')).toHaveAttribute('data-fov', '50')
    })

    it('places camera at Z=0.65', () => {
      render(<ChatHeader3DScene botConfig={botConfig} agentStatus="idle" />)
      const cam = screen.getByTestId('perspective-camera')
      const pos = JSON.parse(cam.getAttribute('data-position')!)
      expect(pos[2]).toBeCloseTo(0.65)
    })

    it('renders RoundedBox elements (bot head / body / etc)', () => {
      render(<ChatHeader3DScene botConfig={botConfig} agentStatus="idle" />)
      expect(screen.getAllByTestId('rounded-box').length).toBeGreaterThan(0)
    })
  })

  describe('animation prop', () => {
    it('renders with default idle animation', () => {
      // No crash expected
      render(<ChatHeader3DScene botConfig={botConfig} agentStatus="idle" />)
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
    })

    it('renders with thinking animation', () => {
      render(<ChatHeader3DScene botConfig={botConfig} agentStatus="active" animation="thinking" />)
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
    })

    it('renders with talking animation', () => {
      render(<ChatHeader3DScene botConfig={botConfig} agentStatus="active" animation="talking" />)
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
    })
  })

  describe('agent status variants', () => {
    it('renders for active status', () => {
      render(<ChatHeader3DScene botConfig={botConfig} agentStatus="active" />)
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
    })

    it('renders for sleeping status', () => {
      render(<ChatHeader3DScene botConfig={botConfig} agentStatus="sleeping" />)
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
    })

    it('renders for idle status', () => {
      render(<ChatHeader3DScene botConfig={botConfig} agentStatus="idle" />)
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
    })
  })

  describe('bot config colours', () => {
    it('renders with a different bot color without crashing', () => {
      const customConfig = { ...botConfig, color: '#ec4899' }
      render(<ChatHeader3DScene botConfig={customConfig} agentStatus="idle" />)
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
    })
  })
})
