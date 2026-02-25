import { Wall } from '../WallSystem'
import { Workstation, MeetingTable, ServerRack, Whiteboard, Plant, TallPlant, Floor, Sofa, CoffeeTable, HangingLight, Pillar, Stairs } from '../Props'

/**
 * THE CANTILEVER - Inspired by OMA / Rem Koolhaas / CCTV HQ Beijing
 *
 * Dramatic architecture with bold cantilevered volumes. Two towers connected
 * by a massive bridging volume at the top, creating a gateway form. The
 * lower sections feature angular, jutting conference rooms and a public atrium.
 *
 * Architectural features:
 * - Two offset towers with different heights
 * - Dramatic bridge/cantilever connecting them at top
 * - Angular protruding meeting pods
 * - Ground-level atrium with double-height ceiling
 * - Exposed structural cross-bracing
 */

function CrossBrace({ p1, p2, color = '#667788' }: { p1: [number, number, number], p2: [number, number, number], color?: string }) {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1], dz = p2[2] - p1[2]
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, mz = (p1[2] + p2[2]) / 2
  const rotZ = -Math.atan2(dx, dy)
  const rotX = Math.atan2(dz, Math.sqrt(dx * dx + dy * dy))
  return (
    <mesh position={[mx, my, mz]} rotation={[rotX, 0, rotZ]}>
      <boxGeometry args={[0.08, len, 0.08]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
    </mesh>
  )
}

export function TheCantilever() {
  const floorH = 3.2

  return (
    <group>
      <Floor size={[24, 24]} color="#1e2430" />

      {/* ═══ LEFT TOWER (taller) ═══ */}
      {[0, 1, 2, 3].map(floor => {
        const y = floor * floorH
        const w = 5, d = 4
        return (
          <group key={`lt-${floor}`} position={[-4, y, 0]}>
            {/* Floor slab */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[w + 0.4, d + 0.4]} />
              <meshStandardMaterial color="#2a2d3a" />
            </mesh>
            {/* Walls */}
            <Wall color="#6a7a8a" position={[0, floorH / 2, d / 2]}><boxGeometry args={[w, floorH, 0.12]} /></Wall>
            <Wall color="#6a7a8a" position={[0, floorH / 2, -d / 2]}><boxGeometry args={[w, floorH, 0.12]} /></Wall>
            <Wall color="#5a6a7a" position={[w / 2, floorH / 2, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[d, floorH, 0.12]} /></Wall>
            <Wall color="#5a6a7a" position={[-w / 2, floorH / 2, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[d, floorH, 0.12]} /></Wall>

            {/* Interior */}
            <Workstation position={[-1, 0, -0.8]} />
            <Workstation position={[1, 0, -0.8]} />
            {floor === 0 && <TallPlant position={[-2, 0, 1.2]} />}
            {floor === 1 && <Whiteboard position={[0, 0, -1.85]} />}
            {floor === 2 && <ServerRack position={[-1.8, 0, 0]} rotation={[0, Math.PI / 2, 0]} />}
          </group>
        )
      })}
      {/* Left tower roof */}
      <mesh position={[-4, 4 * floorH, 0]}>
        <boxGeometry args={[5.4, 0.15, 4.4]} />
        <meshStandardMaterial color="#3a3d4a" metalness={0.3} />
      </mesh>

      {/* ═══ RIGHT TOWER (shorter) ═══ */}
      {[0, 1, 2].map(floor => {
        const y = floor * floorH
        const w = 4.5, d = 4.5
        return (
          <group key={`rt-${floor}`} position={[4.5, y, 0]}>
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[w + 0.4, d + 0.4]} />
              <meshStandardMaterial color="#2a2d3a" />
            </mesh>
            <Wall color="#6a7a8a" position={[0, floorH / 2, d / 2]}><boxGeometry args={[w, floorH, 0.12]} /></Wall>
            <Wall color="#6a7a8a" position={[0, floorH / 2, -d / 2]}><boxGeometry args={[w, floorH, 0.12]} /></Wall>
            <Wall color="#5a6a7a" position={[w / 2, floorH / 2, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[d, floorH, 0.12]} /></Wall>
            <Wall color="#5a6a7a" position={[-w / 2, floorH / 2, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[d, floorH, 0.12]} /></Wall>

            <Workstation position={[0, 0, -0.5]} />
            {floor === 0 && <MeetingTable position={[0, 0, 0.8]} seats={4} />}
            {floor === 1 && <Sofa position={[0, 0, 1]} />}
          </group>
        )
      })}
      <mesh position={[4.5, 3 * floorH, 0]}>
        <boxGeometry args={[4.9, 0.15, 4.9]} />
        <meshStandardMaterial color="#3a3d4a" metalness={0.3} />
      </mesh>

      {/* ═══ BRIDGE / CANTILEVER ═══ */}
      {/* The dramatic connecting bridge at top level */}
      <group position={[0.25, 2.5 * floorH, 0]}>
        {/* Bridge floor */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 5]} />
          <meshStandardMaterial color="#2d3040" />
        </mesh>
        {/* Bridge walls */}
        <Wall color="#7a8a9a" position={[0, floorH / 2, 2.5]}><boxGeometry args={[10, floorH, 0.12]} /></Wall>
        <Wall color="#7a8a9a" position={[0, floorH / 2, -2.5]}><boxGeometry args={[10, floorH, 0.12]} /></Wall>
        {/* Bridge ceiling */}
        <mesh position={[0, floorH, 0]}>
          <boxGeometry args={[10.2, 0.12, 5.2]} />
          <meshStandardMaterial color="#3a3d4a" />
        </mesh>
        {/* Bridge interior - executive lounge */}
        <Sofa position={[-2, 0, 0]} rotation={[0, Math.PI / 2, 0]} color="#3a4a5a" />
        <CoffeeTable position={[-1.2, 0, 0]} />
        <Workstation position={[2.5, 0, -1]} />
        <HangingLight position={[-1, floorH - 0.1, 0]} />
        <HangingLight position={[2, floorH - 0.1, 0]} />
      </group>

      {/* ═══ ANGULAR MEETING POD (cantilevered) ═══ */}
      {/* Jutting out from left tower, floor 1 */}
      <group position={[-4, floorH, 3.5]} rotation={[0, 0.15, 0]}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3, 2.5]} />
          <meshStandardMaterial color="#2d3040" />
        </mesh>
        <Wall color="#8899aa" opacity={0.7} position={[0, 1.5, 1.25]}><boxGeometry args={[3, 3, 0.1]} /></Wall>
        <Wall color="#8899aa" opacity={0.7} position={[1.5, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[2.5, 3, 0.1]} /></Wall>
        <Wall color="#8899aa" opacity={0.7} position={[-1.5, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[2.5, 3, 0.1]} /></Wall>
        <mesh position={[0, 3, 0]}>
          <boxGeometry args={[3.2, 0.1, 2.7]} />
          <meshStandardMaterial color="#3a3d4a" />
        </mesh>
        <MeetingTable position={[0, 0, 0]} seats={4} />
      </group>

      {/* ═══ CROSS-BRACING (structural expression) ═══ */}
      <CrossBrace p1={[-6.5, 0, -2]} p2={[-6.5, floorH * 2, 2]} />
      <CrossBrace p1={[-6.5, floorH * 2, -2]} p2={[-6.5, 0, 2]} />
      <CrossBrace p1={[6.75, 0, -2.25]} p2={[6.75, floorH * 1.5, 2.25]} />
      <CrossBrace p1={[6.75, floorH * 1.5, -2.25]} p2={[6.75, 0, 2.25]} />

      {/* Bridge support bracing */}
      <CrossBrace p1={[-1.5, floorH * 2, 2.5]} p2={[0.25, floorH * 2.5, 2.5]} color="#556" />
      <CrossBrace p1={[2, floorH * 2, 2.5]} p2={[0.25, floorH * 2.5, 2.5]} color="#556" />

      {/* ═══ GROUND LEVEL ATRIUM ═══ */}
      {/* Open space between towers */}
      <TallPlant position={[0.5, 0, -1.5]} />
      <TallPlant position={[0.5, 0, 1.5]} />
      <Plant position={[-0.5, 0, 0]} variant={2} />

      {/* Entrance canopy */}
      <mesh position={[0.25, 3.5, 4]}>
        <boxGeometry args={[6, 0.08, 2]} />
        <meshStandardMaterial color="#445" metalness={0.5} transparent opacity={0.6} />
      </mesh>
      {/* Canopy supports */}
      <Pillar position={[-2.5, 0, 3.5]} height={3.5} radius={0.08} color="#556" />
      <Pillar position={[3, 0, 3.5]} height={3.5} radius={0.08} color="#556" />
    </group>
  )
}
