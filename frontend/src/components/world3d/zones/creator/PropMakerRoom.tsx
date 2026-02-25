import { useState, useCallback } from 'react'
import { PropMakerMachine, type GeneratedPropData } from './PropMakerMachine'
import { PropShowcase, type ShowcaseProp } from './PropShowcase'
import { ShowcasePedestal } from './ShowcasePedestal'
import { ZoneRoom } from '../../ZoneRoom'

interface PropMakerRoomProps {
  position?: [number, number, number]
  size?: number
}

/**
 * Creator Zone — Prop Maker Room
 * Now uses ZoneRoom for consistent room structure (floor, walls, nameplate)
 * matching the main campus rooms. The PropMakerMachine and PropShowcase
 * are rendered as children inside the room.
 */
export function PropMakerRoom({ position = [0, 0, 0], size = 12 }: PropMakerRoomProps) {
  const [showcaseProps, setShowcaseProps] = useState<ShowcaseProp[]>([])

  const handlePropGenerated = useCallback((prop: GeneratedPropData) => {
    const kebabName = prop.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()

    setShowcaseProps((prev) => {
      const next = [
        { propId: kebabName, name: prop.name, parts: prop.parts },
        ...prev.filter((p) => p.propId !== kebabName),
      ].slice(0, 6)
      return next
    })

    // Also save to backend
    fetch('/api/creator/save-prop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: prop.name,
        propId: kebabName,
        parts: prop.parts,
        mountType: 'floor',
        yOffset: 0.16,
      }),
    }).catch((err) => console.warn('[PropMakerRoom] save failed:', err))
  }, [])

  return (
    <ZoneRoom
      name="Prop Maker"
      icon="🔧"
      size={size}
      position={position}
      theme={{
        color: '#7B1FA2', // Creator purple
        floorStyle: 'lab', // Tech-lab floor fits the fabricator theme
        wallStyle: 'two-tone', // Modern two-tone walls
      }}
    >
      {/* Center fabricator machine */}
      <PropMakerMachine position={[0, 0, 0]} onPropGenerated={handlePropGenerated} />

      {/* Showcase pedestal — opens fullscreen gallery */}
      <ShowcasePedestal position={[3.5, 0, -3.5]} />

      {/* Generated props gallery */}
      <PropShowcase props={showcaseProps} position={[0, 0, 0]} radius={3} />

      {/* Neon trim strips along wall tops for Creator Zone flair */}
      {[
        { pos: [0, 1.75, -size / 2 + 0.08] as [number, number, number], rotY: 0 },
        { pos: [0, 1.75, size / 2 - 0.08] as [number, number, number], rotY: 0 },
        { pos: [-size / 2 + 0.08, 1.75, 0] as [number, number, number], rotY: Math.PI / 2 },
        { pos: [size / 2 - 0.08, 1.75, 0] as [number, number, number], rotY: Math.PI / 2 },
      ].map((strip, i) => (
        <mesh key={`trim-${i}`} position={strip.pos} rotation={[0, strip.rotY, 0]}>
          <boxGeometry args={[size - 0.3, 0.04, 0.02]} />
          <meshStandardMaterial
            color="#00ffcc"
            emissive="#00ffcc"
            emissiveIntensity={0.6}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Corner accent lights for atmosphere */}
      {[
        [-size / 2 + 0.5, 0.5, -size / 2 + 0.5],
        [size / 2 - 0.5, 0.5, -size / 2 + 0.5],
        [-size / 2 + 0.5, 0.5, size / 2 - 0.5],
        [size / 2 - 0.5, 0.5, size / 2 - 0.5],
      ].map((pos, i) => (
        <pointLight
          key={`corner-${i}`}
          position={pos as [number, number, number]}
          color="#7B1FA2"
          intensity={0.3}
          distance={5}
          decay={2}
        />
      ))}
    </ZoneRoom>
  )
}
