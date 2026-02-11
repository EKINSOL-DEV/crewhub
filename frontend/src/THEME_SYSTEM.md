# CrewHub Unified Theme System

## Architecture

Single theme system based on the Zen Mode engine, controlling **all** UI:
Tailwind/shadcn components, Zen Mode panels, syntax highlighting, and playground gradients.

## How It Works

```
ZenTheme (object)  →  ThemeProvider  →  CSS Variables on :root
                                          ├── Tailwind vars (--background, --foreground, --primary, etc.)
                                          ├── Zen vars (--zen-bg, --zen-fg, --zen-accent, etc.)
                                          └── Code syntax vars (--code-keyword, --code-string, etc.)
```

### Key Files

| File | Role |
|------|------|
| `components/zen/themes/*.ts` | Theme definitions (colors, metadata) |
| `components/zen/themes/index.ts` | Theme registry & exports |
| `components/zen/themes/tokyo-night.ts` | ZenTheme type + `themeToCSSVariables()` + `themeToTailwindVars()` |
| `components/zen/hooks/useZenTheme.ts` | Core hook: state, localStorage persistence, cycling |
| `contexts/ThemeContext.tsx` | App-wide provider: applies CSS vars to `:root`, bridges to Tailwind |
| `components/sessions/SettingsPanel.tsx` | Theme picker UI in Settings → Look & Feel |
| `index.css` | CSS fallback values (before JS hydrates) |

### Available Themes (9)

**Dark:** Tokyo Night, Dracula, Nord, Solarized Dark, Gruvbox Dark, One Dark, Catppuccin Mocha
**Light:** Solarized Light, GitHub Light

### Adding a New Theme

1. Create `components/zen/themes/my-theme.ts`:
```ts
import type { ZenTheme } from './tokyo-night'
export const myTheme: ZenTheme = {
  id: 'my-theme',
  name: 'My Theme',
  type: 'dark', // or 'light'
  colors: { /* fill all color fields */ }
}
```

2. Register in `components/zen/themes/index.ts`:
   - Import and add to `themes` array
   - Add entry to `themeInfo` array (for preview)

3. Done — it auto-appears in Settings and Zen Mode picker.

### Storage

- Key: `zen-theme` in localStorage
- Value: theme ID string (e.g. `"tokyo-night"`)
- Default: Tokyo Night

### CSS Variable Flow

Each theme generates two sets of CSS variables:

1. **Zen vars** (`--zen-*`): hex colors, used by Zen Mode components via inline styles
2. **Tailwind vars** (`--background`, `--primary`, etc.): HSL values (no wrapper), used by all shadcn/Tailwind components

Both are set on `document.documentElement` by `ThemeProvider`.

### Keyboard Shortcuts

- `Ctrl+Shift+T` — cycle to next theme (in Zen Mode)
- Theme picker in Settings → Look & Feel tab
