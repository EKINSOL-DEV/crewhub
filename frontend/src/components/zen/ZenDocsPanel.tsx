/**
 * Zen Docs Panel - Browse CrewHub repo documentation (docs/ folder)
 * Folder tree view with collapsible directories and fullscreen markdown viewer.
 */

import { useState, useEffect, useCallback } from 'react'
import { FullscreenOverlay } from '../markdown/FullscreenOverlay'
import { API_BASE } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────

interface DocNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: DocNode[]
  lastModified?: number
}

type SortKey = 'name' | 'date'

// ── Helpers ───────────────────────────────────────────────────────

function formatDate(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return (
    d.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  )
}

function sortNodes(nodes: DocNode[], sortKey: SortKey): DocNode[] {
  return [...nodes].sort((a, b) => {
    // Directories first
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    if (sortKey === 'date') {
      return (b.lastModified ?? 0) - (a.lastModified ?? 0)
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })
}

// ── Tree Node ─────────────────────────────────────────────────────

function DocTreeNode({
  node,
  depth,
  sortKey,
  onOpen,
  searchQuery,
}: {
  node: DocNode
  depth: number
  sortKey: SortKey
  onOpen: (path: string) => void
  searchQuery: string
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const isDir = node.type === 'directory'

  // Filter: if searching, only show matching files and dirs containing matches
  if (searchQuery.length >= 2) {
    const q = searchQuery.toLowerCase()
    if (isDir) {
      const hasMatch = node.children?.some((c) => matchesSearch(c, q))
      if (!hasMatch) return null
    } else {
      if (!node.name.toLowerCase().includes(q) && !node.path.toLowerCase().includes(q)) {
        return null
      }
    }
  }

  // Auto-expand when searching
  const isExpanded = searchQuery.length >= 2 ? true : expanded

  const sorted = isDir && node.children ? sortNodes(node.children, sortKey) : []

  let folderIcon: string
  if (!isDir) {
    folderIcon = '📄'
  } else if (isExpanded) {
    folderIcon = '📂'
  } else {
    folderIcon = '📁'
  }

  return (
    <div>
      <div
        onClick={() => {
          if (isDir) setExpanded((prev) => !prev)
          else onOpen(node.path)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: `4px 12px 4px ${12 + depth * 18}px`,
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
          color: 'var(--zen-fg, hsl(var(--foreground)))',
          userSelect: 'none',
          borderRadius: 4,
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = 'var(--zen-bg-hover, hsl(var(--accent)))')
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Expand/collapse arrow for dirs */}
        {isDir ? (
          <span
            style={{
              fontSize: 9,
              width: 12,
              textAlign: 'center',
              color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
        ) : (
          <span style={{ width: 12 }} />
        )}

        {/* Icon */}
        <span style={{ fontSize: 13 }}>{folderIcon}</span>

        {/* Name */}
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {isDir ? node.name : node.name.replace(/\.md$/, '')}
        </span>

        {/* Date for files */}
        {!isDir && node.lastModified && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {formatDate(node.lastModified)}
          </span>
        )}
      </div>

      {/* Children */}
      {isDir &&
        isExpanded &&
        sorted.map((child) => (
          <DocTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            sortKey={sortKey}
            onOpen={onOpen}
            searchQuery={searchQuery}
          />
        ))}
    </div>
  )
}

function matchesSearch(node: DocNode, q: string): boolean {
  if (node.type === 'file') {
    return node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)
  }
  return node.children?.some((c) => matchesSearch(c, q)) ?? false
}

// ── Component ─────────────────────────────────────────────────────

export function ZenDocsPanel() {
  const [tree, setTree] = useState<DocNode[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState<string>('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('name')

  // Fetch tree on mount
  useEffect(() => {
    fetch(`${API_BASE}/docs/tree`)
      .then((r) => r.json())
      .then((data) => {
        setTree(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load docs tree')
        setLoading(false)
      })
  }, [])

  // Count total files
  const fileCount = countFiles(tree)

  // Open file in fullscreen
  const openDoc = useCallback((path: string) => {
    setSelectedPath(path)
    setContentLoading(true)
    setFullscreenOpen(true)
    setError(null)

    fetch(`${API_BASE}/docs/content?path=${encodeURIComponent(path)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then((data) => {
        setContent(data.content)
        setContentLoading(false)
      })
      .catch(() => {
        setError('Failed to load document')
        setContentLoading(false)
      })
  }, [])

  const sorted = sortNodes(tree, sortKey)

  return (
    <div
      style={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--zen-bg, hsl(var(--background)))',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span
          style={{ fontWeight: 600, fontSize: 13, color: 'var(--zen-fg, hsl(var(--foreground)))' }}
        >
          📚 Docs
        </span>
        <span style={{ fontSize: 11, color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))' }}>
          {fileCount} files
        </span>
        <div style={{ flex: 1 }} />

        {/* Sort toggle */}
        <button
          onClick={() => setSortKey((k) => (k === 'name' ? 'date' : 'name'))}
          title={`Sort by ${sortKey === 'name' ? 'date' : 'name'}`}
          style={{
            background: 'none',
            border: '1px solid var(--zen-border, hsl(var(--border)))',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 10,
            padding: '3px 8px',
            color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
          }}
        >
          {sortKey === 'name' ? '🔤 Name' : '🕒 Date'}
        </button>

        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: 160,
            padding: '4px 8px',
            border: '1px solid var(--zen-border, hsl(var(--border)))',
            borderRadius: 4,
            background: 'var(--zen-bg-panel, hsl(var(--card)))',
            color: 'var(--zen-fg, hsl(var(--foreground)))',
            fontSize: 12,
            outline: 'none',
          }}
        />
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {loading ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
            }}
          >
            Loading…
          </div>
        ) : error && !fullscreenOpen ? (
          <div style={{ padding: 16, color: 'var(--zen-error, #ef4444)', fontSize: 13 }}>
            {error}
          </div>
        ) : sorted.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
            }}
          >
            No documents found
          </div>
        ) : (
          sorted.map((node) => (
            <DocTreeNode
              key={node.path}
              node={node}
              depth={0}
              sortKey={sortKey}
              onOpen={openDoc}
              searchQuery={searchQuery}
            />
          ))
        )}
      </div>

      {/* Fullscreen overlay */}
      <FullscreenOverlay
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        title={selectedPath?.split('/').pop()?.replace(/\.md$/, '') || ''}
        subtitle={selectedPath || ''}
        content={contentLoading ? 'Loading…' : content}
      />
    </div>
  )
}

function countFiles(nodes: DocNode[]): number {
  let count = 0
  for (const n of nodes) {
    if (n.type === 'file') count++
    if (n.children) count += countFiles(n.children)
  }
  return count
}
