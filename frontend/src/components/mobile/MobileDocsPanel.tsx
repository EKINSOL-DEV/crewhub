/**
 * MobileDocsPanel - Mobile-friendly wrapper for docs browsing
 * Fullscreen file tree + markdown viewer with touch-friendly UI
 */

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Search, SortAsc, Clock } from 'lucide-react'
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
  return d.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' })
}

function sortNodes(nodes: DocNode[], sortKey: SortKey): DocNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    if (sortKey === 'date') return (b.lastModified ?? 0) - (a.lastModified ?? 0)
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })
}

function matchesSearch(node: DocNode, q: string): boolean {
  if (node.type === 'file') {
    return node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)
  }
  return node.children?.some((c) => matchesSearch(c, q)) ?? false
}

function countFiles(nodes: DocNode[]): number {
  let count = 0
  for (const n of nodes) {
    if (n.type === 'file') count++
    if (n.children) count += countFiles(n.children)
  }
  return count
}

// ── Tree Node (mobile optimized) ──────────────────────────────────

function MobileDocTreeNode({
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

  if (searchQuery.length >= 2) {
    const q = searchQuery.toLowerCase()
    if (isDir) {
      if (!node.children?.some((c) => matchesSearch(c, q))) return null
    } else {
      if (!node.name.toLowerCase().includes(q) && !node.path.toLowerCase().includes(q)) return null
    }
  }

  const isExpanded = searchQuery.length >= 2 ? true : expanded
  const sorted = isDir && node.children ? sortNodes(node.children, sortKey) : []

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
          gap: 10,
          padding: `12px 16px 12px ${16 + depth * 20}px`,
          cursor: 'pointer',
          fontSize: 14,
          color: '#e2e8f0',
          userSelect: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          minHeight: 44, // touch target
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {isDir ? (
          <span style={{ fontSize: 11, width: 16, textAlign: 'center', color: '#64748b' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        ) : (
          <span style={{ width: 16 }} />
        )}

        <span style={{ fontSize: 16 }}>{isDir ? (isExpanded ? '📂' : '📁') : '📄'}</span>

        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {isDir ? node.name : node.name.replace(/\.md$/, '')}
        </span>

        {!isDir && node.lastModified && (
          <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {formatDate(node.lastModified)}
          </span>
        )}
      </div>

      {isDir &&
        isExpanded &&
        sorted.map((child) => (
          <MobileDocTreeNode
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

// ── Main Component ────────────────────────────────────────────────

interface MobileDocsPanelProps {
  readonly onBack: () => void
}

export function MobileDocsPanel({ onBack }: MobileDocsPanelProps) {
  const [tree, setTree] = useState<DocNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')

  useEffect(() => {
    fetch(`${API_BASE}/docs/tree`)
      .then((r) => r.json())
      .then((data) => {
        setTree(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load docs')
        setLoading(false)
      })
  }, [])

  const fileCount = countFiles(tree)

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
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
          paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: 'rgba(255,255,255,0.06)',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#f1f5f9' }}>📚 Docs</h1>
          <span style={{ fontSize: 11, color: '#64748b' }}>{fileCount} files</span>
        </div>

        <button
          onClick={() => setSortKey((k) => (k === 'name' ? 'date' : 'name'))}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: 'rgba(255,255,255,0.06)',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={`Sort by ${sortKey === 'name' ? 'date' : 'name'}`}
        >
          {sortKey === 'name' ? <SortAsc size={16} /> : <Clock size={16} />}
        </button>

        <button
          onClick={() => setShowSearch((s) => !s)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: showSearch ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
            color: showSearch ? '#818cf8' : '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Search size={16} />
        </button>
      </header>

      {/* Search bar */}
      {showSearch && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              color: '#e2e8f0',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
            Loading…
          </div>
        ) : error && !fullscreenOpen ? (
          <div style={{ padding: 20, color: '#ef4444', fontSize: 14 }}>{error}</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
            No documents found
          </div>
        ) : (
          sorted.map((node) => (
            <MobileDocTreeNode
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

      {/* Fullscreen overlay for viewing docs */}
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
