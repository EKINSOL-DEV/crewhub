/**
 * MobileDrawer - Side drawer navigation for mobile app
 * Slides in from the left with panel options
 */

import { useEffect, useRef } from 'react'
import {
  FileText,
  MessageSquare,
  ListTodo,
  Settings,
  X,
  Kanban,
  Activity,
  FolderKanban,
  Palette,
} from 'lucide-react'

export type MobilePanel =
  | 'chat'
  | 'docs'
  | 'kanban'
  | 'activity'
  | 'projects'
  | 'tasks'
  | 'settings'
  | 'creator'

interface MobileDrawerProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onNavigate: (panel: MobilePanel) => void
  readonly currentPanel: MobilePanel
}

interface MenuItem {
  id: MobilePanel
  label: string
  icon: typeof FileText
  enabled: boolean
  section?: string
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare, enabled: true },
  { id: 'docs', label: 'Docs', icon: FileText, enabled: true },
  { id: 'kanban', label: 'Kanban', icon: Kanban, enabled: true },
  { id: 'activity', label: 'Activity', icon: Activity, enabled: true },
  { id: 'projects', label: 'Projects', icon: FolderKanban, enabled: true },
  { id: 'tasks', label: 'Tasks', icon: ListTodo, enabled: false },
  { id: 'creator', label: 'Prop Maker', icon: Palette, enabled: true, section: 'Creator' },
  { id: 'settings', label: 'Settings', icon: Settings, enabled: true },
]

export function MobileDrawer({ open, onClose, onNavigate, currentPanel }: MobileDrawerProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  // Close on escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9998,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          maxWidth: '80vw',
          background: 'var(--mobile-surface, #1e293b)',
          zIndex: 9999,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            padding: '20px 20px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--mobile-border, rgba(255,255,255,0.08))',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--mobile-text, #f1f5f9)',
            }}
          >
            CrewHub
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'var(--mobile-surface2, rgba(255,255,255,0.06))',
              color: 'var(--mobile-text-muted, #94a3b8)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Menu items */}
        <nav style={{ flex: 1, padding: '12px 12px', overflow: 'auto' }}>
          {MENU_ITEMS.map((item, idx) => {
            const Icon = item.icon
            const isActive = currentPanel === item.id
            const isDisabled = !item.enabled
            const showSectionHeader = item.section != null

            return (
              <div key={item.id}>
                {/* Section header */}
                {showSectionHeader && (
                  <div
                    style={{
                      padding: '12px 16px 6px',
                      marginTop: idx > 0 ? 4 : 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: 'var(--mobile-border, rgba(255,255,255,0.08))',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--mobile-text-muted, #475569)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.section}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: 'var(--mobile-border, rgba(255,255,255,0.08))',
                      }}
                    />
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!isDisabled) {
                      onNavigate(item.id)
                      onClose()
                    }
                  }}
                  disabled={isDisabled}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    width: '100%',
                    padding: '14px 16px',
                    background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: 12,
                    cursor: isDisabled ? 'default' : 'pointer',
                    color: isDisabled
                      ? 'var(--mobile-text-muted, #475569)'
                      : isActive
                        ? '#818cf8'
                        : 'var(--mobile-text, #cbd5e1)',
                    fontSize: 15,
                    fontWeight: isActive ? 600 : 400,
                    textAlign: 'left',
                    opacity: isDisabled ? 0.5 : 1,
                    transition: 'background 0.15s',
                  }}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                  {isDisabled && (
                    <span
                      style={{
                        fontSize: 10,
                        marginLeft: 'auto',
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.06)',
                        color: '#475569',
                      }}
                    >
                      Soon
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--mobile-border, rgba(255,255,255,0.06))',
            fontSize: 11,
            color: 'var(--mobile-text-muted, #475569)',
          }}
        >
          CrewHub Mobile
        </div>
      </div>
    </>
  )
}
