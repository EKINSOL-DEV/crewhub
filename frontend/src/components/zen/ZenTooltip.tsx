/**
 * Zen Tooltip Component
 * Lightweight tooltip with positioning and delay
 */

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface ZenTooltipProps {
  readonly content: ReactNode
  readonly children: ReactNode
  readonly position?: TooltipPosition
  readonly delay?: number
  readonly disabled?: boolean
  readonly shortcut?: string | string[]
}

export function ZenTooltip({
  content,
  children,
  position = 'top',
  delay = 400,
  disabled = false,
  shortcut,
}: ZenTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)

  const showTooltip = useCallback(() => {
    if (disabled) return

    timeoutRef.current = window.setTimeout(() => {
      if (!triggerRef.current) return

      const rect = triggerRef.current.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = position === 'top' ? rect.top : rect.bottom

      setCoords({ x, y })
      setIsVisible(true)
    }, delay)
  }, [delay, disabled, position])

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Position adjustment
  useEffect(() => {
    if (!isVisible || !tooltipRef.current) return

    const tooltip = tooltipRef.current
    const rect = tooltip.getBoundingClientRect()

    // Adjust if tooltip goes off screen
    let adjustedX = coords.x
    let adjustedY = coords.y

    // Horizontal bounds
    if (rect.left < 8) {
      adjustedX = rect.width / 2 + 8
    } else if (rect.right > window.innerWidth - 8) {
      adjustedX = window.innerWidth - rect.width / 2 - 8
    }

    // Vertical bounds
    if (position === 'top' && rect.top < 8) {
      adjustedY = coords.y + rect.height + 16 // Flip to bottom
    } else if (position === 'bottom' && rect.bottom > window.innerHeight - 8) {
      adjustedY = coords.y - rect.height - 16 // Flip to top
    }

    if (adjustedX !== coords.x || adjustedY !== coords.y) {
      setCoords({ x: adjustedX, y: adjustedY })
    }
  }, [isVisible, coords, position])

  // Format shortcut keys
  let formattedShortcut: string[] | null
  if (!shortcut) {
    formattedShortcut = null
  } else if (Array.isArray(shortcut)) {
    formattedShortcut = shortcut
  } else {
    formattedShortcut = [shortcut]
  }

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: coords.x,
    top: position === 'top' ? coords.y - 8 : coords.y + 8,
    transform: position === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
  }

  return (
    <>
      <div
        ref={triggerRef}
        className="zen-tooltip-trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>

      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            className="zen-tooltip zen-fade-in"
            style={tooltipStyle}
            role="tooltip"
          >
            <span className="zen-tooltip-content">{content}</span>
            {formattedShortcut && (
              <span className="zen-tooltip-shortcut">
                {formattedShortcut.map((key, _i) => (
                  <kbd key={JSON.stringify(key)} className="zen-kbd zen-kbd-small">
                    {key}
                  </kbd>
                ))}
              </span>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

// ── Tooltip Button Wrapper ────────────────────────────────────────

interface ZenTooltipButtonProps {
  readonly tooltip: string
  readonly shortcut?: string | string[]
  readonly onClick?: () => void
  readonly disabled?: boolean
  readonly className?: string
  readonly icon?: string
  readonly label?: string
  readonly children?: ReactNode
}

export function ZenTooltipButton({
  tooltip,
  shortcut,
  onClick,
  disabled,
  className = '',
  icon,
  label,
  children,
}: ZenTooltipButtonProps) {
  return (
    <ZenTooltip content={tooltip} shortcut={shortcut} disabled={disabled}>
      <button
        className={`zen-btn ${className}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip}
      >
        {icon && <span className="zen-btn-icon-text">{icon}</span>}
        {label && <span className="zen-btn-label">{label}</span>}
        {children}
      </button>
    </ZenTooltip>
  )
}
