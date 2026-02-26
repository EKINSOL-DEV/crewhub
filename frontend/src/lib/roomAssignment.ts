/**
 * Auto Room Assignment Engine
 * Assigns minions/subagents to appropriate rooms based on task context
 */

export interface KeywordRule {
  room: string
  weight: number
  keywords: string[]
  negativeKeywords?: string[]
}

export interface RoomAssignmentConfig {
  version: number
  defaultRoom: string
  modelRooms: Record<string, string>
  personaRooms: Record<string, string>
  keywordRules: KeywordRule[]
}

export const DEFAULT_ASSIGNMENT_CONFIG: RoomAssignmentConfig = {
  version: 1,
  defaultRoom: 'headquarters',
  modelRooms: {
    opus: 'dev',
    gpt5: 'thinking',
    sonnet: 'headquarters',
  },
  personaRooms: {
    Flowy: 'marketing',
    Builder: 'dev',
  },
  keywordRules: [
    {
      room: 'thinking',
      weight: 15,
      keywords: [
        'analyse',
        'analysis',
        'analyze',
        'research',
        'onderzoek',
        'review',
        'code review',
        'design doc',
        'design document',
        'architecture',
        'architectuur',
        'evaluate',
        'evaluatie',
        'trade-off',
        'pros cons',
        'alternative',
        'alternatieven',
        'business case',
        'functionele analyse',
        'technische analyse',
      ],
      negativeKeywords: ['implement', 'fix', 'build'],
    },
    {
      room: 'dev',
      weight: 15,
      keywords: [
        'implement',
        'implementeer',
        'bug',
        'fix',
        'debug',
        'refactor',
        'refactoring',
        'api',
        'endpoint',
        'database',
        'sql',
        'query',
        'docker',
        'container',
        'test',
        'tests',
        'testing',
        'build',
        'compile',
        'deploy',
        'deployment',
        'code',
        'programming',
        'feature',
        'functionaliteit',
      ],
      negativeKeywords: ['review', 'analyze'],
    },
    {
      room: 'marketing',
      weight: 15,
      keywords: [
        'copy',
        'copywriting',
        'seo',
        'search engine',
        'newsletter',
        'nieuwsbrief',
        'landing page',
        'advertentie',
        'advertisement',
        'ad',
        'social post',
        'social media',
        'content',
        'blog post',
        'tone of voice',
        'marketing campaign',
      ],
    },
    {
      room: 'creative',
      weight: 15,
      keywords: [
        'design',
        'ontwerp',
        'brainstorm',
        'ideeën',
        'creative',
        'creatief',
        'art',
        'kunst',
        'experiment',
        'experimenteer',
        'poc',
        'proof of concept',
        'prototype',
        'mockup',
        'explore',
        'exploreer',
      ],
    },
    {
      room: 'automation',
      weight: 15,
      keywords: [
        'cron',
        'cronjob',
        'schedule',
        'scheduled',
        'reminder',
        'herinnering',
        'timer',
        'timeout',
        'job',
        'batch',
        'recurring',
        'periodic',
        'automate',
        'automation',
      ],
    },
    {
      room: 'comms',
      weight: 15,
      keywords: [
        'email',
        'mail',
        'slack',
        'discord',
        'whatsapp',
        'telegram',
        'message',
        'bericht',
        'notify',
        'notification',
        'send',
        'stuur',
        'communication',
        'communicatie',
        'sms',
        'chat',
      ],
    },
    {
      room: 'ops',
      weight: 15,
      keywords: [
        'deploy',
        'deployment',
        'docker',
        'container',
        'monitor',
        'monitoring',
        'server',
        'host',
        'devops',
        'operations',
        'infrastructure',
        'infra',
        'kubernetes',
        'k8s',
        'ci/cd',
        'pipeline',
        'logs',
        'metrics',
      ],
    },
  ],
}

export interface AssignmentTrace {
  explicit?: string
  persona?: { name: string; room: string }
  model?: { alias: string; room: string }
  keywords?: { room: string; score: number; matches: string[] }[]
  finalRoom: string
  reason: string
}

export interface AssignmentInput {
  explicitRoom?: string
  taskTitle?: string
  taskDescription?: string
  taskLabels?: string[]
  persona?: string
  model?: string
}

export function assignRoom(
  input: AssignmentInput,
  config: RoomAssignmentConfig = DEFAULT_ASSIGNMENT_CONFIG
): { room: string; trace: AssignmentTrace } {
  const trace: AssignmentTrace = {
    finalRoom: config.defaultRoom,
    reason: 'No matching rules, using default',
  }

  if (input.explicitRoom) {
    trace.explicit = input.explicitRoom
    trace.finalRoom = input.explicitRoom
    trace.reason = 'Explicit room parameter'
    return { room: input.explicitRoom, trace }
  }

  if (input.persona && config.personaRooms[input.persona]) {
    const room = config.personaRooms[input.persona]
    trace.persona = { name: input.persona, room }
    trace.finalRoom = room
    trace.reason = `Persona '${input.persona}' default room`
    return { room, trace }
  }

  const keywordScores = scoreKeywords(input, config.keywordRules)
  if (keywordScores.length > 0) {
    const topScore = keywordScores[0]
    if (topScore.score > 0) {
      trace.keywords = keywordScores
      trace.finalRoom = topScore.room
      trace.reason = `Keywords matched (score: ${topScore.score})`
      return { room: topScore.room, trace }
    }
  }

  if (input.model && config.modelRooms[input.model]) {
    const room = config.modelRooms[input.model]
    trace.model = { alias: input.model, room }
    trace.finalRoom = room
    trace.reason = `Model '${input.model}' default room`
    return { room, trace }
  }

  trace.finalRoom = config.defaultRoom
  trace.reason = 'No matches, using default fallback'
  return { room: config.defaultRoom, trace }
}

const ROOM_PRIORITY: Record<string, number> = {
  thinking: 8,
  dev: 7,
  ops: 6,
  automation: 5,
  comms: 4,
  marketing: 3,
  creative: 2,
  headquarters: 1,
}

function scoreRule(text: string, rule: KeywordRule): { score: number; matches: string[] } {
  let score = 0
  const matches: string[] = []

  for (const keyword of rule.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      score += rule.weight
      matches.push(keyword)
    }
  }

  if (rule.negativeKeywords) {
    for (const negKeyword of rule.negativeKeywords) {
      if (text.includes(negKeyword.toLowerCase())) {
        score -= rule.weight * 0.5
      }
    }
  }

  return { score, matches }
}

function scoreKeywords(
  input: AssignmentInput,
  rules: KeywordRule[]
): { room: string; score: number; matches: string[] }[] {
  const text = [input.taskTitle || '', input.taskDescription || '', ...(input.taskLabels || [])]
    .join(' ')
    .toLowerCase()

  if (!text.trim()) return []

  const roomScores: Record<string, { score: number; matches: string[] }> = {}

  for (const rule of rules) {
    const { score, matches } = scoreRule(text, rule)
    if (score > 0) {
      if (!roomScores[rule.room]) roomScores[rule.room] = { score: 0, matches: [] }
      roomScores[rule.room].score += score
      roomScores[rule.room].matches.push(...matches)
    }
  }

  return Object.entries(roomScores)
    .map(([room, data]) => ({ room, score: data.score, matches: data.matches }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (ROOM_PRIORITY[b.room] || 0) - (ROOM_PRIORITY[a.room] || 0)
    })
}
