# CrewHub Group Chat Design

**Created:** 2026-02-16  
**Status:** Design Complete — Ready for Implementation  
**Author:** Reviewer (GPT-5.2)

---

## Overview

Group chat systeem voor CrewHub mobile (desktop-compatible) dat bestaande sessions/SSE/message infra hergebruikt.

**Key decisions:**
- Extend sessions → generic "threads" met `kind: direct|group`
- Max 5 agents (mobile leesbaarheid + backend load)
- Broadcast routing default, targeted routing as toggle
- Thread persistence (archive i.p.v. delete)
- Desktop compatible via "crew node" concept

---

## 1) Data Model (TypeScript)

### Design Choice
Use **one generic thread/session model** with `kind: 'direct' | 'group'` instead of completely new resource.  
This keeps existing infrastructure usable and limits migration risk.

### Core Types

```typescript
type ID = string;
type ISODate = string;

type ThreadKind = "direct" | "group";
type ParticipantType = "human" | "agent" | "system";

type PresenceStatus = "online" | "offline" | "busy" | "unknown";
type DeliveryStatus = "pending" | "sent" | "delivered" | "failed";

interface Thread {
  id: ID;
  workspaceId: ID;
  kind: ThreadKind;                // direct (1:1) or group (N agents + user)
  title?: string;                  // optional custom title
  titleAuto?: string;              // generated fallback
  createdBy: ID;                   // human user id
  createdAt: ISODate;
  updatedAt: ISODate;
  archivedAt?: ISODate | null;
  lastMessageAt?: ISODate | null;
  participantCount: number;
  settings: ThreadSettings;
  metadata?: Record<string, unknown>;
}

interface ThreadSettings {
  maxParticipants: number;         // default 5
  allowUserRename: boolean;        // true
  persistHistory: boolean;         // true
  typingIndicators: boolean;       // true
  presenceIndicators: boolean;     // true
}

interface ThreadParticipant {
  id: ID;
  threadId: ID;
  participantId: ID;               // agentId or userId
  type: ParticipantType;           // mostly "agent" or "human"
  role: "owner" | "member";
  displayName: string;
  avatarUrl?: string;
  isActive: boolean;               // false after leave/remove
  joinedAt: ISODate;
  leftAt?: ISODate | null;

  // runtime snapshot (cache), true source can still be presence service
  presence?: PresenceStatus;
  lastSeenAt?: ISODate;
}

type MessageRole = "user" | "assistant" | "system";
type MessageKind = "text" | "tool_call" | "tool_result" | "event";

interface Message {
  id: ID;
  threadId: ID;
  role: MessageRole;
  kind: MessageKind;

  // "author" = who technically posted this message
  authorParticipantId?: ID;        // ThreadParticipant.id
  authorType: ParticipantType;     // human/agent/system

  // Important for group chat:
  // for assistant messages always fill which agent spoke
  agentId?: ID;                    // canonical agent id
  agentName?: string;              // denormalized for rendering
  replyToMessageId?: ID | null;

  content: MessageContent[];
  createdAt: ISODate;
  status?: DeliveryStatus;
  errorCode?: string;
  errorMessage?: string;

  routing?: MessageRouting;        // how message was routed in group mode
  metadata?: Record<string, unknown>;
}

type MessageContent =
  | { type: "text"; text: string }
  | { type: "mention"; participantId: ID; label: string }
  | { type: "attachment"; url: string; mimeType: string; name?: string }
  | { type: "event"; eventType: string; payload?: Record<string, unknown> };

interface MessageRouting {
  mode: "broadcast" | "targeted";
  targetAgentIds?: ID[];           // broadcast -> all active agent participants
  resolvedAgentIds: ID[];          // final set after availability checks
}
```

### Thread Naming Strategy
1. **Custom title** (user-entered) has priority
2. Otherwise auto-title:
   - direct: `AgentName`
   - group (2-3 agents): `Agent A, Agent B (+1)`
   - group (4+): `Crew with 4 agents`
3. On participant changes recalculate `titleAuto`, but never overwrite custom `title`

---

## 2) Backend API Spec

### Approach: **Extend sessions API** + thin alias endpoints
Don't rewrite everything. Introduce thread semantics within existing sessions.

### Recommended Endpoints

#### Create thread
`POST /v1/threads`  
(can map internally to `POST /v1/sessions`)

```json
{
  "kind": "group",
  "title": "Marketing Crew",
  "participantAgentIds": ["agent_a", "agent_b", "agent_c"],
  "settings": {
    "maxParticipants": 5,
    "typingIndicators": true,
    "presenceIndicators": true
  }
}
```

Response: `201 Thread + participants`

---

#### List threads
`GET /v1/threads?kind=group|direct&archived=false&cursor=...`

---

#### Get thread detail
`GET /v1/threads/{threadId}`

---

#### Get messages
`GET /v1/threads/{threadId}/messages?cursor=...&limit=50`

---

#### Send message (group-aware)
`POST /v1/threads/{threadId}/messages`

```json
{
  "content": [{ "type": "text", "text": "What's the plan for launch?" }],
  "routing": {
    "mode": "broadcast",
    "targetAgentIds": ["agent_a", "agent_c"] 
  }
}
```

**Rules:**
- No `routing` => default `broadcast` to all active agent participants
- With `targeted` only selected agents
- Server sets `resolvedAgentIds` + emits events per agent response

---

#### Participant management
- `POST /v1/threads/{threadId}/participants` (add agents)
- `DELETE /v1/threads/{threadId}/participants/{participantId}` (remove/leave)
- `PATCH /v1/threads/{threadId}` (rename, archive, settings)

---

### Presence/Typing (SSE Events)

Reuse existing SSE channel, add event types:

```typescript
type ThreadEvent =
  | { type: "thread.message.created"; threadId: ID; message: Message }
  | { type: "thread.message.updated"; threadId: ID; messageId: ID; status: DeliveryStatus }
  | { type: "thread.participant.presence"; threadId: ID; participantId: ID; presence: PresenceStatus; at: ISODate }
  | { type: "thread.participant.typing"; threadId: ID; participantId: ID; isTyping: boolean; at: ISODate }
  | { type: "thread.participant.joined"; threadId: ID; participant: ThreadParticipant }
  | { type: "thread.participant.left"; threadId: ID; participantId: ID; at: ISODate };
```

**Important:**
- Throttle typing indicators (max 1 event / 2s per participant)
- Presence best-effort; UI may show stale status with "last seen"

---

## 3) Mobile UX Flow

### A) New Group Flow

```
Agent List
  → tap "New group"
  → Select agents (checkbox list + selected chips top)
  → CTA "Continue (n selected)"
  → Review (optional title + participants)
  → "Create group"
  → open Thread Chat View
```

**UX details:**
- Min: 2 agents (otherwise direct thread)
- Max default: 5 agents
- Disabled items with tooltip: "Agent offline" (but still selectable if async desired)

---

### B) Chat View (Group)

**Thread Header:**
- Title + participant avatars (stack)
- "x of y online" status

**Message List:**
- Each assistant bubble shows **agent badge/avatar + name**
- Peer grouping per agent (consecutive messages from same agent compact)

**Composer:**
- Input
- Route mode toggle:
  - `All agents` (default)
  - `Selected` (chips with chosen agents)
- Send

**Participants Sheet** (from header tap):
- List participants + presence
- Add/remove agents
- Rename group
- Leave group / archive

---

## 4) Edge Cases & Policy

### 1. Max Participants
- Start with **5** (good for mobile readability + backend load control)
- Hard limit server-side; client shows clear error message

### 2. Agent Offline Mid-Chat
- Message routing resolve: offline agent removed from `resolvedAgentIds`
- System event message: "Agent X is offline, retry later"
- Optional: queue-for-when-online flag (later phase)

### 3. Thread Persistence
- Default persistent (like sessions now)
- Archive instead of hard delete for UX safety
- Soft delete only owner/admin

### 4. Delete/Leave Group
- Human user can `leave` (thread hidden for user)
- If owner leaves and single-owner model: promote oldest member or keep user as hidden owner
- Group without active agents => read-only until agent added

### 5. Duplicate Direct/Group Prevention
- On create direct: if same agent set exists (single), open existing thread
- On group: exact same agent set + creator within recent window => suggest reuse

---

## 5) Desktop Compatibility (incl. 3D View)

Yes, group chat must work platform-consistently.

### Desktop Chat List
- Thread item with multi-avatar stack + "Group" badge
- Subtitle: last active agent + snippet

### Desktop 3D View Mapping
- One group thread = "crew node"
- Open panel shows:
  - Participant chips
  - Timeline with agent badges
  - Routing control ("broadcast/targeted")
- Don't open multiple separate agent threads for same conversation (avoid context fragmentation)

---

## 6) Component Structure (Frontend)

```
features/chat/
  domain/
    thread.types.ts
    message.types.ts
    routing.ts
  api/
    threads.api.ts
    messages.api.ts
    participants.api.ts
    sse.events.ts
  components/
    ThreadListItem.tsx
    NewGroupButton.tsx
    AgentMultiSelectSheet.tsx
    SelectedAgentChips.tsx
    GroupThreadHeader.tsx
    ParticipantAvatarStack.tsx
    ParticipantListSheet.tsx
    MessageBubble.tsx
    AgentMessageBubble.tsx
    RoutingSelector.tsx
    TypingIndicatorRow.tsx
  screens/
    ThreadListScreen.tsx
    NewGroupScreen.tsx
    GroupThreadScreen.tsx
```

**Reuse:**
- Existing `MessageList`, `Composer`, `SSE hook`, `Session store`
- Extend with `thread.kind`, `participants`, `routing`

---

## 7) Migration Path (Low Risk)

### Phase 1 — Backend Compatibility Layer
- Add `kind`, participants relation and routing to sessions DB/API
- Keep old clients working (default `kind=direct`)

### Phase 2 — Read Path First
- Clients can fetch/render group threads
- Message bubble supports agent identity

### Phase 3 — Create & Send
- Activate New Group flow
- Group message routing (`broadcast` default)

### Phase 4 — Presence/Typing + Participant Management
- SSE event extension
- Participants sheet + add/remove/leave

### Phase 5 — Desktop 3D Polish
- Crew node UI + parity controls

---

## Implementation Recommendation

- **Don't** build completely new chat stack
- **Do** evolve sessions into generic threads with participant model
- Start with **broadcast-only** UX (simple), add targeted routing as toggle in v2
- Limit to 5 participants keeps mobile UX clear and prevents output chaos

---

## Next Steps

1. ✅ Design complete (this document)
2. ⏳ Await 3D camera implementation completion
3. Backend: DB schema migration + API endpoints
4. Frontend: Thread components + multi-select UX
5. SSE: Event types extension
6. Desktop: Crew node UI

---

*This design maximizes reuse of existing infrastructure while adding group chat capabilities in a phased, low-risk manner.*
