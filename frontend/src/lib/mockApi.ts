/**
 * Mock API Layer for Demo Mode
 *
 * Intercepts all /api/* requests when VITE_DEMO_MODE=true.
 * Returns realistic mock data so the entire frontend runs without a backend.
 *
 * Features:
 * - Monkey-patches window.fetch for /api/* routes
 * - Installs a mock EventSource for SSE /api/events
 * - Emits periodic session-update events to trigger bot movement
 * - Persists user edits (rooms, assignments, settings) to localStorage
 * - Bypasses onboarding
 */

// ─── Types (local, minimal) ────────────────────────────────────

interface MockRoom {
  id: string
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  floor_style: string
  wall_style: string
  project_id: string | null
  project_name: string | null
  project_color: string | null
  is_hq: boolean
  created_at: number
  updated_at: number
}

interface MockAgent {
  id: string
  name: string
  icon: string | null
  avatar_url: string | null
  color: string | null
  agent_session_key: string | null
  default_model: string | null
  default_room_id: string | null
  sort_order: number
  is_pinned: boolean
  auto_spawn: boolean
  bio: string | null
  created_at: number
  updated_at: number
}

interface MockProject {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  folder_path: string | null
  status: string
  created_at: number
  updated_at: number
  rooms: string[]
}

// ─── Mock Data ─────────────────────────────────────────────────

const MOCK_ROOMS: MockRoom[] = [
  {
    id: 'headquarters',
    name: 'Headquarters',
    icon: '🏢',
    color: '#6366f1',
    sort_order: 0,
    floor_style: 'marble',
    wall_style: 'glass',
    project_id: null,
    project_name: null,
    project_color: null,
    is_hq: true,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'dev-room',
    name: 'Development Lab',
    icon: '💻',
    color: '#22c55e',
    sort_order: 1,
    floor_style: 'concrete',
    wall_style: 'two-tone',
    project_id: 'proj-crewhub',
    project_name: 'CrewHub',
    project_color: '#6366f1',
    is_hq: false,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'creative-room',
    name: 'Creative Studio',
    icon: '🎨',
    color: '#f59e0b',
    sort_order: 2,
    floor_style: 'wood',
    wall_style: 'pastel-band',
    project_id: 'proj-website',
    project_name: 'Website Redesign',
    project_color: '#f59e0b',
    is_hq: false,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'ops-room',
    name: 'Operations Center',
    icon: '⚙️',
    color: '#ef4444',
    sort_order: 3,
    floor_style: 'tiles',
    wall_style: 'accent-band',
    project_id: null,
    project_name: null,
    project_color: null,
    is_hq: false,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'marketing-room',
    name: 'Marketing Hub',
    icon: '📢',
    color: '#a855f7',
    sort_order: 4,
    floor_style: 'carpet',
    wall_style: 'light',
    project_id: null,
    project_name: null,
    project_color: null,
    is_hq: false,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
  {
    id: 'thinking-room',
    name: 'Thinking Room',
    icon: '🧠',
    color: '#06b6d4',
    sort_order: 5,
    floor_style: 'light-wood',
    wall_style: 'wainscoting',
    project_id: null,
    project_name: null,
    project_color: null,
    is_hq: false,
    created_at: Date.now() - 86400000,
    updated_at: Date.now(),
  },
]

// 5 agents — NO WTL agent
const MOCK_AGENTS: MockAgent[] = [
  {
    id: 'agent-main',
    name: 'Assistent',
    icon: '🤖',
    avatar_url: null,
    color: '#f97316',
    agent_session_key: 'agent:main:main',
    default_model: 'claude-sonnet-4-20250514',
    default_room_id: 'headquarters',
    sort_order: 0,
    is_pinned: true,
    auto_spawn: false,
    bio: 'Director of Bots — orchestrates all agents, handles communication, planning, and task delegation across the entire crew.',
    created_at: Date.now() - 86400000 * 7,
    updated_at: Date.now(),
  },
  {
    id: 'agent-dev',
    name: 'Dev',
    icon: '💻',
    avatar_url: null,
    color: '#3b82f6',
    agent_session_key: 'agent:dev:main',
    default_model: 'claude-opus-4-20250514',
    default_room_id: 'dev-room',
    sort_order: 1,
    is_pinned: true,
    auto_spawn: false,
    bio: 'Senior Developer — writes production code, builds features, manages deployments, and mentors sub-agents on complex tasks.',
    created_at: Date.now() - 86400000 * 7,
    updated_at: Date.now(),
  },
  {
    id: 'agent-gamedev',
    name: 'Game Dev',
    icon: '🎮',
    avatar_url: null,
    color: '#f97316',
    agent_session_key: 'agent:gamedev:main',
    default_model: 'claude-opus-4-20250514',
    default_room_id: 'dev-room',
    sort_order: 2,
    is_pinned: true,
    auto_spawn: false,
    bio: '3D World Architect — specialises in Three.js, R3F, game physics, shaders, and creative coding for immersive experiences.',
    created_at: Date.now() - 86400000 * 5,
    updated_at: Date.now(),
  },
  {
    id: 'agent-reviewer',
    name: 'Reviewer',
    icon: '🔍',
    avatar_url: null,
    color: '#22c55e',
    agent_session_key: 'agent:reviewer:main',
    default_model: 'gpt-5.2',
    default_room_id: 'thinking-room',
    sort_order: 3,
    is_pinned: true,
    auto_spawn: false,
    bio: 'Code Critic — reviews pull requests, spots bugs, suggests architectural improvements, and keeps the codebase clean.',
    created_at: Date.now() - 86400000 * 3,
    updated_at: Date.now(),
  },
  {
    id: 'agent-flowy',
    name: 'Flowy',
    icon: '✍️',
    avatar_url: null,
    color: '#a855f7',
    agent_session_key: 'agent:flowy:main',
    default_model: 'claude-sonnet-4-20250514',
    default_room_id: 'marketing-room',
    sort_order: 4,
    is_pinned: true,
    auto_spawn: false,
    bio: 'Marketing Maestro — writes blog posts, marketing copy, documentation, and manages content strategy.',
    created_at: Date.now() - 86400000 * 3,
    updated_at: Date.now(),
  },
]

const MOCK_PROJECTS: MockProject[] = [
  {
    id: 'proj-crewhub',
    name: 'CrewHub',
    description: 'Multi-agent orchestration platform with 3D visualization',
    icon: '🚀',
    color: '#6366f1',
    folder_path: '/home/user/projects/crewhub',
    status: 'active',
    created_at: Date.now() - 86400000 * 14,
    updated_at: Date.now(),
    rooms: ['dev-room'],
  },
  {
    id: 'proj-website',
    name: 'Website Redesign',
    description: 'New company website with interactive demos and landing pages',
    icon: '🌐',
    color: '#f59e0b',
    folder_path: '/home/user/projects/website',
    status: 'active',
    created_at: Date.now() - 86400000 * 7,
    updated_at: Date.now(),
    rooms: ['creative-room'],
  },
]

const MOCK_CONNECTIONS = [
  {
    id: 'conn-demo',
    name: 'Demo OpenClaw Gateway',
    type: 'openclaw',
    config: { gateway_url: 'http://localhost:3000', token: '***' },
    enabled: true,
    status: 'connected',
    error: null,
    created_at: Date.now() - 86400000 * 7,
    updated_at: Date.now(),
  },
]

const MOCK_SETTINGS: Record<string, string> = {
  'crewhub-theme': 'dark',
  'crewhub-accent': 'indigo',
  'crewhub-environment': 'desert',
  'crewhub-view-mode': 'world',
  'crewhub-lighting': 'ambient',
  'crewhub-idle-threshold': '300000',
  'crewhub-offline-threshold': '600000',
}

const MOCK_DISPLAY_NAMES = [
  { session_key: 'agent:main:main', display_name: 'Assistent' },
  { session_key: 'agent:dev:main', display_name: 'Dev' },
  { session_key: 'agent:gamedev:main', display_name: 'Game Dev' },
  { session_key: 'agent:flowy:main', display_name: 'Flowy' },
  { session_key: 'agent:reviewer:main', display_name: 'Reviewer' },
]

const MOCK_ROOM_ASSIGNMENTS = [
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

const MOCK_RULES = [
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

const MOCK_CRON_JOBS = [
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

function createMockArchivedSessions() {
  const now = Date.now()
  return [
    {
      session_key: 'agent:dev:subagent:deploy-v0.6',
      session_id: 'archived-1',
      agent_id: 'agent-dev',
      display_name: 'deploy-v0.6',
      minion_type: 'subagent',
      model: 'claude-opus-4-20250514',
      channel: 'internal',
      started_at: new Date(now - 86400000 * 2).toISOString(),
      ended_at: new Date(now - 86400000 * 2 + 3600000).toISOString(),
      message_count: 47,
      status: 'completed',
      summary: 'Deployed CrewHub v0.6 to production with zero downtime',
      file_path: '/archive/deploy-v0.6.json',
    },
    {
      session_key: 'agent:dev:subagent:refactor-sse',
      session_id: 'archived-2',
      agent_id: 'agent-dev',
      display_name: 'refactor-sse',
      minion_type: 'subagent',
      model: 'claude-opus-4-20250514',
      channel: 'internal',
      started_at: new Date(now - 86400000 * 3).toISOString(),
      ended_at: new Date(now - 86400000 * 3 + 5400000).toISOString(),
      message_count: 82,
      status: 'completed',
      summary: 'Refactored SSE manager to use centralized singleton pattern',
      file_path: '/archive/refactor-sse.json',
    },
    {
      session_key: 'agent:gamedev:subagent:room-lighting',
      session_id: 'archived-3',
      agent_id: 'agent-gamedev',
      display_name: 'room-lighting',
      minion_type: 'subagent',
      model: 'claude-opus-4-20250514',
      channel: 'internal',
      started_at: new Date(now - 86400000 * 4).toISOString(),
      ended_at: new Date(now - 86400000 * 4 + 7200000).toISOString(),
      message_count: 63,
      status: 'completed',
      summary: 'Implemented dynamic lighting system for 3D rooms with day/night cycle',
      file_path: '/archive/room-lighting.json',
    },
    {
      session_key: 'agent:flowy:subagent:blog-post-launch',
      session_id: 'archived-4',
      agent_id: 'agent-flowy',
      display_name: 'blog-post-launch',
      minion_type: 'subagent',
      model: 'claude-sonnet-4-20250514',
      channel: 'internal',
      started_at: new Date(now - 86400000 * 5).toISOString(),
      ended_at: new Date(now - 86400000 * 5 + 1800000).toISOString(),
      message_count: 24,
      status: 'completed',
      summary: 'Wrote and published launch blog post for CrewHub v0.5',
      file_path: '/archive/blog-post-launch.json',
    },
    {
      session_key: 'agent:dev:subagent:broken-tests',
      session_id: 'archived-5',
      agent_id: 'agent-dev',
      display_name: 'broken-tests',
      minion_type: 'subagent',
      model: 'claude-opus-4-20250514',
      channel: 'internal',
      started_at: new Date(now - 86400000 * 1).toISOString(),
      ended_at: new Date(now - 86400000 * 1 + 900000).toISOString(),
      message_count: 18,
      status: 'error',
      summary: 'Attempted to fix flaky integration tests — timed out on CI',
      file_path: '/archive/broken-tests.json',
    },
  ]
}

const MOCK_CHAT_HISTORY = [
  {
    id: 'msg-1',
    role: 'user' as const,
    content: 'Can you review the latest PR for the rooms feature?',
    timestamp: Date.now() - 120000,
  },
  {
    id: 'msg-2',
    role: 'assistant' as const,
    content: 'Sure! I\'ll take a look at the PR now. The rooms feature looks well-structured — I see the new RoomsContext, the drag-and-drop assignments, and the 3D room rendering. Let me check the code quality and suggest any improvements.',
    timestamp: Date.now() - 110000,
    tokens: 1240,
  },
  {
    id: 'msg-3',
    role: 'user' as const,
    content: 'Focus on the performance — we had some re-render issues.',
    timestamp: Date.now() - 60000,
  },
  {
    id: 'msg-4',
    role: 'assistant' as const,
    content: 'Good call. I found two re-render issues:\n\n1. **RoomsContext** was creating new `Map` objects on every fetch, even when data hadn\'t changed. Added fingerprint comparison.\n2. **World3DView** was re-computing room positions on every sessions update. Memoized with `useMemo` keyed on room IDs only.\n\nBoth fixes are ready — shall I push them?',
    timestamp: Date.now() - 50000,
    tokens: 2100,
  },
]

// ─── Mock Session History (for LogViewer) ──────────────────────

function createMockSessionHistory(sessionKey: string) {
  const now = Date.now()

  // Dev main agent - coding/debugging session
  if (sessionKey === 'agent:dev:main') {
    return [
      {
        role: 'user',
        content: [{ type: 'text', text: 'The SSE connection keeps dropping after 30 seconds. Can you investigate?' }],
        timestamp: now - 3600000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'SSE timeout issues could be nginx proxy timeout, keep-alive settings, or client-side EventSource reconnection...' },
          { type: 'text', text: 'I\'ll check the SSE implementation. Let me look at the connection handling.' },
        ],
        timestamp: now - 3590000,
        usage: { totalTokens: 842, cost: { total: 0.0126 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Read', input: { path: 'backend/sse/manager.py' } },
        ],
        timestamp: now - 3580000,
        usage: { totalTokens: 156, cost: { total: 0.0023 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'tool_result' },
          { type: 'text', text: 'Found it! The keep-alive ping interval is set to 45s, but nginx has a 30s proxy_read_timeout. I\'ll fix both.' },
        ],
        timestamp: now - 3570000,
        usage: { totalTokens: 1240, cost: { total: 0.0186 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Edit', input: { path: 'backend/sse/manager.py' } },
        ],
        timestamp: now - 3560000,
        usage: { totalTokens: 892, cost: { total: 0.0134 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '✅ Fixed! Changed keep-alive to 15s and updated nginx config. The connection should stay stable now.' },
        ],
        timestamp: now - 3550000,
        usage: { totalTokens: 324, cost: { total: 0.0049 } },
      },
    ]
  }

  // Reviewer agent - code review session
  if (sessionKey === 'agent:reviewer:main') {
    return [
      {
        role: 'system',
        content: [{ type: 'text', text: 'Review PR #132: Add room assignment drag-and-drop' }],
        timestamp: now - 1800000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'PR #132 adds drag-and-drop for room assignments. Need to check: accessibility, state management, error handling, performance with many sessions...' },
          { type: 'text', text: 'Starting review of PR #132. I\'ll check the implementation quality and suggest improvements.' },
        ],
        timestamp: now - 1790000,
        usage: { totalTokens: 567, cost: { total: 0.0085 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '## PR #132 Review Summary\n\n**✅ Strengths:**\n- Clean drag-and-drop implementation using @dnd-kit\n- Proper optimistic updates with rollback\n- Good TypeScript types\n\n**⚠️ Suggestions:**\n1. Add `aria-label` to draggable items for screen readers\n2. Consider debouncing the API call on drop (currently fires immediately)\n3. Missing loading state when assignment is in progress\n\n**Overall:** Approve with minor suggestions.' },
        ],
        timestamp: now - 1750000,
        usage: { totalTokens: 1876, cost: { total: 0.0281 } },
      },
    ]
  }

  // Flowy agent - marketing/content session
  if (sessionKey === 'agent:flowy:main') {
    return [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Write a tweet announcing CrewHub v0.8 with the new 3D room system' }],
        timestamp: now - 7200000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'CrewHub v0.8 key features: 3D rooms, agent visualization, real-time updates. Tweet should be punchy, show excitement, include emoji...' },
          { type: 'text', text: '🚀 CrewHub v0.8 is here!\n\nNow with a fully immersive 3D world where your AI agents come to life:\n\n🏢 Themed rooms for different projects\n🤖 Watch agents work in real-time\n✨ Drag-and-drop organization\n\nManage your AI crew like never before.\n\n#AI #AgentOps #CrewHub' },
        ],
        timestamp: now - 7190000,
        usage: { totalTokens: 423, cost: { total: 0.0063 } },
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Nice! Now a longer blog post intro paragraph' }],
        timestamp: now - 7100000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Managing multiple AI agents used to mean endless terminal tabs and mental context-switching. With CrewHub v0.8, we\'re changing that entirely. Picture this: a 3D virtual office where each of your agents has a home — developers in the lab, reviewers in the thinking room, writers in the creative studio. You can see who\'s busy, what they\'re working on, and drag them between projects with a click. It\'s not just visualization; it\'s a new way to orchestrate AI teams that finally feels intuitive.' },
        ],
        timestamp: now - 7050000,
        usage: { totalTokens: 892, cost: { total: 0.0134 } },
      },
    ]
  }

  // Main/Assistent agent - coordination session
  if (sessionKey === 'agent:main:main') {
    return [
      {
        role: 'user',
        content: [{ type: 'text', text: 'What\'s the status of the CrewHub launch?' }],
        timestamp: now - 900000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Here\'s the current status:\n\n**Dev Team:**\n- ✅ SSE stability fix deployed\n- 🔄 Room lighting PR in review\n- ⏳ Unit test coverage at 78% (target: 85%)\n\n**Marketing:**\n- ✅ Launch tweet ready\n- 🔄 Blog post in draft\n\n**Blockers:** None currently. We\'re on track for Friday launch.' },
        ],
        timestamp: now - 890000,
        usage: { totalTokens: 645, cost: { total: 0.0097 } },
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Great. Remind me to check emails in 30 minutes' }],
        timestamp: now - 800000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'cron_create', input: { schedule: 'in 30 minutes', message: 'Check emails' } },
        ],
        timestamp: now - 795000,
        usage: { totalTokens: 234, cost: { total: 0.0035 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '⏰ Done! I\'ll ping you in 30 minutes to check emails.' },
        ],
        timestamp: now - 790000,
        usage: { totalTokens: 87, cost: { total: 0.0013 } },
      },
    ]
  }

  // Game Dev agent - 3D/shader work
  if (sessionKey === 'agent:gamedev:main') {
    return [
      {
        role: 'user',
        content: [{ type: 'text', text: 'The room floor reflections are too intense. Can you tone them down?' }],
        timestamp: now - 5400000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Floor reflections in Three.js... likely using MeshReflectorMaterial from drei. Need to adjust roughness, blur, and mirror intensity...' },
          { type: 'text', text: 'I\'ll adjust the reflector settings. The current mirror=1 is giving that intense reflection.' },
        ],
        timestamp: now - 5390000,
        usage: { totalTokens: 412, cost: { total: 0.0062 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Edit', input: { path: 'frontend/src/components/3d/RoomFloor.tsx' } },
        ],
        timestamp: now - 5380000,
        usage: { totalTokens: 678, cost: { total: 0.0102 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '✨ Updated! Changed:\n- `mirror={0.4}` (was 1.0)\n- `blur={[300, 100]}` for softer edges\n- `mixBlur={8}` for blend\n\nThe floor now has a subtle, professional reflection instead of a mirror finish.' },
        ],
        timestamp: now - 5370000,
        usage: { totalTokens: 534, cost: { total: 0.0080 } },
      },
    ]
  }

  // Subagent sessions - shorter, focused tasks
  if (sessionKey.includes('subagent:fix-auth-middleware')) {
    return [
      {
        role: 'system',
        content: [{ type: 'text', text: 'Fix JWT validation in auth middleware - tokens are not being refreshed correctly' }],
        timestamp: now - 1200000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Read', input: { path: 'backend/middleware/auth.py' } },
        ],
        timestamp: now - 1190000,
        usage: { totalTokens: 234, cost: { total: 0.0035 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Found the issue: the refresh check is comparing timestamps in different timezones. Fixing now...' },
          { type: 'tool_use', name: 'Edit', input: { path: 'backend/middleware/auth.py' } },
        ],
        timestamp: now - 1180000,
        usage: { totalTokens: 567, cost: { total: 0.0085 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '✅ Fixed. Now using UTC consistently for all JWT timestamp comparisons.' },
        ],
        timestamp: now - 1170000,
        usage: { totalTokens: 123, cost: { total: 0.0018 } },
      },
    ]
  }

  if (sessionKey.includes('subagent:database-migration')) {
    return [
      {
        role: 'system',
        content: [{ type: 'text', text: 'Create migration for new room_assignments table with proper indexes' }],
        timestamp: now - 3600000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'exec', input: { command: 'alembic revision --autogenerate -m "add_room_assignments"' } },
        ],
        timestamp: now - 3590000,
        usage: { totalTokens: 189, cost: { total: 0.0028 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Migration created. Adding composite index on (session_key, room_id) for fast lookups...' },
          { type: 'tool_use', name: 'Edit', input: { path: 'backend/migrations/versions/abc123_add_room_assignments.py' } },
        ],
        timestamp: now - 3580000,
        usage: { totalTokens: 456, cost: { total: 0.0068 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '✅ Migration ready:\n- Table: `room_assignments`\n- Columns: id, session_key, room_id, assigned_at\n- Indexes: composite on (session_key, room_id)\n\nRun `alembic upgrade head` to apply.' },
        ],
        timestamp: now - 3570000,
        usage: { totalTokens: 234, cost: { total: 0.0035 } },
      },
    ]
  }

  if (sessionKey.includes('subagent:unit-test')) {
    return [
      {
        role: 'system',
        content: [{ type: 'text', text: 'Increase test coverage for RoomsContext from 65% to 85%' }],
        timestamp: now - 600000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'exec', input: { command: 'npm run test:coverage -- --testPathPattern=RoomsContext' } },
        ],
        timestamp: now - 590000,
        usage: { totalTokens: 145, cost: { total: 0.0022 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Missing coverage: error handling paths, edge cases for empty rooms, concurrent assignment updates...' },
          { type: 'text', text: 'Current coverage: 65%. Missing tests for:\n1. Error states when API fails\n2. Empty room list handling\n3. Optimistic update rollbacks\n\nAdding tests now...' },
        ],
        timestamp: now - 580000,
        usage: { totalTokens: 678, cost: { total: 0.0102 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Write', input: { path: 'frontend/src/contexts/__tests__/RoomsContext.test.tsx' } },
        ],
        timestamp: now - 500000,
        usage: { totalTokens: 1456, cost: { total: 0.0218 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '✅ Coverage increased to 87%! Added 12 new test cases covering error handling and edge cases.' },
        ],
        timestamp: now - 480000,
        usage: { totalTokens: 234, cost: { total: 0.0035 } },
      },
    ]
  }

  if (sessionKey.includes('subagent:social-media')) {
    return [
      {
        role: 'system',
        content: [{ type: 'text', text: 'Create a social media campaign for CrewHub launch - 5 tweets over 3 days' }],
        timestamp: now - 1800000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Campaign strategy: Day 1 - teaser, Day 2 - feature highlights, Day 3 - launch + demo video. Mix of emoji, hashtags, thread format...' },
          { type: 'text', text: '## CrewHub Launch Campaign\n\n**Day 1 (Teaser):**\n🧵 "What if managing AI agents felt like... managing a team in a video game? Something exciting is coming. #AI #DevTools"\n\n**Day 2 (Features):**\n🧵 "Sneak peek: Your AI agents, visualized in 3D. Watch them work, assign tasks with drag-and-drop, see activity in real-time. This is CrewHub. 🤖🏢"\n\n**Day 3 (Launch):**\n🧵 "🚀 CrewHub is LIVE! The future of AI agent orchestration is here. Try the demo → [link] #CrewHub #AIAgents"' },
        ],
        timestamp: now - 1780000,
        usage: { totalTokens: 892, cost: { total: 0.0134 } },
      },
    ]
  }

  if (sessionKey.includes('subagent:design-landing')) {
    return [
      {
        role: 'system',
        content: [{ type: 'text', text: 'Design the hero section for CrewHub landing page' }],
        timestamp: now - 2400000,
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Creating hero section with:\n- Headline: "Your AI Crew, Visualized"\n- Subheadline: "Orchestrate multiple AI agents in a 3D world"\n- CTA: "Try Demo" + "View Docs"\n- Background: Subtle 3D room preview with agents' },
          { type: 'tool_use', name: 'Write', input: { path: 'frontend/src/components/landing/Hero.tsx' } },
        ],
        timestamp: now - 2380000,
        usage: { totalTokens: 1234, cost: { total: 0.0185 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '✅ Hero section complete with responsive layout and animated background.' },
        ],
        timestamp: now - 2350000,
        usage: { totalTokens: 156, cost: { total: 0.0023 } },
      },
    ]
  }

  // Default empty history for unknown sessions
  return []
}

// ─── Rotating session labels for liveliness ────────────────────

const SESSION_LABELS = {
  'agent:main:main': [
    'Reviewing pull request #127',
    'Coordinating deployment plan',
    'Checking inbox for urgent emails',
    'Planning sprint tasks for the week',
    'Responding to WhatsApp messages',
  ],
  'agent:dev:main': [
    'Building REST API endpoints',
    'Refactoring database layer',
    'Writing integration tests',
    'Debugging Docker build pipeline',
    'Implementing WebSocket handlers',
  ],
  'agent:gamedev:main': [
    'Optimizing 3D render pipeline',
    'Adding room transition animations',
    'Implementing dynamic lighting',
    'Tweaking bot idle animations',
    'Building particle effects system',
  ],
  'agent:flowy:main': [
    'Writing blog post draft',
    'Editing marketing landing page',
    'Creating social media content',
    'Drafting release notes for v0.8',
    'Reviewing SEO keyword strategy',
  ],
  'agent:reviewer:main': [
    'Reviewing PR #132 — auth middleware',
    'Analysing test coverage gaps',
    'Checking dependency vulnerabilities',
    'Reviewing code style consistency',
    'Waiting for code review assignment',
  ],
} as Record<string, string[]>

let labelRotationIndex = 0

function getRotatingLabel(sessionKey: string): string | undefined {
  const labels = SESSION_LABELS[sessionKey]
  if (!labels) return undefined
  return labels[labelRotationIndex % labels.length]
}

// ─── localStorage persistence helpers ──────────────────────────

const LS_PREFIX = 'crewhub-demo-'

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (raw) return JSON.parse(raw) as T
  } catch { /* ignore */ }
  return fallback
}

/* lsSet — available for future mutation persistence to localStorage
function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)) } catch {}
}
*/

// ─── Mock Response Helpers ─────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function okResponse(): Response {
  return jsonResponse({ success: true })
}

// ─── URL Matching (robust, handles absolute + relative) ────────

function getApiPathname(input: string | URL | Request): string | null {
  try {
    let url: string
    if (typeof input === 'string') {
      url = input
    } else if (input instanceof URL) {
      url = input.toString()
    } else if (input instanceof Request) {
      url = input.url
    } else {
      return null
    }
    const parsed = new URL(url, window.location.origin)
    const pathname = parsed.pathname
    if (pathname.startsWith('/api/') || pathname === '/api') {
      return pathname
    }
    return null
  } catch {
    return null
  }
}

// ─── SSE Mock ──────────────────────────────────────────────────

let sseTimers: ReturnType<typeof setInterval>[] = []

function createMockEventSource() {
  class MockEventSource extends EventTarget {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSED = 2

    readonly CONNECTING = 0
    readonly OPEN = 1
    readonly CLOSED = 2

    readyState = MockEventSource.CONNECTING
    url: string
    withCredentials = false

    onopen: ((this: EventSource, ev: Event) => void) | null = null
    onmessage: ((this: EventSource, ev: MessageEvent) => void) | null = null
    onerror: ((this: EventSource, ev: Event) => void) | null = null

    constructor(url: string | URL, _config?: EventSourceInit) {
      super()
      this.url = typeof url === 'string' ? url : url.toString()

      console.log('[MockAPI] EventSource created for:', this.url)

      // Fire open event asynchronously
      setTimeout(() => {
        if (this.readyState === MockEventSource.CLOSED) return
        this.readyState = MockEventSource.OPEN
        const openEvent = new Event('open')
        this.dispatchEvent(openEvent)
        if (this.onopen) this.onopen.call(this as unknown as EventSource, openEvent)
      }, 50)

      // Emit periodic session-update events to trigger bot movement
      const updateInterval = setInterval(() => {
        if (this.readyState === MockEventSource.CLOSED) {
          clearInterval(updateInterval)
          return
        }
        this._emitSessionUpdate()
      }, 8000)

      // Rotate labels every 15s
      const labelInterval = setInterval(() => {
        if (this.readyState === MockEventSource.CLOSED) {
          clearInterval(labelInterval)
          return
        }
        labelRotationIndex++
        this._emitSessionsRefresh()
      }, 15000)

      sseTimers.push(updateInterval, labelInterval)
    }

    private _emitSessionUpdate() {
      // Pick a random demo session and emit an update
      const sessions = createMockSessions()
      const randomIndex = Math.floor(Math.random() * sessions.length)
      const session = sessions[randomIndex]
      // Update its timestamp to now
      session.updatedAt = Date.now()
      // Maybe change its totalTokens slightly
      session.totalTokens = (session.totalTokens || 0) + Math.floor(Math.random() * 500)

      const event = new MessageEvent('session-updated', {
        data: JSON.stringify(session),
      })
      this.dispatchEvent(event)
    }

    private _emitSessionsRefresh() {
      const sessions = createMockSessions()
      const event = new MessageEvent('sessions-refresh', {
        data: JSON.stringify({ sessions }),
      })
      this.dispatchEvent(event)
    }

    close() {
      this.readyState = MockEventSource.CLOSED
    }
  }

  // Preserve static constants
  Object.defineProperty(MockEventSource, 'CONNECTING', { value: 0 })
  Object.defineProperty(MockEventSource, 'OPEN', { value: 1 })
  Object.defineProperty(MockEventSource, 'CLOSED', { value: 2 })

  window.EventSource = MockEventSource as unknown as typeof EventSource
}

// ─── Session Generator ─────────────────────────────────────────

function createMockSessions() {
  const now = Date.now()
  return [
    // Main agent sessions
    {
      key: 'agent:main:main',
      kind: 'agent',
      channel: 'whatsapp',
      displayName: 'Assistent',
      label: getRotatingLabel('agent:main:main') || 'Reviewing pull request #127',
      updatedAt: now - 5000 + Math.floor(Math.random() * 3000),
      sessionId: 'demo-main',
      model: 'claude-sonnet-4-20250514',
      totalTokens: 48200 + Math.floor(Math.random() * 1000),
      contextTokens: 12400,
    },
    {
      key: 'agent:dev:main',
      kind: 'agent',
      channel: 'internal',
      displayName: 'Dev',
      label: getRotatingLabel('agent:dev:main') || 'Building REST API endpoints',
      updatedAt: now - 3000 + Math.floor(Math.random() * 2000),
      sessionId: 'demo-dev',
      model: 'claude-opus-4-20250514',
      totalTokens: 127500 + Math.floor(Math.random() * 2000),
      contextTokens: 34200,
    },
    {
      key: 'agent:gamedev:main',
      kind: 'agent',
      channel: 'internal',
      displayName: 'Game Dev',
      label: getRotatingLabel('agent:gamedev:main') || 'Optimizing 3D render pipeline',
      updatedAt: now - 8000 + Math.floor(Math.random() * 4000),
      sessionId: 'demo-gamedev',
      model: 'claude-opus-4-20250514',
      totalTokens: 89300 + Math.floor(Math.random() * 1500),
      contextTokens: 22100,
    },
    {
      key: 'agent:flowy:main',
      kind: 'agent',
      channel: 'internal',
      displayName: 'Flowy',
      label: getRotatingLabel('agent:flowy:main') || 'Writing blog post draft',
      updatedAt: now - 12000 + Math.floor(Math.random() * 5000),
      sessionId: 'demo-flowy',
      model: 'claude-sonnet-4-20250514',
      totalTokens: 34600 + Math.floor(Math.random() * 800),
      contextTokens: 8900,
    },
    {
      key: 'agent:reviewer:main',
      kind: 'agent',
      channel: 'internal',
      displayName: 'Reviewer',
      label: getRotatingLabel('agent:reviewer:main') || 'Waiting for code review',
      updatedAt: now - 90000 + Math.floor(Math.random() * 10000),
      sessionId: 'demo-reviewer',
      model: 'gpt-5.2',
      totalTokens: 15800 + Math.floor(Math.random() * 400),
      contextTokens: 4200,
    },
    // Subagent sessions
    {
      key: 'agent:dev:subagent:fix-auth-middleware',
      kind: 'subagent',
      channel: 'internal',
      displayName: undefined,
      label: 'fix-auth-middleware',
      updatedAt: now - 4000 + Math.floor(Math.random() * 2000),
      sessionId: 'demo-sub-auth',
      model: 'claude-opus-4-20250514',
      totalTokens: 41200 + Math.floor(Math.random() * 600),
      contextTokens: 11300,
    },
    {
      key: 'agent:dev:subagent:design-landing-page',
      kind: 'subagent',
      channel: 'internal',
      displayName: undefined,
      label: 'design-landing-page',
      updatedAt: now - 7000 + Math.floor(Math.random() * 3000),
      sessionId: 'demo-sub-landing',
      model: 'claude-sonnet-4-20250514',
      totalTokens: 28400 + Math.floor(Math.random() * 500),
      contextTokens: 7600,
    },
    {
      key: 'agent:dev:subagent:database-migration-v3',
      kind: 'subagent',
      channel: 'internal',
      displayName: undefined,
      label: 'database-migration-v3',
      updatedAt: now - 120000,
      sessionId: 'demo-sub-migration',
      model: 'claude-opus-4-20250514',
      totalTokens: 19800,
      contextTokens: 5100,
    },
    {
      key: 'agent:dev:subagent:unit-test-coverage',
      kind: 'subagent',
      channel: 'internal',
      displayName: undefined,
      label: 'unit-test-coverage',
      updatedAt: now - 2000 + Math.floor(Math.random() * 1000),
      sessionId: 'demo-sub-tests',
      model: 'claude-opus-4-20250514',
      totalTokens: 55700 + Math.floor(Math.random() * 800),
      contextTokens: 14800,
    },
    {
      key: 'agent:flowy:subagent:social-media-campaign',
      kind: 'subagent',
      channel: 'internal',
      displayName: undefined,
      label: 'social-media-campaign',
      updatedAt: now - 6000 + Math.floor(Math.random() * 3000),
      sessionId: 'demo-sub-social',
      model: 'claude-sonnet-4-20250514',
      totalTokens: 22100 + Math.floor(Math.random() * 400),
      contextTokens: 6200,
    },
  ]
}

// ─── Request Router ────────────────────────────────────────────

function handleMockRequest(pathname: string, method: string, _body?: BodyInit | null): Response | null {
  // === CRITICAL — Required for 3D world ===

  // GET /api/sessions
  if (pathname === '/api/sessions' && method === 'GET') {
    const sessions = createMockSessions()
    console.log(`[MockAPI] GET /api/sessions → 200 (${sessions.length} sessions)`)
    return jsonResponse({ sessions })
  }

  // GET /api/rooms
  if (pathname === '/api/rooms' && method === 'GET') {
    const rooms = lsGet('rooms', MOCK_ROOMS)
    console.log(`[MockAPI] GET /api/rooms → 200 (${rooms.length} rooms)`)
    return jsonResponse({ rooms })
  }

  // GET /api/session-room-assignments
  if (pathname === '/api/session-room-assignments' && method === 'GET') {
    const assignments = lsGet('assignments', MOCK_ROOM_ASSIGNMENTS)
    console.log(`[MockAPI] GET /api/session-room-assignments → 200 (${assignments.length} assignments)`)
    return jsonResponse({ assignments })
  }

  // GET /api/room-assignment-rules
  if (pathname === '/api/room-assignment-rules' && method === 'GET') {
    const rules = lsGet('rules', MOCK_RULES)
    console.log(`[MockAPI] GET /api/room-assignment-rules → 200 (${rules.length} rules)`)
    return jsonResponse({ rules })
  }

  // GET /api/agents
  if (pathname === '/api/agents' && method === 'GET') {
    const agents = lsGet('agents', MOCK_AGENTS)
    console.log(`[MockAPI] GET /api/agents → 200 (${agents.length} agents)`)
    return jsonResponse({ agents })
  }

  // GET /api/settings
  if (pathname === '/api/settings' && method === 'GET') {
    const settings = lsGet('settings', MOCK_SETTINGS)
    console.log('[MockAPI] GET /api/settings → 200')
    return jsonResponse(settings)
  }

  // GET /api/settings/:key
  if (pathname.match(/^\/api\/settings\/[\w-]+$/) && method === 'GET') {
    const key = decodeURIComponent(pathname.split('/').pop()!)
    const settings = lsGet('settings', MOCK_SETTINGS)
    const value = settings[key] || null
    console.log(`[MockAPI] GET /api/settings/${key} → 200`)
    return jsonResponse({ key, value })
  }

  // GET /api/projects
  if (pathname === '/api/projects' && method === 'GET') {
    console.log(`[MockAPI] GET /api/projects → 200 (${MOCK_PROJECTS.length} projects)`)
    return jsonResponse({ projects: MOCK_PROJECTS })
  }

  // GET /api/projects/overview
  if (pathname === '/api/projects/overview' && method === 'GET') {
    const overview = MOCK_PROJECTS.map(p => ({
      ...p,
      room_count: p.rooms.length,
      agent_count: MOCK_AGENTS.filter(a => a.default_room_id && p.rooms.includes(a.default_room_id)).length,
    }))
    console.log('[MockAPI] GET /api/projects/overview → 200')
    return jsonResponse({ projects: overview })
  }

  // GET /api/session-display-names
  if (pathname === '/api/session-display-names' && method === 'GET') {
    console.log('[MockAPI] GET /api/session-display-names → 200')
    return jsonResponse({ display_names: MOCK_DISPLAY_NAMES })
  }

  // GET /api/session-display-names/:key
  if (pathname.match(/^\/api\/session-display-names\//) && method === 'GET') {
    const key = decodeURIComponent(pathname.replace('/api/session-display-names/', ''))
    const entry = MOCK_DISPLAY_NAMES.find(d => d.session_key === key)
    console.log(`[MockAPI] GET /api/session-display-names/${key} → 200`)
    return jsonResponse({
      session_key: key,
      display_name: entry?.display_name || null,
    })
  }

  // === IMPORTANT — Secondary features ===

  // GET /api/connections
  if (pathname === '/api/connections' && method === 'GET') {
    console.log('[MockAPI] GET /api/connections → 200')
    return jsonResponse({ connections: MOCK_CONNECTIONS })
  }

  // GET /api/onboarding/status
  if (pathname === '/api/onboarding/status' && method === 'GET') {
    console.log('[MockAPI] GET /api/onboarding/status → 200')
    return jsonResponse({ completed: true, connections_count: 1, has_active_connection: true })
  }

  // GET /api/cron/jobs
  if (pathname === '/api/cron/jobs' && method === 'GET') {
    console.log('[MockAPI] GET /api/cron/jobs → 200')
    return jsonResponse({ jobs: MOCK_CRON_JOBS })
  }

  // GET /api/sessions/archived
  if (pathname === '/api/sessions/archived' && method === 'GET') {
    const archived = createMockArchivedSessions()
    console.log('[MockAPI] GET /api/sessions/archived → 200')
    return jsonResponse({ sessions: archived, total: archived.length, limit: 50, offset: 0 })
  }

  // GET /api/project-folders/discover
  if (pathname === '/api/project-folders/discover' && method === 'GET') {
    console.log('[MockAPI] GET /api/project-folders/discover → 200')
    return jsonResponse({ folders: [] })
  }

  // GET /api/projects/:id/files
  if (pathname.match(/^\/api\/projects\/[\w-]+\/files$/) && method === 'GET') {
    console.log('[MockAPI] GET /api/projects/:id/files → 200')
    return jsonResponse({
      files: [
        {
          name: 'README.md',
          path: 'README.md',
          type: 'document',
          extension: '.md',
          size: 2048,
        },
        {
          name: 'src',
          path: 'src',
          type: 'directory',
          children: [
            { name: 'index.ts', path: 'src/index.ts', type: 'code', extension: '.ts', size: 512 },
            { name: 'config.json', path: 'src/config.json', type: 'config', extension: '.json', size: 256 },
          ],
          child_count: 2,
        },
      ],
    })
  }

  // GET /api/projects/:id/files/content
  if (pathname.match(/^\/api\/projects\/[\w-]+\/files\/content/) && method === 'GET') {
    console.log('[MockAPI] GET /api/projects/:id/files/content → 200')
    return jsonResponse({
      path: 'README.md',
      name: 'README.md',
      type: 'document',
      extension: '.md',
      size: 2048,
      content: '# CrewHub\n\n> Multi-agent orchestration platform with 3D visualization\n\n## Features\n\n- 🏢 **3D Room System** — Organize agents into themed rooms\n- 🤖 **Agent Management** — Monitor and control AI agents in real-time\n- 🔄 **Live Updates** — SSE-powered real-time session tracking\n- 🎨 **Customizable** — Themes, layouts, and room configurations\n\n## Getting Started\n\n```bash\nnpm install\nnpm run dev\n```\n',
    })
  }

  // GET /api/sessions/:key/history
  if (pathname.match(/^\/api\/sessions\/.*\/history/) && method === 'GET') {
    // Extract session key from URL: /api/sessions/{encoded-key}/history
    const match = pathname.match(/^\/api\/sessions\/(.+)\/history/)
    const sessionKey = match ? decodeURIComponent(match[1]) : ''
    const messages = createMockSessionHistory(sessionKey)
    console.log(`[MockAPI] GET /api/sessions/${sessionKey}/history → 200 (${messages.length} messages)`)
    return jsonResponse({ messages })
  }

  // GET /api/chat/:key/history
  if (pathname.match(/^\/api\/chat\/.*\/history/) && method === 'GET') {
    console.log('[MockAPI] GET /api/chat/:key/history → 200')
    return jsonResponse({ messages: MOCK_CHAT_HISTORY, hasMore: false, oldestTimestamp: Date.now() - 120000 })
  }

  // GET /api/backup/list
  if (pathname === '/api/backup/list' && method === 'GET') {
    console.log('[MockAPI] GET /api/backup/list → 200')
    return jsonResponse([])
  }

  // === MUTATIONS — persist some to localStorage, rest are no-op ===

  // PUT /api/settings/:key
  if (pathname.match(/^\/api\/settings\/[\w-]+$/) && method === 'PUT') {
    try {
      const key = decodeURIComponent(pathname.split('/').pop()!)
      // We need to read body — but in mock fetch, body is already consumed
      // Save to localStorage (will be parsed by caller)
      const settings = lsGet('settings', MOCK_SETTINGS)
      // Note: the body parsing happens below in the fetch wrapper
      console.log(`[MockAPI] PUT /api/settings/${key} → 200`)
      return jsonResponse({ key, value: settings[key] || '' })
    } catch {
      return okResponse()
    }
  }

  // PUT /api/settings/batch
  if (pathname === '/api/settings/batch' && method === 'PUT') {
    console.log('[MockAPI] PUT /api/settings/batch → 200')
    return okResponse()
  }

  // POST /api/session-room-assignments
  if (pathname === '/api/session-room-assignments' && method === 'POST') {
    console.log('[MockAPI] POST /api/session-room-assignments → 200')
    return okResponse()
  }

  // DELETE /api/session-room-assignments/:key
  if (pathname.match(/^\/api\/session-room-assignments\//) && method === 'DELETE') {
    console.log('[MockAPI] DELETE /api/session-room-assignments → 200')
    return okResponse()
  }

  // POST /api/rooms
  if (pathname === '/api/rooms' && method === 'POST') {
    console.log('[MockAPI] POST /api/rooms → 200')
    return okResponse()
  }

  // PUT /api/rooms/:id
  if (pathname.match(/^\/api\/rooms\/[\w-]+$/) && method === 'PUT') {
    console.log('[MockAPI] PUT /api/rooms/:id → 200')
    return okResponse()
  }

  // DELETE /api/rooms/:id
  if (pathname.match(/^\/api\/rooms\/[\w-]+$/) && method === 'DELETE') {
    console.log('[MockAPI] DELETE /api/rooms/:id → 200')
    return okResponse()
  }

  // PUT /api/rooms/reorder
  if (pathname === '/api/rooms/reorder' && method === 'PUT') {
    console.log('[MockAPI] PUT /api/rooms/reorder → 200')
    return okResponse()
  }

  // POST/PUT/DELETE /api/projects
  if (pathname.match(/^\/api\/projects/) && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
    console.log(`[MockAPI] ${method} ${pathname} → 200`)
    if (method === 'POST') {
      return jsonResponse({
        id: 'proj-new-' + Date.now(),
        name: 'New Project',
        description: null,
        icon: '🚀',
        color: '#3b82f6',
        folder_path: null,
        status: 'active',
        created_at: Date.now(),
        updated_at: Date.now(),
        rooms: [],
      })
    }
    return okResponse()
  }

  // PUT /api/agents/:id
  if (pathname.match(/^\/api\/agents\/[\w-]+$/) && method === 'PUT') {
    console.log('[MockAPI] PUT /api/agents/:id → 200')
    return okResponse()
  }

  // POST/PATCH/DELETE /api/connections
  if (pathname.match(/^\/api\/connections/) && method !== 'GET') {
    console.log(`[MockAPI] ${method} ${pathname} → 200`)
    if (pathname.match(/\/connect$/)) {
      return jsonResponse({ connected: true })
    }
    return okResponse()
  }

  // POST/DELETE /api/session-display-names
  if (pathname.match(/^\/api\/session-display-names\//) && (method === 'POST' || method === 'DELETE')) {
    console.log(`[MockAPI] ${method} ${pathname} → 200`)
    return okResponse()
  }

  // POST/PUT/DELETE /api/room-assignment-rules
  if (pathname.match(/^\/api\/room-assignment-rules/) && method !== 'GET') {
    console.log(`[MockAPI] ${method} ${pathname} → 200`)
    return okResponse()
  }

  // POST /api/discovery/scan
  if (pathname === '/api/discovery/scan' && method === 'POST') {
    console.log('[MockAPI] POST /api/discovery/scan → 200')
    return jsonResponse({ candidates: [], scan_duration_ms: 1200 })
  }

  // POST /api/discovery/test
  if (pathname === '/api/discovery/test' && method === 'POST') {
    console.log('[MockAPI] POST /api/discovery/test → 200')
    return jsonResponse({ reachable: false, error: 'Demo mode — no real connections' })
  }

  // POST /api/chat/:key/send
  if (pathname.match(/^\/api\/chat\/.*\/send$/) && method === 'POST') {
    console.log('[MockAPI] POST /api/chat/:key/send → 200')
    return jsonResponse({
      success: true,
      response: 'This is a demo — I can\'t actually process messages, but in a real CrewHub setup I\'d be an AI agent working on your tasks! 🤖',
      tokens: 42,
    })
  }

  // POST /api/backup/*
  if (pathname.match(/^\/api\/backup/) && method === 'POST') {
    console.log(`[MockAPI] ${method} ${pathname} → 200`)
    return okResponse()
  }

  return null
}

// ─── Main Setup ────────────────────────────────────────────────

export function setupMockApi() {
  console.log('[MockAPI] 🎬 Setting up demo mode mock API...')

  // 1. Patch window.fetch
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const pathname = getApiPathname(input as string | URL | Request)

    // Not an /api/ request — pass through
    if (!pathname) {
      return originalFetch(input, init)
    }

    const method = init?.method?.toUpperCase() || 'GET'

    // Add tiny delay to simulate network
    await new Promise(r => setTimeout(r, 20 + Math.random() * 80))

    // Try to handle with mock router
    const response = handleMockRequest(pathname, method, init?.body)
    if (response) return response

    // Fallback: unhandled mutations succeed silently
    if (method !== 'GET') {
      console.warn(`[MockAPI] Unhandled mutation: ${method} ${pathname} → 200 (no-op)`)
      return okResponse()
    }

    // Unhandled GET — warn and 404
    console.warn(`[MockAPI] ⚠ Unhandled GET: ${pathname} → 404`)
    return new Response(JSON.stringify({ detail: 'Not found (demo mode)' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Patch EventSource for SSE
  createMockEventSource()

  // 3. Auto-enable demo mode in localStorage
  localStorage.setItem('crewhub-demo-mode', 'true')

  // 4. Skip onboarding
  localStorage.setItem('crewhub-onboarded', 'true')

  // 5. Set default settings in localStorage for immediate availability
  const settings = lsGet('settings', MOCK_SETTINGS)
  for (const [key, value] of Object.entries(settings)) {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, value)
    }
  }

  // 6. Add noindex meta tag for demo builds
  if (!document.querySelector('meta[name="robots"]')) {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
  }

  console.log('[MockAPI] ✅ Demo mode ready — all /api/* requests intercepted')
}
