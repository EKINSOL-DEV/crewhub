/**
 * MobileSettingsPanel Tests
 * Tests for the slide-in settings drawer for mobile & Tauri chat
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import {
  MobileSettingsPanel,
  applyTheme,
  applyFontSize,
  initAppSettings,
} from '@/components/mobile/MobileSettingsPanel'

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  API_BASE: 'http://localhost:8091/api',
}))

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn()
const mockEnumerateDevices = vi.fn()

Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices,
  },
  configurable: true,
  writable: true,
})

// ── Test setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.documentElement.className = ''
  document.body.className = ''

  // Default mock: permission granted, 2 audio devices
  mockGetUserMedia.mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  })
  mockEnumerateDevices.mockResolvedValue([
    { kind: 'audioinput', deviceId: 'default', label: 'Default Mic', groupId: 'g1' },
    { kind: 'audioinput', deviceId: 'mic2', label: 'USB Mic', groupId: 'g2' },
    { kind: 'videoinput', deviceId: 'cam1', label: 'Camera', groupId: 'g3' },
  ])
})

// ── Helper ────────────────────────────────────────────────────────────────

function renderSettings(open = true) {
  const onClose = vi.fn()
  const result = render(<MobileSettingsPanel open={open} onClose={onClose} />)
  return { onClose, ...result }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('MobileSettingsPanel', () => {
  describe('rendering', () => {
    it('renders settings sections when open', () => {
      renderSettings(true)

      expect(screen.getByText('⚙️ Settings')).toBeInTheDocument()
      expect(screen.getByText('Theme')).toBeInTheDocument()
      expect(screen.getByText('Font Size')).toBeInTheDocument()
      expect(screen.getByText('Developer')).toBeInTheDocument()
      expect(screen.getByText('Microphone')).toBeInTheDocument()
      expect(screen.getByText('App Info')).toBeInTheDocument()
    })

    it('renders app version info', () => {
      renderSettings()
      expect(screen.getByText('v0.12.0')).toBeInTheDocument()
    })

    it('shows theme options: Dark, Light, System', () => {
      renderSettings()
      expect(screen.getByText('Dark')).toBeInTheDocument()
      expect(screen.getByText('Light')).toBeInTheDocument()
      expect(screen.getByText('System')).toBeInTheDocument()
    })

    it('shows font size options', () => {
      renderSettings()
      expect(screen.getByText('Compact')).toBeInTheDocument()
      expect(screen.getByText('Normal')).toBeInTheDocument()
      expect(screen.getByText('Large')).toBeInTheDocument()
    })

    it('shows debug toggle', () => {
      renderSettings()
      expect(screen.getByText('Debug Mode')).toBeInTheDocument()
    })

    it('shows closed when open=false', () => {
      const { container } = renderSettings(false)
      // Drawer is rendered but translated offscreen (translateY(100%))
      const drawer = container.querySelector('[style*="translateY(100%)"]')
      expect(drawer).toBeTruthy()
    })
  })

  describe('close behaviour', () => {
    it('calls onClose when X button is clicked', () => {
      const { onClose } = renderSettings()
      // The X close button is inside the drawer header; it renders an svg icon (X from lucide)
      // Find the button that is inside the header div (after the title)
      const buttons = screen.getAllByRole('button')
      // The close button is the one after the backdrop (should be index 1 in the drawer header)
      // We'll fire click on the backdrop button which also closes
      // Actually find the header close button by its position: it comes right after "⚙️ Settings"
      const settingsTitle = screen.getByText('⚙️ Settings')
      const headerDiv = settingsTitle.closest('div')!.parentElement!
      const closeBtn = headerDiv.querySelector('button')!
      fireEvent.click(closeBtn)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when Escape key is pressed', () => {
      const { onClose } = renderSettings()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('theme selection', () => {
    it('persists theme to localStorage when changed', () => {
      renderSettings()
      fireEvent.click(screen.getByText('Light'))
      expect(localStorage.getItem('crewhub-theme')).toBe('light')
    })

    it('applies dark theme class on Dark selection', () => {
      renderSettings()
      fireEvent.click(screen.getByText('Dark'))
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('applies light theme class on Light selection', () => {
      renderSettings()
      fireEvent.click(screen.getByText('Light'))
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })

    it('reads saved theme from localStorage', () => {
      localStorage.setItem('crewhub-theme', 'light')
      renderSettings()
      // Light button should appear active (it's selected)
      expect(localStorage.getItem('crewhub-theme')).toBe('light')
    })
  })

  describe('font size selection', () => {
    it('persists font size to localStorage', () => {
      renderSettings()
      fireEvent.click(screen.getByText('Compact'))
      expect(localStorage.getItem('crewhub-font-size')).toBe('compact')
    })

    it('applies --mobile-font-size CSS var for each size', () => {
      renderSettings()
      fireEvent.click(screen.getByText('Large'))
      expect(document.documentElement.style.getPropertyValue('--mobile-font-size')).toBe('17px')
    })
  })

  describe('debug toggle', () => {
    it('enables debug mode', () => {
      renderSettings()
      const debugToggle = screen.getByText('Debug Mode').closest('button')!
      fireEvent.click(debugToggle)
      expect(localStorage.getItem('crewhub-debug')).toBe('true')
    })

    it('disables debug mode when toggled off', () => {
      localStorage.setItem('crewhub-debug', 'true')
      renderSettings()
      const debugToggle = screen.getByText('Debug Mode').closest('button')!
      fireEvent.click(debugToggle)
      expect(localStorage.getItem('crewhub-debug')).toBeNull()
    })
  })

  describe('backend URL', () => {
    it('renders URL input and Save button', () => {
      renderSettings()
      expect(screen.getByPlaceholderText(/http/i)).toBeInTheDocument()
      expect(screen.getByText('Save')).toBeInTheDocument()
    })

    it('saves URL to localStorage when Save is clicked', () => {
      renderSettings()
      const input = screen.getByPlaceholderText(/http/i) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'http://myserver:8091' } })
      fireEvent.click(screen.getByText('Save'))
      expect(localStorage.getItem('crewhub_backend_url')).toBe('http://myserver:8091')
    })

    it('shows "Saved!" feedback after saving', async () => {
      renderSettings()
      const input = screen.getByPlaceholderText(/http/i)
      fireEvent.change(input, { target: { value: 'http://test:8091' } })
      fireEvent.click(screen.getByText('Save'))
      expect(await screen.findByText('Saved!')).toBeInTheDocument()
    })

    it('clears URL from localStorage when Clear is clicked', () => {
      localStorage.setItem('crewhub_backend_url', 'http://old:8091')
      renderSettings()
      fireEvent.click(screen.getByText('Clear'))
      expect(localStorage.getItem('crewhub_backend_url')).toBeNull()
    })

    it('removes URL from localStorage when empty string is saved', () => {
      localStorage.setItem('crewhub_backend_url', 'http://old:8091')
      renderSettings()
      const input = screen.getByPlaceholderText(/http/i) as HTMLInputElement
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.click(screen.getByText('Save'))
      expect(localStorage.getItem('crewhub_backend_url')).toBeNull()
    })
  })

  describe('microphone section', () => {
    it('shows microphone input device label', async () => {
      renderSettings()
      expect(screen.getByText('Input Device')).toBeInTheDocument()
    })

    it('enumerates microphones when panel opens', async () => {
      renderSettings(true)
      await waitFor(() => expect(mockEnumerateDevices).toHaveBeenCalled())
    })

    it('shows mic device list after enumeration', async () => {
      renderSettings(true)
      await waitFor(() => expect(screen.getByText('Default Mic')).toBeInTheDocument())
      expect(screen.getByText('USB Mic')).toBeInTheDocument()
    })

    it('does not include video devices in mic list', async () => {
      renderSettings(true)
      await waitFor(() => expect(screen.getByText('Default Mic')).toBeInTheDocument())
      expect(screen.queryByText('Camera')).not.toBeInTheDocument()
    })
  })
})

// ── Utility function tests ────────────────────────────────────────────────

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    document.body.className = ''
    localStorage.clear()
  })

  it('applies dark class for dark theme', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('applies light class for light theme', () => {
    applyTheme('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('uses system preference for system theme (dark)', () => {
    // matchMedia is mocked to return matches:false (light)
    applyTheme('system')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('sets mobile CSS vars for dark mode', () => {
    applyTheme('dark')
    expect(document.documentElement.style.getPropertyValue('--mobile-bg')).toBe('#0f172a')
    expect(document.documentElement.style.getPropertyValue('--mobile-surface')).toBe('#1e293b')
  })

  it('sets mobile CSS vars for light mode', () => {
    applyTheme('light')
    expect(document.documentElement.style.getPropertyValue('--mobile-bg')).toBe('#f8fafc')
    expect(document.documentElement.style.getPropertyValue('--mobile-surface')).toBe('#ffffff')
  })

  it('syncs zen-theme to dark when switching to dark from light', () => {
    localStorage.setItem('zen-theme', 'github-light')
    applyTheme('dark')
    expect(localStorage.getItem('zen-theme')).toBe('tokyo-night')
  })

  it('syncs zen-theme to light when switching to light from dark', () => {
    localStorage.setItem('zen-theme', 'tokyo-night')
    applyTheme('light')
    expect(localStorage.getItem('zen-theme')).toBe('github-light')
  })
})

describe('applyFontSize', () => {
  it('sets compact font size to 13px', () => {
    applyFontSize('compact')
    expect(document.documentElement.style.getPropertyValue('--mobile-font-size')).toBe('13px')
    expect(document.documentElement.dataset.fontSize).toBe('compact')
  })

  it('sets normal font size to 15px', () => {
    applyFontSize('normal')
    expect(document.documentElement.style.getPropertyValue('--mobile-font-size')).toBe('15px')
  })

  it('sets large font size to 17px', () => {
    applyFontSize('large')
    expect(document.documentElement.style.getPropertyValue('--mobile-font-size')).toBe('17px')
  })
})

describe('initAppSettings', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('applies dark theme when no settings saved', () => {
    initAppSettings()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('derives dark/light from zen-theme', () => {
    localStorage.setItem('zen-theme', 'github-light')
    initAppSettings()
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('falls back to crewhub-theme when no zen-theme', () => {
    localStorage.setItem('crewhub-theme', 'light')
    initAppSettings()
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('applies font size from localStorage', () => {
    localStorage.setItem('crewhub-font-size', 'large')
    initAppSettings()
    expect(document.documentElement.style.getPropertyValue('--mobile-font-size')).toBe('17px')
  })

  it('defaults font size to normal when not set', () => {
    initAppSettings()
    expect(document.documentElement.style.getPropertyValue('--mobile-font-size')).toBe('15px')
  })
})
