import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { PropMakerRoom } from './zones/creator/PropMakerRoom'

interface CreatorCenterViewProps {
  className?: string
}

export function CreatorCenterView({ className }: CreatorCenterViewProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', background: '#0a0a1e', position: 'relative' }}>
      {/* MVP Feature Banner */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        background: 'linear-gradient(135deg, rgba(123, 31, 162, 0.85), rgba(0, 188, 212, 0.85))',
        backdropFilter: 'blur(12px)',
        borderRadius: 12,
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 4px 20px rgba(123, 31, 162, 0.4), 0 0 40px rgba(0, 188, 212, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        <span style={{ fontSize: 16 }}>🎬</span>
        <span style={{
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.3px',
          whiteSpace: 'nowrap',
        }}>
          Creator Center
        </span>
        <span style={{
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 6,
          padding: '2px 8px',
          color: '#e0f7fa',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}>
          EARLY PREVIEW
        </span>
        <span style={{
          color: 'rgba(255, 255, 255, 0.75)',
          fontSize: 12,
        }}>
          Prop Maker · More tools coming soon ✨
        </span>
      </div>
      <Canvas
        shadows
        camera={{ position: [6, 5, 6], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={1.0} />
          <hemisphereLight args={['#b388ff', '#1a1a3e', 0.6]} />
          <directionalLight position={[5, 8, 5]} intensity={1.8} castShadow />
          <pointLight position={[0, 3, 0]} intensity={1.5} color="#e0d0ff" distance={12} />
          <pointLight position={[-3, 2, 2]} intensity={0.8} color="#80cbc4" distance={8} />
          <pointLight position={[3, 2, -2]} intensity={0.8} color="#ce93d8" distance={8} />
          <PropMakerRoom position={[0, 0, 0]} />
          <OrbitControls
            target={[0, 1, 0]}
            minDistance={3}
            maxDistance={15}
            maxPolarAngle={Math.PI / 2.1}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
