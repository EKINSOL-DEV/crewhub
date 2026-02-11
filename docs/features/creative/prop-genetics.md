# Prop Genetics (Experimental)

Combine traits from multiple props to create unique hybrids.

## Concept

Like biological crossbreeding, Prop Genetics takes features from two "parent" props and combines them into an offspring with traits from both.

## How It Works

1. Select two parent props (their code)
2. Optionally specify which traits to inherit from which parent
3. The AI intelligently merges features

## Trait Types

- **structure** — Shape and geometry layout
- **color/palette** — Color scheme
- **animation** — Movement patterns
- **material** — Material choices (toon, standard, emissive)
- **detail** — Decorative elements (LEDs, particles)

## Example Combinations

| Parent A | Parent B | Result |
|----------|----------|--------|
| Coffee Machine | Spaceship | Coffee machine with engine-glow accents and hovering animation |
| Lamp | Plant | Bioluminescent plant with light-emitting flowers |
| Monitor | Crystal | Crystalline screen with prismatic glow effects |

## API

```
POST /api/creator/props/crossbreed
{
  "parentACode": "<component code>",
  "parentBCode": "<component code>",
  "parentAName": "CoffeeMachine",
  "parentBName": "Spaceship",
  "componentName": "CoffeeShip",
  "traits": ["structure from a", "colors from b", "animation from b"]
}
```

Returns: `{ code, name, parts, qualityScore, parents }`

## Tips

- Works best when parents have different strengths (one with great colors, one with great structure)
- The AI resolves conflicts intelligently — no crashes
- Offspring quality typically averages the parents' scores
- Try crossbreeding your best props for even better results!
