/**
 * CrewBar Types
 * 
 * Generic types for the CrewBar component that can be used
 * in any application. Not tied to any specific backend.
 */

export type CrewStatus = 
  | "idle" 
  | "thinking" 
  | "working" 
  | "success" 
  | "error" 
  | "offline"

export interface CrewAgent {
  id: string
  name: string
  emoji: string
  avatarUrl?: string
  model?: string
  status: CrewStatus
  lastActivity?: string
  currentTask?: string
  color: string
  isPinned?: boolean
}

export interface CrewMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

/**
 * Configuration for the CrewBar component
 */
export interface CrewBarConfig {
  /**
   * Function to send a chat message to an agent
   * Returns the assistant's response
   */
  sendMessage: (agentId: string, message: string) => Promise<string>
  
  /**
   * Optional: Function to load chat history for an agent
   * Returns array of messages (newest first)
   */
  loadHistory?: (agentId: string, options?: { limit?: number; before?: number }) => Promise<CrewMessage[]>
  
  /**
   * Optional: Custom placeholder text for the chat input
   */
  inputPlaceholder?: (agentName: string) => string
  
  /**
   * Optional: Welcome message when opening a new chat
   */
  welcomeMessage?: (agent: CrewAgent) => string
  
  /**
   * Optional: Error message when chat fails
   */
  errorMessage?: string
  
  /**
   * Optional: Show "Open in Slack" button
   */
  showSlackLink?: boolean
  
  /**
   * Optional: Custom Slack URL for the agent
   */
  getSlackUrl?: (agentId: string) => string
}
