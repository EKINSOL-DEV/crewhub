import { useState, useCallback } from 'react'
import { useProjectDocuments, useProjectDocumentContent, type DocFileNode } from '@/hooks/useProjectDocuments'
import { MarkdownViewer } from '../markdown/MarkdownViewer'
import { FullscreenOverlay } from '../markdown/FullscreenOverlay'

interface ProjectFilesSectionProps {
  projectId: string
  projectName: string
  projectColor?: string
  onOpenFullscreen?: () => void
}

/**
 * Compact project files browser for the Room Info Panel.
 * Shows a collapsible file tree with inline preview.
 */
export function ProjectFilesSection({ projectId, projectName, projectColor, onOpenFullscreen }: ProjectFilesSectionProps) {
  const { files, loading, error } = useProjectDocuments(projectId)
  const [expanded, setExpanded] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const { content, metadata, loading: contentLoading } = useProjectDocumentContent(projectId, selectedPath)

  const accentColor = projectColor || '#4f46e5'

  const handleFileClick = useCallback((file: DocFileNode) => {
    if (file.type === 'file') {
      setSelectedPath(file.path)
    }
  }, [])

  if (error) {
    return (
      <div style={{ padding: '8px 12px', fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.05)', borderRadius: 8 }}>
        Failed to load files
      </div>
    )
  }

  return (
    <div>
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 14px',
          borderRadius: 8,
          border: 'none',
          background: accentColor + '12',
          color: accentColor,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'inherit',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = accentColor + '20' }}
        onMouseLeave={e => { e.currentTarget.style.background = accentColor + '12' }}
      >
        <span>{expanded ? '📂' : '📁'}</span>
        <span style={{ flex: 1, textAlign: 'left' }}>Project Files</span>
        {onOpenFullscreen && (
          <span
            onClick={e => { e.stopPropagation(); onOpenFullscreen() }}
            title="Open fullscreen docs panel"
            style={{ fontSize: 11, opacity: 0.7 }}
          >
            ⤢
          </span>
        )}
        <span style={{ fontSize: 10, opacity: 0.6 }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {/* Expanded file tree */}
      {expanded && (
        <div style={{
          marginTop: 4,
          maxHeight: 300,
          overflow: 'auto',
          borderRadius: 8,
          border: '1px solid rgba(0,0,0,0.06)',
          background: 'rgba(255,255,255,0.6)',
        }}>
          {loading ? (
            <div style={{ padding: 12, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
              Loading files…
            </div>
          ) : files.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
              No files found
            </div>
          ) : (
            <div style={{ padding: '6px 0' }}>
              {files.map(file => (
                <FileTreeNode
                  key={file.path}
                  node={file}
                  depth={0}
                  selectedPath={selectedPath}
                  onSelect={handleFileClick}
                  accentColor={accentColor}
                />
              ))}
            </div>
          )}

          {/* Inline preview */}
          {selectedPath && (
            <div style={{
              borderTop: '1px solid rgba(0,0,0,0.06)',
              padding: '8px 10px',
              maxHeight: 200,
              overflow: 'auto',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}>
                <span style={{
                  fontSize: 10,
                  color: '#9ca3af',
                  fontFamily: "'JetBrains Mono', monospace",
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {selectedPath}
                </span>
                <button
                  onClick={() => setFullscreenOpen(true)}
                  title="Fullscreen"
                  style={{
                    background: 'rgba(0,0,0,0.05)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 10,
                    cursor: 'pointer',
                    color: '#6b7280',
                  }}
                >
                  ⤢
                </button>
              </div>
              {contentLoading ? (
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Loading…</div>
              ) : content ? (
                <MarkdownViewer content={content} maxHeight="none" />
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen overlay */}
      {content && metadata && (
        <FullscreenOverlay
          open={fullscreenOpen}
          onClose={() => setFullscreenOpen(false)}
          title={selectedPath?.split('/').pop() || ''}
          subtitle={projectName}
          content={content}
          metadata={metadata}
        />
      )}
    </div>
  )
}

// ── Simple File Tree Node ──────────────────────────────────────

function FileTreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  accentColor,
}: {
  node: DocFileNode
  depth: number
  selectedPath: string | null
  onSelect: (file: DocFileNode) => void
  accentColor: string
}) {
  const [open, setOpen] = useState(depth < 1)
  const isDir = node.type === 'directory'
  const isSelected = node.path === selectedPath

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) setOpen(!open)
          else onSelect(node)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '4px 10px',
          paddingLeft: 10 + depth * 14,
          border: 'none',
          background: isSelected ? accentColor + '15' : 'transparent',
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'inherit',
          color: isSelected ? accentColor : '#374151',
          fontWeight: isSelected ? 600 : 400,
          textAlign: 'left',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ fontSize: 11, width: 14, textAlign: 'center', flexShrink: 0 }}>
          {isDir ? (open ? '📂' : '📁') : '📄'}
        </span>
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {node.name}
        </span>
      </button>
      {isDir && open && node.children?.map(child => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          accentColor={accentColor}
        />
      ))}
    </div>
  )
}
