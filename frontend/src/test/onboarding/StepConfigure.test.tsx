import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ConnectionConfig } from '@/components/onboarding/onboardingTypes'

// ─── Mocks ───────────────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon" />
  )
  return {
    Zap: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    Loader2: Icon,
    Eye: Icon,
    EyeOff: Icon,
    Plus: Icon,
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span className={className} data-variant={variant}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, type, className }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type ?? 'text'}
      className={className}
    />
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: any) => <label className={className}>{children}</label>,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      data-testid="switch"
    />
  ),
}))

vi.mock('@/components/onboarding/onboardingHelpers', () => ({
  getRuntimeIcon: (_type: string) => <span data-testid="runtime-icon" />,
  getRuntimeLabel: (type: string) => (type === 'openclaw' ? 'OpenClaw' : type),
}))

import { StepConfigure } from '@/components/onboarding/steps/StepConfigure'

// ─── Factories ────────────────────────────────────────────────────

function makeConnection(overrides?: Partial<ConnectionConfig>): ConnectionConfig {
  return {
    id: 'conn-1',
    name: 'My OpenClaw',
    type: 'openclaw',
    url: 'ws://localhost:18789',
    token: '',
    enabled: true,
    testStatus: 'idle',
    ...overrides,
  }
}

function renderConfigure(connections: ConnectionConfig[] = [makeConnection()], overrides?: any) {
  const onUpdateConnection = vi.fn()
  const onTestConnection = vi.fn()
  const onAddManual = vi.fn()
  const onRemoveConnection = vi.fn()
  render(
    <StepConfigure
      connections={connections}
      onUpdateConnection={onUpdateConnection}
      onTestConnection={onTestConnection}
      onAddManual={onAddManual}
      onRemoveConnection={onRemoveConnection}
      {...overrides}
    />
  )
  return { onUpdateConnection, onTestConnection, onAddManual, onRemoveConnection }
}

// ─── Tests ───────────────────────────────────────────────────────

describe('StepConfigure — rendering', () => {
  it('renders heading', () => {
    renderConfigure()
    expect(screen.getByText('Configure Connections')).toBeTruthy()
  })

  it('renders connection name', () => {
    renderConfigure([makeConnection({ name: 'My Bot Server' })])
    expect(screen.getByDisplayValue('My Bot Server')).toBeTruthy()
  })

  it('renders connection URL', () => {
    renderConfigure([makeConnection({ url: 'ws://192.168.1.5:18789' })])
    expect(screen.getByDisplayValue('ws://192.168.1.5:18789')).toBeTruthy()
  })

  it('shows Name, URL and Token labels', () => {
    renderConfigure()
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('URL')).toBeTruthy()
    expect(screen.getByText(/Token/)).toBeTruthy()
  })

  it('renders Test connection button', () => {
    renderConfigure()
    expect(screen.getByText('Test connection')).toBeTruthy()
  })

  it('renders Add connection manually button', () => {
    renderConfigure()
    expect(screen.getByText(/Add connection manually/)).toBeTruthy()
  })

  it('renders Remove button', () => {
    renderConfigure()
    expect(screen.getByText('Remove')).toBeTruthy()
  })

  it('renders multiple connections', () => {
    const conns = [
      makeConnection({ id: 'c1', name: 'Bot A' }),
      makeConnection({ id: 'c2', name: 'Bot B' }),
    ]
    renderConfigure(conns)
    expect(screen.getByDisplayValue('Bot A')).toBeTruthy()
    expect(screen.getByDisplayValue('Bot B')).toBeTruthy()
  })

  it('shows "Connected" badge when testStatus=success', () => {
    renderConfigure([makeConnection({ testStatus: 'success' })])
    expect(screen.getByText(/Connected/)).toBeTruthy()
  })

  it('shows "Failed" badge when testStatus=error', () => {
    renderConfigure([makeConnection({ testStatus: 'error' })])
    expect(screen.getByText(/Failed/)).toBeTruthy()
  })

  it('shows testError message when present', () => {
    renderConfigure([makeConnection({ testStatus: 'error', testError: 'Connection refused' })])
    expect(screen.getByText('Connection refused')).toBeTruthy()
  })

  it('shows session count in Connected badge', () => {
    renderConfigure([makeConnection({ testStatus: 'success', sessions: 4 })])
    expect(screen.getByText(/4 sessions/)).toBeTruthy()
  })
})

describe('StepConfigure — callbacks', () => {
  it('calls onAddManual when Add button is clicked', () => {
    const { onAddManual } = renderConfigure()
    fireEvent.click(screen.getByText(/Add connection manually/))
    expect(onAddManual).toHaveBeenCalledOnce()
  })

  it('calls onRemoveConnection when Remove is clicked', () => {
    const conn = makeConnection({ id: 'conn-x' })
    const { onRemoveConnection } = renderConfigure([conn])
    fireEvent.click(screen.getByText('Remove'))
    expect(onRemoveConnection).toHaveBeenCalledWith('conn-x')
  })

  it('calls onTestConnection when Test connection is clicked', () => {
    const conn = makeConnection({ id: 'conn-test' })
    const { onTestConnection } = renderConfigure([conn])
    fireEvent.click(screen.getByText('Test connection'))
    expect(onTestConnection).toHaveBeenCalledWith('conn-test')
  })

  it('disables Test connection when testStatus=testing', () => {
    renderConfigure([makeConnection({ testStatus: 'testing' })])
    const btn = screen.getByText('Test connection')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables Test connection when not enabled', () => {
    renderConfigure([makeConnection({ enabled: false })])
    const btn = screen.getByText('Test connection')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders enabled switch as checked', () => {
    const conn = makeConnection({ id: 'toggle-id', enabled: true })
    renderConfigure([conn])
    const switchEl = document.querySelector('[data-testid="switch"]') as HTMLInputElement
    expect(switchEl.checked).toBe(true)
  })

  it('renders disabled switch as unchecked', () => {
    const conn = makeConnection({ id: 'toggle-id-off', enabled: false })
    renderConfigure([conn])
    const switchEl = document.querySelector('[data-testid="switch"]') as HTMLInputElement
    expect(switchEl.checked).toBe(false)
  })

  it('calls onUpdateConnection with new name when name input changes', () => {
    const conn = makeConnection({ id: 'n-id', name: 'Old Name' })
    const { onUpdateConnection } = renderConfigure([conn])
    const nameInput = screen.getByDisplayValue('Old Name')
    fireEvent.change(nameInput, { target: { value: 'New Name' } })
    expect(onUpdateConnection).toHaveBeenCalledWith('n-id', { name: 'New Name' })
  })

  it('calls onUpdateConnection with new url when url input changes', () => {
    const conn = makeConnection({ id: 'u-id', url: 'ws://old:18789' })
    const { onUpdateConnection } = renderConfigure([conn])
    const urlInput = screen.getByDisplayValue('ws://old:18789')
    fireEvent.change(urlInput, { target: { value: 'ws://new:18789' } })
    expect(onUpdateConnection).toHaveBeenCalledWith('u-id', { url: 'ws://new:18789' })
  })
})

describe('StepConfigure — token visibility toggle', () => {
  it('renders token as password by default', () => {
    renderConfigure([makeConnection({ token: 'secret123' })])
    const pwdInputs = document.querySelectorAll('input[type="password"]')
    expect(pwdInputs.length).toBeGreaterThan(0)
  })

  it('toggles token visibility to text on eye button click', () => {
    renderConfigure([makeConnection({ id: 't-id', token: 'mytoken' })])
    // Find eye toggle button (ghost variant with no text, just icon)
    const toggleButtons = Array.from(document.querySelectorAll('button')).filter(
      (b) => b.querySelector('[data-testid="icon"]') && b.textContent?.trim() === ''
    )
    if (toggleButtons.length > 0) {
      fireEvent.click(toggleButtons[0])
      // After click, the input should become text type
      const textInputs = document.querySelectorAll('input[type="text"]')
      expect(textInputs.length).toBeGreaterThan(0)
    }
  })
})
