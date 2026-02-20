export const MOCK_SETTINGS: Record<string, string> = {
  'crewhub-theme': 'dark',
  'crewhub-accent': 'indigo',
  'crewhub-environment': 'desert',
  'crewhub-view-mode': 'world',
  'crewhub-lighting': 'ambient',
  'crewhub-idle-threshold': '300000',
  'crewhub-offline-threshold': '600000',
}

export const MOCK_DISPLAY_NAMES = [
  { session_key: 'agent:main:main', display_name: 'Assistent' },
  { session_key: 'agent:dev:main', display_name: 'Dev' },
  { session_key: 'agent:gamedev:main', display_name: 'Game Dev' },
  { session_key: 'agent:flowy:main', display_name: 'Flowy' },
  { session_key: 'agent:reviewer:main', display_name: 'Reviewer' },
]

export const MOCK_ROOM_ASSIGNMENTS = [
  { session_key: 'agent:main:main', room_id: 'headquarters', assigned_at: Date.now() - 3600000 },
  { session_key: 'agent:dev:main', room_id: 'dev-room', assigned_at: Date.now() - 3600000 },
  { session_key: 'agent:gamedev:main', room_id: 'dev-room', assigned_at: Date.now() - 3600000 },
  { session_key: 'agent:flowy:main', room_id: 'marketing-room', assigned_at: Date.now() - 3600000 },
  { session_key: 'agent:reviewer:main', room_id: 'thinking-room', assigned_at: Date.now() - 3600000 },
  { session_key: 'agent:dev:subagent:fix-auth-middleware', room_id: 'dev-room', assigned_at: Date.now() - 1800000 },
  { session_key: 'agent:dev:subagent:design-landing-page', room_id: 'creative-room', assigned_at: Date.now() - 1800000 },
  { session_key: 'agent:dev:subagent:database-migration-v3', room_id: 'ops-room', assigned_at: Date.now() - 1800000 },
  { session_key: 'agent:dev:subagent:unit-test-coverage', room_id: 'dev-room', assigned_at: Date.now() - 1800000 },
  { session_key: 'agent:flowy:subagent:social-media-campaign', room_id: 'marketing-room', assigned_at: Date.now() - 1200000 },
]

export const MOCK_RULES = [
  {
    id: 'rule-1',
    room_id: 'dev-room',
    rule_type: 'session_type',
    rule_value: 'subagent',
    priority: 10,
    created_at: Date.now() - 86400000,
  },
  {
    id: 'rule-2',
    room_id: 'headquarters',
    rule_type: 'session_type',
    rule_value: 'main',
    priority: 20,
    created_at: Date.now() - 86400000,
  },
  {
    id: 'rule-3',
    room_id: 'ops-room',
    rule_type: 'keyword',
    rule_value: 'deploy',
    priority: 15,
    created_at: Date.now() - 86400000,
  },
]

export const MOCK_CRON_JOBS = [
  {
    id: 'cron-heartbeat',
    name: 'Heartbeat Check',
    schedule: { kind: 'every', everyMs: 1800000 },
    payload: { kind: 'agentTurn', message: 'Heartbeat check — review inbox, calendar, and notifications' },
    enabled: true,
    state: {
      lastRunAtMs: Date.now() - 900000,
      nextRunAtMs: Date.now() + 900000,
      lastStatus: 'ok',
      lastDurationMs: 2340,
      lastError: null,
    },
  },
  {
    id: 'cron-email',
    name: 'Email Monitor',
    schedule: { kind: 'cron', expr: '*/10 * * * *', tz: 'Europe/Brussels' },
    payload: { kind: 'agentTurn', message: 'Check for new emails and notify if urgent' },
    enabled: true,
    state: {
      lastRunAtMs: Date.now() - 300000,
      nextRunAtMs: Date.now() + 300000,
      lastStatus: 'ok',
      lastDurationMs: 4120,
      lastError: null,
    },
  },
]
