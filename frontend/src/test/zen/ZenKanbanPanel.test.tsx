/**
 * Tests for ZenKanbanPanel (zen/ZenKanbanPanel.tsx)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Mocks ─────────────────────────────────────────────────────────

const mockUpdateTask = vi.fn()
const mockRefresh = vi.fn()

let mockTasks: any[] = []
let mockIsLoading = false
let mockError: string | null = null

vi.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: mockTasks,
    isLoading: mockIsLoading,
    error: mockError,
    updateTask: mockUpdateTask,
    refresh: mockRefresh,
  }),
}))

vi.mock('@/lib/taskConstants', () => ({
  PRIORITY_CONFIG: {
    high: { label: '🔴 High', color: '#ef4444' },
    medium: { label: '🟡 Medium', color: '#f59e0b' },
    low: { label: '🟢 Low', color: '#22c55e' },
  },
}))

vi.mock('@/components/shared/kanbanShared', () => ({
  buildKanbanColumns: (colorMap: Record<string, string>) => [
    { status: 'todo', label: 'To Do', icon: '📋', color: colorMap.todo || '#888' },
    {
      status: 'in_progress',
      label: 'In Progress',
      icon: '⚙️',
      color: colorMap.in_progress || '#888',
    },
    { status: 'review', label: 'Review', icon: '👀', color: colorMap.review || '#888' },
    { status: 'blocked', label: 'Blocked', icon: '🚫', color: colorMap.blocked || '#888' },
    { status: 'done', label: 'Done', icon: '✅', color: colorMap.done || '#888' },
  ],
  groupTasksByStatus: (tasks: any[]) => {
    const byStatus: Record<string, any[]> = {
      todo: [],
      in_progress: [],
      review: [],
      blocked: [],
      done: [],
    }
    for (const t of tasks) {
      if (byStatus[t.status]) byStatus[t.status].push(t)
    }
    return byStatus
  },
}))

vi.mock('@/components/zen/ProjectFilterSelect', () => ({
  ProjectFilterSelect: ({ onSelect, currentProjectId }: any) => (
    <div data-testid="project-filter-select" data-project={currentProjectId}>
      <button onClick={() => onSelect('proj-1', 'Alpha', '#ff0000')}>Select Project</button>
    </div>
  ),
}))

// ── Fixture builders ──────────────────────────────────────────────

function makeTask(overrides: any = {}) {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'todo',
    priority: 'medium',
    assigned_display_name: null,
    description: null,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────

describe('ZenKanbanPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTasks = []
    mockIsLoading = false
    mockError = null
  })

  it('renders all kanban columns', async () => {
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)

    expect(screen.getByRole('region', { name: /To Do column/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /In Progress column/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Review column/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Blocked column/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Done column/i })).toBeInTheDocument()
  })

  it('shows loading state when isLoading and no tasks', async () => {
    mockIsLoading = true
    mockTasks = []
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
  })

  it('shows error state and retry button', async () => {
    mockError = 'Network error'
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    expect(screen.getByText('Failed to load tasks')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }))
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('renders tasks in correct columns', async () => {
    mockTasks = [
      makeTask({ id: 't1', title: 'Alpha Task', status: 'todo' }),
      makeTask({ id: 't2', title: 'Beta Task', status: 'in_progress' }),
      makeTask({ id: 't3', title: 'Gamma Task', status: 'done' }),
    ]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    expect(screen.getByText('Alpha Task')).toBeInTheDocument()
    expect(screen.getByText('Beta Task')).toBeInTheDocument()
    expect(screen.getByText('Gamma Task')).toBeInTheDocument()
  })

  it('shows task count in footer', async () => {
    mockTasks = [
      makeTask({ id: 't1', title: 'Task A', status: 'todo' }),
      makeTask({ id: 't2', title: 'Task B', status: 'review' }),
    ]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    expect(screen.getByText('2 tasks')).toBeInTheDocument()
  })

  it('shows singular "1 task" correctly', async () => {
    mockTasks = [makeTask({ id: 't1', title: 'Solo Task', status: 'todo' })]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    expect(screen.getByText('1 task')).toBeInTheDocument()
  })

  it('opens task detail modal on card click', async () => {
    mockTasks = [
      makeTask({ id: 't1', title: 'Clickable Task', status: 'todo', description: 'Task desc' }),
    ]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)

    fireEvent.click(screen.getByText('Clickable Task'))
    expect(screen.getByRole('button', { name: /Close dialog/i })).toBeInTheDocument()
    expect(screen.getByText('Task desc')).toBeInTheDocument()
  })

  it('calls onTaskClick instead of opening modal when provided', async () => {
    const onTaskClick = vi.fn()
    mockTasks = [makeTask({ id: 't1', title: 'Redirected Task', status: 'todo' })]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel onTaskClick={onTaskClick} />)

    fireEvent.click(screen.getByText('Redirected Task'))
    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
    // Modal should NOT open
    expect(screen.queryByRole('button', { name: /Close dialog/i })).not.toBeInTheDocument()
  })

  it('closes modal via close button', async () => {
    mockTasks = [makeTask({ id: 't1', title: 'Modal Task', status: 'todo' })]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)

    fireEvent.click(screen.getByText('Modal Task'))
    expect(screen.getByRole('button', { name: /Close dialog/i })).toBeInTheDocument()

    fireEvent.click(screen.getByText('×'))
    expect(screen.queryByRole('button', { name: /Close dialog/i })).not.toBeInTheDocument()
  })

  it('moves task via modal actions and closes', async () => {
    mockUpdateTask.mockResolvedValue(undefined)
    mockTasks = [makeTask({ id: 't1', title: 'Moveable Task', status: 'todo' })]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)

    fireEvent.click(screen.getByText('Moveable Task'))
    // Modal should open — find and click the Done button (simpler unique choice)
    const doneButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.textContent?.includes('Done') && btn.className?.includes('zen-btn'))
    expect(doneButtons.length).toBeGreaterThan(0)
    fireEvent.click(doneButtons[0])

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith('t1', { status: 'done' })
    })
  })

  it('moves task via quick move menu on card', async () => {
    mockUpdateTask.mockResolvedValue(undefined)
    mockTasks = [makeTask({ id: 't1', title: 'Quick Move Task', status: 'todo' })]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)

    // Click the ⋮ menu button
    const menuBtn = screen.getByTitle('Move to...')
    fireEvent.click(menuBtn)

    // Move menu should appear
    expect(screen.getByLabelText('Move task menu')).toBeInTheDocument()

    // Click the first move option in the move menu
    const moveOptions = document.querySelectorAll('.zen-kanban-move-option')
    expect(moveOptions.length).toBeGreaterThan(0)
    fireEvent.click(moveOptions[0])

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalled()
    })
  })

  it('shows "No tasks" placeholder in empty columns', async () => {
    mockTasks = []
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    const noTasks = screen.getAllByText('No tasks')
    expect(noTasks.length).toBeGreaterThan(0)
  })

  it('renders project filter select when onProjectFilterChange provided', async () => {
    const onProjectFilterChange = vi.fn()
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel projectId="p1" onProjectFilterChange={onProjectFilterChange} />)
    expect(screen.getByTestId('project-filter-select')).toBeInTheDocument()
    expect(screen.getByTestId('project-filter-select')).toHaveAttribute('data-project', 'p1')
  })

  it('project filter calls onProjectFilterChange callback', async () => {
    const onProjectFilterChange = vi.fn()
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel onProjectFilterChange={onProjectFilterChange} />)
    fireEvent.click(screen.getByText('Select Project'))
    expect(onProjectFilterChange).toHaveBeenCalledWith('proj-1', 'Alpha', '#ff0000')
  })

  it('does not render project filter when onProjectFilterChange not provided', async () => {
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    expect(screen.queryByTestId('project-filter-select')).not.toBeInTheDocument()
  })

  it('shows assignee name on task card when set', async () => {
    mockTasks = [
      makeTask({
        id: 't1',
        title: 'Assigned Task',
        status: 'todo',
        assigned_display_name: 'Alice',
      }),
    ]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('handles drag-over and drop on columns', async () => {
    mockUpdateTask.mockResolvedValue(undefined)
    mockTasks = [makeTask({ id: 't1', title: 'Draggable Task', status: 'todo' })]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)

    const doneColumn = screen.getByRole('region', { name: /Done column/i })
    const dt = { getData: vi.fn(() => 't1'), setData: vi.fn(), effectAllowed: '' }

    fireEvent.dragOver(doneColumn, { dataTransfer: dt })
    fireEvent.drop(doneColumn, { dataTransfer: dt })

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith('t1', { status: 'done' })
    })
  })

  it('shows loading spinner but not kanban board during initial load', async () => {
    mockIsLoading = true
    mockTasks = []
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    expect(screen.queryByRole('region', { name: /To Do column/i })).not.toBeInTheDocument()
  })

  it('renders kanban board even while loading if tasks exist (no flash)', async () => {
    mockIsLoading = true
    mockTasks = [makeTask({ id: 't1', title: 'Cached Task', status: 'done' })]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    // Since tasks.length > 0, board should be rendered (not loading state)
    expect(screen.getByText('Cached Task')).toBeInTheDocument()
  })

  it('card responds to Enter key for expand', async () => {
    mockTasks = [makeTask({ id: 't1', title: 'Keyboard Task', status: 'review' })]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    // Fire keyDown on the card button (the text is inside it, events bubble up)
    const titleEl = screen.getByText('Keyboard Task')
    const cardBtn = titleEl.closest('button')
    if (cardBtn) fireEvent.keyDown(cardBtn, { key: 'Enter' })
    expect(screen.getByRole('button', { name: /Close dialog/i })).toBeInTheDocument()
  })

  it('closes modal via Escape key on backdrop', async () => {
    mockTasks = [makeTask({ id: 't1', title: 'Escape Task', status: 'todo' })]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    fireEvent.click(screen.getByText('Escape Task'))
    expect(screen.getByRole('button', { name: /Close dialog/i })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('button', { name: /Close dialog/i }), { key: 'Escape' })
    expect(screen.queryByRole('button', { name: /Close dialog/i })).not.toBeInTheDocument()
  })

  it('shows high priority label', async () => {
    mockTasks = [makeTask({ id: 't1', title: 'Urgent Task', status: 'blocked', priority: 'high' })]
    const { ZenKanbanPanel } = await import('@/components/zen/ZenKanbanPanel')
    render(<ZenKanbanPanel />)
    expect(screen.getByTitle('Priority: high')).toBeInTheDocument()
  })
})
