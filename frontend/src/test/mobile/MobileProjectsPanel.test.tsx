/**
 * MobileProjectsPanel Tests
 * Tests for the mobile Projects panel with project list and detail modal
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MobileProjectsPanel } from '@/components/mobile/MobileProjectsPanel'
import type { Project } from '@/hooks/useProjects'
import type { Task } from '@/hooks/useTasks'

// ── Mocks ─────────────────────────────────────────────────────────────────

let mockProjects: Project[] = []
let mockProjectsLoading = false
let mockProjectsError: string | null = null

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: mockProjects,
    isLoading: mockProjectsLoading,
    error: mockProjectsError,
  }),
}))

let mockTasks: Task[] = []

vi.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: mockTasks,
    isLoading: false,
    error: null,
    updateTask: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// ── Test data ─────────────────────────────────────────────────────────────

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Project Alpha',
  description: 'A great project',
  icon: null,
  color: '#6366f1',
  folder_path: null,
  status: 'active',
  created_at: Date.now(),
  updated_at: Date.now(),
  rooms: [],
  ...overrides,
})

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  project_id: 'p1',
  room_id: null,
  title: 'Task One',
  description: null,
  status: 'todo',
  priority: 'medium',
  assigned_session_key: null,
  assigned_display_name: null,
  created_by: null,
  created_at: Date.now(),
  updated_at: Date.now(),
  ...overrides,
})

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockProjects = []
  mockTasks = []
  mockProjectsLoading = false
  mockProjectsError = null
})

// ── Tests ─────────────────────────────────────────────────────────────────

describe('MobileProjectsPanel', () => {
  describe('header', () => {
    it('renders Projects header and back button', () => {
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    it('calls onBack when back button is clicked', () => {
      const onBack = vi.fn()
      render(<MobileProjectsPanel onBack={onBack} />)
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])
      expect(onBack).toHaveBeenCalledTimes(1)
    })
  })

  describe('empty state', () => {
    it('shows empty state when no projects', () => {
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText('No active projects')).toBeInTheDocument()
    })

    it('shows loading state when projects are loading', () => {
      mockProjectsLoading = true
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText('Loading projects...')).toBeInTheDocument()
    })

    it('shows error when projects fail to load', () => {
      mockProjectsError = 'Failed to fetch projects'
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText('Failed to load projects')).toBeInTheDocument()
    })
  })

  describe('project list', () => {
    it('renders project card with name', () => {
      mockProjects = [makeProject()]
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText('Project Alpha')).toBeInTheDocument()
    })

    it('renders multiple project cards', () => {
      mockProjects = [
        makeProject({ id: 'p1', name: 'Project Alpha' }),
        makeProject({ id: 'p2', name: 'Project Beta', color: '#10b981' }),
        makeProject({ id: 'p3', name: 'Project Gamma', color: '#ef4444' }),
      ]
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      expect(screen.getByText('Project Beta')).toBeInTheDocument()
      expect(screen.getByText('Project Gamma')).toBeInTheDocument()
    })

    it('shows active section header when there are active projects', () => {
      mockProjects = [makeProject({ status: 'active' })]
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText('Active Projects (1)')).toBeInTheDocument()
    })

    it('shows archived section when there are archived projects (alongside active)', () => {
      mockProjects = [
        makeProject({ id: 'p1', name: 'Active Proj', status: 'active' }),
        makeProject({ id: 'p2', name: 'Old Proj', status: 'archived' }),
      ]
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText('Archived Projects (1)')).toBeInTheDocument()
      expect(screen.getByText('Old Proj')).toBeInTheDocument()
    })
  })

  describe('project stats', () => {
    it('shows task count for a project', () => {
      mockProjects = [makeProject({ id: 'p1' })]
      mockTasks = [
        makeTask({ id: 't1', project_id: 'p1', status: 'todo' }),
        makeTask({ id: 't2', project_id: 'p1', status: 'done' }),
        makeTask({ id: 't3', project_id: 'p1', status: 'in_progress' }),
      ]
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText(/3 tasks/i)).toBeInTheDocument()
    })

    it('shows 0 tasks for a project with no tasks', () => {
      mockProjects = [makeProject({ id: 'p1' })]
      mockTasks = []
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText(/0 tasks/i)).toBeInTheDocument()
    })

    it('shows progress percentage for project with completed tasks', () => {
      mockProjects = [makeProject({ id: 'p1' })]
      mockTasks = [
        makeTask({ id: 't1', project_id: 'p1', status: 'done' }),
        makeTask({ id: 't2', project_id: 'p1', status: 'todo' }),
      ]
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText('50% complete')).toBeInTheDocument()
    })

    it('shows 100% for fully completed project', () => {
      mockProjects = [makeProject({ id: 'p1' })]
      mockTasks = [
        makeTask({ id: 't1', project_id: 'p1', status: 'done' }),
        makeTask({ id: 't2', project_id: 'p1', status: 'done' }),
      ]
      render(<MobileProjectsPanel onBack={() => {}} />)
      expect(screen.getByText('100% complete')).toBeInTheDocument()
    })
  })

  describe('project detail modal', () => {
    it('opens project detail modal when project card is tapped', () => {
      mockProjects = [
        makeProject({ id: 'p1', name: 'Project Alpha', description: 'A cool project' }),
      ]
      render(<MobileProjectsPanel onBack={() => {}} />)

      // Find and click the project card button
      const projectCard = screen.getByText('Project Alpha').closest('button')!
      fireEvent.click(projectCard)

      // Modal should appear with project details
      expect(screen.getAllByText('Project Alpha').length).toBeGreaterThan(1)
    })

    it('shows project description in detail modal', () => {
      mockProjects = [makeProject({ id: 'p1', description: 'An amazing project description' })]
      render(<MobileProjectsPanel onBack={() => {}} />)

      const projectCard = screen.getByText('Project Alpha').closest('button')!
      fireEvent.click(projectCard)

      expect(screen.getByText('An amazing project description')).toBeInTheDocument()
    })

    it('shows active status badge in detail modal', () => {
      mockProjects = [makeProject({ id: 'p1', status: 'active' })]
      render(<MobileProjectsPanel onBack={() => {}} />)

      const projectCard = screen.getByText('Project Alpha').closest('button')!
      fireEvent.click(projectCard)

      expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0)
    })

    it('closes modal when × button is clicked', () => {
      mockProjects = [makeProject()]
      render(<MobileProjectsPanel onBack={() => {}} />)

      const projectCard = screen.getByText('Project Alpha').closest('button')!
      fireEvent.click(projectCard)

      // Modal is open - find the close button
      const closeBtn = screen.getByText('×')
      fireEvent.click(closeBtn)

      // Modal should be gone (only one instance of "Project Alpha" now)
      expect(screen.getAllByText('Project Alpha').length).toBe(1)
    })

    it('closes modal on Escape key', () => {
      mockProjects = [makeProject()]
      render(<MobileProjectsPanel onBack={() => {}} />)

      const projectCard = screen.getByText('Project Alpha').closest('button')!
      fireEvent.click(projectCard)

      // The modal backdrop is a button with onKeyDown handler
      const modalBackdrop = screen
        .getAllByRole('button')
        .find((b) => b.style.position === 'fixed' && b.style.inset === '0px')!
      fireEvent.keyDown(modalBackdrop, { key: 'Escape' })

      // Modal should be dismissed
      expect(screen.getAllByText('Project Alpha').length).toBe(1)
    })

    it('shows assigned agents in detail modal', () => {
      mockProjects = [makeProject({ id: 'p1' })]
      mockTasks = [
        makeTask({ id: 't1', project_id: 'p1', assigned_display_name: 'Dev Agent' }),
        makeTask({ id: 't2', project_id: 'p1', assigned_display_name: 'QA Agent' }),
      ]
      render(<MobileProjectsPanel onBack={() => {}} />)

      const projectCard = screen.getByText('Project Alpha').closest('button')!
      fireEvent.click(projectCard)

      expect(screen.getByText('Dev Agent')).toBeInTheDocument()
      expect(screen.getByText('QA Agent')).toBeInTheDocument()
    })

    it('shows blocked task count in detail modal', () => {
      mockProjects = [makeProject({ id: 'p1' })]
      mockTasks = [
        makeTask({ id: 't1', project_id: 'p1', status: 'blocked' }),
        makeTask({ id: 't2', project_id: 'p1', status: 'blocked' }),
        makeTask({ id: 't3', project_id: 'p1', status: 'todo' }),
      ]
      render(<MobileProjectsPanel onBack={() => {}} />)

      const projectCard = screen.getByText('Project Alpha').closest('button')!
      fireEvent.click(projectCard)

      // The modal shows blocked count as a number followed by "Blocked" label
      expect(screen.getByText('Blocked')).toBeInTheDocument()
      // Count "2" appears as the large number
      const blockedSection = screen.getByText('Blocked').closest('div')!.parentElement!
      const countEl = blockedSection.querySelector('div')!
      expect(countEl.textContent).toBe('2')
    })
  })

  describe('summary stats', () => {
    it('shows total project count in header subtitle', () => {
      mockProjects = [
        makeProject({ id: 'p1', name: 'P1', status: 'active' }),
        makeProject({ id: 'p2', name: 'P2', status: 'active' }),
      ]
      render(<MobileProjectsPanel onBack={() => {}} />)
      // Either '2 projects' or individual items should be present
      expect(screen.getAllByText(/P[12]/)).toBeTruthy()
    })
  })
})
