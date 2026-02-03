import { useMemo } from 'react'
import * as THREE from 'three'
import { useToonMaterialProps, WARM_COLORS } from './utils/toonMaterials'

interface RoomFloorProps {
  color?: string
  size?: number // units (default 12)
}

/**
 * Procedural floor using box tiles arranged in a grid.
 * Slightly varied heights and color shades give a stone/tile appearance.
 */
export function RoomFloor({ color, size = 12 }: RoomFloorProps) {
  const baseColor = color || WARM_COLORS.stone
  const toonProps = useToonMaterialProps(baseColor)

  // Pre-compute tile data
  const tiles = useMemo(() => {
    const tileSize = 1.0
    const gap = 0.05
    const count = Math.floor(size / (tileSize + gap))
    const offset = (count * (tileSize + gap) - gap) / 2
    const data: Array<{
      key: string
      x: number
      z: number
      height: number
      color: string
    }> = []

    // Seeded-ish random for determinism
    const seededRand = (i: number, j: number) => {
      const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
      return n - Math.floor(n)
    }

    for (let i = 0; i < count; i++) {
      for (let j = 0; j < count; j++) {
        const rand = seededRand(i, j)
        const height = 0.08 + rand * 0.06
        // Slightly vary color brightness
        const hsl = new THREE.Color(baseColor)
        const hslObj = { h: 0, s: 0, l: 0 }
        hsl.getHSL(hslObj)
        hslObj.l = Math.max(0.15, Math.min(0.85, hslObj.l + (rand - 0.5) * 0.08))
        const tileColor = new THREE.Color().setHSL(hslObj.h, hslObj.s, hslObj.l)

        data.push({
          key: `${i}-${j}`,
          x: i * (tileSize + gap) - offset + tileSize / 2,
          z: j * (tileSize + gap) - offset + tileSize / 2,
          height,
          color: `#${tileColor.getHexString()}`,
        })
      }
    }
    return { data, tileSize }
  }, [baseColor, size])

  const baseToonProps = useToonMaterialProps(WARM_COLORS.stoneDark)

  return (
    <group>
      {/* Solid base slab under tiles to prevent clipping with grass */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[size + 0.5, 0.3, size + 0.5]} />
        <meshToonMaterial {...baseToonProps} />
      </mesh>
      {/* Individual tiles raised above base */}
      {tiles.data.map((tile) => (
        <mesh
          key={tile.key}
          position={[tile.x, 0.1 + tile.height / 2, tile.z]}
          receiveShadow
        >
          <boxGeometry args={[tiles.tileSize, tile.height, tiles.tileSize]} />
          <meshToonMaterial {...toonProps} color={tile.color} />
        </mesh>
      ))}
    </group>
  )
}
