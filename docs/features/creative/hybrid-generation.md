# Hybrid Generation

Combine AI creativity with template-quality results.

## Modes

### Standard AI
The default mode. AI generates the entire prop from scratch based on your description.

### Hybrid: Template-Based
Start from a showcase prop template and let AI modify it for your concept.

**Example:** Select "Coffee Machine" template + prompt "tea kettle" → Gets the quality structure of the coffee machine adapted to a tea kettle.

### Hybrid: Enhanced AI
No template selected in hybrid mode. AI generates from scratch but with explicit quality requirements injected into the prompt (showcase-grade patterns).

## How To Use

1. In the Generate tab, set **Mode** to "Hybrid"
2. Optionally select a **Base Template**
3. Enter your description
4. Click Create

## Template Selection Guide

| If your prop is... | Use template... |
|---------------------|-----------------|
| A machine/appliance | Coffee Machine, Water Cooler |
| A vehicle | Spaceship |
| Furniture | Desk, Chair, Bench |
| A light source | Lamp |
| Electronics | Monitor |
| Nature/organic | Plant |
| Decorative | Notice Board |

## API

```
POST /api/creator/props/hybrid-generate
{
  "prompt": "steampunk tea kettle",
  "templateBase": "coffee-machine",
  "model": "sonnet-4-5"
}
```

## Quality Comparison

| Method | Typical Score | Speed |
|--------|--------------|-------|
| Standard AI | 50-75 | Fast |
| Enhanced AI (hybrid, no template) | 70-85 | Medium |
| Template-based hybrid | 80-95 | Medium |
| Template + iteration | 85-100 | Slower |
