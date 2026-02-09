/**
 * RoomSetupStep — Template-based room creation during onboarding.
 */

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2 } from "lucide-react"

// ─── Room Templates ─────────────────────────────────────────────

interface RoomDef {
  id: string
  name: string
  icon: string
  color: string
}

interface Template {
  key: string
  icon: string
  title: string
  description: string
  rooms: RoomDef[]
}

const TEMPLATES: Template[] = [
  {
    key: "software_dev",
    icon: "🏗️",
    title: "Software Development",
    description: "Build apps with dev teams",
    rooms: [
      { id: "dev-room", name: "Dev Room", icon: "💻", color: "#10b981" },
      { id: "ops-room", name: "Ops Room", icon: "🛠️", color: "#f97316" },
    ],
  },
  {
    key: "content_creation",
    icon: "🎨",
    title: "Content Creation",
    description: "Create content & marketing",
    rooms: [
      { id: "creative-room", name: "Creative Room", icon: "🎨", color: "#f59e0b" },
      { id: "marketing-room", name: "Marketing", icon: "📢", color: "#ec4899" },
    ],
  },
  {
    key: "mixed",
    icon: "🔀",
    title: "Mixed / General",
    description: "Balance dev & creative work",
    rooms: [
      { id: "dev-room", name: "Dev Room", icon: "💻", color: "#10b981" },
      { id: "creative-room", name: "Creative Room", icon: "🎨", color: "#f59e0b" },
    ],
  },
  {
    key: "minimal",
    icon: "🏛️",
    title: "Minimal",
    description: "Start clean, add rooms later",
    rooms: [],
  },
]

// ─── Component ──────────────────────────────────────────────────

interface RoomSetupStepProps {
  onComplete: () => void
}

export function RoomSetupStep({ onComplete }: RoomSetupStepProps) {
  const [creating, setCreating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, name: "" })
  const [error, setError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const handleSelect = useCallback(
    async (template: Template) => {
      setSelectedKey(template.key)
      setError(null)

      // Minimal → no rooms to create, just proceed
      if (template.rooms.length === 0) {
        onComplete()
        return
      }

      setCreating(true)
      setProgress({ current: 0, total: template.rooms.length, name: "" })

      for (let i = 0; i < template.rooms.length; i++) {
        const room = template.rooms[i]
        setProgress({ current: i + 1, total: template.rooms.length, name: room.name })

        try {
          const res = await fetch("/api/rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: room.id,
              name: room.name,
              icon: room.icon,
              color: room.color,
              sort_order: i + 1, // HQ is 0
            }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            // Ignore "already exists" (409) — room was already created
            if (res.status !== 409) {
              throw new Error(data.detail || `Failed to create ${room.name}`)
            }
          }
        } catch (err) {
          setCreating(false)
          setSelectedKey(null)
          setError(
            err instanceof Error
              ? err.message
              : `Failed to create ${room.name}`
          )
          return
        }
      }

      setCreating(false)
      onComplete()
    },
    [onComplete]
  )

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">What will you use CrewHub for?</h2>
        <p className="text-muted-foreground">
          Pick a template to set up your workspace rooms. You can always add or
          remove rooms later.
        </p>
      </div>

      {/* Creating progress */}
      {creating && (
        <div className="p-4 rounded-xl border bg-card flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
          <span className="text-sm">
            Creating {progress.name}… ({progress.current}/{progress.total})
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Template cards */}
      <div className="space-y-3">
        {TEMPLATES.map((tpl) => {
          const isSelected = selectedKey === tpl.key && creating

          return (
            <div
              key={tpl.key}
              className={`p-5 rounded-xl border transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:bg-accent/30 hover:border-primary/40"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl shrink-0 mt-0.5">{tpl.icon}</div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="font-semibold text-base">{tpl.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {tpl.description}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {/* HQ badge always present */}
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: "#4f46e520",
                        color: "#4f46e5",
                        border: "1px solid #4f46e540",
                      }}
                    >
                      🏛️ HQ
                    </span>
                    {tpl.rooms.map((r) => (
                      <span
                        key={r.id}
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: `${r.color}20`,
                          color: r.color,
                          border: `1px solid ${r.color}40`,
                        }}
                      >
                        {r.icon} {r.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0">
                  <Button
                    size="sm"
                    variant={tpl.key === "minimal" ? "outline" : "default"}
                    disabled={creating}
                    onClick={() => handleSelect(tpl)}
                    className="gap-1.5"
                  >
                    {isSelected ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Select
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
