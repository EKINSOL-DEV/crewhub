// ─── Preview Panel ──────────────────────────────────────────────
// Renders a generated prop in an isolated 3D preview box
// with orbit controls for inspection.
// Provides "Approve" and "Regenerate" buttons.

import React, { Suspense, useState, useCallback, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'

// ─── Error Boundary ─────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class PropErrorBoundary extends React.Component<
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
    if (this.state.hasError) {
      return null // Error is displayed outside the Canvas
    }
    return this.props.children
  }
}

// ─── Styles ─────────────────────────────────────────────────────

const PANEL_STYLE: React.CSSProperties = {
  width: '100%',
  maxWidth: '500px',
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '16px',
  overflow: 'hidden',
  fontFamily: 'system-ui, sans-serif',
  color: 'hsl(var(--foreground))',
}

const CANVAS_CONTAINER: React.CSSProperties = {
  width: '100%',
  height: '300px',
  background: 'hsl(var(--panel-bg, var(--secondary)))',
  position: 'relative',
}

const CONTROLS_STYLE: React.CSSProperties = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const BUTTON_ROW: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  justifyContent: 'center',
}

const APPROVE_BTN: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: '10px',
  border: 'none',
  background: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
  boxShadow: '0 4px 12px hsl(var(--primary) / 0.3)',
}

const REGEN_BTN: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: '10px',
  border: '1px solid hsl(var(--border))',
  background: 'transparent',
  color: 'hsl(var(--primary))',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
}

const ERROR_BOX: React.CSSProperties = {
  background: 'hsl(var(--destructive) / 0.15)',
  border: '1px solid hsl(var(--destructive) / 0.4)',
  borderRadius: '8px',
  padding: '10px 14px',
  fontSize: '12px',
  color: 'hsl(var(--destructive))',
  fontFamily: 'monospace',
  maxHeight: '120px',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}

const RETRY_BTN: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: '8px',
  border: '1px solid hsl(var(--destructive) / 0.4)',
  background: 'hsl(var(--destructive) / 0.2)',
  color: 'hsl(var(--destructive))',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
}

// ─── Component ──────────────────────────────────────────────────

interface PreviewPanelProps {
  /** The React component to preview */
  readonly PropComponent: React.FC<any> | null
  /** Component name for display */
  readonly componentName: string
  /** Render error message (if component failed) */
  readonly renderError?: string | null
  /** Called when user approves the prop */
  readonly onApprove: () => void
  /** Called when user wants to regenerate */
  readonly onRegenerate: () => void
  /** Called when user wants to retry after error */
  readonly onRetry?: () => void
  /** Whether generation is in progress */
  readonly isGenerating?: boolean
  /** Whether save is in progress */
  readonly isSaving?: boolean
}

export function PreviewPanel({
  // NOSONAR: complexity from legitimate 3D rendering pipeline; extracting would hurt readability
  PropComponent,
  componentName,
  renderError,
  onApprove,
  onRegenerate,
  onRetry,
  isGenerating = false,
  isSaving = false,
}: PreviewPanelProps) {
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  const handleRuntimeError = useCallback((error: Error) => {
    setRuntimeError(error.message)
  }, [])

  const displayError = renderError || runtimeError
  const canPreview = PropComponent && !displayError

  // Create a wrapper that renders the component with default props
  const PreviewWrapper = useMemo(() => {
    if (!PropComponent) return null
    return () => <PropComponent position={[0, 0, 0]} rotation={0} cellSize={1} />
  }, [PropComponent])

  return (
    <div style={PANEL_STYLE}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid hsl(var(--border))' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'hsl(var(--primary))' }}>
          🔍 Preview: {componentName}
        </span>
      </div>

      {/* 3D Preview Canvas */}
      <div style={CANVAS_CONTAINER}>
        {isGenerating ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'hsl(45 93% 58%)',
              fontSize: '14px',
            }}
          >
            ⚙️ Generating prop...
          </div>
        ) : canPreview && PreviewWrapper ? (
          <Canvas camera={{ position: [2, 1.5, 2], fov: 45 }}>
            <PropErrorBoundary onError={handleRuntimeError}>
              <Suspense fallback={null}>
                <Stage adjustCamera={false} environment="city" intensity={0.5}>
                  <PreviewWrapper />
                </Stage>
              </Suspense>
            </PropErrorBoundary>
            <OrbitControls makeDefault enablePan enableZoom minDistance={1} maxDistance={10} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
          </Canvas>
        ) : displayError ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '20px',
            }}
          >
            <div style={{ textAlign: 'center', color: 'hsl(var(--destructive))' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
              <div style={{ fontSize: '13px' }}>Render failed</div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'hsl(var(--muted-foreground))',
              fontSize: '13px',
            }}
          >
            No preview available
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={CONTROLS_STYLE}>
        {/* Error display */}
        {displayError && <div style={ERROR_BOX}>{displayError}</div>}

        {/* Buttons */}
        <div style={BUTTON_ROW}>
          {displayError ? (
            <button style={RETRY_BTN} onClick={onRetry || onRegenerate}>
              🔄 Retry
            </button>
          ) : (
            <>
              <button
                style={{
                  ...APPROVE_BTN,
                  opacity: isSaving || !canPreview ? 0.5 : 1,
                  cursor: isSaving || !canPreview ? 'not-allowed' : 'pointer',
                }}
                onClick={onApprove}
                disabled={isSaving || !canPreview}
              >
                {isSaving ? '💾 Saving...' : '✅ Approve & Save'}
              </button>
              <button
                style={{
                  ...REGEN_BTN,
                  opacity: isGenerating ? 0.5 : 1,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                }}
                onClick={onRegenerate}
                disabled={isGenerating}
              >
                🔄 Regenerate
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
