/**
 * ConversationTreePanel — shows chat messages as a collapsible tree.
 * Each node represents a message with its role and a short preview.
 */
import { useState, memo } from 'react'
import type { ChatMessageData } from '@/hooks/useStreamingChat'

interface ConversationTreePanelProps {
  readonly messages: ChatMessageData[]
  readonly onMessageClick: (messageId: string) => void
  readonly currentMessageId?: string
}

interface TreeNode {
  id: string
  role: string
  preview: string
  timestamp: number
  tools: string[]
  children: TreeNode[]
}

function buildTree(messages: ChatMessageData[]): TreeNode[] {
  // Group consecutive assistant messages with their preceding user message
  const nodes: TreeNode[] = []
  let currentGroup: TreeNode | null = null

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (currentGroup) nodes.push(currentGroup)
      currentGroup = {
        id: msg.id,
        role: 'user',
        preview: msg.content.slice(0, 80) + (msg.content.length > 80 ? '...' : ''),
        timestamp: msg.timestamp,
        tools: [],
        children: [],
      }
    } else if (msg.role === 'assistant' && currentGroup) {
      const tools = msg.tools?.map((t) => t.name) || []
      currentGroup.children.push({
        id: msg.id,
        role: 'assistant',
        preview: msg.content.slice(0, 60) + (msg.content.length > 60 ? '...' : ''),
        timestamp: msg.timestamp,
        tools,
        children: [],
      })
    } else if (msg.role === 'assistant') {
      nodes.push({
        id: msg.id,
        role: 'assistant',
        preview: msg.content.slice(0, 60) + (msg.content.length > 60 ? '...' : ''),
        timestamp: msg.timestamp,
        tools: msg.tools?.map((t) => t.name) || [],
        children: [],
      })
    }
  }
  if (currentGroup) nodes.push(currentGroup)
  return nodes
}

const TreeNodeItem = memo(function TreeNodeItem({
  node,
  depth,
  isActive,
  onClick,
}: {
  readonly node: TreeNode
  readonly depth: number
  readonly isActive: boolean
  readonly onClick: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const roleIcon = node.role === 'user' ? '\u{1F464}' : '\u{1F916}'
  const roleColor = node.role === 'user' ? 'text-blue-400' : 'text-green-400'

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <button
        onClick={() => {
          onClick()
          if (hasChildren) setExpanded(!expanded)
        }}
        className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-white/10 transition-colors flex items-start gap-1.5 ${
          isActive ? 'bg-white/15 ring-1 ring-white/20' : ''
        }`}
      >
        {hasChildren && (
          <span className="text-[10px] mt-0.5 opacity-50">{expanded ? '\u25BC' : '\u25B6'}</span>
        )}
        <span className={roleColor}>{roleIcon}</span>
        <span className="text-white/70 truncate flex-1">{node.preview || '(empty)'}</span>
        {node.tools.length > 0 && (
          <span className="text-white/30 text-[10px]">{node.tools.length} tools</span>
        )}
      </button>
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNodeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            isActive={false}
            onClick={() => onClick()}
          />
        ))}
    </div>
  )
})

export const ConversationTreePanel = memo(function ConversationTreePanel({
  messages,
  onMessageClick,
  currentMessageId,
}: ConversationTreePanelProps) {
  const tree = buildTree(messages)

  return (
    <div className="flex flex-col h-full overflow-y-auto p-2 bg-black/20 border-r border-white/10">
      <div className="text-xs font-medium text-white/50 mb-2 px-2">Conversation Tree</div>
      {tree.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          depth={0}
          isActive={node.id === currentMessageId}
          onClick={() => onMessageClick(node.id)}
        />
      ))}
      {tree.length === 0 && <div className="text-xs text-white/30 px-2">No messages yet</div>}
    </div>
  )
})
