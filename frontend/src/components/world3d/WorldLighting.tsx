import { useRef } from 'react'
import * as THREE from 'three'

/**
 * Scene-wide lighting setup for the toon-shaded 3D world.
 * - Warm ambient fill
 * - Directional light at 45° with shadows
 * - Hemisphere light for sky/ground color bleed
 */
export function WorldLighting() {
  const dirLightRef = useRef<THREE.DirectionalLight>(null)

  return (
    <>
      {/* Warm ambient fill */}
      <ambientLight intensity={0.4} color="#ffeedd" />

      {/* Main directional light at 45° angle */}
      <directionalLight
        ref={dirLightRef}
        position={[20, 25, 15]}
        intensity={0.8}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.001}
      />

      {/* Hemisphere light: sky blue + warm brown ground */}
      <hemisphereLight
        args={['#87CEEB', '#8B6838', 0.3]}
      />
    </>
  )
}
