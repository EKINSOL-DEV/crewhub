import { Screen } from './components/Screen'
import { DataStream } from './components/DataStream'
import { LED as Led } from './components/LED'

/**
 * Wall-mounted monitor bank — 3 screens side by side.
 * For back wall of HQ command center.
 */
export function MonitorBank({
  position = [0, 0, 0] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Center screen — larger */}
      <Screen position={[0, 0, 0]} width={0.8} height={0.5} color="#00ff88" scanlines />
      {/* Left screen */}
      <Screen position={[-1, 0, 0]} width={0.6} height={0.4} color="#00aaff" scanlines />
      {/* Right screen */}
      <Screen position={[1, 0, 0]} width={0.6} height={0.4} color="#ffaa00" scanlines flicker />
      {/* Status LEDs below screens */}
      <Led position={[-0.3, -0.35, 0.02]} color="#00ff00" size={0.015} />
      <Led position={[0, -0.35, 0.02]} color="#00ff00" size={0.015} />
      <Led position={[0.3, -0.35, 0.02]} color="#ffaa00" size={0.015} />
    </group>
  )
}

/**
 * Corner data pillar — vertical data stream with glowing base.
 * Creates the "active command center" atmosphere.
 */
export function DataPillar({
  position = [0, 0, 0] as [number, number, number],
  color = '#00ccff',
}) {
  return (
    <group position={position}>
      {/* Base disc */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 0.04, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </mesh>
      {/* Data stream going up */}
      <DataStream
        position={[0, 0, 0]}
        count={8}
        radius={0.2}
        height={2}
        color={color}
        speed={1.2}
        particleSize={0.02}
      />
    </group>
  )
}

/**
 * Complete HQ command center overlay props.
 * Added on top of the standard grid blueprint furniture.
 * Scaled relative to room size.
 */
export function HQCommandOverlay({ size = 16 }: Readonly<{ size?: number }>) {
  const scale = size / 16 // normalize to reference size

  return (
    <group>
      {/* Monitor bank on back wall */}
      <MonitorBank position={[0, 2.2 * scale, (size / 2 - 0.5) * 1]} rotation={[0, Math.PI, 0]} />

      {/* Corner data pillars */}
      <DataPillar position={[-size / 2 + 1.5, 0.4, -size / 2 + 1.5]} color="#00ccff" />
      <DataPillar position={[size / 2 - 1.5, 0.4, -size / 2 + 1.5]} color="#ff88ff" />
      <DataPillar position={[-size / 2 + 1.5, 0.4, size / 2 - 1.5]} color="#ffaa00" />
      <DataPillar position={[size / 2 - 1.5, 0.4, size / 2 - 1.5]} color="#00ff88" />

      {/* Side wall screens */}
      <Screen
        position={[-size / 2 + 0.2, 1.8, 0]}
        rotation={[0, Math.PI / 2, 0]}
        width={0.5}
        height={0.35}
        color="#00aaff"
        scanlines
      />
      <Screen
        position={[size / 2 - 0.2, 1.8, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        width={0.5}
        height={0.35}
        color="#ff6644"
        scanlines
      />
    </group>
  )
}
