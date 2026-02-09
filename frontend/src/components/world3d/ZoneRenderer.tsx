/**
 * ZoneRenderer — Conditionally renders the correct scene based on activeZone.
 *
 * Phase 2: Supports 4 built-in zones with stub landing views for non-campus zones.
 */
import { useZoneContext as useZone } from '@/contexts/ZoneContext'
import { World3DView } from './World3DView'
import { CreatorCenterView } from './CreatorCenterView'
import { GameCenterView } from './GameCenterView'
import { AcademyView } from './AcademyView'
import type { CrewSession } from '@/lib/api'
import type { SessionsSettings } from '@/components/sessions/SettingsPanel'

interface ZoneRendererProps {
  sessions: CrewSession[]
  settings: SessionsSettings
  onAliasChanged?: () => void
}

export function ZoneRenderer({ sessions, settings, onAliasChanged }: ZoneRendererProps) {
  const { activeZone, isTransitioning } = useZone()

  // Transition overlay
  if (isTransitioning) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <span className="text-gray-400 text-sm">Switching zones…</span>
      </div>
    )
  }

  switch (activeZone.id) {
    case 'main-campus':
      return (
        <World3DView
          sessions={sessions}
          settings={settings}
          onAliasChanged={onAliasChanged}
        />
      )
    case 'creator-center':
      return <CreatorCenterView />
    case 'game-center':
      return <GameCenterView />
    case 'academy':
      return <AcademyView />
    default:
      return (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-red-500">Unknown zone: {activeZone.id}</span>
        </div>
      )
  }
}
