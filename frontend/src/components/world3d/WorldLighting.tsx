import { useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useLightingConfig } from '@/hooks/useLightingConfig'

const TONE_MAP: Record<string, THREE.ToneMapping> = {
  NoToneMapping: THREE.NoToneMapping,
  ACESFilmicToneMapping: THREE.ACESFilmicToneMapping,
  ReinhardToneMapping: THREE.ReinhardToneMapping,
  CineonToneMapping: THREE.CineonToneMapping,
}

/**
 * Scene-wide lighting driven by useLightingConfig.
 * Reads from localStorage (crewhub-lighting) and updates live
 * when the LightingDebugPanel changes values.
 */
export function WorldLighting() {
  const dirLightRef = useRef<THREE.DirectionalLight>(null)
  const { config } = useLightingConfig()
  const { gl } = useThree()

  // Apply tone mapping to renderer
  const mapping = TONE_MAP[config.toneMapping] ?? THREE.ACESFilmicToneMapping
  if (gl.toneMapping !== mapping) gl.toneMapping = mapping
  if (gl.toneMappingExposure !== config.toneMappingExposure) gl.toneMappingExposure = config.toneMappingExposure

  return (
    <>
      {/* Ambient fill */}
      <ambientLight intensity={config.ambient.intensity} color={config.ambient.color} />

      {/* Hemisphere light: sky/ground */}
      <hemisphereLight
        args={[config.hemisphere.skyColor, config.hemisphere.groundColor, config.hemisphere.intensity]}
      />

      {/* Main directional (sun) */}
      <directionalLight
        ref={dirLightRef}
        position={config.sun.position}
        intensity={config.sun.intensity}
        color={config.sun.color}
        castShadow={config.sun.castShadow}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.001}
      />

      {/* Fill light — opposite side, softer */}
      <directionalLight
        position={config.fill.position}
        intensity={config.fill.intensity}
        color={config.fill.color}
      />
    </>
  )
}
