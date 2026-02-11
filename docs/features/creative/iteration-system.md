# PropMaker Iteration System

Refine your generated props using natural language feedback.

## How It Works

After generating a prop, you can iteratively improve it by describing what you want changed. The AI will apply targeted modifications while preserving the overall structure.

## Supported Feedback Types

### 🎨 Color
- "Make it more colorful"
- "Use blue instead of red"
- "Neon colors"
- "Warmer palette"

### 📐 Size
- "Make it taller"
- "Scale down the base"
- "Make it wider"
- "More compact"

### ✨ Details
- "Add blinking lights"
- "Add steam effect"
- "More detail on the surface"
- "Add LED indicators"

### 🎬 Animation
- "Make it spin faster"
- "Add pulsing glow"
- "Make it float"
- "Add bobbing motion"

### 🎭 Style
- "Make it more futuristic"
- "Make it simpler"
- "Steampunk style"
- "More organic"

## Usage

1. Generate a prop using the standard or hybrid mode
2. View the quality score
3. Type feedback in the "Refine" input
4. Press Enter or click ✨
5. Review the improved version
6. Repeat until satisfied

## Tips

- Each iteration typically improves quality by 10-20 points
- You can rollback to any previous version using ↩️
- Combine multiple feedback types: "Make it more colorful and add blinking lights"
- Check the quality score suggestions for specific improvements
- Iteration preserves the component structure — only targeted changes are applied

## API

```
POST /api/creator/props/iterate
{
  "code": "<current component code>",
  "feedback": "make it more colorful",
  "componentName": "MyProp"
}
```

Returns: `{ code, feedbackType, qualityScore }`
