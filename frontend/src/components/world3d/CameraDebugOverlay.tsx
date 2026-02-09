import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Camera Value Writer (inside Canvas) ───────────────────────
// Writes camera values to a global object every frame

interface CameraValues {
  posX: number
  posY: number
  posZ: number
  targetX: number
  targetY: number
  targetZ: number
}

// Global ref for camera values (shared between Canvas and HUD)
const cameraValues: CameraValues = {
  posX: 0, posY: 0, posZ: 0,
  targetX: 0, targetY: 0, targetZ: 0,
}

// Listeners for updates
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach(fn => fn())
}

/** Place this inside Canvas to track camera values */
export function CameraDebugTracker({ enabled }: { enabled: boolean }) {
  const { camera } = useThree()
  const dir = useRef(new THREE.Vector3())
  
  useFrame(() => {
    if (!enabled) return
    
    const pos = camera.position
    camera.getWorldDirection(dir.current)
    const target = pos.clone().add(dir.current.clone().multiplyScalar(10))
    
    cameraValues.posX = pos.x
    cameraValues.posY = pos.y
    cameraValues.posZ = pos.z
    cameraValues.targetX = target.x
    cameraValues.targetY = target.y
    cameraValues.targetZ = target.z
    
    notifyListeners()
  })
  
  return null
}

// ─── HUD Component (outside Canvas) ────────────────────────────

interface CameraDebugHUDProps {
  visible: boolean
}

export function CameraDebugHUD({ visible }: CameraDebugHUDProps) {
  const [values, setValues] = useState<CameraValues>({ ...cameraValues })
  const frameCount = useRef(0)
  
  useEffect(() => {
    if (!visible) return
    
    const update = () => {
      // Throttle to ~10fps to avoid excessive re-renders
      frameCount.current++
      if (frameCount.current % 6 === 0) {
        setValues({ ...cameraValues })
      }
    }
    
    listeners.add(update)
    return () => { listeners.delete(update) }
  }, [visible])
  
  if (!visible) return null
  
  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        bottom: 80,
        background: 'rgba(15, 23, 42, 0.9)',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid rgba(100, 116, 139, 0.3)',
        color: '#e2e8f0',
        pointerEvents: 'none',
        zIndex: 40,
        minWidth: 140,
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.6,
      }}
    >
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>📷 CAMERA</div>
      <div><span style={{ color: '#60a5fa' }}>posX:</span> {values.posX.toFixed(1)}</div>
      <div><span style={{ color: '#60a5fa' }}>posY:</span> {values.posY.toFixed(1)}</div>
      <div><span style={{ color: '#60a5fa' }}>posZ:</span> {values.posZ.toFixed(1)}</div>
      <div style={{ marginTop: 6, color: '#94a3b8' }}>🎯 TARGET</div>
      <div><span style={{ color: '#a78bfa' }}>targetX:</span> {values.targetX.toFixed(1)}</div>
      <div><span style={{ color: '#a78bfa' }}>targetY:</span> {values.targetY.toFixed(1)}</div>
      <div><span style={{ color: '#a78bfa' }}>targetZ:</span> {values.targetZ.toFixed(1)}</div>
    </div>
  )
}

// Legacy export for compatibility (deprecated)
export function CameraDebugOverlay({ visible }: { visible: boolean }) {
  return <CameraDebugTracker enabled={visible} />
}
