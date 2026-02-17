/**
 * useSSEStatus – lightweight React hook for SSE connection state.
 * Subscribes to SSEManager's state change listener so components
 * reactively update when the connection goes up/down.
 */

import { useState, useEffect } from 'react'
import { sseManager } from '@/lib/sseManager'

export type SSEConnectionState = 'disconnected' | 'connecting' | 'connected'

export function useSSEStatus(): SSEConnectionState {
  const [state, setState] = useState<SSEConnectionState>(
    () => sseManager.getConnectionState()
  )

  useEffect(() => {
    // onStateChange immediately calls the listener with the current state,
    // so this also handles any state changes between render and effect.
    const unsub = sseManager.onStateChange((newState) => {
      setState(newState)
    })
    return unsub
  }, [])

  return state
}
