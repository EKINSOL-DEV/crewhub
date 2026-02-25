/**
 * PersonaStep — Onboarding wizard step for configuring agent persona.
 *
 * Preset-first UI with collapsible fine-tune sliders and inline preview.
 * Implements Agent Identity Pattern: detects locked identities and
 * offers connection-only mode for existing agents.
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronDown, AlertTriangle, ShieldCheck } from 'lucide-react'
import { PresetCard } from '@/components/persona/PresetCard'
import { PersonaSlider } from '@/components/persona/PersonaSlider'
import { PersonaPreview } from '@/components/persona/PersonaPreview'
import { fetchPresets, fetchIdentity } from '@/lib/personaApi'
import {
  DIMENSIONS,
  DEFAULT_PERSONA,
  type PersonaConfig,
  type PersonaDimensions,
  type PresetDefinition,
} from '@/lib/personaTypes'

interface PersonaStepProps {
  agentName?: string
  agentId?: string
  onComplete: (config: PersonaConfig) => void
  onSkip: () => void
}

export function PersonaStep({ agentName, agentId, onComplete, onSkip }: PersonaStepProps) {
  const [presets, setPresets] = useState<Record<string, PresetDefinition>>({})
  const [selectedPreset, setSelectedPreset] = useState<string | null>('executor')
  const [dimensions, setDimensions] = useState<PersonaDimensions>({
    start_behavior: DEFAULT_PERSONA.start_behavior,
    checkin_frequency: DEFAULT_PERSONA.checkin_frequency,
    response_detail: DEFAULT_PERSONA.response_detail,
    approach_style: DEFAULT_PERSONA.approach_style,
  })
  const [customInstructions, setCustomInstructions] = useState('')
  const [fineTuneOpen, setFineTuneOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [isCustomized, setIsCustomized] = useState(false)
  const [identityLocked, setIdentityLocked] = useState(false)
  const [checkingIdentity, setCheckingIdentity] = useState(false)

  // Load presets + check identity lock
  useEffect(() => {
    fetchPresets()
      .then((data) => setPresets(data.presets))
      .catch(() => {
        // Use hardcoded fallback
      })

    // Check if this agent has a locked identity
    if (agentId) {
      setCheckingIdentity(true)
      fetchIdentity(agentId)
        .then((data) => {
          if (data.identity_locked) {
            setIdentityLocked(true)
          }
        })
        .catch(() => {})
        .finally(() => setCheckingIdentity(false))
    }
  }, [agentId])

  const handlePresetSelect = useCallback(
    (key: string) => {
      const preset = presets[key]
      if (!preset) return
      setSelectedPreset(key)
      setIsCustomized(false)
      setDimensions({
        start_behavior: preset.start_behavior,
        checkin_frequency: preset.checkin_frequency,
        response_detail: preset.response_detail,
        approach_style: preset.approach_style,
      })
    },
    [presets]
  )

  const handleDimensionChange = useCallback((key: keyof PersonaDimensions, value: number) => {
    setDimensions((prev) => ({ ...prev, [key]: value }))
    setIsCustomized(true)
  }, [])

  const handleContinue = useCallback(() => {
    onComplete({
      preset: isCustomized ? null : selectedPreset,
      ...dimensions,
      custom_instructions: customInstructions,
    })
  }, [onComplete, isCustomized, selectedPreset, dimensions, customInstructions])

  // Order presets: executor first
  const presetOrder = ['executor', 'advisor', 'explorer']
  const orderedPresets = presetOrder
    .filter((k) => presets[k])
    .map((k) => ({ key: k, preset: presets[k] }))

  // If identity is locked, show connection-only mode
  if (identityLocked) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Agent Identity Detected</h2>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{agentName || 'This agent'}</span> already
            has a configured identity.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-3 text-center">
          <ShieldCheck className="h-10 w-10 mx-auto text-green-500" />
          <h3 className="font-medium">Identity Locked</h3>
          <p className="text-sm text-muted-foreground">
            This agent&apos;s personality is already defined and locked. CrewHub will connect to it
            for monitoring without modifying its identity.
          </p>
          <p className="text-xs text-muted-foreground">
            You can adjust this later in Settings → Identity.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button onClick={onSkip} className="gap-2">
            Continue with existing identity →
          </Button>
        </div>
      </div>
    )
  }

  if (checkingIdentity) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center py-12 text-muted-foreground">
        Checking agent identity...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Choose how your agent behaves</h2>
        {agentName && (
          <p className="text-muted-foreground">
            Pick a style for <span className="font-medium text-foreground">{agentName}</span>:
          </p>
        )}
      </div>

      {/* Preset cards */}
      <div className="grid grid-cols-3 gap-3">
        {orderedPresets.map(({ key, preset }) => (
          <PresetCard
            key={key}
            presetKey={key}
            preset={preset}
            selected={selectedPreset === key && !isCustomized}
            onClick={() => handlePresetSelect(key)}
          />
        ))}
      </div>

      {/* Custom indicator */}
      {isCustomized && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
          Using custom settings
        </p>
      )}

      {/* Safety note */}
      <p className="text-xs text-muted-foreground text-center">
        🔒 Still respects safety rules and dangerous-action safeguards, regardless of preset.
      </p>

      {/* Fine-tune disclosure */}
      <div className="rounded-lg border bg-card">
        <button
          type="button"
          onClick={() => setFineTuneOpen(!fineTuneOpen)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-accent/30 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {fineTuneOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Fine-tune
        </button>

        {fineTuneOpen && (
          <div className="px-4 pb-4 space-y-5 border-t pt-4">
            {DIMENSIONS.map((dim) => (
              <PersonaSlider
                key={dim.key}
                label={dim.label}
                helper={dim.helper}
                leftLabel={dim.leftLabel}
                rightLabel={dim.rightLabel}
                value={dimensions[dim.key]}
                onChange={(v) => handleDimensionChange(dim.key, v)}
              />
            ))}

            {/* Custom instructions */}
            <div>
              <button
                type="button"
                onClick={() => setCustomOpen(!customOpen)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {customOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Custom instructions
              </button>

              {customOpen && (
                <div className="mt-2 space-y-1">
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value.slice(0, 500))}
                    placeholder={
                      'e.g. "Always respond in Dutch"\n     "Never delete files without asking"'
                    }
                    className="w-full h-24 px-3 py-2 text-sm rounded-md border bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
                    maxLength={500}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {customInstructions.length}/500
                  </p>
                  {/* Conflict hint */}
                  {customInstructions.toLowerCase().includes('always ask') &&
                    dimensions.start_behavior <= 2 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        This may override your Start Behavior setting above.
                      </p>
                    )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <PersonaPreview
        dimensions={dimensions}
        preset={isCustomized ? null : selectedPreset}
        customInstructions={customInstructions}
      />

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          Use defaults
        </Button>
        <Button onClick={handleContinue} className="gap-2">
          Continue →
        </Button>
      </div>
    </div>
  )
}
