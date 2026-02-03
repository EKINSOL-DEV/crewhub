import { useState, useMemo } from "react"
import { type CrewSession } from "@/lib/api"
import { SessionCard } from "./SessionCard"
import { LogViewer } from "./LogViewer"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, SlidersHorizontal } from "lucide-react"
import { getSessionStatus, type SessionStatus } from "@/lib/minionUtils"

interface CardsViewProps {
  sessions: CrewSession[]
}

type SortOption = "recent" | "name" | "tokens" | "status"
type FilterOption = "all" | "active" | "idle" | "sleeping"

function getDisplayName(session: CrewSession): string {
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

const sortLabels: Record<SortOption, string> = {
  recent: "Most Recent",
  name: "Name",
  tokens: "Tokens",
  status: "Status",
}

const filterLabels: Record<FilterOption, string> = {
  all: "All Sessions",
  active: "Active",
  idle: "Idle",
  sleeping: "Sleeping",
}

const statusOrder: Record<SessionStatus, number> = {
  active: 0,
  idle: 1,
  sleeping: 2,
}

export function CardsView({ sessions }: CardsViewProps) {
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("recent")
  const [filterBy, setFilterBy] = useState<FilterOption>("all")
  const [selectedSession, setSelectedSession] = useState<CrewSession | null>(null)
  const [logViewerOpen, setLogViewerOpen] = useState(false)

  const filteredAndSortedSessions = useMemo(() => {
    let result = [...sessions]

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.key.toLowerCase().includes(searchLower) ||
          s.label?.toLowerCase().includes(searchLower) ||
          s.displayName?.toLowerCase().includes(searchLower) ||
          s.model?.toLowerCase().includes(searchLower)
      )
    }

    // Filter by status
    if (filterBy !== "all") {
      result = result.filter((s) => getSessionStatus(s) === filterBy)
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return b.updatedAt - a.updatedAt
        case "name":
          return getDisplayName(a).localeCompare(getDisplayName(b))
        case "tokens":
          return (b.totalTokens || 0) - (a.totalTokens || 0)
        case "status":
          return statusOrder[getSessionStatus(a)] - statusOrder[getSessionStatus(b)]
        default:
          return 0
      }
    })

    return result
  }, [sessions, search, sortBy, filterBy])

  const handleViewLogs = (session: CrewSession) => {
    setSelectedSession(session)
    setLogViewerOpen(true)
  }

  const statusCounts = useMemo(() => {
    const counts = { all: sessions.length, active: 0, idle: 0, sleeping: 0 }
    sessions.forEach((s) => {
      const status = getSessionStatus(s)
      counts[status]++
    })
    return counts
  }, [sessions])

  return (
    <div className="h-full flex flex-col view-gradient">
      {/* Header with search and filters */}
      <div className="p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground hidden sm:block" />
            
            <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(filterLabels) as FilterOption[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {filterLabels[option]} ({statusCounts[option]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {sortLabels[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Count */}
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {filteredAndSortedSessions.length} session{filteredAndSortedSessions.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {filteredAndSortedSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="text-4xl mb-4">🔍</div>
              <p>No sessions found</p>
              {filterBy !== "all" && (
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => setFilterBy("all")}
                >
                  Show all sessions
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAndSortedSessions.map((session) => (
                <SessionCard
                  key={session.key}
                  session={session}
                  onViewLogs={() => handleViewLogs(session)}
                />
              ))}
            </div>
          )}
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
