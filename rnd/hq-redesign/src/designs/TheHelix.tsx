import * as THREE from 'three'
import { Wall } from '../WallSystem'
import { Workstation, Plant, TallPlant, Floor, MeetingTable, Sofa, CoffeeTable, HangingLight, GlassPanel } from '../Props'

/**
 * THE HELIX - Inspired by Zaha Hadid / BIG's spiraling buildings
 *
 * A spiraling structure that wraps upward around a central core. The floor
 * plate is a continuous ramp/spiral, with workspaces arranged along the
 * outer edge and a central cylindrical core housing elevators/utilities.
 *
 * Architectural features:
 * - Continuous spiraling floor plate (3 full rotations)
 * - Central cylindrical core
 * - Outer wall follows the spiral with slight lean
 * - Each "quarter turn" has a different program (work, meet, lounge, focus)
 * - Dramatic void at center visible from any point
 * - Green terraces at each half-rotation
 */

export function TheHelix() {
  const totalRotations = 2.5
  const segments = 20
  const totalAngle = totalRotations * Math.PI * 2
  const outerR = 6
  const innerR = 2
  const totalHeight = 10
  const segAngle = totalAngle / segments
  const segHeight = totalHeight / segments

  return (
    <group>
      <Floor size={[20, 20]} color="#1e2430" />

      {/* ═══ CENTRAL CORE ═══ */}
      <mesh position={[0, totalHeight / 2, 0]}>
        <cylinderGeometry args={[innerR - 0.3, innerR - 0.3, totalHeight, 24]} />
        <meshStandardMaterial color="#3a3d4a" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Core accent rings */}
      {[0, 2.5, 5, 7.5, 10].map((h, i) => (
        <mesh key={h} position={[0, h, 0]}>
          <torusGeometry args={[innerR - 0.2, 0.06, 8, 24]} />
          <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={0.5} metalness={0.8} />
        </mesh>
      ))}

      {/* ═══ SPIRAL FLOOR SEGMENTS ═══ */}
      {Array.from({ length: segments }).map((_, i) => {
        const midAngle = ((i + 0.5) / segments) * totalAngle
        const y = (i / segments) * totalHeight

        // Floor segment as a wedge
        const midR = (outerR + innerR) / 2
        const px = Math.cos(midAngle) * midR
        const pz = Math.sin(midAngle) * midR
        const segW = (outerR - innerR)

        return (
          <group key={`item-${i}`}>
            {/* Floor segment */}
            <mesh
              position={[px, y + 0.02, pz]}
              rotation={[-Math.PI / 2, 0, -midAngle + Math.PI / 2]}
            >
              <planeGeometry args={[segW + 0.3, 2 * midR * Math.sin(segAngle / 2) + 0.3]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#2a2d3a' : '#282b38'} />
            </mesh>

            {/* Outer wall segment */}
            <Wall
              color={i % 4 < 2 ? '#6a7a8a' : '#7a8a9a'}
              opacity={0.88}
              position={[
                Math.cos(midAngle) * outerR,
                y + 1.4,
                Math.sin(midAngle) * outerR
              ]}
              rotation={[0, -midAngle + Math.PI / 2, 0]}
            >
              <boxGeometry args={[2 * outerR * Math.sin(segAngle / 2) + 0.2, 2.8, 0.1]} />
            </Wall>

            {/* Inner glass railing */}
            <GlassPanel
              position={[
                Math.cos(midAngle) * innerR,
                y + 0.5,
                Math.sin(midAngle) * innerR
              ]}
              rotation={[0, -midAngle + Math.PI / 2, 0]}
              size={[2 * innerR * Math.sin(segAngle / 2) + 0.1, 1]}
            />

            {/* Furnish based on segment position */}
            {i % 5 === 0 && (
              <Workstation
                position={[
                  Math.cos(midAngle) * (midR + 0.5),
                  y,
                  Math.sin(midAngle) * (midR + 0.5)
                ]}
                rotation={[0, -midAngle, 0]}
              />
            )}
            {i % 5 === 1 && (
              <Plant
                position={[
                  Math.cos(midAngle) * (midR + 1),
                  y,
                  Math.sin(midAngle) * (midR + 1)
                ]}
                variant={i}
                scale={0.8}
              />
            )}
            {i % 5 === 3 && (
              <Workstation
                position={[
                  Math.cos(midAngle) * (midR - 0.3),
                  y,
                  Math.sin(midAngle) * (midR - 0.3)
                ]}
                rotation={[0, -midAngle + Math.PI, 0]}
              />
            )}

            {/* Hanging lights every 3 segments */}
            {i % 3 === 0 && (
              <HangingLight
                position={[
                  Math.cos(midAngle) * midR,
                  y + 2.7,
                  Math.sin(midAngle) * midR
                ]}
                color={i % 6 === 0 ? '#ffddaa' : '#aaddff'}
              />
            )}
          </group>
        )
      })}

      {/* ═══ GROUND FLOOR LOBBY ═══ */}
      {/* Entrance area */}
      <mesh position={[outerR + 0.5, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 4]} />
        <meshStandardMaterial color="#2d3040" />
      </mesh>
      <Sofa position={[outerR + 1, 0, -1]} rotation={[0, -Math.PI / 2, 0]} color="#3a4a5a" />
      <CoffeeTable position={[outerR + 0.3, 0, -1]} />
      <TallPlant position={[outerR + 1.5, 0, 1.2]} />

      {/* Terrace gardens at half-rotations */}
      {[0, 1, 2].map(t => {
        const a = t * Math.PI + Math.PI / 2
        const y = (t / totalRotations) * totalHeight + totalHeight * 0.2
        return (
          <group key={`terrace-${t}`}>
            <TallPlant position={[Math.cos(a) * (outerR + 0.5), y, Math.sin(a) * (outerR + 0.5)]} />
            <Plant position={[Math.cos(a + 0.3) * (outerR + 0.3), y, Math.sin(a + 0.3) * (outerR + 0.3)]} variant={t} />
          </group>
        )
      })}

      {/* ═══ CROWN / TOP ═══ */}
      {/* Observation deck at top */}
      <mesh position={[0, totalHeight + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[innerR - 0.5, outerR + 0.5, 32]} />
        <meshStandardMaterial color="#2d3040" />
      </mesh>
      {/* Canopy */}
      <mesh position={[0, totalHeight + 1.5, 0]}>
        <coneGeometry args={[outerR + 1, 1.5, 32, 1, true]} />
        <meshPhysicalMaterial color="#556" transparent opacity={0.4} side={THREE.DoubleSide} metalness={0.5} />
      </mesh>

      {/* Top floor meeting space */}
      <MeetingTable position={[0, totalHeight, 3]} seats={6} />
      <Workstation position={[-3, totalHeight, 0]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}
