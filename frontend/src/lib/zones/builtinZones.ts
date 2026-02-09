import type { Zone } from './types'

export const MAIN_CAMPUS: Zone = {
  id: 'main-campus',
  name: 'Main Campus',
  icon: '🏢',
  environment: 'builtin:grass',
  colorPrimary: '#4A90D9',
  layout: 'campus',
  defaultSpawnPoint: [0, 0, 20],
  isDefault: true,
  description: 'Your crew headquarters — sessions, tasks, and team overview.',
  features: { hasTaskBoard: true, hasChat: true },
}

export const CREATOR_CENTER: Zone = {
  id: 'creator-center',
  name: 'Creator Center',
  icon: '🎨',
  environment: 'builtin:floating',
  colorPrimary: '#9B59B6',
  layout: 'hub-spoke',
  defaultSpawnPoint: [0, 0, 0],
  description: 'Create, remix, and share assets for your crew worlds.',
  features: { hasAssetLibrary: true, hasStreaming: true },
}

export const GAME_CENTER: Zone = {
  id: 'game-center',
  name: 'Game Center',
  icon: '🎮',
  environment: 'builtin:grass',
  colorPrimary: '#E67E22',
  layout: 'arena',
  defaultSpawnPoint: [0, 0, 0],
  description: 'Compete, climb leaderboards, and join crew challenges.',
  features: { hasLeaderboard: true, hasChat: true },
}

export const ACADEMY: Zone = {
  id: 'academy',
  name: 'Academy',
  icon: '📚',
  environment: 'builtin:grass',
  colorPrimary: '#27AE60',
  layout: 'classroom',
  defaultSpawnPoint: [0, 0, 0],
  description: 'Learn new skills with guided courses and tutorials.',
  features: { hasCourses: true },
}

export const BUILTIN_ZONES: Zone[] = [MAIN_CAMPUS, CREATOR_CENTER, GAME_CENTER, ACADEMY]
