import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { 
  History, 
  RefreshCw, 
  Search, 
  Archive,
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronRight,
  Filter,
  ChevronDown,
  MessageSquare,
  Bot
} from "lucide-react"

interface ArchivedSession {
  session_key: string
  session_id: string
  agent_id: string
  display_name: string
  minion_type: string
  model: string | null
  channel: string | null
  started_at: string   // ISO string
  ended_at: string     // ISO string
  message_count: number
  status: string
  summary: string
  file_path: string
}

interface ArchivedResponse {
  sessions: ArchivedSession[]
  total: number
  limit: number
  offset: number
}

const PAGE_SIZE = 50

function parseTimestamp(iso: string): number {
  return new Date(iso).getTime()
}

function formatDuration(startIso: string, endIso: string): string {
  const diff = parseTimestamp(endIso) - parseTimestamp(startIso)
  if (diff < 0) return "—"
  if (diff < 1000) return "< 1s"
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`
}

function formatDate(iso: string): string {
  const timestamp = parseTimestamp(iso)
  if (isNaN(timestamp)) return "—"
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - timestamp) / 86400000)
  
  if (diffDays === 0) return `Today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  if (diffDays === 1) return `Yesterday ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

function formatTotal(n: number): string {
  return n.toLocaleString()
}

function getStatusIcon(status: string) {
  switch (status) {
    case "archived": return <Archive className="h-4 w-4 text-blue-500" />
    case "completed":
    case "success": return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "error":
    case "failed": return <XCircle className="h-4 w-4 text-red-500" />
    case "timeout": return <Clock className="h-4 w-4 text-orange-500" />
    default: return <Archive className="h-4 w-4 text-muted-foreground" />
  }
}

function getStatusBadge(status: string) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary"
  if (status === "error" || status === "failed") variant = "destructive"
  else if (status === "completed" || status === "success") variant = "default"
  else if (status === "timeout") variant = "outline"
  return <Badge variant={variant}>{status}</Badge>
}

export function HistoryView() {
  const [sessions, setSessions] = useState<ArchivedSession[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const fetchHistory = useCallback(async (offset = 0, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: offset.toString(),
      })
      const response = await fetch(`/api/sessions/archived?${params}`)
      if (!response.ok) {
        // API not implemented yet - show placeholder
        if (!append) setSessions([])
        setTotal(0)
        setError(null)
      } else {
        const data: ArchivedResponse = await response.json()
        if (append) {
          setSessions(prev => [...prev, ...(data.sessions || [])])
        } else {
          setSessions(data.sessions || [])
        }
        setTotal(data.total ?? 0)
        setError(null)
      }
    } catch (_err) {
      // API not available - show placeholder
      if (!append) setSessions([])
      setTotal(0)
      setError(null)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleLoadMore = () => {
    fetchHistory(sessions.length, true)
  }

  const hasMore = sessions.length < total

  const filteredSessions = sessions.filter(s => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      return (
        s.session_key.toLowerCase().includes(searchLower) ||
        s.session_id.toLowerCase().includes(searchLower) ||
        s.display_name?.toLowerCase().includes(searchLower) ||
        s.agent_id?.toLowerCase().includes(searchLower) ||
        s.summary?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  return (
    <div className="h-full flex flex-col view-gradient">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Session History</h2>
              <p className="text-sm text-muted-foreground">
                {total > 0
                  ? `${formatTotal(total)} archived sessions`
                  : "Archived and completed sessions"}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchHistory()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="archived">Archived</option>
              <option value="completed">Completed</option>
              <option value="error">Error</option>
              <option value="timeout">Timeout</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => fetchHistory()}>
              Try Again
            </Button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <History className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No History Yet</h3>
            <p className="text-muted-foreground max-w-md">
              Completed and archived sessions will appear here.
              Sessions are automatically archived after completion or timeout.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted border border-border">
                <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Successful tasks</p>
              </div>
              <div className="p-4 rounded-lg bg-muted border border-border">
                <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Task duration tracking</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {filteredSessions.map((session) => (
              <div 
                key={session.session_id}
                className="p-4 rounded-lg bg-card border border-border hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {getStatusIcon(session.status)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground truncate">
                          {session.display_name || session.session_key}
                        </h3>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{formatDate(session.ended_at)}</span>
                        <span>Duration: {formatDuration(session.started_at, session.ended_at)}</span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {formatCount(session.message_count)} messages
                        </span>
                        {session.agent_id && (
                          <span className="inline-flex items-center gap-1">
                            <Bot className="h-3 w-3" />
                            {session.agent_id}
                          </span>
                        )}
                        {session.model && <span>{session.model}</span>}
                      </div>
                      {session.summary && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {session.summary}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-4 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="gap-2"
                >
                  {loadingMore ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Load more ({formatTotal(total - sessions.length)} remaining)
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
