import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ZenModeProvider, useZenMode } from '@/components/zen/hooks/useZenMode'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ZenModeProvider>{children}</ZenModeProvider>
)

describe('useZenMode', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useZenMode())).toThrow(
      'useZenMode must be used within a ZenModeProvider'
    )
  })

  it('has default tab and supports tab actions', () => {
    const { result } = renderHook(() => useZenMode(), { wrapper })

    expect(result.current.tabCount).toBe(1)
    expect(result.current.activeTab?.label).toBe('Zen Mode')

    let newTabId: string | null = null
    act(() => {
      newTabId = result.current.createTab({ projectId: 'p1', projectName: 'Project One' })
    })

    expect(newTabId).toBeTruthy()
    expect(result.current.tabCount).toBe(2)
    expect(result.current.projectFilter?.projectId).toBe('p1')

    act(() => {
      result.current.updateTabLabel(result.current.activeTabId, '  Renamed  ')
    })
    expect(result.current.activeTab?.label).toBe('Renamed')

    const toClose = result.current.activeTabId
    act(() => {
      result.current.closeTab(toClose)
    })
    expect(result.current.tabCount).toBe(1)
    expect(result.current.closedTabs).toHaveLength(1)

    act(() => {
      result.current.reopenClosedTab()
    })
    expect(result.current.tabCount).toBe(2)
  })

  it('toggles zen mode, persists selected agent, and restores it', () => {
    const { result, unmount } = renderHook(() => useZenMode(), { wrapper })

    act(() => {
      result.current.enter('a1', 'Agent One', '🤖', '#fff')
    })
    expect(result.current.isActive).toBe(true)
    expect(result.current.selectedAgentId).toBe('a1')

    act(() => {
      result.current.exit()
      result.current.toggle()
    })
    expect(result.current.isActive).toBe(true)

    unmount()

    const { result: restored } = renderHook(() => useZenMode(), { wrapper })
    expect(restored.current.selectedAgentId).toBe('a1')
    expect(restored.current.selectedAgentName).toBe('Agent One')
  })

  it('loads persisted state and migrates documents panel to projects', () => {
    localStorage.setItem(
      'zen-tabs-state',
      JSON.stringify({
        version: 1,
        tabs: [
          {
            id: 't1',
            label: 'Saved',
            projectFilter: null,
            layout: { kind: 'leaf', panelId: 'p1', panelType: 'documents' },
            focusedPanelId: 'p1',
            maximizedPanelId: null,
            scrollPositions: {},
            createdAt: 1,
          },
        ],
        activeTabId: 'missing-id',
        closedTabs: [],
        lastModified: Date.now(),
      })
    )

    const { result } = renderHook(() => useZenMode(), { wrapper })

    expect(result.current.activeTabId).toBe('t1')
    expect((result.current.activeTab?.layout as any).panelType).toBe('projects')
  })
})
