import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getToonMaterialProps, WARM_COLORS } from './utils/toonMaterials'
import type { WallStyle } from '@/contexts/RoomsContext'

interface RoomWallsProps {
  readonly color?: string // accent color strip
  readonly size?: number // room size in units (default 12)
  readonly wallHeight?: number // default 1.5
  readonly hovered?: boolean
  readonly wallStyle?: WallStyle
  readonly isHQ?: boolean // HQ gets taller walls
}

type WallSegment = {
  key: string
  position: [number, number, number]
  size: [number, number, number]
  isAccent?: boolean
  /** For styled walls: 'lower' | 'upper' | 'trim' */
  zone?: 'lower' | 'upper' | 'trim'
}

// ─── Toon lighting GLSL chunk ────────────────────────────────────────
const TOON_LIGHTING = /* glsl */ `
  float toonStep(float NdotL) {
    if (NdotL > 0.6) return 1.0;
    if (NdotL > 0.25) return 0.7;
    return 0.45;
  }
`

const WALL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

// ─── Accent Band shader: horizontal stripe at ~30% height ────────────
const ACCENT_BAND_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING}
  uniform vec3 uWallColor;
  uniform vec3 uAccentColor;
  uniform float uBandCenter;  // 0–1 normalized height
  uniform float uBandWidth;   // half-width
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    float dist = abs(vUv.y - uBandCenter);
    float band = 1.0 - smoothstep(uBandWidth - 0.01, uBandWidth, dist);
    vec3 col = mix(uWallColor, uAccentColor, band);

    gl_FragColor = vec4(col * toon, 1.0);
  }
`

// ─── Two-Tone shader: bottom darker, top lighter ─────────────────────
const TWO_TONE_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING}
  uniform vec3 uLowerColor;
  uniform vec3 uUpperColor;
  uniform float uSplit;       // 0–1 split height
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    float blend = smoothstep(uSplit - 0.02, uSplit + 0.02, vUv.y);
    vec3 col = mix(uLowerColor, uUpperColor, blend);

    gl_FragColor = vec4(col * toon, 1.0);
  }
`

// ─── Wainscoting shader: darker bottom third + thin trim line ────────
const WAINSCOTING_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING}
  uniform vec3 uLowerColor;
  uniform vec3 uUpperColor;
  uniform vec3 uTrimColor;
  uniform float uTrimHeight;  // 0–1 where trim sits
  uniform float uTrimWidth;   // half-width of trim line
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    // Base: lower vs upper
    float isUpper = step(uTrimHeight, vUv.y);
    vec3 col = mix(uLowerColor, uUpperColor, isUpper);

    // Trim line
    float trimDist = abs(vUv.y - uTrimHeight);
    float isTrim = 1.0 - smoothstep(uTrimWidth - 0.005, uTrimWidth, trimDist);
    col = mix(col, uTrimColor, isTrim);

    gl_FragColor = vec4(col * toon, 1.0);
  }
`

// ─── Light wall shader: clean white/cream solid ──────────────────────
const LIGHT_WALL_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING}
  uniform vec3 uWallColor;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    // Subtle vertical gradient: slightly warmer at bottom
    vec3 col = mix(uWallColor * 0.96, uWallColor, vUv.y);

    gl_FragColor = vec4(col * toon, 1.0);
  }
`

// ─── Pastel Band shader: light wall with soft pastel accent stripe ───
const PASTEL_BAND_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING}
  uniform vec3 uWallColor;
  uniform vec3 uAccentColor;
  uniform float uBandCenter;
  uniform float uBandWidth;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    float dist = abs(vUv.y - uBandCenter);
    float band = 1.0 - smoothstep(uBandWidth - 0.015, uBandWidth, dist);
    // Use a pastel (whitened) version of the accent
    vec3 pastel = mix(uAccentColor, vec3(1.0), 0.55);
    vec3 col = mix(uWallColor, pastel, band);

    gl_FragColor = vec4(col * toon, 1.0);
  }
`

// ─── Glass shader: light blue translucent tinted wall ────────────────
const GLASS_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING}
  uniform vec3 uBaseColor;
  uniform vec3 uTintColor;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    // Fresnel-like edge brightening for glass feel
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.5);
    vec3 col = mix(uBaseColor, uTintColor, 0.15 + fresnel * 0.2);

    // Subtle horizontal bands to suggest glass panels
    float panelLine = smoothstep(0.48, 0.5, fract(vUv.y * 4)) *
                      (1 - smoothstep(0.5, 0.52, fract(vUv.y * 4)));
    col = mix(col, col * 0.88, panelLine);

    gl_FragColor = vec4(col * toon, 1.0);
  }
`

function createWallShaderMaterial(
  style: WallStyle,
  wallColor: string,
  accentColor: string
): THREE.ShaderMaterial | null {
  const lightDir = new THREE.Vector3(0.5, 1, 0.3).normalize()
  const wc = new THREE.Color(wallColor)
  const ac = new THREE.Color(accentColor)

  switch (style) {
    case 'accent-band':
      return new THREE.ShaderMaterial({
        vertexShader: WALL_VERTEX,
        fragmentShader: ACCENT_BAND_FRAGMENT,
        uniforms: {
          uWallColor: { value: wc },
          uAccentColor: { value: ac },
          uBandCenter: { value: 0.3 },
          uBandWidth: { value: 0.06 },
          uLightDir: { value: lightDir },
        },
      })

    case 'two-tone': {
      const lower = wc.clone().multiplyScalar(0.7)
      const upper = wc.clone().lerp(new THREE.Color('#ffffff'), 0.15)
      return new THREE.ShaderMaterial({
        vertexShader: WALL_VERTEX,
        fragmentShader: TWO_TONE_FRAGMENT,
        uniforms: {
          uLowerColor: { value: lower },
          uUpperColor: { value: upper },
          uSplit: { value: 0.5 },
          uLightDir: { value: lightDir },
        },
      })
    }

    case 'wainscoting': {
      const lower = wc.clone().multiplyScalar(0.65)
      const upper = wc.clone().lerp(new THREE.Color('#ffffff'), 0.1)
      const trim = wc.clone().multiplyScalar(0.45)
      return new THREE.ShaderMaterial({
        vertexShader: WALL_VERTEX,
        fragmentShader: WAINSCOTING_FRAGMENT,
        uniforms: {
          uLowerColor: { value: lower },
          uUpperColor: { value: upper },
          uTrimColor: { value: trim },
          uTrimHeight: { value: 0.33 },
          uTrimWidth: { value: 0.02 },
          uLightDir: { value: lightDir },
        },
      })
    }

    case 'light':
      return new THREE.ShaderMaterial({
        vertexShader: WALL_VERTEX,
        fragmentShader: LIGHT_WALL_FRAGMENT,
        uniforms: {
          uWallColor: { value: new THREE.Color('#F5F0EA') }, // warm white/cream
          uLightDir: { value: lightDir },
        },
      })

    case 'pastel-band':
      return new THREE.ShaderMaterial({
        vertexShader: WALL_VERTEX,
        fragmentShader: PASTEL_BAND_FRAGMENT,
        uniforms: {
          uWallColor: { value: new THREE.Color('#F2EDE7') }, // light cream base
          uAccentColor: { value: ac },
          uBandCenter: { value: 0.35 },
          uBandWidth: { value: 0.07 },
          uLightDir: { value: lightDir },
        },
      })

    case 'glass':
      return new THREE.ShaderMaterial({
        vertexShader: WALL_VERTEX,
        fragmentShader: GLASS_FRAGMENT,
        uniforms: {
          uBaseColor: { value: new THREE.Color('#E8F0F8') }, // very light blue-white
          uTintColor: { value: new THREE.Color('#B8D4E8') }, // soft sky blue
          uLightDir: { value: lightDir },
        },
      })

    default:
      return null
  }
}

/**
 * Low walls around the room perimeter with:
 * - Gap/opening on one side (front, facing camera from isometric view)
 * - Color accent strip at top matching room color
 * - Rounded cap cylinders on top
 * - Multiple wall styles: default, accent-band, two-tone, wainscoting
 *
 * On hover: subtle emissive glow (intensity ~0.05) on wall segments.
 */
export function RoomWalls({
  color,
  size = 12,
  wallHeight: wallHeightProp,
  hovered = false,
  wallStyle = 'default',
  isHQ = false,
}: RoomWallsProps) {
  // HQ gets taller walls for imposing command center feel
  const wallHeight = wallHeightProp ?? (isHQ ? 2.5 : 1.5)
  const accentColor = color || '#4f46e5'
  const wallColor = WARM_COLORS.stone
  const wallToon = getToonMaterialProps(wallColor)
  const accentToon = getToonMaterialProps(accentColor)

  // Refs for emissive animation on wall and accent materials
  const wallMatRefs = useRef<(THREE.MeshToonMaterial | null)[]>([])
  const accentMatRefs = useRef<(THREE.MeshToonMaterial | null)[]>([])

  const wallThickness = 0.3
  const accentHeight = 0.15
  const halfSize = size / 2
  const gapWidth = 3 // opening width for "door"

  // Floor top surface offset — walls sit on top of the room floor overlay
  const floorTop = 0.16

  // Shader material for styled walls (non-default)
  const wallShaderMat = useMemo(() => {
    if (wallStyle === 'default') return null
    return createWallShaderMaterial(wallStyle, wallColor, accentColor)
  }, [wallStyle, wallColor, accentColor])

  // Pre-compute wall segment data
  const { segments, caps } = useMemo(() => {
    const segs: WallSegment[] = []
    const capPositions: Array<{ key: string; position: [number, number, number] }> = []

    // Back wall (full width, at +Z)
    segs.push(
      {
        key: 'back-wall',
        position: [0, floorTop + wallHeight / 2, halfSize - wallThickness / 2],
        size: [size, wallHeight, wallThickness],
      },
      {
        key: 'back-accent',
        position: [0, floorTop + wallHeight + accentHeight / 2, halfSize - wallThickness / 2],
        size: [size, accentHeight, wallThickness + 0.02],
        isAccent: true,
      }
    )

    // Left wall (full depth, at -X)
    segs.push(
      {
        key: 'left-wall',
        position: [-halfSize + wallThickness / 2, floorTop + wallHeight / 2, 0],
        size: [wallThickness, wallHeight, size],
      },
      {
        key: 'left-accent',
        position: [-halfSize + wallThickness / 2, floorTop + wallHeight + accentHeight / 2, 0],
        size: [wallThickness + 0.02, accentHeight, size],
        isAccent: true,
      }
    )

    // Right wall (full depth, at +X)
    segs.push(
      {
        key: 'right-wall',
        position: [halfSize - wallThickness / 2, floorTop + wallHeight / 2, 0],
        size: [wallThickness, wallHeight, size],
      },
      {
        key: 'right-accent',
        position: [halfSize - wallThickness / 2, floorTop + wallHeight + accentHeight / 2, 0],
        size: [wallThickness + 0.02, accentHeight, size],
        isAccent: true,
      }
    )

    // Front wall (at -Z) — TWO segments with a gap in the middle
    const sideWidth = (size - gapWidth) / 2
    // Front-left segment
    segs.push(
      {
        key: 'front-left-wall',
        position: [
          -halfSize + sideWidth / 2,
          floorTop + wallHeight / 2,
          -halfSize + wallThickness / 2,
        ],
        size: [sideWidth, wallHeight, wallThickness],
      },
      {
        key: 'front-left-accent',
        position: [
          -halfSize + sideWidth / 2,
          floorTop + wallHeight + accentHeight / 2,
          -halfSize + wallThickness / 2,
        ],
        size: [sideWidth, accentHeight, wallThickness + 0.02],
        isAccent: true,
      }
    )
    // Front-right segment
    segs.push(
      {
        key: 'front-right-wall',
        position: [
          halfSize - sideWidth / 2,
          floorTop + wallHeight / 2,
          -halfSize + wallThickness / 2,
        ],
        size: [sideWidth, wallHeight, wallThickness],
      },
      {
        key: 'front-right-accent',
        position: [
          halfSize - sideWidth / 2,
          floorTop + wallHeight + accentHeight / 2,
          -halfSize + wallThickness / 2,
        ],
        size: [sideWidth, accentHeight, wallThickness + 0.02],
        isAccent: true,
      }
    )

    // Rounded cap cylinders along wall tops (corners + ends of gap)
    const capY = floorTop + wallHeight + accentHeight
    const corners: [number, number, number][] = [
      [-halfSize, capY, -halfSize],
      [-halfSize, capY, halfSize],
      [halfSize, capY, -halfSize],
      [halfSize, capY, halfSize],
      // Gap edges
      [-gapWidth / 2, capY, -halfSize],
      [gapWidth / 2, capY, -halfSize],
    ]
    corners.forEach((pos, i) => {
      capPositions.push({ key: `cap-${i}`, position: pos })
    })

    return { segments: segs, caps: capPositions }
  }, [halfSize, size, wallHeight, accentHeight, gapWidth, floorTop])

  const capRadius = wallThickness / 2 + 0.02

  // Track wall vs accent indices for ref assignment
  const wallIndices: number[] = []
  const accentIndices: number[] = []
  segments.forEach((seg, i) => {
    if (seg.isAccent) accentIndices.push(i)
    else wallIndices.push(i)
  })

  // Smooth emissive transition for walls (default style only)
  useFrame(() => {
    if (wallStyle !== 'default') return

    const wallTarget = hovered ? 0.05 : 0
    const accentTarget = hovered ? 0.05 : 0

    for (const mat of wallMatRefs.current) {
      if (!mat) continue
      mat.emissiveIntensity += (wallTarget - mat.emissiveIntensity) * 0.15
      if (hovered) {
        mat.emissive.set(accentColor)
      } else if (mat.emissiveIntensity < 0.003) {
        mat.emissive.set('#000000')
      }
    }

    for (const mat of accentMatRefs.current) {
      if (!mat) continue
      mat.emissiveIntensity += (accentTarget - mat.emissiveIntensity) * 0.15
      if (hovered) {
        mat.emissive.set(accentColor)
      } else if (mat.emissiveIntensity < 0.003) {
        mat.emissive.set('#000000')
      }
    }
  })

  // Reset ref arrays to correct size
  let wallRefIdx = 0
  let accentRefIdx = 0
  wallMatRefs.current.length = wallIndices.length
  accentMatRefs.current.length = accentIndices.length

  const isDefault = wallStyle === 'default'

  return (
    <group>
      {/* Wall segments */}
      {segments.map((seg) => {
        const isAccent = !!seg.isAccent
        const refIdx = isAccent ? accentRefIdx++ : wallRefIdx++

        // For non-default styles, apply shader material to wall bodies
        // Accent strips always use toon accent material
        const useShader = !isDefault && !isAccent && wallShaderMat

        return (
          <mesh key={seg.key} position={seg.position} castShadow receiveShadow>
            <boxGeometry args={seg.size} />
            {useShader ? (
              <primitive object={wallShaderMat!.clone()} attach="material" />
            ) : (
              <meshToonMaterial
                ref={(el) => {
                  if (isAccent) accentMatRefs.current[refIdx] = el
                  else wallMatRefs.current[refIdx] = el
                }}
                {...(isAccent ? accentToon : wallToon)}
                emissive="#000000"
                emissiveIntensity={0}
              />
            )}
          </mesh>
        )
      })}

      {/* Rounded caps on top of walls at corners and gap edges */}
      {caps.map((cap) => (
        <mesh key={cap.key} position={cap.position} rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[capRadius, 12, 12]} />
          <meshToonMaterial {...accentToon} />
        </mesh>
      ))}
    </group>
  )
}
