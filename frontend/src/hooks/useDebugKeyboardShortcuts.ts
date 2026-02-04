// ─── Debug Keyboard Shortcuts ───────────────────────────────────
// Global keyboard shortcuts for toggling debug modes.
// F2 = Grid overlay, F3 = Lighting panel, F4 = Debug bots
// Skips when an input/textarea/contenteditable is focused.

import { useEffect, useCallback, useRef } from 'react'
import { useGridDebug } from './useGridDebug'
import { useLightingPanelVisibility } from './useLightingConfig'
import { useDebugBots } from './useDebugBots'

// ─── Ephemeral Toast ────────────────────────────────────────────
// Shows a brief on-screen indicator when a debug mode is toggled.

let toastTimeout: ReturnType<typeof setTimeout> | null = null
let toastElement: HTMLDivElement | null = null

function showDebugToast(label: string, enabled: boolean) {
  // Remove existing toast
  if (toastElement) {
    toastElement.remove()
    toastElement = null
  }
  if (toastTimeout) {
    clearTimeout(toastTimeout)
    toastTimeout = null
  }

  const el = document.createElement('div')
  const icon = enabled ? '✅' : '⬛'
  el.textContent = `${icon} ${label}: ${enabled ? 'ON' : 'OFF'}`
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 18px',
    borderRadius: '8px',
    background: 'rgba(0, 0, 0, 0.75)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
    zIndex: '99999',
    pointerEvents: 'none',
    backdropFilter: 'blur(8px)',
    transition: 'opacity 0.3s ease',
    opacity: '1',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  })

  document.body.appendChild(el)
  toastElement = el

  toastTimeout = setTimeout(() => {
    el.style.opacity = '0'
    setTimeout(() => {
      el.remove()
      if (toastElement === el) toastElement = null
    }, 300)
  }, 1500)
}

// ─── Focus Guard ────────────────────────────────────────────────

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if ((el as HTMLElement).isContentEditable) return true
  // Also skip if inside a Monaco editor or CodeMirror
  if (el.closest('.monaco-editor, .cm-editor')) return true
  return false
}

// ─── Hook ───────────────────────────────────────────────────────

export function useDebugKeyboardShortcuts() {
  const [gridEnabled, toggleGrid] = useGridDebug()
  const { visible: lightingVisible, toggle: toggleLighting } = useLightingPanelVisibility()
  const { debugBotsEnabled, setDebugBotsEnabled } = useDebugBots()

  // Use refs to get current values inside the event handler without re-attaching
  const gridRef = useRef(gridEnabled)
  const lightingRef = useRef(lightingVisible)
  const botsRef = useRef(debugBotsEnabled)

  gridRef.current = gridEnabled
  lightingRef.current = lightingVisible
  botsRef.current = debugBotsEnabled

  const toggleGridRef = useRef(toggleGrid)
  const toggleLightingRef = useRef(toggleLighting)
  const setDebugBotsEnabledRef = useRef(setDebugBotsEnabled)

  toggleGridRef.current = toggleGrid
  toggleLightingRef.current = toggleLighting
  setDebugBotsEnabledRef.current = setDebugBotsEnabled

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isInputFocused()) return

    switch (e.key) {
      case 'F2': {
        e.preventDefault()
        toggleGridRef.current()
        showDebugToast('Grid Overlay', !gridRef.current)
        break
      }
      case 'F3': {
        e.preventDefault()
        toggleLightingRef.current()
        showDebugToast('Lighting Panel', !lightingRef.current)
        break
      }
      case 'F4': {
        e.preventDefault()
        const next = !botsRef.current
        setDebugBotsEnabledRef.current(next)
        showDebugToast('Debug Bots', next)
        break
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
