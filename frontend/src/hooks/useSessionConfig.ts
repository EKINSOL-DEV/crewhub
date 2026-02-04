import { useSyncExternalStore } from 'react'
import {
  getSessionConfig,
  subscribeConfig,
  type SessionConfig,
} from '@/lib/sessionConfig'

/**
 * React hook that provides reactive access to the session config.
 * Components using this will re-render when any config value changes.
 */
export function useSessionConfig(): SessionConfig {
  return useSyncExternalStore(subscribeConfig, getSessionConfig, getSessionConfig)
}
