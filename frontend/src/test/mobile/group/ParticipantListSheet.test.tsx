/**
 * ParticipantListSheet Tests
 * Tests for the bottom-sheet that lists thread participants and allows removal/adding
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ParticipantListSheet } from '@/components/mobile/group/ParticipantListSheet'
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

const defaultProps = {
  participants: [] as ThreadParticipant[],
  threadTitle: 'Team Chat',
  onClose: vi.fn(),
  onRemoveParticipant: vi.fn(),
  onAddParticipants: vi.fn(),
  onRename: vi.fn(),
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ParticipantListSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('header', () => {
    it('shows participant count in header', () => {
      const participants = [
        makeParticipant({ id: 'p1', agent_id: 'dev', agent_name: 'Dev' }),
        makeParticipant({ id: 'p2', agent_id: 'main', agent_name: 'Main' }),
      ]
      render(<ParticipantListSheet {...defaultProps} participants={participants} />)
      expect(screen.getByText('Participants (2)')).toBeInTheDocument()
    })

    it('shows 0 when no participants', () => {
      render(<ParticipantListSheet {...defaultProps} participants={[]} />)
      expect(screen.getByText('Participants (0)')).toBeInTheDocument()
    })
  })

  describe('participant list', () => {
    it('renders participant names', () => {
      const participants = [makeParticipant({ agent_name: 'Dev Agent', agent_icon: '🤖' })]
      render(<ParticipantListSheet {...defaultProps} participants={participants} />)
      expect(screen.getByText('Dev Agent')).toBeInTheDocument()
    })

    it('shows role: Member for non-owner participants', () => {
      const participants = [makeParticipant({ role: 'member' })]
      render(<ParticipantListSheet {...defaultProps} participants={participants} />)
      expect(screen.getByText('Member')).toBeInTheDocument()
    })

    it('shows role: Owner for owner participants', () => {
      const participants = [makeParticipant({ role: 'owner' })]
      render(<ParticipantListSheet {...defaultProps} participants={participants} />)
      expect(screen.getByText('Owner')).toBeInTheDocument()
    })

    it('renders agent icon when set', () => {
      const participants = [makeParticipant({ agent_icon: '🧠', agent_name: 'Main' })]
      render(<ParticipantListSheet {...defaultProps} participants={participants} />)
      expect(screen.getByText('🧠')).toBeInTheDocument()
    })

    it('falls back to first letter of name when no icon', () => {
      const participants = [makeParticipant({ agent_icon: null as any, agent_name: 'Flowy' })]
      render(<ParticipantListSheet {...defaultProps} participants={participants} />)
      expect(screen.getByText('F')).toBeInTheDocument()
    })
  })

  describe('remove participant button', () => {
    it('shows remove button for non-owner participants', () => {
      const participants = [makeParticipant({ role: 'member' })]
      const { container } = render(
        <ParticipantListSheet {...defaultProps} participants={participants} />
      )
      // JSDOM formats rgba with spaces: "rgba(239, 68, 68, 0.1)"
      const removeBtns = container.querySelectorAll('button[style*="rgba(239, 68, 68"]')
      expect(removeBtns.length).toBeGreaterThan(0)
    })

    it('calls onRemoveParticipant with agent_id when remove is clicked', () => {
      const onRemoveParticipant = vi.fn()
      const participants = [makeParticipant({ agent_id: 'dev', role: 'member' })]
      const { container } = render(
        <ParticipantListSheet
          {...defaultProps}
          participants={participants}
          onRemoveParticipant={onRemoveParticipant}
        />
      )
      // JSDOM formats rgba with spaces
      const removeBtn = container.querySelector(
        'button[style*="rgba(239, 68, 68"]'
      ) as HTMLButtonElement
      fireEvent.click(removeBtn)
      expect(onRemoveParticipant).toHaveBeenCalledWith('dev')
    })

    it('does NOT show remove button for owner', () => {
      const participants = [makeParticipant({ role: 'owner' })]
      const { container } = render(
        <ParticipantListSheet {...defaultProps} participants={participants} />
      )
      const removeBtns = container.querySelectorAll('button[style*="rgba(239, 68, 68"]')
      expect(removeBtns.length).toBe(0)
    })
  })

  describe('header action buttons', () => {
    it('calls onRename when rename button is clicked', () => {
      const onRename = vi.fn()
      render(<ParticipantListSheet {...defaultProps} onRename={onRename} />)
      // All buttons: backdrop, rename, add
      const buttons = screen.getAllByRole('button')
      // First button is the backdrop, rename is second, add is third
      fireEvent.click(buttons[1])
      expect(onRename).toHaveBeenCalledTimes(1)
    })

    it('calls onAddParticipants when add button is clicked', () => {
      const onAddParticipants = vi.fn()
      render(<ParticipantListSheet {...defaultProps} onAddParticipants={onAddParticipants} />)
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[2])
      expect(onAddParticipants).toHaveBeenCalledTimes(1)
    })
  })

  describe('close behaviour', () => {
    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn()
      const { container } = render(<ParticipantListSheet {...defaultProps} onClose={onClose} />)
      // The outermost button IS the backdrop
      const backdrop = container.querySelector('button[style*="inset: 0"]') as HTMLElement
      // Simulate click on backdrop (target === currentTarget)
      fireEvent.click(backdrop)
      // Note: the handler checks if target === currentTarget; fireEvent.click
      // on the button itself does satisfy this in JSDOM
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose on Escape keydown', () => {
      const onClose = vi.fn()
      render(<ParticipantListSheet {...defaultProps} onClose={onClose} />)
      fireEvent.keyDown(screen.getAllByRole('button')[0], { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})
