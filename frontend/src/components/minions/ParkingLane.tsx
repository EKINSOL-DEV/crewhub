import { useEffect, useState } from "react"
import type { MinionSession } from "@/lib/api"
import { getIdleTimeSeconds, getIdleOpacity, getMinionType, getCurrentActivity } from "@/lib/minionUtils"
import { MinionSVGWithIcon } from "./MinionSVGWithIcon"
import { getMinionName, getTaskEmoji } from "@/lib/friendlyNames"
import { getRoomForSession, loadRoomsConfig } from "@/lib/roomsConfig"

interface ParkingLaneProps {
  sessions: MinionSession[]
  onMinionClick: (session: MinionSession) => void
}

function getVariantFromColor(color: string): "orange" | "blue" | "green" | "purple" | "amber" | "pink" | "cyan" {
  if (color.includes("FFA726")) return "orange"
  if (color.includes("42A5F5")) return "blue"
  if (color.includes("66BB6A")) return "green"
  if (color.includes("AB47BC")) return "purple"
  if (color.includes("FFCA28")) return "amber"
  if (color.includes("EC407A")) return "pink"
  if (color.includes("29B6F6")) return "cyan"
  return "orange"
}

function getAgentIcon(session: MinionSession): "crab" | "clock" | "camera" | "wave" | "gear" | "default" {
  const key = session.key || ""
  if (key === "agent:main:main") return "crab"
  if (key.includes(":cron:")) return "clock"
  if (key.includes(":spawn:") || key.includes(":subagent:")) return "gear"
  if (key.toLowerCase().includes("creator")) return "camera"
  if (key.toLowerCase().includes("flowy")) return "wave"
  return "default"
}

export function ParkingLane({ sessions, onMinionClick }: ParkingLaneProps) {
  const [visibleSessions, setVisibleSessions] = useState<MinionSession[]>([])
  const [roomsConfig] = useState(() => loadRoomsConfig())

  useEffect(() => {
    const filtered = sessions.filter(session => getIdleTimeSeconds(session) <= 300)
    setVisibleSessions(filtered)
  }, [sessions])

  return (
    <div className="flex flex-col border-l border-white/10 h-full max-h-screen" style={{
      background: "linear-gradient(to bottom, rgba(30, 27, 75, 0.95), rgba(49, 46, 129, 0.95))",
      backdropFilter: "blur(10px)",
    }}>
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10 bg-gradient-to-r from-purple-900/80 to-indigo-900/80 flex-shrink-0">
        <span className="text-xl">💤</span>
        <span className="text-white font-semibold text-sm">Parking</span>
        <span className="text-white/50 text-xs ml-auto">{visibleSessions.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2" style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}>
        {visibleSessions.length === 0 && (
          <div className="text-center text-white/40 text-xs py-8 px-2">All crew members active</div>
        )}

        {visibleSessions.map((session, index) => {
          const idleSeconds = getIdleTimeSeconds(session)
          const opacity = getIdleOpacity(idleSeconds)
          const minionType = getMinionType(session)
          const roomId = getRoomForSession(session.key, roomsConfig, { label: session.label, model: session.model })
          const minionName = getMinionName(session.key, roomId)
          const emoji = getTaskEmoji(session.label)
          const friendlyName = `${minionName} ${emoji}`
          const activity = session.label || getCurrentActivity(session) || "Ready and listening"

          return (
            <div key={session.key} onClick={() => onMinionClick(session)}
              className="parking-minion cursor-pointer hover:bg-white/5 transition-all duration-300 px-2 py-1 mx-2 mb-2 rounded"
              style={{ opacity, animation: `fadeInSlide 0.5s ease-out ${index * 0.1}s both` }}>
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <MinionSVGWithIcon variant={getVariantFromColor(minionType.color)} agentIcon={getAgentIcon(session)} size={32} flipped={false} animDelay={0} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{friendlyName}</div>
                  <div className="text-white/50 text-[10px] truncate">{activity}</div>
                </div>
                <div className="flex-shrink-0 text-[10px] text-white/40 bg-black/20 px-2 py-0.5 rounded">{Math.floor(idleSeconds / 60)}m</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-3 py-2 border-t border-white/10 text-center flex-shrink-0">
        <div className="text-white/30 text-[10px]">Auto-removed after 5m idle</div>
      </div>

      <style>{`
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .parking-minion { transition: all 0.3s ease; }
        .parking-minion:hover { transform: translateX(-2px); }
      `}</style>
    </div>
  )
}
