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
import { ZoneSwitcherBar } from './ZoneSwitcherBar'
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
      <div className="flex-1 flex items-center justify-center bg-white relative">
        <span className="text-gray-400 text-sm">Switching zones…</span>
        <ZoneSwitcherBar />
      </div>
    )
  }

  // Main Campus renders its own RoomTabsBar (which includes the zone switcher)
  // Other zones get the standalone ZoneSwitcherBar
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
      return (
        <div className="relative flex-1 flex flex-col overflow-hidden">
          <CreatorCenterView />
          <ZoneSwitcherBar />
        </div>
      )
    case 'game-center':
      return (
        <div className="relative flex-1 flex flex-col overflow-hidden">
          <GameCenterView />
          <ZoneSwitcherBar />
        </div>
      )
    case 'academy':
      return (
        <div className="relative flex-1 flex flex-col overflow-hidden">
          <AcademyView />
          <ZoneSwitcherBar />
        </div>
      )
    default:
      return (
        <div className="relative flex-1 flex items-center justify-center">
          <span className="text-red-500">Unknown zone: {activeZone.id}</span>
          <ZoneSwitcherBar />
        </div>
      )
  }
}
