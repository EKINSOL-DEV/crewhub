/**
 * Shared formatter utilities for CrewHub frontend.
 *
 * Import from '@/lib/formatters' instead of defining inline.
 * Component-specific formatters that are truly one-off should stay local.
 */

/**
 * Format a Unix timestamp (ms) as a full en-GB datetime string.
 * Returns '—' for falsy input.
 * Example: "20 Feb 2026, 14:30:45"
 */
export function formatTimestamp(ts: number): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Format a Unix timestamp (ms) as a time-only string (HH:MM).
 * Returns '' for falsy input.
 * Used for chat message timestamps.
 */
export function formatShortTimestamp(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Format duration between two Unix timestamps (ms).
 * endTs defaults to Date.now() if omitted.
 * Example: "1h 30m", "5m 12s", "45s"
 */
export function formatDuration(startTs: number, endTs?: number): string {
  const end = endTs || Date.now()
  const diff = end - startTs
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

/**
 * Format a token count with M/K suffixes.
 * Returns '—' for falsy input.
 * Example: "1.2M", "345.6K", "42"
 */
export function formatTokens(n?: number): string {
  if (!n) return '—'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

/**
 * Format a message timestamp: time-only for today, short date+time for other days.
 * Returns '' for falsy input.
 * Example: "14:30" (today) or "20 Feb, 14:30" (other day)
 */
export function formatMessageTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  return (
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

/**
 * Format an event timestamp as HH:MM:SS (24-hour, en-US).
 * Example: "14:30:05"
 */
export function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/**
 * Format a Unix timestamp (ms) as a relative human-readable string.
 * Returns 'just now', 'Xm ago', 'Xh ago', or a locale date string for older items.
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(timestamp).toLocaleDateString()
}

/**
 * Format a file size in bytes to a human-readable string.
 * Example: "512 B", "1.5 KB", "3.2 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
