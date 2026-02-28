/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ActionsTab } from '@/components/world3d/ActionsTab'

const openChat = vi.fn()
const refreshRooms = vi.fn().mockResolvedValue(undefined)

vi.mock('@/contexts/ChatContext', () => ({ useChatContext: () => ({ openChat }) }))
vi.mock('@/hooks/useRooms', () => ({
  useRooms: () => ({
    rooms: [{ id: 'r1', name: 'Room 1', icon: '🏠' }],
    refresh: refreshRooms,
  }),
}))
vi.mock('@/contexts/DemoContext', () => ({ useDemoMode: () => ({ isDemoMode: false }) }))

describe('ActionsTab', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any)
  })
  afterEach(() => vi.restoreAllMocks())

  const session = {
    key: 'agent:main:main',
    kind: 'agent',
    channel: 'whatsapp',
    updatedAt: Date.now(),
    sessionId: 'id',
  }

  it('opens chat and full log actions', () => {
    const onOpenLog = vi.fn()
    render(
      <ActionsTab
        session={session as any}
        displayName="Boss"
        botConfig={{ icon: '🤖', color: '#3366ff' } as any}
        currentRoomId="r1"
        canChat
        onOpenLog={onOpenLog}
      />
    )

    fireEvent.click(screen.getByText('💬 Open Chat'))
    expect(openChat).toHaveBeenCalled()

    fireEvent.click(screen.getByText('📋 Open Full Log'))
    expect(onOpenLog).toHaveBeenCalled()
  })

  it('moves bot to selected room and triggers refresh + callback', async () => {
    const onAssignmentChanged = vi.fn()
    render(
      <ActionsTab
        session={session as any}
        displayName="Boss"
        botConfig={{ icon: '🤖', color: '#3366ff' } as any}
        currentRoomId="parking"
        canChat={false}
        onOpenLog={vi.fn()}
        onAssignmentChanged={onAssignmentChanged}
      />
    )

    fireEvent.change(screen.getByDisplayValue('🅿️ Parking (unassigned)'), {
      target: { value: 'r1' },
    })

    await waitFor(() => expect(refreshRooms).toHaveBeenCalled())
    expect(onAssignmentChanged).toHaveBeenCalled()
  })
})
