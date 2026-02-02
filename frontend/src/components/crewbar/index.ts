/**
 * CrewBar - Floating chat windows for AI agents
 * 
 * A standalone, reusable component that provides floating chat windows
 * for interacting with AI agents. Can be embedded in any React application.
 * 
 * @example
 * ```tsx
 * import { CrewBar, type CrewAgent, type CrewBarConfig } from '@/components/crewbar'
 * 
 * const agents: CrewAgent[] = [
 *   { id: "claude", name: "Claude", emoji: "🤖", color: "#6366f1", status: "idle", isPinned: true },
 * ]
 * 
 * const config: CrewBarConfig = {
 *   sendMessage: async (agentId, message) => {
 *     const response = await fetch(`/api/chat/${agentId}`, {
 *       method: "POST",
 *       body: JSON.stringify({ message }),
 *     })
 *     const data = await response.json()
 *     return data.response
 *   },
 * }
 * 
 * function App() {
 *   return (
 *     <div>
 *       <YourMainContent />
 *       <CrewBar agents={agents} config={config} />
 *     </div>
 *   )
 * }
 * ```
 */

export { CrewBar } from "./CrewBar"
export { CrewAvatar } from "./CrewAvatar"
export { CrewWindow } from "./CrewWindow"
export { useCrewWindows } from "./CrewWindowManager"
export type { 
  CrewAgent, 
  CrewStatus, 
  CrewMessage, 
  CrewBarConfig 
} from "./types"
