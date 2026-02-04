/**
 * Centralized SSE Connection Manager
 * 
 * Manages a single EventSource connection to /api/events and provides
 * a pub/sub interface for components to subscribe to specific event types.
 * 
 * This prevents connection starvation from multiple SSE connections.
 */

type EventHandler = (event: MessageEvent) => void

interface Subscription {
  eventType: string
  handler: EventHandler
}

const getAuthToken = (): string => localStorage.getItem("openclaw_token") || ""

const MAX_BACKOFF_MS = 30_000

class SSEManager {
  private eventSource: EventSource | null = null
  private subscriptions: Map<string, Set<EventHandler>> = new Map()
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private isConnecting = false
  private connectionState: "disconnected" | "connecting" | "connected" = "disconnected"
  private stateListeners: Set<(state: typeof this.connectionState) => void> = new Set()

  /**
   * Subscribe to a specific SSE event type.
   * Automatically connects if this is the first subscription.
   */
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set())
    }
    this.subscriptions.get(eventType)!.add(handler)

    // Register listener on EventSource if already connected
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      this.eventSource.addEventListener(eventType, handler)
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

    // Remove listener from EventSource
    if (this.eventSource) {
      this.eventSource.removeEventListener(eventType, handler)
    }

    // Disconnect if no more subscribers
    if (this.getTotalSubscribers() === 0) {
      this.disconnect()
    }
  }

  /**
   * Subscribe to connection state changes.
   */
  onStateChange(listener: (state: "disconnected" | "connecting" | "connected") => void): () => void {
    this.stateListeners.add(listener)
    // Immediately call with current state
    listener(this.connectionState)
    return () => this.stateListeners.delete(listener)
  }

  /**
   * Get current connection state.
   */
  getConnectionState(): "disconnected" | "connecting" | "connected" {
    return this.connectionState
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connectionState === "connected"
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

  private connect(): void {
    if (this.isConnecting || this.eventSource) return
    this.isConnecting = true
    this.setConnectionState("connecting")

    try {
      const token = getAuthToken()
      const sseUrl = token ? `/api/events?token=${encodeURIComponent(token)}` : "/api/events"
      const eventSource = new EventSource(sseUrl)
      this.eventSource = eventSource

      eventSource.onopen = () => {
        this.isConnecting = false
        this.reconnectAttempts = 0
        this.setConnectionState("connected")
        console.log("[SSEManager] Connected")

        // Register all existing subscriptions
        for (const [eventType, handlers] of this.subscriptions) {
          for (const handler of handlers) {
            eventSource.addEventListener(eventType, handler)
          }
        }
      }

      eventSource.onerror = () => {
        this.handleDisconnect()
      }
    } catch (err) {
      console.error("[SSEManager] Failed to create EventSource:", err)
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

    this.setConnectionState("disconnected")

    // Only reconnect if we still have subscribers
    if (this.getTotalSubscribers() > 0) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), MAX_BACKOFF_MS)
      this.reconnectAttempts++
      console.log(`[SSEManager] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})`)

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

    this.isConnecting = false
    this.reconnectAttempts = 0
    this.setConnectionState("disconnected")
    console.log("[SSEManager] Disconnected")
  }
}

// Singleton instance
export const sseManager = new SSEManager()
