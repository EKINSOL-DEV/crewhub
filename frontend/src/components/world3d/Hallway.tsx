import { useMemo } from 'react'
import { Plant } from './props/Plant'
import { WaterCooler } from './props/WaterCooler'
import { NoticeBoard } from './props/NoticeBoard'

interface HallwayProps {
  /** Room positions to figure out where hallway intersections/corners are */
  roomPositions: { position: [number, number, number] }[]
  roomSize: number
  hallwayWidth: number
  cols: number
  rows: number
  gridOriginX: number
  gridOriginZ: number
}

interface DecorationItem {
  type: 'plant' | 'waterCooler' | 'noticeBoard'
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

/**
 * Hallway decorations placed between rooms.
 * Plants at corners, water cooler mid-hallway, notice board on walls.
 */
export function Hallway({
  roomSize,
  hallwayWidth,
  cols,
  rows,
  gridOriginX,
  gridOriginZ,
}: HallwayProps) {
  const gridSpacing = roomSize + hallwayWidth

  const decorations = useMemo(() => {
    const items: DecorationItem[] = []
    const halfRoom = roomSize / 2

    // Place plants at hallway intersections (where horizontal & vertical hallways cross)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const roomX = gridOriginX + col * gridSpacing
        const roomZ = gridOriginZ + row * gridSpacing

        // Plant at top-right corner of each room (hallway intersection)
        if (col < cols - 1 && row < rows - 1) {
          items.push({
            type: 'plant',
            position: [roomX + halfRoom + hallwayWidth / 2, 0.16, roomZ + halfRoom + hallwayWidth / 2],
            scale: 0.8,
          })
        }

        // Plant at bottom-right corner (for first row)
        if (row === 0 && col < cols - 1) {
          items.push({
            type: 'plant',
            position: [roomX + halfRoom + hallwayWidth / 2, 0.16, roomZ - halfRoom - hallwayWidth / 4],
            scale: 0.7,
          })
        }

        // Water cooler in a horizontal hallway (between rows, near the left side)
        if (row < rows - 1 && col === 0) {
          items.push({
            type: 'waterCooler',
            position: [roomX - halfRoom + 1, 0.16, roomZ + halfRoom + hallwayWidth / 2],
            rotation: [0, Math.PI / 4, 0],
          })
        }

        // Notice board on a room's outer wall (back of first row, facing hallway)
        if (row === 0 && col === Math.floor(cols / 2)) {
          items.push({
            type: 'noticeBoard',
            position: [roomX, 1.2, roomZ - halfRoom - 0.2],
            rotation: [0, 0, 0],
          })
        }
      }
    }

    // Extra plant near entrance area (bottom center)
    items.push({
      type: 'plant',
      position: [gridOriginX + ((cols - 1) * gridSpacing) / 2 - 3.5, 0.16, gridOriginZ + (rows - 1) * gridSpacing + halfRoom + hallwayWidth / 3],
      scale: 1.0,
    })
    items.push({
      type: 'plant',
      position: [gridOriginX + ((cols - 1) * gridSpacing) / 2 + 3.5, 0.16, gridOriginZ + (rows - 1) * gridSpacing + halfRoom + hallwayWidth / 3],
      scale: 1.0,
    })

    return items
  }, [roomSize, hallwayWidth, cols, rows, gridOriginX, gridOriginZ, gridSpacing])

  return (
    <group>
      {decorations.map((item, i) => {
        switch (item.type) {
          case 'plant':
            return <Plant key={i} position={item.position} scale={item.scale} />
          case 'waterCooler':
            return <WaterCooler key={i} position={item.position} rotation={item.rotation} />
          case 'noticeBoard':
            return <NoticeBoard key={i} position={item.position} rotation={item.rotation} />
          default:
            return null
        }
      })}
    </group>
  )
}
