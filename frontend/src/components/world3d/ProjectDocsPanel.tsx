import { useState, useEffect, useCallback, useMemo } from 'react'
import { API_BASE } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────

interface FileEntry {
  name: string
  path: string
  type: 'directory' | 'document' | 'image' | 'code' | 'config'
  extension?: string
  size?: number
  children?: FileEntry[]
  child_count?: number
}

interface FileContent {
  path: string
  name: string
  type: string
  extension: string
  size: number
  content: string
}

interface ProjectDocsPanelProps {
  projectId: string
  projectName: string
  projectColor?: string
  onClose: () => void
}

// ── File Icons ─────────────────────────────────────────────────

function getFileIcon(entry: FileEntry): string {
  if (entry.type === 'directory') return '📁'
  switch (entry.extension) {
    case '.md': return '📝'
    case '.txt': return '📄'
    case '.py': return '🐍'
    case '.ts': case '.tsx': return '💎'
    case '.js': case '.jsx': return '📜'
    case '.json': return '🔧'
    case '.yaml': case '.yml': return '⚙️'
    case '.html': return '🌐'
    case '.css': case '.scss': return '🎨'
    case '.png': case '.jpg': case '.jpeg': case '.gif': case '.svg': case '.webp': return '🖼️'
    case '.sh': case '.bash': return '🐚'
    case '.sql': return '🗃️'
    case '.toml': case '.ini': case '.cfg': return '⚙️'
    default: return '📄'
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Markdown Renderer ──────────────────────────────────────────

function renderMarkdown(content: string, projectId: string): string {
  let html = content
  
  // Escape HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang ? `<span class="md-code-lang">${lang}</span>` : ''
    return `<div class="md-code-block">${langLabel}<pre><code>${code.trim()}</code></pre></div>`
  })
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
  
  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
  
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>')
  
  // Images (relative to project)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    // If relative path, resolve through project files API
    if (!src.startsWith('http')) {
      src = `${API_BASE}/projects/${projectId}/files/image?path=${encodeURIComponent(src)}`
    }
    return `<img src="${src}" alt="${alt}" class="md-image" />`
  })
  
  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="md-hr" />')
  
  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>')
  
  // Unordered lists
  html = html.replace(/^[\s]*[-*+] (.+)$/gm, '<li class="md-li">$1</li>')
  html = html.replace(/(<li class="md-li">[\s\S]*?<\/li>)/g, (match) => {
    if (!match.startsWith('<ul')) return `<ul class="md-ul">${match}</ul>`
    return match
  })
  
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="md-oli">$1</li>')
  
  // Task lists
  html = html.replace(/<li class="md-li">\[x\] (.+)<\/li>/g, '<li class="md-li md-task-done">✅ $1</li>')
  html = html.replace(/<li class="md-li">\[ \] (.+)<\/li>/g, '<li class="md-li md-task">⬜ $1</li>')
  
  // Tables (basic)
  html = html.replace(/^\|(.+)\|$/gm, (_, row) => {
    const cells = row.split('|').map((c: string) => c.trim())
    if (cells.every((c: string) => /^[-:]+$/.test(c))) return '' // Skip separator row
    const cellHtml = cells.map((c: string) => `<td class="md-td">${c}</td>`).join('')
    return `<tr class="md-tr">${cellHtml}</tr>`
  })
  
  // Paragraphs (double newlines)
  html = html.replace(/\n\n+/g, '</p><p class="md-p">')
  html = `<p class="md-p">${html}</p>`
  
  // Clean up empty paragraphs
  html = html.replace(/<p class="md-p">\s*<\/p>/g, '')
  
  return html
}

// ── TOC Extractor ──────────────────────────────────────────────

interface TocEntry {
  level: number
  text: string
  id: string
}

function extractToc(content: string): TocEntry[] {
  const toc: TocEntry[] = []
  const lines = content.split('\n')
  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      toc.push({ level, text, id })
    }
  }
  return toc
}

// ── File Tree Component ────────────────────────────────────────

function FileTree({
  entries,
  onSelect,
  selectedPath,
  depth = 0,
}: {
  entries: FileEntry[]
  onSelect: (entry: FileEntry) => void
  selectedPath: string | null
  depth?: number
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand first level
    return new Set(entries.filter(e => e.type === 'directory').map(e => e.path))
  })

  const toggleDir = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {entries.map(entry => (
        <div key={entry.path}>
          <button
            onClick={() => {
              if (entry.type === 'directory') toggleDir(entry.path)
              else onSelect(entry)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: '4px 8px',
              paddingLeft: 8 + depth * 16,
              borderRadius: 6,
              border: 'none',
              background: selectedPath === entry.path ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'system-ui, sans-serif',
              color: '#374151',
              textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (selectedPath !== entry.path) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'
            }}
            onMouseLeave={e => {
              if (selectedPath !== entry.path) e.currentTarget.style.background = 'transparent'
            }}
          >
            {entry.type === 'directory' && (
              <span style={{ fontSize: 10, color: '#9ca3af', width: 12, textAlign: 'center' }}>
                {expanded.has(entry.path) ? '▾' : '▸'}
              </span>
            )}
            {entry.type !== 'directory' && <span style={{ width: 12 }} />}
            <span style={{ fontSize: 13 }}>{getFileIcon(entry)}</span>
            <span style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: entry.type === 'directory' ? 600 : 400,
            }}>
              {entry.name}
            </span>
            {entry.size !== undefined && entry.type !== 'directory' && (
              <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>
                {formatFileSize(entry.size)}
              </span>
            )}
          </button>
          {entry.type === 'directory' && expanded.has(entry.path) && entry.children && (
            <FileTree
              entries={entry.children}
              onSelect={onSelect}
              selectedPath={selectedPath}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

export function ProjectDocsPanel({ projectId, projectName, projectColor, onClose }: ProjectDocsPanelProps) {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null)
  const [fileContent, setFileContent] = useState<FileContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingContent, setLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'browser' | 'viewer'>('browser')
  const [filterType, setFilterType] = useState<string>('all')
  const color = projectColor || '#4f46e5'

  // Fetch file list
  useEffect(() => {
    async function fetchFiles() {
      try {
        setLoading(true)
        const res = await fetch(`${API_BASE}/projects/${projectId}/files?depth=3`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Failed to load files' }))
          throw new Error(err.detail || 'Failed to load files')
        }
        const data = await res.json()
        setFiles(data.files || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchFiles()
  }, [projectId])

  // Fetch file content
  const openFile = useCallback(async (entry: FileEntry) => {
    setSelectedFile(entry)
    setView('viewer')
    
    if (entry.type === 'image') {
      // Images are loaded via img tag directly
      setFileContent({
        path: entry.path,
        name: entry.name,
        type: 'image',
        extension: entry.extension || '',
        size: entry.size || 0,
        content: '', // Not needed for images
      })
      return
    }
    
    try {
      setLoadingContent(true)
      const res = await fetch(`${API_BASE}/projects/${projectId}/files/content?path=${encodeURIComponent(entry.path)}`)
      if (!res.ok) throw new Error('Failed to load file')
      const data = await res.json()
      setFileContent(data)
    } catch (err) {
      setFileContent(null)
      setError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      setLoadingContent(false)
    }
  }, [projectId])

  // Filter files (flattened for counts)
  const fileCounts = useMemo(() => {
    const counts = { all: 0, document: 0, code: 0, image: 0, config: 0 }
    function count(entries: FileEntry[]) {
      for (const e of entries) {
        if (e.type === 'directory') {
          if (e.children) count(e.children)
        } else {
          counts.all++
          if (e.type in counts) counts[e.type as keyof typeof counts]++
        }
      }
    }
    count(files)
    return counts
  }, [files])

  // Filter the tree
  const filteredFiles = useMemo(() => {
    if (filterType === 'all') return files
    function filterTree(entries: FileEntry[]): FileEntry[] {
      return entries
        .map(e => {
          if (e.type === 'directory') {
            const children = e.children ? filterTree(e.children) : []
            if (children.length === 0) return null
            return { ...e, children, child_count: children.length }
          }
          return e.type === filterType ? e : null
        })
        .filter(Boolean) as FileEntry[]
    }
    return filterTree(files)
  }, [files, filterType])

  // TOC for markdown files
  const toc = useMemo(() => {
    if (fileContent && (fileContent.extension === '.md' || fileContent.extension === '.txt')) {
      return extractToc(fileContent.content)
    }
    return []
  }, [fileContent])

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      bottom: 80,
      width: 420,
      zIndex: 60,
      background: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 16,
      border: '1px solid rgba(0, 0, 0, 0.08)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'docsPanelSlideIn 0.3s ease-out',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        {view === 'viewer' && (
          <button
            onClick={() => { setView('browser'); setSelectedFile(null); setFileContent(null) }}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: 'rgba(0,0,0,0.05)', color: '#6b7280', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}
          >
            ←
          </button>
        )}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: color + '20',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          📂
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: '#1f2937',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {view === 'viewer' && selectedFile ? selectedFile.name : `${projectName} Docs`}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
            {view === 'viewer' && selectedFile
              ? selectedFile.path
              : `${fileCounts.all} files`
            }
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28, height: 28, borderRadius: 8, border: 'none',
            background: 'rgba(0,0,0,0.05)', color: '#6b7280', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)' }}
        >
          ✕
        </button>
      </div>

      <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', margin: '12px 0 0' }} />

      {/* File type filter (browser view only) */}
      {view === 'browser' && !loading && !error && (
        <div style={{
          padding: '8px 16px',
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
        }}>
          {[
            { key: 'all', label: 'All', icon: '📋' },
            { key: 'document', label: 'Docs', icon: '📝' },
            { key: 'code', label: 'Code', icon: '💻' },
            { key: 'config', label: 'Config', icon: '⚙️' },
            { key: 'image', label: 'Images', icon: '🖼️' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              style={{
                padding: '3px 10px',
                borderRadius: 12,
                border: 'none',
                background: filterType === f.key ? color + '15' : 'rgba(0,0,0,0.03)',
                color: filterType === f.key ? color : '#6b7280',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {f.icon} {f.label}
              {f.key !== 'all' && fileCounts[f.key as keyof typeof fileCounts] > 0 && (
                <span style={{ marginLeft: 3, opacity: 0.7 }}>
                  ({fileCounts[f.key as keyof typeof fileCounts]})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: view === 'viewer' ? '0' : '8px 8px',
      }}>
        {loading && (
          <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            Loading files...
          </div>
        )}

        {error && (
          <div style={{
            margin: 16, padding: 12, borderRadius: 10,
            background: '#fef2f2', color: '#991b1b', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* File Browser */}
        {view === 'browser' && !loading && !error && (
          filteredFiles.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No files found
            </div>
          ) : (
            <FileTree
              entries={filteredFiles}
              onSelect={openFile}
              selectedPath={selectedFile?.path || null}
            />
          )
        )}

        {/* File Viewer */}
        {view === 'viewer' && (
          loadingContent ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Loading content...
            </div>
          ) : fileContent ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* TOC for markdown */}
              {toc.length > 3 && (
                <div style={{
                  padding: '8px 16px',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  background: 'rgba(0,0,0,0.02)',
                  maxHeight: 120,
                  overflow: 'auto',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>
                    Contents
                  </div>
                  {toc.map((entry, i) => (
                    <div key={i} style={{
                      fontSize: 11,
                      color: '#6b7280',
                      paddingLeft: (entry.level - 1) * 12,
                      padding: '2px 0',
                      cursor: 'default',
                    }}>
                      {entry.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Rendered Content */}
              <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
                {fileContent.type === 'image' && selectedFile && (
                  <div style={{ textAlign: 'center', padding: 8 }}>
                    <img
                      src={`${API_BASE}/projects/${projectId}/files/image?path=${encodeURIComponent(selectedFile.path)}`}
                      alt={selectedFile.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: 400,
                        borderRadius: 8,
                        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                      {selectedFile.name} · {selectedFile.size ? formatFileSize(selectedFile.size) : ''}
                    </div>
                  </div>
                )}

                {fileContent.type === 'document' && fileContent.extension === '.md' && (
                  <div
                    className="md-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(fileContent.content, projectId) }}
                  />
                )}

                {(fileContent.type === 'code' || fileContent.type === 'config' || 
                  (fileContent.type === 'document' && fileContent.extension !== '.md')) && (
                  <pre style={{
                    margin: 0,
                    padding: 12,
                    background: 'rgba(0,0,0,0.03)',
                    borderRadius: 8,
                    fontSize: 12,
                    lineHeight: 1.6,
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                    color: '#374151',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {fileContent.content}
                  </pre>
                )}
              </div>
            </div>
          ) : null
        )}
      </div>

      {/* Markdown styles */}
      <style>{`
        @keyframes docsPanelSlideIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .md-content {
          font-size: 13px;
          line-height: 1.7;
          color: #374151;
        }
        .md-content .md-h1 {
          font-size: 20px;
          font-weight: 800;
          color: #111827;
          margin: 16px 0 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }
        .md-content .md-h2 {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
          margin: 14px 0 6px;
        }
        .md-content .md-h3 {
          font-size: 14px;
          font-weight: 700;
          color: #374151;
          margin: 12px 0 4px;
        }
        .md-content .md-h4 {
          font-size: 13px;
          font-weight: 700;
          color: #4b5563;
          margin: 10px 0 4px;
        }
        .md-content .md-p {
          margin: 6px 0;
        }
        .md-content .md-code-block {
          position: relative;
          margin: 10px 0;
          background: rgba(0,0,0,0.04);
          border-radius: 8px;
          overflow: hidden;
        }
        .md-content .md-code-block pre {
          margin: 0;
          padding: 12px;
          font-size: 12px;
          line-height: 1.5;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
          overflow-x: auto;
        }
        .md-content .md-code-lang {
          position: absolute;
          top: 4px;
          right: 8px;
          font-size: 10px;
          color: #9ca3af;
          font-family: system-ui, sans-serif;
        }
        .md-content .md-inline-code {
          padding: 1px 6px;
          background: rgba(0,0,0,0.06);
          border-radius: 4px;
          font-size: 12px;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
        }
        .md-content .md-link {
          color: #4f46e5;
          text-decoration: none;
        }
        .md-content .md-link:hover {
          text-decoration: underline;
        }
        .md-content .md-ul, .md-content .md-ol {
          padding-left: 20px;
          margin: 4px 0;
        }
        .md-content .md-li, .md-content .md-oli {
          margin: 2px 0;
          list-style-type: disc;
        }
        .md-content .md-oli {
          list-style-type: decimal;
        }
        .md-content .md-task-done {
          list-style-type: none;
          margin-left: -16px;
        }
        .md-content .md-task {
          list-style-type: none;
          margin-left: -16px;
        }
        .md-content .md-blockquote {
          border-left: 3px solid rgba(79, 70, 229, 0.3);
          padding: 4px 12px;
          margin: 8px 0;
          color: #6b7280;
          background: rgba(0,0,0,0.02);
          border-radius: 0 6px 6px 0;
        }
        .md-content .md-hr {
          border: none;
          border-top: 1px solid rgba(0,0,0,0.08);
          margin: 12px 0;
        }
        .md-content .md-image {
          max-width: 100%;
          border-radius: 8px;
          margin: 8px 0;
        }
        .md-content .md-td {
          padding: 4px 10px;
          border: 1px solid rgba(0,0,0,0.08);
          font-size: 12px;
        }
        .md-content .md-tr:first-child .md-td {
          font-weight: 600;
          background: rgba(0,0,0,0.03);
        }
      `}</style>
    </div>
  )
}
