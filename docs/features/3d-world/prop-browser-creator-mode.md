# CrewHub — Prop Browser & Creator Mode
## UX Design Voorstel

*Auteur: Flowy (Marketing & UX)*
*Datum: 2026-02-24*
*Status: Voorstel — wacht op beslissing Nicky*
*Versie: 1.0*

---

## Inhoudsopgave

1. [Overzicht & Visie](#1-overzicht--visie)
2. [User Flow — Happy Path](#2-user-flow--happy-path)
3. [UI Mockup Beschrijvingen](#3-ui-mockup-beschrijvingen)
4. [Component Structuur](#4-component-structuur)
5. [Backend Requirements](#5-backend-requirements)
6. [Prioritering — MVP vs Nice-to-Have](#6-prioritering--mvp-vs-nice-to-have)
7. [Open Vragen voor Nicky](#7-open-vragen-voor-nicky)

---

## 1. Overzicht & Visie

### Wat bouwen we?

Een twee-lagen systeem:

1. **Prop Browser** — een zijpaneel/overlay waar je door alle beschikbare props kunt bladeren, zoeken en filteren. Zowel de 70+ ingebouwde props (`builtin:`) als AI-gegenereerde props (`crewhub:`) zijn hier terug te vinden.

2. **Creator Mode** — een editeer-modus die je activeert wanneer je props wil plaatsen, verplaatsen of verwijderen uit kamers. Buiten Creator Mode is de wereld "read-only": je kijkt, maar je raakt niets aan.

### Design Principes

- **Least Friction**: Prop Browser is altijd bereikbaar zonder flow te onderbreken (geen volledige modal die alles blokkeert)
- **Non-destructive**: Undo/Redo voor alle plaatsingen; nooit per ongeluk iets kwijtraken
- **Context-aware**: De browser toont relevante props op basis van de actieve kamer (bijv. Dev Room → technische props eerst)
- **Consistent met de stijl**: Donker gloed-thema zoals het Pedestal/Showcase UI in PropShowcase — dezelfde `#1a1a2e` achtergronden, cyan/gold glows
- **Bots zijn heilig**: Bots kunnen nooit geselecteerd/verplaatst worden via de Prop Browser — alleen via de bestaande bot-interface

---

## 2. User Flow — Happy Path

### Scenario: Nicky wil een 'Bookshelf' toevoegen aan de Dev Room

```
Stap 1: WORLD VIEW — normale 3D wereld
  └─ Nicky ziet zijn CrewHub campus in isometrisch aanzicht
  └─ Rechtsboven: kleine toolbar met [Creator Mode toggle]
  └─ Het icoon toont een penseel/wrench icoon (✏️ of 🔧)

Stap 2: CREATOR MODE ACTIVEREN
  └─ Nicky klikt op de Creator Mode toggle (of drukt [E])
  └─ Visuele feedback: de wereld-rand krijgt een subtiele goudkleurige outline
  └─ Tooltip verschijnt: "Creator Mode actief — klik een prop om te plaatsen"
  └─ De toolbar breidt uit: [Prop Browser] knop verschijnt, [Undo] [Redo] knoppen

Stap 3: PROP BROWSER OPENEN
  └─ Nicky klikt [Prop Browser] (of drukt [B])
  └─ Browser schuift in als zijpaneel vanuit de rechterkant (slide-in animatie)
  └─ Breedte: ~320px op desktop, niet-blokkerend (wereld blijft zichtbaar)

Stap 4: ZOEKEN/BLADEREN
  └─ Browser opent standaard op "Alle Props", gesorteerd op naam
  └─ Nicky typt "book" in de zoekbalk → direct gefilterd: "Bookshelf" verschijnt
  └─ Of: Nicky klikt tab "Meubels" → ziet alle meubel-props in grid view
  └─ Thumbnail: 3D isometrisch mini-render van de prop (of fallback kleur-blok)

Stap 5: PROP SELECTEREN
  └─ Nicky klikt op "Bookshelf" thumbnail in de browser
  └─ Prop thumbnail krijgt highlight (gold border)
  └─ Status bar onderaan browser: "Bookshelf geselecteerd — klik in een kamer om te plaatsen"
  └─ De cursor in de 3D wereld verandert naar een "crosshair + mini bookshelf" ghost

Stap 6: PLAATSEN IN DE WERELD
  └─ Nicky beweegt muis over de Dev Room
  └─ Ghost-preview van de Bookshelf volgt de cursor, snapt aan het grid (grid is 20×20)
  └─ Geldige cel: ghost is blauw/cyan
  └─ Bezette cel (bot, andere prop): ghost is rood, niet plaatsbaar
  └─ Nicky klikt op een vrije cel in de Dev Room
  └─ Bookshelf verschijnt met een korte "pop-in" animatie (scale 0 → 1, bounce)
  └─ SSE broadcast: andere viewers zien de prop live verschijnen

Stap 7: VERDER OF KLAAR
  └─ Na plaatsing blijft "Bookshelf" geselecteerd (snel meerdere exemplaren plaatsen)
  └─ Druk [Esc] of klik leeg gebied: deselecteer prop
  └─ Druk nogmaals [E] of klik toggle: Creator Mode uit
  └─ Goudkleurige outline verdwijnt, wereld is weer read-only
```

### Scenario: Prop verplaatsen

```
Stap 1: Creator Mode aan
Stap 2: Klik op een bestaande prop in de 3D wereld
  └─ Prop krijgt selectie-indicator (gold outline glow, klein context menu)
  └─ Context menu: [Verplaatsen] [Roteren] [Verwijderen]
Stap 3: Klik [Verplaatsen]
  └─ Prop "lift" zichtbaar op (float animatie, 0.3u omhoog)
  └─ Cursor wordt move-cursor
  └─ Prop volgt muis, snapt aan grid
Stap 4: Klik nieuwe locatie → prop zet neer (set-down animatie)
```

### Scenario: Prop verwijderen

```
Stap 1: Creator Mode aan
Stap 2: Klik op prop → context menu
Stap 3: Klik [Verwijderen]
  └─ Bevestiging: korte shake animatie + "Verwijderd" toast met [Undo] knop
  └─ Prop verdwijnt met dissolve/shrink animatie
  └─ Ctrl+Z: prop komt terug
```

---

## 3. UI Mockup Beschrijvingen

### 3.1 World Toolbar (altijd zichtbaar in 3D world)

**Positie:** Rechtsbovenhoek van de 3D canvas, verticale toolbar, zwevend boven de scene.

**Stijl:** Semi-transparant donker paneel (`rgba(10, 10, 30, 0.85)`), afgeronde hoeken, subtiele cyan border. Zelfde look als bestaande HUD-elementen.

**Inhoud (normale modus):**
```
┌──────────────┐
│  [🔧]        │  ← Creator Mode toggle (tooltip: "Creator Mode")
│  [🔍]        │  ← Camera presets / zoom
│  [⚙️]        │  ← World settings
└──────────────┘
```

**Inhoud (Creator Mode actief):**
```
┌──────────────┐
│  [✏️] ACTIEF │  ← Creator Mode toggle (gold kleur, pulserende glow)
│  ─────────── │
│  [📦]        │  ← Prop Browser openen (tooltip: "Prop Browser [B]")
│  [↩️]        │  ← Undo (grijs als geen history)
│  [↪️]        │  ← Redo
│  ─────────── │
│  [🗑️]        │  ← Verwijder geselecteerde prop
└──────────────┘
```

**Creator Mode indicator:**
- De buitenrand van het volledige canvas krijgt een subtiele goud/amber pulserende outline (box-shadow of CSS border-image)
- "CREATOR MODE" badge linksboven (klein, amber, semi-transparant)

---

### 3.2 Prop Browser Paneel (zijpaneel, slide-in rechts)

**Positie:** Rechts van de 3D canvas. Schuift in over de canvas (niet ernaast — het canvas verkleint niet). Breedte 340px.

**Stijl:** Donker thema — `#0d0d1a` achtergrond, `#1a1a2e` kaarten, cyan accenten (`#00ffcc`), gold selectie (`#ffd700`). Exact zelfde stijl als PropShowcase in Creator Zone.

**Header:**
```
┌────────────────────────────────────────┐
│ 📦 Prop Browser              [×] Sluit │
│ ──────────────────────────────────────│
│ [🔍 Zoek props...               ]      │
│ ──────────────────────────────────────│
│ [Alle] [Meubels] [Deco] [Tech] [...]  │ ← Categorie tabs, horizontaal scrollbaar
└────────────────────────────────────────┘
```

**Sub-tabs (boven de grid):**
```
[Vaste Props (47)] [Gegenereerde Props (24)] [⭐ Favorieten (3)] [🕐 Recent]
```

**Prop Grid (body):**
- 3 kolommen, kaart per prop
- Kaart grootte: ~90px × 110px
- Per kaart:
  - **Thumbnail**: 3D mini-render (Canvas snapshot) of kleurblok als fallback
  - **Naam**: klein, wit, 2 regels max (ellipsis)
  - **Categorie badge**: klein pill (bijv. "Meubel", "Tech")
  - **Hover**: subtiele glow, scale 1.05, tooltip met volledige naam
  - **Geselecteerd**: gold border, gold glow

```
┌──────┐ ┌──────┐ ┌──────┐
│ [3D] │ │ [3D] │ │ [3D] │
│Booksh│ │Desk  │ │Plant │
│elf   │ │      │ │      │
│Meubel│ │Meubel│ │Natuur│
└──────┘ └──────┘ └──────┘
```

**Footer (geselecteerde prop info):**
```
┌────────────────────────────────────────┐
│ 📦 Bookshelf                           │
│ Categorie: Meubels | Mount: Vloer      │
│ [⭐ Favoriet] [ℹ️ Details]             │
│                                        │
│ ▶ Klik in de wereld om te plaatsen    │
└────────────────────────────────────────┘
```

**Categorieën (op basis van bestaande props + showcase):**
- 🪑 **Meubels** — desk, chair, bookshelf, round-table, bean-bag, bench, standing-desk
- 💡 **Decoratie** — lamp, plant, easel, color-palette, hourglass, globe, rocket
- 🖥️ **Tech** — monitor, server-rack, control-panel, drawing-tablet, code-terminal, AI-brain
- 📡 **Comms** — satellite-dish, antenna-tower, headset, megaphone, signal-waves
- 📋 **Borden** — whiteboard, notice-board, mood-board, presentation-screen, bulletin-board
- ⚙️ **Machines** — coffee-machine, water-cooler, conveyor-belt, fire-extinguisher
- ✨ **Gegenereerd** — alle AI-gegenereerde props via PropMaker

---

### 3.3 Placement Ghost (in de 3D world tijdens plaatsing)

**Wat ziet de gebruiker:**
- Een semi-transparante (50% opacity) kopie van de geselecteerde prop zweeft onder de cursor
- De prop snapt aan het 20×20 grid
- Een subtiel grid overlay verschijnt op de vloer van de actieve kamer (grid lijnen in cyan, 20% opacity)

**Kleur-feedback:**
- **Vrije cel**: ghost heeft cyan glow, vloer-cel highlight in cyan
- **Bezette cel** (andere prop): ghost wordt rood, cel highlight rood — klikken heeft geen effect
- **Buiten kamer** (wandelen over de wereld): ghost heeft geen glow, cursor = 🚫

**Rotatie:**
- Tijdens placement: [R] roteer 90° (prop roteert met pop-animatie)
- Of: scroll wheel roteer

---

### 3.4 Prop Context Menu (na klikken op geplaatste prop)

**Trigger:** Klik op een prop in Creator Mode

**Stijl:** Klein popup menu, donker thema, verschijnt ter hoogte van de prop (Html overlay via React Three Fiber `<Html>`)

```
┌─────────────────┐
│ 📦 Bookshelf    │
│ ─────────────── │
│ [↔️] Verplaatsen│
│ [↩️] Roteren    │
│ [🗑️] Verwijderen│
│ [⭐] Favoriet   │
└─────────────────┘
```

**Gedrag:**
- Klik buiten: menu verdwijnt
- [Esc]: menu verdwijnt + deselecteer
- Verwijderen: bevestiging via toast (niet modal — te disruptief)

---

### 3.5 Toast Notificaties

**Positie:** Linksonder in het canvas

**Stijl:** Donker pill-shaped, zelfde thema, fade-in/fade-out

```
[✓] Bookshelf geplaatst  [Undo]     ← groen, 3 seconden
[✗] Bookshelf verwijderd [Undo]     ← amber, 4 seconden
[↩️] Ongedaan gemaakt               ← blauw, 2 seconden
[⚠️] Cel bezet — kies een andere cel← rood, 2 seconden
```

---

### 3.6 Mobile/Tablet UI

**Prop Browser als Bottom Sheet:**

Trigger: [📦] knop in bottom-nav van de mobile layout

```
┌──────────────────────────────────────┐
│            ────                      │  ← drag handle
│ 📦 Prop Browser          [×]         │
│ [🔍 Zoek...              ]           │
│ [Alle][Meubels][Tech][Deco][...]      │
│ ────────────────────────────────────  │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐          │
│ │[3D]│ │[3D]│ │[3D]│ │[3D]│          │
│ │Book│ │Desk│ │Plan│ │Lamp│          │
│ └────┘ └────┘ └────┘ └────┘          │
│ ────────────────────────────────────  │
│ Geselecteerd: Bookshelf               │
│ [Plaatsen in huidige kamer]           │  ← Tap-to-place voor mobile
└──────────────────────────────────────┘
  ↑ half-screen height, swipeable omhoog naar fullscreen
```

**Mobile Creator Mode:**
- Geen hover, dus: tap prop in browser → browser klapt in → tap cel in wereld → prop geplaatst
- "Tap to place" knop in footer als fallback voor kleine schermen
- Geen drag & drop op mobile (te foutgevoelig op kleine schermen)
- Pinch-to-zoom en pan werken normaal door — prop placement via tap

---

## 4. Component Structuur

### Nieuwe Componenten

```
frontend/src/components/world3d/
├── creator/                          ← NIEUW: Creator Mode systeem
│   ├── CreatorModeProvider.tsx       ← Context: isCreatorMode, selectedPropId, history
│   ├── CreatorModeToggle.tsx         ← Toggle button + keyboard shortcut [E]
│   ├── CreatorModeOverlay.tsx        ← Canvas border glow + "CREATOR MODE" badge
│   ├── PropBrowser/
│   │   ├── PropBrowser.tsx           ← Hoofd zijpaneel container (slide-in panel)
│   │   ├── PropBrowserHeader.tsx     ← Zoekbalk + categorie tabs
│   │   ├── PropBrowserGrid.tsx       ← 3-koloms grid van prop kaarten
│   │   ├── PropCard.tsx              ← Individuele prop kaart met thumbnail
│   │   ├── PropThumbnail.tsx         ← Mini 3D render (Canvas in Canvas) of kleurblok
│   │   ├── PropBrowserFooter.tsx     ← Geselecteerde prop info + plaatsing hint
│   │   └── PropBrowserBottomSheet.tsx← Mobile bottom sheet wrapper
│   ├── Placement/
│   │   ├── PlacementGhost.tsx        ← Semi-transparante preview prop op cursor
│   │   ├── PlacementGrid.tsx         ← Grid overlay op kamer vloer tijdens placement
│   │   └── usePlacement.ts           ← Hook: raycasting, grid snap, geldigheid check
│   ├── PropContextMenu.tsx           ← Popup menu bij klik op bestaande prop
│   ├── PropToast.tsx                 ← Toast notificaties voor plaatsing/verwijdering
│   └── useCreatorHistory.ts          ← Undo/Redo stack voor prop acties
```

### Bestaande Componenten Aanpassen

```
world3d/grid/PropRegistry.ts
  + getAllPropsWithMeta()            ← uitgebreide lijst voor browser (name, category, tags)
  + getPropsByCategory(cat)         ← filter per categorie

world3d/World3DView.tsx
  + <CreatorModeProvider>           ← wrap hele world view
  + <CreatorModeOverlay>            ← canvas border indicator
  + Raycasting voor prop selectie   ← onClick op prop meshes

world3d/RoomProps.tsx (of equivalent)
  + onClick handler per prop mesh   ← mits Creator Mode actief
  + selectie state doorgeven        ← gold outline op geselecteerde prop
```

### State Architecture

```typescript
// CreatorModeContext
interface CreatorModeState {
  isActive: boolean
  selectedPropId: string | null       // prop uit browser geselecteerd voor placement
  selectedPlacedPropId: string | null // bestaande prop in world geselecteerd
  pendingRotation: number             // 0, 90, 180, 270
  history: PropAction[]               // voor undo/redo
  historyIndex: number
}

// PropAction (voor undo/redo)
type PropAction =
  | { type: 'PLACE'; roomId: string; propId: string; cellX: number; cellZ: number; rotation: number }
  | { type: 'REMOVE'; roomId: string; instanceId: string; snapshot: PlacedPropData }
  | { type: 'MOVE'; instanceId: string; from: Cell; to: Cell }
  | { type: 'ROTATE'; instanceId: string; from: number; to: number }

// PlacedProp (backend model, al bestaand als RoomProp)
interface PlacedPropData {
  instanceId: string   // unieke ID per geplaatste prop instantie
  propId: string       // bijv. "builtin:bookshelf" of "crewhub:abc123"
  roomId: string
  cellX: number
  cellZ: number
  rotation: number     // 0 | 90 | 180 | 270
  placedBy?: string    // userId / agentId
  placedAt?: string    // ISO timestamp
}
```

### PropRegistry Uitbreiding

```typescript
// Aanvullen: PropEntry krijgt UI metadata
export interface PropEntry {
  component: React.FC<PropProps>
  mountType: MountType
  yOffset: number
  // NIEUW:
  displayName?: string          // Leesbare naam bijv. "Bookshelf"
  category?: PropCategory       // 'furniture' | 'deco' | 'tech' | 'comms' | 'boards' | 'machines'
  tags?: string[]               // ['office', 'storage', 'tall']
  thumbnailColor?: string       // fallback kleur als geen 3D thumbnail beschikbaar
  span?: { w: number; d: number }  // grid span (default 1×1)
}

type PropCategory = 'furniture' | 'decoration' | 'tech' | 'comms' | 'boards' | 'machines' | 'generated'
```

---

## 5. Backend Requirements

### 5.1 Bestaande Endpoints (controleer of ze al bestaan)

Op basis van de matrix en architectuur zijn sommige mogelijk al aanwezig:

| Endpoint | Status | Beschrijving |
|----------|--------|--------------|
| `GET /api/rooms/{roomId}/props` | Waarschijnlijk ✅ | Geplaatste props ophalen voor een kamer |
| `POST /api/rooms/{roomId}/props` | Waarschijnlijk ✅ | Prop plaatsen in kamer |
| `DELETE /api/rooms/{roomId}/props/{instanceId}` | ✅ (Prop Delete v0.14.0) | Prop verwijderen |

### 5.2 Nieuwe Endpoints Nodig

```
PATCH /api/rooms/{roomId}/props/{instanceId}
  Body: { cellX?: number, cellZ?: number, rotation?: number }
  → Prop verplaatsen of roteren (voor move/rotate actions)
  Response: 200 { updatedProp: PlacedPropData }

GET /api/props/catalog
  → Geeft de volledige prop catalogus terug (builtin + gegenereerd)
  Response: { builtin: PropMeta[], generated: GeneratedPropMeta[] }
  PropMeta: { id, displayName, category, tags, mountType, thumbnailUrl? }

GET /api/props/generated
  → Alle AI-gegenereerde props van de huidige installatie
  → Geeft de code/parts terug zodat PropThumbnail kan renderen
  Response: { props: GeneratedProp[] }

GET /api/users/{userId}/prop-favorites
POST /api/users/{userId}/prop-favorites
DELETE /api/users/{userId}/prop-favorites/{propId}
  → Favorieten beheren per gebruiker (nice-to-have)

GET /api/users/{userId}/prop-recents
  → Recent gebruikte props voor "Recent" tab (nice-to-have)
```

### 5.3 SSE Broadcasting

Prop plaatsingen moeten live zichtbaar zijn voor alle viewers:

```python
# Backend: broadcast naar alle SSE listeners van de world

# Event type (nieuw, naast bestaande session_update / meeting_update etc.):
{
  "event": "prop_update",
  "data": {
    "action": "placed" | "removed" | "moved" | "rotated",
    "roomId": "dev-room",
    "prop": PlacedPropData
  }
}
```

**Frontend:**
```typescript
// In useWorldStream (of bestaande SSE hook):
case 'prop_update':
  dispatchPropAction(event.data)
  break
```

### 5.4 Permissies

Toegangscontrole voor Creator Mode (zie ook Open Vragen):

```python
# Middleware check op prop CRUD endpoints:
async def require_prop_edit_permission(current_user):
    if not current_user.is_admin and not current_user.can_edit_world:
        raise HTTPException(403, "Alleen admins mogen props plaatsen")
```

Voorstel permissiemodel:
- **Admin** (Nicky): volledige toegang — plaatsen, verplaatsen, verwijderen
- **Bot-accounts**: nooit props kunnen aanpassen (read-only world for bots)
- **Toekomstig**: per-kamer permissies of "room owner" concept

---

## 6. Prioritering — MVP vs Nice-to-Have

### 🟢 MVP (v0.18.0 of v0.19.0 — zo snel mogelijk bruikbaar)

**Creator Mode kern:**
- [ ] Creator Mode toggle (knop + keyboard shortcut [E])
- [ ] Canvas border indicator (gold glow) als visuele feedback
- [ ] Prop Browser zijpaneel (slide-in rechts)
- [ ] Prop Grid met 3-koloms layout, klikbare kaarten
- [ ] Zoekbalk (naam-filter)
- [ ] Twee tabs: "Vaste Props" en "Gegenereerde Props"
- [ ] Placement Ghost (semi-transparante preview bij cursor)
- [ ] Grid snapping (props snappen aan bestaand 20×20 grid)
- [ ] Groen/rood feedback voor vrij/bezet cel
- [ ] Klikken om prop te plaatsen
- [ ] Verplaatsen van bestaande prop (click → move → click)
- [ ] Verwijderen van prop (click → context menu → delete)
- [ ] Undo/Redo (Ctrl+Z / Ctrl+Y), minimaal 20 stappen
- [ ] SSE broadcast zodat andere viewers live updates zien
- [ ] Rotatie tijdens placement ([R] key of scroll)
- [ ] Toast feedback bij plaatsen/verwijderen

**Categorie-navigatie (vereenvoudigd MVP):**
- [ ] Categorieën als filter-tabs (Meubels, Tech, Deco, Comms, Borden, Machines)
- [ ] Kleurblok fallback thumbnails (geen echte 3D thumbnails in MVP)

**Permissies MVP:**
- [ ] Alleen admin (isAdmin flag) kan Creator Mode activeren
- [ ] Voor niet-admins: toggle knop is verborgen of disabled

---

### 🟡 Nice-to-Have (v0.19.0 – v0.20.0)

**Betere Thumbnails:**
- [ ] 3D mini-renders per prop (offscreen Canvas, snapshot als dataURL)
- [ ] Thumbnail caching (localStorage of server-side)

**Extra Browser Features:**
- [ ] Favorietensysteem (ster per prop, persisteren in backend)
- [ ] "Recent gebruikt" tab (laatste 10 props)
- [ ] Tag-filter naast categorie
- [ ] Prop details popup (naam, categorie, gegenereerd door wie/wanneer)
- [ ] Sortering: A-Z, Categorie, Recent, Populair

**Verfijnde Creator Experience:**
- [ ] Pop-in animatie bij plaatsing (scale 0→1 met bounce)
- [ ] Dissolve-out animatie bij verwijdering
- [ ] "Lift" animatie bij verplaatsen (prop float 0.3u omhoog)
- [ ] Multi-select (Shift+klik meerdere props tegelijk verplaatsen/verwijderen)
- [ ] Prop inspector panel: positie/rotatie als getallen weergeven

**Mobile:**
- [ ] Bottom sheet layout voor Prop Browser op mobile
- [ ] Tap-to-place flow (browser → tap kamer → prop geplaatst)

**Gegenereerde Props Integratie:**
- [ ] Vanuit PropMaker: "Toevoegen aan kamer" knop na genereren
- [ ] Gegenereerde props tonen in browser zodra PropMaker klaar is

---

### 🔴 Toekomstig (v0.21.0+)

- [ ] Externe 3D API props (Meshy.ai) in de browser
- [ ] Per-kamer toegang (kamer "eigenaar" mag zijn kamer inrichten)
- [ ] Drag & drop vanuit browser naar world (complexe raycasting op drag)
- [ ] Multi-zone support (props plaatsen buiten kamers, op het "gras")
- [ ] Prop Library met ratings (geëvolueerd uit Design Showcase, al gepland in v0.18.0)
- [ ] Prop schaal aanpassen (0.5x – 2x)
- [ ] Eigen gecureerde "kamer presets" opslaan en laden
- [ ] Bot-navigation naar geplaatste props via spraakcommando's (al gepland v0.19.0: "walk to the coffee machine")

---

## 7. Open Vragen voor Nicky

> *Dit zijn beslissingen die jij moet nemen voordat we gaan bouwen.*

---

**V1: Wie mag Creator Mode gebruiken?**

*Opties:*
- A. Alleen admin (jij) — simpelste, veiligste, geen permissiesysteem nodig in MVP
- B. Iedereen die is ingelogd
- C. Per kamer: de "kamer eigenaar" of toegewezen rol

**Aanbeveling:** Start met A (alleen admin) voor MVP. Later uitbreiden.

---

**V2: Per kamer of globaal?**

Props worden geplaatst binnen een specifieke kamer. Maar mag je ook props buiten kamers plaatsen (op de wereld-vloer, het gras, de parkeerplaats)?

*Opties:*
- A. Alleen binnen kamer-grenzen (grid gebonden aan kamer)
- B. Ook buiten kamers (wereldcoördinaten)

**Aanbeveling:** A voor MVP — het grid systeem werkt al per kamer.

---

**V3: Prop Browser — floating panel of zijpaneel?**

*Opties:*
- A. **Zijpaneel** (slide-in rechts, 340px breed, canvas blijft zichtbaar maar kleiner)
- B. **Floating panel** (zweeft over de canvas, kan versleept worden)
- C. **Fullscreen overlay** (canvas tijdelijk verborgen — minst goed voor UX)

**Aanbeveling:** A (zijpaneel) op desktop, Bottom Sheet op mobile.

---

**V4: 3D Thumbnails in de browser — ja of nee voor MVP?**

3D mini-renders per prop zijn mooi maar complex (offscreen Canvas per prop).

*Opties:*
- A. Start met kleurblokken (thumbnailColor uit PropEntry) — snel te bouwen
- B. Direct 3D thumbnails — mooier maar meer werk
- C. 2D gekleurde silhouet SVGs per prop — middenweg

**Aanbeveling:** A voor MVP, B voor v1.1. De kleurblokken met goede labels zijn al bruikbaar.

---

**V5: Drag & Drop of Click-to-Place?**

*Opties:*
- A. **Click-to-place**: klik prop in browser → prop "kleeft" aan cursor → klik in wereld
- B. **Drag & drop**: sleep prop vanuit browser naar wereld (werkt slecht over canvas grens)
- C. **Beide**: drag vanuit kaart óf klik om te selecteren

**Aanbeveling:** A voor MVP — drag & drop over canvas grens is technisch lastig (mouseup outside canvas verliest het event). Click-to-place is ook intuïtiever voor precisie-plaatsing.

---

**V6: Room Focus Mode interactie**

Bestaand systeem: klikken op een kamer "fly-to" (Room Focus Mode, camera zoomt in).

In Creator Mode: klikken op een kamer = plaatsen, niet fly-to.

*Opties:*
- A. Creator Mode **schakelt Room Focus Mode tijdelijk uit** — click = placement, niet fly-to
- B. Twee stappen: eerst fly-to de kamer (via knop of dubbelklik), dan plaatsen
- C. Creator Mode werkt alleen in de al-gefocuste kamer

**Aanbeveling:** A — simpelste UX. In Creator Mode overrides placement het fly-to. Tooltip verduidelijkt dit.

---

**V7: Moet Undo/Redo ook gesynchroniseerd worden via SSE?**

Als Nicky een prop plaatst en dan Undo doet, moeten andere kijkers ook de prop zien verdwijnen.

*Opties:*
- A. Ja — Undo/Redo stuurt ook PATCH/DELETE naar de API → SSE broadcast
- B. Nee — Undo/Redo is client-only, alleen bij page refresh correct

**Aanbeveling:** A — anders krijg je inconsistente state tussen viewers.

---

**V8: Gegenereerde props — altijd beschikbaar of per project?**

PropMaker slaat gegenereerde props op. In de Prop Browser tab "Gegenereerde Props":

*Opties:*
- A. **Alle gegenereerde props** van de hele CrewHub installatie
- B. Alleen props **uit het actieve project**
- C. Met toggle: "Dit project" / "Alle"

**Aanbeveling:** A voor MVP (eenvoudig), C voor later als de prop-library groeit.

---

*Einde design document.*
*Geschreven door Flowy — 2026-02-24*
*Klaar voor review door Nicky en TechLead*
