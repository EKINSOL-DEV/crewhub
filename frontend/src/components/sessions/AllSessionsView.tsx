import { useState, useMemo } from "react"
import { type MinionSession } from "@/lib/api"
import { SESSION_CONFIG } from "@/lib/sessionConfig"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react"
import { LogViewer } from "./LogViewer"

interface AllSessionsViewProps {
  sessions: MinionSession[]
}

type SortField = "name" | "status" | "model" | "tokens" | "lastActive"
type SortDirection = "asc" | "desc"

function formatTokens(tokens: number | undefined): string {
  if (!tokens) return "0"
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  if (diff < 60000) return "Just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function getSessionStatus(session: MinionSession): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (session.abortedLastRun) return { label: "Aborted", variant: "destructive" }
  const now = Date.now()
  const lastUpdate = session.updatedAt
  if (now - lastUpdate < SESSION_CONFIG.tableActiveThresholdMs) return { label: "Active", variant: "default" }
  if (now - lastUpdate < SESSION_CONFIG.tableIdleThresholdMs) return { label: "Idle", variant: "secondary" }
  return { label: "Stale", variant: "outline" }
}

function getDisplayName(session: MinionSession): string {
  if (session.displayName) return session.displayName
  if (session.label) return session.label
  const key = session.key
  const parts = key.split(":")
  if (parts.length >= 3) {
    if (parts[1] === "main") return "Main Agent"
    if (parts[1] === "cron") return `Cron: ${parts[2]}`
    if (parts[1] === "subagent" || parts[1] === "spawn") return `Subagent: ${parts[2].substring(0, 8)}`
    return parts.slice(1).join(":")
  }
  return key
}

export function AllSessionsView({ sessions }: AllSessionsViewProps) {
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("lastActive")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [selectedSession, setSelectedSession] = useState<MinionSession | null>(null)
  const [logViewerOpen, setLogViewerOpen] = useState(false)

  const filteredSessions = useMemo(() => {
    let result = [...sessions]
    
    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      result = result.filter(s => 
        s.key.toLowerCase().includes(searchLower) ||
        (s.label?.toLowerCase().includes(searchLower)) ||
        (s.displayName?.toLowerCase().includes(searchLower)) ||
        (s.model?.toLowerCase().includes(searchLower))
      )
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "name":
          comparison = getDisplayName(a).localeCompare(getDisplayName(b))
          break
        case "status":
          comparison = getSessionStatus(a).label.localeCompare(getSessionStatus(b).label)
          break
        case "model":
          comparison = (a.model || "").localeCompare(b.model || "")
          break
        case "tokens":
          comparison = (a.totalTokens || 0) - (b.totalTokens || 0)
          break
        case "lastActive":
          comparison = a.updatedAt - b.updatedAt
          break
      }
      return sortDirection === "asc" ? comparison : -comparison
    })
    
    return result
  }, [sessions, search, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 opacity-50" />
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />
  }

  const handleViewSession = (session: MinionSession) => {
    setSelectedSession(session)
    setLogViewerOpen(true)
  }

  return (
    <div className="h-full flex flex-col view-gradient">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredSessions.length} of {sessions.length} sessions
          </div>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="min-w-full">
          {/* Table Header */}
          <div className="sticky top-0 backdrop-blur border-b border-border grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-sm font-medium text-muted-foreground bg-background/95">
            <button 
              className="flex items-center gap-2 hover:text-foreground transition-colors text-left"
              onClick={() => handleSort("name")}
            >
              Name <SortIcon field="name" />
            </button>
            <button 
              className="flex items-center gap-2 hover:text-foreground transition-colors"
              onClick={() => handleSort("status")}
            >
              Status <SortIcon field="status" />
            </button>
            <button 
              className="flex items-center gap-2 hover:text-foreground transition-colors"
              onClick={() => handleSort("model")}
            >
              Model <SortIcon field="model" />
            </button>
            <button 
              className="flex items-center gap-2 hover:text-foreground transition-colors"
              onClick={() => handleSort("tokens")}
            >
              Tokens <SortIcon field="tokens" />
            </button>
            <button 
              className="flex items-center gap-2 hover:text-foreground transition-colors"
              onClick={() => handleSort("lastActive")}
            >
              Last Active <SortIcon field="lastActive" />
            </button>
            <div className="w-10"></div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border/50">
            {filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="text-4xl mb-4">🔍</div>
                <p>No sessions found</p>
              </div>
            ) : (
              filteredSessions.map((session) => {
                const status = getSessionStatus(session)
                return (
                  <div 
                    key={session.key}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-sm hover:bg-muted/50 transition-colors items-center"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground truncate">
                        {getDisplayName(session)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {session.key}
                      </span>
                    </div>
                    <div>
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground truncate">
                      {session.model || "—"}
                    </div>
                    <div className="text-muted-foreground font-mono">
                      {formatTokens(session.totalTokens)}
                    </div>
                    <div className="text-muted-foreground">
                      {formatRelativeTime(session.updatedAt)}
                    </div>
                    <div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewSession(session)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Log Viewer Dialog */}
      <LogViewer
        session={selectedSession}
        open={logViewerOpen}
        onOpenChange={setLogViewerOpen}
      />
    </div>
  )
}
