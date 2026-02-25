/**
 * PropThumbnail — visual card for a prop in the Prop Browser.
 *
 * Simplified implementation: color block + emoji icon + display name.
 * We intentionally skip live WebGL mini-renders here to avoid the ~16-context
 * browser limit (each <Canvas> counts). A shared-renderer approach with
 * setScissor/setViewport is a future enhancement (v0.19.0+).
 *
 * The color and icon come from propMeta.ts.
 */

import { useMemo } from 'react'
import { PROP_META_BY_ID, CATEGORY_LABELS, type PropMeta } from './propMeta'

interface PropThumbnailProps {
  propId: string
  displayName?: string // override for generated props
  icon?: string // override for generated props
  color?: string // override for generated props
  size?: number // thumbnail size in px (default 72)
  selected?: boolean
  onClick?: () => void
}

function getPropColor(meta: PropMeta | undefined, color?: string): string {
  return color ?? meta?.color ?? '#2d3748'
}

function getPropIcon(meta: PropMeta | undefined, icon?: string): string {
  return icon ?? meta?.icon ?? '📦'
}

function getPropName(meta: PropMeta | undefined, displayName?: string, propId?: string): string {
  if (displayName) return displayName
  if (meta?.displayName) return meta.displayName
  // Try to prettify the raw ID
  if (!propId) return 'Unknown'
  return propId.replace(/^(builtin:|crewhub:)/, '').replace(/-/g, ' ')
}

function getCategoryLabel(meta: PropMeta | undefined): string {
  if (!meta) return 'Generated'
  return CATEGORY_LABELS[meta.category]?.split(' ').slice(1).join(' ') ?? meta.category
}

export function PropThumbnail({
  propId,
  displayName,
  icon,
  color,
  size = 72,
  selected = false,
  onClick,
}: PropThumbnailProps) {
  const meta = useMemo(() => PROP_META_BY_ID.get(propId), [propId])
  const bgColor = getPropColor(meta, color)
  const emoji = getPropIcon(meta, icon)
  const name = getPropName(meta, displayName, propId)
  const categoryLabel = getCategoryLabel(meta)

  return (
    <button
      onClick={onClick}
      title={name}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px',
        borderRadius: '8px',
        border: selected ? '2px solid #ffd700' : '2px solid transparent',
        background: selected ? 'rgba(255, 215, 0, 0.08)' : 'rgba(255,255,255,0.04)',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: selected ? '0 0 8px rgba(255,215,0,0.4)' : 'none',
        transition: 'all 0.15s ease',
        width: '100%',
        gap: '6px',
        textAlign: 'center',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
          e.currentTarget.style.transform = 'scale(1.03)'
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          e.currentTarget.style.transform = 'scale(1)'
        }
      }}
    >
      {/* Color block thumbnail */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '6px',
          background: `linear-gradient(135deg, ${bgColor}cc, ${bgColor}66)`,
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.42,
          flexShrink: 0,
        }}
      >
        {emoji}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: '10px',
          color: '#e2e8f0',
          lineHeight: 1.2,
          maxWidth: size + 8,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          wordBreak: 'break-word',
        }}
      >
        {name}
      </div>

      {/* Category badge */}
      {categoryLabel && (
        <div
          style={{
            fontSize: '8px',
            color: '#94a3b8',
            background: 'rgba(148,163,184,0.1)',
            padding: '1px 4px',
            borderRadius: '4px',
            maxWidth: size + 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {categoryLabel}
        </div>
      )}
    </button>
  )
}
