/**
 * Zen Docs Panel - Browse CrewHub repo documentation (docs/ folder)
 * Reuses existing FileTree and MarkdownViewer components.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { FileTree } from '../files/FileTree'
import { MarkdownViewer } from '../markdown/MarkdownViewer'
import { FullscreenOverlay } from '../markdown/FullscreenOverlay'
import { API_BASE } from '@/lib/api'
import type { FileNode } from '@/hooks/useAgentFiles'

// ── Types ─────────────────────────────────────────────────────────

interface DocNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: DocNode[]
}

// ── Helpers ───────────────────────────────────────────────────────

/** Convert backend DocNode[] to FileNode[] for FileTree */
function toFileNodes(nodes: DocNode[]): FileNode[] {
  return nodes.map(n => ({
    name: n.name,
    path: n.path,
    type: n.type,
    children: n.children ? toFileNodes(n.children) : undefined,
  }))
}

function countFiles(nodes: DocNode[]): number {
  let count = 0
  for (const n of nodes) {
    if (n.type === 'file') count++
    if (n.children) count += countFiles(n.children)
  }
  return count
}

// ── Component ─────────────────────────────────────────────────────

export function ZenDocsPanel() {
  const [tree, setTree] = useState<DocNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [contentLoading, setContentLoading] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileNode[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  // Fetch tree on mount
  useEffect(() => {
    fetch(`${API_BASE}/docs/tree`)
      .then(r => r.json())
      .then(data => { setTree(data); setLoading(false) })
      .catch(() => { setError('Failed to load docs tree'); setLoading(false) })
  }, [])

  // Adapted files for FileTree
  const fileNodes = useMemo(() => toFileNodes(tree), [tree])

  // Fetch doc content
  const loadDoc = useCallback((path: string) => {
    setSelectedPath(path)
    setContentLoading(true)
    setError(null)

    fetch(`${API_BASE}/docs/content?path=${encodeURIComponent(path)}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(data => { setContent(data.content); setContentLoading(false) })
      .catch(() => { setError('Failed to load document'); setContentLoading(false) })
  }, [])

  // Handle file selection from FileTree
  const handleSelect = useCallback((file: FileNode) => {
    if (file.type === 'file') loadDoc(file.path)
  }, [loadDoc])

  // Handle fullscreen expand
  const handleExpand = useCallback((file: FileNode) => {
    if (file.type === 'file') {
      loadDoc(file.path)
      setFullscreenOpen(true)
    }
  }, [loadDoc])

  // Search with debounce
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (query.length < 2) {
      setSearchResults(null)
      return
    }

    searchTimeout.current = setTimeout(() => {
      fetch(`${API_BASE}/docs/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => {
          // Convert search results to FileNode[] for FileTree
          const nodes: FileNode[] = data.map((r: any) => ({
            name: r.name,
            path: r.path,
            type: 'file' as const,
          }))
          setSearchResults(nodes)
        })
        .catch(() => setSearchResults([]))
    }, 300)
  }, [])

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!selectedPath) return []
    const parts = selectedPath.split('/')
    return parts.map((part, i) => ({
      label: part.replace(/\.md$/, ''),
      isLast: i === parts.length - 1,
    }))
  }, [selectedPath])

  const fileCount = useMemo(() => countFiles(tree), [tree])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 240,
        minWidth: 200,
        borderRight: '1px solid var(--zen-border, hsl(var(--border)))',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--zen-bg, hsl(var(--background)))',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--zen-fg, hsl(var(--foreground)))' }}>
            📚 Docs
          </span>
          <span style={{ fontSize: 11, color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))' }}>
            {fileCount} files
          </span>
        </div>

        {/* Search */}
        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--zen-border, hsl(var(--border)))' }}>
          <input
            type="text"
            placeholder="Search docs..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            style={{
              width: '100%',
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

        {/* File tree */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <FileTree
            files={searchResults ?? fileNodes}
            selectedPath={selectedPath ?? undefined}
            onSelect={handleSelect}
            onExpand={handleExpand}
            loading={loading}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px 24px',
        background: 'var(--zen-bg-panel, hsl(var(--card)))',
      }}>
        {error && (
          <div style={{ padding: 12, color: 'var(--zen-error, #ef4444)', fontSize: 13 }}>{error}</div>
        )}

        {!selectedPath && !error && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
            textAlign: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 48 }}>📚</span>
            <h2 style={{ color: 'var(--zen-fg, hsl(var(--foreground)))', fontSize: 18, margin: 0 }}>
              CrewHub Documentation
            </h2>
            <p style={{ margin: 0, fontSize: 13 }}>Select a document from the sidebar to start reading.</p>
          </div>
        )}

        {selectedPath && (
          <>
            {/* Breadcrumbs + actions */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 12,
              marginBottom: 12,
              borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
              }}>
                <span
                  onClick={() => setSelectedPath(null)}
                  style={{ cursor: 'pointer', color: 'var(--zen-accent, hsl(var(--primary)))' }}
                >
                  docs
                </span>
                {breadcrumbs.map((bc, i) => (
                  <span key={i}>
                    <span style={{ opacity: 0.5, margin: '0 2px' }}>/</span>
                    <span style={{ color: bc.isLast ? 'var(--zen-fg, hsl(var(--foreground)))' : undefined }}>
                      {bc.label}
                    </span>
                  </span>
                ))}
              </div>
              <button
                onClick={() => setFullscreenOpen(true)}
                title="Fullscreen"
                style={{
                  background: 'none',
                  border: '1px solid var(--zen-border, hsl(var(--border)))',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: '2px 8px',
                  color: 'var(--zen-fg-muted, hsl(var(--muted-foreground)))',
                }}
              >
                ⤢ Fullscreen
              </button>
            </div>

            {contentLoading ? (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--zen-fg-muted, hsl(var(--muted-foreground)))', textAlign: 'center' }}>
                Loading…
              </div>
            ) : (
              <MarkdownViewer content={content} />
            )}
          </>
        )}
      </div>

      {/* Fullscreen overlay */}
      {content && selectedPath && (
        <FullscreenOverlay
          open={fullscreenOpen}
          onClose={() => setFullscreenOpen(false)}
          title={selectedPath.split('/').pop() || ''}
          subtitle={selectedPath}
          content={content}
        />
      )}
    </div>
  )
}
