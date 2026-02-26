import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { API_BASE } from '@/lib/api'
import { formatFileSize } from '@/lib/formatters'

const RGBA_0_0_0_0_04 = 'rgba(0,0,0,0.04)'
const RGBA_0_0_0_0_05 = 'rgba(0,0,0,0.05)'
const UI_MONOSPACE_SFMONO_REGULAR_SF_MONO_MENL =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'

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
  readonly projectId: string
  readonly projectName: string
  readonly projectColor?: string
  readonly onClose: () => void
}

// ── File Icons ─────────────────────────────────────────────────

function getFileIcon(entry: FileEntry): string {
  if (entry.type === 'directory') return '📁'
  switch (entry.extension) {
    case '.md':
      return '📝'
    case '.txt':
      return '📄'
    case '.py':
      return '🐍'
    case '.ts':
    case '.tsx':
      return '💎'
    case '.js':
    case '.jsx':
      return '📜'
    case '.json':
      return '🔧'
    case '.yaml':
    case '.yml':
      return '⚙️'
    case '.html':
      return '🌐'
    case '.css':
    case '.scss':
      return '🎨'
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.svg':
    case '.webp':
      return '🖼️'
    case '.sh':
    case '.bash':
      return '🐚'
    case '.sql':
      return '🗃️'
    case '.toml':
    case '.ini':
    case '.cfg':
      return '⚙️'
    default:
      return '📄'
  }
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
  let inCodeBlock = false
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    const match = /^(#{1,4})\s+(.+)$/.exec(line)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-|-$/g, '')
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
  readonly entries: FileEntry[]
  readonly onSelect: (entry: FileEntry) => void
  readonly selectedPath: string | null
  readonly depth?: number
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand first level
    return new Set(entries.filter((e) => e.type === 'directory').map((e) => e.path))
  })

  const toggleDir = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {entries.map((entry) => (
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
            onMouseEnter={(e) => {
              if (selectedPath !== entry.path) e.currentTarget.style.background = RGBA_0_0_0_0_04
            }}
            onMouseLeave={(e) => {
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
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: entry.type === 'directory' ? 600 : 400,
              }}
            >
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

// ── Context for passing projectId to markdown image renderer ───

const ProjectIdContext = createContext<string>('')

// ── Module-level markdown component renderers ──────────────────

function DocImg({ src, alt, ...props }: any) {
  const projectId = useContext(ProjectIdContext)
  let resolvedSrc = src || ''
  if (resolvedSrc && !resolvedSrc.startsWith('http') && !resolvedSrc.startsWith('data:')) {
    resolvedSrc = `${API_BASE}/projects/${projectId}/files/image?path=${encodeURIComponent(resolvedSrc)}`
  }
  return (
    <img
      {...props}
      src={resolvedSrc}
      alt={alt || ''}
      style={{ maxWidth: '100%', borderRadius: 8, margin: '8px 0' }}
      loading="lazy"
    />
  )
}

function DocA({ href, children, ...props }: any) {
  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#4f46e5', textDecoration: 'none' }}
      onMouseEnter={(e) => {
        ;(e.target as HTMLElement).style.textDecoration = 'underline'
      }}
      onMouseLeave={(e) => {
        ;(e.target as HTMLElement).style.textDecoration = 'none'
      }}
    >
      {children}
    </a>
  )
}

function DocPre({ children, ...props }: any) {
  return (
    <pre
      {...props}
      style={{
        margin: '10px 0',
        padding: 12,
        background: RGBA_0_0_0_0_04,
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.5,
        fontFamily: UI_MONOSPACE_SFMONO_REGULAR_SF_MONO_MENL,
        overflow: 'auto',
      }}
    >
      {children}
    </pre>
  )
}

function DocCode({ className, children, ...props }: any) {
  const isInline = !className
  if (isInline) {
    return (
      <code
        {...props}
        style={{
          padding: '1px 6px',
          background: 'rgba(0,0,0,0.06)',
          borderRadius: 4,
          fontSize: '0.9em',
          fontFamily: UI_MONOSPACE_SFMONO_REGULAR_SF_MONO_MENL,
        }}
      >
        {children}
      </code>
    )
  }
  // Extract language from className (e.g. "language-python")
  const lang = className?.replaceAll('language-', '')
  return (
    <div style={{ position: 'relative' }}>
      {lang && (
        <span
          style={{
            position: 'absolute',
            top: -20,
            right: 8,
            fontSize: 10,
            color: '#9ca3af',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {lang}
        </span>
      )}
      <code {...props} className={className}>
        {children}
      </code>
    </div>
  )
}

function DocBlockquote({ children, ...props }: any) {
  return (
    <blockquote
      {...props}
      style={{
        borderLeft: '3px solid rgba(79, 70, 229, 0.3)',
        padding: '4px 12px',
        margin: '8px 0',
        color: '#6b7280',
        background: 'rgba(0,0,0,0.02)',
        borderRadius: '0 6px 6px 0',
      }}
    >
      {children}
    </blockquote>
  )
}

function DocTable({ children, ...props }: any) {
  return (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table {...props} style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        {children}
      </table>
    </div>
  )
}

function DocTh({ children, ...props }: any) {
  return (
    <th
      {...props}
      style={{
        padding: '6px 10px',
        border: '1px solid rgba(0,0,0,0.1)',
        background: RGBA_0_0_0_0_04,
        fontWeight: 600,
        textAlign: 'left',
      }}
    >
      {children}
    </th>
  )
}

function DocTd({ children, ...props }: any) {
  return (
    <td {...props} style={{ padding: '4px 10px', border: '1px solid rgba(0,0,0,0.08)' }}>
      {children}
    </td>
  )
}

function DocLi({ children, className, ...props }: any) {
  const isTask = className === 'task-list-item'
  return (
    <li
      {...props}
      className={className}
      style={{
        margin: '2px 0',
        ...(isTask ? { listStyleType: 'none', marginLeft: -20 } : {}),
      }}
    >
      {children}
    </li>
  )
}

function DocHr() {
  return (
    <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.08)', margin: '12px 0' }} />
  )
}

const DOC_MD_COMPONENTS = {
  img: DocImg,
  a: DocA,
  pre: DocPre,
  code: DocCode,
  blockquote: DocBlockquote,
  table: DocTable,
  th: DocTh,
  td: DocTd,
  li: DocLi,
  hr: DocHr,
}

// ── Markdown Viewer (react-markdown) ───────────────────────────

function MarkdownViewer({ content, projectId }: { content: string; readonly projectId: string }) {
  return (
    <ProjectIdContext.Provider value={projectId}>
      <div className="md-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={DOC_MD_COMPONENTS}
        >
          {content}
        </ReactMarkdown>
      </div>
    </ProjectIdContext.Provider>
  )
}

// ── Main Component ─────────────────────────────────────────────

export function ProjectDocsPanel({
  projectId,
  projectName,
  projectColor,
  onClose,
}: Readonly<ProjectDocsPanelProps>) {
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
          const detail = err.detail || 'Failed to load files'
          // Friendly message for missing folder
          if (detail.includes('no folder configured')) {
            throw new Error(
              'No project folder configured. Set a folder path in project settings to browse docs.'
            )
          }
          if (detail.includes('not found')) {
            throw new Error(
              'Project folder not found on disk. The configured path may not exist yet.'
            )
          }
          throw new Error(detail)
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
  const openFile = useCallback(
    async (entry: FileEntry) => {
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
        const res = await fetch(
          `${API_BASE}/projects/${projectId}/files/content?path=${encodeURIComponent(entry.path)}`
        )
        if (!res.ok) throw new Error('Failed to load file')
        const data = await res.json()
        setFileContent(data)
      } catch (err) {
        setFileContent(null)
        setError(err instanceof Error ? err.message : 'Failed to load file')
      } finally {
        setLoadingContent(false)
      }
    },
    [projectId]
  )

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
        .map((e) => {
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
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 80,
        width: 420,
        zIndex: 30,
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
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {view === 'viewer' && (
          <button
            onClick={() => {
              setView('browser')
              setSelectedFile(null)
              setFileContent(null)
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: 'none',
              background: RGBA_0_0_0_0_05,
              color: '#6b7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ←
          </button>
        )}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: color + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          📂
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#1f2937',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {view === 'viewer' && selectedFile ? selectedFile.name : `${projectName} Docs`}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
            {view === 'viewer' && selectedFile ? selectedFile.path : `${fileCounts.all} files`}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 'none',
            background: RGBA_0_0_0_0_05,
            color: '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = RGBA_0_0_0_0_05
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', margin: '12px 0 0' }} />

      {/* File type filter (browser view only) */}
      {view === 'browser' && !loading && !error && (
        <div
          style={{
            padding: '8px 16px',
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          {[
            { key: 'all', label: 'All', icon: '📋' },
            { key: 'document', label: 'Docs', icon: '📝' },
            { key: 'code', label: 'Code', icon: '💻' },
            { key: 'config', label: 'Config', icon: '⚙️' },
            { key: 'image', label: 'Images', icon: '🖼️' },
          ].map((f) => (
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
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: view === 'viewer' ? '0' : '8px 8px',
        }}
      >
        {loading && (
          <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            Loading files...
          </div>
        )}

        {error && (
          <div
            style={{
              margin: 16,
              padding: 12,
              borderRadius: 10,
              background: '#fef2f2',
              color: '#991b1b',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* File Browser */}
        {view === 'browser' &&
          !loading &&
          !error &&
          (filteredFiles.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No files found
            </div>
          ) : (
            <FileTree
              entries={filteredFiles}
              onSelect={openFile}
              selectedPath={selectedFile?.path || null}
            />
          ))}

        {/* File Viewer */}
        {view === 'viewer' &&
          (loadingContent ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Loading content...
            </div>
          ) : fileContent ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* TOC for markdown */}
              {toc.length > 3 && (
                <div
                  style={{
                    padding: '8px 16px',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    background: 'rgba(0,0,0,0.02)',
                    maxHeight: 120,
                    overflow: 'auto',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      marginBottom: 4,
                    }}
                  >
                    Contents
                  </div>
                  {toc.map((entry) => (
                    <div
                      key={entry.text}
                      style={{
                        fontSize: 11,
                        color: '#6b7280',
                        padding: '2px 0',
                        paddingLeft: (entry.level - 1) * 12,
                        cursor: 'default',
                      }}
                    >
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
                      {selectedFile.name} ·{' '}
                      {selectedFile.size ? formatFileSize(selectedFile.size) : ''}
                    </div>
                  </div>
                )}

                {fileContent.type === 'document' && fileContent.extension === '.md' && (
                  <MarkdownViewer content={fileContent.content} projectId={projectId} />
                )}

                {(fileContent.type === 'code' ||
                  fileContent.type === 'config' ||
                  (fileContent.type === 'document' && fileContent.extension !== '.md')) && (
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      background: 'rgba(0,0,0,0.03)',
                      borderRadius: 8,
                      fontSize: 12,
                      lineHeight: 1.6,
                      fontFamily: UI_MONOSPACE_SFMONO_REGULAR_SF_MONO_MENL,
                      color: '#374151',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {fileContent.content}
                  </pre>
                )}
              </div>
            </div>
          ) : null)}
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
        .md-content h1 {
          font-size: 20px;
          font-weight: 800;
          color: #111827;
          margin: 16px 0 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }
        .md-content h2 {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
          margin: 14px 0 6px;
        }
        .md-content h3 {
          font-size: 14px;
          font-weight: 700;
          color: #374151;
          margin: 12px 0 4px;
        }
        .md-content h4 {
          font-size: 13px;
          font-weight: 700;
          color: #4b5563;
          margin: 10px 0 4px;
        }
        .md-content p {
          margin: 6px 0;
        }
        .md-content ul, .md-content ol {
          padding-left: 20px;
          margin: 4px 0;
        }
        .md-content li {
          margin: 2px 0;
        }
        .md-content input[type="checkbox"] {
          margin-right: 6px;
        }
        .md-content strong {
          font-weight: 700;
          color: #1f2937;
        }
        .md-content em {
          font-style: italic;
        }
        .md-content del {
          text-decoration: line-through;
          color: #9ca3af;
        }
      `}</style>
    </div>
  )
}
