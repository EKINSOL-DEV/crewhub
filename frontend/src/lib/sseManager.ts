/**
 * Centralized SSE Connection Manager
 *
 * Manages a single EventSource connection to /api/events and provides
 * a pub/sub interface for components to subscribe to specific event types.
 *
 * This prevents connection starvation from multiple SSE connections.
 *
 * Performance optimizations:
 * - All message processing is deferred via queueMicrotask to avoid blocking
 *   the browser's message handler (fixes Chrome's "message handler took Xms" violations)
 * - Connection state changes are batched
 */

type EventHandler = (event: MessageEvent) => void

const getAuthToken = (): string => localStorage.getItem('openclaw_token') || ''

const MAX_BACKOFF_MS = 30_000

class SSEManager {
  private eventSource: EventSource | null = null
  private readonly subscriptions: Map<string, Set<EventHandler>> = new Map()
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private isConnecting = false
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected'
  private readonly stateListeners: Set<(state: typeof this.connectionState) => void> = new Set()

  // Track which event types have dispatchers registered
  private readonly registeredDispatchers: Set<string> = new Set()

  /**
   * Subscribe to a specific SSE event type.
   *
   * IMPORTANT: Handlers are called via queueMicrotask, NOT synchronously in the
   * message handler. This means:
   * 1. Your handler runs outside the browser's message handler context
   * 2. Heavy processing (JSON.parse, state updates) won't cause violations
   * 3. Multiple events may be batched by React's state batching
   *
   * Automatically connects if this is the first subscription.
   */
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set())
    }
    this.subscriptions.get(eventType)!.add(handler)

    // Register dispatcher on EventSource if already connected
    if (this.eventSource?.readyState === EventSource.OPEN) {
      this.ensureEventDispatcher(eventType)
    }

    // Connect if this is the first subscription
    if (this.getTotalSubscribers() === 1) {
      this.connect()
    }

    // Return unsubscribe function
    return () => this.unsubscribe(eventType, handler)
  }

  /**
   * Unsubscribe from a specific event type.
   * Disconnects if no subscribers remain.
   */
  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.subscriptions.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.subscriptions.delete(eventType)
      }
    }

    // Disconnect if no more subscribers
    if (this.getTotalSubscribers() === 0) {
      this.disconnect()
    }
  }

  /**
   * Subscribe to connection state changes.
   */
  onStateChange(
    listener: (state: 'disconnected' | 'connecting' | 'connected') => void
  ): () => void {
    this.stateListeners.add(listener)
    // Immediately call with current state
    listener(this.connectionState)
    return () => this.stateListeners.delete(listener)
  }

  /**
   * Get current connection state.
   */
  getConnectionState(): 'disconnected' | 'connecting' | 'connected' {
    return this.connectionState
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connectionState === 'connected'
  }

  /**
   * Force reconnect (useful after auth changes).
   */
  reconnect(): void {
    this.disconnect()
    if (this.getTotalSubscribers() > 0) {
      this.connect()
    }
  }

  private getTotalSubscribers(): number {
    let total = 0
    for (const handlers of this.subscriptions.values()) {
      total += handlers.size
    }
    return total
  }

  private setConnectionState(state: typeof this.connectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state
      for (const listener of this.stateListeners) {
        listener(state)
      }
    }
  }

  /**
   * Create an event dispatcher that defers handler calls to a microtask.
   * This is the key optimization that prevents "message handler took Xms" violations.
   */
  private createDeferredDispatcher(eventType: string): (event: MessageEvent) => void {
    return (event: MessageEvent) => {
      // Capture references synchronously (very fast - just object references)
      const handlers = this.subscriptions.get(eventType)
      if (!handlers || handlers.size === 0) return

      // Create a frozen copy of handlers to avoid iteration issues if handlers
      // unsubscribe during the microtask
      const handlersCopy = Array.from(handlers)

      // Defer ALL processing to a microtask.
      // This moves the work out of the browser's message handler context,
      // preventing the "[Violation] message handler took Xms" warnings.
      queueMicrotask(() => {
        for (const handler of handlersCopy) {
          try {
            handler(event)
          } catch (err) {
            console.error(`[SSEManager] Handler error for ${eventType}:`, err)
          }
        }
      })
    }
  }

  private ensureEventDispatcher(eventType: string): void {
    if (this.registeredDispatchers.has(eventType) || !this.eventSource) return

    const dispatcher = this.createDeferredDispatcher(eventType)
    this.eventSource.addEventListener(eventType, dispatcher)
    this.registeredDispatchers.add(eventType)
  }

  private connect(): void {
    if (this.isConnecting || this.eventSource) return
    this.isConnecting = true
    this.setConnectionState('connecting')

    try {
      const token = getAuthToken()
      // Detect Tauri environment (Tauri v2 uses __TAURI_INTERNALS__, v1 uses __TAURI__)
      const isInTauri =
        (window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined
      // Priority: localStorage > Tauri injected var > env var
      const rawConfigured =
        localStorage.getItem('crewhub_backend_url') ||
        (window as any).__CREWHUB_BACKEND_URL__ ||
        import.meta.env.VITE_API_URL
      // In browser mode, ignore localhost-based URLs — they only make sense in Tauri.
      // A localhost URL from Safari on iPhone will never reach the Mac mini backend.
      const isLocalUrl =
        rawConfigured?.includes('localhost') || rawConfigured?.includes('127.0.0.1')
      const configuredUrl = !isInTauri && isLocalUrl ? null : rawConfigured

      // In Tauri dev mode, a remote/Tailscale URL stored in settings may redirect
      // HTTP → HTTPS at the network level (before FastAPI), causing CORS errors in
      // WKWebView. Fall back to localhost so the dev backend is hit directly.
      const isTauriDev = isInTauri && import.meta.env.DEV
      const effectiveUrl =
        isTauriDev && configuredUrl && !isLocalUrl ? 'http://localhost:8091' : configuredUrl

      let sseUrl: string
      if (effectiveUrl) {
        // Tauri or explicit non-localhost backend URL — connect directly (absolute URL)
        const backendHost = effectiveUrl.replace(/^https?:\/\//, '')
        sseUrl = token
          ? `http://${backendHost}/api/events?token=${encodeURIComponent(token)}`
          : `http://${backendHost}/api/events`
      } else {
        // Browser mode — use relative URL so Vite proxy forwards to backend
        // This works regardless of hostname (localhost, ekinbot.local, etc.)
        sseUrl = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events'
      }
      const eventSource = new EventSource(sseUrl)
      this.eventSource = eventSource

      eventSource.onopen = () => {
        this.isConnecting = false
        this.reconnectAttempts = 0
        this.setConnectionState('connected')
        console.log('[SSEManager] Connected')

        // Register dispatchers for all subscribed event types
        this.registeredDispatchers.clear()
        for (const eventType of this.subscriptions.keys()) {
          this.ensureEventDispatcher(eventType)
        }
      }

      eventSource.onerror = () => {
        this.handleDisconnect()
      }
    } catch (err) {
      console.error('[SSEManager] Failed to create EventSource:', err)
      this.isConnecting = false
      this.handleDisconnect()
    }
  }

  private handleDisconnect(): void {
    this.isConnecting = false

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    this.registeredDispatchers.clear()
    this.setConnectionState('disconnected')

    // Only reconnect if we still have subscribers
    if (this.getTotalSubscribers() > 0) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), MAX_BACKOFF_MS)
      this.reconnectAttempts++
      console.log(
        `[SSEManager] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})`
      )

      if (this.reconnectTimeoutId) clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = setTimeout(() => {
        this.reconnectTimeoutId = null
        this.connect()
      }, delay)
    }
  }

  private disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    this.registeredDispatchers.clear()
    this.isConnecting = false
    this.reconnectAttempts = 0
    this.setConnectionState('disconnected')
    console.log('[SSEManager] Disconnected')
  }
}

// Singleton instance
export const sseManager = new SSEManager()
