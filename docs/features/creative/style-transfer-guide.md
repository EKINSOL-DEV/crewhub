# Style Transfer Guide

Apply visual styles from showcase props to any generated prop.

## Available Styles

| Style | Palette | Best For |
|-------|---------|----------|
| Coffee Machine | Warm browns, copper, gold | Mechanical/industrial props |
| Spaceship | Grey, blue, cyan accents | Sci-fi/tech props |
| Desk | Natural wood tones | Furniture/organic props |
| Lamp | Yellow glow, grey base | Light-emitting props |
| Monitor | Dark body, bright screen | Electronic/screen props |
| Plant | Greens, brown pot | Natural/organic props |
| Water Cooler | Clean grey/blue | Appliance/utility props |
| Chair | Muted blue-grey | Simple furniture |
| Notice Board | Cork + colorful notes | Decorative/busy props |
| Bench | Wood + metal | Outdoor/simple props |

## How To Use

### In the UI
1. Generate a prop
2. Go to the **Advanced** tab
3. Select a style from the dropdown
4. Preview the color palette
5. Click **Apply Style**

### Via API
```
POST /api/creator/props/style-transfer
{
  "code": "<component code>",
  "styleSource": "coffee-machine",
  "componentName": "MyProp"
}
```

## What Gets Transferred
- **Color palette** — Colors are replaced with the style's palette
- **Material approach** — Toon vs standard material usage
- **Animation style** — Matching animation patterns
- **Detail density** — Number of decorative elements

## Tips
- Style transfer works best on props with 5+ mesh elements
- The structure/shape is preserved — only visuals change
- Combine with iteration: apply style, then refine details
- Quality score typically stays 85+ after transfer
