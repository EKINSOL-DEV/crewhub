import * as THREE from 'three'

/**
 * Creates a 3-step toon gradient map for cel shading.
 * Produces shadow / mid / highlight bands.
 * Uses RGBA format (Three.js r152+ compatible).
 */
export function createToonGradientMap(): THREE.DataTexture {
  const colors = new Uint8Array([
    90,
    90,
    90,
    255, // shadow
    170,
    170,
    170,
    255, // mid-tone
    255,
    255,
    255,
    255, // highlight
  ])
  const gradientMap = new THREE.DataTexture(colors, 3, 1, THREE.RGBAFormat)
  gradientMap.minFilter = THREE.NearestFilter
  gradientMap.magFilter = THREE.NearestFilter
  gradientMap.needsUpdate = true
  return gradientMap
}

// Shared gradient map instance (reuse for performance)
let _sharedGradientMap: THREE.DataTexture | null = null

function getSharedGradientMap(): THREE.DataTexture {
  if (!_sharedGradientMap) {
    _sharedGradientMap = createToonGradientMap()
  }
  return _sharedGradientMap
}

/**
 * Creates a MeshToonMaterial with the shared gradient map.
 */
export function createToonMaterial(color: string): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getSharedGradientMap(),
  })
}

/**
 * React hook-friendly: returns props to spread on <meshToonMaterial>.
 */
export function useToonMaterialProps(color: string) {
  const gradientMap = getSharedGradientMap()
  return { color, gradientMap }
}

// ─── Warm Color Palette ──────────────────────────────────────────────

export const WARM_COLORS = {
  wood: '#8B6914',
  woodDark: '#6B4F12',
  woodLight: '#A5822E',
  stone: '#9E9684',
  stoneDark: '#7A7468',
  stoneLight: '#B8B0A0',
  warmWhite: '#FFF8F0',
  cream: '#F5E6D0',
  warmGray: '#A09888',
  ground: '#6B7F5E',
  groundDark: '#4A5A42',
} as const
