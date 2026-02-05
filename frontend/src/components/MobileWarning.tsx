import { useState, useEffect } from 'react'
import { Monitor } from 'lucide-react'

export function MobileWarning() {
  const [isMobile, setIsMobile] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (!isMobile || dismissed) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <Monitor style={{ width: 64, height: 64, color: '#6366f1', marginBottom: 24 }} />
      <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Desktop Only
      </h1>
      <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.6, maxWidth: 320, marginBottom: 24 }}>
        CrewHub's 3D world is optimized for larger screens. Please visit on a desktop or tablet for the full experience.
      </p>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: '#6366f1',
          color: '#fff',
          border: 'none',
          padding: '12px 24px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Continue Anyway
      </button>
    </div>
  )
}
