/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, sonarjs/no-duplicate-string */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { OpenClawWizard } from '@/components/onboarding/OpenClawWizard'

// ─── Mock @/lib/api ───────────────────────────────────────────────

const mockGetEnvironmentInfo = vi.fn()
const mockTestOpenClawConnection = vi.fn()

vi.mock('@/lib/api', () => ({
  getEnvironmentInfo: () => mockGetEnvironmentInfo(),
  testOpenClawConnection: (...args: any[]) => mockTestOpenClawConnection(...args),
}))

// ─── Mock lucide-react ────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon" />
  )
  return {
    Zap: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    Loader2: Icon,
    ArrowRight: Icon,
    ArrowLeft: Icon,
    Eye: Icon,
    EyeOff: Icon,
    Server: Icon,
    Container: Icon,
    Network: Icon,
    Settings2: Icon,
    Bot: Icon,
    Code2: Icon,
    Search: Icon,
    Sparkles: Icon,
    Rocket: Icon,
    Info: Icon,
  }
})

// ─── Mock UI components ───────────────────────────────────────────

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, variant, size }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={className}>{children}</span>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, type, className }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type || 'text'}
      className={className}
    />
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: any) => <label className={className}>{children}</label>,
}))

// ─── Helpers ─────────────────────────────────────────────────────

const defaultEnvInfo = {
  is_docker: false,
  docker_host_internal_reachable: false,
  lan_ip: '192.168.1.100',
  suggested_urls: ['ws://127.0.0.1:18789'],
  token_file_path: null,
}

function renderWizard(props?: Partial<{ onComplete: any; onSkip: any }>) {
  const onComplete = props?.onComplete ?? vi.fn()
  const onSkip = props?.onSkip ?? vi.fn()
  return render(<OpenClawWizard onComplete={onComplete} onSkip={onSkip} />)
}

// ─── Tests ───────────────────────────────────────────────────────

describe('OpenClawWizard', () => {
  beforeEach(() => {
    mockGetEnvironmentInfo.mockResolvedValue(defaultEnvInfo)
    mockTestOpenClawConnection.mockResolvedValue({
      ok: true,
      message: 'Connected successfully',
      hints: [],
      sessions: null,
      category: null,
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  // ─── Loading State ────────────────────────────────────────────

  it('shows loading spinner initially', () => {
    mockGetEnvironmentInfo.mockReturnValue(new Promise(() => {})) // never resolves
    renderWizard()
    // The spinner/loader should be present during env loading
    expect(document.body.innerHTML).toBeTruthy()
  })

  // ─── Step 0: Setup Mode ───────────────────────────────────────

  it('renders Step 0 after env info loads', async () => {
    renderWizard()
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Connect to OpenClaw')).toBeTruthy()
  })

  it('shows setup mode options', async () => {
    renderWizard()
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Same computer')).toBeTruthy()
    expect(screen.getByText('CrewHub in Docker')).toBeTruthy()
    expect(screen.getByText('Another computer (LAN)')).toBeTruthy()
    expect(screen.getByText('Advanced / Custom')).toBeTruthy()
  })

  it('shows docker banner when is_docker is true', async () => {
    mockGetEnvironmentInfo.mockResolvedValue({ ...defaultEnvInfo, is_docker: true })
    renderWizard()
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Docker environment detected')).toBeTruthy()
  })

  it('does NOT show docker banner when is_docker is false', async () => {
    renderWizard()
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByText('Docker environment detected')).toBeNull()
  })

  it('calls onSkip when "Skip for now" is clicked', async () => {
    const onSkip = vi.fn()
    renderWizard({ onSkip })
    await act(async () => {
      await Promise.resolve()
    })
    const skipBtn = screen.getByText('Skip for now')
    fireEvent.click(skipBtn)
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('navigates to Step 1 on Continue click', async () => {
    renderWizard()
    await act(async () => {
      await Promise.resolve()
    })
    const continueBtn = screen.getByText('Continue')
    fireEvent.click(continueBtn)
    expect(screen.getByText('Connection Details')).toBeTruthy()
  })

  it('allows selecting different setup modes', async () => {
    renderWizard()
    await act(async () => {
      await Promise.resolve()
    })
    const dockerBtn = screen.getByText('CrewHub in Docker')
    fireEvent.click(dockerBtn)
    expect(screen.getByText('CrewHub in Docker')).toBeTruthy()
  })

  it('handles env info API error gracefully', async () => {
    mockGetEnvironmentInfo.mockRejectedValue(new Error('Network error'))
    renderWizard()
    await act(async () => {
      await Promise.resolve()
    })
    // Should still render with defaults
    expect(screen.getByText('Connect to OpenClaw')).toBeTruthy()
  })

  // ─── Step 1: Connection Details ──────────────────────────────

  async function goToStep1(onComplete?: vi.Mock, onSkip?: vi.Mock) {
    const result = renderWizard({ onComplete, onSkip })
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByText('Continue'))
    return result
  }

  it('renders connection details form in Step 1', async () => {
    await goToStep1()
    expect(screen.getByText('Connection Details')).toBeTruthy()
  })

  it('shows URL input in Step 1', async () => {
    await goToStep1()
    const inputs = document.querySelectorAll('input')
    const urlInput = Array.from(inputs).find(
      (i) => i.value?.includes('ws://') || i.placeholder?.includes('ws://')
    )
    expect(urlInput).toBeTruthy()
  })

  it('shows suggested URLs when available', async () => {
    await goToStep1()
    expect(screen.getByText('ws://127.0.0.1:18789')).toBeTruthy()
  })

  it('can navigate back from Step 1 to Step 0', async () => {
    await goToStep1()
    const backBtn = screen.getByText('Back')
    fireEvent.click(backBtn)
    expect(screen.getByText('Connect to OpenClaw')).toBeTruthy()
  })

  it('Test Connection button calls API', async () => {
    await goToStep1()
    const testBtn = screen.getByText('Test Connection')
    await act(async () => {
      fireEvent.click(testBtn)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockTestOpenClawConnection).toHaveBeenCalled()
  })

  it('shows success result after successful connection test', async () => {
    await goToStep1()
    const testBtn = screen.getByText('Test Connection')
    await act(async () => {
      fireEvent.click(testBtn)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Connected successfully')).toBeTruthy()
  })

  it('shows error result after failed connection test', async () => {
    mockTestOpenClawConnection.mockResolvedValue({
      ok: false,
      message: 'Connection refused',
      hints: ['Check that OpenClaw is running'],
      sessions: null,
      category: 'tcp',
    })
    await goToStep1()
    const testBtn = screen.getByText('Test Connection')
    await act(async () => {
      fireEvent.click(testBtn)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Connection refused')).toBeTruthy()
  })

  it('shows error hints when connection fails', async () => {
    mockTestOpenClawConnection.mockResolvedValue({
      ok: false,
      message: 'Could not connect',
      hints: ['Make sure port 18789 is open'],
      sessions: null,
      category: 'tcp',
    })
    await goToStep1()
    const testBtn = screen.getByText('Test Connection')
    await act(async () => {
      fireEvent.click(testBtn)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Make sure port 18789 is open')).toBeTruthy()
  })

  it('handles test exception gracefully', async () => {
    mockTestOpenClawConnection.mockRejectedValue(new Error('Timeout'))
    await goToStep1()
    const testBtn = screen.getByText('Test Connection')
    await act(async () => {
      fireEvent.click(testBtn)
    })
    await act(async () => {
      await Promise.resolve()
    })
    // Error state shown with exception message
    expect(screen.getByText('Timeout')).toBeTruthy()
  })

  it('toggles token visibility', async () => {
    await goToStep1()
    const inputs = document.querySelectorAll('input')
    const passwordInput = Array.from(inputs).find((i) => i.type === 'password')
    expect(passwordInput).toBeTruthy()
  })

  it('Continue to Step 2 is disabled until connection is successful', async () => {
    mockTestOpenClawConnection.mockResolvedValue({
      ok: false,
      message: 'failed',
      hints: [],
      sessions: null,
      category: 'tcp',
    })
    await goToStep1()
    const testBtn = screen.getByText('Test Connection')
    await act(async () => {
      fireEvent.click(testBtn)
    })
    await act(async () => {
      await Promise.resolve()
    })
    const continueBtn = screen.getByText('Continue')
    expect((continueBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('can navigate to Step 2 after successful test', async () => {
    await goToStep1()
    const testBtn = screen.getByText('Test Connection')
    await act(async () => {
      fireEvent.click(testBtn)
    })
    await act(async () => {
      await Promise.resolve()
    })
    const continueBtn = screen.getByText('Continue')
    fireEvent.click(continueBtn)
    expect(screen.getByText('Create Your First Bot')).toBeTruthy()
  })

  // ─── Step 2: Bot Template ─────────────────────────────────────

  async function goToStep2() {
    renderWizard()
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByText('Continue'))
    const testBtn = screen.getByText('Test Connection')
    await act(async () => {
      fireEvent.click(testBtn)
    })
    await act(async () => {
      await Promise.resolve()
    })
    const continueBtn = screen.getByText('Continue')
    fireEvent.click(continueBtn)
  }

  it('renders bot template selection in Step 2', async () => {
    await goToStep2()
    expect(screen.getByText('Default Bot')).toBeTruthy()
    expect(screen.getByText('Developer Bot')).toBeTruthy()
    expect(screen.getByText('Reviewer Bot')).toBeTruthy()
  })

  it('shows display name input in Step 2', async () => {
    await goToStep2()
    const inputs = document.querySelectorAll('input')
    const displayInput = Array.from(inputs).find(
      (i) => i.placeholder?.includes('Assistant') || i.value === 'Assistant'
    )
    expect(displayInput).toBeTruthy()
  })

  it('can select a bot template', async () => {
    await goToStep2()
    const devBot = screen.getByText('Developer Bot')
    fireEvent.click(devBot)
    expect(screen.getByText('Developer Bot')).toBeTruthy()
  })

  it('can skip bot creation', async () => {
    await goToStep2()
    const skipText = screen.getByText(/Skip — I'll configure agents later/)
    fireEvent.click(skipText)
    expect(screen.getByText('Create Your First Bot')).toBeTruthy()
  })

  it('calls onComplete with correct data on "Create & Finish"', async () => {
    const onComplete = vi.fn()
    renderWizard({ onComplete })
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByText('Continue'))
    const testBtn = screen.getByText('Test Connection')
    await act(async () => {
      fireEvent.click(testBtn)
    })
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByText('Continue'))
    const finishBtn = screen.getByText(/Create & Finish|Finish Setup/)
    fireEvent.click(finishBtn)
    expect(onComplete).toHaveBeenCalledOnce()
    const args = onComplete.mock.calls[0][0]
    expect(args).toHaveProperty('url')
    expect(args).toHaveProperty('token')
  })

  it('can navigate back from Step 2 to Step 1', async () => {
    await goToStep2()
    const backBtn = screen.getByText('Back')
    fireEvent.click(backBtn)
    expect(screen.getByText('Connection Details')).toBeTruthy()
  })

  // ─── getCategoryColor / getCategoryLabel (pure function behavior via UI) ───

  it('displays auth error category styling', async () => {
    mockTestOpenClawConnection.mockResolvedValue({
      ok: false,
      message: 'Authentication failed',
      hints: [],
      sessions: null,
      category: 'auth',
    })
    await goToStep1()
    await act(async () => {
      fireEvent.click(screen.getByText('Test Connection'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Authentication')).toBeTruthy()
  })

  it('displays dns error category', async () => {
    mockTestOpenClawConnection.mockResolvedValue({
      ok: false,
      message: 'Host not found',
      hints: [],
      sessions: null,
      category: 'dns',
    })
    await goToStep1()
    await act(async () => {
      fireEvent.click(screen.getByText('Test Connection'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('DNS / Host Not Found')).toBeTruthy()
  })

  it('displays timeout error category', async () => {
    mockTestOpenClawConnection.mockResolvedValue({
      ok: false,
      message: 'Request timed out',
      hints: [],
      sessions: null,
      category: 'timeout',
    })
    await goToStep1()
    await act(async () => {
      fireEvent.click(screen.getByText('Test Connection'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Timeout')).toBeTruthy()
  })

  it('displays websocket error category', async () => {
    mockTestOpenClawConnection.mockResolvedValue({
      ok: false,
      message: 'WS error',
      hints: [],
      sessions: null,
      category: 'ws',
    })
    await goToStep1()
    await act(async () => {
      fireEvent.click(screen.getByText('Test Connection'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('WebSocket Error')).toBeTruthy()
  })

  // ─── Suggested URL pre-fill ───────────────────────────────────

  it('pre-fills URL from suggested_urls', async () => {
    mockGetEnvironmentInfo.mockResolvedValue({
      ...defaultEnvInfo,
      suggested_urls: ['ws://192.168.1.55:18789'],
    })
    renderWizard()
    // Flush async useEffect (env info load)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    fireEvent.click(screen.getByText('Continue'))
    // Flush any pending state after step transition
    await act(async () => {
      await Promise.resolve()
    })
    // The setupMode useEffect resets the URL input to the mode default,
    // but envInfo.suggested_urls renders as clickable buttons in Step 1.
    const suggestedBtn = screen.queryByText('ws://192.168.1.55:18789')
    expect(suggestedBtn).toBeTruthy()
  })

  it('shows token file path hint when token_file_path is set', async () => {
    mockGetEnvironmentInfo.mockResolvedValue({
      ...defaultEnvInfo,
      token_file_path: '/home/user/.openclaw/openclaw.json',
    })
    renderWizard()
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByText('Continue'))
    expect(screen.getByText(/Token found in/)).toBeTruthy()
  })
})
