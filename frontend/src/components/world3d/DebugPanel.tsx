import { useState, useRef, useCallback, useEffect } from 'react'
import { useDebugBots, type DebugBotStatus } from '@/hooks/useDebugBots'
import { useRooms } from '@/hooks/useRooms'

// ─── Section Header ─────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mt-2 mb-1 border-b border-gray-700 pb-1">
      {title}
    </div>
  )
}

// ─── Status Badge ───────────────────────────────────────────────

const STATUS_COLORS: Record<DebugBotStatus, string> = {
  active: '#22c55e',
  idle: '#eab308',
  sleeping: '#6366f1',
  offline: '#6b7280',
}

const STATUS_LABELS: Record<DebugBotStatus, string> = {
  active: 'Active',
  idle: 'Idle',
  sleeping: 'Sleeping',
  offline: 'Offline',
}

const ALL_STATUSES: DebugBotStatus[] = ['active', 'idle', 'sleeping', 'offline']

// ─── Main Panel ─────────────────────────────────────────────────

export function DebugPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const {
    debugBots,
    debugBotsEnabled,
    addBot,
    removeBot,
    updateStatus,
    clearAll,
    allWorking,
    allSleeping,
    mixed,
    stressTest,
    addMultiple,
    fillAllRooms,
  } = useDebugBots()
  const { rooms } = useRooms()

  // Selected room for "Add Bot"
  const [selectedRoomId, setSelectedRoomId] = useState('')

  // Dragging
  const [pos, setPos] = useState({
    x: typeof window === 'undefined' ? 700 : window.innerWidth - 280,
    y: 80,
  })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    },
    [pos]
  )

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      setPos({
        x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
      })
    }
    const handleUp = () => {
      dragRef.current = null
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

  // Default to first room
  useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) {
      setSelectedRoomId(rooms[0].id)
    }
  }, [rooms, selectedRoomId])

  const roomIds = rooms.map((r) => r.id)
  const roomNameMap = new Map(rooms.map((r) => [r.id, `${r.icon || '🏠'} ${r.name}`]))

  if (!debugBotsEnabled) return null

  return (
    <div
      className="fixed z-[25] select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: 260,
        maxHeight: 'calc(100vh - 100px)',
      }}
    >
      <div
        className="bg-gray-900/90 backdrop-blur-md rounded-xl border border-gray-700/60 shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100vh - 100px)' }}
      >
        {/* Header (drag handle) */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-move bg-gray-800/80 border-b border-gray-700/60"
          onMouseDown={handleMouseDown}
        >
          <span className="text-xs font-semibold text-gray-200">🧪 Debug Bots</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded-full">
              {debugBots.length}
            </span>
            <button
              onClick={() => setCollapsed((c) => !c)}  // NOSONAR: mouse/drag interaction
              className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-gray-700/60 transition-colors text-xs"
              title={collapsed ? 'Expand' : 'Minimize'}
            >
              {collapsed ? '□' : '—'}
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        {!collapsed && (
          <div
            className="overflow-y-auto p-3 space-y-1"
            style={{ maxHeight: 'calc(100vh - 180px)' }}
          >
            {/* ── Add Bot ── */}
            <SectionHeader title="➕ Add Bot" />
            <div className="flex gap-1.5">
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="flex-1 bg-gray-800 text-gray-200 text-[10px] rounded px-1.5 py-1.5 border border-gray-600 truncate"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.icon} {r.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => selectedRoomId && addBot(selectedRoomId)}
                className="text-[10px] px-2.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white transition-colors shrink-0"
              >
                Add
              </button>
            </div>

            {/* ── Quick Actions ── */}
            <SectionHeader title="⚡ Quick Actions" />
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => selectedRoomId && addMultiple(selectedRoomId, 3)}
                className="text-[10px] px-2 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
              >
                +3 to room
              </button>
              <button
                onClick={() => fillAllRooms(roomIds)}
                className="text-[10px] px-2 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
              >
                Fill all rooms
              </button>
              <button
                onClick={clearAll}
                className="text-[10px] px-2 py-1.5 rounded bg-red-900/50 hover:bg-red-800/60 text-red-300 transition-colors"
              >
                Clear all
              </button>
            </div>

            {/* ── Presets ── */}
            <SectionHeader title="🎭 Presets" />
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => allWorking(roomIds)}
                className="text-[10px] px-2 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
              >
                All Working
              </button>
              <button
                onClick={() => allSleeping(roomIds)}
                className="text-[10px] px-2 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
              >
                All Sleeping
              </button>
              <button
                onClick={() => mixed(roomIds)}
                className="text-[10px] px-2 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
              >
                Mixed
              </button>
              <button
                onClick={() => stressTest(roomIds)}
                className="text-[10px] px-2 py-1.5 rounded bg-amber-900/50 hover:bg-amber-800/60 text-amber-300 transition-colors"
              >
                🔥 Stress Test
              </button>
            </div>

            {/* ── Bot List ── */}
            {debugBots.length > 0 && (
              <>
                <SectionHeader title={`🤖 Bot List (${debugBots.length})`} />
                <div className="space-y-1 max-h-[240px] overflow-y-auto pr-0.5">
                  {debugBots.map((bot) => (
                    <div
                      key={bot.id}
                      className="flex items-center gap-1.5 p-1.5 rounded-lg bg-gray-800/60 border border-gray-700/40"
                    >
                      {/* Color dot */}
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: bot.color }}
                      />

                      {/* Name + room */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-gray-200 font-medium truncate">
                          🧪 {bot.name}
                        </div>
                        <div className="text-[9px] text-gray-500 truncate">
                          {roomNameMap.get(bot.roomId) || bot.roomId}
                        </div>
                      </div>

                      {/* Status dropdown */}
                      <select
                        value={bot.status}
                        onChange={(e) => updateStatus(bot.id, e.target.value as DebugBotStatus)}
                        className="bg-gray-700 text-[9px] rounded px-1 py-0.5 border border-gray-600 text-gray-300"
                        style={{ color: STATUS_COLORS[bot.status] }}
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>

                      {/* Delete button */}
                      <button
                        onClick={() => removeBot(bot.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors text-[11px] shrink-0 px-0.5"
                        title="Remove bot"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
