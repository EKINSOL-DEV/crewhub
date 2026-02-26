import { DesignEntry } from './designs'

interface UIProps {
  designs: DesignEntry[]
  active: number
  onSelect: (i: number) => void
}

export function UI({ designs, active, onSelect }: Readonly<UIProps>) {
  return (
    <>
      {/* Design selector */}
      <div style={{
        position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10,
      }}>
        {designs.map((d, i) => (
          <button key={d.name} onClick={() => onSelect(i)} style={{
            padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: i === active ? 'rgba(79, 195, 247, 0.9)' : 'rgba(255,255,255,0.08)',
            color: i === active ? '#000' : '#ccc', fontSize: 13, fontWeight: 600,
            transition: 'all 0.3s ease', textAlign: 'left',
            backdropFilter: 'blur(10px)',
            borderLeft: i === active ? '3px solid #4fc3f7' : '3px solid transparent',
          }}>
            {d.name}
          </button>
        ))}
      </div>

      {/* Info panel */}
      <div style={{
        position: 'absolute', bottom: 20, left: 20, right: 20,
        background: 'rgba(13, 17, 23, 0.85)',
        borderRadius: 16, padding: '18px 24px', color: '#fff',
        maxWidth: 500, zIndex: 10,
        backdropFilter: 'blur(16px)', border: '1px solid rgba(79, 195, 247, 0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#4fc3f7' }}>
          {designs[active].name}
        </div>
        <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
          {designs[active].description}
        </div>
        <div style={{
          marginTop: 10, fontSize: 11, opacity: 0.4,
          display: 'flex', gap: 16
        }}>
          <span>🖱️ Orbit: drag</span>
          <span>🔍 Zoom: scroll</span>
          <span>✋ Pan: right-drag</span>
          <span>👁️ Closest wall auto-fades</span>
        </div>
      </div>

      {/* Title */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(13, 17, 23, 0.7)',
        borderRadius: 10, padding: '8px 14px', zIndex: 10,
        backdropFilter: 'blur(10px)',
      }}>
        <span style={{ color: '#4fc3f7', fontSize: 14, fontWeight: 700 }}>HQ</span>
        <span style={{ color: '#888', fontSize: 14 }}> Redesign</span>
      </div>
    </>
  )
}
