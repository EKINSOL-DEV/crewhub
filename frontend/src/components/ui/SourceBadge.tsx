/**
 * SourceBadge — shows the connection source of a session.
 */

interface SourceBadgeProps {
  readonly source?: string
  readonly projectName?: string
}

const sourceConfig: Record<string, { label: string; bg: string }> = {
  openclaw: { label: 'OpenClaw', bg: '#FF6B35' },
  claude_code: { label: 'Claude Code', bg: '#8B5CF6' },
}

export function SourceBadge({ source, projectName }: SourceBadgeProps) {
  if (!source) return null
  const config = sourceConfig[source] ?? { label: source, bg: '#6B7280' }
  const label = source === 'claude_code' && projectName ? `CC: ${projectName}` : config.label
  return (
    <span
      className="inline-flex items-center text-xs px-1.5 py-0.5 rounded text-white font-medium"
      style={{ backgroundColor: config.bg }}
    >
      {label}
    </span>
  )
}
