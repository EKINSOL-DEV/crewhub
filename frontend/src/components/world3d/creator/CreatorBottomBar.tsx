/**
 * CreatorBottomBar — replaces the floating PropBrowser panel.
 *
 * Layout (bottom of screen, position: absolute):
 *   Row 1 (Props Bar, conditional): horizontal scroll of prop cards (~130px)
 *   Row 2 (Category Bar, always):   horizontal scroll of category chips (~48px)
 *
 * Clicking a category toggles the props bar for that category.
 * Clicking a prop card calls selectProp(propId).
 */

import { useState, useEffect } from 'react'
import { useCreatorMode } from '@/contexts/CreatorModeContext'
import {
  PROP_META_BY_ID,
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type PropCategory,
} from '@/components/props/propMeta'
import { API_BASE } from '@/lib/api'

// ─── Data ──────────────────────────────────────────────────────

// All browsable built-in props
const ALL_PROPS = Array.from(PROP_META_BY_ID.values()).filter(
  (meta) => (meta as { browsable?: boolean }).browsable !== false
)

// ─── Types ─────────────────────────────────────────────────────

interface GeneratedPropRecord {
  id: string
  name: string
  prompt: string
  createdAt?: string
}

// ─── Styles ────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 30,
  fontFamily: 'system-ui, sans-serif',
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderTop: '1px solid rgba(255,215,0,0.3)',
  userSelect: 'none',
}

const categoryBarStyle: React.CSSProperties = {
  height: '48px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '0 12px',
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollbarWidth: 'none',
}

const propsBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollbarWidth: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    padding: '4px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: active ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)',
    border: active ? '1px solid gold' : '1px solid rgba(255,255,255,0.1)',
    color: active ? 'gold' : '#e2e8f0',
    whiteSpace: 'nowrap',
  }
}

function propCardStyle(selected: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    width: '80px',
    height: '106px',
    borderRadius: '8px',
    background: selected ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.05)',
    border: selected ? '1px solid gold' : '1px solid rgba(255,255,255,0.08)',
    boxShadow: selected ? '0 0 12px rgba(255,215,0,0.35)' : '0 2px 6px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
  }
}

// ─── Component ─────────────────────────────────────────────────

export function CreatorBottomBar() {
  const { selectedPropId, selectProp } = useCreatorMode()

  // activeCategory: null = props bar hidden; 'All' = show all; 'generated' = custom AI props; PropCategory = filter by category
  const [activeCategory, setActiveCategory] = useState<'All' | 'generated' | PropCategory | null>(
    null
  )
  const [generatedProps, setGeneratedProps] = useState<GeneratedPropRecord[]>([])
  const [loadingGenerated, setLoadingGenerated] = useState(false)

  // Fetch generated props when the generated category is selected
  useEffect(() => {
    if (activeCategory !== 'generated') return
    if (generatedProps.length > 0) return // already loaded
    setLoadingGenerated(true)
    fetch(`${API_BASE}/creator/generation-history?limit=100`)
      .then((r) => r.json())
      .then((data) => {
        const records: GeneratedPropRecord[] = data.records ?? data.history ?? data ?? []
        setGeneratedProps(records)
      })
      .catch(console.error)
      .finally(() => setLoadingGenerated(false))
  }, [activeCategory, generatedProps.length])

  const handleCategoryClick = (cat: 'All' | 'generated' | PropCategory) => {
    setActiveCategory((prev) => (prev === cat ? null : cat))
  }

  const handlePropClick = (propId: string) => {
    selectProp(propId)
  }

  // Filter props for the active category
  const displayedProps = (() => {
    if (activeCategory === null || activeCategory === 'generated') return []
    if (activeCategory === 'All') return ALL_PROPS
    return ALL_PROPS.filter((p) => p.category === activeCategory)
  })()

  const showPropsBar = activeCategory !== null

  return (
    <div style={containerStyle}>
      {/* Props Bar — slides in above category bar */}
      <div
        style={{
          maxHeight: showPropsBar ? '130px' : '0px',
          overflow: showPropsBar ? 'visible' : 'hidden',
          transition: 'max-height 0.2s ease',
        }}
      >
        <div style={propsBarStyle}>
          {/* Built-in props */}
          {displayedProps.map((meta) => {
            const isSelected = selectedPropId === meta.propId
            return (
              <button
                type="button"
                key={meta.propId}
                style={propCardStyle(isSelected)}
                onClick={() => handlePropClick(meta.propId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handlePropClick(meta.propId)
                }}
                title={meta.displayName}
              >
                {/* Color block with emoji */}
                <div
                  style={{
                    flex: '0 0 68px',
                    background: meta.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    position: 'relative',
                  }}
                >
                  {meta.icon}
                  {isSelected && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 3,
                        right: 4,
                        fontSize: '10px',
                        background: 'gold',
                        color: '#000',
                        borderRadius: '3px',
                        padding: '0 3px',
                        fontWeight: 700,
                        lineHeight: '14px',
                      }}
                    >
                      ✓
                    </div>
                  )}
                </div>
                {/* Name */}
                <div
                  style={{
                    flex: 1,
                    padding: '3px 4px',
                    fontSize: '9px',
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? 'gold' : '#e2e8f0',
                    lineHeight: 1.25,
                    textAlign: 'center',
                    overflow: 'hidden',
                    display: '-webkit-box' as React.CSSProperties['display'],
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
                  }}
                >
                  {meta.displayName}
                </div>
              </button>
            )
          })}

          {/* Generated/custom AI props */}
          {activeCategory === 'generated' &&
            (() => {
              if (loadingGenerated)
                return (
                  <div style={{ color: '#94a3b8', fontSize: '12px', padding: '8px 0' }}>
                    Loading…
                  </div>
                )
              if (generatedProps.length === 0)
                return (
                  <div style={{ color: '#94a3b8', fontSize: '12px', padding: '8px 0' }}>
                    No generated props yet. Use the AI generator to create some!
                  </div>
                )
              return generatedProps.map((gen) => {
                const propId = `crewhub:${gen.id}`
                const isSelected = selectedPropId === propId
                return (
                  <button
                    type="button"
                    key={gen.id}
                    style={propCardStyle(isSelected)}
                    onClick={() => handlePropClick(propId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handlePropClick(propId)
                    }}
                    title={gen.prompt || gen.name}
                  >
                    {/* Icon block */}
                    <div
                      style={{
                        flex: '0 0 68px',
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '28px',
                        position: 'relative',
                      }}
                    >
                      ✨
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 3,
                            right: 4,
                            fontSize: '10px',
                            background: 'gold',
                            color: '#000',
                            borderRadius: '3px',
                            padding: '0 3px',
                            fontWeight: 700,
                            lineHeight: '14px',
                          }}
                        >
                          ✓
                        </div>
                      )}
                    </div>
                    {/* Name */}
                    <div
                      style={{
                        flex: 1,
                        padding: '3px 4px',
                        fontSize: '9px',
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? 'gold' : '#e2e8f0',
                        lineHeight: 1.25,
                        textAlign: 'center',
                        overflow: 'hidden',
                        display: '-webkit-box' as React.CSSProperties['display'],
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
                      }}
                    >
                      {gen.name}
                    </div>
                  </button>
                )
              })
            })()}

          {activeCategory !== 'generated' && displayedProps.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: '12px', padding: '8px 0' }}>
              No props in this category yet.
            </div>
          )}
        </div>
      </div>

      {/* Category Bar */}
      <div style={categoryBarStyle}>
        {/* "All" chip */}
        <button
          type="button"
          style={chipStyle(activeCategory === 'All')}
          onClick={() => handleCategoryClick('All')}
        >
          All
        </button>

        {/* One chip per category */}
        {ALL_CATEGORIES.map((cat) => {
          // Skip 'generated' if no props exist in it (optional UX polish)
          const hasProps = ALL_PROPS.some((p) => p.category === cat)
          if (!hasProps) return null
          return (
            <button
              type="button"
              key={cat}
              style={chipStyle(activeCategory === cat)}
              onClick={() => handleCategoryClick(cat)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleCategoryClick(cat)
              }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          )
        })}

        {/* "✨ Generated" chip — AI-generated custom props */}
        <button
          type="button"
          style={chipStyle(activeCategory === 'generated')}
          onClick={() => handleCategoryClick('generated')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleCategoryClick('generated')
          }}
        >
          ✨ Generated
        </button>
      </div>
    </div>
  )
}
