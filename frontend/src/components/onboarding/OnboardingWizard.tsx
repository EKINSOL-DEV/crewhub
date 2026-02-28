/* eslint-disable react-hooks/exhaustive-deps */
/**
 * OnboardingWizard — First-run experience for CrewHub.
 *
 * 6-step wizard:
 *  1. Welcome
 *  2. Auto-Scan
 *  3. Configure Connections
 *  4. Room Setup (optional)
 *  5. Persona
 *  6. Ready
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { scanForRuntimes, testConnection, type DiscoveryCandidate } from '@/lib/api'
import { OpenClawWizard } from './OpenClawWizard'
import { RoomSetupStep } from './RoomSetupStep'
import { PersonaStep } from './PersonaStep'
import type { PersonaConfig } from '@/lib/personaTypes'
import { updatePersona } from '@/lib/personaApi'
import { StepProgress } from './steps/StepProgress'
import { StepWelcome } from './steps/StepWelcome'
import { StepScan } from './steps/StepScan'
import { StepConfigure } from './steps/StepConfigure'
import { StepReady } from './steps/StepReady'
import { candidateToConnection } from './onboardingHelpers'
import type { WizardStep, ConnectionConfig, OnboardingWizardProps } from './onboardingTypes'

const APPLICATION_JSON = 'application/json'
const KEY_CREWHUB_ONBOARDED = 'crewhub-onboarded'

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [showOpenClawWizard, setShowOpenClawWizard] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<Parameters<typeof StepScan>[0]['scanResult']>(null)
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([])
  const [connections, setConnections] = useState<ConnectionConfig[]>([])
  const scanAbortRef = useRef<AbortController | null>(null)

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
      const newConns = result.candidates
        .filter((c) => c.status === 'reachable')
        .map((c, i) => candidateToConnection(c, i))
      if (newConns.length > 0) setConnections(newConns)
    } catch {
      setScanResult({ candidates: [], scan_duration_ms: 0 })
    } finally {
      setScanning(false)
    }
  }, [])

  // ─── Connection handlers ──────────────────────────────────────

  const handleConnect = useCallback((candidate: DiscoveryCandidate, index: number) => {
    const conn = { ...candidateToConnection(candidate, index), enabled: true }
    setConnections((prev) => {
      if (prev.some((c) => c.url === conn.url && c.type === conn.type)) return prev
      return [...prev, conn]
    })
  }, [])

  const handleUpdateConnection = useCallback((id: string, updates: Partial<ConnectionConfig>) => {
    setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }, [])

  const handleTestConnection = useCallback(
    async (id: string) => {
      const conn = connections.find((c) => c.id === id)
      if (!conn) return
      handleUpdateConnection(id, { testStatus: 'testing', testError: undefined })
      try {
        const result = await testConnection(conn.type, conn.url, conn.token || undefined)
        if (result.reachable) {
          handleUpdateConnection(id, { testStatus: 'success', sessions: result.sessions })
        } else {
          handleUpdateConnection(id, {
            testStatus: 'error',
            testError: result.error || 'Connection failed',
          })
        }
      } catch (err) {
        handleUpdateConnection(id, {
          testStatus: 'error',
          testError: err instanceof Error ? err.message : 'Test failed',
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
        name: 'New Connection',
        type: 'openclaw',
        url: 'http://localhost:3000',
        token: '',
        enabled: true,
        testStatus: 'idle',
      },
    ])
  }, [])

  const handleRemoveConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // ─── Save + complete ──────────────────────────────────────────

  const saveConnections = useCallback(async () => {
    for (const conn of connections.filter((c) => c.enabled)) {
      try {
        const config: Record<string, string> = {}
        if (conn.type === 'openclaw') {
          config.gateway_url = conn.url
          if (conn.token) config.token = conn.token
        } else {
          config.cli_path = conn.url
          if (conn.token) config.api_key = conn.token
        }
        await fetch('/api/connections', {
          method: 'POST',
          headers: { CONTENT_TYPE: APPLICATION_JSON },
          body: JSON.stringify({ name: conn.name, type: conn.type, config, enabled: true }),
        })
      } catch {
        /* best-effort */
      }
    }
  }, [connections])

  const completeOnboarding = useCallback(async () => {
    await saveConnections()
    localStorage.setItem(KEY_CREWHUB_ONBOARDED, 'true')
    try {
      await fetch('/api/settings/crewhub-onboarded', {
        method: 'PUT',
        headers: { CONTENT_TYPE: APPLICATION_JSON },
        body: JSON.stringify({ value: 'true' }),
      })
    } catch {
      /* localStorage is enough */
    }
    onComplete()
  }, [saveConnections, onComplete])

  // ─── Navigation ───────────────────────────────────────────────

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, 6) as WizardStep), [])
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 1) as WizardStep), [])
  const handleSkip = useCallback(() => {
    localStorage.setItem(KEY_CREWHUB_ONBOARDED, 'true')
    onSkip()
  }, [onSkip])
  const handleDemo = useCallback(() => {
    localStorage.setItem(KEY_CREWHUB_ONBOARDED, 'true')
    localStorage.setItem('crewhub-demo-mode', 'true')
    onComplete()
  }, [onComplete])

  const handleOpenClawComplete = useCallback(
    async (config: {
      name: string
      url: string
      token: string
      botTemplate?: string
      displayName?: string
    }) => {
      try {
        await fetch('/api/connections', {
          method: 'POST',
          headers: { CONTENT_TYPE: APPLICATION_JSON },
          body: JSON.stringify({
            name: config.name,
            type: 'openclaw',
            config: { gateway_url: config.url, token: config.token },
            enabled: true,
          }),
        })
      } catch {
        /* best-effort */
      }

      if (config.displayName) {
        const templateToAgentId: Record<string, string> = {
          default: 'main',
          developer: 'dev',
          reviewer: 'reviewer',
        }
        const agentId = config.botTemplate
          ? templateToAgentId[config.botTemplate] || 'main'
          : 'main'
        const sessionKey = `agent:${agentId}:main`
        try {
          await fetch(`/api/session-display-names/${encodeURIComponent(sessionKey)}`, {
            method: 'POST',
            headers: { CONTENT_TYPE: APPLICATION_JSON },
            body: JSON.stringify({ display_name: config.displayName }),
          })
        } catch {
          /* intentionally empty */
        }
        try {
          await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
            method: 'PUT',
            headers: { CONTENT_TYPE: APPLICATION_JSON },
            body: JSON.stringify({ name: config.displayName }),
          })
        } catch {
          /* intentionally empty */
        }
        try {
          await fetch('/api/settings/agent-display-name', {
            method: 'PUT',
            headers: { CONTENT_TYPE: APPLICATION_JSON },
            body: JSON.stringify({
              value: JSON.stringify({ agentId, sessionKey, displayName: config.displayName }),
            }),
          })
        } catch {
          /* intentionally empty */
        }
      }

      localStorage.setItem(KEY_CREWHUB_ONBOARDED, 'true')
      try {
        await fetch('/api/settings/crewhub-onboarded', {
          method: 'PUT',
          headers: { CONTENT_TYPE: APPLICATION_JSON },
          body: JSON.stringify({ value: 'true' }),
        })
      } catch {
        /* intentionally empty */
      }
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
          <StepProgress step={step} total={6} />
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
          {step === 4 && <RoomSetupStep onComplete={goNext} />}
          {step === 5 && (
            <PersonaStep
              onComplete={async (config: PersonaConfig) => {
                try {
                  const res = await fetch('/api/agents')
                  const data = await res.json()
                  const list = data.agents || data || []
                  if (list.length > 0) await updatePersona(String(list[0].id), config)
                } catch {
                  /* best-effort */
                }
                goNext()
              }}
              onSkip={goNext}
            />
          )}
          {step === 6 && <StepReady connections={connections} onGoDashboard={completeOnboarding} />}
        </div>
      </div>

      {/* Footer navigation */}
      {step > 1 && step < 5 && (
        <div className="shrink-0 border-t bg-card/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <Button variant="outline" onClick={goBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step !== 4 && (
              <Button onClick={goNext} className="gap-2">
                {step === 3 ? 'Save & Continue' : 'Continue'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
