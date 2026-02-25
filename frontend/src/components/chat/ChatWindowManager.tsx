import { useChatContext } from '@/contexts/ChatContext'
import { AgentChatWindow } from './AgentChatWindow'

/**
 * ChatWindowManager
 *
 * Renders all open (non-minimized) chat windows as draggable/resizable panels.
 * The left-side minimized bar has been replaced by the AgentTopBar navigation.
 */
export function ChatWindowManager() {
  const { windows } = useChatContext()

  const openWindows = windows.filter((w) => !w.isMinimized)

  return (
    <>
      {/* ── Open chat windows ── */}
      {openWindows.map((w) => (
        <AgentChatWindow
          key={w.sessionKey}
          sessionKey={w.sessionKey}
          agentName={w.agentName}
          agentIcon={w.agentIcon}
          agentColor={w.agentColor}
          position={w.position}
          size={w.size}
          zIndex={w.zIndex}
        />
      ))}

      {/* Global styles for chat windows */}
      <style>{chatStyles}</style>
    </>
  )
}

// ── Global chat styles ─────────────────────────────────────────

const chatStyles = `
  .chat-thinking-pulse {
    animation: chatThinkingPulse 1s ease-in-out infinite;
  }

  @keyframes chatThinkingPulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .chat-window-container {
    /* Ensure the Rnd container has rounded corners */
  }
`
