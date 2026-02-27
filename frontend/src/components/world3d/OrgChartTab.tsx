// ── Org Chart Tab ── Shows team hierarchy for HQ room

const HIERARCHY: Record<
  string,
  { role: string; model?: string; icon?: string; children: string[] }
> = {
  Nicky: { role: 'Owner / CEO / CTO', icon: '👨‍💼', children: ['Assistent'] },
  Assistent: {
    role: 'Director of Bots',
    model: 'Sonnet',
    icon: '🤖',
    children: ['Dev', 'Game Dev', 'Reviewer', 'Flowy'],
  },
  Dev: { role: 'Developer', model: 'Opus', icon: '💻', children: [] },
  'Game Dev': { role: '3D / Three.js specialist', model: 'Opus', icon: '🎮', children: [] },
  Reviewer: { role: 'Code Review', model: 'GPT-5.2', icon: '🔍', children: [] },
  Flowy: { role: 'PO/PM marketing & media', model: 'GPT-5.2', icon: '📊', children: ['Creator'] },
  Creator: { role: 'Video specialist', model: 'Sonnet', icon: '🎬', children: [] },
}

function modelColor(model?: string): string {
  if (!model) return '#6b7280'
  if (model.includes('Opus')) return '#7c3aed'
  if (model.includes('Sonnet')) return '#2563eb'
  if (model.includes('GPT')) return '#059669'
  return '#6b7280'
}

function OrgNode({ name, depth = 0 }: Readonly<{ name: string; readonly depth?: number }>) {
  const node = HIERARCHY[name]
  if (!node) return null

  const isHuman = !node.model

  return (
    <li style={{ listStyle: 'none', paddingLeft: depth > 0 ? 20 : 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          marginBottom: 2,
          borderRadius: 10,
          background: isHuman ? 'rgba(245,158,11,0.08)' : 'rgba(0,0,0,0.03)',
          borderLeft: depth > 0 ? `3px solid ${modelColor(node.model)}` : 'none',
        }}
      >
        <span style={{ fontSize: 18 }}>{node.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{name}</span>
            {node.model && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: modelColor(node.model),
                  background: modelColor(node.model) + '15',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {node.model}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{node.role}</div>
        </div>
      </div>

      {node.children.length > 0 && (
        <ul
          style={{
            marginLeft: 8,
            borderLeft: '1px solid rgba(0,0,0,0.06)',
            paddingLeft: 0,
            marginTop: 0,
            marginBottom: 0,
          }}
        >
          {node.children.map((child) => (
            <OrgNode key={child} name={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function OrgChartTab() {
  return (
    <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 12,
        }}
      >
        🏢 Team Hierarchy
      </div>
      <ul style={{ margin: 0, padding: 0 }}>
        <OrgNode name="Nicky" depth={0} />
      </ul>
    </div>
  )
}
