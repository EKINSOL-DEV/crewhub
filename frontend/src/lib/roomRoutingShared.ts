export const SHARED_ROOM_KEYWORDS = {
  thinking: ['analyse', 'analysis', 'review', 'design doc', 'architecture', 'research', 'evaluate'],
  dev: ['implement', 'fix', 'bug', 'refactor', 'build', 'deploy', 'code', 'api', 'feature'],
  marketing: ['copy', 'seo', 'newsletter', 'landing page', 'content', 'marketing'],
  creative: ['experiment', 'poc', 'brainstorm', 'try', 'explore', 'design', 'creative', 'art'],
  automation: ['cron', 'schedule', 'reminder', 'timer', 'job'],
  comms: ['email', 'slack', 'whatsapp', 'message', 'notify', 'send'],
  ops: ['deploy', 'docker', 'monitor', 'server', 'devops', 'infrastructure'],
} as const

export function containsAnyKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

const LEGACY_MODEL_ROOM_HINTS: Record<string, string[]> = {
  'dev-room': ['opus', 'claude-opus'],
  'thinking-room': ['gpt5', 'gpt-5'],
}

export function detectLegacyRoomByModel(model: string): string | undefined {
  const normalizedModel = model.toLowerCase()
  for (const [roomId, hints] of Object.entries(LEGACY_MODEL_ROOM_HINTS)) {
    if (hints.some((hint) => normalizedModel.includes(hint))) {
      return roomId
    }
  }
  return undefined
}
