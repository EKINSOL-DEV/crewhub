import { useEffect } from 'react'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import type { Room } from '@/hooks/useRooms'

interface WorldNavigationProps {
  rooms: Room[]
}

export function WorldNavigation({ rooms }: WorldNavigationProps) {
  const { state, goBack, enterFirstPerson } = useWorldFocus()

  // Keyboard: Escape goes up one level (but NOT in first person — PointerLockControls handles ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.level !== 'overview' && state.level !== 'firstperson') {
        goBack()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.level, goBack])

  // Hide navigation in first person mode (HUD takes over)
  if (state.level === 'firstperson') return null

  // Show first person button in overview mode
  if (state.level === 'overview') {
    return (
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 50,
        }}
      >
        <button
          onClick={enterFirstPerson}
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
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.9)'
            e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.75)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
          }}
          title="Enter first person walking mode"
        >
          🚶 Walk Around
        </button>
      </div>
    )
  }

  const focusedRoom = rooms.find(r => r.id === state.focusedRoomId)
  const label = state.level === 'bot' && focusedRoom
    ? `← ${focusedRoom.icon || '📦'} ${focusedRoom.name}`
    : '← Overview'

  return (
    <>
      {/* Back button (top-left) */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 50,
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
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.9)'
            e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)'
          }}
          onMouseLeave={e => {
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
            paddingLeft: 4,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Press Esc to go back
        </div>
      </div>

      {/* First person button (top-right, below fullscreen) */}
      <div
        style={{
          position: 'absolute',
          top: 56,
          right: 16,
          zIndex: 50,
        }}
      >
        <button
          onClick={enterFirstPerson}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: '#374151',
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease',
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1,
            padding: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.9)'
            e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.75)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
          }}
          title="Enter first person walking mode"
        >
          🚶
        </button>
      </div>
    </>
  )
}
