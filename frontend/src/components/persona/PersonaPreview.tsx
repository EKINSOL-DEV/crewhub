import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { fetchPreview } from "@/lib/personaApi"
import type { PersonaDimensions, PreviewResponse } from "@/lib/personaTypes"

interface PersonaPreviewProps {
  dimensions: PersonaDimensions
  preset: string | null
  customInstructions?: string
  /** Which preset to contrast against (auto-picked if not provided) */
  contrastPreset?: string
}

function getContrastPreset(preset: string | null): string {
  if (preset === "executor" || preset === null) return "advisor"
  return "executor"
}

export function PersonaPreview({
  dimensions,
  preset,
  customInstructions,
  contrastPreset: contrastPresetProp,
}: PersonaPreviewProps) {
  const [prompt, setPrompt] = useState("Say Hello World")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PreviewResponse | null>(null)
  const [contrastResult, setContrastResult] = useState<PreviewResponse | null>(null)

  const contrastPreset = contrastPresetProp ?? getContrastPreset(preset)

  const handlePreview = useCallback(async () => {
    if (!prompt.trim()) return
    setLoading(true)
    try {
      const [main, contrast] = await Promise.all([
        fetchPreview(prompt, dimensions, preset, customInstructions),
        fetchPreview(prompt, dimensions, contrastPreset),
      ])
      setResult(main)
      setContrastResult(contrast)
    } catch {
      // Silently fail — preview is non-critical
    } finally {
      setLoading(false)
    }
  }, [prompt, dimensions, preset, customInstructions, contrastPreset])

  const presetLabel = (p: string) => {
    const labels: Record<string, string> = { executor: "Executor", advisor: "Advisor", explorer: "Explorer" }
    return labels[p] || p
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span>── Preview ──</span>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="sr-only" htmlFor="persona-preview-prompt">Try a prompt</label>
          <Input
            id="persona-preview-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Try a prompt..."
            className="h-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePreview()
            }}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreview}
          disabled={loading || !prompt.trim()}
          className="h-9 gap-1.5"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Preview
        </Button>
      </div>

      {(result || contrastResult) && (
        <div className="grid grid-cols-2 gap-3">
          {result && (
            <div className="p-3 rounded-lg border bg-card space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {presetLabel(result.preset_used)}
              </span>
              <p className="text-sm">{result.sample_response}</p>
            </div>
          )}
          {contrastResult && (
            <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {presetLabel(contrastResult.preset_used)}
              </span>
              <p className="text-sm">{contrastResult.sample_response}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
