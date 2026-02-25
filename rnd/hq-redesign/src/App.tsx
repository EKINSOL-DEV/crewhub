import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { useState, useRef, useEffect } from 'react'
import { designs } from './designs'
import { UI } from './UI'
import { WallProvider } from './WallSystem'

export default function App() {
  const [activeDesign, setActiveDesign] = useState(0)
  const Design = designs[activeDesign].component
  const controlsRef = useRef<any>(null)

  // Smoothly move camera when switching designs
  useEffect(() => {
    if (controlsRef.current) {
      const cam = designs[activeDesign].cameraPos
      const ctrl = controlsRef.current
      // Reset target and camera
      ctrl.target.set(0, 3, 0)
      ctrl.object.position.set(cam[0], cam[1], cam[2])
      ctrl.update()
    }
  }, [activeDesign])

  return (
    <div style={{ width: '100%', height: '100%', background: '#0d1117' }}>
      <Canvas shadows camera={{ position: designs[0].cameraPos, fov: 45 }}>
        <color attach="background" args={['#0d1117']} />
        <fog attach="fog" args={['#0d1117', 30, 60]} />

        {/* Lighting */}
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[15, 20, 10]} intensity={1.2} castShadow
          shadow-mapSize={2048} shadow-camera-far={50}
          shadow-camera-left={-15} shadow-camera-right={15}
          shadow-camera-top={15} shadow-camera-bottom={-15}
        />
        <directionalLight position={[-8, 12, -8]} intensity={0.3} color="#4fc3f7" />
        <pointLight position={[0, 8, 0]} intensity={0.4} color="#ffe8cc" />

        <WallProvider buildingCenter={[0, 3, 0]}>
          <Design />
        </WallProvider>

        {/* Ground grid */}
        <gridHelper args={[50, 50, '#1a2030', '#151c28']} position={[0, -0.02, 0]} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          minDistance={5}
          maxDistance={45}
          target={[0, 3, 0]}
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI * 0.48}
        />
        <Environment preset="city" />
      </Canvas>
      <UI designs={designs} active={activeDesign} onSelect={setActiveDesign} />
    </div>
  )
}
