# Prop Editor - Concept

**Version**: v0.19.0 (Planned)  
**Status**: 📋 Design phase  
**Category**: Creative & Customization

---

## Overview

Manual editing UI for generated props. Allows users to tweak position, rotation, scale, colors, and individual mesh properties after AI generation, fixing issues that post-processing can't handle.

---

## Motivation

Even with:
- Improved prompts
- Post-processing auto-corrections
- Prop Library baselines
- External 3D APIs

Some props will still need manual tweaking. A visual editor empowers users to fix small issues without regenerating or editing TSX code.

---

## Core Features

### 1. Visual Property Inspector
- **Transform controls**: Position (X/Y/Z), Rotation (X/Y/Z), Scale
- **Per-mesh editing**: Select individual meshes in the prop
- **Color picker**: Change mesh colors
- **Material tweaks**: Emissive, metalness, roughness

### 2. Interactive 3D Manipulation
- **Gizmos**: Translate, rotate, scale handles (like Blender/Unity)
- **Snap to grid**: Optional grid snapping for precision
- **Undo/redo**: Full history of edits

### 3. Mesh-Level Editing
- **Add/remove meshes**: Add extra details or remove unwanted parts
- **Duplicate meshes**: Copy-paste geometry
- **Primitive picker**: Add boxes, cylinders, spheres, etc.

### 4. Live Preview
- Real-time updates in 3D preview
- See changes immediately
- Test in-room placement

### 5. Export Options
- **Save to collection**: Update the saved prop
- **Export TSX code**: Download the edited component
- **Create variant**: Save as a new prop based on the original

---

## User Flow

```
User generates prop → AI creates TSX
    ↓
[Preview shows prop]
    ↓
User clicks "Edit" button
    ↓
Prop Editor opens (modal or side panel)
    ↓
    ├─ Select mesh from hierarchy tree
    ├─ Adjust transform sliders/inputs
    ├─ Change colors with picker
    ├─ Add/remove meshes
    └─ See changes in real-time preview
    ↓
User clicks "Save Changes"
    ↓
Updated prop saved
    ↓
Can be placed in rooms
```

---

## UI Design

### Layout
```
┌─────────────────────────────────────────┐
│  [< Back]  Prop Editor: Coffee Mug      │
├─────────────┬───────────────────────────┤
│             │                           │
│  Hierarchy  │     3D Preview            │
│             │                           │
│  □ Root     │     [Interactive          │
│  └─□ Body   │      3D view with         │
│    □ Handle │      gizmos]              │
│    □ Rim    │                           │
│             │                           │
│             │                           │
├─────────────┼───────────────────────────┤
│  Properties │                           │
│             │                           │
│  Transform  │                           │
│  Position X [0.00] Y [0.50] Z [0.00]   │
│  Rotation X [0.00] Y [0.00] Z [0.00]   │
│  Scale    [1.00]                        │
│                                         │
│  Material                               │
│  Color    [#8B6238] 🎨                 │
│  Emissive [off]                         │
│                                         │
│  [Add Mesh ▼] [Duplicate] [Delete]     │
│                                         │
└─────────────────────────────────────────┘
│  [Cancel]  [Reset]  [Save Changes]     │
└─────────────────────────────────────────┘
```

---

## Technical Implementation

### Frontend (`PropEditor.tsx`)
```typescript
interface PropEditorProps {
  propData: PropPart[]
  onSave: (updated: PropPart[]) => void
  onCancel: () => void
}

export function PropEditor({ propData, onSave, onCancel }: PropEditorProps) {
  const [parts, setParts] = useState(propData)
  const [selectedPart, setSelectedPart] = useState<number>(0)
  
  // Transform gizmos with @react-three/drei
  // Property inspector with sliders/inputs
  // Hierarchy tree with mesh selection
  
  return (
    <div className="prop-editor">
      <MeshHierarchy parts={parts} onSelect={setSelectedPart} />
      <Canvas>
        <TransformControls object={parts[selectedPart]} />
        <DynamicProp parts={parts} />
      </Canvas>
      <PropertyInspector 
        part={parts[selectedPart]} 
        onChange={(updated) => updatePart(selectedPart, updated)}
      />
    </div>
  )
}
```

### Transform Gizmos
Use `@react-three/drei` TransformControls:
```tsx
import { TransformControls } from '@react-three/drei'

<TransformControls 
  object={meshRef.current}
  mode="translate" // or "rotate" or "scale"
  onObjectChange={(e) => handleTransform(e)}
/>
```

### State Management
- Each edit creates a history entry (undo/redo)
- Changes update PARTS_DATA in real-time
- Can regenerate TSX code from PARTS_DATA

---

## Challenges

### 1. TSX Code Generation
When user edits a prop, need to regenerate TSX code from PARTS_DATA.

**Solution**: Template-based code generation
```typescript
function generateTSX(parts: PropPart[]): string {
  return `
export function EditedProp({ position = [0, 0, 0], scale = 1 }) {
  ${parts.map(part => generateMeshCode(part)).join('\n')}
}
`
}
```

### 2. Complex Props
Props with custom logic (animations, conditional rendering) can't be edited easily.

**Solution**: 
- Mark "simple" vs "complex" props
- Only allow editing of simple props (pure PARTS_DATA)
- For complex props, offer "Regenerate" instead

### 3. Performance
Editing props with 50+ meshes might be slow.

**Solution**:
- LOD (Level of Detail) in editor
- Limit editor to props with <100 meshes
- Optimize with React.memo and selective re-renders

---

## Implementation Phases

### Phase 1: Basic Transform Editor (v0.19.0)
- Visual transform controls (position, rotation, scale)
- Per-mesh selection
- Color picker
- Save changes to collection

### Phase 2: Mesh Management (v0.20.0)
- Add/remove/duplicate meshes
- Primitive picker (add new boxes, cylinders, etc.)
- Undo/redo

### Phase 3: Advanced Features (v0.21.0+)
- Material editing (emissive, metalness, roughness)
- Texture support
- Snap to grid, align tools
- Keyboard shortcuts

---

## Success Metrics

- **Usage rate**: % of generated props that get edited
- **Edit time**: Average time spent in editor
- **Satisfaction**: User feedback on editor UX
- **Regeneration reduction**: Fewer "Regenerate" clicks after edits

---

## Related Work

- v0.13.0: PropMaker with AI generation
- v0.14.0: PropMaker AI streaming + post-processing
- v0.16.0: Prop Library
- v0.17.0: External 3D APIs
- v0.19.0: Prop Editor (this feature)

---

## Alternative: Code Editor

Instead of visual UI, provide a **code editor** for TSX:
- Monaco editor with TypeScript syntax highlighting
- Live preview on save
- Simpler to implement
- Power users can edit directly

**Hybrid approach**: Visual editor for simple tweaks, code editor for advanced users.

---

*Created: 2026-02-11*  
*Last updated: 2026-02-11*
