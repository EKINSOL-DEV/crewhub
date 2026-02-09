/**
 * OpenClawWizard — Focused OpenClaw connection wizard with:
 * - Docker detection + localhost warning
 * - Suggested URLs
 * - Test Connection with error classification + hints
 * - First bot creation (Default/Dev/Reviewer templates)
 */

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getEnvironmentInfo,
  testOpenClawConnection,
  type EnvironmentInfo,
  type TestOpenClawResult,
} from "@/lib/api"
import {
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Server,
  Container,
  Network,
  Settings2,
  Bot,
  Code2,
  Search as SearchIcon,
  Sparkles,
  Rocket,
  Info,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────

type WizardStep = 0 | 1 | 2

type SetupMode = "same-machine" | "docker" | "lan" | "advanced"

interface BotTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  agentId: string
  color: string
}

interface OpenClawWizardProps {
  onComplete: (connectionConfig: {
    name: string
    url: string
    token: string
    botTemplate?: string
    displayName?: string
  }) => void
  onSkip: () => void
}

// ─── Constants ──────────────────────────────────────────────────

const BOT_TEMPLATES: BotTemplate[] = [
  {
    id: "default",
    name: "Default Bot",
    description: "General-purpose assistant based on the main agent.",
    icon: <Bot className="h-5 w-5" />,
    agentId: "main",
    color: "#4f46e5",
  },
  {
    id: "developer",
    name: "Developer Bot",
    description: "Focused on coding, debugging, and technical tasks.",
    icon: <Code2 className="h-5 w-5" />,
    agentId: "dev",
    color: "#10b981",
  },
  {
    id: "reviewer",
    name: "Reviewer Bot",
    description: "Code review, documentation review, and quality checks.",
    icon: <SearchIcon className="h-5 w-5" />,
    agentId: "reviewer",
    color: "#f59e0b",
  },
]

const SETUP_MODES = [
  {
    id: "same-machine" as SetupMode,
    title: "Same computer",
    description: "CrewHub and OpenClaw are on the same machine",
    icon: <Server className="h-5 w-5" />,
  },
  {
    id: "docker" as SetupMode,
    title: "CrewHub in Docker",
    description: "CrewHub runs in Docker, OpenClaw on the host",
    icon: <Container className="h-5 w-5" />,
  },
  {
    id: "lan" as SetupMode,
    title: "Another computer (LAN)",
    description: "OpenClaw is on a different machine on your network",
    icon: <Network className="h-5 w-5" />,
  },
  {
    id: "advanced" as SetupMode,
    title: "Advanced / Custom",
    description: "Remote server, reverse proxy, or custom setup",
    icon: <Settings2 className="h-5 w-5" />,
  },
]

// ─── Error Category Styling ─────────────────────────────────────

function getCategoryColor(category: string | null): string {
  switch (category) {
    case "dns":
      return "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
    case "tcp":
      return "border-red-500 bg-red-50 dark:bg-red-950/30"
    case "auth":
      return "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
    case "ws":
    case "protocol":
      return "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
    case "timeout":
      return "border-gray-500 bg-gray-50 dark:bg-gray-950/30"
    default:
      return "border-red-500 bg-red-50 dark:bg-red-950/30"
  }
}

function getCategoryLabel(category: string | null): string {
  switch (category) {
    case "dns":
      return "DNS / Host Not Found"
    case "tcp":
      return "Port / Firewall"
    case "auth":
      return "Authentication"
    case "ws":
      return "WebSocket Error"
    case "protocol":
      return "Protocol Mismatch"
    case "timeout":
      return "Timeout"
    default:
      return "Connection Error"
  }
}

// ─── Main Component ─────────────────────────────────────────────

export function OpenClawWizard({ onComplete, onSkip }: OpenClawWizardProps) {
  const [step, setStep] = useState<WizardStep>(0)
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null)
  const [envLoading, setEnvLoading] = useState(true)
  const [setupMode, setSetupMode] = useState<SetupMode>("same-machine")

  // Connection fields
  const [url, setUrl] = useState("ws://127.0.0.1:18789")
  const [token, setToken] = useState("")
  const [connectionName, setConnectionName] = useState("OpenClaw Local")
  const [showToken, setShowToken] = useState(false)

  // Test state
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestOpenClawResult | null>(null)

  // Bot template
  const [selectedTemplate, setSelectedTemplate] = useState<string>("default")
  const [createBot, setCreateBot] = useState(true)

  // Display name
  const [displayName, setDisplayName] = useState("Assistant")

  // Load environment info on mount
  useEffect(() => {
    ;(async () => {
      try {
        const info = await getEnvironmentInfo()
        setEnvInfo(info)

        // Auto-detect Docker mode
        if (info.is_docker) {
          setSetupMode("docker")
        }

        // Pre-fill URL from suggestions
        if (info.suggested_urls.length > 0) {
          setUrl(info.suggested_urls[0])
        }
      } catch {
        // API not available, use defaults
      } finally {
        setEnvLoading(false)
      }
    })()
  }, [])

  // Update URL when setup mode changes
  useEffect(() => {
    if (!envInfo) return
    switch (setupMode) {
      case "same-machine":
        setUrl("ws://127.0.0.1:18789")
        break
      case "docker":
        if (envInfo.docker_host_internal_reachable) {
          setUrl("ws://host.docker.internal:18789")
        } else if (envInfo.lan_ip) {
          setUrl(`ws://${envInfo.lan_ip}:18789`)
        }
        break
      case "lan":
        setUrl(envInfo.lan_ip ? `ws://${envInfo.lan_ip}:18789` : "ws://<HOST_IP>:18789")
        break
      case "advanced":
        // Don't change URL
        break
    }
  }, [setupMode, envInfo])

  const isLocalhostInDocker =
    envInfo?.is_docker &&
    (url.includes("localhost") || url.includes("127.0.0.1"))

  // ─── Test Connection ──────────────────────────────────────────

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testOpenClawConnection(url, token || undefined)
      setTestResult(result)
    } catch (err) {
      setTestResult({
        ok: false,
        category: null,
        message: err instanceof Error ? err.message : "Test failed",
        hints: [],
        sessions: null,
      })
    } finally {
      setTesting(false)
    }
  }, [url, token])

  // ─── Complete ─────────────────────────────────────────────────

  const handleComplete = useCallback(() => {
    onComplete({
      name: connectionName,
      url,
      token,
      botTemplate: createBot ? selectedTemplate : undefined,
      displayName: displayName.trim() || undefined,
    })
  }, [connectionName, url, token, createBot, selectedTemplate, displayName, onComplete])

  // ─── Step 0: Choose setup mode ────────────────────────────────

  const renderStep0 = () => (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Connect to OpenClaw</h2>
        <p className="text-muted-foreground">
          Where is your OpenClaw gateway running?
        </p>
      </div>

      {/* Docker auto-detect banner */}
      {envInfo?.is_docker && (
        <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 flex items-start gap-3">
          <Container className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Docker environment detected
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              We detected CrewHub is running in a container. We've pre-selected
              the Docker option below.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {SETUP_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setSetupMode(mode.id)}
            className={`w-full p-4 rounded-xl border transition-all text-left flex items-center gap-4 ${
              setupMode === mode.id
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                : "border-border bg-card hover:bg-accent/30"
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                setupMode === mode.id
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {mode.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{mode.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {mode.description}
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                setupMode === mode.id
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30"
              }`}
            >
              {setupMode === mode.id && (
                <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          Skip for now
        </Button>
        <Button onClick={() => setStep(1)} className="gap-2">
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  // ─── Step 1: Connection details + Test ────────────────────────

  const renderStep1 = () => (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Connection Details</h2>
        <p className="text-muted-foreground">
          Enter your OpenClaw gateway URL and token.
        </p>
      </div>

      {/* Docker localhost warning */}
      {isLocalhostInDocker && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              ⚠️ localhost won't work in Docker
            </p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              In Docker, <code className="px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/50 font-mono text-[11px]">localhost</code> points
              to the container itself, not the host machine. Use one of the suggested URLs below.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-xs">Connection Name</Label>
          <Input
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            placeholder="OpenClaw Local"
            className="h-9"
          />
        </div>

        {/* URL */}
        <div className="space-y-1.5">
          <Label className="text-xs">WebSocket URL</Label>
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setTestResult(null)
            }}
            placeholder="ws://127.0.0.1:18789"
            className="h-9 font-mono text-sm"
          />

          {/* Suggested URLs */}
          {envInfo && envInfo.suggested_urls.length > 0 && (
            <div className="space-y-1 mt-2">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Suggested URLs
              </p>
              <div className="flex flex-wrap gap-1.5">
                {envInfo.suggested_urls.map((suggestedUrl) => (
                  <button
                    key={suggestedUrl}
                    onClick={() => {
                      setUrl(suggestedUrl)
                      setTestResult(null)
                    }}
                    className={`text-xs px-2.5 py-1 rounded-md font-mono transition-colors ${
                      url === suggestedUrl
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-muted text-muted-foreground hover:bg-accent border border-transparent"
                    }`}
                  >
                    {suggestedUrl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Docker bind mode help */}
          {setupMode === "docker" && (
            <div className="flex items-start gap-2 mt-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
              <div className="text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5">
                <p className="font-semibold">⚠️ OpenClaw Gateway must listen on all interfaces</p>
                <p>By default, OpenClaw binds to <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900 font-mono text-[10px]">loopback</code> (localhost only).</p>
                <p>For Docker to connect, change to <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900 font-mono text-[10px]">"bind": "lan"</code> in <code className="font-mono">~/.openclaw/openclaw.json</code>:</p>
                <div className="mt-1 p-2 rounded bg-amber-100 dark:bg-amber-900 font-mono text-[10px] space-y-0.5">
                  <div><span className="text-amber-700 dark:text-amber-400">"gateway"</span>: &#123;</div>
                  <div className="ml-2"><span className="text-amber-700 dark:text-amber-400">"bind"</span>: <span className="text-green-700 dark:text-green-400">"lan"</span>,  <span className="text-gray-500">// was: "loopback"</span></div>
                  <div>&#125;</div>
                </div>
                <p className="mt-1">Then restart: <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900 font-mono text-[10px]">openclaw gateway restart</code></p>
              </div>
            </div>
          )}
        </div>

        {/* Token */}
        <div className="space-y-1.5">
          <Label className="text-xs">API Token</Label>
          <div className="flex gap-2">
            <Input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => {
                setToken(e.target.value)
                setTestResult(null)
              }}
              placeholder="Paste your gateway token"
              className="h-9 flex-1"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Security notice */}
          <div className="flex items-start gap-2 mt-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
            <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
            <div className="text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-semibold">🔒 Security Notice</p>
              <ul className="list-none space-y-0.5">
                <li>• Keep this token private — anyone with it can control your agents</li>
                <li>• For public/remote deployments, use WSS (not WS) and HTTPS</li>
                <li>• We do NOT recommend running CrewHub publicly accessible yet</li>
                <li>• Authentication and security hardening are currently in development</li>
                <li>• See <a href="https://github.com/ekinsolbot/crewhub/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-700 dark:hover:text-amber-300">SECURITY.md</a> for more details</li>
              </ul>
            </div>
          </div>

          {/* Help text: How to find token */}
          {!envInfo?.token_file_path && (
            <div className="flex items-start gap-2 mt-1.5 p-2 rounded-md bg-muted/50">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-[11px] text-muted-foreground space-y-1">
                <p className="font-medium">How to find your gateway token:</p>
                <p>Run in terminal: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">openclaw config get | jq -r '.gateway.auth.token'</code></p>
                <p className="text-[10px]">Or find it in <code className="font-mono">~/.openclaw/openclaw.json</code> under <code className="font-mono">gateway.auth.token</code></p>
              </div>
            </div>
          )}

          {/* Token file hint */}
          {envInfo?.token_file_path && (
            <div className="flex items-start gap-2 mt-1.5 p-2 rounded-md bg-muted/50">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Token found in:{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">
                    {envInfo.token_file_path}
                  </code>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Look for <code className="font-mono">gateway.auth.token</code> in the JSON file.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Test Connection Button */}
        <Button
          onClick={handleTest}
          disabled={testing || !url}
          className="w-full gap-2"
          variant={testResult?.ok ? "default" : "outline"}
        >
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : testResult?.ok ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {testing
            ? "Testing…"
            : testResult?.ok
              ? "Connected ✓"
              : "Test Connection"}
        </Button>

        {/* Test Result */}
        {testResult && !testResult.ok && (
          <div
            className={`p-4 rounded-lg border-l-4 space-y-2 ${getCategoryColor(testResult.category)}`}
          >
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {getCategoryLabel(testResult.category)}
              </span>
            </div>
            <p className="text-sm font-medium">{testResult.message}</p>
            {testResult.hints.length > 0 && (
              <ul className="space-y-1 mt-2">
                {testResult.hints.map((hint, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">→</span>
                    {hint}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Success result */}
        {testResult?.ok && (
          <div className="p-4 rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                {testResult.message}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep(0)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={() => setStep(2)}
          disabled={!testResult?.ok}
          className="gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  // ─── Step 2: First bot creation ───────────────────────────────

  const renderStep2 = () => (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 mb-2">
          <Rocket className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold">Create Your First Bot</h2>
        <p className="text-muted-foreground">
          Choose a template and give your agent a name.
        </p>
      </div>

      {/* Display Name */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Agent Display Name</Label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Assistant, Helper Bot, DevBot"
          className="h-9"
        />
        <p className="text-[11px] text-muted-foreground">
          This is how your agent will appear in CrewHub. You can change it later.
        </p>
      </div>

      <div className="space-y-2">
        {BOT_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.id}
            onClick={() => {
              setSelectedTemplate(tmpl.id)
              setCreateBot(true)
            }}
            className={`w-full p-4 rounded-xl border transition-all text-left flex items-center gap-4 ${
              createBot && selectedTemplate === tmpl.id
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                : "border-border bg-card hover:bg-accent/30"
            }`}
          >
            <div
              className="p-2.5 rounded-lg shrink-0"
              style={{
                backgroundColor: `${tmpl.color}15`,
                color: tmpl.color,
              }}
            >
              {tmpl.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{tmpl.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {tmpl.description}
              </div>
            </div>
            {tmpl.id === "default" && (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                Recommended
              </Badge>
            )}
          </button>
        ))}

        <button
          onClick={() => setCreateBot(false)}
          className={`w-full p-3 rounded-xl border transition-all text-left flex items-center gap-3 ${
            !createBot
              ? "border-primary bg-primary/5"
              : "border-border/50 bg-muted/30 hover:bg-accent/30"
          }`}
        >
          <span className="text-sm text-muted-foreground">
            Skip — I'll configure agents later (they will appear with default names/colors)
          </span>
        </button>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleComplete} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {createBot ? "Create & Finish" : "Finish Setup"}
        </Button>
      </div>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────

  if (envLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="py-8 px-4">
      {/* Progress */}
      <div className="max-w-lg mx-auto mb-8">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          <span>Setup Mode</span>
          <span>Connection</span>
          <span>First Bot</span>
        </div>
      </div>

      {step === 0 && renderStep0()}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
    </div>
  )
}
