import type { CrewSession } from '@/lib/api'
import type { BotVariantConfig } from './utils/botVariants'
import type { BotStatus } from './botConstants'
import { EditBioDialog } from '@/components/shared/EditBioDialog'
import { useState } from 'react'
import { formatTokens } from '@/lib/formatters'

interface InfoTabProps {
  session: CrewSession
  botConfig: BotVariantConfig
  status: BotStatus
  bio?: string | null
  agentId?: string | null
  displayName: string
  onBioUpdated?: () => void
}

function formatTimeSince(updatedAt: number): string {
  const seconds = Math.floor((Date.now() - updatedAt) / 1000)
  if (seconds < 30) return 'Active now'
  if (seconds < 60) return `Idle ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Idle ${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `Idle ${hours}h ${minutes % 60}m`
}

function formatModel(model?: string): string {
  if (!model) return 'Unknown'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('opus')) return 'Opus'
  if (model.includes('haiku')) return 'Haiku'
  if (model.includes('gpt-4o')) return 'GPT-4o'
  if (model.includes('gpt-4')) return 'GPT-4'
  if (model.includes('gpt-5')) return 'GPT-5'
  const parts = model.split('/')
  return parts[parts.length - 1].slice(0, 24)
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{children}</span>
    </div>
  )
}

export function InfoTab({ session, botConfig, status: _, bio, agentId, displayName, onBioUpdated }: InfoTabProps) {
  const [bioDialogOpen, setBioDialogOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Bio */}
      <div>
        {bio && (
          <div style={{
            fontSize: 13,
            color: '#6b7280',
            lineHeight: 1.5,
            fontStyle: 'italic',
            padding: '8px 12px',
            background: `${botConfig.color}08`,
            borderRadius: 10,
            borderLeft: `3px solid ${botConfig.color}40`,
            marginBottom: 8,
          }}>
            {bio}
          </div>
        )}
        {agentId && (
          <button
            onClick={() => setBioDialogOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              color: '#6b7280',
              background: 'rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)'
              e.currentTarget.style.color = '#374151'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)'
              e.currentTarget.style.color = '#6b7280'
            }}
          >
            {bio ? '✏️ Update Bio' : '✨ Create Bio'}
          </button>
        )}
      </div>

      <InfoRow label="Type">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: botConfig.color, display: 'inline-block' }} />
          {botConfig.label}
        </span>
      </InfoRow>

      <InfoRow label="Status">{formatTimeSince(session.updatedAt)}</InfoRow>
      <InfoRow label="Model">{formatModel(session.model)}</InfoRow>
      <InfoRow label="Tokens">{formatTokens(session.totalTokens)}</InfoRow>

      {session.lastChannel && (
        <InfoRow label="Channel">{session.lastChannel}</InfoRow>
      )}

      <EditBioDialog
        agentId={agentId || null}
        agentName={displayName}
        currentBio={bio || null}
        open={bioDialogOpen}
        onOpenChange={setBioDialogOpen}
        onSaved={onBioUpdated}
      />
    </div>
  )
}
