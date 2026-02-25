import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'

// ─── Section wrapper ─────────────────────────────────────────────────────────

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card/80 p-6 space-y-5 shadow-sm">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  )
}

// ─── Collapsible section wrapper ─────────────────────────────────────────────

export function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string
  badge?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultOpen)
  return (
    <div className="rounded-xl border bg-card/80 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 pb-4 hover:bg-accent/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>
      {expanded && <div className="px-6 pb-6 space-y-4">{children}</div>}
    </div>
  )
}
