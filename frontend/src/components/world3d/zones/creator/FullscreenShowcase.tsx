/**
 * Fullscreen PropCreator Design Showcase
 * Grid gallery of 10 hand-crafted showcase props with detail view.
 */

import { useState, useEffect, useCallback, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import { showcaseProps, type ShowcaseProp } from './showcaseProps'

// ── Prop source code (loaded on demand) ───────────────────────

const propSourceCache: Record<string, string> = {}

async function loadPropSource(id: string): Promise<string> {
  if (propSourceCache[id]) return propSourceCache[id]
  try {
    // Try fetching from backend
    const res = await fetch(`/api/creator/showcase-source/${id}`)
    if (res.ok) {
      const data = await res.json()
      propSourceCache[id] = data.source
      return data.source
    }
  } catch { /* fallback */ }
  propSourceCache[id] = '// Source code not available in this build.\n// Check rnd/prop-creator-showcase/src/props/'
  return propSourceCache[id]
}

// ── Main Showcase Component ───────────────────────────────────

interface FullscreenShowcaseProps {
  onClose: () => void
}

export function FullscreenShowcase({ onClose }: FullscreenShowcaseProps) {
  const [selectedProp, setSelectedProp] = useState<ShowcaseProp | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [codeContent, setCodeContent] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  // Escape to close / back
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

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const canvases = document.querySelectorAll('canvas')
    const prevPE: string[] = []
    canvases.forEach((c, i) => { prevPE[i] = c.style.pointerEvents; c.style.pointerEvents = 'none' })
    window.dispatchEvent(new CustomEvent('fullscreen-overlay', { detail: { open: true } }))
    return () => {
      document.body.style.overflow = prev
      canvases.forEach((c, i) => { c.style.pointerEvents = prevPE[i] })
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
    <div className="psc-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {/* Top bar */}
      <div className="psc-topbar">
        <div className="psc-topbar-left">
          <button className="psc-back-btn" onClick={() => {
            if (showCode) setShowCode(false)
            else if (selectedProp) setSelectedProp(null)
            else onClose()
          }}>
            ← {showCode ? 'Back to Detail' : selectedProp ? 'Back to Showcase' : 'Back to Creator Center'}
          </button>
        </div>
        <div className="psc-topbar-center">
          <span className="psc-topbar-icon">🎨</span>
          <span className="psc-topbar-title">
            {showCode ? `${selectedProp?.name} — Source` : selectedProp ? selectedProp.name : 'PropCreator Design Showcase'}
          </span>
        </div>
        <button className="psc-close" onClick={onClose} title="Close (Esc)">✕</button>
      </div>

      {/* Content */}
      <div className="psc-content">
        {showCode && selectedProp ? (
          <CodeViewContent
            code={codeContent}
            loading={codeLoading}
            propName={selectedProp.name}
            onCopy={handleCopyCode}
          />
        ) : selectedProp ? (
          <DetailView
            prop={selectedProp}
            onBack={() => setSelectedProp(null)}
            onViewCode={() => handleViewCode(selectedProp)}
          />
        ) : (
          <GridView
            props={showcaseProps}
            onSelect={setSelectedProp}
          />
        )}
      </div>

      <style>{showcaseStyles}</style>
    </div>
  )

  return createPortal(overlay, document.body)
}

// ── Grid View ─────────────────────────────────────────────────

function GridView({ props, onSelect }: { props: ShowcaseProp[]; onSelect: (p: ShowcaseProp) => void }) {
  return (
    <div className="psc-grid-wrapper">
      <div className="psc-grid-header">
        <h2 className="psc-grid-title">✨ 10 Hand-Crafted Props</h2>
        <p className="psc-grid-subtitle">
          Each prop demonstrates different Three.js techniques. Click any prop to explore its details and view the source code.
        </p>
      </div>
      <div className="psc-grid">
        {props.map((prop) => (
          <ShowcaseCard key={prop.id} prop={prop} onClick={() => onSelect(prop)} />
        ))}
      </div>
    </div>
  )
}

// ── Showcase Card ─────────────────────────────────────────────

function ShowcaseCard({ prop, onClick }: { prop: ShowcaseProp; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const Comp = prop.component

  return (
    <div
      className={`psc-card ${hovered ? 'psc-card-hover' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="psc-card-preview">
        <Canvas camera={{ position: [0, 0, 3.5], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[5, 5, 5]} intensity={0.8} />
          <Suspense fallback={null}>
            <Comp />
          </Suspense>
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={hovered ? 4 : 1.5} />
        </Canvas>
      </div>
      <div className="psc-card-info">
        <div className="psc-card-name">{prop.name}</div>
        <div className="psc-card-meta">
          <span className="psc-card-category">{prop.category}</span>
          <span className="psc-card-score">⭐ {prop.qualityScore}/100</span>
        </div>
      </div>
      <div className="psc-card-lines">{prop.codeLines} lines</div>
    </div>
  )
}

// ── Detail View ───────────────────────────────────────────────

function DetailView({ prop, onBack: _onBack, onViewCode }: {
  prop: ShowcaseProp
  onBack: () => void
  onViewCode: () => void
}) {
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
          <OrbitControls makeDefault enablePan enableZoom autoRotate autoRotateSpeed={1} minDistance={1} maxDistance={10} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
        </Canvas>
      </div>
      <div className="psc-detail-info">
        <h2 className="psc-detail-name">{prop.name}</h2>
        <div className="psc-detail-badges">
          <span className="psc-badge psc-badge-category">{prop.category}</span>
          <span className="psc-badge psc-badge-score">⭐ {prop.qualityScore}/100</span>
          <span className="psc-badge psc-badge-lines">📄 {prop.codeLines} lines</span>
        </div>
        <p className="psc-detail-desc">{prop.description}</p>

        <div className="psc-detail-section">
          <h3 className="psc-detail-section-title">🔧 Techniques Used</h3>
          <ul className="psc-detail-techniques">
            {prop.techniques.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>

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

function CodeViewContent({ code, loading, propName, onCopy }: {
  code: string
  loading: boolean
  propName: string
  onCopy: () => void
}) {
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
}
@keyframes psc-fadein { from { opacity: 0; } to { opacity: 1; } }

/* Top bar */
.psc-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: rgba(10, 10, 25, 0.9);
  border-bottom: 1px solid rgba(255, 215, 0, 0.15);
  flex-shrink: 0;
  backdrop-filter: blur(8px);
}
.psc-topbar-left { flex: 1; }
.psc-topbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
}
.psc-topbar-icon { font-size: 18px; }
.psc-topbar-title { font-size: 14px; font-weight: 600; color: #ffd700; }
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

/* Content */
.psc-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.psc-content::-webkit-scrollbar { width: 6px; }
.psc-content::-webkit-scrollbar-thumb { background: rgba(255, 215, 0, 0.2); border-radius: 3px; }

/* Grid View */
.psc-grid-wrapper {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}
.psc-grid-header {
  text-align: center;
  margin-bottom: 32px;
}
.psc-grid-title {
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 8px;
}
.psc-grid-subtitle {
  font-size: 14px;
  color: #888;
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}
.psc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

/* Card */
.psc-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 215, 0, 0.15);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}
.psc-card-hover,
.psc-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 32px rgba(255, 215, 0, 0.15);
  border-color: rgba(255, 215, 0, 0.4);
}
.psc-card-preview {
  width: 100%;
  height: 200px;
  background: rgba(0, 0, 0, 0.3);
}
.psc-card-preview canvas {
  width: 100% !important;
  height: 100% !important;
}
.psc-card-info {
  padding: 12px 16px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.psc-card-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}
.psc-card-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}
.psc-card-category {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}
.psc-card-score {
  font-size: 12px;
  color: #ffd700;
}
.psc-card-lines {
  padding: 0 16px 12px;
  font-size: 11px;
  color: #666;
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
  position: relative;
}
.psc-detail-preview canvas {
  width: 100% !important;
  height: 100% !important;
}
.psc-detail-info {
  width: 380px;
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
  margin: 0 0 12px;
}
.psc-detail-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.psc-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}
.psc-badge-category {
  background: rgba(255, 215, 0, 0.15);
  color: #ffd700;
  border: 1px solid rgba(255, 215, 0, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.psc-badge-score {
  background: rgba(255, 215, 0, 0.1);
  color: #ffd700;
}
.psc-badge-lines {
  background: rgba(100, 100, 255, 0.1);
  color: #8888ff;
}
.psc-detail-desc {
  font-size: 14px;
  line-height: 1.7;
  color: #aaa;
  margin: 0 0 20px;
}
.psc-detail-section {
  margin-bottom: 20px;
}
.psc-detail-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #ccc;
  margin: 0 0 8px;
}
.psc-detail-techniques {
  list-style: none;
  padding: 0;
  margin: 0;
}
.psc-detail-techniques li {
  font-size: 12px;
  color: #888;
  padding: 4px 0 4px 16px;
  position: relative;
  line-height: 1.5;
}
.psc-detail-techniques li::before {
  content: '▸';
  position: absolute;
  left: 0;
  color: #ffd700;
}
.psc-detail-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 24px;
}

/* Buttons */
.psc-btn {
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 13px;
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
.psc-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
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
.psc-code-actions {
  display: flex;
  gap: 8px;
}
.psc-code-content {
  flex: 1;
  overflow: auto;
  margin: 0;
  padding: 20px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
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
@media (max-width: 768px) {
  .psc-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }
  .psc-grid-wrapper { padding: 16px; }
  .psc-grid-title { font-size: 22px; }
  .psc-detail {
    flex-direction: column;
  }
  .psc-detail-info {
    width: 100%;
    border-left: none;
    border-top: 1px solid rgba(255, 215, 0, 0.1);
  }
  .psc-detail-preview {
    min-height: 280px;
  }
}
`
