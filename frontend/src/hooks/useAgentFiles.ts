import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '@/lib/api'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  lines?: number
  children?: FileNode[]
}

interface AgentFilesResult {
  agent_id: string
  workspace: string
  files: FileNode[]
}

export function useAgentFiles(agentId: string | null | undefined) {
  const [files, setFiles] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/agents/${agentId}/files?depth=3`)
      if (!res.ok) throw new Error(`Failed to load files: ${res.status}`)
      const data: AgentFilesResult = await res.json()
      setFiles(data.files)
    } catch (e: any) {
      setError(e.message)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { refresh() }, [refresh])

  return { files, loading, error, refresh }
}
