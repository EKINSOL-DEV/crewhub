/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BehaviorTab } from '@/components/settings/BehaviorTab'

const { mockToast, mockUpdateConfig, mockResetConfig } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockUpdateConfig: vi.fn(),
  mockResetConfig: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/hooks/useSessionConfig', () => ({
  useSessionConfig: () => ({
    statusActiveThresholdMs: 300000,
    statusSleepingThresholdMs: 1800000,
    botIdleThresholdMs: 120000,
    botSleepingThresholdMs: 1800000,
    tokenChangeThresholdMs: 30000,
    updatedAtActiveMs: 30000,
    parkingExpiryMs: 1800000,
    parkingMaxVisible: 15,
    maxVisibleBotsPerRoom: 8,
    botWalkSpeedActive: 1.2,
    botWalkSpeedIdle: 0.3,
    wanderMinWaitS: 4,
    wanderMaxWaitS: 8,
    logViewerPollMs: 3000,
    cronViewPollMs: 30000,
  }),
}))

vi.mock('@/lib/sessionConfig', () => ({
  SESSION_CONFIG_DEFAULTS: {
    statusActiveThresholdMs: 300000,
    statusSleepingThresholdMs: 1800000,
    botIdleThresholdMs: 120000,
    botSleepingThresholdMs: 1800000,
    tokenChangeThresholdMs: 30000,
    updatedAtActiveMs: 30000,
    parkingExpiryMs: 1800000,
    parkingMaxVisible: 15,
    maxVisibleBotsPerRoom: 8,
    botWalkSpeedActive: 1.2,
    botWalkSpeedIdle: 0.3,
    wanderMinWaitS: 4,
    wanderMaxWaitS: 8,
    logViewerPollMs: 3000,
    cronViewPollMs: 30000,
  },
  updateConfig: mockUpdateConfig,
  resetConfig: mockResetConfig,
  isOverridden: (key: string) => key === 'statusActiveThresholdMs',
  getOverrideCount: () => 1,
}))

const baseSettings = {
  autoRefresh: true,
  refreshInterval: 5000,
  parkingIdleThreshold: 120,
  playgroundSpeed: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  ;(navigator as any).mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
    enumerateDevices: vi.fn().mockResolvedValue([
      { kind: 'audioinput', deviceId: 'mic1', label: 'Built-in Mic' },
      { kind: 'videoinput', deviceId: 'cam1', label: 'Cam' },
    ]),
  }
})

describe('BehaviorTab', () => {
  it('updates core settings and zen preference', async () => {
    const onSettingsChange = vi.fn()
    render(<BehaviorTab settings={baseSettings as any} onSettingsChange={onSettingsChange} />)

    fireEvent.click(screen.getByRole('switch', { name: /auto-refresh/i }))
    expect(onSettingsChange).toHaveBeenCalled()

    const speedInput = document.getElementById('playground-speed') as HTMLInputElement
    fireEvent.change(speedInput, { target: { value: '1.5' } })
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ playgroundSpeed: 1.5 }))

    fireEvent.click(screen.getByRole('switch', { name: /launch in zen mode/i }))
    expect(localStorage.getItem('crewhub-zen-auto-launch')).toBe('true')
    expect(mockToast).toHaveBeenCalled()

    await waitFor(() => expect(screen.getByText('Built-in Mic')).toBeInTheDocument())
    fireEvent.change(document.querySelector('select') as HTMLSelectElement, {
      target: { value: 'mic1' },
    })
    expect(localStorage.getItem('crewhub-mic-device-id')).toBe('mic1')
  })

  it('renders thresholds section and resets overrides', async () => {
    const onSettingsChange = vi.fn()
    render(<BehaviorTab settings={baseSettings as any} onSettingsChange={onSettingsChange} />)

    fireEvent.click(screen.getByRole('button', { name: /thresholds & timing/i }))
    const activeToIdleInput = screen.getByDisplayValue('5')
    fireEvent.change(activeToIdleInput, { target: { value: '7' } })
    expect(mockUpdateConfig).toHaveBeenCalledWith('statusActiveThresholdMs', 420000)

    fireEvent.click(screen.getByRole('button', { name: /reset all to defaults/i }))
    expect(mockResetConfig).toHaveBeenCalled()
  })
})
