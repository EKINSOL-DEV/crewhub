import { useChatContext } from '@/contexts/ChatContext'
import type { CrewSession } from '@/lib/api'
import type { BotVariantConfig } from './utils/botVariants'

interface BotQuickActionsProps {
  session: CrewSession
  displayName: string
  botConfig: BotVariantConfig
  canChat: boolean
  onOpenLog: (session: CrewSession) => void
}

export function BotQuickActions({ session, displayName, botConfig, canChat, onOpenLog }: BotQuickActionsProps) {
  const { openChat } = useChatContext()

  const buttons = [
    ...(canChat ? [{
      icon: '💬',
      label: 'Chat',
      onClick: () => openChat(session.key, displayName, botConfig.icon, botConfig.color),
    }] : []),
    {
      icon: '📋',
      label: 'Logs',
      onClick: () => onOpenLog(session),
    },
  ]

  return (
    <div
      data-world-ui
      style={{
        position: 'absolute',
        top: 36,
        right: 344, // 320 (panel width) + 16 (panel right) + 8 (gap)
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        animation: 'quickActionsSlideIn 0.3s ease-out',
      }}
    >
      {buttons.map(btn => (
        <button
          key={btn.label}
          onClick={btn.onClick}
          title={btn.label}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            transition: 'all 0.15s',
            position: 'relative',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)'
            e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.12)'
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)'
            e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.08)'
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)'
          }}
        >
          {btn.icon}
        </button>
      ))}

      <style>{`
        @keyframes quickActionsSlideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
