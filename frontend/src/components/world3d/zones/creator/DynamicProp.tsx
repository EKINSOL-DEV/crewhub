import { useToonMaterialProps } from '../../utils/toonMaterials'

export interface PropPart {
  type: string // "box" | "cylinder" | "sphere" | "cone" | "torus"
  position: [number, number, number]
  args: number[]
  color: string
  emissive?: boolean
}

interface DynamicPropProps {
  parts: PropPart[]
  position?: [number, number, number]
  scale?: number
  onClick?: () => void
}

function DynamicMesh({ part }: { part: PropPart }) {
  const toon = useToonMaterialProps(part.color)

  const geometry = (() => {
    switch (part.type) {
      case 'box': return <boxGeometry args={part.args as any} />
      case 'cylinder': return <cylinderGeometry args={part.args as any} />
      case 'sphere': return <sphereGeometry args={part.args as any} />
      case 'cone': return <coneGeometry args={part.args as any} />
      case 'torus': return <torusGeometry args={part.args as any} />
      default: return <boxGeometry args={[0.3, 0.3, 0.3]} />
    }
  })()

  return (
    <mesh position={part.position} castShadow>
      {geometry}
      {part.emissive ? (
        <meshStandardMaterial
          color={part.color}
          emissive={part.color}
          emissiveIntensity={0.5}
        />
      ) : (
        <meshToonMaterial {...toon} />
      )}
    </mesh>
  )
}

/**
 * Renders a prop from structured parts data — no eval needed.
 */
export function DynamicProp({ parts, position = [0, 0, 0], scale = 1, onClick }: DynamicPropProps) {
  return (
    <group position={position} scale={scale} onClick={onClick}>
      {parts.map((part, i) => (
        <DynamicMesh key={i} part={part} />
      ))}
    </group>
  )
}
