/**
 * MobileSettingsPanel – slide-in settings drawer for mobile & Tauri chat.
 *
 * Settings:
 *  1. Theme         – dark / light / system  (localStorage: crewhub-theme)
 *  2. Backend URL   – override API base      (localStorage: crewhub_backend_url)
 *  3. Debug mode    – toggle debug status bar (localStorage: crewhub-debug)
 *  4. Font size     – compact / normal / large (localStorage: crewhub-font-size)
 *  5. App info      – static info
 */

import { useState, useEffect, useRef } from 'react'
import { X, Sun, Moon, Monitor, Check } from 'lucide-react'
import { API_BASE } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────────────

export type AppTheme = 'dark' | 'light' | 'system'
export type FontSize = 'compact' | 'normal' | 'large'

const APP_VERSION = '0.12.0'

// Zen theme IDs for light/dark selection
const ZEN_DARK_THEME = 'tokyo-night'
const ZEN_LIGHT_THEME = 'github-light'
const ZEN_THEME_KEY = 'zen-theme'

// ── Theme helpers ─────────────────────────────────────────────────────────

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveThemeToDark(theme: AppTheme): boolean {
  if (theme === 'system') return getSystemPrefersDark()
  return theme === 'dark'
}

/**
 * Apply theme to the document root:
 * - Sets dark/light class on <html>
 * - Updates zen-theme for ThemeProvider (Tauri context) compatibility
 * - Sets --mobile-bg CSS var for MobileLayout to consume
 */
export function applyTheme(theme: AppTheme): void {
  const isDark = resolveThemeToDark(theme)
  const root = document.documentElement

  root.classList.remove('dark', 'light')
  root.classList.add(isDark ? 'dark' : 'light')
  document.body.classList.remove('dark', 'light')
  document.body.classList.add(isDark ? 'dark' : 'light')

  // Update zen-theme for when ThemeProvider is present (Tauri, or when wrapped)
  // Only set if ThemeProvider hasn't already set a user-chosen zen theme
  const currentZen = localStorage.getItem(ZEN_THEME_KEY)
  const isLightZen = currentZen === ZEN_LIGHT_THEME || currentZen === 'solarized-light'
  const isDarkZen = currentZen && currentZen !== ZEN_LIGHT_THEME && currentZen !== 'solarized-light'
  if (isDark && isLightZen) {
    localStorage.setItem(ZEN_THEME_KEY, ZEN_DARK_THEME)
  } else if (!isDark && (isDarkZen || !currentZen)) {
    localStorage.setItem(ZEN_THEME_KEY, ZEN_LIGHT_THEME)
  }

  // CSS custom property for mobile layout background
  root.style.setProperty('--mobile-bg', isDark ? '#0f172a' : '#f8fafc')
  root.style.setProperty('--mobile-surface', isDark ? '#1e293b' : '#ffffff')
  root.style.setProperty('--mobile-surface2', isDark ? '#293548' : '#f1f5f9')
  root.style.setProperty('--mobile-border', isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
  root.style.setProperty('--mobile-text', isDark ? '#e2e8f0' : '#0f172a')
  root.style.setProperty('--mobile-text-muted', isDark ? '#64748b' : '#64748b')
}

/**
 * Apply font size to the document root as a CSS variable.
 */
export function applyFontSize(size: FontSize): void {
  const sizes: Record<FontSize, string> = {
    compact: '13px',
    normal: '15px',
    large: '17px',
  }
  document.documentElement.style.setProperty('--mobile-font-size', sizes[size])
  document.documentElement.setAttribute('data-font-size', size)
}

/** Initialize theme & font size from localStorage on app start. */
export function initAppSettings(): void {
  const theme = (localStorage.getItem('crewhub-theme') as AppTheme | null) ?? 'dark'
  const fontSize = (localStorage.getItem('crewhub-font-size') as FontSize | null) ?? 'normal'
  applyTheme(theme)
  applyFontSize(fontSize)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isTauri(): boolean {
  return typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' ||
         typeof (window as any).__TAURI__ !== 'undefined'
}

function getEffectiveUrl(): string {
  const isInTauri = isTauri()
  const raw =
    localStorage.getItem('crewhub_backend_url') ||
    (window as any).__CREWHUB_BACKEND_URL__ ||
    import.meta.env.VITE_API_URL ||
    ''
  if (!isInTauri && raw.includes('localhost')) return '(ignored in browser mode)'
  return raw || `${window.location.origin}/api`
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface SectionProps {
  title: string
  children: React.ReactNode
}
function Section({ title, children }: SectionProps) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: '#475569',
        marginBottom: 10, paddingLeft: 2,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: string; icon?: React.ReactNode }[]
  onChange: (v: T) => void
  accentColor?: string
}
function Segmented<T extends string>({ value, options, onChange, accentColor = '#6366f1' }: SegmentedProps<T>) {
  return (
    <div style={{
      display: 'flex', gap: 4,
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 12, padding: 4,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 5,
              padding: '8px 6px', borderRadius: 9, border: 'none',
              background: active ? accentColor : 'transparent',
              color: active ? '#fff' : '#94a3b8',
              fontSize: 13, fontWeight: active ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

interface ToggleProps {
  value: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  accentColor?: string
}
function Toggle({ value, onChange, label, description, accentColor = '#6366f1' }: ToggleProps) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
      }}
      onClick={() => onChange(!value)}
    >
      <div>
        <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{description}</div>
        )}
      </div>
      {/* Track */}
      <div style={{
        width: 44, height: 26, borderRadius: 13, flexShrink: 0,
        background: value ? accentColor : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background 0.2s',
      }}>
        {/* Thumb */}
        <div style={{
          position: 'absolute', top: 3,
          left: value ? 21 : 3,
          width: 20, height: 20, borderRadius: 10,
          background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </div>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────

interface MobileSettingsPanelProps {
  open: boolean
  onClose: () => void
}

export function MobileSettingsPanel({ open, onClose }: MobileSettingsPanelProps) {
  // ── State ────
  const [theme, setThemeState] = useState<AppTheme>(
    () => (localStorage.getItem('crewhub-theme') as AppTheme | null) ?? 'dark'
  )
  const [backendUrl, setBackendUrl] = useState(
    () => localStorage.getItem('crewhub_backend_url') ?? ''
  )
  const [debugMode, setDebugMode] = useState(
    () => localStorage.getItem('crewhub-debug') === 'true'
  )
  const [fontSize, setFontSizeState] = useState<FontSize>(
    () => (localStorage.getItem('crewhub-font-size') as FontSize | null) ?? 'normal'
  )
  const [urlSaved, setUrlSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Apply changes reactively ────
  const handleThemeChange = (t: AppTheme) => {
    setThemeState(t)
    localStorage.setItem('crewhub-theme', t)
    applyTheme(t)
  }

  const handleFontSizeChange = (s: FontSize) => {
    setFontSizeState(s)
    localStorage.setItem('crewhub-font-size', s)
    applyFontSize(s)
  }

  const handleDebugChange = (v: boolean) => {
    setDebugMode(v)
    if (v) {
      localStorage.setItem('crewhub-debug', 'true')
    } else {
      localStorage.removeItem('crewhub-debug')
    }
  }

  const handleSaveUrl = () => {
    const trimmed = backendUrl.trim()
    if (trimmed) {
      localStorage.setItem('crewhub_backend_url', trimmed)
    } else {
      localStorage.removeItem('crewhub_backend_url')
    }
    setUrlSaved(true)
    setTimeout(() => setUrlSaved(false), 2000)
  }

  const handleClearUrl = () => {
    localStorage.removeItem('crewhub_backend_url')
    setBackendUrl('')
    setUrlSaved(false)
  }

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Close on escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const effectiveUrl = getEffectiveUrl()
  const inTauri = isTauri()

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleBackdropClick}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Drawer – slides up from the bottom */}
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10001,
          maxHeight: '90dvh',
          background: '#1e293b',
          borderRadius: '20px 20px 0 0',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
          margin: '12px auto 4px',
          flexShrink: 0,
        }} />

        {/* Header */}
        <div style={{
          padding: '8px 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
            ⚙️ Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{
          flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          padding: '20px 20px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        }}>

          {/* ── 1. Theme ─────────────────────────────────────────── */}
          <Section title="Theme">
            <Segmented<AppTheme>
              value={theme}
              onChange={handleThemeChange}
              options={[
                { value: 'dark', label: 'Dark', icon: <Moon size={13} /> },
                { value: 'light', label: 'Light', icon: <Sun size={13} /> },
                { value: 'system', label: 'System', icon: <Monitor size={13} /> },
              ]}
            />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 6, paddingLeft: 2 }}>
              Theme applies to settings panels and new UI elements.
            </div>
          </Section>

          {/* ── 2. Backend URL ────────────────────────────────────── */}
          <Section title="Backend URL">
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12, padding: '12px 14px',
              border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 8,
            }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>
                CURRENT EFFECTIVE URL
              </div>
              <div style={{
                fontSize: 12, color: '#94a3b8',
                wordBreak: 'break-all', fontFamily: 'monospace',
              }}>
                {effectiveUrl}
              </div>
              {!inTauri && (
                <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>
                  ⚠ localhost URLs are ignored in browser mode
                </div>
              )}
            </div>

            <input
              ref={inputRef}
              type="url"
              value={backendUrl}
              onChange={e => setBackendUrl(e.target.value)}
              placeholder="http://hostname:8091"
              style={{
                width: '100%', padding: '10px 14px',
                borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)', color: '#e2e8f0',
                fontSize: 14, fontFamily: 'monospace',
                outline: 'none', boxSizing: 'border-box',
                marginBottom: 8,
              }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSaveUrl}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: urlSaved ? '#22c55e' : '#6366f1', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'background 0.2s',
                }}
              >
                {urlSaved ? <><Check size={14} /> Saved!</> : 'Save'}
              </button>
              <button
                onClick={handleClearUrl}
                style={{
                  padding: '10px 18px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: '#94a3b8',
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                Clear
              </button>
            </div>
            {urlSaved && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, paddingLeft: 2 }}>
                Reload the app to apply the new URL.
              </div>
            )}
          </Section>

          {/* ── 3. Debug Mode ─────────────────────────────────────── */}
          <Section title="Developer">
            <Toggle
              value={debugMode}
              onChange={handleDebugChange}
              label="Debug Mode"
              description="Show SSE status, API URL, and version at the bottom of the screen"
            />
          </Section>

          {/* ── 4. Font Size ──────────────────────────────────────── */}
          <Section title="Font Size">
            <Segmented<FontSize>
              value={fontSize}
              onChange={handleFontSizeChange}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'normal', label: 'Normal' },
                { value: 'large', label: 'Large' },
              ]}
            />
          </Section>

          {/* ── 5. App Info ───────────────────────────────────────── */}
          <Section title="App Info">
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {[
                { label: 'Version', value: `v${APP_VERSION}` },
                {
                  label: 'Running in',
                  value: inTauri ? '🖥 Tauri Desktop' : '🌐 Browser',
                },
                {
                  label: 'API Base',
                  value: API_BASE,
                  mono: true,
                },
              ].map((row, i, arr) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex', alignItems: 'flex-start',
                    justifyContent: 'space-between', padding: '11px 14px',
                    borderBottom: i < arr.length - 1
                      ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 13, color: '#64748b', flexShrink: 0 }}>
                    {row.label}
                  </span>
                  <span style={{
                    fontSize: 12, color: '#e2e8f0', textAlign: 'right',
                    wordBreak: 'break-all',
                    fontFamily: row.mono ? 'monospace' : 'inherit',
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </>
  )
}
