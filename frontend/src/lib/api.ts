export interface CrewSession {
  key: string
  kind: string
  channel: string
  displayName?: string
  label?: string
  updatedAt: number
  sessionId: string
  model?: string
  contextTokens?: number
  totalTokens?: number
  systemSent?: boolean
  abortedLastRun?: boolean
  lastChannel?: string
  transcriptPath?: string
  deliveryContext?: {
    channel?: string
    to?: string
    accountId?: string
  }
  messages?: SessionMessage[]
}

export interface SessionMessage {
  role: string
  content: SessionContentBlock[]
  api?: string
  provider?: string
  model?: string
  usage?: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    totalTokens: number
    cost: {
      input: number
      output: number
      cacheRead: number
      cacheWrite: number
      total: number
    }
  }
  stopReason?: string
  timestamp?: number
}

export interface SessionContentBlock {
  type: string
  text?: string
  thinking?: string
  id?: string
  name?: string
  arguments?: Record<string, unknown>
  toolCallId?: string
  toolName?: string
  content?: Array<{ type: string; text?: string }>
  isError?: boolean
}

export interface SessionsResponse {
  sessions: CrewSession[]
}

export interface SessionHistoryResponse {
  messages: SessionMessage[]
}

// Backwards compatibility aliases
export type MinionSession = CrewSession
export type MinionMessage = SessionMessage
export type MinionContentBlock = SessionContentBlock

export const API_BASE = '/api'

// ─── Discovery Types ──────────────────────────────────────────────

export interface DiscoveryCandidate {
  runtime_type: 'openclaw' | 'claude_code' | 'codex_cli' | 'unknown'
  discovery_method: 'port_probe' | 'config_file' | 'cli_detect' | 'mdns' | 'manual'
  target: {
    url?: string
    host?: string
    port?: number
    transport?: string
  }
  auth: {
    required: boolean
    token_hint?: string
  }
  confidence: 'high' | 'medium' | 'low'
  status: 'reachable' | 'unreachable' | 'auth_required' | 'installed' | 'unknown'
  evidence: string[]
  metadata: {
    version?: string
    active_sessions?: number
    machine_name?: string
  }
}

export interface ScanResult {
  candidates: DiscoveryCandidate[]
  scan_duration_ms: number
}

export interface TestResult {
  reachable: boolean
  sessions?: number
  error?: string
}

// ─── Settings Types ───────────────────────────────────────────────

export type SettingsMap = Record<string, string>

// ─── Backup Types ─────────────────────────────────────────────────

export interface BackupInfo {
  filename: string
  path?: string
  size: number
  created_at: string
}

export interface ImportResult {
  success: boolean
  message?: string
  error?: string
}

// ─── Onboarding Types ─────────────────────────────────────────────

export interface OnboardingStatus {
  completed: boolean
  connections_count: number
  has_active_connection: boolean
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json()
}

export const api = {
  getSessions: (activeMinutes?: number) =>
    fetchJSON<SessionsResponse>(`/sessions${activeMinutes ? `?active_minutes=${activeMinutes}` : ''}`),

  getSessionHistory: (sessionKey: string, limit: number = 50) =>
    fetchJSON<SessionHistoryResponse>(`/sessions/${encodeURIComponent(sessionKey)}/history?limit=${limit}`),

  // Backwards compatibility aliases
  getMinions: (activeMinutes?: number) =>
    fetchJSON<SessionsResponse>(`/sessions${activeMinutes ? `?active_minutes=${activeMinutes}` : ''}`),

  getMinionHistory: (sessionKey: string, limit: number = 50) =>
    fetchJSON<SessionHistoryResponse>(`/sessions/${encodeURIComponent(sessionKey)}/history?limit=${limit}`),
}

// ─── Discovery API ──────────────────────────────────────────────

export async function scanForRuntimes(): Promise<ScanResult> {
  return fetchJSON<ScanResult>('/discovery/scan', { method: 'POST' })
}

export async function testConnection(
  type: string,
  url: string,
  token?: string
): Promise<TestResult> {
  return fetchJSON<TestResult>('/discovery/test', {
    method: 'POST',
    body: JSON.stringify({ type, url, token }),
  })
}

// ─── Settings API ───────────────────────────────────────────────

export async function getSettings(): Promise<SettingsMap> {
  return fetchJSON<SettingsMap>('/settings')
}

export async function updateSetting(key: string, value: string): Promise<void> {
  await fetchJSON<{ key: string; value: string }>(`/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  })
}

export async function updateSettingsBatch(
  settings: Record<string, string>
): Promise<void> {
  await fetchJSON<{ settings: Record<string, string> }>('/settings/batch', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  })
}

// ─── Backup API ─────────────────────────────────────────────────

export async function exportBackup(): Promise<Blob> {
  const response = await fetch(`${API_BASE}/backup/export`)
  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`)
  }
  return response.blob()
}

export async function importBackup(file: File): Promise<ImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${API_BASE}/backup/import`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    throw new Error(`Import failed: ${response.status}`)
  }
  return response.json()
}

export async function createBackup(): Promise<BackupInfo> {
  return fetchJSON<BackupInfo>('/backup/create', { method: 'POST' })
}

export async function listBackups(): Promise<BackupInfo[]> {
  return fetchJSON<BackupInfo[]>('/backup/list')
}

// ─── Onboarding API ─────────────────────────────────────────────

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  return fetchJSON<OnboardingStatus>('/onboarding/status')
}

// Session Display Names API
export interface SessionDisplayNameResponse {
  session_key: string
  display_name: string | null
  updated_at?: number
}

export const sessionDisplayNameApi = {
  get: (sessionKey: string) =>
    fetchJSON<SessionDisplayNameResponse>(`/session-display-names/${encodeURIComponent(sessionKey)}`),
  
  set: (sessionKey: string, displayName: string) =>
    fetchJSON<SessionDisplayNameResponse>(`/session-display-names/${encodeURIComponent(sessionKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName })
    }),
  
  delete: (sessionKey: string) =>
    fetchJSON<{ success: boolean; deleted: string }>(`/session-display-names/${encodeURIComponent(sessionKey)}`, {
      method: 'DELETE'
    }),
}
