# Panel Registry Migration Guide

## What changed

Panel metadata (icon, label, description, keywords) is now defined **once** in `registry/PanelRegistry.ts`. All consumers read from the registry instead of maintaining their own lists.

## Before → After

| File | Before | After |
|------|--------|-------|
| `types/layout.ts` | `PANEL_INFO` record (50+ lines) | Re-exports from registry |
| `ZenEmptyPanel.tsx` | `AVAILABLE_TYPES` + `ADDITIONAL_TYPES` arrays | `getPrimaryPanelDefs()` / `getSecondaryPanelDefs()` |
| `ZenPanel.tsx` | `PANEL_TYPES` array | `getSelectablePanelIds()` + `getPanelDef()` |
| `ZenContextMenu.tsx` | `PANEL_TYPES` array | `getSelectablePanelIds()` + `getPanelDef()` |
| `ZenCommandPalette.tsx` | 9 hardcoded `panel.add.*` commands | `getPanelCommands(onAddPanel)` |

## Adding a new panel

1. Add ID to `PanelId` type in `PanelRegistry.ts`
2. Add entry to `PANEL_DEFINITIONS` array
3. Add component rendering in `ZenMode.tsx` `renderPanel` switch
4. (Optional) Add to `PanelType` in `types/layout.ts` if it needs layout persistence

That's it — command palette, context menus, empty panel selector, and type pickers all auto-update.

## API Reference

```typescript
import { getPanelDef, getVisiblePanelDefs, getPanelCommands } from './registry'

// Get a single panel's metadata
const def = getPanelDef('chat')  // { id, label, icon, description, ... }

// All user-facing panels
const panels = getVisiblePanelDefs()

// For command palette integration
const commands = getPanelCommands((type) => addPanel(type))

// React hook
const { get, visible, primary, secondary, selectableIds } = usePanelRegistry()
```
