/**
 * BotSpeechBubble — Speech bubble overlay in 3D space above a bot.
 *
 * Uses `Html` from `@react-three/drei` to render HTML in 3D.
 * Shows truncated response text (~60 chars).
 */

import { Html } from '@react-three/drei'

interface BotSpeechBubbleProps {
  text: string
  /** Position offset above the bot (world units) */
  yOffset?: number
  /** Max chars to show (default 60) */
  maxChars?: number
}

export function BotSpeechBubble({
  text,
  yOffset = 1.4,
  maxChars = 60,
}: BotSpeechBubbleProps) {
  if (!text) return null

  const truncated = text.length > maxChars ? text.slice(0, maxChars) + '…' : text

  return (
    <Html
      position={[0, yOffset, 0]}
      center
      distanceFactor={12}
      zIndexRange={[5, 10]}
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
  )
}
