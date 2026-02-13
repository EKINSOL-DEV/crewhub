// ─── Shared bot constants & registries ────────────────────────────
// Extracted from Bot3D.tsx to avoid mixed exports (React + non-React)
// which breaks Vite HMR Fast Refresh.

export type BotStatus = 'active' | 'idle' | 'sleeping' | 'supervising' | 'offline'

// ─── Fixed Y height for ALL bots ─────────────────────────────────
export const BOT_FIXED_Y = 0.35

// ─── Global bot position registry (module-level, no React state) ──
// CameraController reads from this to follow bots smoothly.
export const botPositionRegistry = new Map<string, { x: number; y: number; z: number }>()
