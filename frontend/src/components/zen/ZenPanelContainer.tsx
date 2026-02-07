/**
 * Zen Panel Container - Renders the split-tree layout
 * Recursive component that handles both split nodes and leaf nodes
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { type LayoutNode, type LeafNode, type PanelType } from './types/layout'
import { ZenPanel } from './ZenPanel'

interface ZenPanelContainerProps {
  node: LayoutNode
  focusedPanelId: string
  canClose: boolean
  onFocus: (panelId: string) => void
  onClose: (panelId: string) => void
  onResize?: (panelId: string, delta: number) => void
  onSplit?: (panelId: string, direction: 'row' | 'col') => void
  onChangePanelType?: (panelId: string, type: PanelType) => void
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
  onSplit: _onSplit,
  onChangePanelType: _onChangePanelType,
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
        onSplitVertical={_onSplit ? () => _onSplit(node.panelId, 'row') : undefined}
        onSplitHorizontal={_onSplit ? () => _onSplit(node.panelId, 'col') : undefined}
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
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()
      
      // Use fresh rect for accurate position
      const rect = container.getBoundingClientRect()
      const handleSize = 4 // resize handle width/height in pixels
      const currentTotalSize = isRow ? rect.width : rect.height
      const availableSize = currentTotalSize - handleSize
      
      // Get mouse position relative to container
      const mousePos = isRow 
        ? moveEvent.clientX - rect.left 
        : moveEvent.clientY - rect.top
      
      // The first panel's size should be mousePos minus half the handle
      // This makes the handle center follow the mouse
      const panelSize = mousePos - (handleSize / 2)
      
      // Calculate ratio based on available space (excluding handle)
      const minRatio = MIN_PANEL_SIZE / availableSize
      const maxRatio = 1 - (MIN_PANEL_SIZE / availableSize)
      
      let newRatio = panelSize / availableSize
      newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio))
      
      // Only update if ratio actually changed
      if (Math.abs(newRatio - ratioRef.current) > 0.001) {
        onRatioChange(newRatio)
        ratioRef.current = newRatio
      }
    }
    
    // Capture previous body styles to restore later
    const prevCursor = document.body.style.cursor
    const prevUserSelect = document.body.style.userSelect
    
    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // Restore previous values instead of setting to empty
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevUserSelect
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
      {/* First child - use calc to account for 4px handle */}
      <div 
        style={{ 
          flex: `0 0 calc(${ratio * 100}% - ${4 * ratio}px)`,
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
