/* eslint-disable sonarjs/cognitive-complexity */
/**
 * Mock API — request router
 * Dispatches /api/* requests to the appropriate mock response.
 */

import { MOCK_AGENTS } from './mockAgents'
import { MOCK_PROJECTS, MOCK_CONNECTIONS } from './mockProjects'
import { MOCK_TASKS } from './mockTasks'
import type { MockTask } from './types'
import {
  MOCK_SETTINGS,
  MOCK_DISPLAY_NAMES,
  MOCK_ROOM_ASSIGNMENTS,
  MOCK_RULES,
  MOCK_CRON_JOBS,
} from './mockSettings'
import { MOCK_ROOMS } from './mockRooms'
import {
  createMockSessions,
  createMockArchivedSessions,
  createMockSessionHistory,
  MOCK_CHAT_HISTORY,
} from './mockSessions'
import { lsGet, jsonResponse, okResponse } from './mockUtils'

const TEAM_STANDUP = 'Team Standup'
const THREAD_STANDUP_GROUP = 'thread-standup-group'

export function handleMockRequest( // NOSONAR: complexity from legitimate mock routing switch; all branches needed for comprehensive API mocking
  pathname: string,
  method: string,
  _body?: BodyInit | null
): Response | null {
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
    console.log(
      `[MockAPI] GET /api/session-room-assignments → 200 (${assignments.length} assignments)`
    )
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
  if (/^\/api\/settings\/[\w-]+$/.exec(pathname) && method === 'GET') {
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
    const overview = MOCK_PROJECTS.map((p) => ({
      ...p,
      room_count: p.rooms.length,
      agent_count: MOCK_AGENTS.filter(
        (a) => a.default_room_id && p.rooms.includes(a.default_room_id)
      ).length,
    }))
    console.log('[MockAPI] GET /api/projects/overview → 200')
    return jsonResponse({ projects: overview })
  }

  // GET /api/tasks
  if (pathname === '/api/tasks' && method === 'GET') {
    const tasks = lsGet('tasks', MOCK_TASKS)
    console.log(`[MockAPI] GET /api/tasks → 200 (${tasks.length} tasks)`)
    return jsonResponse({ tasks, total: tasks.length })
  }

  // GET /api/tasks/:id
  if (/^\/api\/tasks\/[\w-]+$/.exec(pathname) && method === 'GET') {
    const taskId = decodeURIComponent(pathname.split('/').pop()!)
    const tasks = lsGet('tasks', MOCK_TASKS)
    const task = tasks.find((t: MockTask) => t.id === taskId)
    if (task) {
      console.log(`[MockAPI] GET /api/tasks/${taskId} → 200`)
      return jsonResponse(task)
    }
    console.log(`[MockAPI] GET /api/tasks/${taskId} → 404`)
    return new Response(JSON.stringify({ detail: 'Task not found' }), { status: 404 })
  }

  // GET /api/threads
  if (pathname === '/api/threads' && method === 'GET') {
    const mockThreads = [
      {
        id: THREAD_STANDUP_GROUP,
        kind: 'group',
        title: TEAM_STANDUP,
        title_auto: TEAM_STANDUP,
        created_by: 'user',
        created_at: Date.now() - 6 * 3_600_000,
        updated_at: Date.now() - 4 * 3_600_000,
        last_message_at: Date.now() - 4 * 3_600_000,
        archived_at: null,
        participant_count: 4,
        participants: [
          {
            id: 'p1',
            thread_id: THREAD_STANDUP_GROUP,
            agent_id: 'main',
            agent_name: 'Director',
            agent_icon: '🎯',
            agent_color: '#4f46e5',
            role: 'owner',
            is_active: true,
            joined_at: Date.now() - 6 * 3_600_000,
          },
          {
            id: 'p2',
            thread_id: THREAD_STANDUP_GROUP,
            agent_id: 'dev',
            agent_name: 'Developer',
            agent_icon: '💻',
            agent_color: '#10b981',
            role: 'member',
            is_active: true,
            joined_at: Date.now() - 6 * 3_600_000,
          },
          {
            id: 'p3',
            thread_id: THREAD_STANDUP_GROUP,
            agent_id: 'flowy',
            agent_name: 'Flowy',
            agent_icon: '🎨',
            agent_color: '#ec4899',
            role: 'member',
            is_active: true,
            joined_at: Date.now() - 6 * 3_600_000,
          },
          {
            id: 'p4',
            thread_id: THREAD_STANDUP_GROUP,
            agent_id: 'reviewer',
            agent_name: 'Reviewer',
            agent_icon: '🔍',
            agent_color: '#8b5cf6',
            role: 'member',
            is_active: true,
            joined_at: Date.now() - 6 * 3_600_000,
          },
        ],
        settings: {},
      },
    ]
    console.log(`[MockAPI] GET /api/threads → 200 (${mockThreads.length} threads)`)
    return okResponse({ threads: mockThreads, total: mockThreads.length })
  }

  // GET /api/threads/:id
  if (pathname.startsWith('/api/threads/') && method === 'GET' && !pathname.includes('/messages')) {
    const threadId = pathname.split('/')[3]
    console.log(`[MockAPI] GET /api/threads/${threadId} → 200`)
    return okResponse({
      id: threadId,
      kind: 'group',
      title: TEAM_STANDUP,
      participants: [],
      participant_count: 0,
      settings: {},
      created_by: 'user',
      created_at: Date.now(),
      updated_at: Date.now(),
    })
  }

  // GET /api/threads/:id/messages
  if (/^\/api\/threads\/[^/]+\/messages$/.exec(pathname) && method === 'GET') {
    const threadId = pathname.split('/')[3]
    const hour = 3_600_000
    const mockMessages = [
      {
        id: 'msg-1',
        thread_id: threadId,
        role: 'user',
        content: "Morning everyone! Quick standup — what's everyone working on today?",
        agent_id: null,
        agent_name: 'You',
        created_at: Date.now() - 6 * hour,
      },
      {
        id: 'msg-2',
        thread_id: threadId,
        role: 'assistant',
        content:
          "Director here. Coordinating the v1.0 release checklist. Reviewing the roadmap items and making sure we're on track 🎯",
        agent_id: 'main',
        agent_name: 'Director',
        created_at: Date.now() - 6 * hour + 30_000,
      },
      {
        id: 'msg-3',
        thread_id: threadId,
        role: 'assistant',
        content:
          'Finishing up the WebSocket reconnect logic, then moving to auth module. Should have both done by EOD 💻',
        agent_id: 'dev',
        agent_name: 'Developer',
        created_at: Date.now() - 6 * hour + 60_000,
      },
      {
        id: 'msg-4',
        thread_id: threadId,
        role: 'assistant',
        content:
          'Landing page copy rewrite + finishing the onboarding wizard designs. Almost ready for review 🎨',
        agent_id: 'flowy',
        agent_name: 'Flowy',
        created_at: Date.now() - 6 * hour + 90_000,
      },
      {
        id: 'msg-5',
        thread_id: threadId,
        role: 'assistant',
        content:
          'Wrapping up the auth review. Found some good stuff. Will post the summary in #dev 🔍',
        agent_id: 'reviewer',
        agent_name: 'Reviewer',
        created_at: Date.now() - 6 * hour + 120_000,
      },
      {
        id: 'msg-6',
        thread_id: threadId,
        role: 'user',
        content: 'Great! Any blockers?',
        agent_id: null,
        agent_name: 'You',
        created_at: Date.now() - 5 * hour,
      },
      {
        id: 'msg-7',
        thread_id: threadId,
        role: 'assistant',
        content: "No blockers. The backoff algorithm was the tricky part, that's done now. 💻",
        agent_id: 'dev',
        agent_name: 'Developer',
        created_at: Date.now() - 5 * hour + 30_000,
      },
      {
        id: 'msg-8',
        thread_id: threadId,
        role: 'user',
        content: "Let's ship it 🚀",
        agent_id: null,
        agent_name: 'You',
        created_at: Date.now() - 4 * hour,
      },
    ]
    console.log(
      `[MockAPI] GET /api/threads/${threadId}/messages → 200 (${mockMessages.length} messages)`
    )
    return okResponse({ messages: mockMessages, total: mockMessages.length })
  }

  // POST /api/threads (create group thread)
  if (pathname === '/api/threads' && method === 'POST') {
    console.log('[MockAPI] POST /api/threads → 200')
    return okResponse({
      id: 'thread-new-' + Date.now(),
      kind: 'group',
      title: 'New Group',
      title_auto: 'New Group',
      created_by: 'user',
      created_at: Date.now(),
      updated_at: Date.now(),
      last_message_at: null,
      archived_at: null,
      participant_count: 0,
      participants: [],
      settings: {},
    })
  }

  // GET /api/docs/tree
  if (pathname === '/api/docs/tree' && method === 'GET') {
    console.log('[MockAPI] GET /api/docs/tree → 200')
    return okResponse({
      tree: [
        {
          path: 'getting-started.md',
          name: 'Getting Started',
          type: 'file',
          size: 1200,
          modified: Date.now() - 86_400_000,
        },
        {
          path: 'configuration.md',
          name: 'Configuration',
          type: 'file',
          size: 3400,
          modified: Date.now() - 172_800_000,
        },
        {
          path: 'agents/',
          name: 'Agents',
          type: 'directory',
          children: [
            {
              path: 'agents/overview.md',
              name: 'Overview',
              type: 'file',
              size: 2100,
              modified: Date.now() - 259_200_000,
            },
            {
              path: 'agents/rooms.md',
              name: 'Rooms',
              type: 'file',
              size: 1800,
              modified: Date.now() - 345_600_000,
            },
          ],
        },
        {
          path: 'api-reference.md',
          name: 'API Reference',
          type: 'file',
          size: 8900,
          modified: Date.now() - 432_000_000,
        },
      ],
    })
  }

  // GET /api/docs/content
  if (pathname === '/api/docs/content' && method === 'GET') {
    console.log('[MockAPI] GET /api/docs/content → 200')
    return okResponse({
      content:
        '# CrewHub Docs\n\nThis is a demo. Connect your own CrewHub backend to see your actual documentation.',
    })
  }

  // GET /api/session-display-names
  if (pathname === '/api/session-display-names' && method === 'GET') {
    console.log('[MockAPI] GET /api/session-display-names → 200')
    return jsonResponse({ display_names: MOCK_DISPLAY_NAMES })
  }

  // GET /api/session-display-names/:key
  if (/^\/api\/session-display-names\//.exec(pathname) && method === 'GET') {
    const key = decodeURIComponent(pathname.replace('/api/session-display-names/', ''))
    const entry = MOCK_DISPLAY_NAMES.find((d) => d.session_key === key)
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
  if (/^\/api\/projects\/[\w-]+\/files$/.exec(pathname) && method === 'GET') {
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
            {
              name: 'config.json',
              path: 'src/config.json',
              type: 'config',
              extension: '.json',
              size: 256,
            },
          ],
          child_count: 2,
        },
      ],
    })
  }

  // GET /api/projects/:id/files/content
  if (/^\/api\/projects\/[\w-]+\/files\/content/.exec(pathname) && method === 'GET') {
    console.log('[MockAPI] GET /api/projects/:id/files/content → 200')
    return jsonResponse({
      path: 'README.md',
      name: 'README.md',
      type: 'document',
      extension: '.md',
      size: 2048,
      content:
        '# CrewHub\n\n> Multi-agent orchestration platform with 3D visualization\n\n## Features\n\n- 🏢 **3D Room System** — Organize agents into themed rooms\n- 🤖 **Agent Management** — Monitor and control AI agents in real-time\n- 🔄 **Live Updates** — SSE-powered real-time session tracking\n- 🎨 **Customizable** — Themes, layouts, and room configurations\n\n## Getting Started\n\n```bash\nnpm install\nnpm run dev\n```\n',
    })
  }

  // GET /api/sessions/:key/history
  if (/^\/api\/sessions\/.*\/history/.exec(pathname) && method === 'GET') {
    // Extract session key from URL: /api/sessions/{encoded-key}/history
    const match = /^\/api\/sessions\/(.+)\/history/.exec(pathname)
    const sessionKey = match ? decodeURIComponent(match[1]) : ''
    const messages = createMockSessionHistory(sessionKey)
    console.log(
      `[MockAPI] GET /api/sessions/${sessionKey}/history → 200 (${messages.length} messages)`
    )
    return jsonResponse({ messages })
  }

  // GET /api/chat/:key/history
  if (/^\/api\/chat\/.*\/history/.exec(pathname) && method === 'GET') {
    console.log('[MockAPI] GET /api/chat/:key/history → 200')
    return jsonResponse({
      messages: MOCK_CHAT_HISTORY,
      hasMore: false,
      oldestTimestamp: Date.now() - 120000,
    })
  }

  // GET /api/backup/list
  if (pathname === '/api/backup/list' && method === 'GET') {
    console.log('[MockAPI] GET /api/backup/list → 200')
    return jsonResponse([])
  }

  // GET /api/templates
  if (pathname === '/api/templates' && method === 'GET') {
    console.log('[MockAPI] GET /api/templates → 200')
    return jsonResponse({
      templates: [
        { id: 'tpl-1', name: 'Run tests and fix failures', template: 'Run all tests in the project. If any fail, analyze the failure and fix it. Then re-run to confirm.', variables: '[]', project_id: null, is_builtin: true, created_at: Date.now() - 86400000, updated_at: Date.now() - 86400000 },
        { id: 'tpl-2', name: 'Review current branch', template: 'Review all changes on the current git branch. Check for bugs, security issues, and code style.', variables: '[]', project_id: null, is_builtin: true, created_at: Date.now() - 86400000, updated_at: Date.now() - 86400000 },
        { id: 'tpl-3', name: 'Explain this file', template: 'Read and explain the purpose, structure, and key logic of {{file}}.', variables: '["file"]', project_id: null, is_builtin: true, created_at: Date.now() - 86400000, updated_at: Date.now() - 86400000 },
      ],
    })
  }

  // GET /api/pipelines
  if (pathname === '/api/pipelines' && method === 'GET') {
    console.log('[MockAPI] GET /api/pipelines → 200')
    return jsonResponse({
      pipelines: [
        { id: 'pipe-1', name: 'Code → Review → Test', description: 'Write code, then review it, then run tests', steps_json: '[{"agent_id":"dev","prompt_template":"Implement the feature","timeout_seconds":300},{"agent_id":"reviewer","prompt_template":"Review the changes","timeout_seconds":300}]', status: 'draft', current_step: 0, created_at: Date.now() - 172800000, updated_at: Date.now() - 172800000 },
      ],
    })
  }

  // GET /api/pipelines/:id
  if (/^\/api\/pipelines\/[\w-]+$/.exec(pathname) && method === 'GET') {
    console.log('[MockAPI] GET /api/pipelines/:id → 200')
    return jsonResponse({ id: pathname.split('/').pop(), name: 'Code → Review → Test', description: 'Write code, then review it, then run tests', steps_json: '[]', status: 'draft', current_step: 0, created_at: Date.now(), updated_at: Date.now() })
  }

  // GET /api/pipelines/:id/runs
  if (/^\/api\/pipelines\/[\w-]+\/runs$/.exec(pathname) && method === 'GET') {
    console.log('[MockAPI] GET /api/pipelines/:id/runs → 200')
    return jsonResponse({ runs: [] })
  }

  // GET /api/conflicts
  if (pathname === '/api/conflicts' && method === 'GET') {
    console.log('[MockAPI] GET /api/conflicts → 200')
    return jsonResponse({ edits: {} })
  }

  // GET /api/conflicts/:key
  if (/^\/api\/conflicts\//.exec(pathname) && method === 'GET') {
    console.log('[MockAPI] GET /api/conflicts/:key → 200')
    return jsonResponse({ edits: {} })
  }

  // GET /api/notifications/rules
  if (pathname === '/api/notifications/rules' && method === 'GET') {
    console.log('[MockAPI] GET /api/notifications/rules → 200')
    return jsonResponse({
      rules: [
        { id: 'rule-1', agent_id: null, project_id: null, rule_type: 'on_error', config_json: '{}', enabled: true, created_at: Date.now() - 86400000, updated_at: Date.now() - 86400000 },
        { id: 'rule-2', agent_id: null, project_id: null, rule_type: 'on_permission_wait', config_json: '{}', enabled: true, created_at: Date.now() - 86400000, updated_at: Date.now() - 86400000 },
      ],
    })
  }

  // GET /api/chat/:key/info
  if (/^\/api\/chat\/.*\/info$/.exec(pathname) && method === 'GET') {
    const key = decodeURIComponent(pathname.split('/')[3] || '')
    const agentId = key.startsWith('cc:') ? key.slice(3) : key.split(':')[1] || 'main'
    console.log('[MockAPI] GET /api/chat/:key/info → 200')
    return jsonResponse({ canChat: true, agentId, agentName: agentId.charAt(0).toUpperCase() + agentId.slice(1), sessionKey: key, source: 'openclaw' })
  }

  // GET /api/handoff/targets
  if (pathname === '/api/handoff/targets' && method === 'GET') {
    console.log('[MockAPI] GET /api/handoff/targets → 200')
    return jsonResponse({ targets: [{ id: 'clipboard', name: 'Copy to Clipboard', icon: 'clipboard', available: true }] })
  }

  // === MUTATIONS — persist some to localStorage, rest are no-op ===

  // PUT /api/settings/:key
  if (/^\/api\/settings\/[\w-]+$/.exec(pathname) && method === 'PUT') {
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
  if (/^\/api\/session-room-assignments\//.exec(pathname) && method === 'DELETE') {
    console.log('[MockAPI] DELETE /api/session-room-assignments → 200')
    return okResponse()
  }

  // POST /api/rooms
  if (pathname === '/api/rooms' && method === 'POST') {
    console.log('[MockAPI] POST /api/rooms → 200')
    return okResponse()
  }

  // PUT /api/rooms/:id
  if (/^\/api\/rooms\/[\w-]+$/.exec(pathname) && method === 'PUT') {
    console.log('[MockAPI] PUT /api/rooms/:id → 200')
    return okResponse()
  }

  // DELETE /api/rooms/:id
  if (/^\/api\/rooms\/[\w-]+$/.exec(pathname) && method === 'DELETE') {
    console.log('[MockAPI] DELETE /api/rooms/:id → 200')
    return okResponse()
  }

  // PUT /api/rooms/reorder
  if (pathname === '/api/rooms/reorder' && method === 'PUT') {
    console.log('[MockAPI] PUT /api/rooms/reorder → 200')
    return okResponse()
  }

  // POST/PUT/DELETE /api/projects
  if (
    /^\/api\/projects/.exec(pathname) &&
    (method === 'POST' || method === 'PUT' || method === 'DELETE')
  ) {
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

  // POST /api/tasks
  if (pathname === '/api/tasks' && method === 'POST') {
    console.log('[MockAPI] POST /api/tasks → 200')
    return jsonResponse({
      id: 'task-new-' + Date.now(),
      project_id: 'proj-crewhub',
      room_id: null,
      title: 'New Task',
      description: null,
      status: 'todo',
      priority: 'medium',
      assigned_session_key: null,
      assigned_display_name: null,
      created_by: 'user',
      created_at: Date.now(),
      updated_at: Date.now(),
    })
  }

  // PATCH /api/tasks/:id
  if (/^\/api\/tasks\/[\w-]+$/.exec(pathname) && method === 'PATCH') {
    const taskId = decodeURIComponent(pathname.split('/').pop()!)
    const tasks = lsGet('tasks', MOCK_TASKS)
    const task = tasks.find((t: MockTask) => t.id === taskId)
    console.log(`[MockAPI] PATCH /api/tasks/${taskId} → 200`)
    return jsonResponse(task || { id: taskId, updated_at: Date.now() })
  }

  // DELETE /api/tasks/:id
  if (/^\/api\/tasks\/[\w-]+$/.exec(pathname) && method === 'DELETE') {
    console.log(`[MockAPI] DELETE /api/tasks/:id → 200`)
    return okResponse()
  }

  // PUT /api/agents/:id
  if (/^\/api\/agents\/[\w-]+$/.exec(pathname) && method === 'PUT') {
    console.log('[MockAPI] PUT /api/agents/:id → 200')
    return okResponse()
  }

  // POST/PATCH/DELETE /api/connections
  if (/^\/api\/connections/.exec(pathname) && method !== 'GET') {
    console.log(`[MockAPI] ${method} ${pathname} → 200`)
    if (/\/connect$/.exec(pathname)) {
      return jsonResponse({ connected: true })
    }
    return okResponse()
  }

  // POST/DELETE /api/session-display-names
  if (
    /^\/api\/session-display-names\//.exec(pathname) &&
    (method === 'POST' || method === 'DELETE')
  ) {
    console.log(`[MockAPI] ${method} ${pathname} → 200`)
    return okResponse()
  }

  // POST/PUT/DELETE /api/room-assignment-rules
  if (/^\/api\/room-assignment-rules/.exec(pathname) && method !== 'GET') {
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
  if (/^\/api\/chat\/.*\/send$/.exec(pathname) && method === 'POST') {
    console.log('[MockAPI] POST /api/chat/:key/send → 200')
    return jsonResponse({
      success: true,
      response:
        "This is a demo — I can't actually process messages, but in a real CrewHub setup I'd be an AI agent working on your tasks! 🤖",
      tokens: 42,
    })
  }

  // POST /api/backup/*
  if (/^\/api\/backup/.exec(pathname) && method === 'POST') {
    console.log(`[MockAPI] ${method} ${pathname} → 200`)
    return okResponse()
  }

  // POST /api/templates
  if (pathname === '/api/templates' && method === 'POST') {
    console.log('[MockAPI] POST /api/templates → 200')
    return jsonResponse({ id: 'tpl-new-' + Date.now(), success: true })
  }

  // PUT /api/templates/:id
  if (/^\/api\/templates\/[\w-]+$/.exec(pathname) && method === 'PUT') {
    console.log('[MockAPI] PUT /api/templates/:id → 200')
    return jsonResponse({ success: true })
  }

  // DELETE /api/templates/:id
  if (/^\/api\/templates\/[\w-]+$/.exec(pathname) && method === 'DELETE') {
    console.log('[MockAPI] DELETE /api/templates/:id → 200')
    return jsonResponse({ success: true })
  }

  // POST/PUT/DELETE /api/pipelines
  if (/^\/api\/pipelines/.exec(pathname) && method !== 'GET') {
    console.log(`[MockAPI] ${method} ${pathname} → 200`)
    if (method === 'POST' && pathname === '/api/pipelines') {
      return jsonResponse({ id: 'pipe-new-' + Date.now(), success: true })
    }
    if (/\/run$/.exec(pathname)) {
      return jsonResponse({ run_id: 'run-' + Date.now(), status: 'running' })
    }
    return jsonResponse({ success: true })
  }

  // POST/PUT/DELETE /api/notifications/rules
  if (/^\/api\/notifications\/rules/.exec(pathname) && method !== 'GET') {
    console.log(`[MockAPI] ${method} ${pathname} → 200`)
    if (method === 'POST') {
      return jsonResponse({ id: 'rule-new-' + Date.now(), success: true })
    }
    return jsonResponse({ success: true })
  }

  // POST /api/chat/:key/kill
  if (/^\/api\/chat\/.*\/kill$/.exec(pathname) && method === 'POST') {
    console.log('[MockAPI] POST /api/chat/:key/kill → 200')
    return jsonResponse({ success: true, message: 'Session terminated (demo)' })
  }

  // POST /api/agents/:id/clone
  if (/^\/api\/agents\/[\w-]+\/clone$/.exec(pathname) && method === 'POST') {
    const agentId = pathname.split('/')[3]
    console.log(`[MockAPI] POST /api/agents/${agentId}/clone → 200`)
    return jsonResponse({ success: true, agent_id: agentId + '-clone-' + Date.now().toString(36), name: agentId + ' (clone)' })
  }

  // POST /api/tasks/:id/assign
  if (/^\/api\/tasks\/[\w-]+\/assign$/.exec(pathname) && method === 'POST') {
    console.log('[MockAPI] POST /api/tasks/:id/assign → 200')
    return jsonResponse({ success: true, message: 'Task assigned (demo)' })
  }

  // POST /api/chat/:key/stream — handle as non-streaming fallback in demo
  if (/^\/api\/chat\/.*\/stream$/.exec(pathname) && method === 'POST') {
    console.log('[MockAPI] POST /api/chat/:key/stream → 200')
    return new Response(
      'event: start\ndata: {}\n\nevent: delta\ndata: {"text":"This is a demo — I can\'t actually process messages, but in a real CrewHub setup I\'d be an AI agent working on your tasks! 🤖"}\n\nevent: done\ndata: {}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
    )
  }

  // POST /api/chat/:key/permission
  if (/^\/api\/chat\/.*\/permission$/.exec(pathname) && method === 'POST') {
    console.log('[MockAPI] POST /api/chat/:key/permission → 200')
    return jsonResponse({ success: true })
  }

  return null
}
