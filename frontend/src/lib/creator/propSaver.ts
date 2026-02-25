// ─── Prop Saver ─────────────────────────────────────────────────
// Saves generated prop code to the custom props directory
// and registers it in the PropRegistry with custom: namespace.

import { propRegistry } from '@/lib/modding/registries'
import type { PropEntry } from '@/components/world3d/grid/props/PropRegistry'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8091'

export interface SavedProp {
  id: string // e.g. "custom:glowing-mushroom"
  name: string // e.g. "GlowingMushroom"
  filename: string // e.g. "GlowingMushroom.tsx"
}

/**
 * Save a generated prop to the backend and register it in PropRegistry.
 * The backend handles writing the file to disk.
 */
export async function savePropToRegistry(
  componentName: string,
  code: string,
  component: React.FC<any>,
  mountType: 'floor' | 'wall' = 'floor',
  yOffset: number = 0.16
): Promise<SavedProp> {
  const filename = `${componentName}.tsx`
  const kebabName = componentName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  const propId = `custom:${kebabName}`

  // Save code to backend
  try {
    const res = await fetch(`${API_BASE}/api/creator/save-prop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        code,
        propId: kebabName,
        mountType,
        yOffset,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Failed to save prop: ${errText}`)
    }
  } catch (err) {
    // If backend isn't available, log warning but still register in memory
    console.warn('[PropSaver] Backend save failed, registering in memory only:', err)
  }

  // Register in PropRegistry with custom: namespace
  const entry: PropEntry = {
    component,
    mountType,
    yOffset,
  }

  propRegistry.register(propId, entry, 'mod', 'creator-zone')

  return {
    id: propId,
    name: componentName,
    filename,
  }
}

/**
 * Remove a custom prop from the registry.
 */
export function removeCustomProp(propId: string): boolean {
  return propRegistry.unregister(propId)
}

/**
 * List all custom props currently registered.
 */
export function listCustomProps(): SavedProp[] {
  return propRegistry
    .list()
    .filter((entry) => entry.id.startsWith('custom:'))
    .map((entry) => {
      const kebabName = entry.id.replace('custom:', '')
      const pascalName = kebabName
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join('')
      return {
        id: entry.id,
        name: pascalName,
        filename: `${pascalName}.tsx`,
      }
    })
}
