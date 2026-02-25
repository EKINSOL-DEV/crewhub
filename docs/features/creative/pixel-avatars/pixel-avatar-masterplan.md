# Pixel Avatar voor Zen Mode - Masterplan

> **Datum:** 2026-02-07
> **Status:** Implementatie
> **Auteur:** Dev Agent

---

## 🎯 Doel

Een pixel art avatar toevoegen aan de Zen Mode chat panel die de "game meets productivity" vibe versterkt. Een speelse, nostalgische touch die de agent visueel representeert.

---

## 📐 Design Specificaties

### Positie & Afmetingen
- **Locatie:** Rechtsboven in de chat header, naast de "thinking" toggle
- **Formaat:** 32x32 pixels (iets groter dan 30x30 voor betere pixel grid)
- **Rendering:** 8x8 grid van 4x4 pixel blokken = echte pixel art look

### Agent Kleuren (uit botVariants.ts)
| Agent | Variant | Hex Color | Accent |
|-------|---------|-----------|--------|
| Assistent | worker | #FE9600 | oranje |
| Dev | dev | #F32A1C | rood |
| Flowy | comms | #9370DB | paars |
| Reviewer | thinker | #1277C3 | blauw |
| Creator | comms | #FF69B4 | roze |
| Cron | cron | #82B30E | groen |

### Pixel Art Design
```
Design: 8x8 grid robot face

    ████████
  ██        ██
  ██  ▓▓  ▓▓  ██    <- ogen (highlight kleur)
  ██        ██
  ██  ████  ██      <- mond
  ██        ██
    ████████
      ██  ██        <- antenne

Kleur mapping:
- ██ = agent base color
- ▓▓ = wit/licht (ogen)
- Antenne/details = darker shade
```

---

## 🛠 Technische Approach

### Waarom CSS Grid (niet Canvas/SVG)?
1. **Simpel** - Puur CSS, geen extra libraries
2. **Animeerbaar** - CSS transitions/keyframes werken native
3. **Responsive** - Schaalt perfect met CSS variabelen
4. **Lichtgewicht** - Geen canvas context, geen SVG parsing
5. **Themeable** - Kleuren via CSS custom properties

### Component Structuur
```
PixelAvatar/
├── PixelAvatar.tsx       # Main component
├── PixelAvatar.css       # Styles + animations
└── pixelPatterns.ts      # Pixel data per agent
```

### Pixel Data Format
```typescript
// 8x8 grid, 0 = transparent, 1 = base, 2 = highlight, 3 = dark
type PixelGrid = (0 | 1 | 2 | 3)[][]

const AVATAR_PATTERNS = {
  idle: [...],
  thinking: [...],
  typing: [...],
}
```

---

## 🎬 Animaties

### States
1. **Idle** - Subtiele "ademhaling" pulse (scale 1.0 → 1.02)
2. **Thinking** - Ogen knipperen + swirl effect
3. **Typing** - Mond animeert, snelle pulse

### CSS Keyframes
```css
@keyframes pixel-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@keyframes pixel-blink {
  0%, 45%, 55%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes pixel-type {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1px); }
}
```

---

## 📊 Stats Overlay

### Hover Popover Design
```
┌─────────────────────────┐
│ 🤖 Assistent            │
│ ─────────────────────── │
│ Status: Active          │
│ Tokens: 12.4k           │
│ Uptime: 2h 15m          │
│ Model: claude-sonnet    │
└─────────────────────────┘
```

### Data Sources
- **Status:** van chat hook (isSending, error, idle)
- **Tokens:** uit session data (indien beschikbaar)
- **Uptime:** berekend uit session start time
- **Model:** uit session config

### Implementatie
- Gebruik bestaande `ZenTooltip` component
- Of simpele CSS hover tooltip (lighter weight)

---

## 🔧 Implementatie Stappen

### 1. PixelAvatar Component
```tsx
interface PixelAvatarProps {
  agentType: 'worker' | 'dev' | 'comms' | 'thinker' | 'cron'
  status: 'idle' | 'thinking' | 'typing' | 'error'
  stats?: {
    tokens?: number
    uptime?: number
    model?: string
  }
}
```

### 2. Pixel Grid Renderer
- 8x8 CSS Grid container
- Elk cell is een 4x4px div
- Kleur via data-attribute of inline style
- Animatie class op container

### 3. Integratie in ZenChatPanel
- Toevoegen aan `zen-chat-header-right`
- Vóór de thinking toggle button
- Status doorgeven via props

### 4. Stats Tooltip
- Hover event listener
- Absolute positioned tooltip
- Fade in/out animatie

---

## 📁 File Locations

```
frontend/src/components/zen/
├── PixelAvatar/
│   ├── PixelAvatar.tsx
│   ├── PixelAvatar.css
│   └── pixelPatterns.ts
└── ZenChatPanel.tsx  (updated)
```

---

## ✅ Acceptance Criteria

- [ ] Pixel avatar zichtbaar in chat header
- [ ] Correcte kleur per agent type
- [ ] Idle animatie werkt
- [ ] Thinking animatie bij isSending
- [ ] Hover toont stats tooltip
- [ ] Responsive (geen layout breaks)
- [ ] Past bij Zen Mode theming

---

## 🎨 Extra Ideëen (Future)

1. **Achievements** - Kleine badges/crowns na bepaalde milestones
2. **Moods** - Verschillende gezichtsuitdrukkingen
3. **Customization** - User kan avatar kleuren aanpassen
4. **Pet** - Kleine pixel pet naast de bot (Easter egg)

---

*"Pixels never die, they just get upscaled." - Anonymous*
