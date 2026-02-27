import { Wall } from '../WallSystem'
import { Workstation, MeetingTable, Sofa, CoffeeTable, Plant, TallPlant, Floor, HangingLight, Pillar, ServerRack, Whiteboard, GlassPanel, Rug } from '../Props'

/**
 * THE PAVILIONS - Inspired by Google Campus / Renzo Piano
 *
 * A campus of connected pavilions at varying heights, linked by enclosed
 * sky bridges. Each pavilion has a distinct character and purpose.
 * The layout creates sheltered courtyards between buildings.
 *
 * Architectural features:
 * - 4 distinct pavilions of different sizes and heights
 * - Enclosed sky bridges connecting upper floors
 * - Central courtyard with landscaping
 * - Varied roof forms: flat, angled, butterfly
 * - Each building has unique materiality
 */

function SkyBridge({ from, to, height, width = 1.5 }: Readonly<{
  readonly from: [number, number, number], to: [number, number, number], height: number, width?: number
}>) {
  const dx = to[0] - from[0], dz = to[2] - from[2]
  const len = Math.hypot(dx, dz)
  const mx = (from[0] + to[0]) / 2, mz = (from[2] + to[2]) / 2
  const angle = Math.atan2(dz, dx)

  return (
    <group position={[mx, height, mz]} rotation={[0, -angle + Math.PI / 2, 0]}>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, len]} />
        <meshStandardMaterial color="#2d3040" />
      </mesh>
      {/* Glass walls */}
      <GlassPanel position={[width / 2, 1.2, 0]} rotation={[0, Math.PI / 2, 0]} size={[len, 2.4]} />
      <GlassPanel position={[-width / 2, 1.2, 0]} rotation={[0, Math.PI / 2, 0]} size={[len, 2.4]} />
      {/* Roof */}
      <mesh position={[0, 2.4, 0]}>
        <boxGeometry args={[width + 0.2, 0.08, len + 0.2]} />
        <meshStandardMaterial color="#3a3d4a" metalness={0.3} />
      </mesh>
    </group>
  )
}

function Pavilion({
  position, size, floors, color, roofType = 'flat', children
}: Readonly<{
  readonly position: [number, number, number]
  readonly size: [number, number] // width, depth
  readonly floors: number
  readonly color: string
  readonly roofType?: 'flat' | 'angled' | 'butterfly'
  readonly children?: React.ReactNode
}>) {
  const floorH = 3
  const [w, d] = size

  return (
    <group position={position}>
      {Array.from({ length: floors }).map((_, fi) => {
        const y = fi * floorH
        return (
          <group key={`floor-${y}`} position={[0, y, 0]}>
            {/* Floor */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[w, d]} />
              <meshStandardMaterial color="#2a2d3a" />
            </mesh>
            {/* Walls */}
            <Wall color={color} position={[0, floorH / 2, d / 2]}><boxGeometry args={[w, floorH, 0.12]} /></Wall>
            <Wall color={color} position={[0, floorH / 2, -d / 2]}><boxGeometry args={[w, floorH, 0.12]} /></Wall>
            <Wall color={color} opacity={0.9} position={[w / 2, floorH / 2, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[d, floorH, 0.12]} /></Wall>
            <Wall color={color} opacity={0.9} position={[-w / 2, floorH / 2, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[d, floorH, 0.12]} /></Wall>
          </group>
        )
      })}

      {/* Roof */}
      {roofType === 'flat' && (
        <mesh position={[0, floors * floorH, 0]}>
          <boxGeometry args={[w + 0.6, 0.12, d + 0.6]} />
          <meshStandardMaterial color="#3a3d4a" metalness={0.3} />
        </mesh>
      )}
      {roofType === 'angled' && (
        <group position={[0, floors * floorH, 0]}>
          <mesh rotation={[0, 0, -0.15]}>
            <boxGeometry args={[w + 0.8, 0.1, d + 0.6]} />
            <meshStandardMaterial color="#3a3d4a" metalness={0.3} />
          </mesh>
        </group>
      )}
      {roofType === 'butterfly' && (
        <group position={[0, floors * floorH, 0]}>
          <mesh position={[-w / 4, 0.3, 0]} rotation={[0, 0, 0.12]}>
            <boxGeometry args={[w / 2 + 0.3, 0.08, d + 0.6]} />
            <meshStandardMaterial color="#3a3d4a" metalness={0.3} />
          </mesh>
          <mesh position={[w / 4, 0.3, 0]} rotation={[0, 0, -0.12]}>
            <boxGeometry args={[w / 2 + 0.3, 0.08, d + 0.6]} />
            <meshStandardMaterial color="#3a3d4a" metalness={0.3} />
          </mesh>
        </group>
      )}

      {/* Pillars */}
      {[
        [-w / 2 + 0.3, d / 2 - 0.3], [w / 2 - 0.3, d / 2 - 0.3],
        [-w / 2 + 0.3, -d / 2 + 0.3], [w / 2 - 0.3, -d / 2 + 0.3]
      ].map(([px, pz], i) => (
        <Pillar key={`pillar-${px}-${pz}`} position={[px, 0, pz]} height={floors * floorH} radius={0.1} />
      ))}

      {children}
    </group>
  )
}

export function ThePavilions() {
  return (
    <group>
      <Floor size={[30, 30]} color="#1e2430" />

      {/* ═══ PAVILION A: Main Office (largest, 2 floors) ═══ */}
      <Pavilion position={[-5, 0, -4]} size={[7, 5]} floors={2} color="#6a7a8a" roofType="flat">
        {/* Ground floor */}
        <Workstation position={[-2, 0, -1]} />
        <Workstation position={[0, 0, -1]} />
        <Workstation position={[2, 0, -1]} />
        <Workstation position={[-2, 0, 1]} rotation={[0, Math.PI, 0]} />
        <Workstation position={[0, 0, 1]} rotation={[0, Math.PI, 0]} />
        <Workstation position={[2, 0, 1]} rotation={[0, Math.PI, 0]} />
        <HangingLight position={[-1, 2.9, 0]} />
        <HangingLight position={[1, 2.9, 0]} />

        {/* Upper floor */}
        <Workstation position={[-2, 3, -1]} />
        <Workstation position={[0, 3, -1]} />
        <Workstation position={[2, 3, -1]} />
        <Sofa position={[0, 3, 1.5]} color="#3a4a5a" />
        <HangingLight position={[0, 5.9, 0]} />
      </Pavilion>

      {/* ═══ PAVILION B: Creative Hub (1 floor, tall ceiling) ═══ */}
      <Pavilion position={[4, 0, -3]} size={[5, 5]} floors={1} color="#7a6a5a" roofType="butterfly">
        <MeetingTable position={[0, 0, 0]} seats={8} />
        <Whiteboard position={[-2.3, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
        <Whiteboard position={[2.3, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
        <Plant position={[1.8, 0, 1.8]} variant={0} />
        <Plant position={[-1.8, 0, 1.8]} variant={1} />
        <HangingLight position={[0, 2.9, 0]} color="#ffccaa" />
      </Pavilion>

      {/* ═══ PAVILION C: Tech Lab (2 floors, compact) ═══ */}
      <Pavilion position={[5, 0, 4]} size={[4, 4]} floors={2} color="#5a6a7a" roofType="angled">
        {/* Server room ground floor */}
        <ServerRack position={[-1, 0, -1]} />
        <ServerRack position={[0, 0, -1]} />
        <ServerRack position={[1, 0, -1]} />
        <Workstation position={[0, 0, 1]} rotation={[0, Math.PI, 0]} />

        {/* Upper floor - dev space */}
        <Workstation position={[-0.8, 3, -0.5]} />
        <Workstation position={[0.8, 3, -0.5]} />
        <Plant position={[0, 3, 1.2]} variant={2} />
        <HangingLight position={[0, 5.9, 0]} color="#aaddff" />
      </Pavilion>

      {/* ═══ PAVILION D: Lounge / Social (1 floor, wide) ═══ */}
      <Pavilion position={[-4, 0, 5]} size={[6, 4]} floors={1} color="#6a8a7a" roofType="flat">
        <Sofa position={[-1.5, 0, -0.5]} rotation={[0, 0, 0]} color="#4a3728" />
        <Sofa position={[1.5, 0, -0.5]} rotation={[0, 0, 0]} color="#4a3728" />
        <CoffeeTable position={[0, 0, -0.5]} />
        <Sofa position={[0, 0, 1]} rotation={[0, Math.PI, 0]} color="#4a3728" />
        <Rug position={[0, 0, 0.2]} size={[4, 3]} color="#3a2a3a" />
        <Plant position={[2.5, 0, 1.5]} variant={3} />
        <Plant position={[-2.5, 0, 1.5]} variant={0} />
        <HangingLight position={[-1, 2.9, 0]} color="#ffddaa" />
        <HangingLight position={[1, 2.9, 0]} color="#ffddaa" />
      </Pavilion>

      {/* ═══ SKY BRIDGES ═══ */}
      {/* A to B */}
      <SkyBridge from={[-1.5, 0, -4]} to={[1.5, 0, -3]} height={3} />
      {/* B to C */}
      <SkyBridge from={[4, 0, -0.5]} to={[5, 0, 2]} height={3} />
      {/* A to D */}
      <SkyBridge from={[-5, 0, -1.5]} to={[-4, 0, 3]} height={3} />

      {/* ═══ COURTYARDS ═══ */}
      {/* Central courtyard */}
      <mesh position={[0, 0.01, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.5, 24]} />
        <meshStandardMaterial color="#2a4a2a" roughness={0.95} />
      </mesh>

      <TallPlant position={[0, 0, 0.5]} />
      <TallPlant position={[-1, 0, 2]} />
      <TallPlant position={[1.2, 0, 1.8]} />
      <Plant position={[0.5, 0, -0.5]} variant={1} scale={0.9} />
      <Plant position={[-0.8, 0, 1]} variant={2} scale={0.9} />

      {/* Pathway stones */}
      {[[-2, 0.02, -1], [-1, 0.02, 0], [0, 0.02, 0.5], [1, 0.02, 1.5], [2, 0.02, 2.5]].map((p, i) => (
        <mesh key={JSON.stringify(p)} position={p as [number, number, number]} rotation={[-Math.PI / 2, Math.random(), 0]}>
          <circleGeometry args={[0.3 + Math.random() * 0.15, 6]} />
          <meshStandardMaterial color="#3a3d4a" roughness={0.8} />
        </mesh>
      ))}

      {/* Bench in courtyard */}
      <mesh position={[-1.5, 0.3, 0.5]}>
        <boxGeometry args={[1.5, 0.06, 0.4]} />
        <meshStandardMaterial color="#6B5B45" roughness={0.6} />
      </mesh>
      <Pillar position={[-2, 0, 0.5]} height={0.3} radius={0.04} color="#555" />
      <Pillar position={[-1, 0, 0.5]} height={0.3} radius={0.04} color="#555" />
    </group>
  )
}
