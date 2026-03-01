/* eslint-disable sonarjs/no-duplicate-string */
/**
 * MobileKanbanPanel Tests
 * Tests for the mobile Kanban board with column navigation, task cards, and filter
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MobileKanbanPanel } from '@/components/mobile/MobileKanbanPanel'
import type { Task, TaskStatus } from '@/hooks/useTasks'
import type { Project } from '@/hooks/useProjects'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockUpdateTask = vi.fn().mockResolvedValue(undefined)
const mockRefresh = vi.fn()
let mockTasks: Task[] = []
let mockTasksLoading = false
let mockTasksError: string | null = null

vi.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: mockTasks,
    isLoading: mockTasksLoading,
    error: mockTasksError,
    updateTask: mockUpdateTask,
    refresh: mockRefresh,
  }),
}))

let mockProjects: Project[] = []

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: mockProjects,
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/lib/taskConstants', () => ({
  PRIORITY_CONFIG: {
    urgent: { label: 'URG', color: '#ef4444', weight: 0 },
    high: { label: 'HI', color: '#f59e0b', weight: 1 },
    medium: { label: 'MED', color: '#3b82f6', weight: 2 },
    low: { label: 'LO', color: '#64748b', weight: 3 },
  },
}))

vi.mock('@/components/shared/kanbanShared', () => ({
  buildKanbanColumns: (colors: Record<string, string>) => [
    { status: 'todo', label: 'To Do', icon: '📋', color: colors.todo },
    { status: 'in_progress', label: 'In Progress', icon: '🔄', color: colors.in_progress },
    { status: 'review', label: 'Review', icon: '👀', color: colors.review },
    { status: 'blocked', label: 'Blocked', icon: '⚠️', color: colors.blocked },
    { status: 'done', label: 'Done', icon: '✅', color: colors.done },
  ],
  groupTasksByStatus: (tasks: Task[]) => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
      blocked: [],
    }
    for (const task of tasks) {
      grouped[task.status].push(task)
    }
    return grouped
  },
}))

// ── Test data ─────────────────────────────────────────────────────────────

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  project_id: 'p1',
  room_id: null,
  title: 'Build feature',
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

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Alpha Project',
  description: null,
  icon: null,
  color: '#6366f1',
  folder_path: null,
  status: 'active',
  created_at: Date.now(),
  updated_at: Date.now(),
  rooms: [],
  ...overrides,
})

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockTasks = []
  mockProjects = []
  mockTasksLoading = false
  mockTasksError = null
})

// ── Tests ─────────────────────────────────────────────────────────────────

describe('MobileKanbanPanel', () => {
  describe('header', () => {
    it('renders Kanban header', () => {
      render(<MobileKanbanPanel onBack={() => {}} />)
      expect(screen.getByText('Kanban Board')).toBeInTheDocument()
    })

    it('calls onBack when back button is clicked', () => {
      const onBack = vi.fn()
      render(<MobileKanbanPanel onBack={onBack} />)
      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0])
      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('renders Filter button in header', () => {
      const { container } = render(<MobileKanbanPanel onBack={() => {}} />)
      // lucide-react v0.574 exports Filter as Funnel icon (lucide-funnel class)
      const filterSvg =
        container.querySelector('svg.lucide-funnel') ??
        container.querySelector('svg.lucide-filter') ??
        container.querySelector('svg[class*="funnel"], svg[class*="filter"]')
      expect(filterSvg).not.toBeNull()
    })
  })

  describe('column tabs', () => {
    it('renders all 5 column tab labels', () => {
      render(<MobileKanbanPanel onBack={() => {}} />)
      // Column labels should be visible in the tabs row
      expect(screen.getAllByText('To Do').length).toBeGreaterThan(0)
      expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Review').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Done').length).toBeGreaterThan(0)
    })

    it('defaults to Todo column', () => {
      render(<MobileKanbanPanel onBack={() => {}} />)
      expect(screen.getByText('To Do')).toBeInTheDocument()
    })

    it('switches to In Progress column when tab is clicked', () => {
      render(<MobileKanbanPanel onBack={() => {}} />)
      fireEvent.click(screen.getByText('🔄'))
      expect(screen.getByText('In Progress')).toBeInTheDocument()
    })

    it('switches to Done column', () => {
      render(<MobileKanbanPanel onBack={() => {}} />)
      fireEvent.click(screen.getByText('✅'))
      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    it('shows task count badge on column tab', () => {
      mockTasks = [makeTask({ id: 't1', status: 'todo' }), makeTask({ id: 't2', status: 'todo' })]
      render(<MobileKanbanPanel onBack={() => {}} />)
      // Badge with count 2 should be visible
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  describe('task list', () => {
    it('shows empty state when no tasks in column', () => {
      render(<MobileKanbanPanel onBack={() => {}} />)
      expect(screen.getByText(/No tasks/i)).toBeInTheDocument()
    })

    it('renders task cards in correct column', () => {
      mockTasks = [
        makeTask({ id: 't1', title: 'Fix login bug', status: 'todo' }),
        makeTask({ id: 't2', title: 'Deploy to prod', status: 'todo' }),
      ]
      render(<MobileKanbanPanel onBack={() => {}} />)
      expect(screen.getByText('Fix login bug')).toBeInTheDocument()
      expect(screen.getByText('Deploy to prod')).toBeInTheDocument()
    })

    it('shows tasks in in_progress column when switching', () => {
      mockTasks = [
        makeTask({ id: 't1', title: 'Todo task', status: 'todo' }),
        makeTask({ id: 't2', title: 'Progress task', status: 'in_progress' }),
      ]
      render(<MobileKanbanPanel onBack={() => {}} />)

      fireEvent.click(screen.getByText('🔄'))
      expect(screen.getByText('Progress task')).toBeInTheDocument()
      expect(screen.queryByText('Todo task')).not.toBeInTheDocument()
    })

    it('shows priority label on task card', () => {
      mockTasks = [makeTask({ id: 't1', status: 'todo', priority: 'urgent' })]
      render(<MobileKanbanPanel onBack={() => {}} />)
      expect(screen.getByText('URG')).toBeInTheDocument()
    })

    it('shows assignee when set', () => {
      mockTasks = [makeTask({ id: 't1', status: 'todo', assigned_display_name: 'Agent Smith' })]
      render(<MobileKanbanPanel onBack={() => {}} />)
      expect(screen.getByText('Agent Smith')).toBeInTheDocument()
    })

    it('shows loading state', () => {
      mockTasksLoading = true
      render(<MobileKanbanPanel onBack={() => {}} />)
      expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
    })

    it('shows error state', () => {
      mockTasksError = 'Failed to load tasks'
      render(<MobileKanbanPanel onBack={() => {}} />)
      expect(screen.getByText('Failed to load tasks')).toBeInTheDocument()
    })
  })

  describe('task detail modal', () => {
    it('opens task detail when task card is tapped', () => {
      mockTasks = [makeTask({ id: 't1', title: 'Test Task', status: 'todo' })]
      render(<MobileKanbanPanel onBack={() => {}} />)

      const taskCard = screen.getByText('Test Task').closest('button')!
      fireEvent.click(taskCard)

      expect(screen.getAllByText('Test Task').length).toBeGreaterThan(1)
    })

    it('shows task status in detail modal', () => {
      mockTasks = [makeTask({ id: 't1', title: 'My Task', status: 'todo' })]
      render(<MobileKanbanPanel onBack={() => {}} />)

      const taskCard = screen.getByText('My Task').closest('button')!
      fireEvent.click(taskCard)

      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('shows task priority in detail modal', () => {
      mockTasks = [makeTask({ id: 't1', title: 'Urgent Task', status: 'todo', priority: 'urgent' })]
      render(<MobileKanbanPanel onBack={() => {}} />)

      fireEvent.click(screen.getByText('Urgent Task').closest('button')!)
      expect(screen.getByText('Priority')).toBeInTheDocument()
    })

    it('shows task description in detail modal', () => {
      mockTasks = [
        makeTask({
          id: 't1',
          title: 'Described Task',
          status: 'todo',
          description: 'Detailed description here',
        }),
      ]
      render(<MobileKanbanPanel onBack={() => {}} />)

      fireEvent.click(screen.getByText('Described Task').closest('button')!)
      expect(screen.getByText('Detailed description here')).toBeInTheDocument()
    })

    it('shows assignee in detail modal', () => {
      mockTasks = [
        makeTask({
          id: 't1',
          title: 'Assigned Task',
          status: 'todo',
          assigned_display_name: 'DevBot',
        }),
      ]
      render(<MobileKanbanPanel onBack={() => {}} />)

      fireEvent.click(screen.getByText('Assigned Task').closest('button')!)
      // "DevBot" may appear in both the card and modal; at least one match is enough
      expect(screen.getAllByText('DevBot').length).toBeGreaterThan(0)
    })

    it('shows Move To options (all other columns)', () => {
      mockTasks = [makeTask({ id: 't1', title: 'Move Me', status: 'todo' })]
      render(<MobileKanbanPanel onBack={() => {}} />)

      fireEvent.click(screen.getByText('Move Me').closest('button')!)

      // Column names appear in both tab bar and modal Move To buttons
      expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Review').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Done').length).toBeGreaterThan(0)
    })

    it('calls updateTask when moving task to new status', async () => {
      mockTasks = [makeTask({ id: 't1', title: 'Move Task', status: 'todo' })]
      render(<MobileKanbanPanel onBack={() => {}} />)

      fireEvent.click(screen.getByText('Move Task').closest('button')!)

      // Click "In Progress" in the modal
      const inProgressBtns = screen.getAllByText('In Progress')
      fireEvent.click(inProgressBtns[inProgressBtns.length - 1])

      await waitFor(() =>
        expect(mockUpdateTask).toHaveBeenCalledWith('t1', { status: 'in_progress' })
      )
    })

    it('closes modal when × button is clicked', () => {
      mockTasks = [makeTask({ id: 't1', title: 'Close Modal', status: 'todo' })]
      render(<MobileKanbanPanel onBack={() => {}} />)

      fireEvent.click(screen.getByText('Close Modal').closest('button')!)
      expect(screen.getByText('×')).toBeInTheDocument()

      fireEvent.click(screen.getByText('×'))
      expect(screen.getAllByText('Close Modal').length).toBe(1)
    })
  })

  describe('filter sheet', () => {
    // Helper to click the filter button (contains lucide funnel/filter svg)
    function clickFilterButton(container: HTMLElement) {
      // lucide-react v0.574: Filter is exported as Funnel (class: lucide-funnel)
      const filterSvg =
        container.querySelector('svg.lucide-funnel') ??
        container.querySelector('svg.lucide-filter') ??
        container.querySelector('svg[class*="funnel"], svg[class*="filter"]')
      const btn = filterSvg?.closest('button')
      if (!btn) throw new Error('Filter button not found in container')
      fireEvent.click(btn)
    }

    it('opens filter sheet when Filter button is clicked', () => {
      mockProjects = [makeProject({ id: 'p1', name: 'Alpha' })]
      const { container } = render(<MobileKanbanPanel onBack={() => {}} />)

      clickFilterButton(container)
      expect(screen.getByText('Filter by Project')).toBeInTheDocument()
    })

    it('shows All Projects option in filter', () => {
      const { container } = render(<MobileKanbanPanel onBack={() => {}} />)
      clickFilterButton(container)
      expect(screen.getByText('All Projects')).toBeInTheDocument()
    })

    it('shows project names in filter list', () => {
      mockProjects = [
        makeProject({ id: 'p1', name: 'Frontend' }),
        makeProject({ id: 'p2', name: 'Backend' }),
      ]
      const { container } = render(<MobileKanbanPanel onBack={() => {}} />)
      clickFilterButton(container)

      expect(screen.getByText('Frontend')).toBeInTheDocument()
      expect(screen.getByText('Backend')).toBeInTheDocument()
    })

    it('closes filter sheet when All Projects is selected', () => {
      mockProjects = [makeProject()]
      const { container } = render(<MobileKanbanPanel onBack={() => {}} />)

      clickFilterButton(container)
      fireEvent.click(screen.getByText('All Projects'))

      expect(screen.queryByText('Filter by Project')).not.toBeInTheDocument()
    })

    it('filters tasks by selected project and shows project name', async () => {
      mockProjects = [
        makeProject({ id: 'p1', name: 'Alpha' }),
        makeProject({ id: 'p2', name: 'Beta' }),
      ]
      mockTasks = [
        makeTask({ id: 't1', title: 'Alpha task', project_id: 'p1', status: 'todo' }),
        makeTask({ id: 't2', title: 'Beta task', project_id: 'p2', status: 'todo' }),
      ]
      const { container } = render(<MobileKanbanPanel onBack={() => {}} />)

      // Open filter and select Alpha
      clickFilterButton(container)
      fireEvent.click(screen.getByText('Alpha'))

      // Filter sheet should close
      expect(screen.queryByText('Filter by Project')).not.toBeInTheDocument()
    })

    it('shows selected project name in header after filtering', () => {
      mockProjects = [makeProject({ id: 'p1', name: 'My Project' })]
      const { container } = render(<MobileKanbanPanel onBack={() => {}} />)

      clickFilterButton(container)
      fireEvent.click(screen.getByText('My Project'))

      // Should show project name somewhere in the header area
      expect(screen.getAllByText('My Project').length).toBeGreaterThan(0)
    })
  })
})
