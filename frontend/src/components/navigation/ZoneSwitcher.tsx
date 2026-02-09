import { zoneRegistry } from '@/lib/zones'
import { useZone } from '@/hooks/useZone'

export function ZoneSwitcher() {
  const { activeZone, switchZone, isTransitioning } = useZone()
  const zones = zoneRegistry.getAll()

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Zone</span>
      <select
        className="h-8 rounded-md border bg-background px-2"
        value={activeZone.id}
        onChange={(e) => switchZone(e.target.value)}
        disabled={isTransitioning}
      >
        {zones.map(z => (
          <option key={z.id} value={z.id}>
            {z.icon} {z.name}
          </option>
        ))}
      </select>
    </label>
  )
}
