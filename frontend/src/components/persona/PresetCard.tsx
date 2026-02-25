import { CheckCircle2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PresetDefinition } from '@/lib/personaTypes'

interface PresetCardProps {
  presetKey: string
  preset: PresetDefinition
  selected: boolean
  onClick: () => void
}

export function PresetCard({ presetKey: _presetKey, preset, selected, onClick }: PresetCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center text-center p-5 rounded-xl border-2 transition-all cursor-pointer',
        'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:border-primary/40'
      )}
      aria-pressed={selected}
      aria-label={`${preset.name} preset: ${preset.tagline}`}
    >
      {/* Recommended badge */}
      {preset.recommended && (
        <span className="absolute -top-2.5 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-medium">
          <Star className="h-3 w-3" fill="currentColor" />
          Recommended
        </span>
      )}

      {/* Selected checkmark */}
      {selected && (
        <div className="absolute top-2 left-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
      )}

      {/* Icon */}
      <span className="text-3xl mb-2" role="img" aria-hidden="true">
        {preset.icon}
      </span>

      {/* Name */}
      <span className="font-semibold text-base">{preset.name}</span>

      {/* Tagline */}
      <span className="text-sm text-muted-foreground mt-1">{preset.tagline}</span>

      {/* Audience hint */}
      <span className="text-xs text-muted-foreground mt-2 opacity-70">{preset.description}</span>
    </button>
  )
}
