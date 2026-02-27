import { useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import {
  getDocNodeIcon,
  isDocFilteredOut,
  sortDocNodes,
  type DocNode,
  type SortKey,
} from '@/components/zen/hooks/useDocumentPanel'

type TreeVariant = 'zen' | 'mobile'

interface DocumentTreeNodeProps {
  readonly node: DocNode
  readonly depth: number
  readonly sortKey: SortKey
  readonly onOpen: (path: string) => void
  readonly searchQuery: string
  readonly variant: TreeVariant
  readonly formatDate: (ts?: number) => string
}

function getButtonStyles(variant: TreeVariant, depth: number): CSSProperties {
  if (variant === 'zen') {
    return {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: `4px 12px 4px ${12 + depth * 18}px`,
      cursor: 'pointer',
      fontSize: 12,
      fontFamily: 'system-ui, sans-serif',
      color: 'var(--zen-fg, hsl(var(--foreground)))',
      userSelect: 'none',
      borderRadius: 4,
      transition: 'background 0.1s',
      background: 'transparent',
      border: 'none',
      width: '100%',
      textAlign: 'left',
    }
  }

  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: `12px 16px 12px ${16 + depth * 20}px`,
    cursor: 'pointer',
    fontSize: 14,
    color: '#e2e8f0',
    userSelect: 'none',
    minHeight: 44,
    WebkitTapHighlightColor: 'transparent',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    width: '100%',
    textAlign: 'left',
  }
}

function getArrowStyle(variant: TreeVariant): CSSProperties {
  if (variant === 'zen') {
    return {
      fontSize: 9,
      width: 12,
      textAlign: 'center',
      color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
    }
  }

  return { fontSize: 11, width: 16, textAlign: 'center', color: '#64748b' }
}

function getDateStyle(variant: TreeVariant): CSSProperties {
  if (variant === 'zen') {
    return {
      fontSize: 10,
      color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }
  }

  return { fontSize: 11, color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }
}

function getDirectoryLabel(node: DocNode): string {
  return node.name
}

function getFileLabel(node: DocNode): string {
  return node.name.replace(/\.md$/, '')
}

function handleDirectoryAction(onToggle: () => void): void {
  onToggle()
}

function handleFileAction(nodePath: string, onOpen: (path: string) => void): void {
  onOpen(nodePath)
}

export function DocumentTreeNode({
  node,
  depth,
  sortKey,
  onOpen,
  searchQuery,
  variant,
  formatDate,
}: DocumentTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0)
  const isDirectory = node.type === 'directory'

  if (isDocFilteredOut(node, searchQuery)) return null

  const isExpanded = searchQuery.length >= 2 ? true : expanded
  const sortedChildren = isDirectory && node.children ? sortDocNodes(node.children, sortKey) : []
  const nodeIcon = getDocNodeIcon(isDirectory, isExpanded)
  const buttonStyles = getButtonStyles(variant, depth)
  const arrowStyle = getArrowStyle(variant)
  const dateStyle = getDateStyle(variant)
  const arrow: string | null = isDirectory ? (isExpanded ? '▼' : '▶') : null

  const spacerWidth = variant === 'zen' ? 12 : 16
  const iconFontSize = variant === 'zen' ? 13 : 16
  const nodeLabel = isDirectory ? getDirectoryLabel(node) : getFileLabel(node)
  const hoverBackground = 'var(--zen-bg-hover, hsl(var(--accent)))'

  const toggleExpanded = () => setExpanded((prev) => !prev)
  const onNodeSelect = () => {
    if (isDirectory) {
      handleDirectoryAction(toggleExpanded)
      return
    }

    handleFileAction(node.path, onOpen)
  }

  const onNodeKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onNodeSelect()
    }
  }

  const handleMouseEnter =
    variant === 'zen'
      ? (e: MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.background = hoverBackground
        }
      : undefined

  const handleMouseLeave =
    variant === 'zen'
      ? (e: MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.background = 'transparent'
        }
      : undefined

  return (
    <>
      <button
        type="button"
        onClick={onNodeSelect}
        onKeyDown={onNodeKeyDown}
        style={buttonStyles}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {isDirectory ? (
          <span style={arrowStyle}>{arrow}</span>
        ) : (
          <span style={{ width: spacerWidth }} />
        )}

        <span style={{ fontSize: iconFontSize }}>{nodeIcon}</span>

        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {nodeLabel}
        </span>

        {!isDirectory && node.lastModified && (
          <span style={dateStyle}>{formatDate(node.lastModified)}</span>
        )}
      </button>

      {isDirectory &&
        isExpanded &&
        sortedChildren.map((child) => (
          <DocumentTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            sortKey={sortKey}
            onOpen={onOpen}
            searchQuery={searchQuery}
            variant={variant}
            formatDate={formatDate}
          />
        ))}
    </>
  )
}
