/**
 * ThinkingPanel — Bottom-left AI thinking process log.
 * Shows streaming status lines, tool calls, and the full prompt in collapsible sections.
 */

import { useState, useRef, useEffect } from 'react'
import type { ThinkingLine } from './propMakerTypes'

// ── Props ─────────────────────────────────────────────────────

export interface ThinkingPanelProps {
  readonly thinkingLines: ThinkingLine[]
  readonly isGenerating: boolean
  readonly fullPrompt: string | null
  readonly toolCalls: { name: string; input: string }[]
}

// ── Helpers ───────────────────────────────────────────────────

function getLineColor(line: ThinkingLine, isLast: boolean): string {
  if (line.type === 'error') return 'var(--zen-error, #ef4444)'
  if (line.type === 'complete') return 'var(--zen-success, #22c55e)'
  if (line.type === 'correction') return '#f59e0b'
  if (line.type === 'tool' || line.type === 'tool_result') return '#eab308'
  if (line.type === 'thinking')
    return isLast ? 'var(--zen-accent, #6366f1)' : 'var(--zen-fg-dim, #888)'
  if (isLast) return 'var(--zen-accent, #6366f1)'
  return 'var(--zen-fg-dim, #888)'
}

// ── ExpandableSection ─────────────────────────────────────────

interface ExpandableSectionProps {
  readonly label: string
  readonly content: string
  readonly color?: string
}

export function ExpandableSection({ label, content, color }: ExpandableSectionProps) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        className="fpm-expand-btn"
        style={color ? { color, borderColor: `${color}33` } : undefined}
        onClick={() => setOpen(!open)}
      >
        {label} {open ? '▴' : '▾'}
      </button>
      {open && <pre className="fpm-expand-content">{content}</pre>}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export function ThinkingPanel({
  thinkingLines,
  isGenerating,
  fullPrompt,
  toolCalls,
}: ThinkingPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new lines
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thinkingLines])

  return (
    <div className="fpm-thinking">
      <div className="fpm-thinking-header">
        🧠 AI Thinking Process
        {thinkingLines.some((l) => l.type === 'thinking') && (
          <span className="fpm-live-badge">LIVE</span>
        )}
      </div>

      {/* Expandable sections */}
      <div className="fpm-thinking-toggles">
        {fullPrompt && <ExpandableSection label="📜 Full Prompt" content={fullPrompt} />}
        {toolCalls.length > 0 && (
          <ExpandableSection
            label={`🔧 Tool Calls (${toolCalls.length})`}
            content={toolCalls.map((tc) => `${tc.name}: ${tc.input}`).join('\n')}
            color="#eab308"
          />
        )}
      </div>

      <div className="fpm-thinking-log" ref={scrollRef}>
        {thinkingLines.length === 0 && !isGenerating && (
          <div className="fpm-thinking-empty">
            Thinking process will appear here during generation...
          </div>
        )}
        {thinkingLines.map((line, i) => (
          <div
            key={`line-${i}`}
            className={`fpm-thinking-line ${line.type === 'thinking' ? 'fpm-thinking-indent' : ''}`}
            style={{ color: getLineColor(line, i === thinkingLines.length - 1) }}
          >
            {line.text}
          </div>
        ))}
        {isGenerating && <div className="fpm-cursor">▍</div>}
      </div>
    </div>
  )
}
