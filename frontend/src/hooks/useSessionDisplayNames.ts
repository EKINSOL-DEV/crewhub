import { useState, useEffect, useCallback } from "react"
import { sessionDisplayNameApi, API_BASE } from "@/lib/api"

const displayNameCache = new Map<string, string | null>()
type Subscriber = () => void
const subscribers = new Set<Subscriber>()

// Track if bulk fetch has been done
let bulkFetchPromise: Promise<void> | null = null
let bulkFetchDone = false

function notifySubscribers() {
  subscribers.forEach(fn => fn())
}

// Fetch ALL display names at once (much more efficient than individual requests)
async function fetchAllDisplayNames(): Promise<void> {
  if (bulkFetchDone) return
  if (bulkFetchPromise) return bulkFetchPromise
  
  bulkFetchPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/session-display-names`)
      if (response.ok) {
        const data = await response.json()
        // Populate cache with all known display names
        for (const item of data.display_names || []) {
          displayNameCache.set(item.session_key, item.display_name)
        }
        notifySubscribers()
      }
    } catch (err) {
      console.error('[useSessionDisplayNames] Failed to fetch all display names:', err)
    } finally {
      bulkFetchDone = true
      bulkFetchPromise = null
    }
  })()
  
  return bulkFetchPromise
}


export async function setDisplayName(sessionKey: string, displayName: string): Promise<boolean> {
  try {
    await sessionDisplayNameApi.set(sessionKey, displayName)
    displayNameCache.set(sessionKey, displayName)
    notifySubscribers()
    return true
  } catch {
    return false
  }
}

export async function deleteDisplayName(sessionKey: string): Promise<boolean> {
  try {
    await sessionDisplayNameApi.delete(sessionKey)
    displayNameCache.set(sessionKey, null)
    notifySubscribers()
    return true
  } catch {
    return false
  }
}

export function clearDisplayNameCache(sessionKey?: string) {
  if (sessionKey) displayNameCache.delete(sessionKey)
  else displayNameCache.clear()
  notifySubscribers()
}

export function useSessionDisplayName(sessionKey: string) {
  const [displayName, setDisplayNameState] = useState<string | null>(() => displayNameCache.get(sessionKey) ?? null)
  const [loading, setLoading] = useState(!bulkFetchDone)

  useEffect(() => {
    const subscriber = () => {
      const cached = displayNameCache.get(sessionKey)
      setDisplayNameState(cached ?? null)
    }
    subscribers.add(subscriber)
    return () => { subscribers.delete(subscriber) }
  }, [sessionKey])

  useEffect(() => {
    // Fetch all display names once (bulk), then read from cache
    fetchAllDisplayNames().then(() => {
      setDisplayNameState(displayNameCache.get(sessionKey) ?? null)
      setLoading(false)
    })
  }, [sessionKey])

  const update = useCallback(async (newName: string) => setDisplayName(sessionKey, newName), [sessionKey])
  const remove = useCallback(async () => deleteDisplayName(sessionKey), [sessionKey])
  const refresh = useCallback(async () => {
    // For refresh, fetch the individual name via API
    setLoading(true)
    try {
      const response = await sessionDisplayNameApi.get(sessionKey)
      const name = response.display_name
      displayNameCache.set(sessionKey, name)
      setDisplayNameState(name)
      notifySubscribers()
    } catch {
      displayNameCache.set(sessionKey, null)
      setDisplayNameState(null)
    } finally {
      setLoading(false)
    }
  }, [sessionKey])

  return { displayName, loading, update, remove, refresh }
}

export function useSessionDisplayNames(sessionKeys: string[]) {
  const keysString = sessionKeys.sort().join(",")
  const [displayNames, setDisplayNames] = useState<Map<string, string | null>>(() => {
    const map = new Map<string, string | null>()
    sessionKeys.forEach(key => {
      if (displayNameCache.has(key)) map.set(key, displayNameCache.get(key) ?? null)
    })
    return map
  })
  const [loading, setLoading] = useState(!bulkFetchDone)

  useEffect(() => {
    const keys = keysString.split(",").filter(Boolean)
    const subscriber = () => {
      const map = new Map<string, string | null>()
      keys.forEach(key => {
        map.set(key, displayNameCache.get(key) ?? null)
      })
      setDisplayNames(map)
    }
    subscribers.add(subscriber)
    return () => { subscribers.delete(subscriber) }
  }, [keysString])

  useEffect(() => {
    const keys = keysString.split(",").filter(Boolean)
    if (keys.length === 0) { setLoading(false); return }
    
    // Fetch all display names once (bulk), then read from cache
    fetchAllDisplayNames().then(() => {
      const map = new Map<string, string | null>()
      keys.forEach(key => map.set(key, displayNameCache.get(key) ?? null))
      setDisplayNames(map)
      setLoading(false)
    })
  }, [keysString])

  return { displayNames, loading }
}
