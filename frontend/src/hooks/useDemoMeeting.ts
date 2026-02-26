/**
 * useDemoMeeting — Fake meeting orchestrator for demo mode.
 *
 * Drives fake meeting state through timers, producing the same
 * MeetingState shape that MeetingProgressView and MeetingOutput expect.
 * Also updates meetingGatheringState for Bot3D animations.
 */

import { useState, useCallback, useRef } from 'react'
import type { MeetingState } from '@/hooks/useMeeting'

// ─── Fake Script ────────────────────────────────────────────────

interface FakeTurn {
  agentId: string
  agentName: string
  response: string
}

interface FakeRound {
  topic: string
  turns: FakeTurn[]
}

const FAKE_PARTICIPANTS = ['agent:dev:main', 'agent:main:main', 'agent:flowy:main']

const FAKE_SCRIPT: FakeRound[] = [
  {
    topic: 'Current sprint progress and blockers',
    turns: [
      {
        agentId: 'agent:dev:main',
        agentName: 'Dev',
        response:
          "I've completed the authentication middleware refactoring and the new REST API endpoints are passing all tests. The main blocker is the database migration for v3 — there's a schema conflict with the user preferences table that needs careful handling. I've drafted a migration plan that preserves existing data.",
      },
      {
        agentId: 'agent:main:main',
        agentName: 'Assistent',
        response:
          "Good progress on the API. I've been reviewing incoming support tickets and there are 3 high-priority items related to the webhook reliability issue. I suggest we prioritize the database migration since it's blocking two other features. I can help coordinate the rollout plan.",
      },
      {
        agentId: 'agent:flowy:main',
        agentName: 'Flowy',
        response:
          "From the marketing side, the landing page redesign is 80% complete. I'm waiting on the final API documentation from Dev to update the developer portal. The blog post about our new features is drafted and ready for review. Social media campaign for the launch is scheduled for next Thursday.",
      },
    ],
  },
  {
    topic: 'Architecture decisions for the next milestone',
    turns: [
      {
        agentId: 'agent:dev:main',
        agentName: 'Dev',
        response:
          "For the real-time collaboration feature, I propose using WebSocket connections with a message queue backend. This gives us better scalability than polling. I've benchmarked both approaches — WebSockets reduce latency by 85% and server load by 60%. The trade-off is slightly more complex client-side code.",
      },
      {
        agentId: 'agent:main:main',
        agentName: 'Assistent',
        response:
          "The WebSocket approach makes sense. I'd recommend we also implement a fallback to long-polling for environments where WebSockets are blocked. For the deployment strategy, I suggest a blue-green deployment with feature flags so we can gradually roll out to users. This minimizes risk.",
      },
      {
        agentId: 'agent:flowy:main',
        agentName: 'Flowy',
        response:
          "From a user communication perspective, we should announce the real-time features in phases. First a beta announcement to power users, then a general release. I'll prepare the announcement materials and documentation. Also, we should update the pricing page if this affects our tier structure.",
      },
    ],
  },
  {
    topic: 'Action items and next steps',
    turns: [
      {
        agentId: 'agent:dev:main',
        agentName: 'Dev',
        response:
          "I'll finalize the database migration plan by EOD tomorrow and start implementing the WebSocket infrastructure. I need a review of the migration SQL from the team. I'll also set up the feature flag system so we can safely deploy incremental changes.",
      },
      {
        agentId: 'agent:main:main',
        agentName: 'Assistent',
        response:
          "I'll review the migration plan, coordinate with Dev on the rollout timeline, and handle the 3 high-priority support tickets. I'll also draft the feature flag configuration and set up monitoring dashboards for the new WebSocket connections.",
      },
      {
        agentId: 'agent:flowy:main',
        agentName: 'Flowy',
        response:
          "I'll finalize the landing page, prepare beta announcement emails, and complete the developer portal updates once the API docs are ready. I'll also create a content calendar for the phased launch communication strategy.",
      },
    ],
  },
]

const FAKE_OUTPUT_MD = `# Sprint Planning Meeting — Summary

## Key Decisions
1. **Database Migration**: Proceed with v3 migration using the drafted plan. Dev to finalize SQL by EOD tomorrow.
2. **WebSocket Architecture**: Approved WebSocket approach for real-time features with long-polling fallback.
3. **Deployment Strategy**: Blue-green deployment with feature flags for gradual rollout.
4. **Launch Communication**: Phased announcement — beta users first, then general release.

## Action Items

### 🔴 High Priority
- [ ] **Dev**: Finalize database migration plan and SQL review — *Due: Tomorrow EOD*
- [ ] **Dev**: Implement WebSocket infrastructure — *Due: End of sprint*
- [ ] **Assistent**: Handle 3 high-priority webhook support tickets — *Due: Tomorrow*

### 🟡 Medium Priority
- [ ] **Assistent**: Review migration plan and coordinate rollout — *Due: 2 days*
- [ ] **Assistent**: Set up monitoring dashboards — *Due: 3 days*
- [ ] **Flowy**: Finalize landing page redesign — *Due: 2 days*
- [ ] **Dev**: Set up feature flag system — *Due: 3 days*

### 🟢 Low Priority
- [ ] **Flowy**: Prepare beta announcement emails — *Due: 4 days*
- [ ] **Flowy**: Create content calendar for phased launch — *Due: End of week*
- [ ] **Flowy**: Update developer portal once API docs ready — *Blocked on Dev*

## Transcript Summary
Three rounds of discussion covering sprint progress, architecture decisions, and action items. All participants aligned on WebSocket approach and phased launch strategy. Main risk identified: database migration complexity.

---
*Meeting duration: ~60 seconds (demo) • 3 rounds • 3 participants*
`

// ─── Initial State ──────────────────────────────────────────────

const INITIAL_STATE: MeetingState = {
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
}

// ─── Hook ───────────────────────────────────────────────────────

export function useDemoMeeting() {
  const [state, setState] = useState<MeetingState>(INITIAL_STATE)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const isRunningRef = useRef(false)

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t)
    timersRef.current = []
  }, [])

  const startDemoMeeting = useCallback(() => {
    if (isRunningRef.current) return
    isRunningRef.current = true
    clearTimers()

    const meetingId = `demo-meeting-${Date.now()}`

    // Phase 1: Started → Gathering
    setState({
      ...INITIAL_STATE,
      phase: 'gathering',
      meetingId,
      title: 'Sprint Planning Meeting',
      participants: FAKE_PARTICIPANTS,
      totalRounds: FAKE_SCRIPT.length,
      progressPct: 5,
    })

    // NOTE: We do NOT call updateMeetingGatheringState here.
    // MeetingContext's useEffect syncs gathering state from React state,
    // ensuring correct table positions and room data are used for pathfinding.

    // Schedule the full script
    let delay = 3000 // 3s for gathering animation

    for (let ri = 0; ri < FAKE_SCRIPT.length; ri++) {
      const round = FAKE_SCRIPT[ri]
      const roundNum = ri + 1

      // Round start
      const roundStartDelay = delay
      timersRef.current.push(
        setTimeout(() => {
          setState((prev) => {
            const newRounds = [...prev.rounds]
            newRounds[ri] = {
              roundNum,
              topic: round.topic,
              turns: round.turns.map((t, ti) => ({ // NOSONAR: nested map in setState in setTimeout — demo playback pattern
                round: roundNum,
                agentId: t.agentId,
                agentName: t.agentName,
                response: null,
                turnIndex: ti,
                totalTurns: round.turns.length,
                status: 'waiting' as const,
              })),
              status: 'in_progress',
            }
            // Mark previous rounds as complete
            for (let i = 0; i < ri; i++) {
              if (newRounds[i]) newRounds[i].status = 'complete'
            }
            return {
              ...prev,
              phase: 'round',
              currentRound: roundNum,
              progressPct:
                Math.round(((ri * round.turns.length) / (FAKE_SCRIPT.length * 3)) * 90) + 5,
              rounds: newRounds,
            }
          })
        }, roundStartDelay)
      )
      delay += 1000

      // Each turn: speaking → done
      for (let ti = 0; ti < round.turns.length; ti++) {
        const turn = round.turns[ti]
        const speakingDelay = delay

        // Turn start (speaking)
        timersRef.current.push(
          setTimeout(() => {
            setState((prev) => {
              const newRounds = [...prev.rounds]
              if (newRounds[ri]) {
                const turns = [...newRounds[ri].turns]
                turns[ti] = { ...turns[ti], status: 'speaking' }
                newRounds[ri] = { ...newRounds[ri], turns }
              }
              return {
                ...prev,
                currentTurnAgentId: turn.agentId,
                currentTurnAgentName: turn.agentName,
                rounds: newRounds,
              }
            })
          }, speakingDelay)
        )

        // Turn complete (done with response) — 4-6 seconds per turn
        const turnDuration = 4000 + Math.random() * 2000
        delay += turnDuration

        timersRef.current.push(
          setTimeout(() => {
            setState((prev) => {
              const newRounds = [...prev.rounds]
              if (newRounds[ri]) {
                const turns = [...newRounds[ri].turns]
                turns[ti] = { ...turns[ti], status: 'done', response: turn.response }
                newRounds[ri] = { ...newRounds[ri], turns }
              }
              const totalTurns = FAKE_SCRIPT.length * 3
              const doneTurns = ri * 3 + ti + 1
              return {
                ...prev,
                currentTurnAgentId: null,
                currentTurnAgentName: null,
                progressPct: Math.round((doneTurns / totalTurns) * 90) + 5,
                rounds: newRounds,
              }
            })
          }, delay)
        )

        delay += 500 // brief pause between turns
      }

      delay += 1000 // pause between rounds
    }

    // Synthesizing phase
    timersRef.current.push(
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          phase: 'synthesizing',
          progressPct: 92,
          currentTurnAgentId: null,
          currentTurnAgentName: null,
        }))
      }, delay)
    )
    delay += 5000

    // Complete
    timersRef.current.push(
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          phase: 'complete',
          progressPct: 100,
          outputMd: FAKE_OUTPUT_MD,
          durationSeconds: Math.round(delay / 1000),
        }))
        isRunningRef.current = false
      }, delay)
    )
  }, [clearTimers])

  const cancelDemoMeeting = useCallback(() => {
    clearTimers()
    isRunningRef.current = false
    setState((prev) => ({
      ...prev,
      phase: 'cancelled',
      currentTurnAgentId: null,
      currentTurnAgentName: null,
    }))
  }, [clearTimers])

  const resetDemoMeeting = useCallback(() => {
    clearTimers()
    isRunningRef.current = false
    setState(INITIAL_STATE)
  }, [clearTimers])

  const isActive =
    state.phase !== 'idle' &&
    state.phase !== 'complete' &&
    state.phase !== 'error' &&
    state.phase !== 'cancelled'

  return {
    demoMeeting: {
      ...state,
      isActive,
      // Stub actions matching useMeeting shape
      startMeeting: async () => {},
      cancelMeeting: async () => {
        cancelDemoMeeting()
      },
      fetchOutput: async () => {},
      reset: () => {
        resetDemoMeeting()
      },
    },
    startDemoMeeting,
    cancelDemoMeeting,
    resetDemoMeeting,
    isDemoMeetingActive: isActive,
    isDemoMeetingComplete: state.phase === 'complete',
  }
}
