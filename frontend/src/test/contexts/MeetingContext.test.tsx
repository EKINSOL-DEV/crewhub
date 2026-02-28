/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const showToastMock = vi.fn()
const updateMeetingGatheringStateMock = vi.fn()
const resetMeetingGatheringStateMock = vi.fn()

let mockMeeting: any
let mockDemoMeeting: any
const startDemoMeetingMock = vi.fn()

vi.mock('@/hooks/useMeeting', () => ({
  useMeeting: () => mockMeeting,
}))

vi.mock('@/hooks/useDemoMeeting', () => ({
  useDemoMeeting: () => ({
    demoMeeting: mockDemoMeeting,
    startDemoMeeting: startDemoMeetingMock,
    isDemoMeetingActive: false,
    isDemoMeetingComplete: false,
  }),
}))

vi.mock('@/lib/meetingStore', () => ({
  updateMeetingGatheringState: (...args: any[]) => updateMeetingGatheringStateMock(...args),
  resetMeetingGatheringState: () => resetMeetingGatheringStateMock(),
}))

vi.mock('@/lib/toast', () => ({
  showToast: (...args: any[]) => showToastMock(...args),
}))

import {
  MeetingProvider,
  useMeetingContext,
  calculateGatheringPositions,
} from '@/contexts/MeetingContext'

function Consumer() {
  const ctx = useMeetingContext()
  return (
    <div>
      <div data-testid="view">{ctx.view}</div>
      <div data-testid="positions">{String(ctx.gatheringPositions.length)}</div>
      <div data-testid="sidebar">{ctx.sidebarMeetingId ?? 'none'}</div>
      <div data-testid="follow-up">{ctx.followUpContext?.parentMeetingId ?? 'none'}</div>

      <button onClick={ctx.openDialog}>open-dialog</button>
      <button onClick={() => ctx.openDialogForRoom({ roomId: 'r1', projectId: 'p1' })}>
        open-room
      </button>
      <button onClick={ctx.closeDialog}>close-dialog</button>
      <button onClick={ctx.showProgress}>show-progress</button>
      <button onClick={ctx.showOutput}>show-output</button>
      <button onClick={ctx.closeView}>close-view</button>
      <button onClick={() => ctx.setTablePosition(10, 20)}>set-pos</button>
      <button onClick={() => ctx.openInSidebar('m-side')}>open-sidebar</button>
      <button onClick={ctx.closeSidebar}>close-sidebar</button>
      <button onClick={() => void ctx.openFollowUp('m-parent')}>open-follow-up</button>
      <button onClick={ctx.startDemoMeeting}>start-demo</button>
    </div>
  )
}

describe('MeetingContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMeeting = {
      phase: 'idle',
      meetingId: null,
      title: '',
      participants: [],
      currentRound: 0,
      totalRounds: 0,
      currentTurnAgentId: null,
      currentTurnAgentName: null,
      progressPct: 0,
      rounds: [],
      outputMd: null,
      outputPath: null,
      outputLoading: false,
      outputError: null,
      error: null,
      durationSeconds: null,
      warnings: [],
      isActive: false,
      startMeeting: vi.fn(),
      cancelMeeting: vi.fn(),
      fetchOutput: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn(),
    }
    mockDemoMeeting = mockMeeting
  })

  it('calculates gathering positions around table center', () => {
    const positions = calculateGatheringPositions(0, 0, ['a', 'b', 'c'], 2)
    expect(positions).toHaveLength(3)
    expect(positions[0].agentId).toBe('a')
    expect(positions[0].x).toBeCloseTo(2)
  })

  it('manages view/sidebar actions and syncs gathering store', async () => {
    const { rerender } = render(
      <MeetingProvider>
        <Consumer />
      </MeetingProvider>
    )

    expect(screen.getByTestId('view')).toHaveTextContent('none')
    expect(resetMeetingGatheringStateMock).toHaveBeenCalled()

    fireEvent.click(screen.getByText('open-dialog'))
    expect(screen.getByTestId('view')).toHaveTextContent('dialog')

    fireEvent.click(screen.getByText('show-progress'))
    expect(screen.getByTestId('view')).toHaveTextContent('progress')

    fireEvent.click(screen.getByText('show-output'))
    expect(mockMeeting.fetchOutput).toHaveBeenCalled()
    expect(screen.getByTestId('view')).toHaveTextContent('output')

    fireEvent.click(screen.getByText('open-sidebar'))
    expect(screen.getByTestId('sidebar')).toHaveTextContent('m-side')
    expect(mockMeeting.reset).toHaveBeenCalled()

    fireEvent.click(screen.getByText('close-sidebar'))
    expect(screen.getByTestId('sidebar')).toHaveTextContent('none')

    mockMeeting = {
      ...mockMeeting,
      isActive: true,
      phase: 'round',
      participants: ['agent-1', 'agent-2'],
      currentRound: 1,
      rounds: [
        {
          roundNum: 1,
          topic: 't',
          status: 'in_progress',
          turns: [
            {
              agentId: 'agent-1',
              agentName: 'A1',
              round: 1,
              response: 'hello',
              status: 'done',
              turnIndex: 0,
              totalTurns: 2,
            },
          ],
        },
      ],
      currentTurnAgentId: 'agent-1',
    }

    fireEvent.click(screen.getByText('set-pos'))
    rerender(
      <MeetingProvider>
        <Consumer />
      </MeetingProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('positions')).toHaveTextContent('2')
      expect(updateMeetingGatheringStateMock).toHaveBeenCalled()
    })
  })

  it('auto-transitions on phase changes and supports follow-up loading', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            title: 'Parent',
            goal: 'Goal',
            participants: [{ agent_id: 'a1' }, { agent_id: 'a2' }],
            room_id: 'room-x',
            project_id: 'project-x',
          })
        )
    )
    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = render(
      <MeetingProvider>
        <Consumer />
      </MeetingProvider>
    )

    mockMeeting = {
      ...mockMeeting,
      phase: 'gathering',
      isActive: true,
      participants: ['a1'],
    }
    rerender(
      <MeetingProvider>
        <Consumer />
      </MeetingProvider>
    )
    await waitFor(() => expect(screen.getByTestId('view')).toHaveTextContent('progress'))

    mockMeeting = {
      ...mockMeeting,
      phase: 'complete',
      isActive: false,
      meetingId: 'meeting-1',
    }
    rerender(
      <MeetingProvider>
        <Consumer />
      </MeetingProvider>
    )

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith({ message: '✅ Meeting complete!' })
      expect(screen.getByTestId('sidebar')).toHaveTextContent('meeting-1')
      expect(screen.getByTestId('view')).toHaveTextContent('none')
    })

    fireEvent.click(screen.getByText('open-follow-up'))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/meetings/m-parent/status')
      expect(screen.getByTestId('follow-up')).toHaveTextContent('m-parent')
      expect(screen.getByTestId('view')).toHaveTextContent('dialog')
    })

    fireEvent.click(screen.getByText('start-demo'))
    expect(startDemoMeetingMock).toHaveBeenCalled()
    expect(screen.getByTestId('view')).toHaveTextContent('progress')
  })
})
