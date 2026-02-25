import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { BotChestType } from './utils/botVariants'

interface BotChestDisplayProps {
  readonly type: BotChestType
  readonly color: string
}

/**
 * Per-type chest display / icon on the bot's body.
 * Positioned on the front of the body (y ≈ 0.02, z = front face).
 *
 * - Worker: scissor/wrench tool icon
 * - Thinker: three dots on lower body
 * - Cron: "12:00" digital clock display
 * - Comms: "..." chat dots
 * - Dev: "</>" code display
 */
export function BotChestDisplay({ type, color }: BotChestDisplayProps) {
  const displayY = 0.0 // On the body (body center = -0.02)
  const displayZ = 0.18 // Front face of body (pushed forward to avoid clipping)

  return (
    <group position={[0, displayY, displayZ]}>
      {type === 'tool' && <ToolIcon />}
      {type === 'dots' && <ThreeDotsIcon color={color} />}
      {type === 'clock-display' && <ClockDisplay />}
      {type === 'chat-dots' && <ChatDotsIcon />}
      {type === 'code' && <CodeDisplay />}
    </group>
  )
}

// ─── Worker: Tool/scissor icon ─────────────────────────────────

function ToolIcon() {
  return (
    <group>
      {/* Wrench/cross tool shape */}
      <mesh rotation={[0, 0, 0.7]}>
        <boxGeometry args={[0.08, 0.015, 0.004]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh rotation={[0, 0, -0.7]}>
        <boxGeometry args={[0.08, 0.015, 0.004]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Center pivot */}
      <mesh position={[0, 0, 0.002]}>
        <circleGeometry args={[0.01, 8]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </group>
  )
}

// ─── Thinker: Three dots (buttons on lower body) ───────────────

function ThreeDotsIcon({ color }: { color: string }) {
  const dotColor = new THREE.Color(color).multiplyScalar(1.3)
  const hex = '#' + dotColor.getHexString()
  return (
    <group position={[0, -0.12, 0]}>
      {[-0.04, 0, 0.04].map((x, i) => (
        <mesh key={`x-${i}`} position={[x, 0, 0]}>
          <circleGeometry args={[0.018, 10]} />
          <meshStandardMaterial color={hex} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Cron: Digital clock display "12:00" ───────────────────────

/**
 * Simple 7-segment style digit using boxes.
 * Much lighter than Troika Text and avoids shader injection issues.
 */
function SevenSegmentDigit({
  digit,
  position,
  color,
}: {
  digit: string
  position: [number, number, number]
  color: string
}) {
  // Segment configuration for each digit (top, top-left, top-right, middle, bottom-left, bottom-right, bottom)
  const segments: Record<string, boolean[]> = {
    '0': [true, true, true, false, true, true, true],
    '1': [false, false, true, false, false, true, false],
    '2': [true, false, true, true, true, false, true],
    ':': [], // Special case: colon
  }
  const seg = segments[digit] || segments['0']
  const s = 0.012 // segment thickness
  const w = 0.018 // segment width
  const h = 0.022 // segment height (half)

  if (digit === ':') {
    return (
      <group position={position}>
        <mesh position={[0, h * 0.5, 0]}>
          <boxGeometry args={[s, s, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0, -h * 0.5, 0]}>
          <boxGeometry args={[s, s, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    )
  }

  return (
    <group position={position}>
      {/* Top horizontal */}
      {seg[0] && (
        <mesh position={[0, h, 0]}>
          <boxGeometry args={[w, s, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {/* Top-left vertical */}
      {seg[1] && (
        <mesh position={[-w / 2 - s / 4, h / 2, 0]}>
          <boxGeometry args={[s, h, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {/* Top-right vertical */}
      {seg[2] && (
        <mesh position={[w / 2 + s / 4, h / 2, 0]}>
          <boxGeometry args={[s, h, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {/* Middle horizontal */}
      {seg[3] && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[w, s, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {/* Bottom-left vertical */}
      {seg[4] && (
        <mesh position={[-w / 2 - s / 4, -h / 2, 0]}>
          <boxGeometry args={[s, h, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {/* Bottom-right vertical */}
      {seg[5] && (
        <mesh position={[w / 2 + s / 4, -h / 2, 0]}>
          <boxGeometry args={[s, h, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {/* Bottom horizontal */}
      {seg[6] && (
        <mesh position={[0, -h, 0]}>
          <boxGeometry args={[w, s, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  )
}

function ClockDisplay() {
  const color = '#7fff00'
  const spacing = 0.032

  return (
    <group>
      {/* Dark background panel */}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[0.18, 0.09]} />
        <meshStandardMaterial color="#1a3a0a" />
      </mesh>
      {/* Border */}
      <mesh position={[0, 0, -0.003]}>
        <planeGeometry args={[0.2, 0.11]} />
        <meshStandardMaterial color="#4a6a1a" />
      </mesh>
      {/* "12:00" using 7-segment style digits */}
      <group position={[0, 0, 0.001]}>
        <SevenSegmentDigit digit="1" position={[-spacing * 1.7, 0, 0]} color={color} />
        <SevenSegmentDigit digit="2" position={[-spacing * 0.5, 0, 0]} color={color} />
        <SevenSegmentDigit digit=":" position={[spacing * 0.4, 0, 0]} color={color} />
        <SevenSegmentDigit digit="0" position={[spacing * 1.2, 0, 0]} color={color} />
        <SevenSegmentDigit digit="0" position={[spacing * 2.4, 0, 0]} color={color} />
      </group>
    </group>
  )
}

// ─── Comms: Chat dots "..." ────────────────────────────────────

function ChatDotsIcon() {
  return (
    <group>
      {[-0.035, 0, 0.035].map((x, i) => (
        <AnimatedDot key={`x-${i}`} x={x} delay={i * 0.4} />
      ))}
    </group>
  )
}

function AnimatedDot({ x, delay }: { x: number; delay: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    // Subtle bounce animation
    ref.current.position.y = Math.sin((t + delay) * 2.5) * 0.008
  })

  return (
    <mesh ref={ref} position={[x, 0, 0]}>
      <circleGeometry args={[0.016, 10]} />
      <meshStandardMaterial color="white" />
    </mesh>
  )
}

// ─── Dev: Code display "</>" ───────────────────────────────────

/**
 * Simple code bracket icon using line segments.
 * Displays "</>" symbol without Troika Text to avoid shader issues.
 */
function CodeBrackets({ color }: { color: string }) {
  const t = 0.008 // line thickness
  const h = 0.04 // bracket height
  const w = 0.015 // bracket width

  return (
    <group>
      {/* Left angle bracket "<" */}
      <group position={[-0.04, 0, 0]}>
        <mesh position={[-w / 4, h / 4, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[w * 1.2, t, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[-w / 4, -h / 4, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[w * 1.2, t, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>

      {/* Slash "/" */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[t, h * 1.1, 0.002]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Right angle bracket ">" */}
      <group position={[0.04, 0, 0]}>
        <mesh position={[w / 4, h / 4, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[w * 1.2, t, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[w / 4, -h / 4, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[w * 1.2, t, 0.002]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    </group>
  )
}

function CodeDisplay() {
  return (
    <group>
      {/* Dark background panel */}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[0.2, 0.09]} />
        <meshStandardMaterial color="#2a0a0a" />
      </mesh>
      {/* Border */}
      <mesh position={[0, 0, -0.003]}>
        <planeGeometry args={[0.22, 0.11]} />
        <meshStandardMaterial color="#5a1a1a" />
      </mesh>
      {/* "</>" code brackets */}
      <group position={[0, 0, 0.001]}>
        <CodeBrackets color="#ff6b6b" />
      </group>
    </group>
  )
}
