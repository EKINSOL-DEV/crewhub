// ─── Debug Bots Hook ─────────────────────────────────────────────
// Manages test/fake bots for visual testing in the 3D World view.
// Follows the same persistence pattern as useGridDebug.

import { useState, useCallback, useEffect } from 'react'

// ─── Types ──────────────────────────────────────────────────────

export type DebugBotStatus = 'active' | 'idle' | 'sleeping' | 'offline'

export interface DebugBot {
  id: string
  name: string
  roomId: string
  status: DebugBotStatus
  color: string
}

// ─── Constants ──────────────────────────────────────────────────

const BOTS_STORAGE_KEY = 'crewhub-debug-bots'
const ENABLED_STORAGE_KEY = 'crewhub-debug-enabled'
const EVENT_NAME = 'crewhub-debug-bots-changed'

const BOT_NAMES = [
  'TestBot Alpha', 'TestBot Beta', 'TestBot Gamma', 'TestBot Delta',
  'TestBot Epsilon', 'TestBot Zeta', 'TestBot Eta', 'TestBot Theta',
  'TestBot Iota', 'TestBot Kappa', 'TestBot Lambda', 'TestBot Mu',
  'TestBot Nu', 'TestBot Xi', 'TestBot Omicron', 'TestBot Pi',
  'TestBot Rho', 'TestBot Sigma', 'TestBot Tau', 'TestBot Upsilon',
]

const BOT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F1948A', '#82E0AA', '#F8C471', '#AED6F1', '#D2B4DE',
]

// ─── Helpers ────────────────────────────────────────────────────

let nameCounter = 0

function readBots(): DebugBot[] {
  try {
    const raw = localStorage.getItem(BOTS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeBots(bots: DebugBot[]): void {
  localStorage.setItem(BOTS_STORAGE_KEY, JSON.stringify(bots))
  window.dispatchEvent(new Event(EVENT_NAME))
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeEnabled(val: boolean): void {
  localStorage.setItem(ENABLED_STORAGE_KEY, String(val))
  window.dispatchEvent(new Event(EVENT_NAME))
}

function pickName(existing: DebugBot[]): string {
  const usedNames = new Set(existing.map(b => b.name))
  for (const name of BOT_NAMES) {
    if (!usedNames.has(name)) return name
  }
  nameCounter++
  return `TestBot #${nameCounter}`
}

function pickColor(): string {
  return BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)]
}

function generateId(): string {
  return `debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Hook ───────────────────────────────────────────────────────

export interface UseDebugBotsReturn {
  debugBots: DebugBot[]
  debugBotsEnabled: boolean
  setDebugBotsEnabled: (val: boolean) => void
  addBot: (roomId: string) => void
  removeBot: (id: string) => void
  updateStatus: (id: string, status: DebugBotStatus) => void
  clearAll: () => void
  // Presets
  allWorking: (roomIds: string[]) => void
  allSleeping: (roomIds: string[]) => void
  mixed: (roomIds: string[]) => void
  stressTest: (roomIds: string[]) => void
  // Quick actions
  addMultiple: (roomId: string, count: number) => void
  fillAllRooms: (roomIds: string[]) => void
}

export function useDebugBots(): UseDebugBotsReturn {
  const [debugBots, setDebugBots] = useState<DebugBot[]>(readBots)
  const [debugBotsEnabled, setEnabledState] = useState(readEnabled)

  // Listen for cross-component changes
  useEffect(() => {
    const handler = () => {
      setDebugBots(readBots())
      setEnabledState(readEnabled())
    }
    window.addEventListener(EVENT_NAME, handler)
    window.addEventListener('storage', (e) => {
      if (e.key === BOTS_STORAGE_KEY || e.key === ENABLED_STORAGE_KEY) handler()
    })
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
    }
  }, [])

  const setDebugBotsEnabled = useCallback((val: boolean) => {
    writeEnabled(val)
    setEnabledState(val)
  }, [])

  const addBot = useCallback((roomId: string) => {
    const current = readBots()
    const bot: DebugBot = {
      id: generateId(),
      name: pickName(current),
      roomId,
      status: 'active',
      color: pickColor(),
    }
    const updated = [...current, bot]
    writeBots(updated)
    setDebugBots(updated)
  }, [])

  const removeBot = useCallback((id: string) => {
    const updated = readBots().filter(b => b.id !== id)
    writeBots(updated)
    setDebugBots(updated)
  }, [])

  const updateStatus = useCallback((id: string, status: DebugBotStatus) => {
    const updated = readBots().map(b => b.id === id ? { ...b, status } : b)
    writeBots(updated)
    setDebugBots(updated)
  }, [])

  const clearAll = useCallback(() => {
    writeBots([])
    setDebugBots([])
  }, [])

  // ─── Presets ──────────────────────────────────────────────────

  const createBotsForRooms = useCallback((roomIds: string[], status: DebugBotStatus, countPerRoom: number) => {
    const bots: DebugBot[] = []
    for (const roomId of roomIds) {
      for (let i = 0; i < countPerRoom; i++) {
        bots.push({
          id: generateId(),
          name: pickName(bots),
          roomId,
          status,
          color: pickColor(),
        })
      }
    }
    writeBots(bots)
    setDebugBots(bots)
  }, [])

  const allWorking = useCallback((roomIds: string[]) => {
    createBotsForRooms(roomIds, 'active', 2)
  }, [createBotsForRooms])

  const allSleeping = useCallback((roomIds: string[]) => {
    createBotsForRooms(roomIds, 'sleeping', 2)
  }, [createBotsForRooms])

  const mixed = useCallback((roomIds: string[]) => {
    const statuses: DebugBotStatus[] = ['active', 'idle', 'sleeping', 'offline']
    const bots: DebugBot[] = []
    for (const roomId of roomIds) {
      const count = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < count; i++) {
        bots.push({
          id: generateId(),
          name: pickName(bots),
          roomId,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          color: pickColor(),
        })
      }
    }
    writeBots(bots)
    setDebugBots(bots)
  }, [])

  const stressTest = useCallback((roomIds: string[]) => {
    const statuses: DebugBotStatus[] = ['active', 'idle', 'sleeping', 'offline']
    const bots: DebugBot[] = []
    for (const roomId of roomIds) {
      for (let i = 0; i < 6; i++) {
        bots.push({
          id: generateId(),
          name: pickName(bots),
          roomId,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          color: pickColor(),
        })
      }
    }
    writeBots(bots)
    setDebugBots(bots)
  }, [])

  // ─── Quick Actions ────────────────────────────────────────────

  const addMultiple = useCallback((roomId: string, count: number) => {
    const current = readBots()
    const newBots: DebugBot[] = []
    for (let i = 0; i < count; i++) {
      newBots.push({
        id: generateId(),
        name: pickName([...current, ...newBots]),
        roomId,
        status: 'active',
        color: pickColor(),
      })
    }
    const updated = [...current, ...newBots]
    writeBots(updated)
    setDebugBots(updated)
  }, [])

  const fillAllRooms = useCallback((roomIds: string[]) => {
    const current = readBots()
    const newBots: DebugBot[] = []
    for (const roomId of roomIds) {
      const existing = current.filter(b => b.roomId === roomId).length
      const toAdd = Math.max(0, 3 - existing)
      for (let i = 0; i < toAdd; i++) {
        newBots.push({
          id: generateId(),
          name: pickName([...current, ...newBots]),
          roomId,
          status: 'active',
          color: pickColor(),
        })
      }
    }
    const updated = [...current, ...newBots]
    writeBots(updated)
    setDebugBots(updated)
  }, [])

  return {
    debugBots,
    debugBotsEnabled,
    setDebugBotsEnabled,
    addBot,
    removeBot,
    updateStatus,
    clearAll,
    allWorking,
    allSleeping,
    mixed,
    stressTest,
    addMultiple,
    fillAllRooms,
  }
}
