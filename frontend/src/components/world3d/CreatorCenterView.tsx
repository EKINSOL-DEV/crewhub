import { CREATOR_CENTER } from '@/lib/zones'
import { ZoneLandingView } from './ZoneLandingView'

const MVP_ITEMS = [
  { emoji: '🖌️', label: 'Asset Library' },
  { emoji: '🏗️', label: 'Room Builder' },
  { emoji: '🎭', label: 'Prop Designer' },
  { emoji: '🌍', label: 'Environment Editor' },
  { emoji: '📤', label: 'Share & Export' },
]

interface CreatorCenterViewProps {
  className?: string
}

export function CreatorCenterView({ className }: CreatorCenterViewProps) {
  return (
    <ZoneLandingView
      zone={CREATOR_CENTER}
      mvpItems={MVP_ITEMS}
      className={className}
      hideCenterMarker
    />
  )
}
