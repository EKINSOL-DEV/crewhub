# Agent Chat Feature — Design Document

*Version: 1.0 — 2026-02-03*

## Vision

Add a live chat interface to CrewHub that lets users talk directly to fixed agents (Assistent, Flowy, Creator, Dev, etc.) from within the 3D World view. The chat shows full conversation history with lazy loading and supports sending new messages with streaming responses.

---

## UX Flow

1. User clicks on a bot → **BotInfoPanel** opens (existing)
2. For **fixed agents** (not subagents/cron), show a **💬 Chat** button alongside "Open Full Log"
3. Clicking "Chat" opens a **ChatPanel** — a slide-in panel replacing/overlaying the BotInfoPanel
4. ChatPanel shows:
   - Message history (lazy loaded, newest at bottom)
   - Scroll up to load older messages
   - Message input with send button
   - Streaming response display (assistant typing indicator)
5. Messages appear as chat bubbles (user = right, assistant = left)
6. Tool calls shown as compact cards (like Planner's existing chat)

---

## Architecture

### Data Flow
```
User types message
       ↓
Frontend ChatPanel → POST /api/chat/{session_key}/send
       ↓
CrewHub Backend → OpenClaw Gateway WebSocket → send_chat(sessionKey, message)
       ↓
Gateway SSE response stream → Backend SSE → Frontend EventSource
       ↓
Real-time message bubbles + streaming text
```

### History Flow
```
ChatPanel mount → GET /api/chat/{session_key}/history?limit=30&before={cursor}
       ↓
CrewHub Backend → reads Gateway session JSONL files
       ↓
Parsed messages returned (role, content, timestamp, tokens, tools)
       ↓
Lazy load: scroll up → fetch older page
```

---

## Backend (CrewHub Python/FastAPI)

### New route file: `backend/app/routes/chat.py`

#### 1. GET `/api/chat/{session_key}/history`
Fetch conversation history with pagination.

**Query params:**
- `limit` (int, default 30) — messages per page
- `before` (int, optional) — cursor timestamp, fetch messages older than this
- `after` (int, optional) — fetch messages newer than this (for polling new msgs)

**Response:**
```json
{
  "messages": [
    {
      "id": "msg-1",
      "role": "user" | "assistant" | "system",
      "content": "Hello!",
      "timestamp": 1706900000000,
      "tokens": 150,
      "cost": 0.001,
      "tools": [
        { "name": "web_search", "status": "success" }
      ]
    }
  ],
  "hasMore": true,
  "oldestTimestamp": 1706800000000
}
```

**Implementation:** Read the session's JSONL transcript file from `~/.openclaw/agents/{agent}/sessions/{id}.jsonl`. Parse each line, extract role, content blocks, timestamp, usage. Return paginated results.

The session key maps to a JSONL file path. We need a lookup:
- Gateway API `/api/sessions` returns session list with `sessionId`
- JSONL files are at `~/.openclaw/agents/{agentId}/sessions/{sessionId}.jsonl`

#### 2. POST `/api/chat/{session_key}/send`
Send a message to an agent and stream the response.

**Body:**
```json
{ "message": "Hello agent!" }
```

**Response:** Server-Sent Events (SSE) stream:
```
data: {"type": "text", "content": "Hello! "}
data: {"type": "text", "content": "How can I help?"}
data: {"type": "tool", "name": "web_search", "status": "running"}
data: {"type": "tool", "name": "web_search", "status": "done"}
data: {"type": "done", "totalTokens": 500}
data: {"type": "error", "message": "..."}
```

**Implementation:** Use the Gateway WebSocket client (similar to Planner's `gateway.py`):
- Connect to `ws://localhost:18789` with gateway token
- Send `{"type": "agent", "sessionKey": "...", "message": "...", "stream": true}`
- Stream response frames as SSE events

#### 3. GET `/api/chat/{session_key}/info`  
Check if a session supports chat (is a fixed agent, not a subagent).

**Response:**
```json
{
  "canChat": true,
  "agentId": "main",
  "agentName": "Assistent",
  "sessionKey": "agent:main:main"
}
```

---

## Frontend

### New Components

#### 1. `AgentChatPanel.tsx` — Main chat panel
- Slide-in from right (like BotInfoPanel but wider, ~400px)
- Header: agent name + icon + close button
- Message area: scrollable, auto-scroll to bottom on new messages
- Input area: textarea + send button (Enter to send, Shift+Enter for newline)
- Lazy loading: IntersectionObserver at top → fetch older messages when scrolled up

#### 2. `ChatMessage.tsx` — Individual message bubble
- User messages: right-aligned, colored bubble
- Assistant messages: left-aligned, lighter bubble
- System messages: centered, gray italic
- Tool calls: compact card with icon + name + status
- Markdown rendering for assistant messages (code blocks, lists, etc.)
- Timestamp on hover

#### 3. `useAgentChat.ts` — Chat hook
```ts
interface UseAgentChatReturn {
  messages: ChatMessageData[]
  isStreaming: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  loadOlderMessages: () => Promise<void>
  hasMore: boolean
  isLoadingHistory: boolean
}
```

### Integration in BotInfoPanel

For fixed agents (detect: session key matches `agent:*:main`), show:
- **💬 Open Chat** button (primary, orange like "Open Full Log")
- **📋 Open Full Log** button (secondary)

Clicking "Open Chat" → renders `AgentChatPanel` instead of BotInfoPanel.

---

## Detecting Fixed Agents

A session is a "fixed agent" (chatworthy) if:
- Session key matches `agent:{id}:main` pattern
- OR the session is listed in the agents table with `agent_session_key`
- NOT a subagent (no `:subagent:` or `:spawn:` in key)
- NOT a cron session (no `:cron:` in key)

---

## Implementation Phases

### Phase 1: Backend — History endpoint + Chat send endpoint
1. Create `backend/app/routes/chat.py`
2. Add JSONL parser for session transcripts
3. History endpoint with pagination
4. Chat send endpoint with SSE streaming via Gateway WebSocket
5. Wire into FastAPI app

### Phase 2: Frontend — Chat UI
1. Create `useAgentChat` hook (history loading + send + streaming)
2. Create `ChatMessage` component (bubbles, tool cards, markdown)
3. Create `AgentChatPanel` (slide-in panel, messages, input)
4. Update `BotInfoPanel` — add "Open Chat" button for fixed agents
5. Update `World3DView` — render AgentChatPanel when chat is active

---

## Reference
- Planner chat: `~/ekinapps/ekinbot_planner/frontend/src/components/chat/StreamingChat.tsx`
- Planner chat hook: `~/ekinapps/ekinbot_planner/frontend/src/hooks/useStreamingChat.ts`
- Planner gateway: `~/ekinapps/ekinbot_planner/backend/app/services/gateway.py`
- Planner chat route: `~/ekinapps/ekinbot_planner/backend/app/routes/chat.py`
- CrewHub backend: `~/ekinapps/crewhub/backend/`
- Gateway token: `REDACTED_TOKEN`
- Gateway WebSocket: `ws://localhost:18789`
