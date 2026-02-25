import { ACADEMY } from '@/lib/zones'
import { ZoneLandingView } from './ZoneLandingView'

const MVP_ITEMS = [
  { emoji: '📖', label: 'Guided Tutorials' },
  { emoji: '🎓', label: 'Skill Tracks' },
  { emoji: '🧪', label: 'Interactive Labs' },
  { emoji: '📝', label: 'Progress Tracking' },
  { emoji: '🏅', label: 'Certificates' },
]

export function AcademyView({ className }: { className?: string }) {
  return (
    <ZoneLandingView zone={ACADEMY} mvpItems={MVP_ITEMS} className={className} hideCenterMarker />
  )
}
