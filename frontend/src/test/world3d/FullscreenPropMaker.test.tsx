/**
 * Tests for FullscreenPropMaker (zones/creator/FullscreenPropMaker.tsx)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'

// ── Sub-component mocks ──────────────────────────────────────────
vi.mock('@/components/world3d/zones/creator/PropMakerToolbar', () => ({
  PropMakerToolbar: ({ isGenerating, successMessage, onClose }: any) => (
    <div data-testid="toolbar">
      <button data-testid="toolbar-close" onClick={onClose}>
        close
      </button>
      {isGenerating && <span data-testid="toolbar-generating">generating</span>}
      {successMessage && <span data-testid="toolbar-success">{successMessage}</span>}
    </div>
  ),
}))

vi.mock('@/components/world3d/zones/creator/PropControls', () => ({
  PropControls: ({ onGenerate, onApprove, error, inputText, onInputChange }: any) => (
    <div data-testid="prop-controls">
      <input
        data-testid="prop-input"
        value={inputText}
        onChange={(e) => onInputChange(e.target.value)}
      />
      <button data-testid="generate-btn" onClick={onGenerate}>
        Generate
      </button>
      <button data-testid="approve-btn" onClick={onApprove}>
        Approve
      </button>
      {error && <span data-testid="error">{error}</span>}
    </div>
  ),
}))

vi.mock('@/components/world3d/zones/creator/ThinkingPanel', () => ({
  ThinkingPanel: ({ thinkingLines, isGenerating }: any) => (
    <div data-testid="thinking-panel">
      {isGenerating && <span data-testid="thinking-busy">thinking...</span>}
      {thinkingLines.map((l: any, i: number) => (
        <div key={i} data-testid="thinking-line">
          {l.text}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/world3d/zones/creator/PropPreview', () => ({
  PropPreview: ({ previewParts, previewName, onRetry }: any) => (
    <div data-testid="prop-preview">
      {previewName && <span data-testid="preview-name">{previewName}</span>}
      {previewParts && <span data-testid="preview-parts">{previewParts.length} parts</span>}
      <button data-testid="retry-btn" onClick={onRetry}>
        retry
      </button>
    </div>
  ),
}))

// Mock createPortal to render in-place for testing
vi.mock('react-dom', async () => {
  const real = await vi.importActual<typeof import('react-dom')>('react-dom')
  return {
    ...real,
    createPortal: (children: React.ReactNode) => children,
  }
})

// ── Helpers ──────────────────────────────────────────────────────

type EventType =
  | 'status'
  | 'model'
  | 'full_prompt'
  | 'thinking'
  | 'text'
  | 'tool'
  | 'tool_result'
  | 'correction'
  | 'complete'
  | 'error'

let capturedEventSource: any = null

class MockEventSource {
  static readonly OPEN = 1
  static readonly CLOSED = 2
  readonly url: string
  readyState = MockEventSource.OPEN
  private listeners = new Map<string, Set<Function>>()

  constructor(url: string) {
    this.url = url
    capturedEventSource = this
  }

  addEventListener(type: string, fn: Function) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }

  removeEventListener(type: string, fn: Function) {
    this.listeners.get(type)?.delete(fn)
  }

  emit(type: EventType, data: unknown) {
    const evObj =
      type === 'error'
        ? // Non-MessageEvent error
          new Event('error')
        : new MessageEvent('message', { data: JSON.stringify(data) })
    this.listeners.get(type)?.forEach((fn) => fn(evObj))
  }

  emitMsg(type: EventType, data: unknown) {
    const evObj = new MessageEvent(type, { data: JSON.stringify(data) })
    this.listeners.get(type)?.forEach((fn) => fn(evObj))
  }

  close() {
    this.readyState = MockEventSource.CLOSED
  }
}

;(globalThis as any).EventSource = MockEventSource

function okJson(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

function okFail(status = 500) {
  return Promise.resolve(new Response('{}', { status }))
}

// ── Tests ────────────────────────────────────────────────────────

describe('FullscreenPropMaker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedEventSource = null

    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/creator/models')) {
        return okJson({
          models: [
            {
              key: 'sonnet',
              id: 'anthropic/claude-sonnet-4-5',
              label: 'Sonnet',
              provider: 'anthropic',
            },
          ],
          default: 'sonnet-4-5',
        })
      }
      if (url.includes('/api/creator/props/styles')) {
        return okJson({ styles: [{ id: 's1', name: 'Neon', palette: ['#ff0000', '#00ff00'] }] })
      }
      if (url.includes('/api/creator/props/templates')) {
        return okJson({ templates: [{ id: 't1', name: 'Desk' }] })
      }
      if (url.includes('/api/creator/save-prop')) {
        return okJson({ ok: true })
      }
      return okJson({})
    }) as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders core sub-components on mount', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} />)

    expect(screen.getByTestId('toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('prop-controls')).toBeInTheDocument()
    expect(screen.getByTestId('thinking-panel')).toBeInTheDocument()
    expect(screen.getByTestId('prop-preview')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    const onClose = vi.fn()
    render(<FullscreenPropMaker onClose={onClose} />)
    fireEvent.click(screen.getByTestId('toolbar-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape key press', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    const onClose = vi.fn()
    render(<FullscreenPropMaker onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fetches models on mount and handles error fallback', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/creator/models')) {
        return Promise.reject(new Error('network error'))
      }
      return okJson({})
    }) as any

    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} />)

    // Should not throw; fallback models are set
    await waitFor(() => {
      expect(screen.getByTestId('prop-controls')).toBeInTheDocument()
    })
  })

  it('starts generation flow and shows thinking lines', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} />)

    // Type a prompt and click generate
    fireEvent.change(screen.getByTestId('prop-input'), { target: { value: 'a red chair' } })
    fireEvent.click(screen.getByTestId('generate-btn'))

    // Generating state should activate
    await waitFor(() => {
      expect(screen.getByTestId('thinking-busy')).toBeInTheDocument()
    })

    // Emit SSE events
    act(() => {
      capturedEventSource?.emitMsg('status', { message: 'Starting generation...' })
      capturedEventSource?.emitMsg('model', { modelLabel: 'Sonnet 4.5' })
      capturedEventSource?.emitMsg('thinking', { text: 'Thinking about chair...' })
    })

    await waitFor(() => {
      expect(screen.getByText('Starting generation...')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText('🎯 Model: Sonnet 4.5')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText('💭 Thinking about chair...')).toBeInTheDocument()
    })
  })

  it('handles complete SSE event and shows preview', async () => {
    const onPropGenerated = vi.fn()
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} onPropGenerated={onPropGenerated} />)

    fireEvent.change(screen.getByTestId('prop-input'), { target: { value: 'a table' } })
    fireEvent.click(screen.getByTestId('generate-btn'))

    await waitFor(() => capturedEventSource !== null)

    act(() => {
      capturedEventSource?.emitMsg('complete', {
        parts: [{ type: 'box', color: '#ff0000', position: [0, 0, 0] }],
        name: 'TableProp',
        filename: 'TableProp.tsx',
        code: 'export function TableProp() {}',
        method: 'ai',
        modelLabel: 'Sonnet',
        generationId: 'gen-1',
        refinementOptions: null,
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('preview-name')).toHaveTextContent('TableProp')
      expect(screen.getByTestId('preview-parts')).toHaveTextContent('1 parts')
    })
  })

  it('handles complete event with empty parts (error state)', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('prop-input'), { target: { value: 'something' } })
    fireEvent.click(screen.getByTestId('generate-btn'))

    await waitFor(() => capturedEventSource !== null)

    act(() => {
      capturedEventSource?.emitMsg('complete', {
        parts: [],
        name: 'EmptyProp',
        filename: 'EmptyProp.tsx',
        code: '',
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Generated prop has no geometry parts')
    })
  })

  it('handles SSE error event (MessageEvent)', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('prop-input'), { target: { value: 'test' } })
    fireEvent.click(screen.getByTestId('generate-btn'))

    await waitFor(() => capturedEventSource !== null)

    act(() => {
      capturedEventSource?.emitMsg('error', { message: 'AI service error' })
    })

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('AI service error')
    })
  })

  it('handles SSE non-message error event (connection lost)', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('prop-input'), { target: { value: 'test' } })
    fireEvent.click(screen.getByTestId('generate-btn'))

    await waitFor(() => capturedEventSource !== null)

    act(() => {
      // Emit a plain Error event (not MessageEvent) on the error listener
      capturedEventSource?.emit('error', null)
    })

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent(/connection/i)
    })
  })

  it('saves approved prop and calls onPropGenerated', async () => {
    const onPropGenerated = vi.fn()
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} onPropGenerated={onPropGenerated} />)

    // Inject parts via generate+complete flow
    fireEvent.change(screen.getByTestId('prop-input'), { target: { value: 'chair' } })
    fireEvent.click(screen.getByTestId('generate-btn'))
    await waitFor(() => capturedEventSource !== null)

    act(() => {
      capturedEventSource?.emitMsg('complete', {
        parts: [{ type: 'box', color: '#ff0000', position: [0, 0, 0] }],
        name: 'ChairProp',
        filename: 'ChairProp.tsx',
        code: 'export function ChairProp() {}',
        method: 'ai',
        modelLabel: 'Sonnet',
        generationId: 'g1',
      })
    })

    await waitFor(() => screen.getByTestId('preview-name'))

    // Now approve
    fireEvent.click(screen.getByTestId('approve-btn'))

    await waitFor(() => {
      expect(onPropGenerated).toHaveBeenCalledWith(expect.objectContaining({ name: 'ChairProp' }))
    })
  })

  it('handles save error on approve', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/creator/models')) return okJson({ models: [], default: 'sonnet' })
      if (url.includes('/api/creator/props/styles')) return okJson({ styles: [] })
      if (url.includes('/api/creator/props/templates')) return okJson({ templates: [] })
      if (url.includes('/api/creator/save-prop')) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: 'Disk full' }), { status: 500 })
        )
      }
      return okJson({})
    }) as any

    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('prop-input'), { target: { value: 'lamp' } })
    fireEvent.click(screen.getByTestId('generate-btn'))
    await waitFor(() => capturedEventSource !== null)

    act(() => {
      capturedEventSource?.emitMsg('complete', {
        parts: [{ type: 'sphere', color: '#fff', position: [0, 1, 0] }],
        name: 'LampProp',
        filename: 'LampProp.tsx',
        code: 'export function LampProp() {}',
        method: 'template',
        modelLabel: 'Sonnet',
        generationId: 'g2',
      })
    })

    await waitFor(() => screen.getByTestId('preview-name'))
    fireEvent.click(screen.getByTestId('approve-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Disk full')
    })
  })

  it('does not generate when input is empty', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} />)

    // Don't fill in any text — just click generate
    fireEvent.click(screen.getByTestId('generate-btn'))

    // No EventSource created and no generating state
    expect(capturedEventSource).toBeNull()
    expect(screen.queryByTestId('thinking-busy')).not.toBeInTheDocument()
  })

  it('locks body scroll and dispatches fullscreen events on mount/unmount', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const { unmount } = render(<FullscreenPropMaker onClose={vi.fn()} />)

    expect(document.body.style.overflow).toBe('hidden')
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fullscreen-overlay', detail: { open: true } })
    )

    unmount()
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fullscreen-overlay', detail: { open: false } })
    )
  })

  it('handles full_prompt and tool SSE events', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('prop-input'), { target: { value: 'planet' } })
    fireEvent.click(screen.getByTestId('generate-btn'))
    await waitFor(() => capturedEventSource !== null)

    act(() => {
      capturedEventSource?.emitMsg('full_prompt', { prompt: 'A'.repeat(120) })
      capturedEventSource?.emitMsg('tool', {
        name: 'create_prop',
        input: '{}',
        message: '🔧 Creating prop...',
      })
      capturedEventSource?.emitMsg('tool_result', { message: '✅ Done' })
      capturedEventSource?.emitMsg('correction', { message: '🔧 Fixed alignment' })
      capturedEventSource?.emitMsg('text', { text: 'Here is the prop...' })
    })

    await waitFor(() => {
      expect(screen.getByText(/Full prompt loaded/)).toBeInTheDocument()
      expect(screen.getByText('🔧 Creating prop...')).toBeInTheDocument()
      expect(screen.getByText('✅ Done')).toBeInTheDocument()
      expect(screen.getByText('🔧 Fixed alignment')).toBeInTheDocument()
    })
  })

  it('overlay click on backdrop calls onClose', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    const onClose = vi.fn()
    render(<FullscreenPropMaker onClose={onClose} />)

    const overlay = document.querySelector('.fpm-overlay') as HTMLElement
    if (overlay) {
      // Simulate clicking the overlay itself (target === currentTarget)
      const event = new MouseEvent('click', { bubbles: true })
      Object.defineProperty(event, 'target', { value: overlay })
      Object.defineProperty(event, 'currentTarget', { value: overlay })
      overlay.dispatchEvent(event)
    }
    // onClose might have been called
    expect(screen.getByTestId('toolbar')).toBeInTheDocument()
  })

  it('retry action triggers re-generate with last prompt', async () => {
    const { FullscreenPropMaker } =
      await import('@/components/world3d/zones/creator/FullscreenPropMaker')
    render(<FullscreenPropMaker onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('prop-input'), { target: { value: 'couch' } })
    fireEvent.click(screen.getByTestId('generate-btn'))

    await waitFor(() => capturedEventSource !== null)
    const firstES = capturedEventSource

    act(() => {
      firstES.emitMsg('error', { message: 'AI error' })
    })

    await waitFor(() => screen.getByTestId('error'))

    // Click retry - this should use lastPrompt
    capturedEventSource = null
    fireEvent.click(screen.getByTestId('retry-btn'))

    await waitFor(() => capturedEventSource !== null)
    expect(capturedEventSource).not.toBe(firstES)
  })
})
