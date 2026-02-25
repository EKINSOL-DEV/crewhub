import { cn } from '@/lib/utils'
import type { CrewAgent, CrewStatus } from './types'

interface CrewAvatarProps {
  agent: CrewAgent
  size?: 'sm' | 'md' | 'lg'
  showStatus?: boolean
  onClick?: () => void
}

const statusColors: Record<CrewStatus, string> = {
  idle: 'bg-green-500',
  thinking: 'bg-yellow-500 animate-pulse',
  working: 'bg-blue-500 animate-pulse',
  supervising: 'bg-purple-500 animate-pulse',
  success: 'bg-green-400',
  error: 'bg-red-500',
  offline: 'bg-gray-400',
}

// Default status emoji overrides
const defaultStatusEmoji: Record<CrewStatus, string> = {
  idle: '🤖',
  thinking: '🤔',
  working: '⚡',
  supervising: '👁️',
  success: '✨',
  error: '😰',
  offline: '😴',
}

function getStatusEmoji(status: CrewStatus, defaultEmoji: string): string {
  if (status === 'idle') {
    return defaultEmoji // Use agent's default emoji when idle
  }
  return defaultStatusEmoji[status]
}

const sizeClasses = {
  sm: 'w-8 h-8 text-lg',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
}

const statusSizeClasses = {
  sm: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5',
  md: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
  lg: 'w-4 h-4 bottom-0 right-0',
}

export function CrewAvatar({ agent, size = 'md', showStatus = true, onClick }: CrewAvatarProps) {
  const isClickable = !!onClick

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={!isClickable}
        className={cn(
          'rounded-full flex items-center justify-center transition-all',
          'border-2 border-border',
          sizeClasses[size],
          isClickable && 'hover:scale-110 hover:border-primary cursor-pointer',
          isClickable && 'active:scale-95',
          !isClickable && 'cursor-default',
          agent.status === 'working' && 'animate-pulse',
          agent.status === 'thinking' && 'animate-pulse'
        )}
        style={{
          background: `linear-gradient(135deg, ${agent.color}40, ${agent.color}20)`,
          borderColor: agent.status !== 'offline' ? agent.color : undefined,
        }}
      >
        {agent.avatarUrl ? (
          <img
            src={agent.avatarUrl}
            alt={agent.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span
            className={cn(
              'select-none transition-transform',
              agent.status === 'working' && 'animate-bounce'
            )}
          >
            {getStatusEmoji(agent.status, agent.emoji)}
          </span>
        )}
      </button>

      {/* Status indicator dot */}
      {showStatus && (
        <span
          className={cn(
            'absolute rounded-full border-2 border-background',
            statusColors[agent.status],
            statusSizeClasses[size]
          )}
        />
      )}

      {/* Tooltip on hover */}
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 -top-10 px-2 py-1',
          'bg-popover text-popover-foreground text-xs rounded shadow-lg',
          'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
          'whitespace-nowrap z-50'
        )}
      >
        <div className="font-medium">{agent.name}</div>
        {agent.currentTask && (
          <div className="text-muted-foreground text-[10px] max-w-32 truncate">
            {agent.currentTask}
          </div>
        )}
      </div>
    </div>
  )
}
