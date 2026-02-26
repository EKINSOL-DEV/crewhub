/**
 * PropBrowser — floating draggable panel for browsing and selecting props.
 *
 * - Draggable header
 * - Two tabs: Built-in props | Generated props
 * - Category filter tabs
 * - Search bar
 * - Click to select prop for placement
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { X, Search, Package, Sparkles } from 'lucide-react'
import { useCreatorMode } from '@/contexts/CreatorModeContext'
import { PropThumbnail } from './PropThumbnail'
import {
  BUILTIN_PROP_META,
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type PropCategory,
  type PropMeta,
} from './propMeta'
import { getPropMountType } from '@/components/world3d/grid/PropRegistry'
import { API_BASE } from '@/lib/api'

const BORDER_1PX_SOLID_RGBA_255_255_255_0_0 = '1px solid rgba(255,255,255,0.08)'

// ── Types ─────────────────────────────────────────────────────────

type TabId = 'builtin' | 'generated'

interface GeneratedProp {
  id: string
  name: string
  prompt: string
  created_at: string
  preview_color?: string
}

// ── Constants ─────────────────────────────────────────────────────

const PANEL_WIDTH = 360
const PANEL_HEIGHT = 500
const PANEL_DEFAULT_RIGHT = 20
const PANEL_DEFAULT_TOP = 80

// ── Component ─────────────────────────────────────────────────────

export function PropBrowser() {
  const { closeBrowser, selectedPropId, selectProp, clearSelection } = useCreatorMode()

  // ── Drag state ────────────────────────────────────────────────
  const [pos, setPos] = useState({
    x: window.innerWidth - PANEL_WIDTH - PANEL_DEFAULT_RIGHT,
    y: PANEL_DEFAULT_TOP,
  })
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    },
    [pos]
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const newX = Math.max(
        0,
        Math.min(window.innerWidth - PANEL_WIDTH, e.clientX - dragOffset.current.x)
      )
      const newY = Math.max(0, Math.min(window.innerHeight - 80, e.clientY - dragOffset.current.y))
      setPos({ x: newX, y: newY })
    }
    const onUp = () => {
      dragging.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // ── Tab + filter state ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('builtin')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<PropCategory | 'all'>('all')

  // ── Generated props ───────────────────────────────────────────
  const [generatedProps, setGeneratedProps] = useState<GeneratedProp[]>([])
  const [loadingGenerated, setLoadingGenerated] = useState(false)

  useEffect(() => {
    if (activeTab !== 'generated') return
    setLoadingGenerated(true)
    fetch(`${API_BASE}/creator/generation-history`)
      .then((r) => r.json())
      .then((data) => {
        // The history may be an array of generation records
        const records = data.history ?? data.records ?? data ?? []
        setGeneratedProps(
          Array.isArray(records)
            ? records.map(
                (r: { id?: string; name?: string; prompt?: string; created_at?: string }) => ({
                  id: r.id ?? String(Math.random()),
                  name: r.name ?? r.prompt ?? 'Generated Prop',
                  prompt: r.prompt ?? '',
                  created_at: r.created_at ?? '',
                })
              )
            : []
        )
      })
      .catch(() => setGeneratedProps([]))
      .finally(() => setLoadingGenerated(false))
  }, [activeTab])

  // ── Filter built-in props ─────────────────────────────────────
  const filteredBuiltin = useMemo((): PropMeta[] => {
    const q = search.toLowerCase()
    return BUILTIN_PROP_META.filter((meta) => {
      // M1: Wall-mount props hidden until wall placement is supported.
      // These props require a wall surface; placing them on the floor
      // causes them to float in mid-air at their yOffset height.
      if (getPropMountType(meta.propId) === 'wall') return false

      if (activeCategory !== 'all' && meta.category !== activeCategory) return false
      if (q) {
        return (
          meta.displayName.toLowerCase().includes(q) ||
          meta.tags.some((t) => t.includes(q)) ||
          meta.category.includes(q)
        )
      }
      return true
    })
  }, [search, activeCategory])

  const filteredGenerated = useMemo((): GeneratedProp[] => {
    const q = search.toLowerCase()
    if (!q) return generatedProps
    return generatedProps.filter(
      (g) => g.name.toLowerCase().includes(q) || g.prompt.toLowerCase().includes(q)
    )
  }, [search, generatedProps])

  // ── Browsable built-in props (floor-mount only) ───────────────
  // M1: Wall-mount props are excluded until wall placement is supported.
  const browsableBuiltinCount = useMemo(
    () => BUILTIN_PROP_META.filter((m) => getPropMountType(m.propId) !== 'wall').length,
    []
  )

  // ── Categories with counts ────────────────────────────────────
  // M1: Exclude wall-mount props from counts (they are hidden from the browser).
  const categoriesWithCounts = useMemo(() => {
    const counts: Partial<Record<PropCategory, number>> = {}
    BUILTIN_PROP_META.forEach((m) => {
      if (getPropMountType(m.propId) === 'wall') return
      counts[m.category] = (counts[m.category] ?? 0) + 1
    })
    return counts
  }, [])

  // ── Selected prop info ────────────────────────────────────────
  const selectedMeta = useMemo(() => {
    if (!selectedPropId) return null
    const builtin = BUILTIN_PROP_META.find((m) => m.propId === selectedPropId)
    if (builtin) return builtin
    // Generated prop
    const gen = generatedProps.find((g) => `crewhub:${g.id}` === selectedPropId)
    if (gen)
      return {
        displayName: gen.name,
        icon: '✨',
        category: 'generated' as PropCategory,
      } as PropMeta & { displayName: string }
    return null
  }, [selectedPropId, generatedProps])

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        zIndex: 200,
        background: '#1a1a2e',
        border: '1px solid #00ffcc44',
        borderRadius: '12px',
        boxShadow: '0 0 30px rgba(0, 255, 204, 0.15), 0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        userSelect: 'none',
      }}
    >
      {/* ── Header (draggable) ── */}
      <div
        onMouseDown={onMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          borderBottom: BORDER_1PX_SOLID_RGBA_255_255_255_0_0,
          cursor: 'grab',
          background: 'rgba(0,255,204,0.05)',
          flexShrink: 0,
        }}
      >
        <Package size={16} color="#00ffcc" />
        <span style={{ color: '#00ffcc', fontWeight: 600, fontSize: '13px', flex: 1 }}>
          Prop Browser
        </span>
        <button
          onClick={closeBrowser} // NOSONAR: mouse/drag interaction
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#e2e8f0'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8'
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Search bar ── */}
      <div style={{ padding: '8px 10px', flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={13} style={{ position: 'absolute', left: '8px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search props…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px 6px 28px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: '#e2e8f0',
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* ── Top-level tabs: Builtin | Generated ── */}
      <div
        style={{
          display: 'flex',
          borderBottom: BORDER_1PX_SOLID_RGBA_255_255_255_0_0,
          flexShrink: 0,
          padding: '0 10px',
          gap: '4px',
        }}
      >
        {[
          {
            id: 'builtin' as TabId,
            label: 'Built-in',
            icon: <Package size={12} />,
            count: browsableBuiltinCount,
          },
          {
            id: 'generated' as TabId,
            label: 'Generated',
            icon: <Sparkles size={12} />,
            count: generatedProps.length,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #00ffcc' : '2px solid transparent',
              color: activeTab === tab.id ? '#00ffcc' : '#94a3b8',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.15s',
              marginBottom: '-1px',
            }}
          >
            {tab.icon}
            {tab.label}
            <span
              style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '1px 5px',
                borderRadius: '8px',
                fontSize: '9px',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Category filter (builtin only) ── */}
      {activeTab === 'builtin' && (
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            gap: '4px',
            padding: '6px 10px',
            flexShrink: 0,
            scrollbarWidth: 'none',
          }}
        >
          <CategoryChip
            label="All"
            count={browsableBuiltinCount}
            active={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
          />
          {ALL_CATEGORIES.filter((c) => c !== 'generated').map((cat) => (
            <CategoryChip
              key={cat}
              label={CATEGORY_LABELS[cat].split(' ').slice(1).join(' ')}
              count={categoriesWithCounts[cat] ?? 0}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>
      )}

      {/* ── Prop grid ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 10px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
          alignContent: 'start',
          scrollbarWidth: 'thin',
          scrollbarColor: '#374151 transparent',
        }}
      >
        {activeTab === 'builtin' &&
          filteredBuiltin.map((meta) => (
            <PropThumbnail
              key={meta.propId}
              propId={meta.propId}
              selected={selectedPropId === meta.propId}
              onClick={() => {
                if (selectedPropId === meta.propId) clearSelection()
                else selectProp(meta.propId)
              }}
            />
          ))}

        {activeTab === 'builtin' && filteredBuiltin.length === 0 && (
          <div
            style={{
              gridColumn: '1/-1',
              textAlign: 'center',
              color: '#94a3b8',
              padding: '32px',
              fontSize: '12px',
            }}
          >
            No props match your search.
          </div>
        )}

        {activeTab === 'generated' && loadingGenerated && (
          <div
            style={{
              gridColumn: '1/-1',
              textAlign: 'center',
              color: '#94a3b8',
              padding: '32px',
              fontSize: '12px',
            }}
          >
            Loading generated props…
          </div>
        )}

        {activeTab === 'generated' &&
          !loadingGenerated &&
          filteredGenerated.map((gen) => (
            <PropThumbnail
              key={gen.id}
              propId={`crewhub:${gen.id}`}
              displayName={gen.name}
              icon="✨"
              color="#1e3a5f"
              selected={selectedPropId === `crewhub:${gen.id}`}
              onClick={() => {
                const id = `crewhub:${gen.id}`
                if (selectedPropId === id) clearSelection()
                else selectProp(id)
              }}
            />
          ))}

        {activeTab === 'generated' && !loadingGenerated && filteredGenerated.length === 0 && (
          <div
            style={{
              gridColumn: '1/-1',
              textAlign: 'center',
              color: '#94a3b8',
              padding: '32px',
              fontSize: '12px',
            }}
          >
            {generatedProps.length === 0
              ? 'No generated props yet. Use PropMaker in the Creator Zone to generate some!'
              : 'No props match your search.'}
          </div>
        )}
      </div>

      {/* ── Footer: selection hint ── */}
      <div
        style={{
          borderTop: BORDER_1PX_SOLID_RGBA_255_255_255_0_0,
          padding: '8px 12px',
          flexShrink: 0,
          background: selectedPropId ? 'rgba(0,255,204,0.05)' : 'transparent',
          transition: 'background 0.2s',
        }}
      >
        {selectedPropId && selectedMeta ? (
          <div style={{ color: '#00ffcc', fontSize: '11px', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>
              {selectedMeta.icon ?? '📦'} {selectedMeta.displayName} selected
            </div>
            <div style={{ color: '#94a3b8' }}>
              Click in the 3D world to place · [R] rotate · [Esc] cancel
            </div>
          </div>
        ) : (
          <div style={{ color: '#475569', fontSize: '11px' }}>
            Click a prop to select it, then click in the world to place
          </div>
        )}
      </div>
    </div>
  )
}

// ── Category chip ─────────────────────────────────────────────────

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  readonly label: string
  readonly count: number
  readonly active: boolean
  readonly onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        padding: '3px 8px',
        background: active ? '#00ffcc22' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${active ? '#00ffcc66' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '12px',
        color: active ? '#00ffcc' : '#94a3b8',
        fontSize: '10px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      {label}
      {count > 0 && <span style={{ opacity: 0.6, fontSize: '9px' }}>{count}</span>}
    </button>
  )
}
