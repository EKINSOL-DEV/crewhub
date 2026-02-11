import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '@/lib/api'

export interface DocFileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  lines?: number
  children?: DocFileNode[]
}

interface ProjectDocsResult {
  project_id: string
  project_name: string
  base_path: string
  files: DocFileNode[]
}

export function useProjectDocuments(projectId: string | null | undefined) {
  const [files, setFiles] = useState<DocFileNode[]>([])
  const [projectName, setProjectName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/documents?depth=3`)
      if (!res.ok) throw new Error(`Failed to load documents: ${res.status}`)
      const data: ProjectDocsResult = await res.json()
      setFiles(data.files)
      setProjectName(data.project_name)
    } catch (e: any) {
      setError(e.message)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { refresh() }, [refresh])

  return { files, projectName, loading, error, refresh }
}

export function useProjectDocumentContent(projectId: string | null | undefined, path: string | null) {
  const [content, setContent] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<{ path: string; size: number; modified: string; lines: number; language: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !path) {
      setContent(null)
      setMetadata(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${API_BASE}/projects/${projectId}/documents/${encodeURIComponent(path)}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load document: ${res.status}`)
        return res.json()
      })
      .then(data => {
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
      .catch(e => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [projectId, path])

  return { content, metadata, loading, error, setContent }
}

export async function saveProjectDocument(projectId: string, path: string, content: string) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/documents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Save failed (${res.status}): ${detail}`)
  }
  return res.json()
}
