/**
 * Zen Docs Panel - Browse CrewHub repo documentation (docs/ folder)
 * Table view with fullscreen markdown viewer overlay.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
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

interface FlatDoc {
  name: string
  path: string
  lastModified?: number
  folder: string
}

type SortKey = 'name' | 'lastModified'
type SortDir = 'asc' | 'desc'

// ── Helpers ───────────────────────────────────────────────────────

/** Flatten tree into a list of files */
function flattenDocs(nodes: DocNode[], prefix = ''): FlatDoc[] {
  const result: FlatDoc[] = []
  for (const n of nodes) {
    if (n.type === 'file') {
      result.push({
        name: n.name,
        path: n.path,
        lastModified: n.lastModified,
        folder: prefix,
      })
    }
    if (n.children) {
      result.push(...flattenDocs(n.children, prefix ? `${prefix}/${n.name}` : n.name))
    }
  }
  return result
}

function formatDate(ts?: number): string {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return d.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
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
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Fetch tree on mount
  useEffect(() => {
    fetch(`${API_BASE}/docs/tree`)
      .then(r => r.json())
      .then(data => { setTree(data); setLoading(false) })
      .catch(() => { setError('Failed to load docs tree'); setLoading(false) })
  }, [])

  // Flatten + filter + sort
  const docs = useMemo(() => {
    let flat = flattenDocs(tree)
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase()
      flat = flat.filter(d => d.name.toLowerCase().includes(q) || d.folder.toLowerCase().includes(q))
    }
    flat.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      } else {
        cmp = (a.lastModified ?? 0) - (b.lastModified ?? 0)
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return flat
  }, [tree, searchQuery, sortKey, sortDir])

  // Open file in fullscreen
  const openDoc = useCallback((path: string) => {
    setSelectedPath(path)
    setContentLoading(true)
    setFullscreenOpen(true)
    setError(null)

    fetch(`${API_BASE}/docs/content?path=${encodeURIComponent(path)}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(data => { setContent(data.content); setContentLoading(false) })
      .catch(() => { setError('Failed to load document'); setContentLoading(false) })
  }, [])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'lastModified' ? 'desc' : 'asc')
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
    borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: 12,
    borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
    color: 'var(--zen-fg, hsl(var(--foreground)))',
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--zen-bg, hsl(var(--background)))' }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--zen-fg, hsl(var(--foreground)))' }}>
          📚 Docs
        </span>
        <span style={{ fontSize: 11, color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))' }}>
          {docs.length} files
        </span>
        <div style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="Search docs..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: 200,
            padding: '5px 8px',
            border: '1px solid var(--zen-border, hsl(var(--border)))',
            borderRadius: 4,
            background: 'var(--zen-bg-panel, hsl(var(--card)))',
            color: 'var(--zen-fg, hsl(var(--foreground)))',
            fontSize: 12,
            outline: 'none',
          }}
        />
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))' }}>
            Loading…
          </div>
        ) : error && !fullscreenOpen ? (
          <div style={{ padding: 16, color: 'var(--zen-error, #ef4444)', fontSize: 13 }}>{error}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => toggleSort('name')}>
                  Filename{sortIcon('name')}
                </th>
                <th style={{ ...thStyle, width: 180 }} onClick={() => toggleSort('lastModified')}>
                  Last Modified{sortIcon('lastModified')}
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr
                  key={doc.path}
                  onClick={() => openDoc(doc.path)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--zen-bg-hover, hsl(var(--accent)))')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={tdStyle}>
                    <span style={{ marginRight: 6, opacity: 0.5 }}>📄</span>
                    {doc.name.replace(/\.md$/, '')}
                    {doc.folder && (
                      <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.4 }}>{doc.folder}</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))' }}>
                    {formatDate(doc.lastModified)}
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ ...tdStyle, textAlign: 'center', padding: 24, color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))' }}>
                    No documents found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
