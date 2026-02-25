import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '@/lib/api'

export interface FileMetadata {
  path: string
  size: number
  modified: string
  lines: number
  language: string
}

export function useFileContent(agentId: string | null | undefined, path: string | null) {
  const [content, setContent] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<FileMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!agentId || !path) {
      setContent(null)
      setMetadata(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${API_BASE}/agents/${agentId}/files/${path}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load file: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setContent(data.content)
        setMetadata({
          path: data.path,
          size: data.size,
          modified: data.modified,
          lines: data.lines,
          language: data.language,
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [agentId, path])

  const setContentManual = useCallback((newContent: string) => {
    setContent(newContent)
  }, [])

  return { content, metadata, loading, error, setContent: setContentManual }
}

export async function saveAgentFile(agentId: string, path: string, content: string) {
  const res = await fetch(`${API_BASE}/agents/${agentId}/files/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Save failed' }))
    throw new Error(err.detail || 'Save failed')
  }
  return res.json()
}
