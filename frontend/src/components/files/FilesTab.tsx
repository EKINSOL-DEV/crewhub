import { useState, useCallback } from 'react'
import { useAgentFiles, type FileNode } from '@/hooks/useAgentFiles'
import { useFileContent, saveAgentFile } from '@/hooks/useFileContent'
import { FileTree } from './FileTree'
import { MarkdownViewer } from '../markdown/MarkdownViewer'
import { FullscreenOverlay } from '../markdown/FullscreenOverlay'

interface FilesTabProps {
  agentId: string
  agentName?: string
}

export function FilesTab({ agentId, agentName }: FilesTabProps) {
  const { files, loading: filesLoading, error: filesError, refresh } = useAgentFiles(agentId)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const { content, metadata, loading: contentLoading, setContent } = useFileContent(agentId, selectedPath)

  const handleSelect = useCallback((file: FileNode) => {
    if (file.type === 'file') {
      setSelectedPath(file.path)
    }
  }, [])

  const handleExpand = useCallback((file: FileNode) => {
    setSelectedPath(file.path)
    setFullscreenOpen(true)
  }, [])

  if (filesError) {
    return (
      <div style={{ padding: 12, fontSize: 12, color: '#ef4444' }}>
        Failed to load files: {filesError}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* File Tree */}
      <div style={{
        maxHeight: selectedPath ? '40%' : '100%',
        overflow: 'auto',
        borderBottom: selectedPath ? '1px solid hsl(var(--border))' : 'none',
        flexShrink: 0,
      }}>
        <FileTree
          files={files}
          selectedPath={selectedPath ?? undefined}
          onSelect={handleSelect}
          onExpand={handleExpand}
          loading={filesLoading}
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
            <span style={{
              fontSize: 11,
              color: 'hsl(var(--muted-foreground))',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {selectedPath}
            </span>
            <button
              onClick={() => setFullscreenOpen(true)}
              title="Open fullscreen"
              style={{
                background: 'hsl(var(--secondary))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                cursor: 'pointer',
                color: 'hsl(var(--foreground))',
              }}
            >
              ⤢ Fullscreen
            </button>
          </div>
          {contentLoading ? (
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Loading…</div>
          ) : content ? (
            <MarkdownViewer content={content} maxHeight="none" />
          ) : null}
        </div>
      )}

      {/* Fullscreen Overlay */}
      {content && metadata && (
        <FullscreenOverlay
          open={fullscreenOpen}
          onClose={() => setFullscreenOpen(false)}
          title={selectedPath?.split('/').pop() || ''}
          subtitle={agentName || agentId}
          content={content}
          metadata={metadata}
          editable={selectedPath?.endsWith('.md') || selectedPath?.endsWith('.txt')}
          onSave={async (newContent: string) => {
            if (!selectedPath) return
            await saveAgentFile(agentId, selectedPath, newContent)
            setContent(newContent)
            refresh()
          }}
        />
      )}
    </div>
  )
}
