/**
 * IdentityTab — Settings tab for the Agent Identity Pattern.
 *
 * Manages the identity anchor (core "who am I" statement),
 * global surface rules, identity lock, and per-surface format overrides.
 *
 * Key principle: Single identity, multiple surfaces.
 * Personality stays constant; only format adapts per channel.
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle2, Shield, ShieldCheck, Globe, RotateCcw, Info } from 'lucide-react'
import {
  fetchIdentity,
  updateIdentity,
  fetchSurfaces,
  updateSurface,
  deleteSurface,
} from '@/lib/personaApi'
import type { SurfaceRule } from '@/lib/personaTypes'

interface Agent {
  id: string
  name: string
}

const SURFACE_ICONS: Record<string, string> = {
  whatsapp: '📱',
  discord: '💬',
  slack: '💼',
  telegram: '✈️',
  'crewhub-ui': '🖥️',
  email: '📧',
  sms: '📲',
  signal: '🔒',
  imessage: '💬',
}

export function IdentityTab() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Identity state
  const [identityAnchor, setIdentityAnchor] = useState('')
  const [surfaceRules, setSurfaceRules] = useState('')
  const [identityLocked, setIdentityLocked] = useState(false)
  const [agentName, setAgentName] = useState('')

  // Surfaces state
  const [surfaces, setSurfaces] = useState<SurfaceRule[]>([])
  const [editingSurface, setEditingSurface] = useState<string | null>(null)
  const [editingRules, setEditingRules] = useState('')

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Load agents on mount
  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data) => {
        const agentList: Agent[] = (data.agents || data || []).map(
          (a: { id: string; name?: string }) => ({
            id: String(a.id),
            name: a.name || String(a.id),
          })
        )
        setAgents(agentList)
        if (agentList.length > 0) {
          setSelectedAgent(agentList[0].id)
        }
      })
      .catch(() => {})
  }, [])

  // Load identity + surfaces when agent changes
  useEffect(() => {
    if (!selectedAgent) return
    setLoading(true)
    setSaveStatus('idle')

    Promise.all([
      fetchIdentity(selectedAgent).catch(() => null),
      fetchSurfaces(selectedAgent).catch(() => null),
    ])
      .then(([identity, surfacesData]) => {
        if (identity) {
          setIdentityAnchor(identity.identity_anchor || '')
          setSurfaceRules(identity.surface_rules || '')
          setIdentityLocked(identity.identity_locked || false)
          setAgentName(identity.agent_name || '')
        }
        if (surfacesData) {
          setSurfaces(surfacesData.surfaces || [])
        }
      })
      .finally(() => setLoading(false))
  }, [selectedAgent])

  const handleSaveIdentity = useCallback(async () => {
    if (!selectedAgent) return
    setSaving(true)
    setSaveStatus('idle')
    try {
      await updateIdentity(selectedAgent, {
        identity_anchor: identityAnchor,
        surface_rules: surfaceRules,
        identity_locked: identityLocked,
      })
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }, [selectedAgent, identityAnchor, surfaceRules, identityLocked])

  const handleSaveSurface = useCallback(
    async (surface: string, rules: string) => {
      if (!selectedAgent) return
      try {
        await updateSurface(selectedAgent, surface, rules)
        setSurfaces((prev) =>
          prev.map((s) =>
            s.surface === surface ? { ...s, format_rules: rules, is_custom: true } : s
          )
        )
        setEditingSurface(null)
      } catch {
        // Silent fail — could add toast here
      }
    },
    [selectedAgent]
  )

  const handleResetSurface = useCallback(
    async (surface: string) => {
      if (!selectedAgent) return
      try {
        await deleteSurface(selectedAgent, surface)
        // Refresh surfaces
        const data = await fetchSurfaces(selectedAgent)
        setSurfaces(data.surfaces || [])
      } catch {
        // May not have custom rule to delete
      }
    },
    [selectedAgent]
  )

  if (agents.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No agents found. Create an agent first to configure its identity.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Intro */}
      <div className="rounded-lg border bg-card/50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Info className="h-4 w-4 text-blue-500" />
          Agent Identity Pattern
        </div>
        <p className="text-xs text-muted-foreground">
          One identity, multiple surfaces. Your agent&apos;s personality stays constant whether
          accessed via WhatsApp, Discord, Slack, or the CrewHub web UI. Only the <em>format</em>{' '}
          adapts per channel — never the personality.
        </p>
      </div>

      {/* Agent selector */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Agent</p>
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-full max-w-xs" aria-label="Agent">
            <SelectValue placeholder="Select an agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Identity Anchor */}
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Identity Anchor
            </p>
            <p className="text-xs text-muted-foreground">
              The core &quot;who am I&quot; statement. This is injected into every conversation,
              anchoring the agent&apos;s identity regardless of which surface they&apos;re accessed
              through.
            </p>
            <textarea
              value={identityAnchor}
              onChange={(e) => {
                setIdentityAnchor(e.target.value.slice(0, 2000))
                setSaveStatus('idle')
              }}
              placeholder={`e.g. "I am ${agentName || 'the assistant'}, a helpful AI agent. I exist as a single entity accessible through multiple channels. My personality and values are constant — I adapt my format, never my identity."`}
              className="w-full h-32 px-3 py-2 text-sm rounded-md border bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
              maxLength={2000}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {identityAnchor.length}/2000
            </p>
          </div>

          {/* Global Surface Rules */}
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Global Surface Rules
            </p>
            <p className="text-xs text-muted-foreground">
              Rules that apply to all surfaces. These are combined with per-surface format rules
              below.
            </p>
            <textarea
              value={surfaceRules}
              onChange={(e) => {
                setSurfaceRules(e.target.value.slice(0, 2000))
                setSaveStatus('idle')
              }}
              placeholder={`e.g. "Always use my name in greetings. Keep responses under 500 words unless asked for detail. Use emoji sparingly but naturally."`}
              className="w-full h-24 px-3 py-2 text-sm rounded-md border bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
              maxLength={2000}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {surfaceRules.length}/2000
            </p>
          </div>

          {/* Identity Lock */}
          <div className="flex items-center gap-3 py-2">
            <button
              type="button"
              onClick={() => {
                setIdentityLocked(!identityLocked)
                setSaveStatus('idle')
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                identityLocked
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {identityLocked ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              {identityLocked ? 'Identity Locked' : 'Identity Unlocked'}
            </button>
            <span className="text-xs text-muted-foreground">
              {identityLocked
                ? 'Onboarding wizards will skip personality setup for this agent.'
                : "Onboarding wizards may modify this agent's personality."}
            </span>
          </div>

          {/* Save Identity */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveIdentity} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Identity
            </Button>
            {saveStatus === 'success' && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </Badge>
            )}
            {saveStatus === 'error' && (
              <Badge variant="destructive" className="gap-1">
                Failed to save
              </Badge>
            )}
          </div>

          {/* Per-Surface Format Rules */}
          <div className="space-y-3 pt-4 border-t">
            <div>
              <h3 className="text-sm font-medium">Surface Format Rules</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Customize how your agent formats messages per channel. These affect formatting only
                — not personality.
              </p>
            </div>

            <div className="space-y-2">
              {surfaces.map((s) => (
                <div key={s.surface} className="rounded-md border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{SURFACE_ICONS[s.surface] || '🌐'}</span>
                      <span className="text-sm font-medium capitalize">
                        {s.surface.replace('-', ' ')}
                      </span>
                      {s.is_custom && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {editingSurface !== s.surface && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setEditingSurface(s.surface)
                            setEditingRules(s.format_rules)
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {s.is_custom && editingSurface !== s.surface && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => handleResetSurface(s.surface)}
                          title="Reset to default"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {editingSurface === s.surface ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingRules}
                        onChange={(e) => setEditingRules(e.target.value.slice(0, 1000))}
                        className="w-full h-20 px-3 py-2 text-xs rounded-md border bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder={s.default_rules}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleSaveSurface(s.surface, editingRules)}
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setEditingSurface(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {s.format_rules || s.default_rules || 'No rules configured'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
