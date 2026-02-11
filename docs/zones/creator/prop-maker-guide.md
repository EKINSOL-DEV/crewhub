# Prop Maker Machine — User Guide

The Prop Maker Machine is an interactive fabricator in the Creator Zone that lets you describe a 3D prop in plain language and generates it in real time.

## How to Use

1. **Walk up to the machine** — it glows when you hover over it.
2. **Click it** to open the prompt dialog.
3. **Type a description** of the prop you want (e.g. "a red mushroom with white spots").
4. **Click Generate** — the machine sends your prompt to the AI backend, which returns a parts-based prop definition.
5. **Preview** — the prop appears on the preview panel next to the machine. Rotate and inspect it.
6. **Approve or Regenerate** — if you like it, click **Save to Gallery**. If not, click **Regenerate** or edit your prompt.
7. Your saved prop appears in the **Prop Showcase** gallery and can be placed in any room.

## Best Practices for Prompts

- **Keep it simple.** The generator builds props from basic 3D primitives (boxes, cylinders, spheres, cones). Describe shapes, not fine detail.
- **Mention colors and materials.** "A blue metallic cube" works better than just "a cube."
- **Describe size and proportions.** "A tall thin lamp" vs "a short wide table."
- **Use familiar objects.** The AI understands everyday items well: furniture, plants, food, tools, signs.
- **Avoid overly complex geometry.** Organic shapes (faces, animals) are approximated with primitives — results vary.

### Good Prompt Examples

| Prompt | Result |
|--------|--------|
| `a red mushroom with white spots` | Mushroom cap (sphere) + stem (cylinder) + spots |
| `a wooden treasure chest` | Box body + curved lid + metal bands |
| `a glowing crystal on a rock base` | Cone/octahedron crystal + rough sphere base + emissive material |
| `a small cactus in a terracotta pot` | Green cylinder with arms + brown pot |
| `a blue neon sign that says OPEN` | Flat panel + emissive text mesh |
| `a stack of three colorful books` | Three thin boxes in different colors |
| `a golden trophy cup` | Cylinder base + tapered cup shape |
| `a campfire with logs` | Crossed cylinders + orange emissive cone flames |

## Troubleshooting

### Generation fails / no response
- Check that the backend is running (`localhost:8091`).
- Check the browser console for network errors.
- The AI endpoint may be rate-limited — wait a moment and retry.

### Preview doesn't render / blank panel
- The generated parts may have invalid geometry. Click **Regenerate**.
- Check the console for Three.js errors (e.g. NaN positions).
- A render error message will appear on the preview panel if the component crashes.

### Prop looks wrong or too simple
- Rephrase your prompt with more specific shape/color descriptions.
- Try the **Example Prompts** dropdown for known-good prompts.
- The template-based generator uses primitives — don't expect photorealism.

### Save fails
- Ensure the backend API is reachable at `/api/creator/props`.
- Check disk space / permissions on the server.
- The prop name must be non-empty.

## Example Prompts (Quick Start)

Click the **Examples** button in the dialog to see these:

- A red mushroom with white spots
- A wooden treasure chest with metal bands
- A glowing blue crystal on a stone base
- A small potted cactus
- A retro arcade cabinet
- A stack of colorful books
- A golden trophy
- A campfire with logs
- A street lamp with a warm glow
- A mailbox with a red flag
