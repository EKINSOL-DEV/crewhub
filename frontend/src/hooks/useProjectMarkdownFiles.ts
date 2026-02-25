/**
 * useProjectMarkdownFiles — Fetch markdown files from a project's folder.
 */

import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function useProjectMarkdownFiles(projectId?: string) {
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!projectId) {
      setFiles([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${API_BASE}/api/projects/${projectId}/markdown-files`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setFiles(data.files || [])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setFiles([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [projectId, refreshKey])

  const refetch = () => setRefreshKey((k) => k + 1)

  return { files, loading, error, refetch }
}
