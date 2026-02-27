import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockGetSettings = vi.fn()
const mockUpdateSetting = vi.fn()
const mockUpdateSettingsBatch = vi.fn()

vi.mock('@/lib/api', () => ({
  getSettings: mockGetSettings,
  updateSetting: mockUpdateSetting,
  updateSettingsBatch: mockUpdateSettingsBatch,
}))

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  async function loadHook() {
    vi.resetModules()
    const mod = await import('@/hooks/useSettings')
    return mod.useSettings
  }

  it('loads from API and merges local settings, then migrates missing values', async () => {
    localStorage.setItem('crewhub-theme', 'dark')
    localStorage.setItem('crewhub-accent', 'blue')
    mockGetSettings.mockResolvedValue({ 'crewhub-theme': 'light' })

    const useSettings = await loadHook()
    const { result } = renderHook(() => useSettings())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.apiAvailable).toBe(true)
    expect(result.current.settings['crewhub-theme']).toBe('light')
    expect(result.current.settings['crewhub-accent']).toBe('blue')
    expect(mockUpdateSettingsBatch).toHaveBeenCalledWith({ 'crewhub-accent': 'blue' })
  })

  it('falls back to localStorage when API is unavailable', async () => {
    localStorage.setItem('crewhub-view-mode', 'grid')
    mockGetSettings.mockRejectedValue(new Error('offline'))

    const useSettings = await loadHook()
    const { result } = renderHook(() => useSettings())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.apiAvailable).toBe(false)
    expect(result.current.get('crewhub-view-mode')).toBe('grid')
  })

  it('set, setBatch, and remove update local state and call API methods', async () => {
    mockGetSettings.mockResolvedValue({})
    const useSettings = await loadHook()
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      await result.current.set('crewhub-theme', 'dark')
    })
    expect(localStorage.getItem('crewhub-theme')).toBe('dark')
    expect(mockUpdateSetting).toHaveBeenCalledWith('crewhub-theme', 'dark')

    await act(async () => {
      await result.current.setBatch({ 'crewhub-accent': 'purple', 'crewhub-lighting': 'dim' })
    })
    expect(localStorage.getItem('crewhub-accent')).toBe('purple')
    expect(mockUpdateSettingsBatch).toHaveBeenCalledWith({
      'crewhub-accent': 'purple',
      'crewhub-lighting': 'dim',
    })

    await act(async () => {
      await result.current.remove('crewhub-theme')
    })
    expect(localStorage.getItem('crewhub-theme')).toBeNull()
    expect(mockUpdateSetting).toHaveBeenLastCalledWith('crewhub-theme', '')
  })

  it('refresh forces a new API fetch', async () => {
    mockGetSettings.mockResolvedValueOnce({ one: '1' }).mockResolvedValueOnce({ one: '2' })

    const useSettings = await loadHook()
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.settings.one).toBe('1'))

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(result.current.settings.one).toBe('2'))
    expect(mockGetSettings).toHaveBeenCalledTimes(2)
  })
})
