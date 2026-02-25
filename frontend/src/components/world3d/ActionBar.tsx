import { useState, useCallback } from 'react'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { useZenMode } from '@/components/zen'

// ── Types ──────────────────────────────────────────────────────

interface ActionBarProps {
  /** Number of running tasks (for badge display) */
  readonly runningTaskCount: number
  /** Whether the tasks window is currently open */
  readonly tasksWindowOpen: boolean
  /** Callback to toggle the tasks window */
  readonly onToggleTasksWindow: () => void
  /** Whether creator mode is active */
  readonly isCreatorMode: boolean
  /** Callback to toggle creator mode */
  readonly onToggleCreatorMode: () => void
  /** Only show creator button if admin */
  readonly isAdmin?: boolean
}

interface ActionButtonProps {
  readonly icon: string
  readonly label: string
  readonly onClick: () => void
  readonly isActive?: boolean
  readonly badge?: number
  readonly badgeColor?: string
  readonly activeBackground?: string
  readonly activeBorder?: string
}

// ── ActionButton Sub-Component ─────────────────────────────────

function ActionButton({
  icon,
  label,
  onClick,
  isActive,
  badge,
  badgeColor = '#3b82f6',
  activeBackground,
  activeBorder,
}: ActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 10,
          cursor: 'pointer',
          fontSize: 18,
          background: (() => {
            if (isActive) return activeBackground ?? 'rgba(59, 130, 246, 0.25)'
            return isHovered ? 'rgba(255, 255, 255, 0.3)' : 'transparent'
          })(),
          border: isActive && activeBorder ? activeBorder : 'none',
          transition: 'all 0.15s ease',
          position: 'relative',
        }}
        title={label}
      >
        {icon}

        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: badgeColor,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {/* Tooltip (appears on hover, to the right of the button) */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            marginLeft: 8,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 40,
            fontFamily: 'system-ui, sans-serif',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            animation: 'tooltipFadeIn 0.15s ease-out',
          }}
        >
          {label}
          {/* Tooltip arrow */}
          <div
            style={{
              position: 'absolute',
              left: -4,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
              borderRight: '4px solid rgba(0, 0, 0, 0.85)',
            }}
          />
        </div>
      )}
    </div>
  )
}

// ── Main ActionBar Component ───────────────────────────────────

export function ActionBar({
  runningTaskCount,
  tasksWindowOpen,
  onToggleTasksWindow,
  isCreatorMode,
  onToggleCreatorMode,
  isAdmin = false,
}: ActionBarProps) {
  const { state, enterFirstPerson, goBack } = useWorldFocus()
  const zenMode = useZenMode()

  const isFirstPerson = state.level === 'firstperson'

  const handleWalkAroundClick = useCallback(() => {
    if (isFirstPerson) {
      goBack() // Exit first person mode
    } else {
      enterFirstPerson()
    }
  }, [isFirstPerson, enterFirstPerson, goBack])

  // Don't render in first person mode
  if (isFirstPerson) return null

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: 6,
          borderRadius: 14,
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
        }}
      >
        {/* Walk Around Button */}
        <ActionButton
          icon="🚶"
          label="Walk Around"
          onClick={handleWalkAroundClick}
          isActive={isFirstPerson}
        />

        {/* Active Tasks Button */}
        <ActionButton
          icon="📋"
          label="Active Tasks"
          onClick={onToggleTasksWindow}
          isActive={tasksWindowOpen}
          badge={runningTaskCount > 0 ? runningTaskCount : undefined}
          badgeColor={runningTaskCount > 0 ? '#3b82f6' : '#6b7280'}
        />

        {/* Creator Mode Button — admin only */}
        {isAdmin && (
          <ActionButton
            icon="🎨"
            label="Creator Mode [E]"
            onClick={onToggleCreatorMode}
            isActive={isCreatorMode}
            badgeColor="gold"
            activeBackground="rgba(255,215,0,0.2)"
            activeBorder="1.5px solid gold"
          />
        )}

        {/* Zen Mode Button */}
        <ActionButton
          icon="🧘"
          label="Zen Mode"
          onClick={() => zenMode.enter()}
          isActive={zenMode.isActive}
          activeBackground="rgba(99,102,241,0.2)"
          activeBorder="1.5px solid #6366f1"
        />
      </div>

      {/* Tooltip fade-in animation */}
      <style>{`
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateY(-50%) translateX(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
          }
        }
      `}</style>
    </>
  )
}
