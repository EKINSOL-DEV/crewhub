# Prop Library - Concept

**Version**: v0.16.0 (Planned)
**Status**: 📋 Design phase
**Category**: Creative & Customization

---

## Overview

A curated, self-improving library of 50-100+ prop templates that serves as a baseline for AI prop generation. Uses RAG (Retrieval-Augmented Generation) to inject relevant examples into the AI prompt based on semantic similarity to the user's request.

---

## Current Limitations (v0.13.0)

- **6 hardcoded examples** in prompt template
- AI generates everything from scratch
- **Inconsistent quality** - hit-or-miss orientations, complexity
- No learning from successful generations
- Limited variety in examples

---

## Proposed Solution

### 1. Prop Library Database
- **Location**: `backend/data/prop-library/`
- **Format**: JSON or TSX files with structured prop definitions
- **Categories**:
  - Furniture (desk, chair, shelf, table, lamp)
  - Electronics (computer, phone, monitor, keyboard)
  - Office (pen, notebook, stapler, coffee mug)
  - Kitchen (plate, cup, pot, utensils)
  - Nature (plant, flower, tree, rock)
  - Decorative (clock, picture frame, sculpture)
  - etc.

### 2. Semantic Search
- When user enters prompt: "a coffee mug"
- Search library for similar props: mug, cup, glass, teacup
- Return top 3-5 most relevant examples
- Inject into AI prompt context

### 3. Self-Improving System
- When user clicks "Approve & Save":
  - Prop gets saved to user's collection (current behavior)
  - **NEW**: Optionally add to shared library (with review/curation)
- Library grows organically from successful generations
- Community-driven prop templates

---

## Implementation Phases

### Phase 1: Library Infrastructure (v0.16.0)
- Create `prop-library/` folder structure
- Design JSON schema for prop templates
- Implement basic keyword-based search
- Seed library with 20-30 hand-curated props

### Phase 2: Semantic Search (v0.16.0)
- Implement embedding-based similarity search
- Integrate with AI prompt generation
- Test with various prompts to ensure quality improvement

### Phase 3: Self-Improvement (v0.17.0+)
- Add "Add to Library" button for approved props
- Implement curation/review system
- Track prop usage and success rates
- Auto-suggest library additions based on popular prompts

---

## Technical Details

### Prop Template Schema
```json
{
  "id": "coffee-mug-01",
  "name": "Coffee Mug",
  "category": "kitchen",
  "tags": ["mug", "cup", "drink", "coffee", "tea"],
  "description": "Simple coffee mug with handle",
  "code": "...",
  "parts": [...],
  "metadata": {
    "meshCount": 4,
    "complexity": "simple",
    "orientationQuality": "high",
    "usageCount": 142,
    "approvalRate": 0.89
  }
}
```

### Search Algorithm
1. Extract keywords from user prompt
2. Generate embedding vector (optional, for semantic search)
3. Find top-K similar props from library
4. Rank by relevance + approval rate
5. Inject into AI prompt as examples

### Prompt Integration
```
You are a React Three Fiber prop generator...

[System guidelines]

Here are similar props from the library for inspiration:

**Example A: Coffee Mug**
[code here]

**Example B: Tea Cup**
[code here]

Now generate a prop for: [user prompt]
```

---

## Benefits

- **Consistency**: Learn from proven successful props
- **Quality**: Better orientations, proportions, complexity
- **Speed**: Less trial-and-error, faster convergence
- **Variety**: Larger example pool
- **Self-improving**: Gets better with use
- **Community**: Users contribute back

---

## Success Metrics

- Approval rate increase (current: ~60-70%, target: >85%)
- First-attempt success rate
- Orientation accuracy (measured by user regeneration rate)
- Library growth rate
- User satisfaction scores

---

## Future Extensions

- **Style variants**: Modern, retro, minimalist, steampunk templates
- **Prop families**: Related props (desk → chair → lamp matching set)
- **User libraries**: Personal collections of favorite styles
- **Marketplace**: Share/sell custom prop packs
- **3D model import**: Convert existing .obj/.gltf to prop templates

---

## Related Work

- v0.13.0: PropMaker with 6 hardcoded examples
- v0.14.0: PropMaker AI streaming
- v0.16.0: Prop Library (this feature)
- Future: Prop marketplace, style variants

---

*Created: 2026-02-11*
*Last updated: 2026-02-11*
