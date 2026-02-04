import { useEffect, useState } from 'react'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { getCurrentPreset, cyclePreset, CAMERA_PRESETS, type CameraPreset } from './CameraController'
import type { Room } from '@/hooks/useRooms'

interface WorldNavigationProps {
  rooms: Room[]
}

export function WorldNavigation({ rooms }: WorldNavigationProps) {
  const { state, goBack, enterFirstPerson } = useWorldFocus()

  // Track current preset (update on cycle event or level change)
  const [currentPreset, setCurrentPreset] = useState<CameraPreset>(getCurrentPreset)

  useEffect(() => {
    // Listen for preset cycle events to update the UI
    const handleCycle = () => {
      // Small delay to allow state update in CameraController
      requestAnimationFrame(() => setCurrentPreset(getCurrentPreset()))
    }
    window.addEventListener('crewhub:camera-preset-cycle', handleCycle)
    return () => window.removeEventListener('crewhub:camera-preset-cycle', handleCycle)
  }, [])

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

  // Show first person button + camera preset button in overview mode
  if (state.level === 'overview') {
    return (
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
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

        {/* Camera preset cycle button */}
        <button
          onClick={() => {
            cyclePreset()
            // Update local state immediately for snappy UI
            const newIdx = (CAMERA_PRESETS.indexOf(currentPreset) + 1) % CAMERA_PRESETS.length
            setCurrentPreset(CAMERA_PRESETS[newIdx])
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: '#6B7280',
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
            transition: 'all 0.2s ease',
            fontFamily: 'system-ui, sans-serif',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.85)'
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.12)'
            e.currentTarget.style.color = '#374151'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.65)'
            e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.08)'
            e.currentTarget.style.color = '#6B7280'
          }}
          title="Cycle camera angle (C)"
        >
          📐 {currentPreset.name}
        </button>
      </div>
    )
  }

  const focusedRoom = rooms.find(r => r.id === state.focusedRoomId)
  const label = state.level === 'bot' && focusedRoom
    ? `← ${focusedRoom.icon || '📦'} ${focusedRoom.name}`
    : '← Overview'

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 50,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      <div>
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

      {/* First person button (available from room/bot views too) */}
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
  )
}
