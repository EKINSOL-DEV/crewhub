import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { 
  History, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronRight,
  Filter
} from "lucide-react"

interface ArchivedSession {
  id: string
  key: string
  label?: string
  displayName?: string
  model?: string
  startedAt: number
  endedAt: number
  totalTokens: number
  outcome: "success" | "error" | "aborted" | "timeout"
  summary?: string
}

function formatDuration(start: number, end: number): string {
  const diff = end - start
  if (diff < 1000) return "< 1s"
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - timestamp) / 86400000)
  
  if (diffDays === 0) return `Today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  if (diffDays === 1) return `Yesterday ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

function getOutcomeIcon(outcome: ArchivedSession["outcome"]) {
  switch (outcome) {
    case "success": return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "error": return <XCircle className="h-4 w-4 text-red-500" />
    case "aborted": return <XCircle className="h-4 w-4 text-yellow-500" />
    case "timeout": return <Clock className="h-4 w-4 text-orange-500" />
  }
}

function getOutcomeBadge(outcome: ArchivedSession["outcome"]) {
  const variants: Record<ArchivedSession["outcome"], "default" | "secondary" | "destructive" | "outline"> = {
    success: "default",
    error: "destructive",
    aborted: "secondary",
    timeout: "outline",
  }
  return <Badge variant={variants[outcome]}>{outcome}</Badge>
}

export function HistoryView() {
  const [sessions, setSessions] = useState<ArchivedSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [outcomeFilter, setOutcomeFilter] = useState<ArchivedSession["outcome"] | "all">("all")

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/sessions/archived")
      if (!response.ok) {
        // API not implemented yet - show placeholder
        setSessions([])
        setError(null)
      } else {
        const data = await response.json()
        setSessions(data.sessions || [])
        setError(null)
      }
    } catch (err) {
      // API not available - show placeholder
      setSessions([])
      setError(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const filteredSessions = sessions.filter(s => {
    if (outcomeFilter !== "all" && s.outcome !== outcomeFilter) return false
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      return (
        s.key.toLowerCase().includes(searchLower) ||
        s.label?.toLowerCase().includes(searchLower) ||
        s.displayName?.toLowerCase().includes(searchLower)
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
                Archived and completed sessions
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchHistory}
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
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as ArchivedSession["outcome"] | "all")}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All outcomes</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="aborted">Aborted</option>
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
            <Button variant="outline" className="mt-4" onClick={fetchHistory}>
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
                key={session.id}
                className="p-4 rounded-lg bg-card border border-border hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {getOutcomeIcon(session.outcome)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground truncate">
                          {session.displayName || session.label || session.key}
                        </h3>
                        {getOutcomeBadge(session.outcome)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{formatDate(session.endedAt)}</span>
                        <span>Duration: {formatDuration(session.startedAt, session.endedAt)}</span>
                        <span>{formatTokens(session.totalTokens)} tokens</span>
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
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
