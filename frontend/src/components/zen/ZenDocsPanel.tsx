/**
 * Zen Docs Panel - Browse and read CrewHub documentation
 * Provides a file tree sidebar + markdown content viewer
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { API_BASE } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────

interface DocNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: DocNode[]
}

interface SearchResult {
  path: string
  name: string
  nameMatch: boolean
  snippet: string
}

// ── Component ─────────────────────────────────────────────────────

export function ZenDocsPanel() {
  const [tree, setTree] = useState<DocNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [docContent, setDocContent] = useState<string>('')
  const [docLoading, setDocLoading] = useState(false)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Fetch tree on mount
  useEffect(() => {
    fetch(`${API_BASE}/docs/tree`)
      .then(r => r.json())
      .then(data => {
        setTree(data)
        setLoading(false)
      })
      .catch(_err => {
        setError('Failed to load docs tree')
        setLoading(false)
      })
  }, [])

  // Fetch doc content
  const openDoc = useCallback((path: string) => {
    setSelectedPath(path)
    setDocLoading(true)
    setError(null)
    setSearchResults(null)
    setSearchQuery('')
    
    fetch(`${API_BASE}/docs/content?path=${encodeURIComponent(path)}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then(data => {
        setDocContent(data.content)
        setDocLoading(false)
        contentRef.current?.scrollTo(0, 0)
      })
      .catch(() => {
        setError('Failed to load document')
        setDocLoading(false)
      })
  }, [])

  // Search with debounce
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    
    if (query.length < 2) {
      setSearchResults(null)
      return
    }
    
    searchTimeout.current = setTimeout(() => {
      setSearchLoading(true)
      fetch(`${API_BASE}/docs/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => {
          setSearchResults(data)
          setSearchLoading(false)
        })
        .catch(() => setSearchLoading(false))
    }, 300)
  }, [])

  // Toggle directory
  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  // Auto-expand parent directories when selecting a file
  const expandParents = useCallback((path: string) => {
    const parts = path.split('/')
    const parents: string[] = []
    for (let i = 0; i < parts.length - 1; i++) {
      parents.push(parts.slice(0, i + 1).join('/'))
    }
    setExpandedDirs(prev => {
      const next = new Set(prev)
      parents.forEach(p => next.add(p))
      return next
    })
  }, [])

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!selectedPath) return []
    const parts = selectedPath.split('/')
    return parts.map((part, i) => ({
      label: part.replace(/\.md$/, ''),
      path: parts.slice(0, i + 1).join('/'),
      isLast: i === parts.length - 1,
    }))
  }, [selectedPath])

  return (
    <div className="zen-docs-panel">
      {/* Sidebar */}
      <div className="zen-docs-sidebar">
        <div className="zen-docs-sidebar-header">
          <span className="zen-docs-sidebar-title">📚 Docs</span>
          <span className="zen-docs-sidebar-count">
            {countFiles(tree)} files
          </span>
        </div>
        
        {/* Search */}
        <div className="zen-docs-search">
          <input
            type="text"
            placeholder="Search docs..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="zen-docs-search-input"
          />
        </div>

        {/* Search Results */}
        {searchResults !== null ? (
          <div className="zen-docs-tree">
            {searchLoading && <div className="zen-docs-loading">Searching...</div>}
            {!searchLoading && searchResults.length === 0 && (
              <div className="zen-docs-empty">No results</div>
            )}
            {searchResults.map(r => (
              <button
                key={r.path}
                className={`zen-docs-file ${selectedPath === r.path ? 'active' : ''}`}
                onClick={() => { expandParents(r.path); openDoc(r.path) }}
                title={r.path}
              >
                <span className="zen-docs-file-icon">📄</span>
                <div className="zen-docs-search-result">
                  <span className="zen-docs-file-name">{r.name}</span>
                  {r.snippet && (
                    <span className="zen-docs-search-snippet">{r.snippet}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : loading ? (
          <div className="zen-docs-loading">Loading...</div>
        ) : (
          <div className="zen-docs-tree">
            {tree.map(node => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                expandedDirs={expandedDirs}
                selectedPath={selectedPath}
                onToggleDir={toggleDir}
                onSelectFile={openDoc}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="zen-docs-content" ref={contentRef}>
        {error && <div className="zen-docs-error">{error}</div>}
        
        {!selectedPath && !error && (
          <div className="zen-docs-welcome">
            <div className="zen-docs-welcome-icon">📚</div>
            <h2>CrewHub Documentation</h2>
            <p>Select a document from the sidebar to start reading.</p>
            <p className="zen-docs-welcome-hint">
              Use the search bar to find docs quickly.
            </p>
          </div>
        )}

        {selectedPath && (
          <>
            {/* Breadcrumbs */}
            <div className="zen-docs-breadcrumbs">
              <button 
                className="zen-docs-breadcrumb"
                onClick={() => setSelectedPath(null)}
              >
                docs
              </button>
              {breadcrumbs.map(bc => (
                <span key={bc.path}>
                  <span className="zen-docs-breadcrumb-sep">/</span>
                  <span className={`zen-docs-breadcrumb ${bc.isLast ? 'active' : ''}`}>
                    {bc.label}
                  </span>
                </span>
              ))}
            </div>

            {/* Markdown content */}
            {docLoading ? (
              <div className="zen-docs-loading">Loading document...</div>
            ) : (
              <div className="zen-docs-markdown">
                <ReactMarkdown>{docContent}</ReactMarkdown>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Tree Node ─────────────────────────────────────────────────────

interface TreeNodeProps {
  node: DocNode
  depth: number
  expandedDirs: Set<string>
  selectedPath: string | null
  onToggleDir: (path: string) => void
  onSelectFile: (path: string) => void
}

function TreeNode({ node, depth, expandedDirs, selectedPath, onToggleDir, onSelectFile }: TreeNodeProps) {
  const isExpanded = expandedDirs.has(node.path)
  
  if (node.type === 'directory') {
    return (
      <div className="zen-docs-dir">
        <button
          className="zen-docs-dir-toggle"
          onClick={() => onToggleDir(node.path)}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <span className="zen-docs-dir-arrow">{isExpanded ? '▾' : '▸'}</span>
          <span className="zen-docs-dir-icon">📁</span>
          <span className="zen-docs-dir-name">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div className="zen-docs-dir-children">
            {node.children.map(child => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedDirs={expandedDirs}
                selectedPath={selectedPath}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      className={`zen-docs-file ${selectedPath === node.path ? 'active' : ''}`}
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      title={node.path}
    >
      <span className="zen-docs-file-icon">📄</span>
      <span className="zen-docs-file-name">{node.name.replace(/\.md$/, '')}</span>
    </button>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function countFiles(nodes: DocNode[]): number {
  let count = 0
  for (const n of nodes) {
    if (n.type === 'file') count++
    if (n.children) count += countFiles(n.children)
  }
  return count
}
