/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * MobileDrawer Tests
 * Tests for the slide-in left-side navigation drawer
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MobileDrawer } from '@/components/mobile/MobileDrawer'
import type { MobilePanel } from '@/components/mobile/MobileDrawer'

// ── Helpers ───────────────────────────────────────────────────────────────

function renderDrawer(
  overrides: Partial<{
    open: boolean
    currentPanel: MobilePanel
    onClose: () => void
    onNavigate: (p: MobilePanel) => void
  }> = {}
) {
  const onClose = vi.fn()
  const onNavigate = vi.fn()
  render(
    <MobileDrawer
      open={overrides.open ?? true}
      onClose={overrides.onClose ?? onClose}
      onNavigate={overrides.onNavigate ?? onNavigate}
      currentPanel={overrides.currentPanel ?? 'chat'}
    />
  )
  return { onClose, onNavigate }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('MobileDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
  })

  describe('rendering', () => {
    it('renders CrewHub brand title', () => {
      renderDrawer()
      expect(screen.getByText('CrewHub')).toBeInTheDocument()
    })

    it('renders all enabled navigation items', () => {
      renderDrawer()
      expect(screen.getByText('Chat')).toBeInTheDocument()
      expect(screen.getByText('Docs')).toBeInTheDocument()
      expect(screen.getByText('Kanban')).toBeInTheDocument()
      expect(screen.getByText('Activity')).toBeInTheDocument()
      expect(screen.getByText('Projects')).toBeInTheDocument()
      expect(screen.getByText('Prop Maker')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('renders "Soon" badge for disabled items (Tasks)', () => {
      renderDrawer()
      expect(screen.getByText('Tasks')).toBeInTheDocument()
      expect(screen.getByText('Soon')).toBeInTheDocument()
    })

    it('renders section header for Creator section', () => {
      renderDrawer()
      expect(screen.getByText('Creator')).toBeInTheDocument()
    })

    it('renders footer text', () => {
      renderDrawer()
      expect(screen.getByText('CrewHub Mobile')).toBeInTheDocument()
    })

    it('translates drawer offscreen when closed', () => {
      const { container } = render(
        <MobileDrawer open={false} onClose={vi.fn()} onNavigate={vi.fn()} currentPanel="chat" />
      )
      // Find the drawer div (not the backdrop button)
      const drawer = container.querySelector('[style*="translateX(-100%)"]')
      expect(drawer).not.toBeNull()
    })

    it('shows drawer in view when open', () => {
      const { container } = render(
        <MobileDrawer open={true} onClose={vi.fn()} onNavigate={vi.fn()} currentPanel="chat" />
      )
      const drawer = container.querySelector('[style*="translateX(0)"]')
      expect(drawer).not.toBeNull()
    })
  })

  describe('active item highlight', () => {
    it('highlights the currently active panel', () => {
      renderDrawer({ currentPanel: 'kanban' })
      // Kanban button should have the active background style (JSDOM formats with spaces)
      const kanbanBtn = screen.getByText('Kanban').closest('button')!
      expect(kanbanBtn.style.background).toContain('rgba(99, 102, 241')
    })

    it('does not highlight other panels when kanban is active', () => {
      renderDrawer({ currentPanel: 'kanban' })
      const chatBtn = screen.getByText('Chat').closest('button')!
      expect(chatBtn.style.background).toBe('transparent')
    })
  })

  describe('navigation', () => {
    it('calls onNavigate and onClose when an enabled item is clicked', () => {
      const onClose = vi.fn()
      const onNavigate = vi.fn()
      renderDrawer({ onClose, onNavigate })

      fireEvent.click(screen.getByText('Docs'))
      expect(onNavigate).toHaveBeenCalledWith('docs')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onNavigate with "activity" when Activity is clicked', () => {
      const onNavigate = vi.fn()
      renderDrawer({ onNavigate })
      fireEvent.click(screen.getByText('Activity'))
      expect(onNavigate).toHaveBeenCalledWith('activity')
    })

    it('calls onNavigate with "projects" when Projects is clicked', () => {
      const onNavigate = vi.fn()
      renderDrawer({ onNavigate })
      fireEvent.click(screen.getByText('Projects'))
      expect(onNavigate).toHaveBeenCalledWith('projects')
    })

    it('calls onNavigate with "creator" when Prop Maker is clicked', () => {
      const onNavigate = vi.fn()
      renderDrawer({ onNavigate })
      fireEvent.click(screen.getByText('Prop Maker'))
      expect(onNavigate).toHaveBeenCalledWith('creator')
    })

    it('does NOT call onNavigate for disabled items (Tasks)', () => {
      const onNavigate = vi.fn()
      renderDrawer({ onNavigate })
      fireEvent.click(screen.getByText('Tasks'))
      expect(onNavigate).not.toHaveBeenCalled()
    })
  })

  describe('close behaviour', () => {
    it('calls onClose when X button is clicked', () => {
      const onClose = vi.fn()
      renderDrawer({ onClose })
      const xBtn = screen
        .getAllByRole('button')
        .find((b) => b.querySelector('svg[class*="lucide-x"]') !== null)
      // The X button is the close button in drawer header — find by its position
      // There are: backdrop-button, close-button, menu-items...
      // Close button is small, in header
      const allBtns = screen.getAllByRole('button')
      // backdrop is first, close is second
      fireEvent.click(allBtns[1])
      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when Escape key is pressed (when open)', () => {
      const onClose = vi.fn()
      renderDrawer({ onClose, open: true })
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does NOT call onClose on Escape when drawer is closed', () => {
      const onClose = vi.fn()
      renderDrawer({ onClose, open: false })
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).not.toHaveBeenCalled()
    })

    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn()
      renderDrawer({ onClose })
      // Backdrop is a button with the overlay style; it is the first button
      const backdrop = screen.getAllByRole('button')[0]
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('body scroll lock', () => {
    it('locks body scroll when open', () => {
      renderDrawer({ open: true })
      expect(document.body.style.overflow).toBe('hidden')
    })
  })
})
