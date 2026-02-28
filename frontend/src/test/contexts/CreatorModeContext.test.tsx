/* eslint-disable @typescript-eslint/no-explicit-any, sonarjs/no-duplicate-string */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import {
  CreatorModeProvider,
  useCreatorMode,
  type PlacementAction,
} from '@/contexts/CreatorModeContext'

class TestEventSource {
  static instances: TestEventSource[] = []
  listeners = new Map<string, Set<(e: MessageEvent) => void>>()
  onerror: ((ev: Event) => any) | null = null

  constructor(_url: string) {
    TestEventSource.instances.push(this)
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(cb)
  }

  removeEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners.get(type)?.delete(cb)
  }

  emit(type: string, data: unknown) {
    const evt = { data: JSON.stringify(data) } as MessageEvent
    this.listeners.get(type)?.forEach((cb) => cb(evt))
  }

  close() {}
}

function Consumer() {
  const ctx = useCreatorMode()
  return (
    <div>
      <div data-testid="creator-mode">{String(ctx.isCreatorMode)}</div>
      <div data-testid="selected">{ctx.selectedPropId ?? 'none'}</div>
      <div data-testid="rotation">{String(ctx.pendingRotation)}</div>
      <div data-testid="browser">{String(ctx.isBrowserOpen)}</div>
      <div data-testid="undo">{String(ctx.undoStack.length)}</div>
      <div data-testid="redo">{String(ctx.redoStack.length)}</div>
      <div data-testid="placed">{String(ctx.placedProps.length)}</div>
      <div data-testid="api-key">{ctx.apiKey ?? 'none'}</div>

      <button onClick={ctx.toggleCreatorMode}>toggle-mode</button>
      <button onClick={() => ctx.selectProp('prop-1')}>select</button>
      <button onClick={ctx.clearSelection}>clear</button>
      <button onClick={ctx.rotatePending}>rotate</button>
      <button onClick={ctx.openBrowser}>open-browser</button>
      <button onClick={ctx.closeBrowser}>close-browser</button>
      <button onClick={ctx.toggleBrowser}>toggle-browser</button>
      <button
        onClick={() =>
          ctx.pushAction({
            type: 'place',
            placedId: 'placed-1',
            propId: 'prop-a',
            position: { x: 1, y: 2, z: 3 },
            rotation_y: 90,
            scale: 1,
          } satisfies PlacementAction)
        }
      >
        push-place
      </button>
      <button onClick={() => void ctx.undo()}>undo</button>
      <button onClick={() => void ctx.redo()}>redo</button>
    </div>
  )
}

describe('CreatorModeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    TestEventSource.instances = []
    ;(globalThis as any).EventSource = TestEventSource
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws when hook is used without provider', () => {
    const Bad = () => {
      useCreatorMode()
      return null
    }
    expect(() => render(<Bad />)).toThrow(/must be used within <CreatorModeProvider>/)
  })

  it('toggles mode/selection/browser and handles keyboard shortcuts', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('/world/props')) return new Response(JSON.stringify({ props: [] }))
      if (url.includes('/auth/local-bootstrap'))
        return new Response(JSON.stringify({ key: 'boot-key' }))
      return new Response(JSON.stringify({}))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <CreatorModeProvider>
        <Consumer />
      </CreatorModeProvider>
    )

    expect(screen.getByTestId('creator-mode')).toHaveTextContent('false')
    fireEvent.click(screen.getByText('toggle-mode'))
    expect(screen.getByTestId('creator-mode')).toHaveTextContent('true')
    expect(document.documentElement.classList.contains('creator-mode-active')).toBe(true)

    fireEvent.click(screen.getByText('select'))
    expect(screen.getByTestId('selected')).toHaveTextContent('prop-1')

    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByTestId('rotation')).toHaveTextContent('90')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('selected')).toHaveTextContent('none')

    fireEvent.keyDown(window, { key: 'b' })
    expect(screen.getByTestId('browser')).toHaveTextContent('true')

    fireEvent.keyDown(window, { key: 'e' })
    expect(screen.getByTestId('creator-mode')).toHaveTextContent('false')

    await waitFor(() => {
      expect(screen.getByTestId('api-key')).toHaveTextContent('boot-key')
    })
  })

  it('handles SSE prop updates and undo/redo API flows', async () => {
    localStorage.setItem('crewhub-api-key', 'my-key')

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('/world/props') && !init?.method)
        return new Response(JSON.stringify({ props: [] }))
      if (url.includes('/auth/local-bootstrap')) return new Response('{}', { status: 404 })
      if (url.endsWith('/world/props') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'new-id' }))
      }
      return new Response(JSON.stringify({ ok: true }))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <CreatorModeProvider>
        <Consumer />
      </CreatorModeProvider>
    )

    await waitFor(() => expect(TestEventSource.instances.length).toBeGreaterThan(0))
    const es = TestEventSource.instances[0]
    await act(async () => {
      es.emit('prop_update', {
        action: 'place',
        placed_id: 'p1',
        prop_id: 'chair',
        position: { x: 0, y: 0, z: 0 },
        rotation_y: 0,
        scale: 1,
        room_id: null,
        placed_by: null,
        placed_at: Date.now(),
      })
    })
    await waitFor(() => expect(screen.getByTestId('placed')).toHaveTextContent('1'))

    fireEvent.click(screen.getByText('push-place'))
    expect(screen.getByTestId('undo')).toHaveTextContent('1')

    fireEvent.click(screen.getByText('undo'))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/world/props/placed-1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
    expect(screen.getByTestId('undo')).toHaveTextContent('0')
    expect(screen.getByTestId('redo')).toHaveTextContent('1')

    fireEvent.click(screen.getByText('redo'))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/world/props'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
