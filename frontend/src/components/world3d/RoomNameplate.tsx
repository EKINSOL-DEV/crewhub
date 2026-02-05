import { useRef, useMemo } from 'react'
import { Text, Center, Text3D } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useToonMaterialProps } from './utils/toonMaterials'

interface RoomNameplateProps {
  name: string
  icon?: string | null
  color?: string
  size?: number
  hovered?: boolean
  projectName?: string | null
  projectColor?: string | null
  isHQ?: boolean
}

// ─── Constants ─────────────────────────────────────────────────

const FONT_URL = '/fonts/helvetiker_bold.typeface.json'
const FLOOR_TOP = 0.16
const WALL_HEIGHT = 1.5
const EXTRUSION_DEPTH = 0.12   // how far letters protrude from wall
const ROOM_NAME_SIZE = 0.36    // font size for room name
const SUBTITLE_SIZE = 0.17     // font size for project subtitle

/**
 * 3D wall text mounted directly on the front exterior wall of each room.
 *
 * Renders the room name as extruded 3D letters (Text3D) on the front wall,
 * styled like "Hospital" signage in Two Point Hospital — bold embossed letters
 * in the room's accent color with toon cel-shading.
 *
 * Layout (top to bottom):
 *   [emoji icon]
 *   [ROOM NAME]    ← 3D extruded, toon-shaded
 *   [subtitle]     ← project badge / COMMAND CENTER / GENERAL
 *
 * On hover: smooth 6% scale bump.
 */
export function RoomNameplate({
  name,
  icon,
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

  // ─── Subtitle logic ──────────────────────────────────────────

  const hasProject = !!projectName

  const { subtitleText, subtitleColor, subtitleOpacity } = useMemo(() => {
    if (isHQ) {
      return { subtitleText: '★ COMMAND CENTER', subtitleColor: '#FFD700', subtitleOpacity: 0.9 }
    }
    if (hasProject) {
      return {
        subtitleText: `● ${projectName}`,
        subtitleColor: projectColor || '#6b7280',
        subtitleOpacity: 0.85,
      }
    }
    return { subtitleText: 'GENERAL', subtitleColor: '#9ca3af', subtitleOpacity: 0.5 }
  }, [isHQ, hasProject, projectName, projectColor])

  // ─── Positioning on front wall exterior ──────────────────────
  //
  // Front wall exterior face sits at Z = -halfSize.
  // TextGeometry: front face at z=0 faces -Z (toward camera), extrusion toward +Z.
  // Place text so back of extrusion is flush with wall → z = -halfSize - extrusionDepth.

  const wallZ = -halfSize - EXTRUSION_DEPTH
  const wallMidY = FLOOR_TOP + WALL_HEIGHT * 0.55  // slightly above center, eye-level

  // Vertical layout offsets from wallMidY
  const emojiY = wallMidY + 0.5
  const nameY = wallMidY
  const subtitleY = wallMidY - 0.4

  // Fit text within room width (leave margins for wall thickness + padding)
  const maxTextWidth = size - 2.5

  // ─── Hover animation ────────────────────────────────────────

  useFrame(() => {
    if (!groupRef.current) return
    const target = hovered ? 1.06 : 1.0
    const current = groupRef.current.scale.x
    groupRef.current.scale.setScalar(current + (target - current) * 0.12)
  })

  return (
    <group ref={groupRef}>
      {/* ── Emoji icon above room name ── */}
      {/* SDF Text (troika) supports emoji glyphs; Text3D does not */}
      {icon && (
        <Text
          position={[0, emojiY, wallZ - 0.02]}
          fontSize={0.44}
          anchorX="center"
          anchorY="middle"
        >
          {icon}
        </Text>
      )}

      {/* ── 3D extruded room name (embossed on wall) ── */}
      <group position={[0, nameY, wallZ]}>
        <Center>
          <Text3D
            font={FONT_URL}
            size={ROOM_NAME_SIZE}
            height={EXTRUSION_DEPTH}
            bevelEnabled
            bevelThickness={0.018}
            bevelSize={0.012}
            bevelSegments={3}
            curveSegments={8}
            castShadow
          >
            {name.toUpperCase()}
            <meshToonMaterial {...accentToon} />
          </Text3D>
        </Center>
      </group>

      {/* ── Subtitle line (project / HQ / general) ── */}
      <Text
        position={[0, subtitleY, wallZ - 0.02]}
        fontSize={SUBTITLE_SIZE}
        color={subtitleColor}
        anchorX="center"
        anchorY="middle"
        maxWidth={maxTextWidth}
        fillOpacity={subtitleOpacity}
        fontWeight={700}
      >
        {subtitleText}
      </Text>
    </group>
  )
}
