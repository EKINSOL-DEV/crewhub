/**
 * PermissionPromptPanel — shown in chat when an agent is waiting for permission.
 * Displays the pending tool details and provides Approve/Deny actions.
 * For discovered sessions, shows a handoff button instead.
 */
import { memo, useState, useCallback } from 'react'
import { Shield, Check, X, ExternalLink } from 'lucide-react'
import { API_BASE } from '@/lib/api'

interface PermissionPromptPanelProps {
  readonly sessionKey: string
  readonly toolName?: string
  readonly toolDetail?: string
  readonly isManaged: boolean // true for cc: sessions, false for claude: sessions
}

export const PermissionPromptPanel = memo(function PermissionPromptPanel({
  sessionKey,
  toolName,
  toolDetail,
  isManaged,
}: PermissionPromptPanelProps) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'denied' | 'error'>('pending')
  const [isLoading, setIsLoading] = useState(false)

  const handleApprove = useCallback(async () => {
    if (!isManaged) return
    setIsLoading(true)
    try {
      const resp = await fetch(
        `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/permission`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        }
      )
      if (resp.ok) {
        setStatus('approved')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    } finally {
      setIsLoading(false)
    }
  }, [sessionKey, isManaged])

  const handleDeny = useCallback(async () => {
    if (!isManaged) return
    setIsLoading(true)
    try {
      const resp = await fetch(
        `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/permission`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deny' }),
        }
      )
      if (resp.ok) {
        setStatus('denied')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    } finally {
      setIsLoading(false)
    }
  }, [sessionKey, isManaged])

  if (status === 'approved') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg mx-3 mb-2">
        <Check size={14} className="text-green-400" />
        <span className="text-xs text-green-400">Permission granted</span>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg mx-3 mb-2">
        <X size={14} className="text-red-400" />
        <span className="text-xs text-red-400">Permission denied</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mx-3 mb-2">
      <div className="flex items-center gap-2">
        <Shield size={14} className="text-yellow-400" />
        <span className="text-xs font-medium text-yellow-400">Permission Required</span>
      </div>
      {(toolName || toolDetail) && (
        <div className="text-xs text-white/60 pl-5">
          {toolName && <span className="font-mono text-yellow-300">{toolName}</span>}
          {toolDetail && <span className="ml-1">— {toolDetail}</span>}
        </div>
      )}
      <div className="flex items-center gap-2 pl-5">
        {isManaged ? (
          <>
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={handleDeny}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors disabled:opacity-50"
            >
              Deny
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              // Trigger handoff to terminal
              window.open(
                `${API_BASE}/handoff/sessions/${encodeURIComponent(sessionKey)}`,
                '_blank'
              )
            }}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            <ExternalLink size={12} />
            Open in Terminal
          </button>
        )}
      </div>
    </div>
  )
})
