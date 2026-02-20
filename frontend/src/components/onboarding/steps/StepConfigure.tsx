import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Zap, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Plus } from 'lucide-react'
import { getRuntimeIcon, getRuntimeLabel } from '../onboardingHelpers'
import type { ConnectionConfig } from '../onboardingTypes'

interface StepConfigureProps {
  connections: ConnectionConfig[]
  onUpdateConnection: (id: string, updates: Partial<ConnectionConfig>) => void
  onTestConnection: (id: string) => void
  onAddManual: () => void
  onRemoveConnection: (id: string) => void
}

export function StepConfigure({
  connections, onUpdateConnection, onTestConnection, onAddManual, onRemoveConnection,
}: StepConfigureProps) {
  const [showTokens, setShowTokens] = useState<Set<string>>(new Set())

  const toggleToken = (id: string) => {
    setShowTokens(prev => {
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
          Review and adjust your connections. Test each one to make sure it works.
        </p>
      </div>

      <div className="space-y-4">
        {connections.map((conn) => (
          <div
            key={conn.id}
            className={`p-5 rounded-xl border transition-colors ${
              conn.enabled ? 'bg-card border-border' : 'bg-muted/30 border-border/50 opacity-60'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <Switch
                  checked={conn.enabled}
                  onCheckedChange={(checked) => onUpdateConnection(conn.id, { enabled: checked })}
                />
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  {getRuntimeIcon(conn.type)}
                  <span className="text-sm font-medium text-muted-foreground">{getRuntimeLabel(conn.type)}</span>
                  {conn.testStatus === 'success' && (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-0.5" />
                      Connected{conn.sessions !== undefined && ` (${conn.sessions} sessions)`}
                    </Badge>
                  )}
                  {conn.testStatus === 'error' && (
                    <Badge variant="destructive" className="text-[10px]">
                      <XCircle className="h-3 w-3 mr-0.5" /> Failed
                    </Badge>
                  )}
                </div>

                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={conn.name}
                      onChange={(e) => onUpdateConnection(conn.id, { name: e.target.value })}
                      placeholder="Connection name"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">URL</Label>
                    <Input
                      value={conn.url}
                      onChange={(e) => onUpdateConnection(conn.id, { url: e.target.value })}
                      placeholder="http://localhost:3000"
                      className="h-9 font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Token (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showTokens.has(conn.id) ? 'text' : 'password'}
                        value={conn.token}
                        onChange={(e) => onUpdateConnection(conn.id, { token: e.target.value })}
                        placeholder="API token"
                        className="h-9 flex-1"
                      />
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => toggleToken(conn.id)}>
                        {showTokens.has(conn.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {conn.testError && (
                  <p className="text-sm text-red-500 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 shrink-0" /> {conn.testError}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTestConnection(conn.id)}
                    disabled={conn.testStatus === 'testing' || !conn.enabled}
                    className="gap-1.5"
                  >
                    {conn.testStatus === 'testing'
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Zap className="h-3.5 w-3.5" />}
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

        <Button variant="outline" className="w-full gap-2 h-12 border-dashed" onClick={onAddManual}>
          <Plus className="h-4 w-4" /> Add connection manually
        </Button>
      </div>
    </div>
  )
}
