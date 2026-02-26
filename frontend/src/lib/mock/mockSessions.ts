/**
 * Mock session data, history, SSE EventSource, and rotating labels.
 * These are all tightly coupled through labelRotationIndex so they live together.
 */

// ─── Session key constants ─────────────────────────────────────
const KEY_MAIN = 'agent:main:main'
const KEY_DEV = 'agent:dev:main'
const KEY_GAMEDEV = 'agent:gamedev:main'
const KEY_FLOWY = 'agent:flowy:main'
const KEY_REVIEWER = 'agent:reviewer:main'
const MODEL_OPUS = 'claude-opus-4-20250514'
const MODEL_SONNET = 'claude-sonnet-4-20250514'
const CH_INTERNAL = 'internal'

// ─── Rotating session labels for liveliness ────────────────────

export const SESSION_LABELS: Record<string, string[]> = {
  [KEY_MAIN]: [
    'Reviewing pull request #127',
    'Coordinating deployment plan',
    'Checking inbox for urgent emails',
    'Planning sprint tasks for the week',
    'Responding to WhatsApp messages',
  ],
  [KEY_DEV]: [
    'Building REST API endpoints',
    'Refactoring database layer',
    'Writing integration tests',
    'Debugging Docker build pipeline',
    'Implementing WebSocket handlers',
  ],
  [KEY_GAMEDEV]: [
    'Optimizing 3D render pipeline',
    'Adding room transition animations',
    'Implementing dynamic lighting',
    'Tweaking bot idle animations',
    'Building particle effects system',
  ],
  [KEY_FLOWY]: [
    'Writing blog post draft',
    'Editing marketing landing page',
    'Creating social media content',
    'Drafting release notes for v0.8',
    'Reviewing SEO keyword strategy',
  ],
  [KEY_REVIEWER]: [
    'Reviewing PR #132 — auth middleware',
    'Analysing test coverage gaps',
    'Checking dependency vulnerabilities',
    'Reviewing code style consistency',
    'Waiting for code review assignment',
  ],
}

// Shared mutable rotation index — used by both getRotatingLabel and createMockEventSource
let labelRotationIndex = 0
export function incrementLabelRotationIndex() {
  labelRotationIndex++
}

export function getRotatingLabel(sessionKey: string): string | undefined {
  const labels = SESSION_LABELS[sessionKey]
  if (!labels) return undefined
  return labels[labelRotationIndex % labels.length]
}

// ─── Session Generator ─────────────────────────────────────────

export function createMockSessions() {
  const now = Date.now()
  return [
    // Main agent sessions
    {
      key: KEY_MAIN,
      kind: 'agent',
      channel: 'whatsapp',
      displayName: 'Assistent',
      label: getRotatingLabel(KEY_MAIN) || 'Reviewing pull request #127',
      updatedAt: now - 5000 + Math.floor(Math.random() * 3000),
      sessionId: 'demo-main',
      model: MODEL_SONNET,
      totalTokens: 48200 + Math.floor(Math.random() * 1000),
      contextTokens: 12400,
    },
    {
      key: KEY_DEV,
      kind: 'agent',
      channel: CH_INTERNAL,
      displayName: 'Dev',
      label: getRotatingLabel(KEY_DEV) || 'Building REST API endpoints',
      updatedAt: now - 3000 + Math.floor(Math.random() * 2000),
      sessionId: 'demo-dev',
      model: MODEL_OPUS,
      totalTokens: 127500 + Math.floor(Math.random() * 2000),
      contextTokens: 34200,
    },
    {
      key: KEY_GAMEDEV,
      kind: 'agent',
      channel: CH_INTERNAL,
      displayName: 'Game Dev',
      label: getRotatingLabel(KEY_GAMEDEV) || 'Optimizing 3D render pipeline',
      updatedAt: now - 8000 + Math.floor(Math.random() * 4000),
      sessionId: 'demo-gamedev',
      model: MODEL_OPUS,
      totalTokens: 89300 + Math.floor(Math.random() * 1500),
      contextTokens: 22100,
    },
    {
      key: KEY_FLOWY,
      kind: 'agent',
      channel: CH_INTERNAL,
      displayName: 'Flowy',
      label: getRotatingLabel(KEY_FLOWY) || 'Writing blog post draft',
      updatedAt: now - 12000 + Math.floor(Math.random() * 5000),
      sessionId: 'demo-flowy',
      model: MODEL_SONNET,
      totalTokens: 34600 + Math.floor(Math.random() * 800),
      contextTokens: 8900,
    },
    {
      key: KEY_REVIEWER,
      kind: 'agent',
      channel: CH_INTERNAL,
      displayName: 'Reviewer',
      label: getRotatingLabel(KEY_REVIEWER) || 'Waiting for code review',
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
      channel: CH_INTERNAL,
      displayName: undefined,
      label: 'fix-auth-middleware',
      updatedAt: now - 4000 + Math.floor(Math.random() * 2000),
      sessionId: 'demo-sub-auth',
      model: MODEL_OPUS,
      totalTokens: 41200 + Math.floor(Math.random() * 600),
      contextTokens: 11300,
    },
    {
      key: 'agent:dev:subagent:design-landing-page',
      kind: 'subagent',
      channel: CH_INTERNAL,
      displayName: undefined,
      label: 'design-landing-page',
      updatedAt: now - 7000 + Math.floor(Math.random() * 3000),
      sessionId: 'demo-sub-landing',
      model: MODEL_SONNET,
      totalTokens: 28400 + Math.floor(Math.random() * 500),
      contextTokens: 7600,
    },
    {
      key: 'agent:dev:subagent:database-migration-v3',
      kind: 'subagent',
      channel: CH_INTERNAL,
      displayName: undefined,
      label: 'database-migration-v3',
      updatedAt: now - 120000,
      sessionId: 'demo-sub-migration',
      model: MODEL_OPUS,
      totalTokens: 19800,
      contextTokens: 5100,
    },
    {
      key: 'agent:dev:subagent:unit-test-coverage',
      kind: 'subagent',
      channel: CH_INTERNAL,
      displayName: undefined,
      label: 'unit-test-coverage',
      updatedAt: now - 2000 + Math.floor(Math.random() * 1000),
      sessionId: 'demo-sub-tests',
      model: MODEL_OPUS,
      totalTokens: 55700 + Math.floor(Math.random() * 800),
      contextTokens: 14800,
    },
    {
      key: 'agent:flowy:subagent:social-media-campaign',
      kind: 'subagent',
      channel: CH_INTERNAL,
      displayName: undefined,
      label: 'social-media-campaign',
      updatedAt: now - 6000 + Math.floor(Math.random() * 3000),
      sessionId: 'demo-sub-social',
      model: MODEL_SONNET,
      totalTokens: 22100 + Math.floor(Math.random() * 400),
      contextTokens: 6200,
    },
  ]
}

// ─── Archived Sessions ─────────────────────────────────────────

export function createMockArchivedSessions() {
  const now = Date.now()
  return [
    {
      session_key: 'agent:dev:subagent:deploy-v0.6',
      session_id: 'archived-1',
      agent_id: 'agent-dev',
      display_name: 'deploy-v0.6',
      minion_type: 'subagent',
      model: MODEL_OPUS,
      channel: CH_INTERNAL,
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
      model: MODEL_OPUS,
      channel: CH_INTERNAL,
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
      model: MODEL_OPUS,
      channel: CH_INTERNAL,
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
      model: MODEL_SONNET,
      channel: CH_INTERNAL,
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
      model: MODEL_OPUS,
      channel: CH_INTERNAL,
      started_at: new Date(now - 86400000 * 1).toISOString(),
      ended_at: new Date(now - 86400000 * 1 + 900000).toISOString(),
      message_count: 18,
      status: 'error',
      summary: 'Attempted to fix flaky integration tests — timed out on CI',
      file_path: '/archive/broken-tests.json',
    },
  ]
}

// ─── Mock Chat History ─────────────────────────────────────────

export const MOCK_CHAT_HISTORY = [
  {
    id: 'msg-1',
    role: 'user' as const,
    content: 'Can you review the latest PR for the rooms feature?',
    timestamp: Date.now() - 120000,
  },
  {
    id: 'msg-2',
    role: 'assistant' as const,
    content:
      "Sure! I'll take a look at the PR now. The rooms feature looks well-structured — I see the new RoomsContext, the drag-and-drop assignments, and the 3D room rendering. Let me check the code quality and suggest any improvements.",
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
    content:
      "Good call. I found two re-render issues:\n\n1. **RoomsContext** was creating new `Map` objects on every fetch, even when data hadn't changed. Added fingerprint comparison.\n2. **World3DView** was re-computing room positions on every sessions update. Memoized with `useMemo` keyed on room IDs only.\n\nBoth fixes are ready — shall I push them?",
    timestamp: Date.now() - 50000,
    tokens: 2100,
  },
]

// ─── Mock Session History (for LogViewer) ──────────────────────

export function createMockSessionHistory(sessionKey: string) {
  const now = Date.now()

  // Dev main agent - coding/debugging session
  if (sessionKey === KEY_DEV) {
    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'The SSE connection keeps dropping after 30 seconds. Can you investigate?',
          },
        ],
        timestamp: now - 3600000,
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking:
              'SSE timeout issues could be nginx proxy timeout, keep-alive settings, or client-side EventSource reconnection...',
          },
          {
            type: 'text',
            text: "I'll check the SSE implementation. Let me look at the connection handling.",
          },
        ],
        timestamp: now - 3590000,
        usage: { totalTokens: 842, cost: { total: 0.0126 } },
      },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Read', input: { path: 'backend/sse/manager.py' } }],
        timestamp: now - 3580000,
        usage: { totalTokens: 156, cost: { total: 0.0023 } },
      },
      {
        role: 'assistant',
        content: [
          { type: 'tool_result' },
          {
            type: 'text',
            text: "Found it! The keep-alive ping interval is set to 45s, but nginx has a 30s proxy_read_timeout. I'll fix both.",
          },
        ],
        timestamp: now - 3570000,
        usage: { totalTokens: 1240, cost: { total: 0.0186 } },
      },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Edit', input: { path: 'backend/sse/manager.py' } }],
        timestamp: now - 3560000,
        usage: { totalTokens: 892, cost: { total: 0.0134 } },
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '✅ Fixed! Changed keep-alive to 15s and updated nginx config. The connection should stay stable now.',
          },
        ],
        timestamp: now - 3550000,
        usage: { totalTokens: 324, cost: { total: 0.0049 } },
      },
    ]
  }

  // Reviewer agent - code review session
  if (sessionKey === KEY_REVIEWER) {
    return [
      {
        role: 'system',
        content: [{ type: 'text', text: 'Review PR #132: Add room assignment drag-and-drop' }],
        timestamp: now - 1800000,
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking:
              'PR #132 adds drag-and-drop for room assignments. Need to check: accessibility, state management, error handling, performance with many sessions...',
          },
          {
            type: 'text',
            text: "Starting review of PR #132. I'll check the implementation quality and suggest improvements.",
          },
        ],
        timestamp: now - 1790000,
        usage: { totalTokens: 567, cost: { total: 0.0085 } },
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '## PR #132 Review Summary\n\n**✅ Strengths:**\n- Clean drag-and-drop implementation using @dnd-kit\n- Proper optimistic updates with rollback\n- Good TypeScript types\n\n**⚠️ Suggestions:**\n1. Add `aria-label` to draggable items for screen readers\n2. Consider debouncing the API call on drop (currently fires immediately)\n3. Missing loading state when assignment is in progress\n\n**Overall:** Approve with minor suggestions.',
          },
        ],
        timestamp: now - 1750000,
        usage: { totalTokens: 1876, cost: { total: 0.0281 } },
      },
    ]
  }

  // Flowy agent - marketing/content session
  if (sessionKey === KEY_FLOWY) {
    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Write a tweet announcing CrewHub v0.8 with the new 3D room system',
          },
        ],
        timestamp: now - 7200000,
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking:
              'CrewHub v0.8 key features: 3D rooms, agent visualization, real-time updates. Tweet should be punchy, show excitement, include emoji...',
          },
          {
            type: 'text',
            text: '🚀 CrewHub v0.8 is here!\n\nNow with a fully immersive 3D world where your AI agents come to life:\n\n🏢 Themed rooms for different projects\n🤖 Watch agents work in real-time\n✨ Drag-and-drop organization\n\nManage your AI crew like never before.\n\n#AI #AgentOps #CrewHub',
          },
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
          {
            type: 'text',
            text: "Managing multiple AI agents used to mean endless terminal tabs and mental context-switching. With CrewHub v0.8, we're changing that entirely. Picture this: a 3D virtual office where each of your agents has a home — developers in the lab, reviewers in the thinking room, writers in the creative studio. You can see who's busy, what they're working on, and drag them between projects with a click. It's not just visualization; it's a new way to orchestrate AI teams that finally feels intuitive.",
          },
        ],
        timestamp: now - 7050000,
        usage: { totalTokens: 892, cost: { total: 0.0134 } },
      },
    ]
  }

  // Main/Assistent agent - coordination session
  if (sessionKey === KEY_MAIN) {
    return [
      {
        role: 'user',
        content: [{ type: 'text', text: "What's the status of the CrewHub launch?" }],
        timestamp: now - 900000,
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: "Here's the current status:\n\n**Dev Team:**\n- ✅ SSE stability fix deployed\n- 🔄 Room lighting PR in review\n- ⏳ Unit test coverage at 78% (target: 85%)\n\n**Marketing:**\n- ✅ Launch tweet ready\n- 🔄 Blog post in draft\n\n**Blockers:** None currently. We're on track for Friday launch.",
          },
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
          {
            type: 'tool_use',
            name: 'cron_create',
            input: { schedule: 'in 30 minutes', message: 'Check emails' },
          },
        ],
        timestamp: now - 795000,
        usage: { totalTokens: 234, cost: { total: 0.0035 } },
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: "⏰ Done! I'll ping you in 30 minutes to check emails." }],
        timestamp: now - 790000,
        usage: { totalTokens: 87, cost: { total: 0.0013 } },
      },
    ]
  }

  // Game Dev agent - 3D/shader work
  if (sessionKey === KEY_GAMEDEV) {
    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'The room floor reflections are too intense. Can you tone them down?',
          },
        ],
        timestamp: now - 5400000,
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking:
              'Floor reflections in Three.js... likely using MeshReflectorMaterial from drei. Need to adjust roughness, blur, and mirror intensity...',
          },
          {
            type: 'text',
            text: "I'll adjust the reflector settings. The current mirror=1 is giving that intense reflection.",
          },
        ],
        timestamp: now - 5390000,
        usage: { totalTokens: 412, cost: { total: 0.0062 } },
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'Edit',
            input: { path: 'frontend/src/components/3d/RoomFloor.tsx' },
          },
        ],
        timestamp: now - 5380000,
        usage: { totalTokens: 678, cost: { total: 0.0102 } },
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '✨ Updated! Changed:\n- `mirror={0.4}` (was 1)\n- `blur={[300, 100]}` for softer edges\n- `mixBlur={8}` for blend\n\nThe floor now has a subtle, professional reflection instead of a mirror finish.',
          },
        ],
        timestamp: now - 5370000,
        usage: { totalTokens: 534, cost: { total: 0.008 } },
      },
    ]
  }

  // Subagent sessions - shorter, focused tasks
  if (sessionKey.includes('subagent:fix-auth-middleware')) {
    return [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'Fix JWT validation in auth middleware - tokens are not being refreshed correctly',
          },
        ],
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
          {
            type: 'text',
            text: 'Found the issue: the refresh check is comparing timestamps in different timezones. Fixing now...',
          },
          { type: 'tool_use', name: 'Edit', input: { path: 'backend/middleware/auth.py' } },
        ],
        timestamp: now - 1180000,
        usage: { totalTokens: 567, cost: { total: 0.0085 } },
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '✅ Fixed. Now using UTC consistently for all JWT timestamp comparisons.',
          },
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
        content: [
          {
            type: 'text',
            text: 'Create migration for new room_assignments table with proper indexes',
          },
        ],
        timestamp: now - 3600000,
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'exec',
            input: { command: 'alembic revision --autogenerate -m "add_room_assignments"' },
          },
        ],
        timestamp: now - 3590000,
        usage: { totalTokens: 189, cost: { total: 0.0028 } },
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Migration created. Adding composite index on (session_key, room_id) for fast lookups...',
          },
          {
            type: 'tool_use',
            name: 'Edit',
            input: { path: 'backend/migrations/versions/abc123_add_room_assignments.py' },
          },
        ],
        timestamp: now - 3580000,
        usage: { totalTokens: 456, cost: { total: 0.0068 } },
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '✅ Migration ready:\n- Table: `room_assignments`\n- Columns: id, session_key, room_id, assigned_at\n- Indexes: composite on (session_key, room_id)\n\nRun `alembic upgrade head` to apply.',
          },
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
        content: [
          { type: 'text', text: 'Increase test coverage for RoomsContext from 65% to 85%' },
        ],
        timestamp: now - 600000,
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'exec',
            input: { command: 'npm run test:coverage -- --testPathPattern=RoomsContext' },
          },
        ],
        timestamp: now - 590000,
        usage: { totalTokens: 145, cost: { total: 0.0022 } },
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking:
              'Missing coverage: error handling paths, edge cases for empty rooms, concurrent assignment updates...',
          },
          {
            type: 'text',
            text: 'Current coverage: 65%. Missing tests for:\n1. Error states when API fails\n2. Empty room list handling\n3. Optimistic update rollbacks\n\nAdding tests now...',
          },
        ],
        timestamp: now - 580000,
        usage: { totalTokens: 678, cost: { total: 0.0102 } },
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'Write',
            input: { path: 'frontend/src/contexts/__tests__/RoomsContext.test.tsx' },
          },
        ],
        timestamp: now - 500000,
        usage: { totalTokens: 1456, cost: { total: 0.0218 } },
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '✅ Coverage increased to 87%! Added 12 new test cases covering error handling and edge cases.',
          },
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
        content: [
          {
            type: 'text',
            text: 'Create a social media campaign for CrewHub launch - 5 tweets over 3 days',
          },
        ],
        timestamp: now - 1800000,
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking:
              'Campaign strategy: Day 1 - teaser, Day 2 - feature highlights, Day 3 - launch + demo video. Mix of emoji, hashtags, thread format...',
          },
          {
            type: 'text',
            text: '## CrewHub Launch Campaign\n\n**Day 1 (Teaser):**\n🧵 "What if managing AI agents felt like... managing a team in a video game? Something exciting is coming. #AI #DevTools"\n\n**Day 2 (Features):**\n🧵 "Sneak peek: Your AI agents, visualized in 3D. Watch them work, assign tasks with drag-and-drop, see activity in real-time. This is CrewHub. 🤖🏢"\n\n**Day 3 (Launch):**\n🧵 "🚀 CrewHub is LIVE! The future of AI agent orchestration is here. Try the demo → [link] #CrewHub #AIAgents"',
          },
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
          {
            type: 'text',
            text: 'Creating hero section with:\n- Headline: "Your AI Crew, Visualized"\n- Subheadline: "Orchestrate multiple AI agents in a 3D world"\n- CTA: "Try Demo" + "View Docs"\n- Background: Subtle 3D room preview with agents',
          },
          {
            type: 'tool_use',
            name: 'Write',
            input: { path: 'frontend/src/components/landing/Hero.tsx' },
          },
        ],
        timestamp: now - 2380000,
        usage: { totalTokens: 1234, cost: { total: 0.0185 } },
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '✅ Hero section complete with responsive layout and animated background.',
          },
        ],
        timestamp: now - 2350000,
        usage: { totalTokens: 156, cost: { total: 0.0023 } },
      },
    ]
  }

  // Default empty history for unknown sessions
  return []
}

// ─── SSE Mock ──────────────────────────────────────────────────

const sseTimers: ReturnType<typeof setInterval>[] = []

export function createMockEventSource() {
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
        incrementLabelRotationIndex()
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
