import { useState } from 'react'
import type { CrewSession } from '@/lib/api'
import type { BotVariantConfig } from './utils/botVariants'
import type { BotStatus } from './botConstants'
import { ActivityLogStream } from './ActivityLogStream'
import { InfoTab } from './InfoTab'
import { ActionsTab } from './ActionsTab'

type TabId = 'activity' | 'info' | 'actions'

interface BotInfoTabsProps {
  session: CrewSession
  displayName: string
  botConfig: BotVariantConfig
  status: BotStatus
  bio?: string | null
  agentId?: string | null
  currentRoomId?: string | null
  canChat: boolean
  onOpenLog: (session: CrewSession) => void
  onAssignmentChanged?: () => void
  onBioUpdated?: () => void
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'activity', label: 'Activity', icon: '💬' },
  { id: 'info', label: 'Info', icon: '📋' },
  { id: 'actions', label: 'Actions', icon: '⚙️' },
]

export function BotInfoTabs({
  session,
  displayName,
  botConfig,
  status,
  bio,
  agentId,
  currentRoomId,
  canChat,
  onOpenLog,
  onAssignmentChanged,
  onBioUpdated,
}: BotInfoTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('activity')

  return (
    <>
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '0 16px',
        marginBottom: 0,
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '8px 4px',
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? botConfig.color : '#9ca3af',
                background: isActive ? botConfig.color + '10' : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${botConfig.color}` : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.color = '#6b7280'
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.color = '#9ca3af'
              }}
            >
              <span style={{ fontSize: 12 }}>{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px 16px',
      }}>
        {activeTab === 'activity' && (
          <ActivityLogStream
            sessionKey={session.key}
            onOpenFullLog={() => onOpenLog(session)}
          />
        )}
        {activeTab === 'info' && (
          <InfoTab
            session={session}
            botConfig={botConfig}
            status={status}
            bio={bio}
            agentId={agentId}
            displayName={displayName}
            onBioUpdated={onBioUpdated}
          />
        )}
        {activeTab === 'actions' && (
          <ActionsTab
            session={session}
            displayName={displayName}
            botConfig={botConfig}
            currentRoomId={currentRoomId}
            canChat={canChat}
            onOpenLog={onOpenLog}
            onAssignmentChanged={onAssignmentChanged}
          />
        )}
      </div>
    </>
  )
}
