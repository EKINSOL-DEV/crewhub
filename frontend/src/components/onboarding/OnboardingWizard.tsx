/**
 * OnboardingWizard — First-run experience for CrewHub.
 *
 * 5-step wizard:
 *  1. Welcome
 *  2. Auto-Scan
 *  3. Configure Connections
 *  4. Room Setup (optional)
 *  5. Ready
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  scanForRuntimes,
  testConnection,
  type DiscoveryCandidate,
  type ScanResult,
} from "@/lib/api"
import {
  Search,
  Zap,
  Terminal,
  Bot,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Cable,
  Sparkles,
  Rocket,
  Eye,
  EyeOff,
  ExternalLink,
  Plus,
} from "lucide-react"
import { OpenClawWizard } from "./OpenClawWizard"
import { RoomSetupStep } from "./RoomSetupStep"

// ─── Types ──────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5

interface ConnectionConfig {
  id: string
  name: string
  type: string
  url: string
  token: string
  enabled: boolean
  testStatus: "idle" | "testing" | "success" | "error"
  testError?: string
  sessions?: number
}

interface OnboardingWizardProps {
  onComplete: () => void
  onSkip: () => void
}

// ─── Helpers ────────────────────────────────────────────────────

function getRuntimeIcon(type: string) {
  switch (type) {
    case "openclaw":
      return <Zap className="h-5 w-5" />
    case "claude_code":
      return <Terminal className="h-5 w-5" />
    case "codex_cli":
      return <Bot className="h-5 w-5" />
    default:
      return <Cable className="h-5 w-5" />
  }
}

function getRuntimeLabel(type: string) {
  switch (type) {
    case "openclaw":
      return "OpenClaw"
    case "claude_code":
      return "Claude Code"
    case "codex_cli":
      return "Codex CLI"
    default:
      return type
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "reachable":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Reachable
        </Badge>
      )
    case "installed":
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-3 w-3 mr-1" /> Installed
        </Badge>
      )
    case "auth_required":
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-3 w-3 mr-1" /> Auth Required
        </Badge>
      )
    case "unreachable":
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
          <XCircle className="h-3 w-3 mr-1" /> Unreachable
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary">
          <AlertCircle className="h-3 w-3 mr-1" /> Unknown
        </Badge>
      )
  }
}

function candidateToConnection(
  candidate: DiscoveryCandidate,
  index: number
): ConnectionConfig {
  const url =
    candidate.target.url ||
    `http://${candidate.target.host || "localhost"}:${candidate.target.port || 3000}`
  return {
    id: `discovered-${index}`,
    name: `${getRuntimeLabel(candidate.runtime_type)} (${candidate.target.host || "local"})`,
    type: candidate.runtime_type,
    url,
    token: "",
    enabled: candidate.status === "reachable",
    testStatus:
      candidate.status === "reachable" ? "success" : "idle",
    sessions: candidate.metadata.active_sessions,
  }
}

// ─── Step Components ────────────────────────────────────────────

function StepWelcome({
  onScan,
  onDemo,
  onManual,
  onOpenClawWizard,
}: {
  onScan: () => void
  onDemo: () => void
  onManual: () => void
  onOpenClawWizard: () => void
}) {
  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto space-y-8">
      <div className="relative">
        <img src="/logo.svg" alt="CrewHub" className="h-24 w-24" />
        <div className="absolute -top-2 -right-2">
          <Sparkles className="h-6 w-6 text-primary animate-pulse" />
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to CrewHub
        </h1>
        <p className="text-muted-foreground text-lg">
          Monitor and orchestrate your AI agents across all runtimes.
        </p>
      </div>

      <div className="w-full space-y-3">
        <Button
          size="lg"
          className="w-full gap-3 h-14 text-lg"
          onClick={onOpenClawWizard}
        >
          <Zap className="h-5 w-5" />
          Connect to OpenClaw
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full gap-3 h-12"
          onClick={onScan}
        >
          <Search className="h-5 w-5" />
          Auto-scan for agents
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="lg"
            className="flex-1 gap-2 h-10 text-muted-foreground"
            onClick={onDemo}
          >
            <Sparkles className="h-4 w-4" />
            Demo mode
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="flex-1 gap-2 h-10 text-muted-foreground"
            onClick={onManual}
          >
            <Cable className="h-4 w-4" />
            Manual setup
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground max-w-sm">
        We'll only scan your computer by default. LAN scanning requires
        permission.
      </p>
    </div>
  )
}

function StepScan({
  scanning,
  scanResult,
  candidates,
  onScanAgain,
  onConnect,
  onContinue,
  onDemo,
}: {
  scanning: boolean
  scanResult: ScanResult | null
  candidates: DiscoveryCandidate[]
  onScanAgain: () => void
  onConnect: (candidate: DiscoveryCandidate, index: number) => void
  onContinue: () => void
  onDemo: () => void
}) {
  const reachableCount = candidates.filter(
    (c) => c.status === "reachable"
  ).length
  const nothingFound = !scanning && scanResult && candidates.length === 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">
          {scanning
            ? "Scanning for agent runtimes…"
            : nothingFound
              ? "No runtimes found"
              : "Discovery Results"}
        </h2>
        {scanning && (
          <p className="text-muted-foreground">
            Checking localhost ports, config files, and CLIs…
          </p>
        )}
        {scanResult && !scanning && (
          <p className="text-muted-foreground text-sm">
            Scan completed in {scanResult.scan_duration_ms}ms
          </p>
        )}
      </div>

      {scanning && (
        <div className="flex items-center justify-center py-12">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <Search className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>
      )}

      {/* Candidates list */}
      {!scanning && candidates.length > 0 && (
        <div className="space-y-3">
          {candidates.map((candidate, index) => (
            <div
              key={index}
              className="p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary shrink-0">
                  {getRuntimeIcon(candidate.runtime_type)}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">
                      {getRuntimeLabel(candidate.runtime_type)}
                    </span>
                    {getStatusBadge(candidate.status)}
                    {candidate.confidence !== "high" && (
                      <Badge variant="outline" className="text-[10px]">
                        {candidate.confidence} confidence
                      </Badge>
                    )}
                  </div>

                  {candidate.target.url && (
                    <p className="text-sm text-muted-foreground font-mono">
                      {candidate.target.url}
                    </p>
                  )}

                  {candidate.metadata.active_sessions !== undefined && (
                    <p className="text-sm text-muted-foreground">
                      {candidate.metadata.active_sessions} active session
                      {candidate.metadata.active_sessions !== 1 ? "s" : ""}
                    </p>
                  )}

                  {candidate.metadata.version && (
                    <p className="text-xs text-muted-foreground">
                      Version: {candidate.metadata.version}
                    </p>
                  )}

                  {/* Evidence */}
                  {candidate.evidence.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {candidate.evidence.map((ev, ei) => (
                        <span
                          key={ei}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {candidate.status === "reachable" ? (
                    <Button
                      size="sm"
                      onClick={() => onConnect(candidate, index)}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Connect
                    </Button>
                  ) : candidate.status === "installed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      asChild
                    >
                      <a
                        href={`https://docs.crewhub.dev/runtimes/${candidate.runtime_type}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        How to enable
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nothing found state */}
      {nothingFound && (
        <div className="space-y-6 py-4">
          <div className="p-6 rounded-xl border bg-card text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">
                No agent runtimes detected
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                We checked your local machine but didn't find any running agent
                runtimes. Here's how to get started:
              </p>
            </div>

            <div className="grid gap-3 max-w-md mx-auto text-left">
              <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Start OpenClaw</p>
                  <p className="text-xs text-muted-foreground">
                    Run{" "}
                    <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                      openclaw gateway start
                    </code>{" "}
                    in your terminal
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-3">
                <Terminal className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Install Claude Code</p>
                  <p className="text-xs text-muted-foreground">
                    Visit{" "}
                    <a
                      href="https://docs.anthropic.com/claude-code"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      docs.anthropic.com/claude-code
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onScanAgain}
          disabled={scanning}
          className="gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`}
          />
          Scan again
        </Button>

        <div className="flex items-center gap-2">
          {nothingFound && (
            <Button variant="outline" onClick={onDemo} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Use demo data
            </Button>
          )}
          {reachableCount > 0 && (
            <Button onClick={onContinue} className="gap-2">
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function StepConfigure({
  connections,
  onUpdateConnection,
  onTestConnection,
  onAddManual,
  onRemoveConnection,
}: {
  connections: ConnectionConfig[]
  onUpdateConnection: (id: string, updates: Partial<ConnectionConfig>) => void
  onTestConnection: (id: string) => void
  onAddManual: () => void
  onRemoveConnection: (id: string) => void
}) {
  const [showTokens, setShowTokens] = useState<Set<string>>(new Set())

  const toggleToken = (id: string) => {
    setShowTokens((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Configure Connections</h2>
        <p className="text-muted-foreground">
          Review and adjust your connections. Test each one to make sure it
          works.
        </p>
      </div>

      <div className="space-y-4">
        {connections.map((conn) => (
          <div
            key={conn.id}
            className={`p-5 rounded-xl border transition-colors ${
              conn.enabled
                ? "bg-card border-border"
                : "bg-muted/30 border-border/50 opacity-60"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <Switch
                  checked={conn.enabled}
                  onCheckedChange={(checked) =>
                    onUpdateConnection(conn.id, { enabled: checked })
                  }
                />
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  {getRuntimeIcon(conn.type)}
                  <span className="text-sm font-medium text-muted-foreground">
                    {getRuntimeLabel(conn.type)}
                  </span>
                  {conn.testStatus === "success" && (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-0.5" />
                      Connected
                      {conn.sessions !== undefined && ` (${conn.sessions} sessions)`}
                    </Badge>
                  )}
                  {conn.testStatus === "error" && (
                    <Badge variant="destructive" className="text-[10px]">
                      <XCircle className="h-3 w-3 mr-0.5" />
                      Failed
                    </Badge>
                  )}
                </div>

                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={conn.name}
                      onChange={(e) =>
                        onUpdateConnection(conn.id, { name: e.target.value })
                      }
                      placeholder="Connection name"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">URL</Label>
                    <Input
                      value={conn.url}
                      onChange={(e) =>
                        onUpdateConnection(conn.id, { url: e.target.value })
                      }
                      placeholder="http://localhost:3000"
                      className="h-9 font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Token (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showTokens.has(conn.id) ? "text" : "password"}
                        value={conn.token}
                        onChange={(e) =>
                          onUpdateConnection(conn.id, { token: e.target.value })
                        }
                        placeholder="API token"
                        className="h-9 flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => toggleToken(conn.id)}
                      >
                        {showTokens.has(conn.id) ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {conn.testError && (
                  <p className="text-sm text-red-500 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 shrink-0" />
                    {conn.testError}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTestConnection(conn.id)}
                    disabled={conn.testStatus === "testing" || !conn.enabled}
                    className="gap-1.5"
                  >
                    {conn.testStatus === "testing" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                    Test connection
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveConnection(conn.id)}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          className="w-full gap-2 h-12 border-dashed"
          onClick={onAddManual}
        >
          <Plus className="h-4 w-4" />
          Add connection manually
        </Button>
      </div>
    </div>
  )
}

function StepReady({
  connections,
  onGoDashboard,
}: {
  connections: ConnectionConfig[]
  onGoDashboard: () => void
}) {
  const enabledConnections = connections.filter((c) => c.enabled)
  const totalSessions = enabledConnections.reduce(
    (sum, c) => sum + (c.sessions ?? 0),
    0
  )

  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto space-y-8">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Rocket className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        <div className="absolute -top-1 -right-1">
          <Sparkles className="h-6 w-6 text-green-500 animate-pulse" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold">You're all set!</h2>
        <p className="text-muted-foreground text-lg">
          CrewHub is ready to monitor your agents.
        </p>
      </div>

      {enabledConnections.length > 0 && (
        <div className="w-full space-y-3">
          {enabledConnections.map((conn) => (
            <div
              key={conn.id}
              className="p-3 rounded-lg border bg-card flex items-center gap-3"
            >
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                {getRuntimeIcon(conn.type)}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">{conn.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {conn.url}
                </p>
              </div>
              {conn.testStatus === "success" && (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              )}
            </div>
          ))}

          {totalSessions > 0 && (
            <p className="text-sm text-muted-foreground">
              {totalSessions} active session{totalSessions !== 1 ? "s" : ""}{" "}
              ready to stream
            </p>
          )}
        </div>
      )}

      {enabledConnections.length === 0 && (
        <p className="text-muted-foreground">
          No connections configured yet. You can add them anytime from Settings.
        </p>
      )}

      <Button
        size="lg"
        className="w-full gap-3 h-14 text-lg"
        onClick={onGoDashboard}
      >
        <Rocket className="h-5 w-5" />
        Go to dashboard
      </Button>
    </div>
  )
}

// ─── Progress Bar ───────────────────────────────────────────────

function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
            i + 1 <= step ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [showOpenClawWizard, setShowOpenClawWizard] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([])
  const [connections, setConnections] = useState<ConnectionConfig[]>([])
  const scanAbortRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      scanAbortRef.current?.abort()
    }
  }, [])

  // ─── Scan ─────────────────────────────────────────────────────

  const runScan = useCallback(async () => {
    setScanning(true)
    setScanResult(null)
    setCandidates([])

    try {
      const result = await scanForRuntimes()
      setScanResult(result)
      setCandidates(result.candidates)

      // Auto-create connection configs for reachable candidates
      const newConnections = result.candidates
        .filter((c) => c.status === "reachable")
        .map((c, i) => candidateToConnection(c, i))
      if (newConnections.length > 0) {
        setConnections(newConnections)
      }
    } catch {
      // API not available — show mock/empty state
      setScanResult({ candidates: [], scan_duration_ms: 0 })
      setCandidates([])
    } finally {
      setScanning(false)
    }
  }, [])

  // ─── Connection handlers ──────────────────────────────────────

  const handleConnect = useCallback(
    (candidate: DiscoveryCandidate, index: number) => {
      const conn = candidateToConnection(candidate, index)
      conn.enabled = true
      setConnections((prev) => {
        // Don't add duplicates
        if (prev.some((c) => c.url === conn.url && c.type === conn.type)) {
          return prev
        }
        return [...prev, conn]
      })
    },
    []
  )

  const handleUpdateConnection = useCallback(
    (id: string, updates: Partial<ConnectionConfig>) => {
      setConnections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      )
    },
    []
  )

  const handleTestConnection = useCallback(
    async (id: string) => {
      const conn = connections.find((c) => c.id === id)
      if (!conn) return

      handleUpdateConnection(id, { testStatus: "testing", testError: undefined })

      try {
        const result = await testConnection(
          conn.type,
          conn.url,
          conn.token || undefined
        )
        if (result.reachable) {
          handleUpdateConnection(id, {
            testStatus: "success",
            sessions: result.sessions,
          })
        } else {
          handleUpdateConnection(id, {
            testStatus: "error",
            testError: result.error || "Connection failed",
          })
        }
      } catch (err) {
        handleUpdateConnection(id, {
          testStatus: "error",
          testError: err instanceof Error ? err.message : "Test failed",
        })
      }
    },
    [connections, handleUpdateConnection]
  )

  const handleAddManual = useCallback(() => {
    const id = `manual-${Date.now()}`
    setConnections((prev) => [
      ...prev,
      {
        id,
        name: "New Connection",
        type: "openclaw",
        url: "http://localhost:3000",
        token: "",
        enabled: true,
        testStatus: "idle",
      },
    ])
  }, [])

  const handleRemoveConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // ─── Save connections to API ──────────────────────────────────

  const saveConnections = useCallback(async () => {
    const enabled = connections.filter((c) => c.enabled)
    for (const conn of enabled) {
      try {
        const config: Record<string, string> = {}
        if (conn.type === "openclaw") {
          config.gateway_url = conn.url
          if (conn.token) config.token = conn.token
        } else {
          config.cli_path = conn.url
          if (conn.token) config.api_key = conn.token
        }

        await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: conn.name,
            type: conn.type,
            config,
            enabled: true,
          }),
        })
      } catch {
        // Best-effort; user can fix later
      }
    }
  }, [connections])

  // ─── Complete onboarding ──────────────────────────────────────

  const completeOnboarding = useCallback(async () => {
    await saveConnections()

    // Mark completed in localStorage (fallback)
    localStorage.setItem("crewhub-onboarded", "true")

    // Try to mark in API too
    try {
      await fetch("/api/settings/crewhub-onboarded", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "true" }),
      })
    } catch {
      // localStorage is enough
    }

    onComplete()
  }, [saveConnections, onComplete])

  // ─── Navigation ───────────────────────────────────────────────

  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, 5) as WizardStep)
  }, [])

  const goBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1) as WizardStep)
  }, [])

  const handleSkip = useCallback(() => {
    localStorage.setItem("crewhub-onboarded", "true")
    onSkip()
  }, [onSkip])

  const handleDemo = useCallback(() => {
    localStorage.setItem("crewhub-onboarded", "true")
    localStorage.setItem("crewhub-demo-mode", "true")
    onComplete()
  }, [onComplete])

  const handleOpenClawComplete = useCallback(
    async (config: { name: string; url: string; token: string; botTemplate?: string }) => {
      // Save the OpenClaw connection via API
      try {
        await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: config.name,
            type: "openclaw",
            config: {
              gateway_url: config.url,
              token: config.token,
            },
            enabled: true,
          }),
        })
      } catch {
        // Best-effort
      }

      // Mark onboarding complete
      localStorage.setItem("crewhub-onboarded", "true")
      try {
        await fetch("/api/settings/crewhub-onboarded", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: "true" }),
        })
      } catch {}

      onComplete()
    },
    [onComplete]
  )

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="CrewHub" className="h-8 w-8" />
            <span className="font-semibold text-lg">CrewHub Setup</span>
          </div>
          {step > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Skip setup
            </Button>
          )}
        </div>
        <div className="max-w-3xl mx-auto px-6 pb-4">
          <StepProgress step={step} total={5} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-10">
          {step === 1 && !showOpenClawWizard && (
            <StepWelcome
              onScan={() => {
                setStep(2)
                runScan()
              }}
              onDemo={handleDemo}
              onManual={handleSkip}
              onOpenClawWizard={() => setShowOpenClawWizard(true)}
            />
          )}
          {step === 1 && showOpenClawWizard && (
            <OpenClawWizard
              onComplete={handleOpenClawComplete}
              onSkip={() => setShowOpenClawWizard(false)}
            />
          )}
          {step === 2 && (
            <StepScan
              scanning={scanning}
              scanResult={scanResult}
              candidates={candidates}
              onScanAgain={runScan}
              onConnect={handleConnect}
              onContinue={goNext}
              onDemo={handleDemo}
            />
          )}
          {step === 3 && (
            <StepConfigure
              connections={connections}
              onUpdateConnection={handleUpdateConnection}
              onTestConnection={handleTestConnection}
              onAddManual={handleAddManual}
              onRemoveConnection={handleRemoveConnection}
            />
          )}
          {step === 4 && (
            <RoomSetupStep onComplete={goNext} />
          )}
          {step === 5 && (
            <StepReady
              connections={connections}
              onGoDashboard={completeOnboarding}
            />
          )}
        </div>
      </div>

      {/* Footer navigation */}
      {step > 1 && step < 5 && (
        <div className="shrink-0 border-t bg-card/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <Button variant="outline" onClick={goBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {step !== 4 && (
              <Button onClick={goNext} className="gap-2">
                {step === 3 ? "Save & Continue" : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
