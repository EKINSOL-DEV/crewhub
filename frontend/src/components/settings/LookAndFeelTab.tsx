import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useEnvironment, useEnvironmentList } from '@/components/world3d/environments'
import { Section } from './shared'
import type { SessionsSettings } from '@/components/sessions/SettingsPanel'

const CLS_BORDER_BORDER_BG_BACKGROUND_HOVER_BG_MUT = 'border-border bg-background hover:bg-muted'
const CLS_FLEX_1_MIN_W_0 = 'flex-1 min-w-0'
const CLS_FLEX_FLEX_COL_GAP_1 = 'flex flex-col gap-1'
const CLS_FLEX_ITEMS_CENTER_JUSTIFY_BETWEEN = 'flex items-center justify-between'
const CLS_TEXT_XS_TEXT_MUTED_FOREGROUND_FONT_NORMA = 'text-xs text-muted-foreground font-normal'
const CLS_W_2_H_2_ROUNDED_FULL_BG_PRIMARY = 'w-2 h-2 rounded-full bg-primary shrink-0'
const CLS_W_5_H_5_ROUNDED_FULL_SHADOW_SM = 'w-5 h-5 rounded-full shadow-sm border border-white/10'
const CLS_W_5_H_5_ROUNDED_FULL_SHADOW_SM_2 = 'w-5 h-5 rounded-full shadow-sm border border-black/10'

// ─── Props ────────────────────────────────────────────────────────────────────

interface LookAndFeelTabProps {
  readonly settings: SessionsSettings
  readonly onSettingsChange: (settings: SessionsSettings) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LookAndFeelTab({ settings, onSettingsChange }: LookAndFeelTabProps) {
  const { zen, themeInfo: availableThemes } = useTheme()
  const [environment, setEnvironment] = useEnvironment()
  const environmentEntries = useEnvironmentList()

  const updateSetting = <K extends keyof SessionsSettings>(key: K, value: SessionsSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  const darkThemes = availableThemes.filter((t) => t.type === 'dark')
  const lightThemes = availableThemes.filter((t) => t.type === 'light')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
      <Section title="🎨 Theme">
        {/* Dark Themes */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5" /> Dark Themes
          </Label>
          <div className="space-y-1.5">
            {darkThemes.map((t) => (
              <button
                key={t.id}
                onClick={() => zen.setTheme(t.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left
                  ${
                    zen.currentTheme.id === t.id
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30'
                      : CLS_BORDER_BORDER_BG_BACKGROUND_HOVER_BG_MUT
                  }
                `}
              >
                {/* Color preview dots */}
                <div className="flex gap-1 shrink-0">
                  <div
                    className={CLS_W_5_H_5_ROUNDED_FULL_SHADOW_SM}
                    style={{ background: t.preview.bg }}
                  />
                  <div
                    className={CLS_W_5_H_5_ROUNDED_FULL_SHADOW_SM}
                    style={{ background: t.preview.accent }}
                  />
                  <div
                    className={CLS_W_5_H_5_ROUNDED_FULL_SHADOW_SM}
                    style={{ background: t.preview.fg }}
                  />
                </div>
                <div className={CLS_FLEX_1_MIN_W_0}>
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                </div>
                {zen.currentTheme.id === t.id && (
                  <div className={CLS_W_2_H_2_ROUNDED_FULL_BG_PRIMARY} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Light Themes */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Sun className="h-3.5 w-3.5" /> Light Themes
          </Label>
          <div className="space-y-1.5">
            {lightThemes.map((t) => (
              <button
                key={t.id}
                onClick={() => zen.setTheme(t.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left
                  ${
                    zen.currentTheme.id === t.id
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30'
                      : CLS_BORDER_BORDER_BG_BACKGROUND_HOVER_BG_MUT
                  }
                `}
              >
                <div className="flex gap-1 shrink-0">
                  <div
                    className={CLS_W_5_H_5_ROUNDED_FULL_SHADOW_SM_2}
                    style={{ background: t.preview.bg }}
                  />
                  <div
                    className={CLS_W_5_H_5_ROUNDED_FULL_SHADOW_SM_2}
                    style={{ background: t.preview.accent }}
                  />
                  <div
                    className={CLS_W_5_H_5_ROUNDED_FULL_SHADOW_SM_2}
                    style={{ background: t.preview.fg }}
                  />
                </div>
                <div className={CLS_FLEX_1_MIN_W_0}>
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                </div>
                {zen.currentTheme.id === t.id && (
                  <div className={CLS_W_2_H_2_ROUNDED_FULL_BG_PRIMARY} />
                )}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Theme applies to entire app — 3D world, panels, and Zen Mode. Use{' '}
          <span className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">Ctrl+Shift+T</span>{' '}
          to cycle themes.
        </p>
      </Section>

      <Section title="🌍 World Environment">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Environment Style</Label>
          <div className="space-y-2">
            {environmentEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setEnvironment(entry.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left
                  ${
                    environment === entry.id
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : CLS_BORDER_BORDER_BG_BACKGROUND_HOVER_BG_MUT
                  }
                `}
              >
                <div className={CLS_FLEX_1_MIN_W_0}>
                  <div className="text-sm font-medium">{entry.data.name}</div>
                  <div className="text-xs text-muted-foreground">{entry.data.description}</div>
                </div>
                {environment === entry.id && (
                  <div className={CLS_W_2_H_2_ROUNDED_FULL_BG_PRIMARY} />
                )}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <div className="space-y-6">
        <Section title="📺 Display">
          <div className={CLS_FLEX_ITEMS_CENTER_JUSTIFY_BETWEEN}>
            <Label htmlFor="show-animations" className={CLS_FLEX_FLEX_COL_GAP_1}>
              <span className="text-sm">Animations</span>
              <span className={CLS_TEXT_XS_TEXT_MUTED_FOREGROUND_FONT_NORMA}>
                Show wiggle and bounce effects
              </span>
            </Label>
            <Switch
              id="show-animations"
              checked={settings.showAnimations}
              onCheckedChange={(checked) => updateSetting('showAnimations', checked)}
            />
          </div>
          <div className={CLS_FLEX_ITEMS_CENTER_JUSTIFY_BETWEEN}>
            <Label htmlFor="show-badges" className={CLS_FLEX_FLEX_COL_GAP_1}>
              <span className="text-sm">Achievement Badges</span>
              <span className={CLS_TEXT_XS_TEXT_MUTED_FOREGROUND_FONT_NORMA}>
                Display earned badges
              </span>
            </Label>
            <Switch
              id="show-badges"
              checked={settings.showBadges}
              onCheckedChange={(checked) => updateSetting('showBadges', checked)}
            />
          </div>
        </Section>

        <Section title="🎉 Fun & Playfulness">
          <div className={CLS_FLEX_ITEMS_CENTER_JUSTIFY_BETWEEN}>
            <Label htmlFor="easter-eggs" className={CLS_FLEX_FLEX_COL_GAP_1}>
              <span className="text-sm">Easter Eggs</span>
              <span className={CLS_TEXT_XS_TEXT_MUTED_FOREGROUND_FONT_NORMA}>
                Enable hidden surprises
              </span>
            </Label>
            <Switch
              id="easter-eggs"
              checked={settings.easterEggsEnabled}
              onCheckedChange={(checked) => updateSetting('easterEggsEnabled', checked)}
            />
          </div>
          <div className={CLS_FLEX_ITEMS_CENTER_JUSTIFY_BETWEEN}>
            <Label htmlFor="play-sound" className={CLS_FLEX_FLEX_COL_GAP_1}>
              <span className="text-sm">Sound Effects</span>
              <span className={CLS_TEXT_XS_TEXT_MUTED_FOREGROUND_FONT_NORMA}>
                Play sounds for easter eggs
              </span>
            </Label>
            <Switch
              id="play-sound"
              checked={settings.playSound}
              onCheckedChange={(checked) => updateSetting('playSound', checked)}
              disabled={!settings.easterEggsEnabled}
            />
          </div>
        </Section>
      </div>
    </div>
  )
}
