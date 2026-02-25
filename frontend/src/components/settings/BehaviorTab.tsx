import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw } from 'lucide-react'
import { useSessionConfig } from '@/hooks/useSessionConfig'
import {
  SESSION_CONFIG_DEFAULTS,
  updateConfig,
  resetConfig,
  isOverridden,
  getOverrideCount,
  type SessionConfigKey,
} from '@/lib/sessionConfig'
import { useToast } from '@/hooks/use-toast'
import { Section, CollapsibleSection } from './shared'
import type { SessionsSettings } from '@/components/sessions/SettingsPanel'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BehaviorTabProps {
  readonly settings: SessionsSettings
  readonly onSettingsChange: (settings: SessionsSettings) => void
}

// ─── Config Field ─────────────────────────────────────────────────────────────

interface ConfigFieldProps {
  readonly label: string
  readonly description?: string
  readonly configKey: SessionConfigKey
  readonly value: number
  readonly unit: 'seconds' | 'minutes' | 'count' | 'speed' | 'ms'
  readonly min?: number
  readonly max?: number
  readonly step?: number
}

function ConfigField({
  label,
  description,
  configKey,
  value,
  unit,
  min = 0,
  max,
  step,
}: ConfigFieldProps) {
  const overridden = isOverridden(configKey)
  const defaultVal = SESSION_CONFIG_DEFAULTS[configKey]

  const toDisplay = (v: number) => {
    if (unit === 'seconds') return v / 1000
    if (unit === 'minutes') return v / 60_000
    return v
  }
  const fromDisplay = (v: number) => {
    if (unit === 'seconds') return v * 1000
    if (unit === 'minutes') return v * 60_000
    return v
  }

  const displayValue = toDisplay(value)
  const displayDefault = toDisplay(defaultVal)
  let displayStep: number
  if (step !== undefined && step !== null) {
    displayStep = step
  } else if (unit === 'minutes') {
    displayStep = 0.5
  } else if (unit === 'seconds') {
    displayStep = 5
  } else if (unit === 'speed') {
    displayStep = 0.1
  } else {
    displayStep = 1
  }
  const displayMax = max ? toDisplay(max) : undefined
  const unitLabel =
    unit === 'seconds'
      ? 's'
      : unit === 'minutes'
        ? 'min'
        : unit === 'ms'
          ? 'ms'
          : unit === 'speed'
            ? '×'
            : ''

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{label}</span>
          {overridden && (
            <button
              onClick={() => updateConfig(configKey, defaultVal)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
              title={`Reset to default (${displayDefault}${unitLabel})`}
            >
              ↻
            </button>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          type="number"
          value={displayValue}
          onChange={(e) => {
            const num = parseFloat(e.target.value)
            if (!isNaN(num) && num >= min) {
              updateConfig(configKey, fromDisplay(num))
            }
          }}
          className="w-20 h-8 text-sm text-right font-mono"
          min={min}
          max={displayMax}
          step={displayStep}
        />
        <span className="text-xs text-muted-foreground w-6">{unitLabel}</span>
      </div>
    </div>
  )
}

// ─── Thresholds & Timing Section ──────────────────────────────────────────────

function ThresholdsTimingSection({ config }: { config: Record<string, number> }) {
  return (
    <div className="space-y-5">
      {/* Status Thresholds */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Session Status
        </h3>
        <ConfigField
          label="Active → Idle"
          description="Time before a session is considered idle"
          configKey="statusActiveThresholdMs"
          value={config.statusActiveThresholdMs}
          unit="minutes"
          min={0}
        />
        <ConfigField
          label="Idle → Sleeping"
          description="Time before a session is considered sleeping"
          configKey="statusSleepingThresholdMs"
          value={config.statusSleepingThresholdMs}
          unit="minutes"
          min={0}
        />
      </div>

      {/* 3D Bot Status */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          3D Bot Status
        </h3>
        <ConfigField
          label="Bot Idle Threshold"
          description="Time before a bot appears idle in the 3D world"
          configKey="botIdleThresholdMs"
          value={config.botIdleThresholdMs}
          unit="seconds"
          min={0}
        />
        <ConfigField
          label="Bot Offline Threshold"
          description="Time before a bot goes offline in the 3D world"
          configKey="botSleepingThresholdMs"
          value={config.botSleepingThresholdMs}
          unit="minutes"
          min={0}
        />
      </div>

      {/* Activity Detection */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Activity Detection
        </h3>
        <ConfigField
          label="Token Change Window"
          description="Recent token changes within this window = actively running"
          configKey="tokenChangeThresholdMs"
          value={config.tokenChangeThresholdMs}
          unit="seconds"
          min={0}
        />
        <ConfigField
          label="Updated-At Active"
          description="updatedAt within this window = actively running"
          configKey="updatedAtActiveMs"
          value={config.updatedAtActiveMs}
          unit="seconds"
          min={0}
        />
      </div>

      {/* Parking */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Parking / Break Area
        </h3>
        <ConfigField
          label="Parking Expiry"
          description="Hide parked sessions after this time"
          configKey="parkingExpiryMs"
          value={config.parkingExpiryMs}
          unit="minutes"
          min={0}
        />
        <ConfigField
          label="Max Visible Sessions"
          description="Sessions beyond this are overflow to parking"
          configKey="parkingMaxVisible"
          value={config.parkingMaxVisible}
          unit="count"
          min={1}
          step={1}
        />
        <ConfigField
          label="Max Bots Per Room"
          description="Limit rendered bots per room in 3D view"
          configKey="maxVisibleBotsPerRoom"
          value={config.maxVisibleBotsPerRoom}
          unit="count"
          min={1}
          step={1}
        />
      </div>

      {/* Bot Movement */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          3D Bot Movement
        </h3>
        <ConfigField
          label="Active Walk Speed"
          configKey="botWalkSpeedActive"
          value={config.botWalkSpeedActive}
          unit="speed"
          min={0.1}
          step={0.1}
        />
        <ConfigField
          label="Idle Wander Speed"
          configKey="botWalkSpeedIdle"
          value={config.botWalkSpeedIdle}
          unit="speed"
          min={0.1}
          step={0.1}
        />
        <ConfigField
          label="Wander Min Wait"
          description="Min seconds between random wander moves"
          configKey="wanderMinWaitS"
          value={config.wanderMinWaitS}
          unit="seconds"
          min={0}
        />
        <ConfigField
          label="Wander Max Wait"
          description="Max seconds between random wander moves"
          configKey="wanderMaxWaitS"
          value={config.wanderMaxWaitS}
          unit="seconds"
          min={0}
        />
      </div>

      {/* Polling */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Polling Intervals
        </h3>
        <ConfigField
          label="Log Viewer Refresh"
          configKey="logViewerPollMs"
          value={config.logViewerPollMs}
          unit="seconds"
          min={0}
        />
        <ConfigField
          label="Cron View Refresh"
          configKey="cronViewPollMs"
          value={config.cronViewPollMs}
          unit="seconds"
          min={0}
        />
      </div>

      {/* Reset All */}
      <div className="pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => {
            resetConfig()
          }}
          disabled={getOverrideCount() === 0}
        >
          ↻ Reset All to Defaults
          {getOverrideCount() > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {getOverrideCount()} custom
            </Badge>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── BehaviorTab ──────────────────────────────────────────────────────────────

export function BehaviorTab({ settings, onSettingsChange }: BehaviorTabProps) {
  const sessionConfig = useSessionConfig()
  const overrideCount = getOverrideCount()
  const { toast } = useToast()

  const [zenAutoLaunch, setZenAutoLaunch] = useState(
    () => localStorage.getItem('crewhub-zen-auto-launch') === 'true'
  )
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>(
    () => localStorage.getItem('crewhub-mic-device-id') ?? ''
  )
  const [micEnumerating, setMicEnumerating] = useState(false)

  const updateSetting = <K extends keyof SessionsSettings>(key: K, value: SessionsSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  const handleEnumerateMics = async () => {
    setMicEnumerating(true)
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
        s.getTracks().forEach((t) => t.stop())
      })
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMicDevices(devices.filter((d) => d.kind === 'audioinput'))
    } catch {
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
      setMicDevices(devices.filter((d) => d.kind === 'audioinput'))
    } finally {
      setMicEnumerating(false)
    }
  }

  const handleMicChange = (deviceId: string) => {
    setSelectedMicId(deviceId)
    if (deviceId) {
      localStorage.setItem('crewhub-mic-device-id', deviceId)
    } else {
      localStorage.removeItem('crewhub-mic-device-id')
    }
  }

  // Enumerate mics on mount (BehaviorTab only mounts when behavior tab is active)
  useEffect(() => {
    if (
      micDevices.length === 0 &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.enumerateDevices === 'function'
    ) {
      void handleEnumerateMics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
      <Section title="🔄 Updates">
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-refresh" className="flex flex-col gap-1">
            <span className="text-sm">Auto-refresh</span>
            <span className="text-xs text-muted-foreground font-normal">
              Automatically update crew data
            </span>
          </Label>
          <Switch
            id="auto-refresh"
            checked={settings.autoRefresh}
            onCheckedChange={(checked) => updateSetting('autoRefresh', checked)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="refresh-interval" className="text-sm">
            Refresh Interval
          </Label>
          <Select
            value={settings.refreshInterval.toString()}
            onValueChange={(value) => updateSetting('refreshInterval', parseInt(value))}
            disabled={!settings.autoRefresh}
          >
            <SelectTrigger id="refresh-interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3000">3 seconds</SelectItem>
              <SelectItem value="5000">5 seconds</SelectItem>
              <SelectItem value="10000">10 seconds</SelectItem>
              <SelectItem value="30000">30 seconds</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section title="🎮 Playground">
        <div className="space-y-2">
          <Label htmlFor="parking-idle-threshold" className="text-sm">
            Parking Idle Threshold
          </Label>
          <Select
            value={String(settings.parkingIdleThreshold ?? 120)}
            onValueChange={(value) => updateSetting('parkingIdleThreshold', parseInt(value))}
          >
            <SelectTrigger id="parking-idle-threshold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 seconds</SelectItem>
              <SelectItem value="60">1 minute</SelectItem>
              <SelectItem value="120">2 minutes</SelectItem>
              <SelectItem value="300">5 minutes</SelectItem>
              <SelectItem value="600">10 minutes</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How long before idle sessions move to parking
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="playground-speed" className="text-sm">
            Movement Speed
          </Label>
          <div className="flex items-center gap-4">
            <input
              id="playground-speed"
              type="range"
              min="0.5"
              max="2.0"
              step="0.25"
              value={settings.playgroundSpeed}
              onChange={(e) => updateSetting('playgroundSpeed', parseFloat(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-sm text-muted-foreground w-12 text-right font-mono">
              {settings.playgroundSpeed}x
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>🐌 Slow</span>
            <span>⚡ Fast</span>
          </div>
        </div>
      </Section>

      <Section title="🧘 Zen Mode">
        <div className="flex items-center justify-between">
          <Label htmlFor="zen-auto-launch" className="flex flex-col gap-1">
            <span className="text-sm">Launch in Zen Mode</span>
            <span className="text-xs text-muted-foreground font-normal">
              Open Zen Mode automatically on startup instead of 3D world
            </span>
          </Label>
          <Switch
            id="zen-auto-launch"
            checked={zenAutoLaunch}
            onCheckedChange={(checked) => {
              setZenAutoLaunch(checked)
              localStorage.setItem('crewhub-zen-auto-launch', String(checked))
              toast({
                title: checked ? 'Zen Mode Auto-Launch Enabled' : 'Zen Mode Auto-Launch Disabled',
                description: checked
                  ? 'App will open in Zen Mode on next load'
                  : 'App will open in 3D world on next load',
              })
            }}
          />
        </div>
      </Section>

      {typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.enumerateDevices === 'function' && (
          <Section title="🎤 Microphone">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Input Device</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleEnumerateMics()}
                  disabled={micEnumerating}
                  className="h-7 px-3 text-xs"
                >
                  {micEnumerating ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Scanning…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>
              {micDevices.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {micEnumerating
                    ? 'Scanning for microphones…'
                    : 'Click Refresh to list microphones'}
                </p>
              ) : (
                <select
                  value={selectedMicId}
                  onChange={(e) => handleMicChange(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Default microphone</option>
                  {micDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-muted-foreground">
                Used for voice messages. Saved to this device.
              </p>
            </div>
          </Section>
        )}

      <CollapsibleSection
        title="⏱️ Thresholds & Timing"
        badge={overrideCount > 0 ? `${overrideCount} custom` : undefined}
        defaultOpen={false}
      >
        <ThresholdsTimingSection config={sessionConfig} />
      </CollapsibleSection>
    </div>
  )
}
