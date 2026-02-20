import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useGridDebug } from "@/hooks/useGridDebug"
import { useDebugBots } from "@/hooks/useDebugBots"
import { useLightingPanelVisibility } from "@/hooks/useLightingConfig"
import { Section } from "./shared"

// ─── AdvancedTab ──────────────────────────────────────────────────────────────

export function AdvancedTab() {
  const [gridDebugEnabled, toggleGridDebug] = useGridDebug()
  const { debugBotsEnabled, setDebugBotsEnabled } = useDebugBots()
  const { visible: lightingPanelVisible, setVisible: setLightingPanelVisible } = useLightingPanelVisibility()

  return (
    <div className="max-w-2xl">
      <Section title="🔧 Developer">
        <div className="flex items-center justify-between">
          <Label htmlFor="grid-debug" className="flex flex-col gap-1">
            <span className="text-sm">Grid Overlay</span>
            <span className="text-xs text-muted-foreground font-normal">Show 20×20 grid debug overlay on rooms</span>
          </Label>
          <Switch
            id="grid-debug"
            checked={gridDebugEnabled}
            onCheckedChange={(checked) => toggleGridDebug(checked)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="lighting-editor" className="flex flex-col gap-1">
            <span className="text-sm">💡 Lighting Editor</span>
            <span className="text-xs text-muted-foreground font-normal">Live lighting debug panel with sliders &amp; JSON export</span>
          </Label>
          <Switch
            id="lighting-editor"
            checked={lightingPanelVisible}
            onCheckedChange={(checked) => setLightingPanelVisible(checked)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="debug-bots" className="flex flex-col gap-1">
            <span className="text-sm">🧪 Debug Bots</span>
            <span className="text-xs text-muted-foreground font-normal">Add fake test bots to rooms for visual testing</span>
          </Label>
          <Switch
            id="debug-bots"
            checked={debugBotsEnabled}
            onCheckedChange={(checked) => setDebugBotsEnabled(checked)}
          />
        </div>
      </Section>
    </div>
  )
}
