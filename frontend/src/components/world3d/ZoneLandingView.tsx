/**
 * ZoneLandingView — Generic landing page for stub zones (Phase 2 MVP).
 *
 * Renders a themed 3D scene with a platform and an info board listing
 * "Coming in MVP" features. Reused by Game Center and Academy.
 */
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { Suspense, type ReactNode } from 'react'
import type { Zone } from '@/lib/zones'

interface MvpBoardItem {
  emoji: string
  label: string
}

interface ZoneLandingViewProps {
  zone: Zone
  mvpItems: MvpBoardItem[]
  className?: string
  /** Extra 3D elements to render inside the scene */
  sceneExtras?: ReactNode
}

function LandingScene({ zone, mvpItems, sceneExtras }: { zone: Zone; mvpItems: MvpBoardItem[]; sceneExtras?: ReactNode }) {
  return (
    <group>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />

      {/* Ground platform */}
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <cylinderGeometry args={[14, 14, 1, 32]} />
        <meshStandardMaterial color={zone.colorPrimary} />
      </mesh>

      {/* Center marker */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[2, 3, 0.3]} />
        <meshStandardMaterial color="#ffffff" opacity={0.9} transparent />
      </mesh>

      {/* Zone label */}
      <Html position={[0, 5, 0]} center>
        <div style={{
          background: `${zone.colorPrimary}ee`,
          color: 'white',
          padding: '12px 24px',
          borderRadius: '12px',
          fontFamily: 'system-ui',
          fontSize: '18px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          textAlign: 'center',
        }}>
          {zone.icon} {zone.name}
          {zone.description && (
            <div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: 4, opacity: 0.9 }}>
              {zone.description}
            </div>
          )}
        </div>
      </Html>

      {/* MVP Info Board — positioned to the right */}
      <mesh position={[8, 2, 0]} rotation={[0, -0.3, 0]}>
        <boxGeometry args={[0.2, 4, 3]} />
        <meshStandardMaterial color="#2c3e50" />
      </mesh>

      <Html position={[9, 2.5, 0]} center>
        <div style={{
          background: 'rgba(44, 62, 80, 0.95)',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '10px',
          fontFamily: 'system-ui',
          fontSize: '13px',
          width: '220px',
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8, fontSize: '14px' }}>
            📋 Coming in MVP
          </div>
          {mvpItems.map((item, i) => (
            <div key={i} style={{ padding: '3px 0', opacity: 0.9 }}>
              {item.emoji} {item.label}
            </div>
          ))}
        </div>
      </Html>

      {/* Extra scene elements (zone-specific) */}
      {sceneExtras}
    </group>
  )
}

function gradientForZone(color: string): string {
  // Darken the primary color for gradient top
  return `linear-gradient(180deg, #1a1a2e 0%, ${color}44 60%, ${color}88 100%)`
}

export function ZoneLandingView({ zone, mvpItems, className, sceneExtras }: ZoneLandingViewProps) {
  return (
    <div className={className ?? 'relative w-full h-full'} style={{ minHeight: '600px' }}>
      <Canvas
        shadows
        camera={{ position: [-20, 15, -20], fov: 40, near: 0.1, far: 300 }}
        style={{ background: gradientForZone(zone.colorPrimary) }}
      >
        <Suspense fallback={null}>
          <LandingScene zone={zone} mvpItems={mvpItems} sceneExtras={sceneExtras} />
          <OrbitControls
            enablePan={false}
            minDistance={15}
            maxDistance={40}
            maxPolarAngle={Math.PI / 2.2}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
