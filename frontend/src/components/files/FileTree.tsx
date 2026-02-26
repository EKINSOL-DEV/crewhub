import { useState, useCallback } from 'react'
import type { FileNode } from '@/hooks/useAgentFiles'

const VAR_ZEN_FG_MUTED = 'var(--zen-fg-muted, hsl(var(--muted-foreground)))'

interface FileTreeProps {
  readonly files: FileNode[]
  readonly selectedPath?: string
  readonly onSelect: (file: FileNode) => void
  readonly onExpand?: (file: FileNode) => void
  readonly loading?: boolean
}

function FileIcon({ type, name }: { type: string; name: string }) {
  if (type === 'directory') return <span style={{ fontSize: 13 }}>📁</span>
  if (name.endsWith('.md')) return <span style={{ fontSize: 13 }}>📝</span>
  if (name.endsWith('.json')) return <span style={{ fontSize: 13 }}>📋</span>
  if (name.endsWith('.yaml') || name.endsWith('.yml'))
    return <span style={{ fontSize: 13 }}>⚙️</span>
  return <span style={{ fontSize: 13 }}>📄</span>
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + 'B'
  return (bytes / 1024).toFixed(1) + 'K'
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  onExpand,
}: {
  readonly node: FileNode
  readonly depth: number
  readonly selectedPath?: string
  readonly onSelect: (file: FileNode) => void
  readonly onExpand?: (file: FileNode) => void
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const isSelected = node.path === selectedPath
  const isDir = node.type === 'directory'

  const handleClick = useCallback(() => {
    if (isDir) {
      setExpanded((prev) => !prev)
    } else {
      onSelect(node)
    }
  }, [isDir, node, onSelect])

  return (
    <div>
      <div
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleClick() } }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px 4px ' + (8 + depth * 16) + 'px',
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
          color: isSelected
            ? 'var(--zen-accent, hsl(var(--primary)))'
            : 'var(--zen-fg, hsl(var(--foreground)))',
          background: isSelected
            ? 'var(--zen-bg-active, hsl(var(--primary) / 0.1))'
            : 'transparent',
          borderRadius: 4,
          transition: 'background 0.1s',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          if (!isSelected)
            e.currentTarget.style.background = 'var(--zen-bg-hover, hsl(var(--secondary)))'
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent'
        }}
      >
        {isDir && (
          <span
            style={{
              fontSize: 10,
              color: VAR_ZEN_FG_MUTED,
              width: 10,
              textAlign: 'center',
            }}
          >
            {expanded ? '▼' : '▶'}
          </span>
        )}
        {!isDir && <span style={{ width: 10 }} />}
        <FileIcon type={node.type} name={node.name} />
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {node.name}
        </span>
        {!isDir && node.size != null && (
          <span style={{ fontSize: 10, color: VAR_ZEN_FG_MUTED }}>{formatSize(node.size)}</span>
        )}
        {!isDir && onExpand && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onExpand(node)
            }}
            title="Fullscreen"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              color: VAR_ZEN_FG_MUTED,
              padding: '0 2px',
              opacity: 0.6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
          >
            ⤢
          </button>
        )}
      </div>
      {isDir &&
        expanded &&
        node.children?.map((child, i) => (
          <TreeNode
            key={child.path || i}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onExpand={onExpand}
          />
        ))}
    </div>
  )
}

export function FileTree({ files, selectedPath, onSelect, onExpand, loading }: Readonly<FileTreeProps>) {
  if (loading) {
    return (
      <div
        style={{
          padding: 16,
          fontSize: 12,
          color: VAR_ZEN_FG_MUTED,
          textAlign: 'center',
        }}
      >
        Loading files…
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          fontSize: 12,
          color: VAR_ZEN_FG_MUTED,
          textAlign: 'center',
        }}
      >
        No files found
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {files.map((node, i) => (
        <TreeNode
          key={node.path || i}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onExpand={onExpand}
        />
      ))}
    </div>
  )
}
