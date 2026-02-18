/**
 * Hallway floor lines — minimal for radial layout.
 * The main hallway paths are rendered by Hallway.tsx.
 * This component is kept for API compatibility but renders nothing in radial mode.
 */
export function HallwayFloorLines(_props: {
  roomSize: number
  hallwayWidth: number
  cols: number
  rows: number
  gridOriginX: number
  gridOriginZ: number
}) {
  // Radial layout: hallway floor lines handled by Hallway.tsx paths
  return null
}
