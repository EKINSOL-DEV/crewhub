import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/world3d/BotInfoTabs', () => ({
  BotInfoTabs: (props: any) => (
    <div data-testid="tabs" data-can-chat={String(props.canChat)}>
      tabs
    </div>
  ),
}))

describe('BotInfoPanel', () => {
  const baseProps = {
    displayName: '',
    botConfig: { color: '#123456', icon: '🤖' },
    status: 'active' as const,
    onClose: vi.fn(),
    onOpenLog: vi.fn(),
  }

  const session = {
    key: 'agent:alex:main',
    kind: 'agent',
    channel: 'whatsapp',
    updatedAt: Date.now(),
    sessionId: 's1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('renders null when no session', async () => {
    const { BotInfoPanel } = await import('../../components/world3d/BotInfoPanel')
    const { container } = render(<BotInfoPanel {...baseProps} session={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders fallback name/status and passes canChat=true for fixed agent', async () => {
    const { BotInfoPanel } = await import('../../components/world3d/BotInfoPanel')
    render(<BotInfoPanel {...baseProps} session={session as any} />)

    expect(screen.getByText('alex')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByTestId('tabs')).toHaveAttribute('data-can-chat', 'true')
  })

  it('close interactions: button/touch and outside click except canvas/world-ui', async () => {
    const { BotInfoPanel } = await import('../../components/world3d/BotInfoPanel')
    render(<BotInfoPanel {...baseProps} session={{ ...session, key: 'agent:x:worker' } as any} />)

    fireEvent.click(screen.getByRole('button'))
    expect(baseProps.onClose).toHaveBeenCalledTimes(1)

    fireEvent.touchEnd(screen.getByRole('button'))
    expect(baseProps.onClose).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(210) // attach outside listener

    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    fireEvent.mouseDown(canvas)

    const worldUi = document.createElement('div')
    worldUi.setAttribute('data-world-ui', '1')
    document.body.appendChild(worldUi)
    fireEvent.mouseDown(worldUi)

    fireEvent.mouseDown(document.body)
    vi.advanceTimersByTime(60)

    expect(baseProps.onClose).toHaveBeenCalledTimes(3)
  })

  it('covers remaining status labels', async () => {
    const { BotInfoPanel } = await import('../../components/world3d/BotInfoPanel')
    const statuses = ['idle', 'supervising', 'sleeping', 'meeting', 'offline'] as const

    for (const st of statuses) {
      const { unmount } = render(
        <BotInfoPanel {...baseProps} status={st} session={session as any} />
      )
      const expected =
        st === 'meeting'
          ? 'In Meeting'
          : st === 'idle'
            ? 'Idle'
            : st === 'supervising'
              ? 'Supervising'
              : st === 'sleeping'
                ? 'Sleeping'
                : 'Offline'
      expect(screen.getByText(expected)).toBeInTheDocument()
      unmount()
    }
  })
})
