import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { API_BASE } from '@/lib/api'

export interface DocNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: DocNode[]
  lastModified?: number
}

export type SortKey = 'name' | 'date'

interface UseDocumentPanelOptions {
  readonly treeErrorMessage?: string
  readonly documentErrorMessage?: string
}

interface UseDocumentPanelState {
  readonly tree: DocNode[]
  readonly sortedTree: DocNode[]
  readonly loading: boolean
  readonly error: string | null
  readonly content: string
  readonly selectedPath: string | null
  readonly contentLoading: boolean
  readonly fullscreenOpen: boolean
  readonly searchQuery: string
  readonly sortKey: SortKey
  readonly fileCount: number
  readonly setSearchQuery: (query: string) => void
  readonly setSortKey: Dispatch<SetStateAction<SortKey>>
  readonly setFullscreenOpen: (open: boolean) => void
  readonly openDoc: (path: string) => void
}

export function formatDocDate(ts?: number, includeTime = false): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const day = d.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' })
  if (!includeTime) return day
  return `${day} ${d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`
}

export function sortDocNodes(nodes: DocNode[], sortKey: SortKey): DocNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    if (sortKey === 'date') return (b.lastModified ?? 0) - (a.lastModified ?? 0)
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })
}

export function countDocFiles(nodes: DocNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type === 'file') count++
    if (node.children) count += countDocFiles(node.children)
  }
  return count
}

export function matchesDocSearch(node: DocNode, query: string): boolean {
  if (node.type === 'file') {
    return node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)
  }
  return node.children?.some((child) => matchesDocSearch(child, query)) ?? false
}

export function isDocFilteredOut(node: DocNode, searchQuery: string): boolean {
  if (searchQuery.length < 2) return false
  const q = searchQuery.toLowerCase()
  if (node.type === 'directory') {
    return !node.children?.some((child) => matchesDocSearch(child, q))
  }
  return !node.name.toLowerCase().includes(q) && !node.path.toLowerCase().includes(q)
}

export function getDocNodeIcon(isDirectory: boolean, isExpanded: boolean): string {
  if (!isDirectory) return '📄'
  return isExpanded ? '📂' : '📁'
}

export function useDocumentPanel(options?: UseDocumentPanelOptions): UseDocumentPanelState {
  const treeErrorMessage = options?.treeErrorMessage || 'Failed to load docs tree'
  const documentErrorMessage = options?.documentErrorMessage || 'Failed to load document'

  const [tree, setTree] = useState<DocNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')

  useEffect(() => {
    fetch(`${API_BASE}/docs/tree`)
      .then((response) => response.json())
      .then((data) => {
        setTree(data)
        setLoading(false)
      })
      .catch(() => {
        setError(treeErrorMessage)
        setLoading(false)
      })
  }, [treeErrorMessage])

  const openDoc = useCallback(
    (path: string) => {
      setSelectedPath(path)
      setContentLoading(true)
      setFullscreenOpen(true)
      setError(null)

      fetch(`${API_BASE}/docs/content?path=${encodeURIComponent(path)}`)
        .then((response) => {
          if (!response.ok) throw new Error('Not found')
          return response.json()
        })
        .then((data) => {
          setContent(data.content)
          setContentLoading(false)
        })
        .catch(() => {
          setError(documentErrorMessage)
          setContentLoading(false)
        })
    },
    [documentErrorMessage]
  )

  const sortedTree = useMemo(() => sortDocNodes(tree, sortKey), [tree, sortKey])
  const fileCount = useMemo(() => countDocFiles(tree), [tree])

  return {
    tree,
    sortedTree,
    loading,
    error,
    content,
    selectedPath,
    contentLoading,
    fullscreenOpen,
    searchQuery,
    sortKey,
    fileCount,
    setSearchQuery,
    setSortKey,
    setFullscreenOpen,
    openDoc,
  }
}
