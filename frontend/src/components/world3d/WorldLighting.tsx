import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useLightingConfig, type ShadowMapType } from '@/hooks/useLightingConfig'

const TONE_MAP: Record<string, THREE.ToneMapping> = {
  NoToneMapping: THREE.NoToneMapping,
  ACESFilmicToneMapping: THREE.ACESFilmicToneMapping,
  ReinhardToneMapping: THREE.ReinhardToneMapping,
  CineonToneMapping: THREE.CineonToneMapping,
}

const SHADOW_TYPE_MAP: Record<ShadowMapType, THREE.ShadowMapType> = {
  BasicShadowMap: THREE.BasicShadowMap,
  PCFShadowMap: THREE.PCFShadowMap,
  PCFSoftShadowMap: THREE.PCFSoftShadowMap,
  VSMShadowMap: THREE.VSMShadowMap,
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

  // DEBUG

  // Apply tone mapping to renderer
  const mapping = TONE_MAP[config.toneMapping] ?? THREE.ACESFilmicToneMapping
  if (gl.toneMapping !== mapping) gl.toneMapping = mapping
  if (gl.toneMappingExposure !== config.toneMappingExposure)
    gl.toneMappingExposure = config.toneMappingExposure

  // Apply shadow map settings to renderer
  const shadowEnabled = config.shadows.enabled && config.sun.castShadow
  if (gl.shadowMap.enabled !== shadowEnabled) {
    gl.shadowMap.enabled = shadowEnabled
    gl.shadowMap.needsUpdate = true
  }
  const shadowType = SHADOW_TYPE_MAP[config.shadows.type] ?? THREE.PCFSoftShadowMap
  if (gl.shadowMap.type !== shadowType) {
    gl.shadowMap.type = shadowType
    gl.shadowMap.needsUpdate = true
  }

  // Apply shadow settings to the directional light
  useEffect(() => {
    const light = dirLightRef.current
    if (!light) return

    const { shadows } = config
    const shadow = light.shadow

    // Map size (only update if changed — triggers shader recompilation)
    if (shadow.mapSize.x !== shadows.mapSize || shadow.mapSize.y !== shadows.mapSize) {
      shadow.mapSize.set(shadows.mapSize, shadows.mapSize)
      // Dispose old map to force recompilation with new size
      if (shadow.map) {
        shadow.map.dispose()
        shadow.map = null
      }
    }

    shadow.bias = shadows.bias
    shadow.normalBias = shadows.normalBias
    shadow.radius = shadows.radius

    // Shadow camera (orthographic) bounds
    const cam = shadow.camera as THREE.OrthographicCamera
    cam.near = shadows.camera.near
    cam.far = shadows.camera.far
    cam.left = -shadows.camera.size
    cam.right = shadows.camera.size
    cam.top = shadows.camera.size
    cam.bottom = -shadows.camera.size
    cam.updateProjectionMatrix()
  }, [config])

  return (
    <>
      {/* Ambient fill */}
      <ambientLight intensity={config.ambient.intensity} color={config.ambient.color} />

      {/* Hemisphere light: sky/ground */}
      <hemisphereLight
        args={[
          config.hemisphere.skyColor,
          config.hemisphere.groundColor,
          config.hemisphere.intensity,
        ]}
      />

      {/* Main directional (sun) */}
      <directionalLight
        ref={dirLightRef}
        position={config.sun.position}
        intensity={config.sun.intensity}
        color={config.sun.color}
        castShadow={shadowEnabled}
        shadow-mapSize-width={config.shadows.mapSize}
        shadow-mapSize-height={config.shadows.mapSize}
        shadow-camera-near={config.shadows.camera.near}
        shadow-camera-far={config.shadows.camera.far}
        shadow-camera-left={-config.shadows.camera.size}
        shadow-camera-right={config.shadows.camera.size}
        shadow-camera-top={config.shadows.camera.size}
        shadow-camera-bottom={-config.shadows.camera.size}
        shadow-bias={config.shadows.bias}
        shadow-normalBias={config.shadows.normalBias}
        shadow-radius={config.shadows.radius}
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
