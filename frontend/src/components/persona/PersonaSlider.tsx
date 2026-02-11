import { cn } from "@/lib/utils"

interface PersonaSliderProps {
  label: string
  helper: string
  leftLabel: string
  rightLabel: string
  value: number
  onChange: (value: number) => void
}

export function PersonaSlider({
  label,
  helper,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: PersonaSliderProps) {
  const markers = [1, 2, 3, 4, 5]

  return (
    <div className="space-y-2">
      <div>
        <span className="text-sm font-medium">{label}</span>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </div>

      <div className="space-y-1">
        {/* Endpoint labels */}
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>

        {/* Slider track with markers */}
        <div
          className="relative h-8 flex items-center"
          role="slider"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={value}
          aria-label={`${label}: ${value}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault()
              if (value < 5) onChange(value + 1)
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault()
              if (value > 1) onChange(value - 1)
            } else if (e.key === "Home") {
              e.preventDefault()
              onChange(1)
            } else if (e.key === "End") {
              e.preventDefault()
              onChange(5)
            }
          }}
        >
          {/* Track background */}
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-muted" />

          {/* Active track */}
          <div
            className="absolute h-1.5 rounded-full bg-primary/60"
            style={{ left: 0, width: `${((value - 1) / 4) * 100}%` }}
          />

          {/* Markers */}
          <div className="absolute inset-x-0 flex justify-between px-0">
            {markers.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange(m)}
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  m === value
                    ? "bg-primary text-primary-foreground scale-110 shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                tabIndex={-1}
                aria-hidden="true"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
