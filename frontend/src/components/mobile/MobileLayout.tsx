import { useState, useCallback, useEffect, useMemo } from 'react'
import { MobileAgentList } from './MobileAgentList'
import { MobileAgentChat } from './MobileAgentChat'
import { MobileDrawer, type MobilePanel } from './MobileDrawer'
import { MobileDocsPanel } from './MobileDocsPanel'
import { MobileKanbanPanel } from './MobileKanbanPanel'
import { MobileActivityPanel } from './MobileActivityPanel'
import { MobileProjectsPanel } from './MobileProjectsPanel'
import { MobileSettingsPanel, initAppSettings } from './MobileSettingsPanel'
import { MobileCreatorView } from './MobileCreatorView'
import { MobileDebugBar } from './MobileDebugBar'
import { useSessionsStream } from '@/hooks/useSessionsStream'
import { useAgentsRegistry } from '@/hooks/useAgentsRegistry'
import { useDemoMode } from '@/contexts/DemoContext'
import { AgentMultiSelectSheet, GroupThreadChat } from './group'
import { threadsApi, type Thread } from '@/lib/threads.api'

type View =
  | { type: 'list' }
  | { type: 'chat'; sessionKey: string; agentId: string; agentName: string; agentIcon: string | null; agentColor: string | null }
  | { type: 'new-group' }
  | { type: 'group-chat'; thread: Thread }
  | { type: 'docs' }
  | { type: 'kanban' }
  | { type: 'activity' }
  | { type: 'projects' }
  | { type: 'creator' }

// Fixed crew members only
const FIXED_AGENT_IDS = ['main', 'dev', 'flowy', 'creator', 'reviewer', 'gamedev', 'webdev']

export function MobileLayout() {
  const { sessions: realSessions, loading, connected, refresh } = useSessionsStream(true)
  const { isDemoMode, demoSessions } = useDemoMode()
  const sessions = useMemo(
    () => (isDemoMode && demoSessions.length > 0 ? demoSessions : realSessions),
    [isDemoMode, demoSessions, realSessions]
  )
  const { agents } = useAgentsRegistry(sessions)
  const [view, setView] = useState<View>({ type: 'list' })
  const [threads, setThreads] = useState<Thread[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [debugMode, setDebugMode] = useState(
    () => localStorage.getItem('crewhub-debug') === 'true'
  )

  // Initialize theme + font size on first render
  useEffect(() => {
    initAppSettings()
  }, [])

  // Keep debugMode in sync with localStorage (settings panel writes it directly)
  useEffect(() => {
    const syncDebug = () => {
      setDebugMode(localStorage.getItem('crewhub-debug') === 'true')
    }
    window.addEventListener('storage', syncDebug)
    return () => window.removeEventListener('storage', syncDebug)
  }, [])

  // Listen for debug mode changes from within the same window
  // (storage event only fires for other tabs; we poll lightly)
  useEffect(() => {
    const interval = setInterval(() => {
      const current = localStorage.getItem('crewhub-debug') === 'true'
      setDebugMode(prev => prev !== current ? current : prev)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Filter to fixed agents only
  const fixedAgents = agents.filter(r => FIXED_AGENT_IDS.includes(r.agent.id))

  // Load threads
  useEffect(() => {
    threadsApi.list('group').then(r => setThreads(r.threads)).catch(() => {})
  }, [view.type === 'list' ? 'list' : ''])

  // Get subagent sessions for a given agent id
  const getSubagentSessions = useCallback((agentId: string) => {
    const prefix = `agent:${agentId}:subagent:`
    return sessions.filter(s => s.key.startsWith(prefix))
  }, [sessions])

  const handleSelectAgent = useCallback((agentId: string, name: string, icon: string | null, color: string | null, sessionKey: string) => {
    setView({ type: 'chat', sessionKey, agentId, agentName: name, agentIcon: icon, agentColor: color })
  }, [])

  const handleBack = useCallback(() => {
    setView({ type: 'list' })
  }, [])

  const handleCreateGroup = useCallback(async (agentIds: string[]) => {
    try {
      const thread = await threadsApi.create({ participant_agent_ids: agentIds })
      setView({ type: 'group-chat', thread })
    } catch (e) {
      console.error('Failed to create group:', e)
    }
  }, [])

  const handleSelectThread = useCallback((thread: Thread) => {
    setView({ type: 'group-chat', thread })
  }, [])

  const handleRemoveParticipant = useCallback(async (threadId: string, agentId: string) => {
    try {
      const updated = await threadsApi.removeParticipant(threadId, agentId)
      if (view.type === 'group-chat') {
        setView({ type: 'group-chat', thread: updated })
      }
    } catch (e) {
      console.error('Failed to remove participant:', e)
    }
  }, [view])

  // Drawer navigation
  const handleDrawerNavigate = useCallback((panel: MobilePanel) => {
    switch (panel) {
      case 'chat':
        setView({ type: 'list' })
        break
      case 'docs':
        setView({ type: 'docs' })
        break
      case 'kanban':
        setView({ type: 'kanban' })
        break
      case 'activity':
        setView({ type: 'activity' })
        break
      case 'projects':
        setView({ type: 'projects' })
        break
      case 'creator':
        setView({ type: 'creator' })
        break
      case 'settings':
        setSettingsOpen(true)
        break
      default:
        break
    }
  }, [])

  // Determine current panel for drawer highlight
  const currentPanel: MobilePanel =
    view.type === 'docs' ? 'docs' :
    view.type === 'kanban' ? 'kanban' :
    view.type === 'activity' ? 'activity' :
    view.type === 'projects' ? 'projects' :
    view.type === 'creator' ? 'creator' :
    'chat'

  return (
    <div style={{
      height: '100dvh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--mobile-bg, #0f172a)',
      color: 'var(--mobile-text, #e2e8f0)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: 'hidden',
    }}>
      {/* Drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={handleDrawerNavigate}
        currentPanel={currentPanel}
      />

      {/* Settings Panel */}
      <MobileSettingsPanel
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
          // Re-sync debug mode after settings closed
          setDebugMode(localStorage.getItem('crewhub-debug') === 'true')
        }}
      />

      {/* Debug status bar */}
      <MobileDebugBar enabled={debugMode} />

      {view.type === 'chat' ? (
        <MobileAgentChat
          sessionKey={view.sessionKey}
          agentName={view.agentName}
          agentIcon={view.agentIcon}
          agentColor={view.agentColor}
          subagentSessions={getSubagentSessions(view.agentId)}
          onBack={handleBack}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : view.type === 'new-group' ? (
        <AgentMultiSelectSheet
          agents={fixedAgents}
          onConfirm={handleCreateGroup}
          onClose={handleBack}
        />
      ) : view.type === 'group-chat' ? (
        <GroupThreadChat
          thread={view.thread}
          onBack={handleBack}
          onRemoveParticipant={(agentId) => handleRemoveParticipant(view.thread.id, agentId)}
          onAddParticipants={() => {/* TODO: add participants flow */}}
          onRename={() => {/* TODO: rename flow */}}
        />
      ) : view.type === 'docs' ? (
        <MobileDocsPanel onBack={handleBack} />
      ) : view.type === 'kanban' ? (
        <MobileKanbanPanel onBack={handleBack} />
      ) : view.type === 'activity' ? (
        <MobileActivityPanel onBack={handleBack} />
      ) : view.type === 'projects' ? (
        <MobileProjectsPanel onBack={handleBack} />
      ) : view.type === 'creator' ? (
        <MobileCreatorView onBack={handleBack} />
      ) : (
        <MobileAgentList
          agents={fixedAgents}
          loading={loading}
          connected={connected}
          onSelectAgent={handleSelectAgent}
          onRefresh={refresh}
          threads={threads}
          onNewGroup={() => setView({ type: 'new-group' })}
          onSelectThread={handleSelectThread}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
      )}
    </div>
  )
}
