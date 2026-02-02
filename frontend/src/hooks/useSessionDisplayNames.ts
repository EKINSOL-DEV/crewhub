import { useState, useEffect, useCallback } from "react"
import { sessionDisplayNameApi } from "@/lib/api"

const displayNameCache = new Map<string, string | null>()
const pendingRequests = new Map<string, Promise<string | null>>()
type Subscriber = () => void
const subscribers = new Set<Subscriber>()

function notifySubscribers() {
  subscribers.forEach(fn => fn())
}

async function fetchDisplayName(sessionKey: string): Promise<string | null> {
  if (displayNameCache.has(sessionKey)) return displayNameCache.get(sessionKey) ?? null
  if (pendingRequests.has(sessionKey)) return pendingRequests.get(sessionKey)!

  const promise = (async () => {
    try {
      const response = await sessionDisplayNameApi.get(sessionKey)
      const name = response.display_name
      displayNameCache.set(sessionKey, name)
      notifySubscribers()
      return name
    } catch {
      displayNameCache.set(sessionKey, null)
      return null
    } finally {
      pendingRequests.delete(sessionKey)
    }
  })()

  pendingRequests.set(sessionKey, promise)
  return promise
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
  const [loading, setLoading] = useState(!displayNameCache.has(sessionKey))

  useEffect(() => {
    const subscriber = () => {
      const cached = displayNameCache.get(sessionKey)
      if (cached !== undefined) setDisplayNameState(cached)
    }
    subscribers.add(subscriber)
    return () => { subscribers.delete(subscriber) }
  }, [sessionKey])

  useEffect(() => {
    if (!displayNameCache.has(sessionKey)) {
      fetchDisplayName(sessionKey).then(name => {
        setDisplayNameState(name)
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [sessionKey])

  const update = useCallback(async (newName: string) => setDisplayName(sessionKey, newName), [sessionKey])
  const remove = useCallback(async () => deleteDisplayName(sessionKey), [sessionKey])
  const refresh = useCallback(() => {
    clearDisplayNameCache(sessionKey)
    setLoading(true)
    fetchDisplayName(sessionKey).then(name => {
      setDisplayNameState(name)
      setLoading(false)
    })
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const keys = keysString.split(",").filter(Boolean)
    const subscriber = () => {
      const map = new Map<string, string | null>()
      keys.forEach(key => {
        if (displayNameCache.has(key)) map.set(key, displayNameCache.get(key) ?? null)
      })
      setDisplayNames(map)
    }
    subscribers.add(subscriber)
    return () => { subscribers.delete(subscriber) }
  }, [keysString])

  useEffect(() => {
    const keys = keysString.split(",").filter(Boolean)
    if (keys.length === 0) { setLoading(false); return }
    setLoading(true)
    Promise.all(keys.map(key => fetchDisplayName(key))).then(() => {
      const map = new Map<string, string | null>()
      keys.forEach(key => map.set(key, displayNameCache.get(key) ?? null))
      setDisplayNames(map)
      setLoading(false)
    })
  }, [keysString])

  return { displayNames, loading }
}
