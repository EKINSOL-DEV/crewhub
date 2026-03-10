/**
 * Handoff API client.
 *
 * Provides functions to discover available handoff targets
 * and execute agent session handoffs to external tools.
 */

const API_BASE = import.meta.env.VITE_API_BASE || ''

export interface HandoffTarget {
  id: string
  label: string
  icon: string
  available: boolean
}

export interface HandoffResult {
  success: boolean
  target: string
  command: string
  message: string
  error?: string
  fallback_command?: string
}

/**
 * Fetch available handoff targets from the backend.
 * Results should be cached on the frontend.
 */
export async function fetchHandoffTargets(): Promise<HandoffTarget[]> {
  const res = await fetch(`${API_BASE}/api/handoff/targets`)
  if (!res.ok) {
    throw new Error(`Failed to fetch handoff targets: ${res.status}`)
  }
  const data = await res.json()
  return data.targets ?? []
}

/**
 * Execute a handoff for a session to a specific target.
 */
export async function executeHandoff(
  sessionKey: string,
  target: string,
  workingDir?: string
): Promise<HandoffResult> {
  const res = await fetch(`${API_BASE}/api/handoff/sessions/${encodeURIComponent(sessionKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, working_dir: workingDir }),
  })
  if (!res.ok) {
    throw new Error(`Handoff request failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Copy a command to the clipboard (frontend fallback).
 */
export async function copyToClipboard(command: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(command)
    return true
  } catch {
    // Fallback for older browsers / non-HTTPS
    const textarea = document.createElement('textarea')
    textarea.value = command
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  }
}
