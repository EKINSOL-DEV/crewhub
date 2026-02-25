import { useEffect } from 'react'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import type { Room } from '@/hooks/useRooms'

interface WorldNavigationProps {
  readonly rooms: Room[]
  readonly isCreatorMode?: boolean
}

export function WorldNavigation({ rooms, isCreatorMode }: WorldNavigationProps) {
  const { state, goBack } = useWorldFocus()

  // Keyboard: Escape goes up one level (but NOT in first person — PointerLockControls handles ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.level !== 'overview' && state.level !== 'firstperson') {
        // Don't goBack if a fullscreen overlay is open (it handles its own Escape)
        if (document.querySelector('[data-fullscreen-overlay]')) return
        goBack()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.level, goBack])

  // Hide navigation in first person mode (HUD takes over) or overview (no back button needed)
  if (state.level === 'firstperson' || state.level === 'overview') return null

  const focusedRoom = rooms.find((r) => r.id === state.focusedRoomId)
  const label =
    (state.level === 'bot' || state.level === 'board') && focusedRoom
      ? `← ${focusedRoom.icon || '📦'} ${focusedRoom.name}`
      : '← Overview'

  return (
    <>
      {/* Back button (bottom-center, above RoomTabsBar) — hidden in creator mode */}
      {!isCreatorMode && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            textAlign: 'center',
          }}
        >
          <button
            onClick={goBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: '#374151',
              background: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease',
              fontFamily: 'system-ui, sans-serif',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.9)'
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.75)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            {label}
          </button>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: 'rgba(0,0,0,0.4)',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Press Esc to go back
          </div>
        </div>
      )}
    </>
  )
}
