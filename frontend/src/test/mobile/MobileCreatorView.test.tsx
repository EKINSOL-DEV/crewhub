/**
 * MobileCreatorView Tests
 * Tests for the mobile-friendly Creator / Prop Maker view
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { MobileCreatorView } from '@/components/mobile/MobileCreatorView'

// ── R3F / Three.js Mocks ──────────────────────────────────────────────────

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: () => {},
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Stage: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/world3d/zones/creator/DynamicProp', () => ({
  DynamicProp: ({ parts }: any) => <div data-testid="dynamic-prop" data-parts={parts?.length} />,
}))

// ── fetch mock for save-prop ──────────────────────────────────────────────

const mockFetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockReset()
  globalThis.fetch = mockFetch as any
})

// ── Helper to build a MessageEvent for EventSource ────────────────────────

function makeMessageEvent(type: string, data: object): MessageEvent {
  const evt = new MessageEvent(type, { data: JSON.stringify(data) })
  return evt
}

// ── EventSource mock factory ──────────────────────────────────────────────

type ESListener = (e: any) => void
let capturedListeners: Map<string, Set<ESListener>> = new Map()
let mockESInstance: any = null

class MockEventSource {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2

  url: string
  readyState = MockEventSource.OPEN
  onopen: ((ev: Event) => any) | null = null
  onerror: ((ev: Event) => any) | null = null
  onmessage: ((ev: MessageEvent) => any) | null = null
  private listeners = new Map<string, Set<ESListener>>()

  constructor(url: string) {
    this.url = url
    capturedListeners = this.listeners
    mockESInstance = this
  }

  addEventListener(type: string, listener: ESListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }

  removeEventListener(type: string, listener: ESListener) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatchEvent(type: string, data: object) {
    const event = makeMessageEvent(type, data)
    this.listeners.get(type)?.forEach((cb) => cb(event))
  }

  close() {
    this.readyState = MockEventSource.CLOSED
  }
}

// Replace global EventSource with mock
;(globalThis as any).EventSource = MockEventSource

// ── Tests ─────────────────────────────────────────────────────────────────

describe('MobileCreatorView', () => {
  it('renders header with back button and title', () => {
    const onBack = vi.fn()
    render(<MobileCreatorView onBack={onBack} />)

    expect(screen.getByText('Creator')).toBeInTheDocument()
    expect(screen.getByText('⚡ Prop Maker')).toBeInTheDocument()
    expect(screen.getByText('📋 History')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<MobileCreatorView onBack={onBack} />)

    // The ArrowLeft button is the first button in the header
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('switches between generate and history tabs', () => {
    render(<MobileCreatorView onBack={() => {}} />)

    expect(screen.getByPlaceholderText(/glowing mushroom lamp/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText('📋 History'))
    expect(screen.queryByPlaceholderText(/glowing mushroom lamp/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('⚡ Prop Maker'))
    expect(screen.getByPlaceholderText(/glowing mushroom lamp/i)).toBeInTheDocument()
  })

  it('shows and hides example prompts', () => {
    render(<MobileCreatorView onBack={() => {}} />)

    expect(screen.queryByText('A glowing mushroom lamp')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Example prompts'))
    expect(screen.getByText('A glowing mushroom lamp')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Example prompts'))
    expect(screen.queryByText('A glowing mushroom lamp')).not.toBeInTheDocument()
  })

  it('fills input when example prompt is clicked', () => {
    render(<MobileCreatorView onBack={() => {}} />)

    fireEvent.click(screen.getByText('Example prompts'))
    fireEvent.click(screen.getByText('A glowing mushroom lamp'))

    expect(screen.queryByText('A glowing mushroom lamp')).not.toBeInTheDocument() // examples hidden
    const textarea = screen.getByPlaceholderText(/glowing mushroom lamp/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('A glowing mushroom lamp')
  })

  it('generate button is disabled when textarea is empty', () => {
    render(<MobileCreatorView onBack={() => {}} />)

    const generateBtn = screen.getByText('⚡ Create Prop').closest('button')!
    expect(generateBtn).toBeDisabled()
  })

  it('enables generate button when text is entered', () => {
    render(<MobileCreatorView onBack={() => {}} />)

    const textarea = screen.getByPlaceholderText(/glowing mushroom lamp/i)
    fireEvent.change(textarea, { target: { value: 'A cool robot' } })

    const generateBtn = screen.getByText('⚡ Create Prop').closest('button')!
    expect(generateBtn).not.toBeDisabled()
  })

  it('starts generation on button click and shows Generating...', async () => {
    render(<MobileCreatorView onBack={() => {}} />)

    const textarea = screen.getByPlaceholderText(/glowing mushroom lamp/i)
    fireEvent.change(textarea, { target: { value: 'A neon sign' } })
    fireEvent.click(screen.getByText('⚡ Create Prop'))

    expect(await screen.findByText('Generating...')).toBeInTheDocument()
  })

  it('shows thinking lines during generation', async () => {
    render(<MobileCreatorView onBack={() => {}} />)

    const textarea = screen.getByPlaceholderText(/glowing mushroom lamp/i)
    fireEvent.change(textarea, { target: { value: 'A glowing orb' } })
    fireEvent.click(screen.getByText('⚡ Create Prop'))

    await waitFor(() => expect(mockESInstance).not.toBeNull())

    act(() => {
      mockESInstance.dispatchEvent('status', { message: 'Preparing model...' })
      mockESInstance.dispatchEvent('model', { modelLabel: 'Claude Sonnet 4.5' })
      mockESInstance.dispatchEvent('thinking', { text: 'Planning geometry...' })
    })

    await waitFor(() => expect(screen.getByText('Preparing model...')).toBeInTheDocument())
    expect(screen.getByText('🎯 Model: Claude Sonnet 4.5')).toBeInTheDocument()
    expect(screen.getByText('💭 Planning geometry...')).toBeInTheDocument()
  })

  it('shows result after complete event with valid parts', async () => {
    render(<MobileCreatorView onBack={() => {}} />)

    const textarea = screen.getByPlaceholderText(/glowing mushroom lamp/i)
    fireEvent.change(textarea, { target: { value: 'A cool lamp' } })
    fireEvent.click(screen.getByText('⚡ Create Prop'))

    await waitFor(() => expect(mockESInstance).not.toBeNull())

    act(() => {
      mockESInstance.dispatchEvent('complete', {
        name: 'Cool Lamp',
        parts: [
          {
            type: 'box',
            position: [0, 0, 0],
            scale: [1, 1, 1],
            color: '#ff0000',
          },
        ],
        code: 'export const prop = ...',
      })
    })

    await waitFor(() => expect(screen.getByText('Cool Lamp')).toBeInTheDocument())
    expect(screen.getByText(/1 part generated/)).toBeInTheDocument()
    expect(screen.getByText('💾 Save to Library')).toBeInTheDocument()
    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
  })

  it('shows error message from error event', async () => {
    render(<MobileCreatorView onBack={() => {}} />)

    const textarea = screen.getByPlaceholderText(/glowing mushroom lamp/i)
    fireEvent.change(textarea, { target: { value: 'Bad prompt' } })
    fireEvent.click(screen.getByText('⚡ Create Prop'))

    await waitFor(() => expect(mockESInstance).not.toBeNull())

    act(() => {
      mockESInstance.dispatchEvent('error', { message: 'Rate limit exceeded' })
    })

    await waitFor(() => expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument())
  })

  it('saves prop successfully', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<MobileCreatorView onBack={() => {}} />)

    const textarea = screen.getByPlaceholderText(/glowing mushroom lamp/i)
    fireEvent.change(textarea, { target: { value: 'A crystal ball' } })
    fireEvent.click(screen.getByText('⚡ Create Prop'))

    await waitFor(() => expect(mockESInstance).not.toBeNull())

    act(() => {
      mockESInstance.dispatchEvent('complete', {
        name: 'Crystal Ball',
        parts: [{ type: 'sphere', position: [0, 0, 0], scale: [1, 1, 1], color: '#fff' }],
        code: '',
      })
    })

    await waitFor(() => expect(screen.getByText('Crystal Ball')).toBeInTheDocument())

    fireEvent.click(screen.getByText('💾 Save to Library'))

    await waitFor(() => expect(screen.getByText('✅ Saved!')).toBeInTheDocument())
  })

  it('shows save error when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Disk full' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<MobileCreatorView onBack={() => {}} />)

    const textarea = screen.getByPlaceholderText(/glowing mushroom lamp/i)
    fireEvent.change(textarea, { target: { value: 'Star wars lightsaber' } })
    fireEvent.click(screen.getByText('⚡ Create Prop'))

    await waitFor(() => expect(mockESInstance).not.toBeNull())

    act(() => {
      mockESInstance.dispatchEvent('complete', {
        name: 'Lightsaber',
        parts: [{ type: 'cylinder', position: [0, 0, 0], scale: [1, 1, 1], color: '#ff0000' }],
        code: '',
      })
    })

    await waitFor(() => expect(screen.getByText('Lightsaber')).toBeInTheDocument())

    fireEvent.click(screen.getByText('💾 Save to Library'))

    await waitFor(() => expect(screen.getByText(/Disk full/)).toBeInTheDocument())
  })

  it('shows history tab with empty state when no records', () => {
    render(<MobileCreatorView onBack={() => {}} />)

    fireEvent.click(screen.getByText('📋 History'))
    expect(screen.getByText(/No props generated yet/)).toBeInTheDocument()
  })

  it('shows "No parts" error when complete event has empty parts', async () => {
    render(<MobileCreatorView onBack={() => {}} />)

    const textarea = screen.getByPlaceholderText(/glowing mushroom lamp/i)
    fireEvent.change(textarea, { target: { value: 'Empty prop' } })
    fireEvent.click(screen.getByText('⚡ Create Prop'))

    await waitFor(() => expect(mockESInstance).not.toBeNull())

    act(() => {
      mockESInstance.dispatchEvent('complete', { name: 'Empty', parts: [], code: '' })
    })

    await waitFor(() => expect(screen.getByText(/no geometry parts/i)).toBeInTheDocument())
  })
})
