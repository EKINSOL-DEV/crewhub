import { useMemo } from 'react'
import * as THREE from 'three'
import { Wall } from '../WallSystem'
import { Workstation, Plant, TallPlant, Floor, MeetingTable, Sofa, CoffeeTable, HangingLight, Pillar, GlassPanel } from '../Props'

/**
 * THE RING - Inspired by Apple Park
 *
 * A curved, ring-shaped building enclosing a central courtyard garden.
 * Two stories with a continuous curved glass facade. The inner courtyard
 * features trees and a reflecting pool. Upper floor has a sky lounge
 * with panoramic views.
 *
 * Architectural features:
 * - Curved walls built from segmented panels (12 segments)
 * - Central courtyard with landscaping
 * - Cantilevered upper floor extends slightly beyond lower
 * - Roof overhang provides shade
 */

export function TheRing() {
  const segments = 16
  const outerR = 6
  const innerR = 4
  const wallH = 2.8

  return (
    <group>
      {/* Ground plane */}
      <Floor size={[20, 20]} color="#1e2430" />

      {/* ═══ GROUND FLOOR ═══ */}

      {/* Outer curved wall - segments */}
      {Array.from({ length: segments }).map((_, i) => {
        const a = (i / segments) * Math.PI * 2
        const nextA = ((i + 1) / segments) * Math.PI * 2
        const midA = (a + nextA) / 2
        const segW = 2 * outerR * Math.sin(Math.PI / segments)
        return (
          <Wall
            key={`outer-${i}`}
            color="#7a8a9a"
            opacity={0.88}
            position={[Math.cos(midA) * outerR, wallH / 2, Math.sin(midA) * outerR]}
            rotation={[0, -midA + Math.PI / 2, 0]}
          >
            <boxGeometry args={[segW, wallH, 0.12]} />
          </Wall>
        )
      })}

      {/* Inner curved wall */}
      {Array.from({ length: segments }).map((_, i) => {
        const a = (i / segments) * Math.PI * 2
        const nextA = ((i + 1) / segments) * Math.PI * 2
        const midA = (a + nextA) / 2
        const segW = 2 * innerR * Math.sin(Math.PI / segments)
        return (
          <Wall
            key={`inner-${i}`}
            color="#8a9aaa"
            opacity={0.85}
            position={[Math.cos(midA) * innerR, wallH / 2, Math.sin(midA) * innerR]}
            rotation={[0, -midA + Math.PI / 2, 0]}
          >
            <boxGeometry args={[segW, wallH, 0.1]} />
          </Wall>
        )
      })}

      {/* Floor slab - ring shape approximation */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[innerR - 0.2, outerR + 0.2, 32]} />
        <meshStandardMaterial color="#2d3040" roughness={0.6} />
      </mesh>

      {/* ═══ SECOND FLOOR ═══ */}

      {/* Second floor slab - slightly cantilevered */}
      <mesh position={[0, wallH, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[innerR - 0.4, outerR + 0.4, 32]} />
        <meshStandardMaterial color="#2a2d3a" roughness={0.5} />
      </mesh>

      {/* Upper outer wall */}
      {Array.from({ length: segments }).map((_, i) => {
        const a = (i / segments) * Math.PI * 2
        const nextA = ((i + 1) / segments) * Math.PI * 2
        const midA = (a + nextA) / 2
        const segW = 2 * (outerR + 0.3) * Math.sin(Math.PI / segments)
        return (
          <Wall
            key={`upper-outer-${i}`}
            color="#8899aa"
            opacity={0.85}
            position={[Math.cos(midA) * (outerR + 0.3), wallH + wallH / 2, Math.sin(midA) * (outerR + 0.3)]}
            rotation={[0, -midA + Math.PI / 2, 0]}
          >
            <boxGeometry args={[segW, wallH, 0.1]} />
          </Wall>
        )
      })}

      {/* Upper inner wall - glass panels */}
      {Array.from({ length: segments }).map((_, i) => {
        const a = (i / segments) * Math.PI * 2
        const nextA = ((i + 1) / segments) * Math.PI * 2
        const midA = (a + nextA) / 2
        return (
          <GlassPanel
            key={`upper-inner-${i}`}
            position={[Math.cos(midA) * (innerR - 0.3), wallH + wallH / 2, Math.sin(midA) * (innerR - 0.3)]}
            rotation={[0, -midA + Math.PI / 2, 0]}
            size={[2 * (innerR - 0.3) * Math.sin(Math.PI / segments), wallH]}
          />
        )
      })}

      {/* Roof */}
      <mesh position={[0, wallH * 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[innerR - 0.6, outerR + 0.6, 32]} />
        <meshStandardMaterial color="#3a3d4a" roughness={0.4} metalness={0.3} />
      </mesh>

      {/* ═══ STRUCTURAL PILLARS ═══ */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2
        const r = (outerR + innerR) / 2
        return <Pillar key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} height={wallH * 2} radius={0.12} color="#556" />
      })}

      {/* ═══ GROUND FLOOR INTERIOR ═══ */}

      {/* Workstations along outer wall */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const a = (i / 6) * Math.PI * 2 + 0.3
        const r = outerR - 0.8
        return <Workstation key={`ws-${i}`} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} rotation={[0, -a, 0]} />
      })}

      {/* Meeting area */}
      <MeetingTable position={[5, 0, 0]} seats={4} />

      {/* Lounge area */}
      <Sofa position={[-5, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <CoffeeTable position={[-4.3, 0, 0]} />

      {/* ═══ SECOND FLOOR INTERIOR ═══ */}
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        const r = outerR - 0.6
        return <Workstation key={`ws2-${i}`} position={[Math.cos(a) * r, wallH, Math.sin(a) * r]} rotation={[0, -a, 0]} />
      })}

      {/* Hanging lights on second floor */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const a = (i / 6) * Math.PI * 2
        const r = (outerR + innerR) / 2
        return <HangingLight key={`light-${i}`} position={[Math.cos(a) * r, wallH * 2 - 0.1, Math.sin(a) * r]} />
      })}

      {/* ═══ COURTYARD ═══ */}

      {/* Courtyard ground */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[innerR - 0.3, 32]} />
        <meshStandardMaterial color="#2a4a2a" roughness={0.95} />
      </mesh>

      {/* Central reflecting pool */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 24]} />
        <meshPhysicalMaterial color="#2a4a6a" roughness={0} metalness={0.3} transparent opacity={0.8} />
      </mesh>

      {/* Trees in courtyard */}
      <TallPlant position={[2, 0, 1]} />
      <TallPlant position={[-1.5, 0, 2]} />
      <TallPlant position={[-1, 0, -2.2]} />
      <TallPlant position={[1.8, 0, -1.5]} />

      {/* Small plants */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2
        return <Plant key={i} position={[Math.cos(a) * 2.8, 0, Math.sin(a) * 2.8]} variant={i} scale={0.7} />
      })}
    </group>
  )
}
