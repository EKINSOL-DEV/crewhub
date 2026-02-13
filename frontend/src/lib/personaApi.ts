/**
 * API helpers for Agent Persona Tuning + Identity Pattern.
 */

import type {
  PersonaResponse,
  PersonaConfig,
  PresetsResponse,
  PreviewResponse,
  PersonaDimensions,
  IdentityConfig,
  IdentityResponse,
  SurfacesResponse,
} from "./personaTypes"

const BASE = "/api"

// ========================================
// PERSONA API
// ========================================

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
  customInstructions?: string,
  surface?: string
): Promise<PreviewResponse> {
  const res = await fetch(`${BASE}/personas/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      preset: preset || undefined,
      ...dimensions,
      custom_instructions: customInstructions || "",
      surface: surface || undefined,
    }),
  })
  if (!res.ok) throw new Error("Failed to fetch preview")
  return res.json()
}

// ========================================
// IDENTITY API
// ========================================

export async function fetchIdentity(agentId: string): Promise<IdentityResponse> {
  const res = await fetch(`${BASE}/agents/${encodeURIComponent(agentId)}/identity`)
  if (!res.ok) throw new Error("Failed to fetch identity")
  return res.json()
}

export async function updateIdentity(
  agentId: string,
  config: IdentityConfig
): Promise<{ agent_id: string; identity_anchor: string; surface_rules: string; identity_locked: boolean; updated_at: number }> {
  const res = await fetch(`${BASE}/agents/${encodeURIComponent(agentId)}/identity`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  })
  if (!res.ok) throw new Error("Failed to update identity")
  return res.json()
}

export async function fetchSurfaces(agentId: string): Promise<SurfacesResponse> {
  const res = await fetch(`${BASE}/agents/${encodeURIComponent(agentId)}/surfaces`)
  if (!res.ok) throw new Error("Failed to fetch surfaces")
  return res.json()
}

export async function updateSurface(
  agentId: string,
  surface: string,
  formatRules: string,
  enabled: boolean = true
): Promise<{ agent_id: string; surface: string; format_rules: string; enabled: boolean }> {
  const res = await fetch(
    `${BASE}/agents/${encodeURIComponent(agentId)}/surfaces/${encodeURIComponent(surface)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format_rules: formatRules, enabled }),
    }
  )
  if (!res.ok) throw new Error("Failed to update surface")
  return res.json()
}

export async function deleteSurface(agentId: string, surface: string): Promise<void> {
  const res = await fetch(
    `${BASE}/agents/${encodeURIComponent(agentId)}/surfaces/${encodeURIComponent(surface)}`,
    { method: "DELETE" }
  )
  if (!res.ok) throw new Error("Failed to delete surface")
}

export async function fetchKnownSurfaces(): Promise<{ surfaces: Array<{ surface: string; default_rules: string }> }> {
  const res = await fetch(`${BASE}/personas/surfaces`)
  if (!res.ok) throw new Error("Failed to fetch known surfaces")
  return res.json()
}
