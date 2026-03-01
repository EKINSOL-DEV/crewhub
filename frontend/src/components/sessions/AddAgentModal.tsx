/**
 * AddAgentModal — Shared modal for creating new agents.
 * Used from Settings > Agents and from the Room info panel.
 */
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { API_BASE } from '@/lib/api'
import { Loader2, Plus } from 'lucide-react'

const BORDER_1PX_SOLID_HSL_VAR_BORDER = '1px solid hsl(var(--border))'
const CLS_H_4_W_4_MR_1 = 'h-4 w-4 mr-1'
const DESTRUCTIVE = 'destructive'
const HEADQUARTERS = 'headquarters'
const HSL_BACKGROUND = 'hsl(var(--background))'
const HSL_FOREGROUND = 'hsl(var(--foreground))'

// ── Types ────────────────────────────────────────────────────────────

interface Room {
  id: string
  name: string
  icon: string | null
}

// ── API helpers ──────────────────────────────────────────────────────

export async function fetchRooms(): Promise<Room[]> {
  const res = await fetch(`${API_BASE}/rooms`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.rooms ?? data) as Room[]
}

export async function fetchConnectionTypes(): Promise<Set<string>> {
  try {
    const res = await fetch(`${API_BASE}/connections`)
    if (!res.ok) return new Set()
    const data = await res.json()
    const types = new Set<string>()
    for (const conn of data.connections ?? []) {
      if (conn.enabled) types.add(conn.type)
    }
    return types
  } catch {
    return new Set()
  }
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

// ── Color preview sphere ─────────────────────────────────────────────

export function ColorSphere({ color, size = 48 }: Readonly<{ color: string; readonly size?: number }>) {
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

// ── Modal Component ──────────────────────────────────────────────────

export interface AddAgentModalProps {
  readonly rooms: Room[]
  readonly availableConnectionTypes: Set<string>
  readonly defaultRoomId?: string
  readonly onClose: () => void
  readonly onCreated: () => void
}

export function AddAgentModal({
  rooms,
  availableConnectionTypes,
  defaultRoomId,
  onClose,
  onCreated,
}: Readonly<AddAgentModalProps>) {
  const hasOpenClaw = availableConnectionTypes.has('openclaw')
  const hasClaudeCode = availableConnectionTypes.has('claude_code')
  const defaultSource = hasOpenClaw ? 'openclaw' : hasClaudeCode ? 'claude_code' : 'openclaw'
  const [source, setSource] = useState<'openclaw' | 'claude_code'>(defaultSource)
  const [name, setName] = useState('')
  const [agentId, setAgentId] = useState('')
  const [icon, setIcon] = useState('\u{1F916}')
  const [color, setColor] = useState('#6b7280')
  const [roomId, setRoomId] = useState(defaultRoomId || HEADQUARTERS)
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
        default_room_id: roomId,
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
            Add New Agent
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
              <option value="openclaw" disabled={!hasOpenClaw}>
                OpenClaw{!hasOpenClaw ? ' (no connection)' : ''}
              </option>
              <option value="claude_code" disabled={!hasClaudeCode}>
                Claude Code{!hasClaudeCode ? ' (no connection)' : ''}
              </option>
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

          {/* Default Room — shown for all sources */}
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
              <option value={HEADQUARTERS}>Headquarters</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.icon ? `${r.icon} ` : ''}
                  {r.name}
                </option>
              ))}
            </select>
          </div>

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
              placeholder="Short description of this agent..."
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
