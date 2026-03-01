/**
 * StepConnectionMode — "How do you run AI agents?"
 * Three choice cards: OpenClaw, Claude Code, or Both.
 */

import { Monitor, Terminal, Layers } from 'lucide-react'
import type { ConnectionMode } from '../onboardingTypes'

interface StepConnectionModeProps {
  readonly onSelect: (mode: ConnectionMode) => void
  readonly onDemo?: () => void
  readonly onSkip?: () => void
}

const cards: {
  mode: ConnectionMode
  title: string
  color: string
  bgClass: string
  icon: typeof Monitor
  description: string
  bullets: string[]
}[] = [
  {
    mode: 'openclaw',
    title: 'OpenClaw',
    color: '#FF6B35',
    bgClass: 'hover:border-[#FF6B35]/60',
    icon: Monitor,
    description: 'Personal AI platform with gateway connection',
    bullets: [
      'Connect to your OpenClaw gateway',
      'Real-time session monitoring',
      'Full dashboard experience',
    ],
  },
  {
    mode: 'claude_code',
    title: 'Claude Code CLI',
    color: '#8B5CF6',
    bgClass: 'hover:border-[#8B5CF6]/60',
    icon: Terminal,
    description: "Anthropic's coding agent running locally",
    bullets: [
      'Auto-detect local Claude sessions',
      'No gateway needed',
      'Monitor from your terminal',
    ],
  },
  {
    mode: 'both',
    title: 'Both',
    color: '#10B981',
    bgClass: 'hover:border-[#10B981]/60',
    icon: Layers,
    description: 'Use OpenClaw and Claude Code together',
    bullets: ['Best of both worlds', 'Unified session view', 'Mix and match connections'],
  },
]

export function StepConnectionMode({ onSelect, onDemo, onSkip }: StepConnectionModeProps) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">How do you run AI agents?</h2>
        <p className="text-muted-foreground">
          Choose your setup — you can always change this later.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.mode}
              onClick={() => onSelect(card.mode)}
              className={`group relative flex flex-col items-start gap-3 rounded-xl border-2 border-border bg-card p-6 text-left transition-all ${card.bgClass} hover:shadow-lg`}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${card.color}20` }}
              >
                <Icon className="h-6 w-6" style={{ color: card.color }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{card.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                {card.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: card.color }}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {(onDemo || onSkip) && (
        <div className="flex items-center justify-center gap-6 pt-2">
          {onDemo && (
            <button
              onClick={onDemo}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ✦ Demo mode
            </button>
          )}
          {onSkip && (
            <button
              onClick={onSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ✦ Skip setup
            </button>
          )}
        </div>
      )}
    </div>
  )
}
