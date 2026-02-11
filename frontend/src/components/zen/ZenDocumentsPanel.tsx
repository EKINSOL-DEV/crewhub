/**
 * ZenDocumentsPanel - Project documents browser for Zen mode.
 * Reuses FileTree, MarkdownViewer, FullscreenOverlay from Phase 1.
 */
import { useState, useCallback, useMemo } from 'react'
import { useProjectDocuments, useProjectDocumentContent, saveProjectDocument, type DocFileNode } from '@/hooks/useProjectDocuments'
import { FileTree } from '../files/FileTree'
import { MarkdownViewer } from '../markdown/MarkdownViewer'
import { FullscreenOverlay } from '../markdown/FullscreenOverlay'
import type { FileNode } from '@/hooks/useAgentFiles'

interface ZenDocumentsPanelProps {
  projectId: string | null
  projectName?: string | null
}

// Breadcrumb for folder navigation
function Breadcrumbs({ path, onNavigate }: { path: string | null; onNavigate: (path: string | null) => void }) {
  if (!path) return null
  const parts = path.replace(/\/$/, '').split('/')
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '6px 12px',
      fontSize: 11,
      color: 'var(--zen-fg-muted, hsl(var(--muted-foreground)))',
      borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
      flexWrap: 'wrap',
    }}>
      <span
        onClick={() => onNavigate(null)}
        style={{ cursor: 'pointer', color: 'var(--zen-accent, hsl(var(--primary)))' }}
      >
        📁 Root
      </span>
      {parts.map((part, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ opacity: 0.5 }}>/</span>
          <span
            onClick={() => onNavigate(parts.slice(0, i + 1).join('/') + '/')}
            style={{ cursor: 'pointer', color: i === parts.length - 1 ? 'hsl(var(--foreground))' : 'hsl(var(--primary))' }}
          >
            {part}
          </span>
        </span>
      ))}
    </div>
  )
}

export function ZenDocumentsPanel({ projectId, projectName }: ZenDocumentsPanelProps) {
  const { files, projectName: fetchedName, loading, error, refresh } = useProjectDocuments(projectId)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

  const { content, metadata, loading: contentLoading, setContent } = useProjectDocumentContent(projectId, selectedPath)

  const displayName = projectName || fetchedName || 'Project'

  // Adapt DocFileNode to FileNode for FileTree compatibility
  const adaptedFiles = useMemo(() => {
    function adapt(nodes: DocFileNode[]): FileNode[] {
      return nodes.map(n => ({
        name: n.name,
        path: n.path,
        type: n.type,
        size: n.size,
        modified: n.modified,
        lines: n.lines,
        children: n.children ? adapt(n.children) : undefined,
      }))
    }
    return adapt(files)
  }, [files])

  const handleSelect = useCallback((file: FileNode) => {
    if (file.type === 'file') {
      setSelectedPath(file.path)
    }
  }, [])

  const handleExpand = useCallback((file: FileNode) => {
    setSelectedPath(file.path)
    setFullscreenOpen(true)
  }, [])

  if (!projectId) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--zen-fg-muted, hsl(var(--muted-foreground)))',
        fontSize: 13,
        flexDirection: 'column',
        gap: 8,
      }}>
        <span style={{ fontSize: 32 }}>📂</span>
        <span>Select a project to browse documents</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: '#ef4444', textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
        {error}
        <div style={{ marginTop: 8 }}>
          <button
            onClick={refresh}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid var(--zen-border, hsl(var(--border)))',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>📂</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--zen-fg, hsl(var(--foreground)))' }}>
            {displayName} — Documents
          </span>
        </div>
        <button
          onClick={refresh}
          title="Refresh"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--zen-fg-muted, hsl(var(--muted-foreground)))',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          🔄
        </button>
      </div>

      {/* Breadcrumbs */}
      <Breadcrumbs path={currentFolder} onNavigate={setCurrentFolder} />

      {/* File Tree */}
      <div style={{
        maxHeight: selectedPath ? '40%' : '100%',
        overflow: 'auto',
        borderBottom: selectedPath ? '1px solid hsl(var(--border))' : 'none',
        flexShrink: 0,
      }}>
        <FileTree
          files={adaptedFiles}
          selectedPath={selectedPath ?? undefined}
          onSelect={handleSelect}
          onExpand={handleExpand}
          loading={loading}
        />
      </div>

      {/* Preview */}
      {selectedPath && (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px', minHeight: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--zen-fg, hsl(var(--foreground)))' }}>
              {selectedPath.split('/').pop()}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
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
              <button
                onClick={() => { setSelectedPath(null) }}
                title="Close preview"
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
                ✕
              </button>
            </div>
          </div>

          {contentLoading && (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--zen-fg-muted, hsl(var(--muted-foreground)))', textAlign: 'center' }}>
              Loading…
            </div>
          )}

          {content && (
            <div style={{ fontSize: 13 }}>
              <MarkdownViewer content={content} />
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
          subtitle={selectedPath || ''}
          content={content}
          metadata={{
            size: metadata.size,
            modified: metadata.modified,
            lines: metadata.lines,
          }}
          editable={selectedPath?.endsWith('.md') || selectedPath?.endsWith('.txt')}
          onSave={async (newContent: string) => {
            if (!projectId || !selectedPath) return
            await saveProjectDocument(projectId, selectedPath, newContent)
            setContent(newContent)
            // Refresh file list to update metadata
            refresh()
          }}
        />
      )}
    </div>
  )
}
