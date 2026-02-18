/**
 * Mobile Kanban Panel
 * Touch-friendly kanban board with swipe gestures
 */

import { useState, useMemo, useCallback } from 'react'
import { ArrowLeft, Filter } from 'lucide-react'
import { useTasks, type Task, type TaskStatus, type TaskPriority } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'

interface MobileKanbanPanelProps {
  onBack: () => void
}

// ── Column Configuration ─────────────────────────────────────

interface ColumnConfig {
  status: TaskStatus
  label: string
  icon: string
  color: string
}

const COLUMNS: ColumnConfig[] = [
  { status: 'todo', label: 'To Do', icon: '📋', color: '#64748b' },
  { status: 'in_progress', label: 'In Progress', icon: '🔄', color: '#3b82f6' },
  { status: 'review', label: 'Review', icon: '👀', color: '#f59e0b' },
  { status: 'blocked', label: 'Blocked', icon: '⚠️', color: '#ef4444' },
  { status: 'done', label: 'Done', icon: '✅', color: '#22c55e' },
]

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; weight: number }> = {
  urgent: { label: 'URG', color: '#ef4444', weight: 0 },
  high: { label: 'HI', color: '#f59e0b', weight: 1 },
  medium: { label: 'MED', color: '#3b82f6', weight: 2 },
  low: { label: 'LO', color: '#64748b', weight: 3 },
}

// ── Task Card (Mobile-Optimized) ─────────────────────────────

interface TaskCardProps {
  task: Task
  onTap: () => void
}

function TaskCard({ task, onTap }: TaskCardProps) {
  const priority = PRIORITY_CONFIG[task.priority]
  
  return (
    <button
      onClick={onTap}
      style={{
        width: '100%',
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 10,
        textAlign: 'left',
        color: '#e2e8f0',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Header with priority */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 4,
            background: `${priority.color}20`,
            color: priority.color,
          }}
        >
          {priority.label}
        </span>
        <span style={{ fontSize: 16, color: '#475569' }}>›</span>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.4,
        color: '#f1f5f9',
      }}>
        {task.title}
      </div>

      {/* Assignee */}
      {task.assigned_display_name && (
        <div style={{
          fontSize: 11,
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span>👤</span>
          <span>{task.assigned_display_name}</span>
        </div>
      )}
    </button>
  )
}

// ── Task Detail Modal ────────────────────────────────────────

interface TaskDetailModalProps {
  task: Task
  onClose: () => void
  onUpdateStatus: (newStatus: TaskStatus) => void
}

function TaskDetailModal({ task, onClose, onUpdateStatus }: TaskDetailModalProps) {
  const priority = PRIORITY_CONFIG[task.priority]
  const currentColumn = COLUMNS.find(c => c.status === task.status)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'flex-end',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxHeight: '85vh',
          background: '#0f172a',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>
            {task.title}
          </h3>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: '#94a3b8',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Status & Priority */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Status</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: currentColumn?.color,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{currentColumn?.icon}</span>
              <span>{currentColumn?.label}</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Priority</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: priority.color }}>
              {priority.label}
            </div>
          </div>
        </div>

        {/* Assignee */}
        {task.assigned_display_name && (
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Assignee</div>
            <div style={{ fontSize: 14, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>👤</span>
              <span>{task.assigned_display_name}</span>
            </div>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Description</div>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: '#cbd5e1', margin: 0 }}>
              {task.description}
            </p>
          </div>
        )}

        {/* Move to... */}
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Move to:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COLUMNS.filter(col => col.status !== task.status).map(col => (
              <button
                key={col.status}
                onClick={() => {
                  onUpdateStatus(col.status)
                  onClose()
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${col.color}40`,
                  borderRadius: 10,
                  color: col.color,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 18 }}>{col.icon}</span>
                <span>{col.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Filter Sheet ──────────────────────────────────────────────

interface FilterSheetProps {
  projects: Array<{ id: string; name: string; color?: string }>
  selectedProjectId: string | null
  onSelectProject: (projectId: string | null) => void
  onClose: () => void
}

function FilterSheet({ projects, selectedProjectId, onSelectProject, onClose }: FilterSheetProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxHeight: '60vh',
          background: '#1e293b',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>
          Filter by Project
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => {
              onSelectProject(null)
              onClose()
            }}
            style={{
              width: '100%',
              padding: '12px',
              background: selectedProjectId === null ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${selectedProjectId === null ? '#8b5cf6' : 'rgba(255, 255, 255, 0.06)'}`,
              borderRadius: 10,
              color: selectedProjectId === null ? '#c4b5fd' : '#cbd5e1',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            All Projects
          </button>
          {projects.map((proj) => (
            <button
              key={proj.id}
              onClick={() => {
                onSelectProject(proj.id)
                onClose()
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: selectedProjectId === proj.id ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${selectedProjectId === proj.id ? '#8b5cf6' : 'rgba(255, 255, 255, 0.06)'}`,
                borderRadius: 10,
                color: selectedProjectId === proj.id ? '#c4b5fd' : '#cbd5e1',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {proj.color && (
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: proj.color || undefined,
                  }}
                />
              )}
              <span>{proj.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────

export function MobileKanbanPanel({ onBack }: MobileKanbanPanelProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedColumn, setSelectedColumn] = useState<TaskStatus>('todo')
  const [expandedTask, setExpandedTask] = useState<Task | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  
  const { tasks, isLoading, error, updateTask, refresh } = useTasks({ projectId: selectedProjectId || undefined })
  const { projects } = useProjects()

  // Group tasks by status, sorted by priority
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      review: [],
      blocked: [],
      done: [],
    }
    
    for (const task of tasks) {
      if (grouped[task.status]) {
        grouped[task.status].push(task)
      }
    }
    
    // Sort each column by priority
    for (const status of Object.keys(grouped) as TaskStatus[]) {
      grouped[status].sort((a, b) => {
        const priorityDiff = PRIORITY_CONFIG[a.priority].weight - PRIORITY_CONFIG[b.priority].weight
        if (priorityDiff !== 0) return priorityDiff
        return b.updated_at - a.updated_at
      })
    }
    
    return grouped
  }, [tasks])

  const handleUpdateStatus = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    await updateTask(taskId, { status: newStatus })
  }, [updateTask])

  const currentColumnConfig = COLUMNS.find(c => c.status === selectedColumn)
  const currentTasks = tasksByStatus[selectedColumn]
  const selectedProject = projects.find(p => p.id === selectedProjectId)

  return (
    <div
      style={{
        height: '100dvh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
        color: '#e2e8f0',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#f1f5f9' }}>
            Kanban Board
          </div>
          {selectedProject && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {selectedProject.name}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowFilter(true)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: selectedProjectId ? '1px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.1)',
            background: selectedProjectId ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            color: selectedProjectId ? '#a78bfa' : '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Filter size={18} />
        </button>
      </header>

      {/* Column Tabs */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          flexShrink: 0,
        }}
      >
        {COLUMNS.map((col) => {
          const count = tasksByStatus[col.status].length
          const isActive = selectedColumn === col.status
          return (
            <button
              key={col.status}
              onClick={() => setSelectedColumn(col.status)}
              style={{
                flex: 1,
                minWidth: 100,
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${col.color}` : '2px solid transparent',
                color: isActive ? col.color : '#64748b',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 16 }}>{col.icon}</span>
              <span>{col.label}</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Task List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '16px',
        }}
      >
        {isLoading && tasks.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 20px' }}>
            Loading tasks...
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', color: '#ef4444', padding: '40px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 14, marginBottom: 16 }}>Failed to load tasks</div>
            <button
              onClick={refresh}
              style={{
                padding: '8px 16px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                borderRadius: 8,
                color: '#ef4444',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && currentTasks.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{currentColumnConfig?.icon}</div>
            <div style={{ fontSize: 14 }}>No tasks in {currentColumnConfig?.label}</div>
          </div>
        )}

        {!isLoading && !error && currentTasks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onTap={() => setExpandedTask(task)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, color: '#64748b' }}>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} total
        </span>
      </div>

      {/* Task Detail Modal */}
      {expandedTask && (
        <TaskDetailModal
          task={expandedTask}
          onClose={() => setExpandedTask(null)}
          onUpdateStatus={(status) => handleUpdateStatus(expandedTask.id, status)}
        />
      )}

      {/* Filter Sheet */}
      {showFilter && (
        <FilterSheet
          projects={projects.map(p => ({ id: p.id, name: p.name, color: p.color || undefined }))}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          onClose={() => setShowFilter(false)}
        />
      )}
    </div>
  )
}
