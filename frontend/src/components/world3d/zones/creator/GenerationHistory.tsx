/**
 * GenerationHistory — History panel with delete confirmation dialog.
 * Lists all past prop generations, allows loading into preview or deleting.
 */

import { useState, useEffect } from 'react'
import type { GenerationRecord, PropUsagePlacement } from './propMakerTypes'

// ── Types ─────────────────────────────────────────────────────

interface DeleteConfirmState {
  record: GenerationRecord
  loading: boolean
  placements: PropUsagePlacement[]
  totalInstances: number
}

// ── PropDeleteDialog ──────────────────────────────────────────

interface PropDeleteDialogProps {
  readonly state: DeleteConfirmState
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

function PropDeleteDialog({ state, onConfirm, onCancel }: PropDeleteDialogProps) {
  const hasPlacements = state.placements.length > 0
  const displayPlacements = state.placements.slice(0, 5)
  const extraCount = state.placements.length - displayPlacements.length

  return (
    <div
      className="fpm-delete-overlay"
      onClick={(e) = role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click() } }}> {
        if (e.target === e.currentTarget) onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onCancel()
      }}
      role="button"
      tabIndex={0}
    >
      <div className="fpm-delete-dialog">
        <div className="fpm-delete-title">
          {hasPlacements ? '⚠️ Delete Prop?' : '🗑️ Delete Prop?'}
        </div>
        <div className="fpm-delete-body">
          <p>
            This will delete "<strong>{state.record.name}</strong>" from your history.
          </p>
          {hasPlacements ? (
            <>
              <div className="fpm-delete-warning">
                ⚠️ This prop is currently placed in {state.placements.length} room(s) (
                {state.totalInstances} instance{state.totalInstances === 1 ? '' : 's'}):
              </div>
              <ul className="fpm-delete-room-list">
                {displayPlacements.map((p) => (
                  <li key={p.blueprintId}>
                    {p.blueprintName} ({p.instanceCount} instance{p.instanceCount === 1 ? '' : 's'})
                  </li>
                ))}
                {extraCount > 0 && <li className="fpm-delete-more">+ {extraCount} more...</li>}
              </ul>
              <p className="fpm-delete-cascade-note">
                Deleting this prop will <strong>remove it from all rooms</strong> where it's placed.
              </p>
            </>
          ) : (
            <p className="fpm-delete-note">This action cannot be undone.</p>
          )}
        </div>
        <div className="fpm-delete-actions">
          <button className="fpm-delete-cancel-btn" onClick={onCancel} disabled={state.loading}>
            Cancel
          </button>
          <button className="fpm-delete-confirm-btn" onClick={onConfirm} disabled={state.loading}>
            {(() => {
              if (state.loading) return '⏳ Deleting...'
              return hasPlacements ? '🗑️ Delete Anyway' : '🗑️ Delete Prop'
            })()}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────

export interface GenerationHistoryProps {
  readonly onLoadProp: (record: GenerationRecord) => void
  readonly refreshKey?: number
}

// ── Main Component ────────────────────────────────────────────

export function GenerationHistory({ onLoadProp, refreshKey = 0 }: GenerationHistoryProps) {
  const [records, setRecords] = useState<GenerationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<GenerationRecord | null>(null)
  const [deleteState, setDeleteState] = useState<DeleteConfirmState | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/creator/generation-history?limit=50')
      .then((r) => r.json())
      .then((data) => {
        setRecords(data.records || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [refreshKey])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const handleSelect = (record: GenerationRecord) => {
    if (selectedId === record.id) {
      setSelectedId(null)
      setDetail(null)
    } else {
      setSelectedId(record.id)
      setDetail(record)
    }
  }

  const handleDeleteClick = async (record: GenerationRecord) => {
    try {
      const res = await fetch(`/api/creator/generation-history/${record.id}/usage`)
      if (!res.ok) throw new Error('Failed to check usage')
      const usage = await res.json()
      setDeleteState({
        record,
        loading: false,
        placements: usage.placements || [],
        totalInstances: usage.totalInstances || 0,
      })
    } catch {
      setDeleteState({ record, loading: false, placements: [], totalInstances: 0 })
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteState) return
    setDeleteState({ ...deleteState, loading: true })

    const hasPlacements = deleteState.placements.length > 0
    const url = `/api/creator/generation-history/${deleteState.record.id}${hasPlacements ? '?cascade=true' : ''}`

    try {
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Delete failed' }))
        throw new Error(
          typeof err.detail === 'string' ? err.detail : err.detail?.message || 'Delete failed'
        )
      }
      const result = await res.json()

      setRecords((prev) => prev.filter((r) => r.id !== deleteState.record.id))
      if (selectedId === deleteState.record.id) {
        setSelectedId(null)
        setDetail(null)
      }

      const roomSuffix = result.deleted_from_rooms.length === 1 ? '' : 's'
      const roomsMsg =
        result.total_instances_removed > 0
          ? ` (removed from ${result.deleted_from_rooms.length} room${roomSuffix})`
          : ''
      setToast({
        message: `✅ Prop "${deleteState.record.name}" deleted${roomsMsg}`,
        type: 'success',
      })
    } catch (e: any) {
      setToast({ message: `❌ ${e.message || 'Delete failed'}`, type: 'error' })
    } finally {
      setDeleteState(null)
    }
  }

  if (loading) return <div className="fpm-history-empty">Loading history...</div>
  if (records.length === 0) return <div className="fpm-history-empty">No generations yet</div>

  return (
    <div className="fpm-history">
      {toast && <div className={`fpm-toast fpm-toast-${toast.type}`}>{toast.message}</div>}
      {deleteState && (
        <PropDeleteDialog
          state={deleteState}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteState(null)}
        />
      )}

      <div className="fpm-history-list">
        {records.map((r) => {
          let historyIcon: string
          if (r.error) {
            historyIcon = '❌'
          } else if (r.method === 'ai') {
            historyIcon = '🤖'
          } else {
            historyIcon = '📐'
          }
          return (
            <div
              key={r.id}
              className={`fpm-history-item ${selectedId === r.id ? 'fpm-history-item-active' : ''}`}
              onClick={() = role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click() } }}> handleSelect(r)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSelect(r)
              }}
              role="button"
              tabIndex={0}
            >
              <div className="fpm-history-item-name">
                {historyIcon} {r.name}
              </div>
              <div className="fpm-history-item-meta">
                {r.modelLabel} · {r.prompt.slice(0, 40)}
                {r.prompt.length > 40 ? '...' : ''}
              </div>
              <div className="fpm-history-item-date">{new Date(r.createdAt).toLocaleString()}</div>
              <button
                className="fpm-history-delete-btn"
                title="Delete prop"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteClick(r)
                }}
              >
                🗑️
              </button>
            </div>
          )
        })}
      </div>

      {detail && (
        <div className="fpm-history-detail">
          <div className="fpm-history-detail-name">{detail.name}</div>
          <div className="fpm-badges" style={{ marginBottom: 8 }}>
            <span className={`fpm-badge fpm-badge-${detail.method}`}>
              {detail.method === 'ai' ? '🤖 AI' : '📐 Template'}
            </span>
            <span className="fpm-badge fpm-badge-model">{detail.modelLabel}</span>
          </div>
          <div className="fpm-history-field">
            <span className="fpm-history-field-label">Prompt:</span>
            <span>{detail.prompt}</span>
          </div>
          {detail.toolCalls.length > 0 && (
            <div className="fpm-history-field">
              <span className="fpm-history-field-label" style={{ color: '#eab308' }}>
                Tool Calls ({detail.toolCalls.length}):
              </span>
              {detail.toolCalls.map((tc) => (
                <div key={`tc-${tc.name}-${tc.input}`} style={{ fontSize: 10, color: '#888' }}>
                  🔧 {tc.name}
                </div>
              ))}
            </div>
          )}
          {detail.error && <div style={{ color: '#ef4444', fontSize: 11 }}>❌ {detail.error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {detail.parts.length > 0 && !detail.error && (
              <button className="fpm-load-btn" onClick={() => onLoadProp(detail)}>
                🔄 Load into Preview
              </button>
            )}
            <button className="fpm-delete-btn" onClick={() => handleDeleteClick(detail)}>
              🗑️ Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
