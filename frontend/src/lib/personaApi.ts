/**
 * API helpers for Agent Persona Tuning.
 */

import type {
  PersonaResponse,
  PersonaConfig,
  PresetsResponse,
  PreviewResponse,
  PersonaDimensions,
} from "./personaTypes"

const BASE = "/api"

export async function fetchPresets(): Promise<PresetsResponse> {
  const res = await fetch(`${BASE}/personas/presets`)
  if (!res.ok) throw new Error("Failed to fetch presets")
  return res.json()
}

export async function fetchPersona(agentId: string): Promise<PersonaResponse> {
  const res = await fetch(`${BASE}/agents/${encodeURIComponent(agentId)}/persona`)
  if (!res.ok) throw new Error("Failed to fetch persona")
  return res.json()
}

export async function updatePersona(
  agentId: string,
  config: Omit<PersonaConfig, "preset"> & { preset?: string | null }
): Promise<PersonaResponse> {
  const res = await fetch(`${BASE}/agents/${encodeURIComponent(agentId)}/persona`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  })
  if (!res.ok) throw new Error("Failed to update persona")
  return res.json()
}

export async function fetchPreview(
  prompt: string,
  dimensions: PersonaDimensions,
  preset?: string | null,
  customInstructions?: string
): Promise<PreviewResponse> {
  const res = await fetch(`${BASE}/personas/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      preset: preset || undefined,
      ...dimensions,
      custom_instructions: customInstructions || "",
    }),
  })
  if (!res.ok) throw new Error("Failed to fetch preview")
  return res.json()
}
