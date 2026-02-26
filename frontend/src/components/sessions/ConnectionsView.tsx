import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Cable,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  Zap,
  Terminal,
  Bot,
} from 'lucide-react'
import { sseManager } from '@/lib/sseManager'

const CLS_FLEX_ITEMS_CENTER_GAP_1 = 'flex items-center gap-1'
const CLS_FLEX_ITEMS_CENTER_GAP_2 = 'flex items-center gap-2'
const CLS_FLEX_ITEMS_CENTER_JUSTIFY_BETWEEN = 'flex items-center justify-between'
const UNKNOWN_ERROR = 'Unknown error'

// ============================================================================
// Types
// ============================================================================

type ConnectionType = 'openclaw' | 'claude_code' | 'codex'

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'not_loaded'

interface Connection {
  id: string
  name: string
  type: ConnectionType
  config: Record<string, string>
  enabled: boolean
  status: ConnectionStatus
  error?: string | null
  created_at: number
  updated_at: number
}

interface ConnectionFormData {
  name: string
  type: ConnectionType
  config: Record<string, string>
  enabled: boolean
}

// ============================================================================
// Config Fields per Type
// ============================================================================

const CONNECTION_TYPE_CONFIG: Record<
  ConnectionType,
  {
    label: string
    icon: React.ReactNode
    description: string
    fields: { key: string; label: string; placeholder: string; type: string }[]
  }
> = {
  openclaw: {
    label: 'OpenClaw',
    icon: <Zap className="h-4 w-4" />,
    description: 'Connect to an OpenClaw Gateway instance',
    fields: [
      {
        key: 'gateway_url',
        label: 'Gateway URL',
        placeholder: 'http://localhost:3000',
        type: 'url',
      },
      {
        key: 'token',
        label: 'API Token',
        placeholder: 'Enter your API token',
        type: 'password',
      },
    ],
  },
  claude_code: {
    label: 'Claude Code',
    icon: <Terminal className="h-4 w-4" />,
    description: 'Connect to Claude Code CLI',
    fields: [
      {
        key: 'cli_path',
        label: 'CLI Path',
        placeholder: '/usr/local/bin/claude',
        type: 'text',
      },
      {
        key: 'working_directory',
        label: 'Working Directory',
        placeholder: '~/projects',
        type: 'text',
      },
    ],
  },
  codex: {
    label: 'Codex',
    icon: <Bot className="h-4 w-4" />,
    description: 'Connect to OpenAI Codex CLI',
    fields: [
      {
        key: 'cli_path',
        label: 'CLI Path',
        placeholder: '/usr/local/bin/codex',
        type: 'text',
      },
      {
        key: 'api_key',
        label: 'API Key',
        placeholder: 'sk-...',
        type: 'password',
      },
    ],
  },
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusIcon(status: ConnectionStatus) {
  switch (status) {
    case 'connected':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'disconnected':
      return <WifiOff className="h-4 w-4 text-muted-foreground" />
    case 'connecting':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'not_loaded':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
  }
}

function getStatusBadge(status: ConnectionStatus) {
  const variants: Record<ConnectionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    connected: 'default',
    disconnected: 'secondary',
    connecting: 'outline',
    error: 'destructive',
    not_loaded: 'secondary',
  }
  const labels: Record<ConnectionStatus, string> = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    error: 'Error',
    not_loaded: 'Not Loaded',
  }
  return <Badge variant={variants[status]}>{labels[status]}</Badge>
}

function getTypeIcon(type: ConnectionType) {
  return CONNECTION_TYPE_CONFIG[type]?.icon || <Cable className="h-4 w-4" />
}

// ============================================================================
// Connection Dialog Component
// ============================================================================

interface ConnectionDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly connection?: Connection | null
  readonly onSave: (data: ConnectionFormData, id?: string) => Promise<void>
}

/** Module-level updater to reduce setState callback nesting depth below 4 levels. */
function makeConnectionStatusUpdater(data: Partial<Connection> & { id: string }) {
  return (prev: Connection[]): Connection[] =>
    prev.map((c) => (c.id === data.id ? { ...c, ...data } : c))
}

function ConnectionDialog({ open, onOpenChange, connection, onSave }: Readonly<ConnectionDialogProps>) {
  const isEdit = !!connection
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<ConnectionFormData>({
    name: '',
    type: 'openclaw',
    config: {},
    enabled: true,
  })
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Sync dialog open state with native dialog
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (connection) {
      setFormData({
        name: connection.name,
        type: connection.type,
        config: connection.config,
        enabled: connection.enabled,
      })
    } else {
      setFormData({
        name: '',
        type: 'openclaw',
        config: {},
        enabled: true,
      })
    }
  }, [connection, open])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(formData, connection?.id)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const handleTypeChange = (type: ConnectionType) => {
    setFormData((prev) => ({
      ...prev,
      type,
      config: {}, // Reset config when type changes
    }))
  }

  const handleConfigChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }))
  }

  const typeConfig = CONNECTION_TYPE_CONFIG[formData.type]

  return (
    <dialog // NOSONAR: <dialog> is a native interactive HTML element
      ref={dialogRef}
      onClose={() => onOpenChange(false)}
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
      className="backdrop:bg-black/50 backdrop:backdrop-blur-sm rounded-lg border shadow-lg w-full max-w-[500px] p-0 z-[85]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"  // NOSONAR: decorative/overlay element; presentation role is appropriate here
        className="bg-background rounded-lg overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Connection' : 'Add Connection'}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isEdit ? 'Update connection configuration' : 'Configure a new agent connection'}
          </p>
        </div>

        <div className="px-6 pb-4 space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My Connection"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Type Selector (only for new connections) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>Connection Type</Label>
              <Select value={formData.type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONNECTION_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className={CLS_FLEX_ITEMS_CENTER_GAP_2}>
                        {config.icon}
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{typeConfig?.description}</p>
            </div>
          )}

          {/* Type-specific Config Fields */}
          {typeConfig?.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type={field.type}
                placeholder={field.placeholder}
                value={formData.config[field.key] || ''}
                onChange={(e) => handleConfigChange(field.key, e.target.value)}
              />
            </div>
          ))}

          {/* Enabled Toggle */}
          <div className={CLS_FLEX_ITEMS_CENTER_JUSTIFY_BETWEEN}>
            <div className="space-y-0.5">
              <Label>Enabled</Label>
              <p className="text-xs text-muted-foreground">Auto-connect on startup</p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !formData.name}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Connection'}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ConnectionsView({ embedded = false }: { embedded?: boolean }) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Fetch connections
  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch('/api/connections')
      if (!response.ok) {
        throw new Error('Failed to fetch connections')
      }
      const data = await response.json()
      setConnections(data.connections || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : UNKNOWN_ERROR)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnections()

    // SSE real-time updates for connection status changes
    const unsub = sseManager.subscribe('connection-status', (event) => {
      try {
        const data = JSON.parse(event.data)
        setConnections(makeConnectionStatusUpdater(data))
      } catch {
        // Fallback: refetch all on parse error
        fetchConnections()
      }
    })

    // Fallback polling at reduced interval (SSE handles real-time)
    const interval = setInterval(fetchConnections, 30000)

    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [fetchConnections])

  // Create or update connection
  const handleSaveConnection = async (data: ConnectionFormData, id?: string) => {
    const url = id ? `/api/connections/${id}` : '/api/connections'
    const method = id ? 'PATCH' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.detail || 'Failed to save connection')
    }

    setError(null)
    await fetchConnections()
  }

  // Delete connection (two-click: first click sets deletingId for confirm, second deletes)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmDeleteId((prev) => (prev === id ? null : prev)), 3000)
      return
    }

    setConfirmDeleteId(null)
    setDeletingId(id)
    try {
      const response = await fetch(`/api/connections/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete connection')
      }
      await fetchConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  // Toggle enabled
  const handleToggleEnabled = async (connection: Connection) => {
    try {
      const response = await fetch(`/api/connections/${connection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !connection.enabled }),
      })
      if (!response.ok) {
        throw new Error('Failed to toggle connection')
      }
      await fetchConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle')
    }
  }

  // Test connection
  const handleTestConnection = async (id: string) => {
    setTestingId(id)
    setError(null)
    try {
      const response = await fetch(`/api/connections/${id}/connect`, {
        method: 'POST',
      })
      const data = await response.json()

      // Refresh to get updated status
      await fetchConnections()

      if (!data.connected) {
        setError(`Connection failed: ${data.error || UNKNOWN_ERROR}`)
      }
    } catch (err) {
      setError(`Test failed: ${err instanceof Error ? err.message : UNKNOWN_ERROR}`)
    } finally {
      setTestingId(null)
    }
  }

  // Open edit dialog
  const handleEdit = (connection: Connection) => {
    setEditingConnection(connection)
    setDialogOpen(true)
  }

  // Open add dialog
  const handleAdd = () => {
    setEditingConnection(null)
    setDialogOpen(true)
  }

  return (
    <div className={embedded ? 'space-y-4' : 'h-full flex flex-col view-gradient'}>
      {/* Header */}
      <div
        className={embedded ? CLS_FLEX_ITEMS_CENTER_JUSTIFY_BETWEEN : 'p-4 border-b border-border'}
      >
        {!embedded && (
          <div className={CLS_FLEX_ITEMS_CENTER_JUSTIFY_BETWEEN}>
            <div className="flex items-center gap-3">
              <Cable className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Connections</h2>
                <p className="text-sm text-muted-foreground">Manage agent connections</p>
              </div>
            </div>
            <div className={CLS_FLEX_ITEMS_CENTER_GAP_2}>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchConnections}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={handleAdd} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Connection
              </Button>
            </div>
          </div>
        )}
        {embedded && (
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchConnections}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Connection
            </Button>
          </div>
        )}
      </div>

      {/* Error banner (dismissible, shown alongside content) */}
      {error && connections.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-6 w-6 p-0">
            ✕
          </Button>
        </div>
      )}

      {/* Content */}
      <div className={embedded ? '' : 'flex-1 overflow-auto'}>
        {loading && connections.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error && connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setError(null)
                fetchConnections()
              }}
            >
              Try Again
            </Button>
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <Cable className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Connections</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Add connections to OpenClaw, Claude Code, or Codex to manage agent sessions from
              multiple sources.
            </p>
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Connection
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="p-4 rounded-lg bg-card border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getStatusIcon(connection.status as ConnectionStatus)}
                    </div>
                    <div className="flex-1">
                      <div className={CLS_FLEX_ITEMS_CENTER_GAP_2}>
                        <h3 className="font-medium text-foreground">{connection.name}</h3>
                        <Badge variant="outline" className="gap-1">
                          {getTypeIcon(connection.type)}
                          {CONNECTION_TYPE_CONFIG[connection.type]?.label}
                        </Badge>
                      </div>
                      {connection.error && (
                        <p className="text-sm text-red-500 mt-1">{connection.error}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {connection.type === 'openclaw' && connection.config.gateway_url && (
                          <span className={CLS_FLEX_ITEMS_CENTER_GAP_1}>
                            <Wifi className="h-3 w-3" />
                            {connection.config.gateway_url}
                          </span>
                        )}
                        {connection.type === 'claude_code' && connection.config.cli_path && (
                          <span className={CLS_FLEX_ITEMS_CENTER_GAP_1}>
                            <Terminal className="h-3 w-3" />
                            {connection.config.cli_path}
                          </span>
                        )}
                        {connection.type === 'codex' && connection.config.cli_path && (
                          <span className={CLS_FLEX_ITEMS_CENTER_GAP_1}>
                            <Bot className="h-3 w-3" />
                            {connection.config.cli_path}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={CLS_FLEX_ITEMS_CENTER_GAP_2}>
                    {getStatusBadge(connection.status as ConnectionStatus)}
                    <div className="flex items-center gap-1 ml-2">
                      {/* Test Connection */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestConnection(connection.id)}
                        disabled={testingId === connection.id || !connection.enabled}
                        title="Test connection"
                      >
                        {testingId === connection.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                      </Button>
                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(connection)}
                        title="Edit connection"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(connection.id)}
                        disabled={deletingId === connection.id}
                        title={
                          confirmDeleteId === connection.id
                            ? 'Click again to confirm'
                            : 'Delete connection'
                        }
                        className={
                          confirmDeleteId === connection.id
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                        }
                      >
                        {deletingId === connection.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : confirmDeleteId === connection.id ? (
                          <span className="text-xs px-1">Confirm?</span>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                      {/* Enable/Disable Toggle */}
                      <Switch
                        checked={connection.enabled}
                        onCheckedChange={() => handleToggleEnabled(connection)}
                        className="ml-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <ConnectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        connection={editingConnection}
        onSave={handleSaveConnection}
      />
    </div>
  )
}
