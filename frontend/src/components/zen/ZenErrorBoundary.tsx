/**
 * Zen Error Boundary
 * Catches errors in panel components and displays a fallback UI
 */

import { Component, type ReactNode } from 'react'

interface ZenErrorBoundaryProps {
  readonly children: ReactNode
  readonly panelType?: string
  readonly onReset?: () => void
}

interface ZenErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ZenErrorBoundary extends Component<ZenErrorBoundaryProps, ZenErrorBoundaryState> {
  constructor(props: Readonly<ZenErrorBoundaryProps>) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ZenErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ZenMode Panel Error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="zen-error-boundary">
          <div className="zen-error-boundary-content">
            <div className="zen-error-boundary-icon">⚠️</div>
            <h3 className="zen-error-boundary-title">Something went wrong</h3>
            <p className="zen-error-boundary-message">
              {this.props.panelType
                ? `The ${this.props.panelType} panel encountered an error.`
                : 'This panel encountered an error.'}
            </p>
            {this.state.error && (
              <div className="zen-error-boundary-details">
                <code className="zen-error-boundary-error">{this.state.error.message}</code>
              </div>
            )}
            <div className="zen-error-boundary-actions">
              <button className="zen-btn zen-btn-primary" onClick={this.handleReset}>
                <span>🔄</span> Try Again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// ── Loading Skeleton Components ───────────────────────────────────

export function ZenSkeleton({ className = '' }: { className?: string }) {
  return <div className={`zen-skeleton ${className}`} />
}

export function ZenSkeletonText({ lines = 3, short = false }: { lines?: number; short?: boolean }) {
  return (
    <div className="zen-skeleton-text-container">
      {Array.from({ length: lines }).map((_, i) => {
        let skeletonWidth: string
        if (short) {
          skeletonWidth = '60%'
        } else if (i === lines - 1) {
          skeletonWidth = `${50 + Math.random() * 30}%`
        } else {
          skeletonWidth = '100%'
        }
        return (
          <div
            key={`item-${skeletonWidth}-${i === lines - 1 ? 'last' : 'mid'}`}
            className={`zen-skeleton zen-skeleton-text ${
              short || i === lines - 1 ? 'zen-skeleton-text-short' : ''
            }`}
            style={{
              width: skeletonWidth,
            }}
          />
        )
      })}
    </div>
  )
}

export function ZenSkeletonAvatar({ size = 32 }: { size?: number }) {
  return <div className="zen-skeleton zen-skeleton-avatar" style={{ width: size, height: size }} />
}

export function ZenSkeletonSessionItem() {
  return (
    <div className="zen-skeleton-session">
      <ZenSkeletonAvatar size={24} />
      <div className="zen-skeleton-session-content">
        <ZenSkeleton className="zen-skeleton-session-name" />
        <ZenSkeleton className="zen-skeleton-session-meta" />
      </div>
    </div>
  )
}

export function ZenSkeletonMessageBubble({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`zen-skeleton-message ${isUser ? 'zen-skeleton-message-user' : ''}`}>
      <ZenSkeletonText lines={2} short={isUser} />
    </div>
  )
}

export function ZenSkeletonActivityItem() {
  return (
    <div className="zen-skeleton-activity">
      <ZenSkeleton className="zen-skeleton-activity-time" />
      <ZenSkeleton className="zen-skeleton-activity-icon" />
      <div className="zen-skeleton-activity-content">
        <ZenSkeleton className="zen-skeleton-activity-agent" />
        <ZenSkeleton className="zen-skeleton-activity-desc" />
      </div>
    </div>
  )
}

// ── Empty State Components ────────────────────────────────────────

interface ZenEmptyStateProps {
  readonly icon: string
  readonly title: string
  readonly description?: string
  readonly action?: {
    label: string
    onClick: () => void
  }
}

export function ZenEmptyState({ icon, title, description, action }: Readonly<ZenEmptyStateProps>) {
  return (
    <div className="zen-empty-state">
      <div className="zen-empty-state-icon">{icon}</div>
      <h3 className="zen-empty-state-title">{title}</h3>
      {description && <p className="zen-empty-state-description">{description}</p>}
      {action && (
        <button className="zen-btn zen-btn-primary zen-empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

// ── Loading State Component ───────────────────────────────────────

interface ZenLoadingStateProps {
  readonly message?: string
}

export function ZenLoadingState({ message = 'Loading...' }: Readonly<ZenLoadingStateProps>) {
  return (
    <div className="zen-loading-state">
      <div className="zen-spinner zen-spinner-large" />
      <span className="zen-loading-state-message">{message}</span>
    </div>
  )
}

// ── Connection Status Component ───────────────────────────────────

interface ZenConnectionStatusProps {
  readonly connected: boolean
  readonly reconnecting?: boolean
  readonly lastConnected?: number
}

export function ZenConnectionStatus({
  connected,
  reconnecting,
  lastConnected,
}: Readonly<ZenConnectionStatusProps>) {
  if (connected && !reconnecting) {
    return null
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  return (
    <div
      className={`zen-connection-status ${reconnecting ? 'zen-connection-reconnecting' : 'zen-connection-disconnected'}`}
    >
      <span className="zen-connection-status-icon">
        {reconnecting ? (
          <span className="zen-thinking-dots">
            <span />
            <span />
            <span />
          </span>
        ) : (
          '⚠️'
        )}
      </span>
      <span className="zen-connection-status-text">
        {reconnecting
          ? 'Reconnecting...'
          : (() => {
              const disconnectedAt = lastConnected ? ` at ${formatTime(lastConnected)}` : ''
              return `Disconnected${disconnectedAt}`
            })()}
      </span>
    </div>
  )
}
