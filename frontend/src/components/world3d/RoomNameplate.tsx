import { useRef } from 'react'
import { Text, Float } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useToonMaterialProps } from './utils/toonMaterials'

interface RoomNameplateProps {
  name: string
  icon?: string | null
  color?: string
  size?: number  // room size to position above entrance
  hovered?: boolean
  projectName?: string | null
  projectColor?: string | null
  isHQ?: boolean
}

/**
 * Floating nameplate sign above the room entrance.
 * Displays room name on both sides of the sign with 3D text and a slight Float animation.
 *
 * When a project is assigned, shows a subtitle line with colored dot + project name.
 * HQ shows "COMMAND CENTER" in gold. Unassigned rooms show "GENERAL" in muted text.
 *
 * On hover: scales to 1.04 with a smooth tween.
 */
export function RoomNameplate({
  name,
  icon: _icon,
  color,
  size = 12,
  hovered = false,
  projectName,
  projectColor,
  isHQ = false,
}: RoomNameplateProps) {
  const accentColor = color || '#4f46e5'
  const accentToon = useToonMaterialProps(accentColor)
  const halfSize = size / 2
  const groupRef = useRef<THREE.Group>(null)

  // Determine subtitle text and color
  const hasProject = !!projectName
  let subtitleText: string
  let subtitleColor: string
  let subtitleOpacity: number

  if (isHQ) {
    subtitleText = '★ COMMAND CENTER'
    subtitleColor = '#FFD700'
    subtitleOpacity = 0.9
  } else if (hasProject) {
    subtitleText = projectName!
    subtitleColor = projectColor || '#6b7280'
    subtitleOpacity = 0.85
  } else {
    subtitleText = 'GENERAL'
    subtitleColor = '#9ca3af'
    subtitleOpacity = 0.5
  }

  // Sign board dimensions — taller when subtitle is present
  const boardHeight = (hasProject || isHQ) ? 1.0 : 0.7
  const faceHeight = (hasProject || isHQ) ? 0.8 : 0.5

  // Text positioning: shift room name up when subtitle present
  const nameY = (hasProject || isHQ) ? 0.12 : 0
  const subtitleY = -0.18

  // Board height ref for smooth transition
  const boardMeshRef = useRef<THREE.Mesh>(null)
  const frontFaceRef = useRef<THREE.Mesh>(null)
  const backFaceRef = useRef<THREE.Mesh>(null)

  // Smooth scale tween on hover + board height transition
  useFrame(() => {
    if (!groupRef.current) return
    const scaleTarget = hovered ? 1.04 : 1.0
    const current = groupRef.current.scale.x
    const next = current + (scaleTarget - current) * 0.12
    groupRef.current.scale.setScalar(next)

    // Smooth board height transition
    if (boardMeshRef.current) {
      const geo = boardMeshRef.current.geometry as THREE.BoxGeometry
      const currentH = geo.parameters.height
      if (Math.abs(currentH - boardHeight) > 0.01) {
        const newH = currentH + (boardHeight - currentH) * 0.1
        boardMeshRef.current.geometry.dispose()
        boardMeshRef.current.geometry = new THREE.BoxGeometry(3.2, newH, 0.12)
      }
    }
    if (frontFaceRef.current) {
      const geo = frontFaceRef.current.geometry as THREE.BoxGeometry
      const currentH = geo.parameters.height
      if (Math.abs(currentH - faceHeight) > 0.01) {
        const newH = currentH + (faceHeight - currentH) * 0.1
        frontFaceRef.current.geometry.dispose()
        frontFaceRef.current.geometry = new THREE.BoxGeometry(2.9, newH, 0.01)
      }
    }
    if (backFaceRef.current) {
      const geo = backFaceRef.current.geometry as THREE.BoxGeometry
      const currentH = geo.parameters.height
      if (Math.abs(currentH - faceHeight) > 0.01) {
        const newH = currentH + (faceHeight - currentH) * 0.1
        backFaceRef.current.geometry.dispose()
        backFaceRef.current.geometry = new THREE.BoxGeometry(2.9, newH, 0.01)
      }
    }
  })

  return (
    <Float
      speed={2}
      rotationIntensity={0}
      floatIntensity={0.3}
    >
      <group ref={groupRef} position={[0, 2.4, -halfSize + 0.2]}>
        {/* Sign backing board */}
        <mesh ref={boardMeshRef} castShadow>
          <boxGeometry args={[3.2, boardHeight, 0.12]} />
          <meshToonMaterial {...accentToon} />
        </mesh>

        {/* Front face (slightly lighter) */}
        <mesh ref={frontFaceRef} position={[0, 0, 0.065]}>
          <boxGeometry args={[2.9, faceHeight, 0.01]} />
          <meshToonMaterial color="#FFF8F0" gradientMap={accentToon.gradientMap} />
        </mesh>

        {/* Back face (slightly lighter) */}
        <mesh ref={backFaceRef} position={[0, 0, -0.065]}>
          <boxGeometry args={[2.9, faceHeight, 0.01]} />
          <meshToonMaterial color="#FFF8F0" gradientMap={accentToon.gradientMap} />
        </mesh>

        {/* Front text — room name */}
        <Text
          position={[0, nameY, 0.08]}
          fontSize={0.28}
          color="#333333"
          anchorX="center"
          anchorY="middle"
          maxWidth={2.6}
        >
          {name}
        </Text>

        {/* Front text — subtitle (project badge / GENERAL / COMMAND CENTER) */}
        {(hasProject || isHQ || !hasProject) && (
          <Text
            position={[0, subtitleY, 0.08]}
            fontSize={0.16}
            color={subtitleColor}
            anchorX="center"
            anchorY="middle"
            maxWidth={2.4}
            fillOpacity={subtitleOpacity}
          >
            {hasProject && !isHQ ? `● ${subtitleText}` : subtitleText}
          </Text>
        )}

        {/* Back text — room name */}
        <Text
          position={[0, nameY, -0.08]}
          rotation={[0, Math.PI, 0]}
          fontSize={0.28}
          color="#333333"
          anchorX="center"
          anchorY="middle"
          maxWidth={2.6}
        >
          {name}
        </Text>

        {/* Back text — subtitle */}
        {(hasProject || isHQ || !hasProject) && (
          <Text
            position={[0, subtitleY, -0.08]}
            rotation={[0, Math.PI, 0]}
            fontSize={0.16}
            color={subtitleColor}
            anchorX="center"
            anchorY="middle"
            maxWidth={2.4}
            fillOpacity={subtitleOpacity}
          >
            {hasProject && !isHQ ? `● ${subtitleText}` : subtitleText}
          </Text>
        )}

        {/* Support poles */}
        <mesh position={[-1.2, -0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
          <meshToonMaterial {...accentToon} />
        </mesh>
        <mesh position={[1.2, -0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
          <meshToonMaterial {...accentToon} />
        </mesh>
      </group>
    </Float>
  )
}
