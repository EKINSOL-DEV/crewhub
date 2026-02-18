# CrewHub Mobile Design

**Created:** 2026-02-16  
**Status:** Draft Plan  
**Goal:** Mobile-friendly CrewHub with chat-first experience

## Vision

Desktop experience stays as-is (3D World, full features).  
Mobile experience focuses on **agent communication** with visual context.

---

## Mobile UX Flow

### 1. Agent Chat List (Home)
**Screen:** Scrollable list of available agents
- Avatar/icon per agent
- Agent name + status (active/idle/sleeping)
- Last activity preview
- Unread indicator (if messages from agent)

**Actions:**
- Tap agent → open chat view

### 2. Agent Chat View
**Layout:** Full-screen chat interface

**Top section:**
- Agent name + back button
- Mini 3D camera view of the agent (small viewport, live updates)
  - Shows agent bot in their current room
  - Simple orbit camera or fixed angle
  - Shows activity (working/idle/moving)

**Middle section (primary):**
- Chat messages (scrollable)
- Message bubbles (user vs agent)
- Timestamps

**Bottom section:**
- Text input field
- Send button
- Optional: voice input, attach files

**Features:**
- Pull-to-refresh for updates
- Live activity bubbles (what agent is doing)
- Camera can expand to larger view (tap to zoom)

### 3. Optional: Agent Overview
**Screen:** Visual grid of all agents with status
- Tap any → go to chat
- Quick status overview

---

## Technical Approach

### Responsive Design Strategy
```
Desktop (>= 1024px):
  - Full 3D World layout
  - All current features
  
Tablet (768-1023px):
  - Hybrid view (simplified 3D + side chat?)
  - OR: same as mobile
  
Mobile (< 768px):
  - Chat-first layout
  - Agent list → Agent chat
  - Mini 3D viewport per agent
```

### Implementation Plan

#### Phase 1: Mobile Detection & Layout Switch
- Add responsive breakpoints to frontend
- Create mobile layout components:
  - `MobileAgentList.tsx`
  - `MobileAgentChat.tsx`
  - `MobileAgentCamera.tsx`
- Route mobile users to chat-first view

#### Phase 2: Agent Chat List
- Fetch agents from API
- Display status, last activity
- Handle tap → navigate to chat

#### Phase 3: Agent Chat View
- Full chat UI (message history, input)
- SSE for live messages
- Send message API integration

#### Phase 4: Mini 3D Camera
- Isolated R3F Canvas with single bot
- Simple camera (fixed or orbit)
- Show agent in current room context
- Performance optimization (lower poly, smaller viewport)

#### Phase 5: Polish
- Animations/transitions
- Voice input support
- Notifications (PWA?)
- Offline state handling

---

## Tech Stack Considerations

### React Three Fiber (R3F) on Mobile
- **Challenge:** Performance on mobile devices
- **Solution:**
  - Lower poly count for mobile viewport
  - Smaller canvas size
  - Optional: skip 3D on very old devices, show static image instead

### Chat Backend
- Existing SSE works well
- Need chat history API per agent
- Session activity already available

### State Management
- Use existing Zustand/Context
- Add mobile-specific state (current chat agent, viewport size)

---

## UI Components Needed

### New Components
```
mobile/
  ├── MobileAgentList.tsx       # List of agents
  ├── MobileAgentChat.tsx        # Chat interface
  ├── MobileAgentCamera.tsx      # Mini 3D viewport
  ├── MobileLayout.tsx           # Overall mobile layout
  └── MobileNavBar.tsx           # Bottom nav (optional)
```

### Shared Components
- Reuse `Agent` types, API hooks
- Reuse R3F bot models (optimized)
- Reuse chat message rendering

---

## Key Design Decisions

### 1. Desktop vs Mobile: Separate UX or Unified?
**Decision:** Separate layouts, shared logic
- Desktop keeps rich 3D world experience
- Mobile optimizes for chat + context
- Shared: API, state, bot models

### 2. Mini Camera: Live 3D or Screenshot?
**Decision:** Live 3D (small viewport)
- More engaging
- Shows real-time activity
- Fallback to static image on perf issues

### 3. Chat History: Load all or paginate?
**Decision:** Paginate (load last 50, infinite scroll up)
- Better performance
- Mobile data-friendly

### 4. Mobile Navigation: Tabs or Stack?
**Decision:** Stack-based (agent list → chat)
- Simpler mental model
- Native-like experience
- Optional: bottom nav for future features

---

## Success Metrics

- Mobile users can chat with agents easily
- 3D camera provides context without overwhelming
- Performance: 60fps on mid-range phones (iPhone 12+, Android equiv)
- Chat latency: <500ms message send

---

## Future Enhancements

- **Multi-agent chat rooms** (group chat) — ✅ Confirmed gewenst door Nicky
- Push notifications (PWA)
- Voice chat on mobile
- Offline mode with sync
- Native app (React Native?)
- Landscape mode support (later)

---

## Open Questions — ANSWERED (2026-02-16)

1. **Should mobile users see all agents or just active ones?**  
   → *Not specified yet — default to all agents for now*

2. **Do we need multi-agent selection (group chat)?**  
   ✅ **Ja, dat zou echt tof zijn!** — Group chat feature gewenst

3. **Should camera be always-on or tap-to-enable?**  
   ✅ **Tap to enable** — Lijkt logischer (on-demand 3D view)

4. **Do we support landscape mode (different layout)?**  
   ✅ **Nog niet nodig** — Focus eerst op portrait mode

---

## Next Steps

1. **Review this plan** with Nicky
2. **Prototype** mobile layout (static HTML/CSS first)
3. **Implement Phase 1** (responsive detection + routing)
4. **Iterate** based on feedback

---

*This plan prioritizes chat accessibility on mobile while preserving the full desktop experience.*
