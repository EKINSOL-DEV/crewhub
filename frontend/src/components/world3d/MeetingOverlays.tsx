import { useMeetingContext } from '@/contexts/MeetingContext'
import {
  MeetingDialog,
  MeetingProgressView,
  MeetingOutput,
  MeetingResultsPanel,
} from '@/components/meetings'
import type { AgentRuntime } from '@/hooks/useAgentsRegistry'
import type { Room } from '@/hooks/useRooms'

interface MeetingOverlaysProps {
  readonly agentRuntimes: AgentRuntime[]
  readonly rooms: Room[]
}

export function MeetingOverlays({ agentRuntimes, rooms }: MeetingOverlaysProps) {
  const {
    meeting,
    view,
    dialogRoomContext,
    openDialog: _od,
    closeDialog,
    showProgress,
    showOutput,
    closeView,
    openInSidebar,
    followUpContext,
    openFollowUp,
  } = useMeetingContext()
  void _od

  const hqRoom = rooms.find(
    (r) => r.name.toLowerCase().includes('headquarter') || r.name.toLowerCase() === 'hq'
  )
  const dialogRoom = dialogRoomContext
    ? rooms.find((r) => r.id === dialogRoomContext.roomId) || null
    : null
  const effectiveRoomId = dialogRoomContext?.roomId || hqRoom?.id
  const effectiveProjectId = dialogRoomContext?.projectId || hqRoom?.project_id || undefined
  const effectiveProjectName =
    dialogRoomContext?.projectName || dialogRoom?.project_name || hqRoom?.project_name || undefined

  return (
    <>
      <MeetingDialog
        open={view === 'dialog'}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        agents={agentRuntimes}
        roomId={effectiveRoomId}
        projectId={effectiveProjectId}
        projectName={effectiveProjectName}
        onStart={async (params) => {
          await meeting.startMeeting(params)
        }}
        meetingInProgress={meeting.isActive}
        onViewProgress={showProgress}
        followUpContext={followUpContext}
        onViewResults={(meetingId) => openInSidebar(meetingId)}
      />

      {view === 'progress' && (
        <div className="fixed right-0 top-12 bottom-12 w-96 z-30 shadow-xl border-l bg-background">
          <MeetingProgressView
            meeting={meeting}
            onCancel={async () => {
              await meeting.cancelMeeting()
            }}
            onViewOutput={showOutput}
          />
        </div>
      )}

      {view === 'output' && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex-1 flex items-stretch justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-5xl bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <MeetingOutput
                meeting={meeting}
                onClose={closeView}
                mode="fullscreen"
                onStartFollowUp={() => {
                  if (meeting.meetingId) {
                    closeView()
                    openFollowUp(meeting.meetingId)
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      <MeetingResultsPanel />
    </>
  )
}
