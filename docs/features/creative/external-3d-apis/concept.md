# External 3D Generation APIs - Concept

**Version**: v0.17.0 (Planned)
**Status**: 📋 Design phase
**Category**: Creative & Customization

---

## Overview

Integration with external 3D model generation services (Meshy.ai, etc.) as an alternative or fallback to AI code generation. Provides higher-quality, more consistent 3D models when AI-generated TSX code fails or produces poor results.

---

## Current Limitations (v0.13.0)

- AI generates TSX code with Three.js primitives (boxes, cylinders, spheres)
- **Orientation issues** - complex spatial reasoning is challenging even for Opus
- **Limited geometry** - only basic Three.js primitives available
- **No organic shapes** - can't generate complex curves, detailed meshes
- **Trial-and-error** - may need multiple regenerations to get it right

---

## External Services Research

### Meshy.ai
- **Website**: https://www.meshy.ai/pricing
- **Pricing**:
  - Free tier: 200 credits
  - Pro: $16/month (1000 credits)
  - Max: $32/month (3000 credits)
- **Capabilities**:
  - Text-to-3D generation
  - Image-to-3D generation
  - 3D texture generation
  - API available
- **Output formats**: GLB, FBX, USDZ, OBJ
- **Generation time**: ~2-3 minutes per model

### Alternatives
- **Tripo AI** - Similar text-to-3D service
- **Luma AI** - High-quality 3D generation
- **Stability AI 3D** - Stable Diffusion for 3D
- **OpenAI Shap-E** - Text-to-3D (research project)

---

## Integration Strategy

### Hybrid Approach
1. **Primary path**: AI-generated TSX code (fast, free, real-time preview)
2. **Fallback/Alternative**: External API (high quality, slower, costs credits)

### User Flow
```
User enters prompt → PropMaker
    ↓
[Generate] button clicked
    ↓
Try AI generation first (current behavior)
    ↓
    ├─ Success → Show preview
    └─ Fail or poor quality
        ↓
        [Try External API?] button appears
        ↓
        User clicks → Send to Meshy.ai
        ↓
        Show "Generating (2-3 min)..." status
        ↓
        Receive GLB model
        ↓
        Convert to Three.js component
        ↓
        Show preview + Save
```

### Technical Implementation

**Backend changes**:
- Add Meshy.ai API integration (`backend/services/meshy.py`)
- Store API key in settings
- Track credit usage
- Download and cache GLB files
- Convert GLB → Three.js JSX (via React Three Fiber GLTFLoader)

**Frontend changes**:
- "Use External API" toggle or button
- Loading state (2-3 min wait time)
- Credit usage display
- Model quality comparison (AI vs API)

**Cost management**:
- Track credits per user/session
- Warn when credits low
- Allow users to bring their own API key
- Implement caching (same prompt → reuse model)

---

## GLB to TSX Conversion

Challenge: External APIs return GLB/GLTF files, not TSX code.

**Option A: Direct GLTF rendering**
```tsx
import { useGLTF } from '@react-three/drei'

export function GeneratedProp({ position = [0, 0, 0] }) {
  const { scene } = useGLTF('/models/prop-abc123.glb')
  return <primitive object={scene} position={position} />
}
```

Pros: Simple, preserves all details
Cons: Larger file size, not editable, not compatible with PARTS_DATA system

**Option B: Mesh extraction + simplification**
- Parse GLB geometry
- Extract meshes
- Approximate with Three.js primitives (best-fit boxes/cylinders/spheres)
- Generate TSX code

Pros: Editable, smaller, consistent with current system
Cons: Loss of detail, complex conversion logic

**Preferred**: Start with Option A (direct GLTF), add Option B later for optimization.

---

## Pricing Model

**Per-generation cost**:
- Meshy.ai: ~2-5 credits per model (varies by complexity)
- Pro plan: $16/month = 1000 credits = ~200-500 models
- Cost per model: ~$0.03-$0.08

**User options**:
1. **Free tier**: 5 API generations per month (CrewHub provides credits)
2. **Bring your own key**: Users can add their own Meshy.ai API key
3. **Premium**: Buy credit packs (future)

---

## Implementation Phases

### Phase 1: Research & POC (v0.17.0)
- Test Meshy.ai API with sample prompts
- Compare quality vs AI-generated TSX
- Measure generation time and cost
- Build prototype integration

### Phase 2: Integration (v0.17.0)
- Backend API client
- Frontend "Use External API" option
- GLB file handling and caching
- Credit tracking

### Phase 3: Optimization (v0.18.0+)
- GLB → TSX conversion (mesh extraction)
- Model simplification
- Automatic quality detection (use API only when needed)
- Multiple service support (Meshy + alternatives)

---

## Success Metrics

- **Quality improvement**: Subjective rating of generated props
- **Orientation accuracy**: % of props with correct spatial orientation
- **First-attempt success**: Reduce regeneration rate
- **Cost efficiency**: Average cost per successful prop
- **User satisfaction**: Survey feedback

---

## Risks & Mitigations

**Risk**: External API is slow (2-3 minutes)
**Mitigation**: Keep AI generation as default, API as opt-in

**Risk**: Cost adds up with heavy usage
**Mitigation**: Credit limits, user-provided keys, caching

**Risk**: GLB files are large
**Mitigation**: Compression, CDN storage, mesh simplification

**Risk**: Generated models don't match CrewHub aesthetic
**Mitigation**: Style fine-tuning, post-processing, fallback to AI

---

## Future Extensions

- **Hybrid generation**: AI generates structure, API adds details
- **Style presets**: Toon-shaded, realistic, low-poly, etc.
- **Multi-view consistency**: Generate front/side/top views
- **Animation support**: Animated props (spinning, opening, etc.)
- **Texture customization**: Swap colors/materials on API-generated models

---

## Related Work

- v0.13.0: PropMaker with AI code generation
- v0.14.0: PropMaker AI streaming
- v0.16.0: Prop Library (baseline templates)
- v0.17.0: External 3D APIs (this feature)
- Future: Hybrid AI+API generation

---

*Created: 2026-02-11*
*Last updated: 2026-02-11*
