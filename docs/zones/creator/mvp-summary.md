# Creator Zone MVP — Summary

## What Was Built

The Creator Zone is a dedicated 3D room in CrewHub where users can generate custom props using natural-language prompts. The MVP delivers an end-to-end flow: describe → generate → preview → save → display.

### Core Components

| Component | Path | Purpose |
|-----------|------|---------|
| **PropMakerMachine** | `zones/creator/PropMakerMachine.tsx` | Interactive sci-fi fabricator; hosts the prompt dialog, generation logic, and preview integration |
| **DynamicProp** | `zones/creator/DynamicProp.tsx` | Renders a prop from a `PropPart[]` array — each part is a primitive (box, sphere, cylinder, cone) with position, scale, rotation, and material |
| **PreviewPanel** | `zones/creator/PreviewPanel.tsx` | Floating 3D preview canvas next to the machine; shows the generated prop with approve/regenerate controls |
| **PropShowcase** | `zones/creator/PropShowcase.tsx` | Gallery wall that loads saved props from the API and displays them on pedestals |
| **PropMakerRoom** | `zones/creator/PropMakerRoom.tsx` | Room layout that places the machine, showcase, and environment |
| **parsePropsFromOutput** | `lib/creator/parsePropsFromOutput.ts` | Parses AI text responses, extracts TSX code blocks, validates Three.js imports and PropProps interface |
| **propSaver** | Backend `/api/creator/props` | REST endpoints (GET/POST/DELETE) to persist generated props |

### Supporting Code

- **usePropMovement** (`hooks/usePropMovement.ts`) — Long-press selection, keyboard (arrow keys) and mouse-drag movement for placed props. Exposes global state (`getIsPropBeingMoved`, `getIsPropBeingDragged`) so camera controls can yield during interaction.

## Architecture

```
User prompt
    │
    ▼
PropMakerMachine (dialog)
    │
    ├─► Template-based generator (built-in)
    │   Converts prompt → PropPart[] using shape heuristics
    │
    └─► AI prompt (optional, via /api/creator/generate)
        Returns TSX code → parsePropsFromOutput → PropPart[]
    │
    ▼
PreviewPanel ← DynamicProp renders parts
    │
    ▼  (user approves)
propSaver API → saved to DB / filesystem
    │
    ▼
PropShowcase gallery
```

**Key design decision:** Props are defined as arrays of `PropPart` objects (primitive type + transform + material), not raw TSX components. This makes them serializable, safe to store, and trivial to render without `eval`.

## Features

- **Interactive machine** — hover glow, click to open, sci-fi aesthetic with toon shading
- **Example prompts** — dropdown with curated prompts that are known to produce good results
- **Live preview** — generated prop renders on a floating panel; user can inspect before committing
- **Approve / Regenerate** — explicit flow so bad generations don't pollute the gallery
- **Save to gallery** — persists prop definition via REST API; appears in PropShowcase
- **Prop movement** — long-press any placed prop to select it, then drag or use arrow keys to reposition; camera controls are disabled during movement

## Prop Movement System

The `usePropMovement` hook implements:

1. **Long-press detection** (600 ms threshold) to distinguish click from select
2. **Keyboard movement** — arrow keys move selected prop on the grid; Escape deselects
3. **Mouse drag** — pointer-down on a selected prop starts drag; pointer-move updates position via raycasting against the ground plane; pointer-up commits
4. **Global state flags** — `_isPropBeingMoved`, `_isPropBeingDragged`, `_isLongPressPending` prevent camera controllers from capturing input during prop interaction
5. **API sync** — on drop, sends updated position to the backend

## Known Limitations

- **Primitive-only geometry** — props are composed of boxes, spheres, cylinders, and cones. No mesh imports, no complex organic shapes.
- **No animation** — generated props are static. Animations (spin, bob, glow pulse) are not yet supported in the parts schema.
- **Template generator only** — the AI code-generation path (`parsePropsFromOutput`) is implemented but the template path is the primary generator in the MVP.
- **No undo** — deleting a prop from the gallery is permanent.
- **Single-user** — no collaboration or prop sharing between users.
- **Preview lighting** — preview panel lighting may differ from the room, so colors can look slightly different after placement.

## Cool Props to Try

Here are some prompts that produce great results with the Prop Maker:

| Prompt | What You Get |
|--------|-------------|
| A glowing mushroom lamp | Bioluminescent cap with emissive spots on a wooden stem |
| A steampunk gear clock | Brass gears, clock face, and industrial housing |
| A floating crystal orb | Translucent crystal hovering above a stone pedestal |
| A retro arcade cabinet | Colorful cabinet with screen, joystick, and buttons |
| A neon "OPEN" sign | Glowing text panel with wall mount bracket |
| A tiny robot figurine | Boxy body with antenna, arms, and glowing eyes |
| A campfire with logs | Crossed log cylinders with emissive flame cones |
| A golden trophy cup | Shiny metallic cup on a tiered base |
| A stack of colorful books | Three thin boxes in red, blue, and green |
| A wooden treasure chest | Box body with curved lid and metal band details |

💡 **Tips for best results:**
- Mention **colors and materials** ("blue metallic", "wooden", "glowing")
- Describe **shape and proportions** ("tall thin", "small round")
- Keep it **simple** — primitives work best for clear, recognizable objects
- Use the **Hybrid mode** with a template base for higher quality
- **Iterate** with feedback to refine — try "make it more colorful" or "add blinking lights"

## Next Steps

1. **Prop animations** — add an `animation` field to `PropPart` (rotate, float, pulse)
2. **AI code generation** — wire up the full AI path with safety sandboxing
3. **Prop sharing** — let users export/import prop definitions (JSON)
4. **Category/tags** — organize the gallery by type
5. **Multi-part editing** — let users tweak individual parts (color, size) after generation
6. **Sound effects** — fabrication sounds, placement sounds
7. **Undo/history** — track prop changes for rollback
