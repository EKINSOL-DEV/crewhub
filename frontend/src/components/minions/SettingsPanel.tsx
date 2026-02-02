import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

export interface MinionsSettings {
  refreshInterval: number
  autoRefresh: boolean
  showAnimations: boolean
  playSound: boolean
  displayDensity: "compact" | "comfortable"
  showBadges: boolean
  easterEggsEnabled: boolean
  playgroundSpeed: number
}

const DEFAULT_SETTINGS: MinionsSettings = {
  refreshInterval: 5000,
  autoRefresh: true,
  showAnimations: true,
  playSound: false,
  displayDensity: "comfortable",
  showBadges: true,
  easterEggsEnabled: true,
  playgroundSpeed: 1.0,
}

interface SettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: MinionsSettings
  onSettingsChange: (settings: MinionsSettings) => void
}

export function SettingsPanel({ open, onOpenChange, settings, onSettingsChange }: SettingsPanelProps) {
  const updateSetting = <K extends keyof MinionsSettings>(key: K, value: MinionsSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>⚙️ Crew Settings</SheetTitle>
          <SheetDescription>Customize how the Crew behaves and looks</SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Updates</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-refresh" className="flex flex-col gap-1">
                <span>Auto-refresh</span>
                <span className="text-xs text-muted-foreground font-normal">Automatically update crew data</span>
              </Label>
              <Switch id="auto-refresh" checked={settings.autoRefresh} onCheckedChange={(checked) => updateSetting("autoRefresh", checked)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refresh-interval">Refresh Interval</Label>
              <Select value={settings.refreshInterval.toString()} onValueChange={(value) => updateSetting("refreshInterval", parseInt(value))} disabled={!settings.autoRefresh}>
                <SelectTrigger id="refresh-interval"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3000">3 seconds</SelectItem>
                  <SelectItem value="5000">5 seconds</SelectItem>
                  <SelectItem value="10000">10 seconds</SelectItem>
                  <SelectItem value="30000">30 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Display</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-animations" className="flex flex-col gap-1">
                <span>Animations</span>
                <span className="text-xs text-muted-foreground font-normal">Show wiggle and bounce effects</span>
              </Label>
              <Switch id="show-animations" checked={settings.showAnimations} onCheckedChange={(checked) => updateSetting("showAnimations", checked)} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-badges" className="flex flex-col gap-1">
                <span>Achievement Badges</span>
                <span className="text-xs text-muted-foreground font-normal">Display earned badges</span>
              </Label>
              <Switch id="show-badges" checked={settings.showBadges} onCheckedChange={(checked) => updateSetting("showBadges", checked)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Playground</h3>
            <div className="space-y-2">
              <Label htmlFor="playground-speed">Movement Speed</Label>
              <div className="flex items-center gap-4">
                <input id="playground-speed" type="range" min="0.5" max="2.0" step="0.25" value={settings.playgroundSpeed} onChange={(e) => updateSetting("playgroundSpeed", parseFloat(e.target.value))} className="flex-1" />
                <span className="text-sm text-muted-foreground w-16 text-right">{settings.playgroundSpeed}x</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>🐌 Slow</span>
                <span>⚡ Fast</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Fun & Playfulness</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="easter-eggs" className="flex flex-col gap-1">
                <span>Easter Eggs</span>
                <span className="text-xs text-muted-foreground font-normal">Enable hidden surprises</span>
              </Label>
              <Switch id="easter-eggs" checked={settings.easterEggsEnabled} onCheckedChange={(checked) => updateSetting("easterEggsEnabled", checked)} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="play-sound" className="flex flex-col gap-1">
                <span>Sound Effects</span>
                <span className="text-xs text-muted-foreground font-normal">Play sounds for easter eggs</span>
              </Label>
              <Switch id="play-sound" checked={settings.playSound} onCheckedChange={(checked) => updateSetting("playSound", checked)} disabled={!settings.easterEggsEnabled} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { DEFAULT_SETTINGS }
