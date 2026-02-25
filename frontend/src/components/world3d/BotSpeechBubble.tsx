/**
 * BotSpeechBubble — Speech bubble overlay in 3D space above a bot.
 *
 * Uses `Html` from `@react-three/drei` to render HTML in 3D.
 * Shows truncated response text (~60 chars).
 *
 * Dynamically adjusts z-index based on depth relative to screen meshes,
 * so bubbles render in front of screens when the bot is closer to the camera.
 */

import { useState, useRef, useCallback } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface BotSpeechBubbleProps {
  text: string
  /** Position offset above the bot (world units) */
  yOffset?: number
  /** Max chars to show (default 60) */
  maxChars?: number
}

// Reusable vectors to avoid allocations in the render loop
const _botWorldPos = new THREE.Vector3()
const _screenWorldPos = new THREE.Vector3()

/**
 * Collect all Html-container screen meshes in the scene.
 * We look for meshes whose ancestor groups contain Html elements
 * (identified by the TaskWall3D / screen pattern).
 * Simpler approach: find all meshes with userData.isScreen or
 * just traverse for groups named with "screen"/"taskwall"/"monitor".
 */
function findScreenPositions(scene: THREE.Scene): THREE.Vector3[] {
  const positions: THREE.Vector3[] = []
  scene.traverse((obj) => {
    if ((obj as any).userData?.isScreenHtml) {
      obj.getWorldPosition(_screenWorldPos)
      positions.push(_screenWorldPos.clone())
    }
  })
  return positions
}

export function BotSpeechBubble({ text, yOffset = 1.4, maxChars = 60 }: BotSpeechBubbleProps) {
  const [zRange, setZRange] = useState<[number, number]>([50, 40])
  const groupRef = useRef<THREE.Group>(null)
  const { scene } = useThree()
  const frameCount = useRef(0)

  // Throttled depth check — every 6 frames (~10Hz at 60fps)
  const updateZIndex = useCallback(
    (camera: THREE.Camera) => {
      if (!groupRef.current) return

      // Get bot world position (the parent group of this Html)
      groupRef.current.getWorldPosition(_botWorldPos)
      const botDist = camera.position.distanceTo(_botWorldPos)

      // Find screen positions and check if bot is in front of all of them
      const screenPositions = findScreenPositions(scene)

      if (screenPositions.length === 0) {
        // No screens — always on top
        setZRange((prev) => (prev[0] === 50 ? prev : [50, 40]))
        return
      }

      // Is bot closer to camera than the nearest screen?
      let closestScreenDist = Infinity
      for (const sp of screenPositions) {
        const d = camera.position.distanceTo(sp)
        if (d < closestScreenDist) closestScreenDist = d
      }

      const botInFront = botDist < closestScreenDist
      const newRange: [number, number] = botInFront ? [50, 40] : [1, 0]

      setZRange((prev) => (prev[0] === newRange[0] && prev[1] === newRange[1] ? prev : newRange))
    },
    [scene]
  )

  useFrame(({ camera }) => {
    frameCount.current++
    if (frameCount.current % 6 === 0) {
      updateZIndex(camera)
    }
  })

  if (!text) return null

  const truncated = text.length > maxChars ? text.slice(0, maxChars) + '…' : text

  return (
    <group ref={groupRef}>
      <Html
        position={[0, yOffset, 0]}
        center
        distanceFactor={12}
        zIndexRange={zRange}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.95)',
            color: '#1a1a1a',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 500,
            maxWidth: '200px',
            lineHeight: '1.4',
            fontFamily: 'system-ui, sans-serif',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {truncated}
          {/* Speech bubble triangle */}
          <div
            style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid rgba(255,255,255,0.95)',
            }}
          />
        </div>
      </Html>
    </group>
  )
}
