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
            try {
              const parsed = JSON.parse(dataLine)
              if (parsed.text) {
                callbacks.onChunk(parsed.text)
              }
            } catch {
              // Skip malformed data
            }
          } else if (eventType === 'done') {
            callbacks.onDone()
            return
          } else if (eventType === 'error') {
            try {
              const parsed = JSON.parse(dataLine)
              callbacks.onError(parsed.error || 'Stream error')
            } catch {
              callbacks.onError('Stream error')
            }
            return
          }
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
