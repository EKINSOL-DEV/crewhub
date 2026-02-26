import type { Task } from '@/hooks/useTasks'

interface RunOrSelfDialogProps {
  readonly task: Task
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onRunWithAgent: () => void
  readonly onDoItMyself: () => void
}

export function RunOrSelfDialog({
  task,
  isOpen,
  onClose,
  onRunWithAgent,
  onDoItMyself,
}: RunOrSelfDialogProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 65,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Close dialog"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClose()
        }
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 28,
          width: '90%',
          maxWidth: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
          }
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1f2937' }}>
            How do you want to work on this?
          </h2>
        </div>

        {/* Task Info */}
        <div
          style={{
            background: '#f9fafb',
            borderRadius: 10,
            padding: 14,
            marginBottom: 24,
            borderLeft: '3px solid #2563eb',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: '#1f2937' }}>{task.title}</div>
          {task.description && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {task.description.slice(0, 100)}
              {task.description.length > 100 ? '…' : ''}
            </div>
          )}
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Run with Agent */}
          <button
            onClick={onRunWithAgent}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 18px',
              borderRadius: 12,
              border: '2px solid #dbeafe',
              background: '#eff6ff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2563eb'
              e.currentTarget.style.background = '#dbeafe'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#dbeafe'
              e.currentTarget.style.background = '#eff6ff'
            }}
          >
            <span style={{ fontSize: 28 }}>🚀</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1d4ed8' }}>Run with Agent</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Let an AI agent work on this task
              </div>
            </div>
          </button>

          {/* Do it myself */}
          <button
            onClick={onDoItMyself}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 18px',
              borderRadius: 12,
              border: '2px solid #e5e7eb',
              background: '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#9ca3af'
              e.currentTarget.style.background = '#f9fafb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.background = '#fff'
            }}
          >
            <span style={{ fontSize: 28 }}>👤</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>Do it myself</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                I'll work on this task manually
              </div>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 16,
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: '#6b7280',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
