/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RoomInfoPanel } from '@/components/world3d/RoomInfoPanel'

vi.mock('@/components/standups', () => ({
  StandupModal: ({ open }: any) => <div>{open ? 'standup-open' : 'standup-closed'}</div>,
  StandupHistory: () => <div>standup-history</div>,
}))

vi.mock('@/hooks/useRooms', () => ({
  useRooms: () => ({ updateRoom: vi.fn(async () => ({ success: true })) }),
}))

const fetchOverviewMock = vi.fn(async () => ({
  success: true,
  projects: [
    {
      id: 'p1',
      name: 'HQ Proj',
      icon: '📦',
      color: '#123',
      status: 'active',
      room_count: 1,
      agent_count: 2,
      rooms: ['room-2'],
    },
  ],
}))

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [{ id: 'pA', folder_path: '/x' }],
    fetchOverview: fetchOverviewMock,
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/components/shared/EditRoomDialog', () => ({
  EditRoomDialog: () => <div>edit-room-dialog</div>,
}))
vi.mock('@/components/world3d/RoomInfoTab', () => ({
  RoomInfoTab: () => <div>room-info-tab</div>,
}))
vi.mock('@/components/world3d/RoomProjectTab', () => ({
  RoomProjectTab: () => <div>room-project-tab</div>,
}))
vi.mock('@/components/world3d/RoomFilesTab', () => ({
  RoomFilesTab: () => <div>room-files-tab</div>,
}))
vi.mock('@/components/world3d/OrgChartTab', () => ({
  OrgChartTab: () => <div>org-chart-tab</div>,
}))

describe('RoomInfoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
  })

  it('renders room and non-HQ tabs, supports outside-click close', async () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(
      <RoomInfoPanel
        room={
          {
            id: 'r1',
            name: 'Research',
            icon: '🧠',
            color: '#111',
            is_hq: false,
            project_id: 'pA',
          } as any
        }
        sessions={[{ key: 'agent:a:1', updatedAt: 999_900, label: 'A' }] as any}
        isActivelyRunning={() => true}
        displayNames={new Map()}
        onClose={onClose}
      />
    )

    expect(screen.getByText('Research')).toBeInTheDocument()
    expect(screen.getByText(/1 agent working/i)).toBeInTheDocument()
    expect(screen.getByText('📂 Files')).toBeInTheDocument()

    fireEvent.click(screen.getByText('📋 Project'))
    expect(screen.getByText('room-project-tab')).toBeInTheDocument()

    fireEvent.click(screen.getByText('📂 Files'))
    expect(screen.getByText('room-files-tab')).toBeInTheDocument()

    vi.advanceTimersByTime(250)
    fireEvent.mouseDown(document.body)
    vi.advanceTimersByTime(60)
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('renders HQ dashboard and org tab, and can open standup', async () => {
    vi.useRealTimers()
    const onFocusRoom = vi.fn()
    const onOpenHQBoard = vi.fn()

    render(
      <RoomInfoPanel
        room={{ id: 'hq', name: 'HQ', icon: '🏛️', color: '#222', is_hq: true } as any}
        sessions={[] as any}
        isActivelyRunning={() => false}
        displayNames={new Map()}
        onClose={vi.fn()}
        onFocusRoom={onFocusRoom}
        onOpenHQBoard={onOpenHQBoard}
      />
    )

    fireEvent.click(screen.getByText('🏛️ HQ'))

    expect(await screen.findByText('🏛️ COMMAND CENTER')).toBeInTheDocument()
    fireEvent.click(screen.getByText('🗓️ Daily Standup'))
    expect(screen.getByText('standup-open')).toBeInTheDocument()

    fireEvent.click(screen.getByText('📋 HQ Board'))
    expect(onOpenHQBoard).toHaveBeenCalled()

    fireEvent.click(screen.getByText('HQ Proj'))
    expect(onFocusRoom).toHaveBeenCalledWith('room-2')

    fireEvent.click(screen.getByText('🏢 Org Chart'))
    await waitFor(() => expect(screen.getByText('org-chart-tab')).toBeInTheDocument())
  })
})
