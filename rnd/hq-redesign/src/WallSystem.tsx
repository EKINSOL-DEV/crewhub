import { createContext, useContext, useRef, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * WallSystem - Raycasting-based transparent wall shader.
 *
 * Technique:
 * 1. All wall meshes register themselves with the WallManager
 * 2. Each frame, we cast multiple rays from camera toward the building
 * 3. The FIRST wall hit by any ray gets its opacity reduced (transparent)
 * 4. All other walls remain fully opaque
 *
 * This creates a natural "x-ray" effect: you see through exactly ONE wall
 * (the closest one between you and the interior), while all other walls
 * remain solid.
 */

interface WallManagerState {
  register: (mesh: THREE.Mesh) => void
  unregister: (mesh: THREE.Mesh) => void
}

const WallContext = createContext<WallManagerState>({
  register: () => {},
  unregister: () => {},
})

// Custom shader for walls that can be individually toggled transparent
const wallVertexShader = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const wallFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTargetOpacity;
  uniform float uEmissive;
  uniform vec3 uEmissiveColor;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    // Lighting
    vec3 lightDir1 = normalize(vec3(1.0, 1.5, 1.0));
    vec3 lightDir2 = normalize(vec3(-0.5, 0.8, -1.0));
    float diff1 = max(dot(vWorldNormal, lightDir1), 0.0);
    float diff2 = max(dot(vWorldNormal, lightDir2), 0.0) * 0.3;
    float ambient = 0.25;

    vec3 color = uColor * (ambient + 0.6 * diff1 + diff2);
    color += uEmissiveColor * uEmissive;

    // Smooth opacity transition
    float alpha = uOpacity;

    // Subtle edge darkening for depth
    float edge = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 3.0) * 0.15;
    color *= edge;

    gl_FragColor = vec4(color, alpha);
  }
`

export function WallProvider({ children, buildingCenter = [0, 2, 0] as [number, number, number] }: {
  children: React.ReactNode
  buildingCenter?: [number, number, number]
}) {
  const wallsRef = useRef<Set<THREE.Mesh>>(new Set())
  const raycaster = useRef(new THREE.Raycaster())
  const centerVec = useRef(new THREE.Vector3(...buildingCenter))
  const currentTransparent = useRef<THREE.Mesh | null>(null)

  const register = useCallback((mesh: THREE.Mesh) => {
    wallsRef.current.add(mesh)
  }, [])

  const unregister = useCallback((mesh: THREE.Mesh) => {
    wallsRef.current.delete(mesh)
  }, [])

  useFrame(({ camera }) => {
    const walls = Array.from(wallsRef.current)
    if (walls.length === 0) return

    // Cast rays from camera toward multiple points on the building
    // This ensures we catch walls even when not looking at dead center
    const camPos = camera.position
    const targets = [
      centerVec.current,
      new THREE.Vector3(centerVec.current.x, centerVec.current.y + 2, centerVec.current.z),
      new THREE.Vector3(centerVec.current.x, centerVec.current.y - 1, centerVec.current.z),
    ]

    let closestWall: THREE.Mesh | null = null
    let closestDist = Infinity

    for (const target of targets) {
      const dir = target.clone().sub(camPos).normalize()
      raycaster.current.set(camPos, dir)
      const hits = raycaster.current.intersectObjects(walls, false)

      if (hits.length > 0 && hits[0].distance < closestDist) {
        closestDist = hits[0].distance
        closestWall = hits[0].object as THREE.Mesh
      }
    }

    // Smoothly transition opacities
    for (const wall of walls) {
      const mat = wall.material as THREE.ShaderMaterial
      if (!mat.uniforms) continue

      const isTarget = wall === closestWall
      const targetOpacity = isTarget ? 0.06 : mat.uniforms.uTargetOpacity.value

      // Smooth lerp
      mat.uniforms.uOpacity.value += (targetOpacity - mat.uniforms.uOpacity.value) * 0.12
    }
  })

  return (
    <WallContext.Provider value={{ register, unregister }}>
      {children}
    </WallContext.Provider>
  )
}

// Hook to use wall context
export function useWallSystem() {
  return useContext(WallContext)
}

interface WallMeshProps {
  color?: string
  opacity?: number
  emissive?: number
  emissiveColor?: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  children?: React.ReactNode
}

export function Wall({
  color = '#8899aa', opacity = 0.92, emissive = 0, emissiveColor = '#000000',
  position, rotation, scale, children
}: WallMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const { register, unregister } = useWallSystem()

  const uniforms = useRef({
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: opacity },
    uTargetOpacity: { value: opacity },
    uEmissive: { value: emissive },
    uEmissiveColor: { value: new THREE.Color(emissiveColor) },
  })

  useEffect(() => {
    const mesh = meshRef.current
    if (mesh) {
      register(mesh)
      return () => unregister(mesh)
    }
  }, [register, unregister])

  return (
    <mesh ref={meshRef} position={position} rotation={rotation} scale={scale} castShadow>
      {children || <boxGeometry args={[4, 3, 0.12]} />}
      <shaderMaterial
        vertexShader={wallVertexShader}
        fragmentShader={wallFragmentShader}
        uniforms={uniforms.current}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}
