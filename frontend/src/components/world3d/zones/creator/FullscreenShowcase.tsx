/**
 * Fullscreen PropCreator Design Showcase
 * 211 props across 7 categories with category tabs, pagination, and viewport-fit layout.
 */

import { useState, useEffect, useCallback, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import {
  showcaseCategories,
  showcaseProps,
  type ShowcaseProp,
  type ShowcaseCategory,
} from './showcaseProps'

// ── Prop source code (loaded on demand) ───────────────────────

const propSourceCache: Record<string, string> = {}

async function loadPropSource(id: string): Promise<string> {
  if (propSourceCache[id]) return propSourceCache[id]
  try {
    const res = await fetch(`/api/creator/showcase-source/${id}`)
    if (res.ok) {
      const data = await res.json()
      propSourceCache[id] = data.source
      return data.source
    }
  } catch {
    /* fallback */
  }
  propSourceCache[id] =
    '// Source code not available in this build.\n// Check rnd/prop-creator-showcase/src/props/'
  return propSourceCache[id]
}

// ── Main Showcase Component ───────────────────────────────────

interface FullscreenShowcaseProps {
  readonly onClose: () => void
}

export function FullscreenShowcase({ onClose }: Readonly<FullscreenShowcaseProps>) {
  const [selectedProp, setSelectedProp] = useState<ShowcaseProp | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [codeContent, setCodeContent] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCode) setShowCode(false)
        else if (selectedProp) setSelectedProp(null)
        else onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, selectedProp, showCode])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const canvases = document.querySelectorAll('canvas')
    const prevPE: string[] = []
    canvases.forEach((c, i) => {
      prevPE[i] = c.style.pointerEvents
      c.style.pointerEvents = 'none'
    })
    window.dispatchEvent(new CustomEvent('fullscreen-overlay', { detail: { open: true } }))
    return () => {
      document.body.style.overflow = prev
      canvases.forEach((c, i) => {
        c.style.pointerEvents = prevPE[i]
      })
      window.dispatchEvent(new CustomEvent('fullscreen-overlay', { detail: { open: false } }))
    }
  }, [])

  const handleViewCode = useCallback(async (prop: ShowcaseProp) => {
    setCodeLoading(true)
    const src = await loadPropSource(prop.id)
    setCodeContent(src)
    setShowCode(true)
    setCodeLoading(false)
  }, [])

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(codeContent).catch(() => {})
  }, [codeContent])

  const overlay = (
    <div
      className="psc-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onClose()
      }}
      role="button"
      tabIndex={0}
    >
      <div className="psc-topbar">
        <div className="psc-topbar-left">
          <button
            className="psc-back-btn"
            onClick={() => {
              if (showCode) setShowCode(false)
              else if (selectedProp) setSelectedProp(null)
              else onClose()
            }}
          >
            ←{' '}
            {(() => {
              if (showCode) return 'Back to Detail'
              return selectedProp ? 'Back to Showcase' : 'Back to Creator Center'
            })()}
          </button>
        </div>
        <div className="psc-topbar-center">
          <span className="psc-topbar-icon">🎨</span>
          <span className="psc-topbar-title">
            {(() => {
              if (showCode) return `${selectedProp?.name} — Source`
              return selectedProp ? selectedProp.name : 'PropCreator Design Showcase'
            })()}
          </span>
          <span className="psc-topbar-count">{showcaseProps.length} props</span>
        </div>
        <button className="psc-close" onClick={onClose} title="Close (Esc)">
          ✕
        </button>
      </div>

      <div className="psc-content">
        {showCode && selectedProp ? (
          <CodeViewContent
            code={codeContent}
            loading={codeLoading}
            propName={selectedProp.name}
            onCopy={handleCopyCode}
          />
        ) : (
          (() => {
            if (selectedProp) {
              return (
                <DetailView
                  prop={selectedProp}
                  onBack={() => setSelectedProp(null)}
                  onViewCode={() => handleViewCode(selectedProp)}
                />
              )
            }

            return <CategoryGridView categories={showcaseCategories} onSelect={setSelectedProp} />
          })()
        )}
      </div>

      <style>{showcaseStyles}</style>
    </div>
  )

  return createPortal(overlay, document.body)
}

// ── Category Grid View (with tabs + pagination, viewport-fit) ─

const PROPS_PER_PAGE = 6

function CategoryGridView({
  categories,
  onSelect,
}: Readonly<{
  readonly categories: ShowcaseCategory[]
  readonly onSelect: (p: ShowcaseProp) => void
}>) {
  const [activeTab, setActiveTab] = useState(categories[0].id)
  const [currentPage, setCurrentPage] = useState(0)

  const activeCategory = categories.find((c) => c.id === activeTab)!
  const totalPages = Math.ceil(activeCategory.props.length / PROPS_PER_PAGE)
  const startIdx = currentPage * PROPS_PER_PAGE
  const visibleProps = activeCategory.props.slice(startIdx, startIdx + PROPS_PER_PAGE)

  useEffect(() => {
    setCurrentPage(0)
  }, [activeTab])

  return (
    <div className="psc-category-view">
      {/* Category Tabs */}
      <div className="psc-tabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`psc-tab ${activeTab === cat.id ? 'psc-tab-active' : ''}`}
            onClick={() => setActiveTab(cat.id)}
          >
            <span className="psc-tab-icon">{cat.icon}</span>
            <span className="psc-tab-name">{cat.name}</span>
            <span className="psc-tab-count">({cat.props.length})</span>
          </button>
        ))}
      </div>

      {/* Grid - fills available space */}
      <div className="psc-grid-area">
        <div className="psc-grid">
          {visibleProps.map((prop) => (
            <ShowcaseCard key={prop.id} prop={prop} onClick={() => onSelect(prop)} />
          ))}
        </div>
      </div>

      {/* Pagination - pinned to bottom */}
      <div className="psc-pagination">
        <button
          className="psc-btn psc-btn-secondary"
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0}
        >
          ← Previous
        </button>
        <span className="psc-pagination-info">
          Page {currentPage + 1} of {totalPages} • {activeCategory.props.length} props in{' '}
          {activeCategory.name}
        </span>
        <button
          className="psc-btn psc-btn-secondary"
          onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={currentPage >= totalPages - 1}
        >
          Next →
        </button>
      </div>
    </div>
  )
}

// ── Showcase Card ─────────────────────────────────────────────

function ShowcaseCard({
  prop,
  onClick,
}: Readonly<{ prop: ShowcaseProp; readonly onClick: () => void }>) {
  const [hovered, setHovered] = useState(false)
  const Comp = prop.component

  return (
    <div
      className={`psc-card ${hovered ? 'psc-card-hover' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="psc-card-preview">
        <Canvas camera={{ position: [0, 0.5, 3], fov: 35 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 5, 3]} intensity={1} />
          <pointLight position={[-2, 2, 2]} intensity={0.5} color={prop.color} />
          <Suspense fallback={null}>
            <Comp />
          </Suspense>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={hovered ? 4 : 1.5}
          />
        </Canvas>
      </div>
      <div className="psc-card-label" style={{ color: hovered ? prop.color : '#aaaacc' }}>
        {prop.name}
      </div>
    </div>
  )
}

// ── Detail View ───────────────────────────────────────────────

function DetailView({
  prop,
  onBack: _onBack,
  onViewCode,
}: Readonly<{
  readonly prop: ShowcaseProp
  readonly onBack: () => void
  readonly onViewCode: () => void
}>) {
  const Comp = prop.component

  return (
    <div className="psc-detail">
      <div className="psc-detail-preview">
        <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
          <Suspense fallback={null}>
            <Stage adjustCamera={false} environment="city" intensity={0.5}>
              <Comp />
            </Stage>
          </Suspense>
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            autoRotate
            autoRotateSpeed={1}
            minDistance={1}
            maxDistance={10}
          />
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
        </Canvas>
      </div>
      <div className="psc-detail-info">
        <h2 className="psc-detail-name">{prop.name}</h2>
        <div className="psc-detail-color-swatch" style={{ background: prop.color }} />
        <div className="psc-detail-actions">
          <button className="psc-btn psc-btn-primary" onClick={onViewCode}>
            📜 View Source Code
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Code View ─────────────────────────────────────────────────

function CodeViewContent({
  code,
  loading,
  propName,
  onCopy,
}: Readonly<{
  readonly code: string
  readonly loading: boolean
  readonly propName: string
  readonly onCopy: () => void
}>) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="psc-code-loading">Loading source code...</div>
  }

  return (
    <div className="psc-code-view">
      <div className="psc-code-header">
        <span className="psc-code-filename">{propName}.tsx</span>
        <div className="psc-code-actions">
          <button className="psc-btn psc-btn-small" onClick={handleCopy}>
            {copied ? '✅ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>
      <pre className="psc-code-content">
        <code>{code}</code>
      </pre>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const showcaseStyles = `
.psc-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 50%, #16213e 100%);
  animation: psc-fadein 0.25s ease-out;
  font-family: system-ui, -apple-system, sans-serif;
  color: #e0e0e0;
  overflow: hidden;
}
@keyframes psc-fadein { from { opacity: 0; } to { opacity: 1; } }

/* Top bar */
.psc-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(10, 10, 25, 0.9);
  border-bottom: 1px solid rgba(255, 215, 0, 0.15);
  flex-shrink: 0;
  backdrop-filter: blur(8px);
  height: 44px;
  box-sizing: border-box;
}
.psc-topbar-left { flex: 1; }
.psc-topbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
}
.psc-topbar-icon { font-size: 16px; }
.psc-topbar-title { font-size: 14px; font-weight: 600; color: #ffd700; }
.psc-topbar-count { font-size: 11px; color: #666; }
.psc-back-btn {
  background: transparent;
  border: 1px solid rgba(255, 215, 0, 0.25);
  border-radius: 6px;
  padding: 4px 12px;
  color: #ffd700;
  font-size: 12px;
  cursor: pointer;
}
.psc-back-btn:hover { background: rgba(255, 215, 0, 0.1); }
.psc-close {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #888;
  width: 28px; height: 28px;
  font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.psc-close:hover { color: #e0e0e0; background: rgba(255, 255, 255, 0.05); }

/* Content fills remaining space */
.psc-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Category View - full viewport fit, no scroll */
.psc-category-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Tabs */
.psc-tabs {
  display: flex;
  gap: 2px;
  padding: 8px 16px;
  flex-shrink: 0;
  overflow-x: auto;
  justify-content: center;
  background: rgba(10, 10, 25, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.psc-tabs::-webkit-scrollbar { height: 0; }
.psc-tab {
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  transition: all 0.2s ease;
  background: transparent;
  color: #6666aa;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}
.psc-tab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #9999cc;
}
.psc-tab-active {
  background: linear-gradient(135deg, #3344aa, #4466cc) !important;
  color: #ffffff !important;
  box-shadow: 0 2px 12px rgba(50, 80, 200, 0.3);
}
.psc-tab-icon { font-size: 14px; }
.psc-tab-name {}
.psc-tab-count { font-size: 10px; opacity: 0.6; }

/* Grid area fills available space */
.psc-grid-area {
  flex: 1;
  overflow: hidden;
  padding: 12px 24px;
  min-height: 0;
}
.psc-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 16px;
  height: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

/* Card */
.psc-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 215, 0, 0.12);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.psc-card-hover,
.psc-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(255, 215, 0, 0.12);
  border-color: rgba(255, 215, 0, 0.35);
}
.psc-card-preview {
  flex: 1;
  min-height: 0;
  background: rgba(0, 0, 0, 0.2);
}
.psc-card-preview canvas {
  width: 100% !important;
  height: 100% !important;
}
.psc-card-label {
  flex-shrink: 0;
  padding: 8px 12px;
  text-align: center;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.3px;
  transition: color 0.3s ease;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.4));
}

/* Pagination - fixed at bottom */
.psc-pagination {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  background: rgba(10, 10, 25, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}
.psc-pagination .psc-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.psc-pagination-info {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

/* Detail View */
.psc-detail {
  display: flex;
  height: 100%;
  overflow: hidden;
}
.psc-detail-preview {
  flex: 1;
  min-height: 400px;
  background: rgba(0, 0, 0, 0.3);
}
.psc-detail-preview canvas {
  width: 100% !important;
  height: 100% !important;
}
.psc-detail-info {
  width: 320px;
  flex-shrink: 0;
  padding: 24px;
  overflow-y: auto;
  border-left: 1px solid rgba(255, 215, 0, 0.1);
  background: rgba(10, 10, 25, 0.5);
}
.psc-detail-name {
  font-size: 24px;
  font-weight: 700;
  color: #ffd700;
  margin: 0 0 16px;
}
.psc-detail-color-swatch {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
}
.psc-detail-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Buttons */
.psc-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  text-align: center;
}
.psc-btn-primary {
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  color: #1a1a2e;
}
.psc-btn-primary:hover { opacity: 0.9; }
.psc-btn-secondary {
  background: transparent;
  border: 1px solid rgba(255, 215, 0, 0.3);
  color: #ffd700;
}
.psc-btn-secondary:hover { background: rgba(255, 215, 0, 0.1); }
.psc-btn-small {
  padding: 6px 12px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ccc;
}
.psc-btn-small:hover { background: rgba(255, 255, 255, 0.1); }

/* Code View */
.psc-code-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.psc-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: rgba(10, 10, 25, 0.8);
  border-bottom: 1px solid rgba(255, 215, 0, 0.1);
  flex-shrink: 0;
}
.psc-code-filename {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: #ffd700;
}
.psc-code-actions { display: flex; gap: 8px; }
.psc-code-content {
  flex: 1;
  overflow: auto;
  margin: 0;
  padding: 20px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.7;
  color: #d4d4d4;
  background: rgba(0, 0, 0, 0.4);
  tab-size: 2;
}
.psc-code-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 1400px) {
  .psc-grid {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }
}
@media (max-width: 900px) {
  .psc-grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    grid-auto-rows: 250px;
    overflow-y: auto;
  }
  .psc-grid-area { padding: 8px 12px; }
  .psc-tabs { justify-content: flex-start; }
  .psc-detail { flex-direction: column; }
  .psc-detail-info { width: 100%; border-left: none; border-top: 1px solid rgba(255, 215, 0, 0.1); }
  .psc-detail-preview { min-height: 280px; }
}
`
