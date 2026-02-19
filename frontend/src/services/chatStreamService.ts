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
    let buffer = ''
    let currentEvent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const rawData = line.slice(6).trim()
            if (currentEvent === 'delta') {
              try {
                const parsed = JSON.parse(rawData)
                if (parsed.text) {
                  callbacks.onChunk(parsed.text)
                }
              } catch {
                // Skip malformed data
              }
            } else if (currentEvent === 'done') {
              callbacks.onDone()
              return
            } else if (currentEvent === 'error') {
              try {
                const parsed = JSON.parse(rawData)
                callbacks.onError(parsed.error || 'Stream error')
              } catch {
                callbacks.onError('Stream error')
              }
              return
            }
            currentEvent = ''
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
