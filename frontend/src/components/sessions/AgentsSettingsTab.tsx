import { useState, useEffect, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { API_BASE } from "@/lib/api"
import { Loader2, Edit2, Check, X, Sparkles } from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────

interface Agent {
  id: string
  name: string
  icon: string | null
  avatar_url: string | null
  color: string | null
  agent_session_key: string | null
  default_model: string | null
  default_room_id: string | null
  sort_order: number
  is_pinned: boolean
  auto_spawn: boolean
  bio: string | null
  created_at: number
  updated_at: number
}

// ── API helpers ──────────────────────────────────────────────────────

async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/agents`)
  if (!res.ok) throw new Error("Failed to fetch agents")
  const data = await res.json()
  return data.agents
}

async function updateAgent(agentId: string, updates: Partial<Agent>): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error("Failed to update agent")
}

async function generateAgentBio(agentId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/generate-bio`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to generate bio")
  const data = await res.json()
  return data.bio
}

// ── Color preview sphere (CSS 3D-ish) ────────────────────────────────

function ColorSphere({ color, size = 48 }: { color: string; size?: number }) {
  return (
    <div
      className="rounded-full shrink-0 shadow-lg"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 35%, ${color}cc, ${color} 50%, ${color}88 100%)`,
        border: `2px solid ${color}`,
      }}
    />
  )
}

// ── Agent Card ───────────────────────────────────────────────────────

function AgentCard({ agent, onSave }: { agent: Agent; onSave: (id: string, updates: Partial<Agent>) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [color, setColor] = useState(agent.color || "#6b7280")
  const [bio, setBio] = useState(agent.bio || "")
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const { toast } = useToast()

  // Reset local state when agent prop changes
  useEffect(() => {
    setColor(agent.color || "#6b7280")
    setBio(agent.bio || "")
  }, [agent.color, agent.bio])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(agent.id, { color, bio: bio || null })
      setEditing(false)
      toast({ title: "Agent Updated", description: `${agent.icon} ${agent.name} saved` })
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateBio = async () => {
    setGenerating(true)
    try {
      const generatedBio = await generateAgentBio(agent.id)
      setBio(generatedBio)
    } catch {
      toast({ title: "Failed to generate bio", variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  const handleCancel = () => {
    setColor(agent.color || "#6b7280")
    setBio(agent.bio || "")
    setEditing(false)
  }

  const lastSeen = agent.updated_at
    ? new Date(agent.updated_at).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "Unknown"

  return (
    <div className="rounded-xl border bg-card/80 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Color sphere preview */}
        <ColorSphere color={editing ? color : (agent.color || "#6b7280")} size={52} />

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{agent.icon || "🤖"}</span>
            <h3 className="font-semibold text-sm">{agent.name}</h3>
            {agent.is_pinned && <Badge variant="secondary" className="text-[10px]">Pinned</Badge>}
          </div>

          {!editing && (
            <>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {agent.bio || <span className="italic">No bio set</span>}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2">
                <span className="font-mono">{agent.id}</span>
                <span>•</span>
                <span>{lastSeen}</span>
                {agent.default_model && (
                  <>
                    <span>•</span>
                    <span>{agent.default_model}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Edit button */}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Edit agent"
          >
            <Edit2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {/* Color picker */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Bot Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded-lg border cursor-pointer bg-transparent"
                title="Pick a color"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 text-xs font-mono w-28"
                placeholder="#hex"
              />
              <ColorSphere color={color} size={36} />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Bio</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateBio}
                disabled={generating}
                className="h-7 text-xs gap-1"
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Generate
              </Button>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full h-20 rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Write a short bio for this agent..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Tab Component ───────────────────────────────────────────────

export function AgentsSettingsTab() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadAgents = useCallback(async () => {
    try {
      const data = await fetchAgents()
      setAgents(data)
    } catch {
      toast({ title: "Failed to load agents", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadAgents() }, [loadAgents])

  const handleSave = async (agentId: string, updates: Partial<Agent>) => {
    await updateAgent(agentId, updates)
    // Update local state immediately
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, ...updates } : a))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading agents…
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="text-sm text-muted-foreground mb-2">
        Manage your crew's appearance and personality. Color changes reflect in the 3D world after save.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} onSave={handleSave} />
        ))}
      </div>
      {agents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No agents registered yet. They'll appear here once discovered from the Gateway.
        </div>
      )}
    </div>
  )
}
