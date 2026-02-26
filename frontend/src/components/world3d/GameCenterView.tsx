import { GAME_CENTER } from '@/lib/zones'
import { ZoneLandingView } from './ZoneLandingView'

const MVP_ITEMS = [
  { emoji: '🏆', label: 'Crew Leaderboards' },
  { emoji: '⚔️', label: 'Challenge Matches' },
  { emoji: '🎯', label: 'Daily Quests' },
  { emoji: '🪙', label: 'Reward System' },
  { emoji: '📊', label: 'Stats & Rankings' },
]

export function GameCenterView({ className }: { className?: string }) {
  return (
    <ZoneLandingView
      zone={GAME_CENTER}
      mvpItems={MVP_ITEMS}
      className={className}
      hideCenterMarker
    />
  )
}
