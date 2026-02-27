import { useState } from 'react'

export interface TreeNode {
  name: string
  type: 'folder' | 'file'
  path?: string
  children?: TreeNode[]
}

interface FolderTreeNodeProps {
  readonly node: TreeNode
  readonly onSelectFile: (path: string) => void
  readonly selectedPath?: string
  readonly searchFilter?: string
  readonly depth?: number
}

function matchesSearch(node: TreeNode, filter: string): boolean {
  if (!filter) return true
  const lower = filter.toLowerCase()
  if (node.type === 'file') {
    return (
      node.name.toLowerCase().includes(lower) || (node.path?.toLowerCase().includes(lower) ?? false)
    )
  }
  if (node.name.toLowerCase().includes(lower)) return true
  return node.children?.some((child) => matchesSearch(child, filter)) ?? false
}

export function FolderTreeNode({
  node,
  onSelectFile,
  selectedPath,
  searchFilter = '',
  depth = 0,
}: FolderTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2 || !!searchFilter)

  if (searchFilter && !matchesSearch(node, searchFilter)) {
    return null
  }

  if (node.type === 'file') {
    const isSelected = selectedPath === node.path
    return (
      <button
        type="button"
        className={`pl-4 py-1 cursor-pointer rounded text-sm transition-colors text-left w-full ${
          isSelected
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-muted/50 text-foreground'
        }`}
        onClick={() => node.path && onSelectFile(node.path)}
      >
        📄 {node.name}
      </button>
    )
  }

  const shouldAutoExpand = !!searchFilter
  const isExpanded = shouldAutoExpand || expanded

  return (
    <div>
      <button
        type="button"
        className="pl-2 py-1 cursor-pointer hover:bg-muted/30 rounded text-sm font-medium transition-colors text-left w-full"
        onClick={() => setExpanded(!expanded)}
      >
        {isExpanded ? '📂' : '📁'} {node.name}
      </button>
      {isExpanded &&
        node.children?.map((child) => (
          <div key={child.path} className="pl-4">
            <FolderTreeNode
              node={child}
              onSelectFile={onSelectFile}
              selectedPath={selectedPath}
              searchFilter={searchFilter}
              depth={depth + 1}
            />
          </div>
        ))}
    </div>
  )
}
