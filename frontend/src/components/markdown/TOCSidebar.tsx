/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, type RefObject } from 'react'

export interface TOCHeading {
  id: string
  text: string
  level: number
}

interface TOCSidebarProps {
  readonly headings: TOCHeading[]
  readonly activeId?: string
  readonly onSelect: (id: string) => void
}

export function extractHeadings(content: string): TOCHeading[] {
  const headings: TOCHeading[] = []
  const lines = content.split('\n')
  for (const line of lines) {
    const match = /^(#{1,4})\s+(.+)$/.exec(line)
    if (match) {
      const level = match[1].length
      const text = match[2].replaceAll(/[*_`~]/g, '').trim()
      const id = text
        .toLowerCase()
        .replaceAll(/[^\w]+/g, '-')
        .replaceAll(/^-|-$/g, '')
      headings.push({ id, text, level })
    }
  }
  return headings
}

export function useActiveHeading(
  headings: TOCHeading[],
  containerRef?: RefObject<HTMLElement | null>
): string | undefined {
  const [activeId, setActiveId] = useState<string | undefined>()

  useEffect(() => {
    if (headings.length === 0) return
    const root = containerRef?.current ?? null

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { root, rootMargin: '-20% 0px -70% 0px' }
    )

    for (const h of headings) {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [headings, containerRef])

  return activeId
}

export function TOCSidebar({ headings, activeId, onSelect }: TOCSidebarProps) {
  return (
    <div
      style={{
        width: 240,
        minWidth: 240,
        borderRight: '1px solid hsl(var(--border))',
        overflow: 'auto',
        padding: '12px 0',
        background: 'hsl(var(--card))',
      }}
    >
      <div
        style={{
          padding: '0 12px 8px',
          borderBottom: '1px solid hsl(var(--border))',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          Contents
        </span>
      </div>
      {headings.map((h) => {
        const isActive = h.id === activeId
        let headingFontWeight: number
        if (isActive) {
          headingFontWeight = 600
        } else if (h.level === 1) {
          headingFontWeight = 500
        } else {
          headingFontWeight = 400
        }
        return (
          <button
            key={h.id}
            onClick={() => onSelect(h.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '4px 12px 4px ' + (12 + (h.level - 1) * 12) + 'px',
              fontSize: h.level === 1 ? 13 : 12,
              fontWeight: headingFontWeight,
              color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              background: isActive ? 'hsl(var(--primary) / 0.1)' : 'transparent',
              border: 'none',
              borderLeft: isActive ? '2px solid hsl(var(--primary))' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'all 0.1s',
              fontFamily: 'system-ui, sans-serif',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'hsl(var(--secondary))'
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
          >
            {h.text}
          </button>
        )
      })}
    </div>
  )
}
