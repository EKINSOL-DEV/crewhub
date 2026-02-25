/**
 * React hook for accessing the panel registry.
 * Provides memoized access to panel definitions.
 */

import { useMemo } from 'react'
import {
  type PanelId,
  type PanelDefinition,
  getPanelDef,
  getVisiblePanelDefs,
  getPrimaryPanelDefs,
  getSecondaryPanelDefs,
  getSelectablePanelIds,
} from './PanelRegistry'

export interface UsePanelRegistryReturn {
  /** Get panel definition by ID */
  get: (id: PanelId) => PanelDefinition
  /** All visible (non-hidden) panel definitions */
  visible: PanelDefinition[]
  /** Primary panels (for main selector grid) */
  primary: PanelDefinition[]
  /** Secondary panels (for "More" section) */
  secondary: PanelDefinition[]
  /** Selectable panel IDs (for type pickers, context menus) */
  selectableIds: PanelId[]
}

export function usePanelRegistry(): UsePanelRegistryReturn {
  return useMemo(
    () => ({
      get: getPanelDef,
      visible: getVisiblePanelDefs(),
      primary: getPrimaryPanelDefs(),
      secondary: getSecondaryPanelDefs(),
      selectableIds: getSelectablePanelIds(),
    }),
    []
  )
}
