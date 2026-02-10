import { useState, useCallback } from 'react'
import { useProjectDocuments, useProjectDocumentContent, type DocFileNode } from '@/hooks/useProjectDocuments'
import { FullscreenOverlay } from '../markdown/FullscreenOverlay'

interface ProjectFilesSectionProps {
  projectId: string
  projectName: string
  projectColor?: string
}

/**
 * Compact project files browser for the Room Info Panel.
 * Shows a collapsible file tree with inline preview.
 */
export function ProjectFilesSection({ projectId, projectName, projectColor }: ProjectFilesSectionProps) {
  const { files, loading, error } = useProjectDocuments(projectId)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const { content, metadata } = useProjectDocumentContent(projectId, selectedPath)

  const accentColor = projectColor || '#4f46e5'

  const handleFileClick = useCallback((file: DocFileNode) => {
    if (file.type === 'file') {
      setSelectedPath(file.path)
      setFullscreenOpen(true) // Open fullscreen immediately
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* File tree - full height */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        borderRadius: 8,
        border: '1px solid var(--zen-border, hsl(var(--border)))',
        background: 'var(--zen-bg, hsl(var(--background)))',
      }}>
        {loading ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--zen-fg-muted, hsl(var(--muted-foreground)))', textAlign: 'center' }}>
            Loading files…
          </div>
        ) : files.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--zen-fg-muted, hsl(var(--muted-foreground)))', textAlign: 'center' }}>
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
      </div>

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
          color: isSelected ? accentColor : 'var(--zen-fg, hsl(var(--foreground)))',
          fontWeight: isSelected ? 600 : 400,
          textAlign: 'left',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--zen-bg-hover, hsl(var(--secondary)))' }}
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
