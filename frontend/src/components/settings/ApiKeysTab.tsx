import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Section } from './shared'
import {
  apiKeyApi,
  ADMIN_KEY_STORAGE_KEY,
  type ApiKeyItem,
  type CreateApiKeyResponse,
} from '@/lib/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCOPE_COLORS: Record<string, string> = {
  read: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  self: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  manage: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  read: 'Read-only access to sessions, rooms, and status',
  self: 'Agent self-service: identify, set display name, assign room',
  manage: 'Manage agents, create identities, moderate rooms',
  admin: 'Full access: create/revoke keys, manage all resources',
}

function formatTs(ms: number | null | undefined): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatRelative(ms: number | null | undefined): string {
  if (!ms) return 'never'
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function daysUntil(ms: number | null | undefined): number | null {
  if (!ms) return null
  const diff = ms - Date.now()
  return Math.ceil(diff / 86_400_000)
}

function ScopeBadge({ scope }: Readonly<{ scope: string }>) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${SCOPE_COLORS[scope] ?? 'bg-muted text-muted-foreground'}`}
      title={SCOPE_DESCRIPTIONS[scope]}
    >
      {scope}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ApiKeysTab() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '')
  const [adminKeyInput, setAdminKeyInput] = useState(adminKey)
  const [adminKeyValid, setAdminKeyValid] = useState<boolean | null>(null)
  const [validating, setValidating] = useState(false)
  const [showAdminKey, setShowAdminKey] = useState(false)

  const isConfigured = Boolean(adminKey && adminKeyValid !== false)

  const handleSaveAdminKey = async () => {
    const trimmed = adminKeyInput.trim()
    if (!trimmed) {
      localStorage.removeItem(ADMIN_KEY_STORAGE_KEY)
      setAdminKey('')
      setAdminKeyValid(null)
      return
    }
    setValidating(true)
    try {
      await apiKeyApi.getSelf(trimmed)
      localStorage.setItem(ADMIN_KEY_STORAGE_KEY, trimmed)
      setAdminKey(trimmed)
      setAdminKeyValid(true)
    } catch {
      setAdminKeyValid(false)
    } finally {
      setValidating(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* ── Admin Key Config ── */}
      <Section title="🔑 Admin Key">
        <p className="text-sm text-muted-foreground">
          Enter your admin API key to manage keys. The key is stored in your browser's local storage
          and never leaves your device. Find it in{' '}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">~/.crewhub/api-keys.json</code>.
        </p>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Input
              type={showAdminKey ? 'text' : 'password'}
              value={adminKeyInput}
              onChange={(e) => {
                setAdminKeyInput(e.target.value)
                setAdminKeyValid(null)
              }}
              placeholder="ch_live_…"
              className="font-mono text-sm pr-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAdminKey()
              }}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowAdminKey((v) => !v)}
            >
              {showAdminKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            onClick={handleSaveAdminKey}
            disabled={validating}
            size="sm"
            className="h-10 px-4"
          >
            {validating ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
        {adminKeyValid === true && (
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <Check className="h-3.5 w-3.5" /> Key validated — admin access granted
          </div>
        )}
        {adminKeyValid === false && (
          <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Invalid key or insufficient permissions
          </div>
        )}
      </Section>

      {/* ── Keys Management ── */}
      {isConfigured && <KeysManager adminKey={adminKey} />}
    </div>
  )
}

// ─── Keys Manager ─────────────────────────────────────────────────────────────

function KeysManager({ adminKey }: Readonly<{ adminKey: string }>) {
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRevoked, setShowRevoked] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyResult, setNewKeyResult] = useState<CreateApiKeyResponse | null>(null)
  const createDialogRef = useRef<HTMLDialogElement>(null)
  const revealDialogRef = useRef<HTMLDialogElement>(null)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiKeyApi.list(showRevoked)
      setKeys(data.keys)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys')
    } finally {
      setLoading(false)
    }
  }, [showRevoked])

  useEffect(() => {
    loadKeys()
  }, [loadKeys, adminKey])

  // Sync dialog open/close state
  useEffect(() => {
    const d = createDialogRef.current
    if (!d) return
    if (showCreateModal) {
      if (!d.open) d.showModal()
    } else if (d.open) d.close()
  }, [showCreateModal])

  useEffect(() => {
    const d = revealDialogRef.current
    if (!d) return
    if (newKeyResult) {
      if (!d.open) d.showModal()
    } else if (d.open) d.close()
  }, [newKeyResult])

  const handleKeyCreated = (result: CreateApiKeyResponse) => {
    setShowCreateModal(false)
    setNewKeyResult(result)
    loadKeys()
  }

  const handleRevoke = async (keyId: string, keyName: string) => {
    if (!confirm(`Revoke key "${keyName}"? This cannot be undone.`)) return
    try {
      await apiKeyApi.revoke(keyId)
      loadKeys()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke key')
    }
  }

  return (
    <>
      <Section title="🗝️ API Keys">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" />
              New Key
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadKeys}
              disabled={loading}
              className="h-8 w-8 p-0"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showRevoked}
              onChange={(e) => setShowRevoked(e.target.checked)}
              className="rounded"
            />{' '}
            Show revoked
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {(() => {
          if (loading && keys.length === 0) {
            return (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                Loading keys…
              </div>
            )
          }

          if (keys.length === 0) {
            return (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No API keys yet
              </div>
            )
          }

          return (
            <div className="space-y-2">
              {keys.map((k) => (
                <KeyRow key={k.id} item={k} onRevoke={() => handleRevoke(k.id, k.name)} />
              ))}
            </div>
          )
        })()}
      </Section>

      {/* ── Create Key Modal ── */}
      <dialog // NOSONAR: <dialog> is a native interactive HTML element
        ref={createDialogRef}
        onClose={() => setShowCreateModal(false)}
        onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0 z-[80]"
      >
        <CreateKeyModal onClose={() => setShowCreateModal(false)} onCreated={handleKeyCreated} />
      </dialog>

      {/* ── New Key Reveal Modal ── */}
      <dialog // NOSONAR: <dialog> is a native interactive HTML element
        ref={revealDialogRef}
        onClose={() => setNewKeyResult(null)}
        onClick={(e) => e.target === e.currentTarget && setNewKeyResult(null)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0 z-[80]"
      >
        {newKeyResult && (
          <KeyRevealModal result={newKeyResult} onClose={() => setNewKeyResult(null)} />
        )}
      </dialog>
    </>
  )
}

// ─── Key Row ──────────────────────────────────────────────────────────────────

function KeyRow({ item, onRevoke }: Readonly<{ item: ApiKeyItem; onRevoke: () => void }>) {
  const [expanded, setExpanded] = useState(false)
  const days = daysUntil(item.expires_at)
  const isExpiringSoon = days !== null && days > 0 && days <= 14
  const isExpired = item.is_expired || (days !== null && days <= 0)

  return (
    <div
      className={`rounded-lg border bg-card/50 overflow-hidden transition-colors ${
        item.revoked || isExpired ? 'opacity-60' : ''
      }`}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        <Key className="h-4 w-4 text-muted-foreground shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{item.name}</span>
            {item.revoked && (
              <Badge variant="destructive" className="text-[10px] h-4">
                Revoked
              </Badge>
            )}
            {isExpired && !item.revoked && (
              <Badge variant="destructive" className="text-[10px] h-4">
                Expired
              </Badge>
            )}
            {isExpiringSoon && !isExpired && !item.revoked && (
              <Badge variant="outline" className="text-[10px] h-4 border-amber-500 text-amber-600">
                Expires in {days}d
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <code className="text-[11px] text-muted-foreground font-mono">{item.key_prefix}</code>
            <div className="flex gap-1">
              {item.scopes.map((s) => (
                <ScopeBadge key={s} scope={s} />
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setExpanded((v) => !v)}
            title="Details"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
          {!item.revoked && !isExpired && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={onRevoke}
              title="Revoke"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-4 py-3 bg-muted/30 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground font-medium">Created</p>
            <p>{formatTs(item.created_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium">Expires</p>
            <p>{item.expires_at ? `${formatTs(item.expires_at)} (${days}d)` : 'Never'}</p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium">Last used</p>
            <p>{item.last_used_at ? formatTs(item.last_used_at) : 'Never'}</p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium">Relative</p>
            <p>{formatRelative(item.last_used_at)}</p>
          </div>
          {item.agent_id && (
            <div className="col-span-2">
              <p className="text-muted-foreground font-medium">Bound agent</p>
              <p className="font-mono">{item.agent_id}</p>
            </div>
          )}
          <div className="col-span-2">
            <p className="text-muted-foreground font-medium">Key ID</p>
            <p className="font-mono">{item.id}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Create Key Modal ─────────────────────────────────────────────────────────

const ALL_SCOPES = ['read', 'self', 'manage', 'admin'] as const

function CreateKeyModal({
  onClose,
  onCreated,
}: {
  readonly onClose: () => void
  readonly onCreated: (r: CreateApiKeyResponse) => void
}) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<Set<string>>(new Set(['read', 'self']))
  const [expiresInDays, setExpiresInDays] = useState<string>('90')
  const [env, setEnv] = useState<'live' | 'test'>('live')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleScope = (scope: string) => {
    setScopes((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) {
        // Must keep at least one scope
        if (next.size === 1) return prev
        next.delete(scope)
      } else {
        next.add(scope)
      }
      return next
    })
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const days = Number.parseInt(expiresInDays)
      const result = await apiKeyApi.create({
        name: name.trim(),
        scopes: Array.from(scopes),
        expires_in_days: Number.isNaN(days) || days <= 0 ? null : days,
        env,
      })
      onCreated(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
      className="bg-background border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b">
        <div className="p-2 rounded-lg bg-primary/10">
          <Plus className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Create API Key</h2>
          <p className="text-xs text-muted-foreground">The raw key is shown once after creation</p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="key-name" className="text-sm font-medium">
            Key name
          </Label>
          <Input
            id="key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Agent key for dev"
            className="text-sm"
            autoFocus
          />
        </div>

        {/* Scopes */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Scopes</Label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_SCOPES.map((scope) => (
              <label
                key={scope}
                aria-label={scope}
                className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  scopes.has(scope)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={scopes.has(scope)}
                  onChange={() => toggleScope(scope)}
                  className="mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <ScopeBadge scope={scope} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {SCOPE_DESCRIPTIONS[scope]}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Expiration */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="key-expiry" className="text-sm font-medium flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Expires in (days)
            </Label>
            <Input
              id="key-expiry"
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="90"
              min={1}
              max={3650}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Leave blank or 0 for no expiry</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Environment
            </Label>
            <div className="flex rounded-lg border overflow-hidden">
              {(['live', 'test'] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEnv(e)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    env === e ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Prefix: ch_{env}_…</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={creating || !name.trim()} className="gap-1.5">
          {creating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" /> Creating…
            </>
          ) : (
            <>
              <Key className="h-4 w-4" /> Create Key
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Key Reveal Modal (one-time) ──────────────────────────────────────────────

function KeyRevealModal({
  result,
  onClose,
}: {
  readonly result: CreateApiKeyResponse
  readonly onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const copyKey = async () => {
    await navigator.clipboard.writeText(result.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
      className="bg-background border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b bg-amber-50/80 dark:bg-amber-900/20">
        <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
        <div>
          <h2 className="text-base font-semibold text-amber-700 dark:text-amber-300">
            Save your API key now!
          </h2>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This key will not be shown again. Copy and store it securely.
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Key details */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{result.name}</span>
            <div className="flex gap-1">
              {result.scopes.map((s) => (
                <ScopeBadge key={s} scope={s} />
              ))}
            </div>
          </div>
          {result.expires_at && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Expires: {formatTs(result.expires_at)} ({daysUntil(result.expires_at)}d)
            </p>
          )}
        </div>

        {/* Key value */}
        <div className="space-y-2">
          <div className="relative">
            <code className="block w-full font-mono text-sm bg-muted rounded-lg px-4 py-3 pr-12 break-all select-all">
              {result.key}
            </code>
            <button
              onClick={copyKey}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-background transition-colors"
              title="Copy"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
          <Button variant="outline" className="w-full gap-2 h-9" onClick={copyKey}>
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" /> Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy to clipboard
              </>
            )}
          </Button>
        </div>

        {/* Confirmation checkbox */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-muted-foreground">
            I have copied and saved this key in a secure location
          </span>
        </label>
      </div>

      <div className="flex justify-end px-6 py-4 border-t bg-muted/30">
        <Button onClick={onClose} disabled={!confirmed} variant={confirmed ? 'default' : 'outline'}>
          {confirmed ? 'Done' : "Confirm you've saved the key first"}
        </Button>
      </div>
    </div>
  )
}
