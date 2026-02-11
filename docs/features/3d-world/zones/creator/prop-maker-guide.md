# Prop Maker Guide

The Prop Maker Machine is the centerpiece of the Creator Zone. It lets you describe any 3D prop in plain English and generates it for your CrewHub world.

## How to Use

1. Navigate to the **Creator Zone** (use the Zone Switcher or click the zone in the 3D world)
2. Click the **glowing fabricator machine** in the center of the room
3. Type a description of the prop you want to create
4. Press **Enter** or click **Create**
5. Wait for the AI to generate your prop (the machine glows yellow while fabricating)
6. On success, you'll see a ✅ confirmation with the prop name

## Prompt Best Practices

### Be Specific
- ✅ "A steampunk brass clock with visible gears and a glowing blue face"
- ❌ "A clock"

### Mention Materials & Colors
- ✅ "A wooden bookshelf with dark oak finish"
- ❌ "A bookshelf"

### Describe Scale & Style
- ✅ "A small potted succulent, low-poly style"
- ❌ "A plant"

### Good Starting Prompts
- "A glowing mushroom lamp"
- "A steampunk gear clock"
- "A floating crystal orb"
- "A retro arcade cabinet"
- "A neon 'OPEN' sign"
- "A tiny robot figurine"

## How Props Are Saved

Generated props are:
1. Saved to the backend as `.tsx` component files
2. Registered in the **PropRegistry** under the `custom:` namespace
3. Available for placement in any room via the prop grid system

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Generation failed" error | Check that the backend is running on port 8091 |
| Prop doesn't appear after creation | Refresh the page — the prop registry may need to reload |
| Machine not clickable | Make sure you're in the Creator Zone and not in drag mode |
| Dialog not opening | Click directly on the machine mesh, not the surrounding area |

## Technical Details

- Props are stored in `frontend/src/components/world3d/props/custom/`
- Registry namespace: `custom:<kebab-name>`
- Mount types: `floor` (default) or `wall`
- Backend endpoint: `POST /api/creator/generate-prop`
