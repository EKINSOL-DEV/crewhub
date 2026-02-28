/* eslint-disable @typescript-eslint/no-explicit-any, sonarjs/no-duplicate-string */
/**
 * ChatHeader3DAvatar Tests
 * Tests for the 128×72 header avatar strip (3D or static fallback)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatHeader3DAvatar } from '@/components/mobile/ChatHeader3DAvatar'
import type { BotVariantConfig } from '@/components/world3d/utils/botVariants'

// ── Mocks ─────────────────────────────────────────────────────────────────

// Lazy 3D scene — resolved as a named module for lazy() compat
vi.mock('@/components/mobile/ChatHeader3DScene', () => ({
  default: ({ agentStatus, animation }: any) => (
    <div data-testid="chat-header-scene" data-status={agentStatus} data-animation={animation} />
  ),
}))

// ── Helpers ───────────────────────────────────────────────────────────────

const origGetContext = HTMLCanvasElement.prototype.getContext

function disableWebGL() {
  ;(HTMLCanvasElement.prototype as any).getContext = () => null
}

function enableWebGL() {
  ;(HTMLCanvasElement.prototype as any).getContext = () => ({})
}

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

describe('ChatHeader3DAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    ;(HTMLCanvasElement.prototype as any).getContext = origGetContext
  })

  describe('static fallback (no WebGL)', () => {
    beforeEach(() => {
      disableWebGL()
    })

    it('renders static icon when WebGL is not available', () => {
      render(<ChatHeader3DAvatar config={botConfig} agentStatus="idle" icon="🤖" />)
      expect(screen.getByText('🤖')).toBeInTheDocument()
    })

    it('renders custom icon in fallback', () => {
      render(<ChatHeader3DAvatar config={botConfig} agentStatus="active" icon="🧠" />)
      expect(screen.getByText('🧠')).toBeInTheDocument()
    })

    it('does not render 3D scene when WebGL unavailable', () => {
      render(<ChatHeader3DAvatar config={botConfig} agentStatus="idle" icon="🤖" />)
      expect(screen.queryByTestId('chat-header-scene')).toBeNull()
    })
  })

  describe('3D scene (WebGL available)', () => {
    beforeEach(() => {
      enableWebGL()
    })

    it('renders 3D scene via Suspense when WebGL is available', async () => {
      render(<ChatHeader3DAvatar config={botConfig} agentStatus="active" icon="🤖" />)
      // Suspense will eventually resolve the lazy component
      const scene = await screen.findByTestId('chat-header-scene')
      expect(scene).toBeInTheDocument()
    })

    it('passes agentStatus to 3D scene', async () => {
      render(<ChatHeader3DAvatar config={botConfig} agentStatus="sleeping" icon="🤖" />)
      const scene = await screen.findByTestId('chat-header-scene')
      expect(scene).toHaveAttribute('data-status', 'sleeping')
    })

    it('passes animation prop to 3D scene', async () => {
      render(
        <ChatHeader3DAvatar
          config={botConfig}
          agentStatus="active"
          animation="thinking"
          icon="🤖"
        />
      )
      const scene = await screen.findByTestId('chat-header-scene')
      expect(scene).toHaveAttribute('data-animation', 'thinking')
    })

    it('defaults animation to "idle"', async () => {
      render(<ChatHeader3DAvatar config={botConfig} agentStatus="idle" icon="🤖" />)
      const scene = await screen.findByTestId('chat-header-scene')
      expect(scene).toHaveAttribute('data-animation', 'idle')
    })
  })

  describe('container styles', () => {
    beforeEach(() => {
      disableWebGL()
    })

    it('renders a container div', () => {
      const { container } = render(
        <ChatHeader3DAvatar config={botConfig} agentStatus="idle" icon="🤖" />
      )
      const div = container.querySelector('div')
      expect(div).not.toBeNull()
    })

    it('applies style overrides via style prop', () => {
      const { container } = render(
        <ChatHeader3DAvatar
          config={botConfig}
          agentStatus="idle"
          icon="🤖"
          style={{ width: 64, height: 36 }}
        />
      )
      const outer = container.firstChild as HTMLElement
      expect(outer.style.width).toBe('64px')
      expect(outer.style.height).toBe('36px')
    })
  })
})
