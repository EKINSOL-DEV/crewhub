/**
 * PersonasTab — Settings tab for managing agent personas.
 *
 * Full slider UI (always expanded), agent selector, save with feedback.
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { PresetCard } from './PresetCard'
import { PersonaSlider } from './PersonaSlider'
import { PersonaPreview } from './PersonaPreview'
import { fetchPresets, fetchPersona, updatePersona } from '@/lib/personaApi'
import {
  DIMENSIONS,
  DEFAULT_PERSONA,
  type PersonaDimensions,
  type PresetDefinition,
} from '@/lib/personaTypes'

interface Agent {
  id: string
  name: string
}

export function PersonasTab() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [presets, setPresets] = useState<Record<string, PresetDefinition>>({})
  const [selectedPreset, setSelectedPreset] = useState<string | null>('executor')
  const [dimensions, setDimensions] = useState<PersonaDimensions>({
    start_behavior: DEFAULT_PERSONA.start_behavior,
    checkin_frequency: DEFAULT_PERSONA.checkin_frequency,
    response_detail: DEFAULT_PERSONA.response_detail,
    approach_style: DEFAULT_PERSONA.approach_style,
  })
  const [customInstructions, setCustomInstructions] = useState('')
  const [isCustomized, setIsCustomized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [loading, setLoading] = useState(false)

  // Load agents + presets on mount
  useEffect(() => {
    Promise.all([fetch('/api/agents').then((r) => r.json()), fetchPresets()])
      .then(([agentsData, presetsData]) => {
        const agentList: Agent[] = (agentsData.agents || agentsData || []).map(
          (a: { id: string; name?: string }) => ({
            id: String(a.id),
            name: a.name || String(a.id),
          })
        )
        setAgents(agentList)
        setPresets(presetsData.presets)
        if (agentList.length > 0) {
          setSelectedAgent(agentList[0].id)
        }
      })
      .catch(() => {})
  }, [])

  // Load persona when agent changes
  useEffect(() => {
    if (!selectedAgent) return
    setLoading(true)
    setSaveStatus('idle')
    fetchPersona(selectedAgent)
      .then((persona) => {
        setSelectedPreset(persona.preset)
        setDimensions({
          start_behavior: persona.start_behavior,
          checkin_frequency: persona.checkin_frequency,
          response_detail: persona.response_detail,
          approach_style: persona.approach_style,
        })
        setCustomInstructions(persona.custom_instructions || '')
        setIsCustomized(!persona.preset)
      })
      .catch(() => {
        // Use defaults
        setSelectedPreset('executor')
        setDimensions({
          start_behavior: DEFAULT_PERSONA.start_behavior,
          checkin_frequency: DEFAULT_PERSONA.checkin_frequency,
          response_detail: DEFAULT_PERSONA.response_detail,
          approach_style: DEFAULT_PERSONA.approach_style,
        })
        setCustomInstructions('')
        setIsCustomized(false)
      })
      .finally(() => setLoading(false))
  }, [selectedAgent])

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
      setSaveStatus('idle')
    },
    [presets]
  )

  const handleDimensionChange = useCallback((key: keyof PersonaDimensions, value: number) => {
    setDimensions((prev) => ({ ...prev, [key]: value }))
    setIsCustomized(true)
    setSaveStatus('idle')
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedAgent) return
    setSaving(true)
    setSaveStatus('idle')
    try {
      await updatePersona(selectedAgent, {
        preset: isCustomized ? null : selectedPreset,
        ...dimensions,
        custom_instructions: customInstructions,
      })
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }, [selectedAgent, isCustomized, selectedPreset, dimensions, customInstructions])

  const presetOrder = ['executor', 'advisor', 'explorer']
  const orderedPresets = presetOrder
    .filter((k) => presets[k])
    .map((k) => ({ key: k, preset: presets[k] }))

  if (agents.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No agents found. Create an agent first to configure its persona.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Agent selector */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Agent</label>
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select an agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
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

          {isCustomized && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Using custom settings</p>
          )}

          {/* Sliders — always expanded in settings */}
          <div className="space-y-5">
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
          </div>

          {/* Custom instructions — always visible, 2000 char limit */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom instructions</label>
            <textarea
              value={customInstructions}
              onChange={(e) => {
                setCustomInstructions(e.target.value.slice(0, 2000))
                setSaveStatus('idle')
              }}
              placeholder={
                'e.g. "Always respond in Dutch"\n     "Never delete files without asking"'
              }
              className="w-full h-28 px-3 py-2 text-sm rounded-md border bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
              maxLength={2000}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {customInstructions.length}/2000
            </p>
            {customInstructions.toLowerCase().includes('always ask') &&
              dimensions.start_behavior <= 2 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  This may override your Start Behavior setting above.
                </p>
              )}
          </div>

          {/* Preview */}
          <PersonaPreview
            dimensions={dimensions}
            preset={isCustomized ? null : selectedPreset}
            customInstructions={customInstructions}
          />

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Persona
            </Button>
            {saveStatus === 'success' && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </Badge>
            )}
            {saveStatus === 'error' && (
              <Badge variant="destructive" className="gap-1">
                Failed to save
              </Badge>
            )}
          </div>
        </>
      )}
    </div>
  )
}
