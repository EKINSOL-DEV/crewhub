import * as THREE from 'three'
import { Wall } from '../WallSystem'
import { Workstation, MeetingTable, Sofa, CoffeeTable, Plant, TallPlant, Floor, HangingLight, Pillar, ServerRack, Whiteboard, GlassPanel, Rug } from '../Props'

/**
 * THE ATRIUM - Inspired by Frank Lloyd Wright's Guggenheim / modern atriums
 * 
 * A tall building with a dramatic central void/atrium running through all floors.
 * Balconied walkways wrap around the void on each level. Glass bridges cross
 * the atrium at different heights. Natural light floods down from a skylight roof.
 * 
 * Architectural features:
 * - 4-story building with central atrium void
 * - Balconied walkways on each floor
 * - Glass bridges crossing the void at floors 2 and 4
 * - Skylight roof flooding natural light
 * - Ground floor: reception / lounge
 * - Each floor slightly rotated for visual interest
 */

export function TheAtrium() {
  const floorH = 3
  const floors = 4
  const buildW = 12
  const buildD = 10
  const atriumW = 4
  const atriumD = 3.5
  
  return (
    <group>
      <Floor size={[20, 20]} color="#1e2430" />
      
      {Array.from({ length: floors }).map((_, fi) => {
        const y = fi * floorH
        const rotation = fi * 0.0 // Could add slight rotation per floor
        
        return (
          <group key={fi} position={[0, y, 0]}>
            {/* Floor slab with central void */}
            {/* Left wing */}
            <mesh position={[-(atriumW / 2 + (buildW / 2 - atriumW / 2) / 2), 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[(buildW - atriumW) / 2, buildD]} />
              <meshStandardMaterial color={fi === 0 ? '#2a2d3a' : '#282b38'} />
            </mesh>
            {/* Right wing */}
            <mesh position={[(atriumW / 2 + (buildW / 2 - atriumW / 2) / 2), 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[(buildW - atriumW) / 2, buildD]} />
              <meshStandardMaterial color={fi === 0 ? '#2a2d3a' : '#282b38'} />
            </mesh>
            {/* Front strip */}
            <mesh position={[0, 0.02, (buildD / 2 + atriumD / 2) / 2 + atriumD / 4]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[atriumW, (buildD - atriumD) / 2]} />
              <meshStandardMaterial color={fi === 0 ? '#2a2d3a' : '#282b38'} />
            </mesh>
            {/* Back strip */}
            <mesh position={[0, 0.02, -(buildD / 2 + atriumD / 2) / 2 - atriumD / 4]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[atriumW, (buildD - atriumD) / 2]} />
              <meshStandardMaterial color={fi === 0 ? '#2a2d3a' : '#282b38'} />
            </mesh>
            
            {/* Exterior walls */}
            <Wall color="#6a7a8a" position={[0, floorH / 2, buildD / 2]}><boxGeometry args={[buildW, floorH, 0.12]} /></Wall>
            <Wall color="#6a7a8a" position={[0, floorH / 2, -buildD / 2]}><boxGeometry args={[buildW, floorH, 0.12]} /></Wall>
            <Wall color="#5a6a7a" position={[buildW / 2, floorH / 2, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[buildD, floorH, 0.12]} /></Wall>
            <Wall color="#5a6a7a" position={[-buildW / 2, floorH / 2, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[buildD, floorH, 0.12]} /></Wall>
            
            {/* Atrium balcony railing (glass) */}
            <GlassPanel position={[atriumW / 2, floorH * 0.35, 0]} rotation={[0, Math.PI / 2, 0]} size={[atriumD, floorH * 0.7]} />
            <GlassPanel position={[-atriumW / 2, floorH * 0.35, 0]} rotation={[0, Math.PI / 2, 0]} size={[atriumD, floorH * 0.7]} />
            <GlassPanel position={[0, floorH * 0.35, atriumD / 2]} size={[atriumW, floorH * 0.7]} />
            <GlassPanel position={[0, floorH * 0.35, -atriumD / 2]} size={[atriumW, floorH * 0.7]} />
            
            {/* ═══ FLOOR-SPECIFIC INTERIORS ═══ */}
            
            {fi === 0 && (
              <group>
                {/* Reception / Lobby */}
                <Rug position={[0, 0, 3.5]} size={[4, 3]} color="#3a2a2a" />
                <Sofa position={[-1, 0, 3]} rotation={[0, 0, 0]} color="#4a3a2a" />
                <Sofa position={[1, 0, 4]} rotation={[0, Math.PI, 0]} color="#4a3a2a" />
                <CoffeeTable position={[0, 0, 3.5]} />
                
                {/* Left wing - workstations */}
                <Workstation position={[-4.5, 0, -2]} />
                <Workstation position={[-4.5, 0, 0]} />
                <Workstation position={[-4.5, 0, 2]} />
                
                {/* Right wing - meeting */}
                <MeetingTable position={[4.5, 0, 0]} seats={6} />
                
                <TallPlant position={[-5.5, 0, 4]} />
                <TallPlant position={[5.5, 0, 4]} />
              </group>
            )}
            
            {fi === 1 && (
              <group>
                {/* Open workspace floor */}
                <Workstation position={[-4.5, 0, -2.5]} />
                <Workstation position={[-4.5, 0, 0]} />
                <Workstation position={[-4.5, 0, 2.5]} />
                <Workstation position={[4.5, 0, -2.5]} />
                <Workstation position={[4.5, 0, 0]} rotation={[0, Math.PI, 0]} />
                <Workstation position={[4.5, 0, 2.5]} rotation={[0, Math.PI, 0]} />
                
                {/* Glass bridge across atrium */}
                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[atriumW, 1.2]} />
                  <meshPhysicalMaterial color="#88bbdd" transparent opacity={0.25} roughness={0} />
                </mesh>
                
                <Plant position={[-3, 0, 4]} variant={1} />
                <Plant position={[3, 0, -4]} variant={2} />
              </group>
            )}
            
            {fi === 2 && (
              <group>
                {/* Quiet / focus floor */}
                <Workstation position={[-4.5, 0, -2]} />
                <Workstation position={[-4.5, 0, 1.5]} />
                <Sofa position={[4.5, 0, -2]} rotation={[0, -Math.PI / 2, 0]} color="#2a3a4a" />
                <Whiteboard position={[4.5, 0, 1]} rotation={[0, -Math.PI / 2, 0]} />
                <ServerRack position={[3.5, 0, 3.5]} rotation={[0, Math.PI, 0]} />
                <ServerRack position={[4.2, 0, 3.5]} rotation={[0, Math.PI, 0]} />
              </group>
            )}
            
            {fi === 3 && (
              <group>
                {/* Executive / sky lounge */}
                <MeetingTable position={[-4, 0, 0]} seats={8} />
                <Sofa position={[4, 0, -2]} rotation={[0, -Math.PI / 2, 0]} color="#3a2a1a" />
                <Sofa position={[4, 0, 2]} rotation={[0, -Math.PI / 2, 0]} color="#3a2a1a" />
                <CoffeeTable position={[3.2, 0, 0]} />
                
                {/* Glass bridge across atrium */}
                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[atriumW, 1.2]} />
                  <meshPhysicalMaterial color="#88bbdd" transparent opacity={0.25} roughness={0} />
                </mesh>
                
                <TallPlant position={[-5.5, 0, -4]} />
                <Plant position={[5, 0, 4]} variant={3} />
              </group>
            )}
            
            {/* Hanging lights per floor */}
            <HangingLight position={[-4, floorH - 0.1, 0]} />
            <HangingLight position={[4, floorH - 0.1, 0]} />
          </group>
        )
      })}
      
      {/* ═══ SKYLIGHT ROOF ═══ */}
      <mesh position={[0, floors * floorH, 0]}>
        <boxGeometry args={[buildW + 0.4, 0.15, buildD + 0.4]} />
        <meshStandardMaterial color="#3a3d4a" metalness={0.3} />
      </mesh>
      {/* Skylight over atrium */}
      <mesh position={[0, floors * floorH + 0.1, 0]}>
        <boxGeometry args={[atriumW + 0.5, 0.06, atriumD + 0.5]} />
        <meshPhysicalMaterial color="#aaddff" transparent opacity={0.3} roughness={0} />
      </mesh>
      {/* Light shaft from skylight */}
      <pointLight position={[0, floors * floorH - 0.5, 0]} intensity={2} distance={floors * floorH + 2} color="#ffe8cc" />
      
      {/* ═══ STRUCTURAL PILLARS ═══ */}
      {[
        [-buildW / 2 + 0.5, -buildD / 2 + 0.5],
        [buildW / 2 - 0.5, -buildD / 2 + 0.5],
        [-buildW / 2 + 0.5, buildD / 2 - 0.5],
        [buildW / 2 - 0.5, buildD / 2 - 0.5],
        [-atriumW / 2, -atriumD / 2],
        [atriumW / 2, -atriumD / 2],
        [-atriumW / 2, atriumD / 2],
        [atriumW / 2, atriumD / 2],
      ].map(([x, z], i) => (
        <Pillar key={i} position={[x, 0, z]} height={floors * floorH} radius={0.15} color="#556" />
      ))}
    </group>
  )
}
