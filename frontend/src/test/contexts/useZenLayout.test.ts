import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useZenLayout, LAYOUT_PRESETS } from '@/components/zen/hooks/useZenLayout'

describe('useZenLayout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes with default layout and computed values', () => {
    const { result } = renderHook(() => useZenLayout())

    expect(result.current.panelCount).toBe(2)
    expect(result.current.panels.some((p) => p.panelType === 'chat')).toBe(true)
    expect(result.current.focusedPanel?.panelType).toBe('chat')
    expect(result.current.isMaximized).toBe(false)
  })

  it('supports focus navigation and split/close actions', () => {
    const { result } = renderHook(() => useZenLayout())

    const firstId = result.current.panels[0].panelId
    const secondId = result.current.panels[1].panelId

    act(() => result.current.focusPanel(secondId))
    expect(result.current.focusedPanelId).toBe(secondId)

    act(() => result.current.focusNextPanel())
    expect(result.current.focusedPanelId).toBe(firstId)

    act(() => result.current.focusPrevPanel())
    expect(result.current.focusedPanelId).toBe(secondId)

    act(() => result.current.focusPanelByIndex(0))
    expect(result.current.focusedPanelId).toBe(firstId)

    act(() => result.current.splitPanel(firstId, 'col', 'activity'))
    expect(result.current.panelCount).toBe(3)
    expect(result.current.panels.some((p) => p.panelType === 'activity')).toBe(true)

    const toClose = result.current.panels.find((p) => p.panelType === 'activity')!.panelId
    act(() => result.current.closePanel(toClose))
    expect(result.current.panelCount).toBe(2)
    expect(result.current.panels.some((p) => p.panelType === 'activity')).toBe(false)
  })

  it('handles maximize/restore and panel updates', () => {
    const { result } = renderHook(() => useZenLayout())
    const panelId = result.current.panels[0].panelId

    act(() => result.current.maximizePanel(panelId))
    expect(result.current.isMaximized).toBe(true)
    expect(result.current.layout.kind).toBe('leaf')

    act(() => result.current.restoreLayout())
    expect(result.current.isMaximized).toBe(false)

    act(() => result.current.toggleMaximize())
    expect(result.current.isMaximized).toBe(true)

    act(() => result.current.toggleMaximize())
    expect(result.current.isMaximized).toBe(false)

    act(() => result.current.setPanelAgent(panelId, 'session-1', 'Agent One', '🤖'))
    const updated = result.current.panels.find((p) => p.panelId === panelId)
    expect(updated?.agentSessionKey).toBe('session-1')
    expect(updated?.agentName).toBe('Agent One')
    expect(updated?.agentIcon).toBe('🤖')
  })

  it('applies/cycles presets, applies custom layout, and persists state', async () => {
    const { result } = renderHook(() => useZenLayout())

    act(() => result.current.applyPreset('monitor'))
    expect(result.current.panels.some((p) => p.panelType === 'sessions')).toBe(true)
    expect(result.current.panels.some((p) => p.panelType === 'activity')).toBe(true)

    act(() => result.current.cyclePresets())
    expect(result.current.panels.some((p) => p.panelType === 'chat')).toBe(true)

    const custom = LAYOUT_PRESETS['multi-chat']()
    act(() => result.current.applyLayout(custom))
    expect(result.current.panelCount).toBe(2)
    expect(result.current.panels.every((p) => p.panelType === 'chat')).toBe(true)

    await waitFor(() => {
      const raw = localStorage.getItem('zen-layout-current')
      expect(raw).toBeTruthy()
      const parsed = JSON.parse(raw as string)
      expect(parsed.focusedPanelId).toBe(result.current.focusedPanelId)
    })
  })

  it('clamps resize ratio to safe bounds', () => {
    const { result } = renderHook(() => useZenLayout())
    const firstPanel = result.current.panels[0].panelId

    act(() => result.current.resizePanel(firstPanel, 0.99))
    expect(result.current.layout.kind).toBe('split')
    if (result.current.layout.kind === 'split') {
      expect(result.current.layout.ratio).toBe(0.85)
    }

    act(() => result.current.resizePanel(firstPanel, 0.01))
    if (result.current.layout.kind === 'split') {
      expect(result.current.layout.ratio).toBe(0.15)
    }
  })
})
