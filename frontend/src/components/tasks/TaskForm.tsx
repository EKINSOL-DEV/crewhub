import { useState, useCallback, useEffect } from 'react'
import type { Task, TaskStatus, TaskPriority, TaskCreate, TaskUpdate } from '@/hooks/useTasks'

// ── Types ──────────────────────────────────────────────────────

interface TaskFormProps {
  readonly mode: 'create' | 'edit'
  readonly projectId: string
  readonly roomId?: string
  readonly initialData?: Task
  readonly agents?: Array<{ session_key: string; display_name: string }>
  readonly onSubmit: (data: TaskCreate | TaskUpdate) => Promise<void>
  readonly onCancel: () => void
  readonly isLoading?: boolean
}

// ── Status/Priority Options ────────────────────────────────────

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '📋 To Do' },
  { value: 'in_progress', label: '🔄 In Progress' },
  { value: 'review', label: '👀 Review' },
  { value: 'done', label: '✅ Done' },
  { value: 'blocked', label: '🚫 Blocked' },
]

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent', label: '🔴 Urgent', color: '#dc2626' },
  { value: 'high', label: '🟠 High', color: '#ea580c' },
  { value: 'medium', label: '🔵 Medium', color: '#2563eb' },
  { value: 'low', label: '⚪ Low', color: '#6b7280' },
]

// ── Styles ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  background: '#ffffff',
  color: '#1f2937',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#4b5563',
  marginBottom: 4,
}

const buttonBaseStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'all 0.15s',
}

// ── Component ──────────────────────────────────────────────────

export function TaskForm({
  mode,
  projectId,
  roomId,
  initialData,
  agents = [],
  onSubmit,
  onCancel,
  isLoading = false,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [status, setStatus] = useState<TaskStatus>(initialData?.status || 'todo')
  const [priority, setPriority] = useState<TaskPriority>(initialData?.priority || 'medium')
  const [assignee, setAssignee] = useState(initialData?.assigned_session_key || '')
  const [error, setError] = useState<string | null>(null)

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title)
      setDescription(initialData.description || '')
      setStatus(initialData.status)
      setPriority(initialData.priority)
      setAssignee(initialData.assigned_session_key || '')
    }
  }, [initialData])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      if (!title.trim()) {
        setError('Title is required')
        return
      }

      const data =
        mode === 'create'
          ? ({
              project_id: projectId,
              room_id: roomId,
              title: title.trim(),
              description: description.trim() || undefined,
              status,
              priority,
              assigned_session_key: assignee || undefined,
            } as TaskCreate)
          : ({
              title: title.trim(),
              description: description.trim() || undefined,
              status,
              priority,
              assigned_session_key: assignee || undefined,
            } as TaskUpdate)

      try {
        await onSubmit(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save task')
      }
    },
    [mode, projectId, roomId, title, description, status, priority, assignee, onSubmit]
  )

  let submitBtnLabel: string
  if (isLoading) {
    submitBtnLabel = 'Saving...'
  } else if (mode === 'create') {
    submitBtnLabel = 'Create Task'
  } else {
    submitBtnLabel = 'Save Changes'
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title */}
      <div>
        <label style={labelStyle}>Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          style={inputStyle}
          autoFocus
          disabled={isLoading}
        />
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add more details..."
          rows={3}
          style={{
            ...inputStyle,
            resize: 'vertical',
            minHeight: 80,
          }}
          disabled={isLoading}
        />
      </div>

      {/* Status & Priority Row */}
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Status */}
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            style={{ ...inputStyle, cursor: 'pointer' }}
            disabled={isLoading}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            style={{ ...inputStyle, cursor: 'pointer' }}
            disabled={isLoading}
          >
            {priorityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Assignee */}
      <div>
        <label style={labelStyle}>Assign to</label>
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
          disabled={isLoading}
        >
          <option value="">— Unassigned —</option>
          {agents.map((agent) => (
            <option key={agent.session_key} value={agent.session_key}>
              {agent.display_name}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            color: '#dc2626',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          style={{
            ...buttonBaseStyle,
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            color: '#4b5563',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !title.trim()}
          style={{
            ...buttonBaseStyle,
            background: isLoading ? '#9ca3af' : '#2563eb',
            border: 'none',
            color: '#ffffff',
            opacity: !title.trim() ? 0.5 : 1,
          }}
        >
          {submitBtnLabel}
        </button>
      </div>
    </form>
  )
}
