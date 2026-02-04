import { useState, useEffect } from "react"
import { SESSION_CONFIG } from "@/lib/sessionConfig"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, RefreshCw, Play, Pause, AlertCircle, CheckCircle2, Timer } from "lucide-react"

interface CronJob {
  id: string
  name: string
  schedule: string
  lastRun: number | null
  nextRun: number | null
  status: "active" | "paused" | "error" | "running"
  lastResult?: "success" | "error"
  description?: string
}

function formatSchedule(cron: string): string {
  // Simple human-readable cron format
  const parts = cron.split(" ")
  if (parts.length !== 5) return cron
  
  const [minute, hour, _dayOfMonth, _month, dayOfWeek] = parts
  void _dayOfMonth // intentionally unused
  void _month // intentionally unused
  
  if (minute === "*" && hour === "*") return "Every minute"
  if (minute === "0" && hour === "*") return "Every hour"
  if (minute === "0" && hour === "0") return "Daily at midnight"
  if (minute !== "*" && hour !== "*" && dayOfWeek === "*") {
    return `Daily at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
  }
  
  return cron
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) return "Never"
  const date = new Date(timestamp)
  const now = new Date()
  const diff = timestamp - now.getTime()
  
  // Past times
  if (diff < 0) {
    const absDiff = Math.abs(diff)
    if (absDiff < 60000) return "Just now"
    if (absDiff < 3600000) return `${Math.floor(absDiff / 60000)}m ago`
    if (absDiff < 86400000) return `${Math.floor(absDiff / 3600000)}h ago`
    return date.toLocaleDateString()
  }
  
  // Future times
  if (diff < 60000) return "In < 1m"
  if (diff < 3600000) return `In ${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `In ${Math.floor(diff / 3600000)}h`
  return date.toLocaleDateString()
}

export function CronView() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/cron/jobs")
      if (!response.ok) {
        // API not implemented yet - show placeholder
        setJobs([])
        setError(null)
      } else {
        const data = await response.json()
        setJobs(data.jobs || [])
        setError(null)
      }
    } catch (err) {
      // API not available - show placeholder
      setJobs([])
      setError(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    // Poll every 30 seconds
    const interval = setInterval(fetchJobs, SESSION_CONFIG.cronViewPollMs)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: CronJob["status"]) => {
    switch (status) {
      case "active": return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "paused": return <Pause className="h-4 w-4 text-yellow-500" />
      case "running": return <Timer className="h-4 w-4 text-blue-500 animate-pulse" />
      case "error": return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: CronJob["status"]) => {
    const variants: Record<CronJob["status"], "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      paused: "secondary",
      running: "default",
      error: "destructive",
    }
    return <Badge variant={variants[status]}>{status}</Badge>
  }

  return (
    <div className="h-full flex flex-col view-gradient">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Scheduled Jobs</h2>
              <p className="text-sm text-muted-foreground">
                Manage cron-based agent tasks
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchJobs}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchJobs}>
              Try Again
            </Button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <Clock className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Scheduled Jobs</h3>
            <p className="text-muted-foreground max-w-md">
              Cron jobs will appear here when configured. 
              Jobs can be scheduled via the OpenClaw CLI or API.
            </p>
            <div className="mt-6 p-4 rounded-lg bg-muted border border-border text-left">
              <p className="text-xs text-muted-foreground mb-2">Example CLI command:</p>
              <code className="text-xs text-primary font-mono">
                openclaw cron add "0 9 * * *" --task "Daily summary"
              </code>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {jobs.map((job) => (
              <div 
                key={job.id}
                className="p-4 rounded-lg bg-card border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <h3 className="font-medium text-foreground">{job.name}</h3>
                      {job.description && (
                        <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatSchedule(job.schedule)}
                        </span>
                        <span>Last: {formatTime(job.lastRun)}</span>
                        <span>Next: {formatTime(job.nextRun)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(job.status)}
                    <Button variant="ghost" size="sm">
                      {job.status === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
