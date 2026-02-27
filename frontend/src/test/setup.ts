import '@testing-library/jest-dom'

// Mock ResizeObserver which is not available in jsdom
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
  class ResizeObserver {
    observe() {
      /* no-op mock */
    }
    unobserve() {
      /* no-op mock */
    }
    disconnect() {
      /* no-op mock */
    }
  } as unknown as typeof ResizeObserver

// Mock window.matchMedia which is not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock EventSource (SSE) which is not available in jsdom/node
if (typeof (globalThis as any).EventSource === 'undefined') {
  class MockEventSource {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSED = 2

    readonly url: string
    readyState = MockEventSource.OPEN
    onopen: ((ev: Event) => any) | null = null
    onerror: ((ev: Event) => any) | null = null
    onmessage: ((ev: MessageEvent) => any) | null = null

    private readonly listeners = new Map<string, Set<(ev: any) => void>>()

    constructor(url: string) {
      this.url = url
      queueMicrotask(() => this.onopen?.(new Event('open')))
    }

    addEventListener(type: string, listener: (ev: any) => void) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type)!.add(listener)
    }

    removeEventListener(type: string, listener: (ev: any) => void) {
      this.listeners.get(type)?.delete(listener)
    }

    close() {
      this.readyState = MockEventSource.CLOSED
    }
  }

  ;(globalThis as any).EventSource = MockEventSource as unknown as typeof EventSource
}

// Mock fetch for relative /api/* URLs (undici requires absolute URLs)
const __originalFetch = globalThis.fetch
if (typeof __originalFetch === 'function') {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (typeof url === 'string' && url.startsWith('/api')) {
      const pathname = url.split('?')[0]
      const json = (data: unknown) =>
        new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })

      if (pathname.endsWith('/rooms')) return json({ rooms: [] })
      if (pathname.endsWith('/session-room-assignments')) return json({ assignments: [] })
      if (pathname.endsWith('/room-assignment-rules')) return json({ rules: [] })
      if (pathname.endsWith('/world/props')) return json({ props: [] })

      return json({})
    }

    return __originalFetch(input as any, init)
  }) as typeof fetch
}
