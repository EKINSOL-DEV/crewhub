/**
 * RoutingSelector Tests
 * Tests for the broadcast / targeted routing mode toggle in group chats
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RoutingSelector } from '@/components/mobile/group/RoutingSelector'
import type { ThreadParticipant } from '@/lib/threads.api'

// ── Helpers ───────────────────────────────────────────────────────────────

function makeParticipant(
  id: string,
  name: string,
  icon: string | null = null,
  color = '#6366f1'
): ThreadParticipant {
  return {
    id: `p-${id}`,
    agent_id: id,
    agent_name: name,
    agent_icon: icon,
    agent_color: color,
    role: 'member',
    is_active: true,
  }
}

const participants = [
  makeParticipant('dev', 'Dev Agent', '🤖'),
  makeParticipant('main', 'Main Agent', '🧠', '#f59e0b'),
  makeParticipant('flowy', 'Flowy', '🌊', '#06b6d4'),
]

// ── Tests ─────────────────────────────────────────────────────────────────

describe('RoutingSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('mode toggle buttons', () => {
    it('renders "All agents" button', () => {
      render(
        <RoutingSelector
          participants={participants}
          mode="broadcast"
          targetAgentIds={[]}
          onModeChange={vi.fn()}
          onTargetChange={vi.fn()}
        />
      )
      expect(screen.getByText('All agents')).toBeInTheDocument()
    })

    it('renders "Selected" button', () => {
      render(
        <RoutingSelector
          participants={participants}
          mode="broadcast"
          targetAgentIds={[]}
          onModeChange={vi.fn()}
          onTargetChange={vi.fn()}
        />
      )
      expect(screen.getByText('Selected')).toBeInTheDocument()
    })

    it('calls onModeChange("broadcast") when All agents is clicked', () => {
      const onModeChange = vi.fn()
      render(
        <RoutingSelector
          participants={participants}
          mode="targeted"
          targetAgentIds={[]}
          onModeChange={onModeChange}
          onTargetChange={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText('All agents'))
      expect(onModeChange).toHaveBeenCalledWith('broadcast')
    })

    it('calls onModeChange("targeted") when Selected is clicked', () => {
      const onModeChange = vi.fn()
      render(
        <RoutingSelector
          participants={participants}
          mode="broadcast"
          targetAgentIds={[]}
          onModeChange={onModeChange}
          onTargetChange={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText('Selected'))
      expect(onModeChange).toHaveBeenCalledWith('targeted')
    })

    it('highlights All agents button when mode is broadcast', () => {
      render(
        <RoutingSelector
          participants={participants}
          mode="broadcast"
          targetAgentIds={[]}
          onModeChange={vi.fn()}
          onTargetChange={vi.fn()}
        />
      )
      const allBtn = screen.getByText('All agents').closest('button')!
      // JSDOM converts hex #6366f1 → rgb(99, 102, 241)
      expect(allBtn.style.background).toBe('rgb(99, 102, 241)')
    })

    it('highlights Selected button when mode is targeted', () => {
      render(
        <RoutingSelector
          participants={participants}
          mode="targeted"
          targetAgentIds={[]}
          onModeChange={vi.fn()}
          onTargetChange={vi.fn()}
        />
      )
      const selBtn = screen.getByText('Selected').closest('button')!
      expect(selBtn.style.background).toBe('rgb(99, 102, 241)')
    })
  })

  describe('target agent chips (targeted mode)', () => {
    it('shows agent chips when mode=targeted and Selected is clicked', () => {
      // Chips render only when mode === 'targeted' AND showTargets === true
      // showTargets becomes true after clicking "Selected"
      render(
        <RoutingSelector
          participants={participants}
          mode="targeted"
          targetAgentIds={[]}
          onModeChange={vi.fn()}
          onTargetChange={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText('Selected'))
      // Each chip renders "{icon} {name}" — look for partial matches
      expect(screen.getByText(/Dev Agent/)).toBeInTheDocument()
      expect(screen.getByText(/Main Agent/)).toBeInTheDocument()
    })

    it('does not show chips in broadcast mode', () => {
      render(
        <RoutingSelector
          participants={participants}
          mode="broadcast"
          targetAgentIds={[]}
          onModeChange={vi.fn()}
          onTargetChange={vi.fn()}
        />
      )
      // No chips because mode != 'targeted'
      expect(screen.queryByText(/Dev Agent/)).not.toBeInTheDocument()
    })

    it('calls onTargetChange to add agent when chip is clicked (not selected)', () => {
      const onTargetChange = vi.fn()
      render(
        <RoutingSelector
          participants={participants}
          mode="targeted"
          targetAgentIds={[]}
          onModeChange={vi.fn()}
          onTargetChange={onTargetChange}
        />
      )
      fireEvent.click(screen.getByText('Selected'))
      // Click chip for Dev Agent
      fireEvent.click(screen.getByText(/Dev Agent/))
      expect(onTargetChange).toHaveBeenCalledWith(['dev'])
    })

    it('calls onTargetChange to remove agent when selected chip is clicked', () => {
      const onTargetChange = vi.fn()
      render(
        <RoutingSelector
          participants={participants}
          mode="targeted"
          targetAgentIds={['dev', 'main']}
          onModeChange={vi.fn()}
          onTargetChange={onTargetChange}
        />
      )
      fireEvent.click(screen.getByText('Selected'))
      // Dev Agent chip is selected — clicking removes it
      fireEvent.click(screen.getByText(/Dev Agent/))
      expect(onTargetChange).toHaveBeenCalledWith(['main'])
    })

    it('hides chips when switching from targeted back to broadcast', () => {
      render(
        <RoutingSelector
          participants={participants}
          mode="targeted"
          targetAgentIds={[]}
          onModeChange={vi.fn()}
          onTargetChange={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText('Selected'))
      expect(screen.getByText(/Dev Agent/)).toBeInTheDocument()

      // Click All agents — sets showTargets=false
      fireEvent.click(screen.getByText('All agents'))
      expect(screen.queryByText(/Dev Agent/)).not.toBeInTheDocument()
    })

    it('renders participant without icon using whitespace-trimmed name', () => {
      const noIconParticipants = [makeParticipant('dev', 'Dev Agent', null)]
      render(
        <RoutingSelector
          participants={noIconParticipants}
          mode="targeted"
          targetAgentIds={[]}
          onModeChange={vi.fn()}
          onTargetChange={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText('Selected'))
      // When no icon: renders '' + ' ' + 'Dev Agent' = ' Dev Agent'
      // Testing Library normalizes whitespace so query with regex
      expect(screen.getByText(/Dev Agent/)).toBeInTheDocument()
    })
  })
})
