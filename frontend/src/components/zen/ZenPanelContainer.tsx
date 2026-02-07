/**
 * Zen Panel Container - Renders the split-tree layout
 * Recursive component that handles both split nodes and leaf nodes
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { type LayoutNode, type LeafNode } from './types/layout'
import { ZenPanel } from './ZenPanel'

interface ZenPanelContainerProps {
  node: LayoutNode
  focusedPanelId: string
  canClose: boolean
  onFocus: (panelId: string) => void
  onClose: (panelId: string) => void
  onResize?: (panelId: string, delta: number) => void
  renderPanel: (panel: LeafNode) => ReactNode
}

// Minimum panel size in pixels
const MIN_PANEL_SIZE = 150

export function ZenPanelContainer({
  node,
  focusedPanelId,
  canClose,
  onFocus,
  onClose,
  onResize,
  renderPanel,
}: ZenPanelContainerProps) {
  if (node.kind === 'leaf') {
    return (
      <ZenPanel
        panel={node}
        isFocused={focusedPanelId === node.panelId}
        canClose={canClose}
        onFocus={() => onFocus(node.panelId)}
        onClose={() => onClose(node.panelId)}
      >
        {renderPanel(node)}
      </ZenPanel>
    )
  }
  
  // Split node - render both children with a resize handle between them
  return (
    <SplitContainer
      direction={node.dir}
      ratio={node.ratio}
      onRatioChange={(newRatio) => {
        // Find first panel in 'a' subtree and resize it
        const findFirstPanel = (n: LayoutNode): string | null => {
          if (n.kind === 'leaf') return n.panelId
          return findFirstPanel(n.a)
        }
        const panelId = findFirstPanel(node.a)
        if (panelId && onResize) {
          const delta = newRatio - node.ratio
          onResize(panelId, delta)
        }
      }}
    >
      <ZenPanelContainer
        node={node.a}
        focusedPanelId={focusedPanelId}
        canClose={canClose}
        onFocus={onFocus}
        onClose={onClose}
        onResize={onResize}
        renderPanel={renderPanel}
      />
      <ZenPanelContainer
        node={node.b}
        focusedPanelId={focusedPanelId}
        canClose={canClose}
        onFocus={onFocus}
        onClose={onClose}
        onResize={onResize}
        renderPanel={renderPanel}
      />
    </SplitContainer>
  )
}

// ── Split Container ───────────────────────────────────────────────

interface SplitContainerProps {
  direction: 'row' | 'col'
  ratio: number
  onRatioChange: (newRatio: number) => void
  children: [ReactNode, ReactNode]
}

function SplitContainer({ direction, ratio, onRatioChange, children }: SplitContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const ratioRef = useRef(ratio)
  
  // Keep ratio ref in sync
  ratioRef.current = ratio
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    
    const isRow = direction === 'row'
    const container = containerRef.current
    if (!container) return
    
    // Capture initial state
    const initialRect = container.getBoundingClientRect()
    const totalSize = isRow ? initialRect.width : initialRect.height
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()
      
      // Use fresh rect for accurate position
      const rect = container.getBoundingClientRect()
      const currentTotalSize = isRow ? rect.width : rect.height
      
      const pos = isRow 
        ? moveEvent.clientX - rect.left 
        : moveEvent.clientY - rect.top
      
      // Calculate new ratio with proper clamping
      const minRatio = MIN_PANEL_SIZE / currentTotalSize
      const maxRatio = 1 - (MIN_PANEL_SIZE / currentTotalSize)
      
      let newRatio = pos / currentTotalSize
      newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio))
      
      // Only update if ratio actually changed
      if (Math.abs(newRatio - ratioRef.current) > 0.001) {
        onRatioChange(newRatio)
      }
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    // Prevent text selection while dragging
    document.body.style.cursor = isRow ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [direction, onRatioChange])
  
  const isRow = direction === 'row'
  
  return (
    <div
      ref={containerRef}
      className={`zen-split zen-split-${direction}`}
      style={{
        display: 'flex',
        flexDirection: isRow ? 'row' : 'column',
        flex: 1,
        overflow: 'hidden',
      }}
    >
      {/* First child */}
      <div 
        style={{ 
          flex: `0 0 ${ratio * 100}%`,
          display: 'flex',
          overflow: 'hidden',
          minWidth: isRow ? MIN_PANEL_SIZE : undefined,
          minHeight: !isRow ? MIN_PANEL_SIZE : undefined,
        }}
      >
        {children[0]}
      </div>
      
      {/* Resize handle */}
      <div
        className={`zen-resize-handle zen-resize-handle-${direction} ${isDragging ? 'zen-resize-handle-active' : ''}`}
        onMouseDown={handleMouseDown}
        style={{
          cursor: isRow ? 'col-resize' : 'row-resize',
          flexShrink: 0,
        }}
      />
      
      {/* Second child */}
      <div 
        style={{ 
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minWidth: isRow ? MIN_PANEL_SIZE : undefined,
          minHeight: !isRow ? MIN_PANEL_SIZE : undefined,
        }}
      >
        {children[1]}
      </div>
    </div>
  )
}
