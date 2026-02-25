/**
 * MeetingViewMenu — Left sidebar menu for meeting results.
 * Matches TOCSidebar visual style from markdown viewer.
 */

export type MeetingView = 'structured' | 'actions' | 'transcript' | 'raw'

interface MenuItem {
  id: MeetingView
  icon: string
  label: string
  badge?: number
}

interface MeetingViewMenuProps {
  activeView: MeetingView
  onSelect: (view: MeetingView) => void
  actionCount?: number
  roundCount?: number
}

export function MeetingViewMenu({
  activeView,
  onSelect,
  actionCount = 0,
  roundCount = 0,
}: MeetingViewMenuProps) {
  const items: MenuItem[] = [
    { id: 'structured', icon: '📋', label: 'Structured View' },
    { id: 'actions', icon: '✅', label: 'Actions', badge: actionCount || undefined },
    { id: 'transcript', icon: '💬', label: 'Transcript', badge: roundCount || undefined },
    { id: 'raw', icon: '📄', label: 'Raw Markdown' },
  ]

  return (
    <div
      style={{
        width: 220,
        minWidth: 220,
        borderRight: '1px solid hsl(var(--border))',
        overflow: 'auto',
        padding: '12px 0',
        background: 'hsl(var(--card))',
      }}
    >
      <div
        style={{
          padding: '0 12px 8px',
          borderBottom: '1px solid hsl(var(--border))',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          Views
        </span>
      </div>
      {items.map((item) => {
        const isActive = item.id === activeView
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              textAlign: 'left',
              padding: '7px 12px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              background: isActive ? 'hsl(var(--primary) / 0.1)' : 'transparent',
              border: 'none',
              borderLeft: isActive ? '2px solid hsl(var(--primary))' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.1s',
              fontFamily: 'system-ui, sans-serif',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'hsl(var(--secondary))'
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge != null && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  background: isActive ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--secondary))',
                  color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  padding: '1px 6px',
                  borderRadius: 8,
                }}
              >
                {item.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
