/**
 * Zen Rooms Panel
 * Room navigation with filtering capabilities
 */

import { useCallback, useState } from 'react'
import { useRoomsContext, type Room } from '@/contexts/RoomsContext'
import { ProjectAgentsPanel } from './ProjectAgentsPanel'

interface ZenRoomsPanelProps {
  readonly selectedRoomId?: string
  readonly onSelectRoom?: (roomId: string | null, roomName: string) => void
}

// ── Room Item Component ──────────────────────────────────────────

interface RoomItemProps {
  readonly room: Room
  readonly isSelected: boolean
  readonly sessionCount: number
  readonly onSelect: () => void
}

function RoomItem({ room, isSelected, sessionCount, onSelect }: RoomItemProps) {
  return (
    <button
      type="button"
      className={`zen-room-item ${isSelected ? 'zen-room-item-selected' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div
        className="zen-room-icon"
        style={{
          background: room.color ? `${room.color}22` : 'var(--zen-bg-hover)',
          color: room.color || 'var(--zen-fg-muted)',
        }}
      >
        {room.icon || '🏠'}
      </div>

      <div className="zen-room-info">
        <div className="zen-room-name">{room.name}</div>
        {room.project_name && (
          <div className="zen-room-project">
            <span
              className="zen-room-project-dot"
              style={{ background: room.project_color || 'var(--zen-accent)' }}
            />
            {room.project_name}
          </div>
        )}
      </div>

      {sessionCount > 0 && <div className="zen-room-badge">{sessionCount}</div>}

      {room.is_hq && (
        <div className="zen-room-hq" title="Headquarters">
          ⭐
        </div>
      )}
    </button>
  )
}

// ── Empty State ──────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="zen-rooms-empty">
      <div className="zen-empty-icon">🏠</div>
      <div className="zen-empty-title">No rooms</div>
      <div className="zen-empty-subtitle">Create rooms to organize your sessions</div>
    </div>
  )
}

// ── Loading State ────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="zen-rooms-loading">
      <div className="zen-thinking-dots">
        <span />
        <span />
        <span />
      </div>
      <span>Loading rooms...</span>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────

export function ZenRoomsPanel({ selectedRoomId, onSelectRoom }: ZenRoomsPanelProps) {
  const { rooms, sessionAssignments, isLoading, error, refresh } = useRoomsContext()
  const [filter, setFilter] = useState('')

  // Count sessions per room
  const sessionCounts = new Map<string, number>()
  sessionAssignments.forEach((roomId) => {
    sessionCounts.set(roomId, (sessionCounts.get(roomId) || 0) + 1)
  })

  // Filter rooms
  const filteredRooms = rooms.filter(
    (room) =>
      room.name.toLowerCase().includes(filter.toLowerCase()) ||
      room.project_name?.toLowerCase().includes(filter.toLowerCase())
  )

  // Sort: HQ first, then by sort_order
  const sortedRooms = [...filteredRooms].sort((a, b) => {
    if (a.is_hq !== b.is_hq) return a.is_hq ? -1 : 1
    return a.sort_order - b.sort_order
  })

  const handleSelect = useCallback(
    (room: Room | null) => {
      onSelectRoom?.(room?.id || null, room?.name || 'All')
    },
    [onSelectRoom]
  )

  // Error state
  if (error) {
    return (
      <div className="zen-rooms-panel">
        <div className="zen-rooms-error">
          <div className="zen-empty-icon">⚠️</div>
          <div className="zen-empty-title">Failed to load rooms</div>
          <button className="zen-btn" onClick={refresh}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading && rooms.length === 0) {
    return (
      <div className="zen-rooms-panel">
        <LoadingState />
      </div>
    )
  }

  // Empty state
  if (rooms.length === 0) {
    return (
      <div className="zen-rooms-panel">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="zen-rooms-panel">
      {/* Search filter */}
      <div className="zen-rooms-filter">
        <input
          type="text"
          className="zen-rooms-search"
          placeholder="Filter rooms..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              setFilter('')
            }
          }}
        />
        <button
          className="zen-btn zen-btn-icon zen-btn-small"
          onClick={refresh}
          title="Refresh rooms"
          style={{ marginLeft: '4px' }}
        >
          🔄
        </button>
      </div>

      {/* All rooms option */}
      <div className="zen-rooms-list">
        <button
          type="button"
          className={`zen-room-item zen-room-item-all ${selectedRoomId ? '' : 'zen-room-item-selected'}`}
          onClick={() => handleSelect(null)}
        >
          <div className="zen-room-icon" style={{ background: 'var(--zen-bg-hover)' }}>
            🌐
          </div>
          <div className="zen-room-info">
            <div className="zen-room-name">All Rooms</div>
          </div>
          <div className="zen-room-badge">{sessionAssignments.size}</div>
        </button>

        {/* Room list */}
        {sortedRooms.map((room) => (
          <RoomItem
            key={room.id}
            room={room}
            isSelected={room.id === selectedRoomId}
            sessionCount={sessionCounts.get(room.id) || 0}
            onSelect={() => handleSelect(room)}
          />
        ))}
      </div>

      {/* Agent templates for selected room */}
      {selectedRoomId && <ProjectAgentsPanel roomId={selectedRoomId} />}

      {/* Footer with count */}
      <div className="zen-rooms-footer">
        <span className="zen-rooms-count">
          {sortedRooms.length} room{sortedRooms.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  )
}
