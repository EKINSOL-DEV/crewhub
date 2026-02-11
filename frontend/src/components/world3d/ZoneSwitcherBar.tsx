/**
 * ZoneSwitcherBar — Standalone zone switcher shown in non-main-campus zones.
 * Main Campus uses the full RoomTabsBar which includes its own zone switcher.
 */
import { zoneRegistry } from '@/lib/zones'
import { useZone } from '@/hooks/useZone'

export function ZoneSwitcherBar() {
  const { activeZone, switchZone, isTransitioning } = useZone()
  const zones = zoneRegistry.getAll()

  if (zones.length <= 1) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 15,
        display: 'flex',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(200,200,200,0.4)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <select
          value={activeZone.id}
          onChange={(e) => switchZone(e.target.value)}
          disabled={isTransitioning}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 28px 5px 12px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            color: '#374151',
            background: 'rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui, sans-serif',
            opacity: isTransitioning ? 0.5 : 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
        >
          {zones.map(z => {
            let label = ''
            if (z.id === 'creator-center') label = ' [ALPHA PREVIEW]'
            if (z.id === 'game-center' || z.id === 'academy') label = ' [PLANNED]'
            return (
              <option key={z.id} value={z.id}>
                {z.icon} {z.name}{label}
              </option>
            )
          })}
        </select>
        <span style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 10,
          color: '#9ca3af',
          pointerEvents: 'none',
        }}>▼</span>
      </div>
    </div>
  )
}
