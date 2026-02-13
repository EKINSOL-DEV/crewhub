import { useState } from 'react'

export interface TreeNode {
  name: string
  type: 'folder' | 'file'
  path?: string
  children?: TreeNode[]
}

interface FolderTreeNodeProps {
  node: TreeNode
  onSelectFile: (path: string) => void
  selectedPath?: string
  searchFilter?: string
  depth?: number
}

function matchesSearch(node: TreeNode, filter: string): boolean {
  if (!filter) return true
  const lower = filter.toLowerCase()
  if (node.type === 'file') {
    return (node.name.toLowerCase().includes(lower) || (node.path?.toLowerCase().includes(lower) ?? false))
  }
  if (node.name.toLowerCase().includes(lower)) return true
  return node.children?.some(child => matchesSearch(child, filter)) ?? false
}

export function FolderTreeNode({ node, onSelectFile, selectedPath, searchFilter = '', depth = 0 }: FolderTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1 || !!searchFilter)

  if (searchFilter && !matchesSearch(node, searchFilter)) {
    return null
  }

  if (node.type === 'file') {
    const isSelected = selectedPath === node.path
    return (
      <div
        className={`pl-4 py-1 cursor-pointer rounded text-sm transition-colors ${
          isSelected
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-muted/50 text-foreground'
        }`}
        onClick={() => node.path && onSelectFile(node.path)}
      >
        📄 {node.name}
      </div>
    )
  }

  const shouldAutoExpand = !!searchFilter
  const isExpanded = shouldAutoExpand || expanded

  return (
    <div>
      <div
        className="pl-2 py-1 cursor-pointer hover:bg-muted/30 rounded text-sm font-medium transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {isExpanded ? '📂' : '📁'} {node.name}
      </div>
      {isExpanded && node.children?.map((child, i) => (
        <div key={child.path || child.name + i} className="pl-4">
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
