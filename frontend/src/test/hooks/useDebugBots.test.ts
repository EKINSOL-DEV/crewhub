import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useDebugBots } from '@/hooks/useDebugBots'

describe('useDebugBots', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('toggles enabled state and persists it', () => {
    const { result } = renderHook(() => useDebugBots())

    act(() => {
      result.current.setDebugBotsEnabled(true)
    })

    expect(result.current.debugBotsEnabled).toBe(true)
    expect(localStorage.getItem('crewhub-debug-enabled')).toBe('true')
  })

  it('adds, updates, removes and clears bots', () => {
    const { result } = renderHook(() => useDebugBots())

    act(() => {
      result.current.addBot('room-1')
    })
    expect(result.current.debugBots).toHaveLength(1)

    const botId = result.current.debugBots[0].id
    act(() => {
      result.current.updateStatus(botId, 'sleeping')
    })
    expect(result.current.debugBots[0].status).toBe('sleeping')

    act(() => {
      result.current.removeBot(botId)
    })
    expect(result.current.debugBots).toHaveLength(0)

    act(() => {
      result.current.addMultiple('room-2', 3)
    })
    expect(result.current.debugBots).toHaveLength(3)

    act(() => {
      result.current.clearAll()
    })
    expect(result.current.debugBots).toHaveLength(0)
  })

  it('creates preset distributions', () => {
    const { result } = renderHook(() => useDebugBots())

    act(() => {
      result.current.allWorking(['r1', 'r2'])
    })
    expect(result.current.debugBots).toHaveLength(4)
    expect(result.current.debugBots.every((b) => b.status === 'active')).toBe(true)

    act(() => {
      result.current.allSleeping(['r1'])
    })
    expect(result.current.debugBots).toHaveLength(2)
    expect(result.current.debugBots.every((b) => b.status === 'sleeping')).toBe(true)

    act(() => {
      result.current.stressTest(['r1', 'r2', 'r3'])
    })
    expect(result.current.debugBots).toHaveLength(18)

    act(() => {
      result.current.fillAllRooms(['r1', 'r2'])
    })
    const byRoom = result.current.debugBots.reduce(
      (acc, b) => {
        acc[b.roomId] = (acc[b.roomId] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    expect(byRoom.r1).toBeGreaterThanOrEqual(3)
    expect(byRoom.r2).toBeGreaterThanOrEqual(3)
  })
})
