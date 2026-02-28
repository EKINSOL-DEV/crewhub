import { useState, useEffect, useCallback, useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { API_BASE } from '@/lib/api'
import { Loader2, Edit2, Check, X, Sparkles, Trash2, Plus, AlertTriangle } from 'lucide-react'

const BORDER_1PX_SOLID_HSL_VAR_BORDER = '1px solid hsl(var(--border))'
const CLS_H_4_W_4_MR_1 = 'h-4 w-4 mr-1'
const CLS_TEXT_XS_FONT_MEDIUM = 'text-xs font-medium'
const DESTRUCTIVE = 'destructive'
const HEADQUARTERS = 'headquarters'
const HSL_BACKGROUND = 'hsl(var(--background))'
const HSL_FOREGROUND = 'hsl(var(--foreground))'

// ── Types ────────────────────────────────────────────────────────────

interface Agent {
  id: string
  name: string
  display_name: string | null
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
  is_stale: boolean
  source: string
  project_path: string | null
  permission_mode: string | null
}

interface Room {
  id: string
  name: string
  icon: string | null
}

// ── API helpers ──────────────────────────────────────────────────────

async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/agents`)
  if (!res.ok) throw new Error('Failed to fetch agents')
  const data = await res.json()
  return data.agents
}

async function fetchRooms(): Promise<Room[]> {
  const res = await fetch(`${API_BASE}/rooms`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.rooms ?? data) as Room[]
}

async function updateAgent(agentId: string, updates: Partial<Agent>): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update agent')
}

async function deleteAgent(agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${agentId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete agent')
}

async function createAgent(payload: {
  id: string
  name: string
  icon: string
  color: string
  default_room_id: string
  bio?: string
  source?: string
  project_path?: string
  permission_mode?: string
}): Promise<void> {
  const res = await fetch(`${API_BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Failed to create agent')
  }
}

async function generateAgentBio(agentId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/generate-bio`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to generate bio')
  const data = await res.json()
  return data.bio
}

// ── Color preview sphere (CSS 3D-ish) ────────────────────────────────

function ColorSphere({ color, size = 48 }: Readonly<{ color: string; readonly size?: number }>) {
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

// ── Add Agent Modal ──────────────────────────────────────────────────

function AddAgentModal({
  rooms,
  onClose,
  onCreated,
}: Readonly<{
  readonly rooms: Room[]
  readonly onClose: () => void
  readonly onCreated: () => void
}>) {
  const [source, setSource] = useState<'openclaw' | 'claude_code'>('openclaw')
  const [name, setName] = useState('')
  const [agentId, setAgentId] = useState('')
  const [icon, setIcon] = useState('🤖')
  const [color, setColor] = useState('#6b7280')
  const [roomId, setRoomId] = useState(HEADQUARTERS)
  const [bio, setBio] = useState('')
  const [projectPath, setProjectPath] = useState('')
  const [permissionMode, setPermissionMode] = useState('default')
  const [saving, setSaving] = useState(false)
  const [idManual, setIdManual] = useState(false)
  const { toast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // Auto-slug from name
  useEffect(() => {
    if (!idManual && name) {
      setAgentId(
        name
          .toLowerCase()
          .replaceAll(/\s+/g, '-')
          .replaceAll(/[^a-z0-9-]/g, '')
      )
    }
  }, [name, idManual])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !agentId.trim()) return
    if (source === 'claude_code' && !projectPath.trim()) return
    setSaving(true)
    try {
      await createAgent({
        id: agentId,
        name,
        icon,
        color,
        default_room_id: source === 'claude_code' ? HEADQUARTERS : roomId,
        bio: bio || undefined,
        source,
        project_path: source === 'claude_code' ? projectPath : undefined,
        permission_mode: source === 'claude_code' ? permissionMode : undefined,
      })
      toast({ title: 'Agent created', description: `${icon} ${name} added to CrewHub` })
      onCreated()
      dialogRef.current?.close()
      onClose()
    } catch (err: unknown) {
      toast({
        title: 'Failed to create agent',
        description: String(err instanceof Error ? err.message : err),
        variant: DESTRUCTIVE,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      style={{
        border: '1px solid var(--zen-border, hsl(var(--border)))',
        borderRadius: '12px',
        background: HSL_BACKGROUND,
        color: HSL_FOREGROUND,
        padding: '0',
        maxWidth: '440px',
        width: 'calc(100vw - 32px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '1.1em', fontWeight: 600 }}>
            ➕ Add New Agent
          </h2>

          {/* Icon + Color row */}
          <div
            style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-end' }}
          >
            <div>
              <label
                htmlFor="agent-icon"
                style={{
                  display: 'block',
                  fontSize: '0.75em',
                  fontWeight: 500,
                  marginBottom: '6px',
                  opacity: 0.7,
                }}
              >
                Icon
              </label>
              <Input
                id="agent-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-16 text-center text-xl"
                maxLength={4}
                required
              />
            </div>
            <div>
              <label
                htmlFor="agent-color"
                style={{
                  display: 'block',
                  fontSize: '0.75em',
                  fontWeight: 500,
                  marginBottom: '6px',
                  opacity: 0.7,
                }}
              >
                Color
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  id="agent-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '6px',
                    border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
                    cursor: 'pointer',
                    background: 'transparent',
                  }}
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 text-xs font-mono w-28"
                  placeholder="#hex"
                />
                <ColorSphere color={color} size={32} />
              </div>
            </div>
          </div>

          {/* Source selector */}
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="agent-source"
              style={{
                display: 'block',
                fontSize: '0.75em',
                fontWeight: 500,
                marginBottom: '6px',
                opacity: 0.7,
              }}
            >
              Source
            </label>
            <select
              id="agent-source"
              value={source}
              onChange={(e) => setSource(e.target.value as 'openclaw' | 'claude_code')}
              style={{
                width: '100%',
                height: '36px',
                borderRadius: '6px',
                border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
                background: HSL_BACKGROUND,
                color: HSL_FOREGROUND,
                padding: '0 8px',
                fontSize: '0.875rem',
              }}
            >
              <option value="openclaw">OpenClaw</option>
              <option value="claude_code">Claude Code</option>
            </select>
          </div>

          {/* Name */}
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="agent-name"
              style={{
                display: 'block',
                fontSize: '0.75em',
                fontWeight: 500,
                marginBottom: '6px',
                opacity: 0.7,
              }}
            >
              Name *
            </label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Agent"
              required
            />
          </div>

          {/* Agent ID / slug */}
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="agent-id"
              style={{
                display: 'block',
                fontSize: '0.75em',
                fontWeight: 500,
                marginBottom: '6px',
                opacity: 0.7,
              }}
            >
              Agent ID (slug) *
            </label>
            <Input
              id="agent-id"
              value={agentId}
              onChange={(e) => {
                setAgentId(e.target.value)
                setIdManual(true)
              }}
              placeholder="my-agent"
              className="font-mono text-sm"
              required
            />
          </div>

          {/* Room (OpenClaw only) */}
          {source === 'openclaw' && (
            <div style={{ marginBottom: '12px' }}>
              <label
                htmlFor="agent-room"
                style={{
                  display: 'block',
                  fontSize: '0.75em',
                  fontWeight: 500,
                  marginBottom: '6px',
                  opacity: 0.7,
                }}
              >
                Default Room
              </label>
              <select
                id="agent-room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '6px',
                  border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
                  background: HSL_BACKGROUND,
                  color: HSL_FOREGROUND,
                  padding: '0 8px',
                  fontSize: '0.875rem',
                }}
              >
                <option value={HEADQUARTERS}>🏠 Headquarters</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.icon ? `${r.icon} ` : ''}
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Claude Code fields */}
          {source === 'claude_code' && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label
                  htmlFor="agent-project-path"
                  style={{
                    display: 'block',
                    fontSize: '0.75em',
                    fontWeight: 500,
                    marginBottom: '6px',
                    opacity: 0.7,
                  }}
                >
                  Project Path *
                </label>
                <Input
                  id="agent-project-path"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="/home/user/my-project"
                  className="font-mono text-sm"
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label
                  htmlFor="agent-permission-mode"
                  style={{
                    display: 'block',
                    fontSize: '0.75em',
                    fontWeight: 500,
                    marginBottom: '6px',
                    opacity: 0.7,
                  }}
                >
                  Permission Mode
                </label>
                <select
                  id="agent-permission-mode"
                  value={permissionMode}
                  onChange={(e) => setPermissionMode(e.target.value)}
                  style={{
                    width: '100%',
                    height: '36px',
                    borderRadius: '6px',
                    border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
                    background: HSL_BACKGROUND,
                    color: HSL_FOREGROUND,
                    padding: '0 8px',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="default">Default</option>
                  <option value="plan">Plan mode</option>
                  <option value="auto-edit">Auto-edit</option>
                  <option value="full-auto">Full-auto</option>
                </select>
              </div>
            </>
          )}

          {/* Bio */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="agent-bio"
              style={{
                display: 'block',
                fontSize: '0.75em',
                fontWeight: 500,
                marginBottom: '6px',
                opacity: 0.7,
              }}
            >
              Bio (optional)
            </label>
            <textarea
              id="agent-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{
                width: '100%',
                height: '64px',
                borderRadius: '6px',
                border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
                background: HSL_BACKGROUND,
                color: HSL_FOREGROUND,
                padding: '8px 12px',
                fontSize: '0.875rem',
                resize: 'none',
                fontFamily: 'inherit',
              }}
              placeholder="Short description of this agent…"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                dialogRef.current?.close()
                onClose()
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !name.trim() || !agentId.trim()}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className={CLS_H_4_W_4_MR_1} />
              )}
              Create Agent
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  )
}

// ── Agent Card ───────────────────────────────────────────────────────

function AgentCard({
  agent,
  rooms,
  onSave,
  onDelete,
}: Readonly<{
  readonly agent: Agent
  readonly rooms: Room[]
  readonly onSave: (id: string, updates: Partial<Agent>) => Promise<void>
  readonly onDelete: (agent: Agent) => void
}>) {
  const [editing, setEditing] = useState(false)
  const [color, setColor] = useState(agent.color || '#6b7280')
  const [bio, setBio] = useState(agent.bio || '')
  const [roomId, setRoomId] = useState(agent.default_room_id || HEADQUARTERS)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  // Inline icon editing
  const [editingIcon, setEditingIcon] = useState(false)
  const [iconValue, setIconValue] = useState(agent.icon || '🤖')
  const [savingIcon, setSavingIcon] = useState(false)
  const { toast } = useToast()

  // Reset local state when agent prop changes
  useEffect(() => {
    setColor(agent.color || '#6b7280')
    setBio(agent.bio || '')
    setRoomId(agent.default_room_id || HEADQUARTERS)
    setIconValue(agent.icon || '🤖')
  }, [agent.color, agent.bio, agent.default_room_id, agent.icon])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(agent.id, { color, bio: bio || null, default_room_id: roomId })
      setEditing(false)
      toast({
        title: 'Agent Updated',
        description: `${agent.icon} ${agent.display_name || agent.name} saved`,
      })
    } catch {
      toast({ title: 'Failed to save', variant: DESTRUCTIVE })
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
      toast({ title: 'Failed to generate bio', variant: DESTRUCTIVE })
    } finally {
      setGenerating(false)
    }
  }

  const handleCancel = () => {
    setColor(agent.color || '#6b7280')
    setBio(agent.bio || '')
    setRoomId(agent.default_room_id || HEADQUARTERS)
    setEditing(false)
  }

  const handleSaveIcon = async () => {
    if (!iconValue.trim()) return
    setSavingIcon(true)
    try {
      await onSave(agent.id, { icon: iconValue.trim() })
      setEditingIcon(false)
      toast({ title: 'Icon updated' })
    } catch {
      toast({ title: 'Failed to save icon', variant: DESTRUCTIVE })
    } finally {
      setSavingIcon(false)
    }
  }

  const lastSeen = agent.updated_at
    ? new Date(agent.updated_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown'

  const roomName =
    rooms.find((r) => r.id === agent.default_room_id)?.name ?? agent.default_room_id ?? '—'

  return (
    <div
      className="rounded-xl border bg-card/80 p-5 shadow-sm hover:shadow-md transition-shadow min-h-[200px]"
      style={
        agent.is_stale ? { opacity: 0.65, borderColor: 'hsl(var(--muted-foreground) / 0.3)' } : {}
      }
    >
      <div className="flex items-start gap-4">
        {/* Color sphere with icon */}
        <div className="relative shrink-0">
          <ColorSphere color={editing ? color : agent.color || '#6b7280'} size={48} />
          {/* Icon overlay — clickable to edit inline */}
          {editingIcon ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'hsl(var(--background) / 0.9)',
                borderRadius: '50%',
                gap: '2px',
              }}
            >
              <input
                type="text"
                value={iconValue}
                onChange={(e) => setIconValue(e.target.value)}
                maxLength={4}
                autoFocus
                style={{
                  width: '32px',
                  textAlign: 'center',
                  fontSize: '1.2em',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: HSL_FOREGROUND,
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveIcon()
                  if (e.key === 'Escape') {
                    setEditingIcon(false)
                    setIconValue(agent.icon || '🤖')
                  }
                }}
              />
            </div>
          ) : null}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Clickable icon badge */}
            {editingIcon ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSaveIcon}
                  disabled={savingIcon}
                  className="p-1 hover:bg-muted rounded text-green-500"
                  title="Save icon"
                >
                  {savingIcon ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setEditingIcon(false)
                    setIconValue(agent.icon || '🤖')
                  }}
                  className="p-1 hover:bg-muted rounded text-muted-foreground"
                  title="Cancel"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                title="Click to edit icon"
                onClick={() => setEditingIcon(true)}
                className="text-lg hover:scale-110 transition-transform"
              >
                {agent.icon || '🤖'}
              </button>
            )}
            <h3 className="font-semibold text-sm truncate">{agent.display_name || agent.name}</h3>
            {agent.source === 'claude_code' && (
              <Badge variant="secondary" className="text-[10px]">
                Claude Code
              </Badge>
            )}
            {agent.is_pinned && (
              <Badge variant="secondary" className="text-[10px]">
                Pinned
              </Badge>
            )}
            {agent.is_stale && (
              <Badge
                variant="outline"
                className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400 gap-1"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {agent.source === 'claude_code' ? 'Project not found' : 'Not in OpenClaw'}
              </Badge>
            )}
          </div>

          {!editing && (
            <>
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {agent.bio || <span className="italic">No bio set</span>}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2 flex-wrap">
                <span className="font-mono">{agent.id}</span>
                <span>•</span>
                <span>{lastSeen}</span>
                {agent.default_model && (
                  <>
                    <span>•</span>
                    <span>{agent.default_model}</span>
                  </>
                )}
                <span>•</span>
                <span>🏠 {roomName}</span>
              </div>
            </>
          )}
        </div>

        {/* Action buttons */}
        {!editing && (
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              title="Edit agent"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(agent)}
              className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
              title="Delete agent"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {/* Color picker */}
          <div className="space-y-2">
            <Label className={CLS_TEXT_XS_FONT_MEDIUM}>Bot Color</Label>
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

          {/* Room dropdown (OpenClaw only) */}
          {agent.source !== 'claude_code' && (
            <div className="space-y-2">
              <Label className={CLS_TEXT_XS_FONT_MEDIUM}>Default Room</Label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '6px',
                  border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
                  background: HSL_BACKGROUND,
                  color: HSL_FOREGROUND,
                  padding: '0 8px',
                  fontSize: '0.875rem',
                }}
              >
                <option value={HEADQUARTERS}>🏠 Headquarters</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.icon ? `${r.icon} ` : ''}
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Project path (Claude Code only) */}
          {agent.source === 'claude_code' && (
            <div className="space-y-2">
              <Label className={CLS_TEXT_XS_FONT_MEDIUM}>Project Path</Label>
              <Input
                value={agent.project_path || ''}
                disabled
                className="font-mono text-sm opacity-70"
              />
            </div>
          )}

          {/* Bio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className={CLS_TEXT_XS_FONT_MEDIUM}>Bio</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateBio}
                disabled={generating}
                className="h-7 text-xs gap-1"
              >
                {generating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
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
              <X className={CLS_H_4_W_4_MR_1} /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className={CLS_H_4_W_4_MR_1} />
              )}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Delete Confirmation Dialog ────────────────────────────────────────

function DeleteConfirmDialog({
  agent,
  onConfirm,
  onCancel,
}: Readonly<{
  readonly agent: Agent
  readonly onConfirm: () => void
  readonly onCancel: () => void
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      style={{
        border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
        borderRadius: '12px',
        background: HSL_BACKGROUND,
        color: HSL_FOREGROUND,
        padding: '24px',
        maxWidth: '360px',
        width: 'calc(100vw - 32px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Trash2
            style={{ color: 'hsl(var(--destructive))', width: 20, height: 20, flexShrink: 0 }}
          />
          <h3 style={{ margin: 0, fontSize: '1em', fontWeight: 600 }}>
            Delete {agent.icon || '🤖'} {agent.display_name || agent.name}?
          </h3>
        </div>

        {!agent.is_stale && (
          <div
            style={{
              background: 'hsl(var(--muted))',
              border: '1px solid hsl(38 92% 50% / 0.4)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle
              style={{
                color: 'hsl(38 92% 50%)',
                width: 16,
                height: 16,
                flexShrink: 0,
                marginTop: 1,
              }}
            />
            <p style={{ margin: 0, fontSize: '0.8em', lineHeight: 1.5, opacity: 0.85 }}>
              This agent is still active in {agent.source === 'claude_code' ? 'Claude Code' : 'OpenClaw'}. Only removing from CrewHub — the agent will
              still run.
            </p>
          </div>
        )}

        <p style={{ margin: 0, fontSize: '0.85em', opacity: 0.7 }}>
          Agent <code style={{ fontFamily: 'monospace' }}>{agent.id}</code> will be permanently
          removed from CrewHub. This cannot be undone.
        </p>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              dialogRef.current?.close()
              onCancel()
            }}
          >
            Cancel
          </Button>
          <Button
            variant={DESTRUCTIVE}
            size="sm"
            onClick={() => {
              dialogRef.current?.close()
              onConfirm()
            }}
          >
            <Trash2 className={CLS_H_4_W_4_MR_1} />
            Delete
          </Button>
        </div>
      </div>
    </dialog>
  )
}

// ── Main Tab Component ───────────────────────────────────────────────

export function AgentsSettingsTab() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null)
  const { toast } = useToast()

  const loadAgents = useCallback(async () => {
    try {
      const [agentData, roomData] = await Promise.all([fetchAgents(), fetchRooms()])
      setAgents(agentData)
      setRooms(roomData)
    } catch {
      toast({ title: 'Failed to load agents', variant: DESTRUCTIVE })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  const handleSave = async (agentId: string, updates: Partial<Agent>) => {
    await updateAgent(agentId, updates)
    window.dispatchEvent(new CustomEvent('agents-updated'))
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, ...updates } : a)))
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteAgent(deleteTarget.id)
      setAgents((prev) => prev.filter((a) => a.id !== deleteTarget.id))
      window.dispatchEvent(new CustomEvent('agents-updated'))
      toast({
        title: 'Agent deleted',
        description: `${deleteTarget.icon || '🤖'} ${deleteTarget.display_name || deleteTarget.name} removed`,
      })
    } catch {
      toast({ title: 'Failed to delete agent', variant: DESTRUCTIVE })
    } finally {
      setDeleteTarget(null)
    }
  }

  const staleCount = agents.filter((a) => a.is_stale).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading agents…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header row with title + Add button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Manage your crew's appearance and personality. Color changes reflect in the 3D world
            after save.
          </p>
          {staleCount > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {staleCount} agent{staleCount > 1 ? 's' : ''} not found in their source
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1 shrink-0">
          <Plus className="h-4 w-4" />
          Add Agent
        </Button>
      </div>

      {/* How to create agents info box */}
      <div
        style={{
          background: 'var(--zen-bg-elevated, hsl(var(--muted)))',
          border: '1px solid var(--zen-border, hsl(var(--border)))',
          borderRadius: '6px',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95em' }}>💡 Creating Agents</h4>
        <p style={{ margin: '0 0 12px 0', fontSize: '0.9em', lineHeight: '1.5', opacity: 0.8 }}>
          You can create OpenClaw agents by talking to your existing agent, or add Claude Code agents
          that run directly via the Claude CLI.
        </p>
        <details>
          <summary
            style={{
              cursor: 'pointer',
              fontSize: '0.85em',
              color: 'var(--zen-accent, hsl(var(--primary)))',
            }}
          >
            Advanced: CLI Options
          </summary>
          <div style={{ marginTop: '8px', fontSize: '0.85em', fontFamily: 'monospace' }}>
            <p style={{ margin: '0 0 4px 0' }}>Using OpenClaw CLI:</p>
            <code
              style={{
                display: 'block',
                background: 'var(--zen-bg, hsl(var(--background)))',
                padding: '8px',
                borderRadius: '4px',
                marginTop: '4px',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
              }}
            >
              {`# Add a new agent\nopenclaw agents add\n\n# List all agents\nopenclaw agents list\n\n# Update identity\nopenclaw agents set-identity`}
            </code>
          </div>
        </details>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            rooms={rooms}
            onSave={handleSave}
            onDelete={setDeleteTarget}
          />
        ))}
      </div>
      {agents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No agents registered yet. They'll appear here once discovered from the Gateway.
        </div>
      )}

      {/* Add Agent Modal */}
      {showAddModal && (
        <AddAgentModal
          rooms={rooms}
          onClose={() => setShowAddModal(false)}
          onCreated={loadAgents}
        />
      )}

      {/* Delete Confirm Dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          agent={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
