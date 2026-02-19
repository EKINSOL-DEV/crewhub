/**
 * Zen Panel Container - Renders the split-tree layout
 * Recursive component that handles both split nodes and leaf nodes
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
  onChangePanelType,
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
        onChangePanelType={onChangePanelType ? (type) => onChangePanelType(node.panelId, type) : undefined}
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
        // Find first panel in 'a' subtree and pass absolute ratio
        const findFirstPanel = (n: LayoutNode): string | null => {
          if (n.kind === 'leaf') return n.panelId
          return findFirstPanel(n.a)
        }
        const panelId = findFirstPanel(node.a)
        if (panelId && onResize) {
          // Pass absolute ratio directly (not delta)
          onResize(panelId, newRatio)
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
        onSplit={_onSplit}
        onChangePanelType={onChangePanelType}
        renderPanel={renderPanel}
      />
      <ZenPanelContainer
        node={node.b}
        focusedPanelId={focusedPanelId}
        canClose={canClose}
        onFocus={onFocus}
        onClose={onClose}
        onResize={onResize}
        onSplit={_onSplit}
        onChangePanelType={onChangePanelType}
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
  // Track active drag state in a ref so cleanup functions always see the latest value
  const isDraggingRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)

  // Keep ratio ref in sync with prop
  ratioRef.current = ratio

  /**
   * Restores body styles that were set to prevent text-selection during drag.
   * Safe to call multiple times (idempotent).
   */
  const restoreBodyStyles = useCallback(() => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(document.body.style as any).webkitUserSelect = ''
  }, [])

  /**
   * Central drag-end routine. Called by pointerup, pointercancel, or window blur.
   * Uses isDraggingRef so it's safe to call redundantly.
   */
  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    activePointerIdRef.current = null
    setIsDragging(false)
    restoreBodyStyles()
  }, [restoreBodyStyles])

  // ── Safety net: restore body styles if the component unmounts mid-drag ──
  useEffect(() => {
    return () => {
      if (isDraggingRef.current) {
        restoreBodyStyles()
      }
    }
  }, [restoreBodyStyles])

  // ── Safety net: window blur ends drag (e.g. Alt+Tab while dragging) ──
  useEffect(() => {
    window.addEventListener('blur', endDrag)
    return () => window.removeEventListener('blur', endDrag)
  }, [endDrag])

  // ── Pointer event handlers (all on the handle element via pointer capture) ──

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    // Stop propagation so nested SplitContainers don't both start dragging
    e.stopPropagation()

    // Capture the pointer: ALL subsequent pointermove/pointerup events for this
    // pointer will be delivered to this element even if the cursor leaves the
    // window. This is the key fix — no more document-level mousemove/mouseup.
    e.currentTarget.setPointerCapture(e.pointerId)
    activePointerIdRef.current = e.pointerId
    isDraggingRef.current = true
    setIsDragging(true)

    const isRow = direction === 'row'
    document.body.style.cursor = isRow ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(document.body.style as any).webkitUserSelect = 'none'
  }, [direction])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore events from other pointers (e.g. multi-touch)
    if (!isDraggingRef.current || e.pointerId !== activePointerIdRef.current) return
    e.preventDefault()

    const container = containerRef.current
    if (!container) return

    const isRow = direction === 'row'
    // Always read a fresh rect — no stale-closure issue because we call this on each move
    const rect = container.getBoundingClientRect()
    const handleSize = 4 // resize handle width/height in pixels
    const totalSize = isRow ? rect.width : rect.height
    const availableSize = totalSize - handleSize

    if (availableSize <= 0) return

    // Mouse position relative to the container
    const mousePos = isRow ? e.clientX - rect.left : e.clientY - rect.top
    // Make the handle center follow the cursor
    const panelSize = mousePos - handleSize / 2

    const minRatio = MIN_PANEL_SIZE / availableSize
    const maxRatio = 1 - MIN_PANEL_SIZE / availableSize

    let newRatio = panelSize / availableSize
    newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio))

    if (Math.abs(newRatio - ratioRef.current) > 0.001) {
      onRatioChange(newRatio)
      ratioRef.current = newRatio
    }
  }, [direction, onRatioChange])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerIdRef.current) return
    endDrag()
  }, [endDrag])

  // pointercancel fires when the browser forcibly cancels the pointer
  // (e.g. touch interrupted by a phone call, permission dialog, etc.)
  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerIdRef.current) return
    endDrag()
  }, [endDrag])

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

      {/* Resize handle — pointer capture keeps all events here during drag */}
      <div
        className={`zen-resize-handle zen-resize-handle-${direction} ${isDragging ? 'zen-resize-handle-active' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{
          cursor: isRow ? 'col-resize' : 'row-resize',
          flexShrink: 0,
          // Required: prevents browser from hijacking pointer events for scrolling/gestures
          touchAction: 'none',
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
