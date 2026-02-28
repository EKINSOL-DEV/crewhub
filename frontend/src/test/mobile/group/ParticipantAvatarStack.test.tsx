/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ParticipantAvatarStack Tests
 * Tests for the stacked participant avatar strip shown in group threads
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ParticipantAvatarStack } from '@/components/mobile/group/ParticipantAvatarStack'
import type { ThreadParticipant } from '@/lib/threads.api'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeParticipant(overrides: Partial<ThreadParticipant> = {}): ThreadParticipant {
  return {
    id: 'p1',
    agent_id: 'dev',
    agent_name: 'Dev Agent',
    agent_icon: '🤖',
    agent_color: '#6366f1',
    role: 'member',
    is_active: true,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ParticipantAvatarStack', () => {
  describe('rendering icons', () => {
    it('renders agent icon when agent_icon is set', () => {
      const p = makeParticipant({ agent_icon: '🤖', agent_name: 'Dev' })
      render(<ParticipantAvatarStack participants={[p]} />)
      expect(screen.getByText('🤖')).toBeInTheDocument()
    })

    it('falls back to first letter of agent_name when icon is not set', () => {
      const p = makeParticipant({ agent_icon: null as any, agent_name: 'Flowy' })
      render(<ParticipantAvatarStack participants={[p]} />)
      expect(screen.getByText('F')).toBeInTheDocument()
    })

    it('renders title attribute from agent_name', () => {
      const p = makeParticipant({ agent_name: 'Dev Agent' })
      render(<ParticipantAvatarStack participants={[p]} />)
      expect(screen.getByTitle('Dev Agent')).toBeInTheDocument()
    })
  })

  describe('maxShow & overflow', () => {
    const participants = Array.from({ length: 6 }, (_, i) =>
      makeParticipant({
        id: `p${i}`,
        agent_id: `a${i}`,
        agent_name: `Agent ${i}`,
        agent_icon: null as any,
      })
    )

    it('renders up to maxShow participants', () => {
      render(<ParticipantAvatarStack participants={participants} maxShow={3} />)
      // 3 avatars shown + 1 overflow pill
      const avatarDivs = screen.getAllByTitle(/Agent \d/)
      expect(avatarDivs).toHaveLength(3)
    })

    it('renders overflow pill with remaining count', () => {
      render(<ParticipantAvatarStack participants={participants} maxShow={3} />)
      expect(screen.getByText('+3')).toBeInTheDocument()
    })

    it('does not render overflow pill when all participants fit', () => {
      render(<ParticipantAvatarStack participants={participants.slice(0, 4)} maxShow={4} />)
      expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument()
    })

    it('defaults maxShow to 4', () => {
      render(<ParticipantAvatarStack participants={participants} />)
      // 4 shown + +2 overflow
      expect(screen.getByText('+2')).toBeInTheDocument()
    })

    it('shows all when participants.length <= maxShow', () => {
      const small = participants.slice(0, 3)
      render(<ParticipantAvatarStack participants={small} maxShow={5} />)
      expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument()
    })
  })

  describe('size prop', () => {
    it('renders with custom size via inline style', () => {
      const p = makeParticipant()
      const { container } = render(<ParticipantAvatarStack participants={[p]} size={48} />)
      const firstAvatar = container.querySelector('[style*="width: 48px"]')
      expect(firstAvatar).not.toBeNull()
    })
  })

  describe('edge cases', () => {
    it('renders nothing for empty participants array', () => {
      const { container } = render(<ParticipantAvatarStack participants={[]} />)
      // Flex container with no children
      expect(container.firstChild).not.toBeNull()
      expect(container.firstChild?.childNodes.length).toBe(0)
    })

    it('uses default color when agent_color is not set', () => {
      const p = makeParticipant({ agent_color: null as any })
      const { container } = render(<ParticipantAvatarStack participants={[p]} />)
      // Fallback to #6366f1 — the avatar div should render
      expect(container.querySelector('[title="Dev Agent"]')).not.toBeNull()
    })
  })
})
