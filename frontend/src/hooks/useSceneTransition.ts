/**
 * useSceneTransition — Stub hook for scene transition effects (Phase 1).
 *
 * Phase 2 will implement:
 * - CSS fade overlay (fadeOverlay.ts)
 * - waitForSceneReady gate
 * - Camera position save/restore via zonePersistence
 *
 * For now this is a no-op hook that returns stable references.
 */
import { useCallback, useState } from 'react'

interface SceneTransitionState {
  /** True while fade overlay is active */
  isFading: boolean
  /** True once the new scene has rendered at least one frame */
  isSceneReady: boolean
  /** Trigger a fade-out → swap → fade-in sequence. Stub: resolves immediately. */
  triggerTransition: (callback: () => void) => Promise<void>
}

export function useSceneTransition(): SceneTransitionState {
  const [isFading] = useState(false)
  const [isSceneReady] = useState(true)

  const triggerTransition = useCallback(async (callback: () => void) => {
    // Phase 1: just call the callback immediately
    // Phase 2: fade out → callback → wait scene ready → fade in
    callback()
  }, [])

  return { isFading, isSceneReady, triggerTransition }
}
