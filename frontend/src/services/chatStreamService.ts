/**
 * chatStreamService.ts
 * Low-level streaming chat service for CrewHub.
 * Handles SSE connection to the backend streaming endpoint.
 */

import { API_BASE } from '@/lib/api'

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (error: string) => void
}

/**
 * Stream a message to an agent session.
 * Returns an AbortController the caller can use to cancel.
 */
export function streamMessage(
  sessionKey: string,
  message: string,
  roomId: string | undefined,
  callbacks: StreamCallbacks
): AbortController {
  const abort = new AbortController()

  const run = async () => {
    let resp: Response
    try {
      resp = await fetch(
        `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/stream`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, ...(roomId ? { room_id: roomId } : {}) }),
          signal: abort.signal,
        }
      )
    } catch (e: unknown) {
      if ((e as Error).name === 'AbortError') return
      callbacks.onError((e as Error).message || 'Network error')
      return
    }

    if (!resp.ok) {
      callbacks.onError(`HTTP ${resp.status}`)
      return
    }

    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()

    // Reset event tracking
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        
        // Split on SSE event boundary (double newline)
        const eventBlocks = buffer.split('\n\n')
        buffer = eventBlocks.pop() ?? ''
        
        // Use a flag instead of `return` inside the loop so we always
        // process ALL events in this batch before acting on `done`.
        // Prevents edge-cases where `done` arrives mid-buffer while
        // trailing `delta` events are still queued in the same chunk.
        let batchDone = false
        let batchError: string | null = null

        for (const eventBlock of eventBlocks) {
          const lines = eventBlock.split('\n')
          let eventType = 'message'
          let dataLine = ''
          
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              dataLine = line.slice(6).trim()
            }
          }
          
          if (eventType === 'delta' && dataLine) {
            // Only deliver delta chunks when we haven't seen `done` yet
            if (!batchDone) {
              try {
                const parsed = JSON.parse(dataLine)
                if (parsed.text) {
                  callbacks.onChunk(parsed.text)
                }
              } catch {
                // Skip malformed data
              }
            }
          } else if (eventType === 'done') {
            batchDone = true
            // Don't break — continue to process any remaining events in the batch
          } else if (eventType === 'error') {
            try {
              const parsed = JSON.parse(dataLine)
              batchError = parsed.error || 'Stream error'
            } catch {
              batchError = 'Stream error'
            }
            break
          }
        }

        if (batchError !== null) {
          callbacks.onError(batchError)
          return
        }
        if (batchDone) {
          callbacks.onDone()
          return
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name === 'AbortError') return
      callbacks.onError((e as Error).message || 'Stream read error')
      return
    }

    callbacks.onDone()
  }

  run()
  return abort
}

/**
 * Check if the streaming endpoint is available.
 * Returns false if we should fall back to blocking /send.
 */
export async function isStreamingAvailable(sessionKey: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '' }),
      }
    )
    // 400 (empty message) means endpoint exists; 404 means not available
    return resp.status !== 404
  } catch {
    return false
  }
}
