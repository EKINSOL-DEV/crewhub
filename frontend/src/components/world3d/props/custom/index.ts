// ─── Custom Props Directory ─────────────────────────────────────
// This directory holds custom props generated via the Creator Zone.
// Props are saved as structured parts data (PropPart[]) and rendered
// via the DynamicProp component at runtime.
//
// Custom props are registered in PropRegistry with "custom:" namespace
// and persisted via the backend API (/api/creator/save-prop).
//
// To load saved custom props on app startup, call loadSavedCustomProps().

import { propRegistry } from '@/lib/modding/registries'
import type { PropProps } from '@/components/world3d/grid/props/PropRegistry'
import { DynamicProp, type PropPart } from '@/components/world3d/zones/creator/DynamicProp'
import React from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8091'

interface SavedPropEntry {
  propId: string
  name: string
  parts: PropPart[]
  mountType: 'floor' | 'wall'
  yOffset: number
}

/**
 * Fallback component shown when a custom prop fails to render.
 * Displays a small error cube so the user can see where the broken prop is.
 */
const FallbackProp: React.FC<PropProps> = ({ position }) => {
  return React.createElement('group', { position },
    React.createElement('mesh', { position: [0, 0.25, 0] },
      React.createElement('boxGeometry', { args: [0.3, 0.3, 0.3] }),
      React.createElement('meshStandardMaterial', { color: '#ff4444', wireframe: true }),
    ),
  )
}

/**
 * Create a prop component from structured parts data.
 * Returns a React component that conforms to PropProps interface.
 * Wraps in a try-catch for graceful fallback on render errors.
 */
function createCustomPropComponent(parts: PropPart[]): React.FC<PropProps> {
  const CustomProp: React.FC<PropProps> = ({ position, rotation: _rotation }) => {
    try {
      if (!parts || parts.length === 0) {
        return React.createElement(FallbackProp, { position, rotation: 0, cellSize: 1 })
      }
      return React.createElement(DynamicProp, {
        parts,
        position,
        scale: 1,
      })
    } catch (err) {
      console.error('[CustomProp] Render error:', err)
      return React.createElement(FallbackProp, { position, rotation: 0, cellSize: 1 })
    }
  }
  return CustomProp
}

/**
 * Load all saved custom props from the backend and register them.
 * Called once on app startup.
 */
export async function loadSavedCustomProps(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/api/creator/saved-props`)
    if (!res.ok) return 0

    const data = await res.json()
    // Backend returns array directly or { props: [...] }
    const props: SavedPropEntry[] = Array.isArray(data) ? data : (data.props || [])

    let registered = 0
    for (const prop of props) {
      const propId = `custom:${prop.propId}`
      
      // Skip if already registered
      if (propRegistry.get(propId)) continue

      const component = createCustomPropComponent(prop.parts)
      propRegistry.register(propId, {
        component,
        mountType: prop.mountType || 'floor',
        yOffset: prop.yOffset ?? 0.16,
      }, 'mod', 'custom-props')

      registered++
    }

    if (registered > 0) {
      console.log(`[CustomProps] Loaded ${registered} custom props`)
    }
    return registered
  } catch (err) {
    console.warn('[CustomProps] Failed to load saved props:', err)
    return 0
  }
}
