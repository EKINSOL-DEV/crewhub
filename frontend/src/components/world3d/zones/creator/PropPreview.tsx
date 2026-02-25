/**
 * PropPreview — Right-side 3D canvas view.
 * Renders the generated prop in a persistent Three.js canvas so OrbitControls
 * camera position survives across generation cycles.
 */

import { Suspense } from 'react'
import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import { DynamicProp, type PropPart } from './DynamicProp'
import type { TransformMode } from './propMakerTypes'

// ── Error Boundary ────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class PropErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error): void {
    this.props.onError(error)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

// ── Props ─────────────────────────────────────────────────────

export interface PropPreviewProps {
  previewParts: PropPart[] | null
  previewName: string
  isGenerating: boolean
  renderError: string | null
  previewModelLabel: string
  selectedModel: string
  editMode: boolean
  selectedPartIndex: number | null
  transformMode: TransformMode
  isTransformDragging: boolean
  onRenderError: (error: Error) => void
  onRetry: () => void
  onPartSelect: (index: number | null) => void
  onPartTransform: (
    index: number,
    position: [number, number, number],
    rotation: [number, number, number]
  ) => void
  onDraggingChanged: (dragging: boolean) => void
}

// ── Component ─────────────────────────────────────────────────

export function PropPreview({
  previewParts,
  previewName,
  isGenerating,
  renderError,
  previewModelLabel,
  selectedModel,
  editMode,
  selectedPartIndex,
  transformMode,
  isTransformDragging,
  onRenderError,
  onRetry,
  onPartSelect,
  onPartTransform,
  onDraggingChanged,
}: PropPreviewProps) {
  const canPreview = previewParts && previewParts.length > 0 && !renderError

  return (
    <div className="fpm-right">
      {/* Persistent Canvas — never unmounts, preserving OrbitControls camera */}
      <Canvas camera={{ position: [3, 2, 3], fov: 45 }} style={{ position: 'absolute', inset: 0 }}>
        <PropErrorBoundary onError={onRenderError}>
          <Suspense fallback={null}>
            {canPreview && (
              <Stage adjustCamera={false} environment="city" intensity={0.5}>
                <DynamicProp
                  parts={previewParts!}
                  position={[0, 0, 0]}
                  scale={3}
                  editMode={editMode}
                  selectedPartIndex={selectedPartIndex}
                  onPartSelect={onPartSelect}
                  onPartTransform={onPartTransform}
                  transformMode={transformMode}
                  onDraggingChanged={onDraggingChanged}
                />
              </Stage>
            )}
          </Suspense>
        </PropErrorBoundary>
        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          minDistance={1}
          maxDistance={15}
          enabled={!isTransformDragging}
        />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
      </Canvas>

      {/* Overlay states — rendered on top of Canvas */}
      {isGenerating && (
        <div
          className="fpm-preview-placeholder"
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        >
          <div className="fpm-preview-spinner">⚙️</div>
          <div>Generating prop...</div>
          <div className="fpm-preview-sublabel">{previewModelLabel || selectedModel}</div>
          <div className="fpm-generating-hint">
            This may take a few minutes — AI is crafting your prop! 🤖
          </div>
        </div>
      )}

      {!isGenerating && renderError && (
        <div
          className="fpm-preview-placeholder"
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div>Render failed</div>
          <div className="fpm-preview-error">{renderError}</div>
          <button className="fpm-retry-btn" onClick={onRetry}>
            🔄 Retry
          </button>
        </div>
      )}

      {!isGenerating && !canPreview && !renderError && (
        <div
          className="fpm-preview-placeholder"
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        >
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🎨</div>
          <div>No model yet</div>
          <div className="fpm-preview-sublabel">Generate a prop to see the 3D preview here</div>
        </div>
      )}

      {/* Preview name badge */}
      {previewName && !isGenerating && <div className="fpm-preview-name">🔍 {previewName}</div>}
    </div>
  )
}
