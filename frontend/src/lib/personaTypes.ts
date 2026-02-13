/**
 * Shared types for Agent Persona Tuning feature.
 */

export interface PersonaDimensions {
  start_behavior: number
  checkin_frequency: number
  response_detail: number
  approach_style: number
}

export interface PersonaConfig extends PersonaDimensions {
  preset: string | null
  custom_instructions: string
}

export interface IdentityConfig {
  identity_anchor: string
  surface_rules: string
  identity_locked: boolean
}

export interface PersonaResponse extends PersonaConfig, IdentityConfig {
  agent_id: string
  created_at: number | null
  updated_at: number | null
}

export interface SurfaceRule {
  surface: string
  format_rules: string
  enabled: boolean
  is_custom: boolean
  default_rules: string
}

export interface SurfacesResponse {
  agent_id: string
  surfaces: SurfaceRule[]
}

export interface IdentityResponse {
  agent_id: string
  agent_name: string
  identity_anchor: string
  surface_rules: string
  identity_locked: boolean
  surfaces: Array<{ surface: string; format_rules: string; enabled: boolean }>
}

export interface PresetDefinition extends PersonaDimensions {
  name: string
  icon: string
  tagline: string
  description: string
  recommended: boolean
}

export interface PresetsResponse {
  presets: Record<string, PresetDefinition>
}

export interface PreviewResponse {
  system_prompt_fragment: string
  sample_response: string
  preset_used: string
}

export interface SliderDimension {
  key: keyof PersonaDimensions
  label: string
  helper: string
  leftLabel: string
  rightLabel: string
}

export const DIMENSIONS: SliderDimension[] = [
  {
    key: "start_behavior",
    label: "Start Behavior",
    helper: "How should the agent begin tasks?",
    leftLabel: "Start quickly",
    rightLabel: "Confirm first",
  },
  {
    key: "checkin_frequency",
    label: "Check-in Frequency",
    helper: "How often should the agent update you?",
    leftLabel: "Frequent check-ins",
    rightLabel: "Final result only",
  },
  {
    key: "response_detail",
    label: "Response Detail",
    helper: "How much should the agent explain?",
    leftLabel: "Just results",
    rightLabel: "Full context",
  },
  {
    key: "approach_style",
    label: "Approach Style",
    helper: "What methods should the agent prefer?",
    leftLabel: "Conservative",
    rightLabel: "Experimental",
  },
]

export const DEFAULT_PERSONA: PersonaConfig = {
  preset: "executor",
  start_behavior: 1,
  checkin_frequency: 4,
  response_detail: 2,
  approach_style: 3,
  custom_instructions: "",
}
