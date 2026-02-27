import { useState, type CSSProperties } from 'react'
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

  const zenButtonStyles: CSSProperties = {
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

  const mobileButtonStyles: CSSProperties = {
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

  const arrow = isDirectory ? (isExpanded ? '▼' : '▶') : null
  const arrowStyle: CSSProperties =
    variant === 'zen'
      ? {
          fontSize: 9,
          width: 12,
          textAlign: 'center',
          color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
        }
      : { fontSize: 11, width: 16, textAlign: 'center', color: '#64748b' }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isDirectory) setExpanded((prev) => !prev)
          else onOpen(node.path)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (isDirectory) setExpanded((prev) => !prev)
            else onOpen(node.path)
          }
        }}
        style={variant === 'zen' ? zenButtonStyles : mobileButtonStyles}
        onMouseEnter={
          variant === 'zen'
            ? (e) => (e.currentTarget.style.background = 'var(--zen-bg-hover, hsl(var(--accent)))')
            : undefined
        }
        onMouseLeave={
          variant === 'zen' ? (e) => (e.currentTarget.style.background = 'transparent') : undefined
        }
      >
        {isDirectory ? (
          <span style={arrowStyle}>{arrow}</span>
        ) : (
          <span style={{ width: variant === 'zen' ? 12 : 16 }} />
        )}

        <span style={{ fontSize: variant === 'zen' ? 13 : 16 }}>{nodeIcon}</span>

        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {isDirectory ? node.name : node.name.replace(/\.md$/, '')}
        </span>

        {!isDirectory && node.lastModified && (
          <span
            style={
              variant === 'zen'
                ? {
                    fontSize: 10,
                    color: 'var(--zen-fg-dim, hsl(var(--muted-foreground)))',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }
                : { fontSize: 11, color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }
            }
          >
            {formatDate(node.lastModified)}
          </span>
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
