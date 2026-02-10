# Blog vs Website Alignment Review
Date: 2026-02-10

## Issue 1: "What We Built" Ordering

### Current order in blog:
1. Agent Persona Tuning
2. Task Management
3. Zen Mode
4. Modding System
5. Room Projects
6. Prop Drag & Drop

### Problem
The ordering leads with **Agent Persona Tuning** — a niche customization feature — instead of the flagship visual/spatial features that make CrewHub unique. The website homepage leads with **3D World View**, then **Room Organization**, then **Project Rooms**. The blog should mirror this "wow factor first" approach.

Additionally, features aren't grouped by category — it mixes UX features (Zen Mode), organizational features (Room Projects, Task Management), and customization features (Persona Tuning, Modding) randomly.

### Recommended new order:

```markdown
### ✅ Shipped This Week
- **Room Projects** — Organize agents by project, HQ command center for full overview
- **Task Management** — Visual Kanban boards embedded in 3D rooms  
- **Zen Mode** — Distraction-free focus mode with multi-tab workspaces
- **Agent Persona Tuning** — Customize how agents behave (autonomous vs. cautious, detailed vs. concise)
- **Modding System** — Editable templates (JSON blueprints) for custom props and rooms
- **Prop Drag & Drop** — Fixed edge cases, camera now stays still during prop movement
```

**Rationale:**
1. **Room Projects** first — core organizational feature, matches website hero messaging ("rooms with project context")
2. **Task Management** second — high-impact productivity feature, Kanban is universally understood
3. **Zen Mode** third — unique differentiator, appeals to power users
4. **Persona Tuning** fourth — nice customization, but not the first thing new users care about
5. **Modding System** fifth — advanced/community feature
6. **Prop Drag & Drop** last — bug fix/polish, lowest impact

---

## Issue 2: Feature Coverage Comparison

### On website but NOT in blog:
| Website Feature | Notes |
|---|---|
| **3D World View** | Mentioned in blog intro section but not in "What We Built" — fair, it was built before this week |
| **Real-time Monitoring (SSE)** | Website has dedicated card; blog doesn't mention it |
| **Agent Chat** | Website highlights chat + thinking mode; blog doesn't mention |
| **Multi-level Zoom** | Website feature card; not in blog |
| **Themes & Environments** | 4 environments, floor/wall styles — not mentioned |
| **Stats & Cost Tracking** | Token usage, cost estimation — not mentioned |
| **Backup & Restore** | Full DB backup — not mentioned |
| **Agent Bios** | AI-generated bios — not mentioned |
| **Show Thinking Mode** | Dedicated website card — not mentioned |

### In blog but NOT on website (as shipped features):
| Blog Feature | Notes |
|---|---|
| **Agent Persona Tuning** | Not a dedicated website feature card — could be merged with Agent Bios card |
| **Prop Drag & Drop improvements** | Too granular for website, fine to skip |

### In-progress items alignment:
| Blog "In Progress" | Website equivalent |
|---|---|
| Creator Zone MVP | ✅ Matches "Modding & World Packs" roadmap card |
| Zones Groundwork | ✅ Matches "Multi-World" roadmap card |

**Recommendation:** The blog doesn't need to list every feature (it's a weekly update), but consider adding a one-liner like: *"Plus ongoing improvements to real-time monitoring, agent chat, and cost tracking."* This signals the breadth of work without listing everything.

---

## Issue 3: Tone Consistency

### Blog tone: ✅ Good
- Friendly, non-technical ("watching your AI agents work shouldn't feel like reading server logs")
- Uses "you" and "we" naturally
- Good balance of features and vision

### Website tone: ✅ Mostly aligned
- Also friendly and visual-first
- Good use of taglines ("This is what makes CrewHub different →")
- Slightly more marketing-polished than the blog, which is expected

### Minor tone gap:
- Website uses "Play • Learn • Work" and "Getting real work done doesn't have to be boring" — very consumer/game-like
- Blog is more developer-focused ("If you're running multiple coding agents")
- **Recommendation:** Blog could benefit from the "Play • Learn • Work" framing to match the website's positioning as more than just a dev tool

---

## Issue 4: Roadmap Alignment

### Blog roadmap:
| Version | Blog says |
|---|---|
| v0.13.0 | Markdown viewer/editor, Creator Zone polish |
| v0.14.0 | Spatial awareness research, Stand-up meetings |
| v0.15.0 | HQ visual redesign |
| v0.16.0 | Full zones system (Academy + Game Center) |
| v0.17.0+ | Voice chat, Agent Teams support |

### Website roadmap items:
- Agent Academy & Game Mode → "In Development"
- Modding & World Packs → "Coming soon"
- Visual Room Editor → "In development"
- Plugin Marketplace → "Planned"
- Documentation Site → "In progress"
- Import / Export → "Coming soon"
- Multi-World → "Planned"
- Agent Teams → "In development"
- Voice Chat → "Planned"
- Local Model Support → "Planned"
- Zen Mode → "Alpha"
- Human Friendly → "In Development"

### Inconsistencies:
1. **Agent Academy** — Website says "In Development" + "Early Access in 2026", blog maps it to v0.16.0. These are aligned but the blog is more specific (good).
2. **Documentation Site** — Website says "In progress", blog doesn't mention it at all. Minor, but could add.
3. **Visual Room Editor** — Website says "In development", not in blog roadmap. Should it be?
4. **Local Model Support** — Website lists it as "Planned", blog doesn't mention. Fine for now.
5. **Zen Mode** — Blog lists as "Shipped", website lists as "Alpha" in roadmap section. **This is confusing** — if it shipped, move it from roadmap to features on the website, or clarify it's "Alpha" in the blog too.
6. **HQ visual redesign (v0.15.0)** — Blog mentions it but website doesn't have a roadmap card for it.

**Key fix:** Zen Mode status should be consistent — either "Shipped (Alpha)" in both places or keep in roadmap with "Alpha" label. Currently blog implies it's done, website implies it's upcoming.

---

## Issue 5: Specific Recommendations

### Blog post changes (priority order):

1. **Reorder "What We Built"** — Use the recommended order above (Room Projects → Task Management → Zen Mode → Persona Tuning → Modding → Prop Drag & Drop)

2. **Add "(Alpha)" to Zen Mode** — Match website labeling:
   ```
   - **Zen Mode (Alpha)** — Distraction-free focus mode with multi-tab workspaces
   ```

3. **Add breadth mention** after the shipped list:
   ```
   Plus continued work on real-time monitoring, agent chat, themes, and stats tracking.
   ```

### Website changes:

1. **Move Zen Mode** from roadmap section to features section (it's shipped, even if Alpha)
2. **Add Agent Persona Tuning** to the Agent Bios feature card or as its own card
3. **Add HQ redesign** to roadmap if it's actually planned for v0.15.0

---

## Summary

| Issue | Severity | Fix effort |
|---|---|---|
| Blog feature ordering | 🔴 High (Nicky's complaint) | 5 min — reorder list |
| Zen Mode status mismatch | 🟡 Medium | 5 min each file |
| Missing breadth mention in blog | 🟢 Low | 2 min — add one line |
| Website missing Persona Tuning | 🟢 Low | 10 min — add card |
| Roadmap gaps | 🟢 Low | Informational |
