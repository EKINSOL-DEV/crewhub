# CrewHub Streaming Analysis

**Datum:** 18 februari 2026  
**Auteur:** Ekinbot Dev (subagent)  
**Doel:** Onderzoek of OpenClaw streaming ondersteunt voor agent chat, en hoe we dat kunnen integreren in CrewHub.

---

## OpenClaw Streaming Capabilities

### Conclusie: ✅ Ja, streaming is mogelijk — maar niet via HTTP SSE

OpenClaw Gateway ondersteunt **streaming via WebSocket-events**. Tijdens een agent-run worden `chat` events uitgestuurd over de bestaande WS-verbinding, met incremental text chunks.

### Wat OpenClaw intern doet

Wanneer een agent een antwoord genereert, stuurt de gateway **`chat` events** naar alle WebSocket-verbindingen die de agent session volgen. Dit zijn events van het type:

```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "sessionKey": "agent:main:main",
    "state": "delta",
    "runId": "<uuid>",
    "message": {
      "content": [
        { "type": "text", "text": "<volledige tekst tot nu toe>" }
      ]
    }
  }
}
```

**Belangrijk:** `state: "delta"` bevat de **cumulatieve tekst** (niet alleen het nieuw toegevoegde stukje). De ontvanger moet zelf de diff berekenen (vorige lengte vs nieuwe lengte) om de nieuwe chunk te extraheren.

### Lifecycle van een streaming response

| Event `state` | Betekenis |
|---|---|
| `"delta"` | Incrementele tekst beschikbaar (herhaald) |
| `"final"` | Agent klaar, `end_turn` |
| `"aborted"` | Gebruiker of systeem heeft geannuleerd |
| `"error"` | Agent fout opgetreden |

### Naast `chat` ook `agent` events

Tijdens een agent-run worden ook `agent` events gestuurd voor tool calls:

```json
{
  "type": "event", 
  "event": "agent",
  "payload": {
    "sessionKey": "agent:main:main",
    "stream": "tool",
    "data": {
      "phase": "start",
      "name": "exec",
      "toolCallId": "<id>",
      "args": { ... }
    }
  }
}
```

### Wat er NIET bestaat

- ❌ Geen HTTP SSE endpoint vanuit OpenClaw (bijv. `/api/stream`)
- ❌ Geen REST-gebaseerde streaming
- ❌ De OpenClaw gateway expose alleen WebSocket (`ws://127.0.0.1:18789`)

---

## Hoe het werkt (endpoints, auth, protocol)

### Gateway verbinding

- **Protocol:** WebSocket (JSON over WS, request/response + events)
- **Endpoint:** `ws://127.0.0.1:18789` (loopback-only, geen externe toegang)
- **Auth:** Device-token (Ed25519 keypair) of gateway-token (`2330ce1b5e9...`)
- **WS handshake:** challenge → device-block met signature → connect response

### Relevante WS methodes (CrewHub gebruikt)

| Methode | Params | Gebruik |
|---|---|---|
| `connect` | client, device, scopes | Handshake/auth |
| `sessions.list` | – | Sessies ophalen |
| `agent` | `{agentId, message, sessionId, idempotencyKey}` | Bericht sturen + wachten op antwoord |
| `cron.list` / `cron.add` | – | Cron management |

### Hoe `send_chat` nu werkt (blocking)

```
Client → gateway: { type: "req", method: "agent", params: { message, agentId } }
Gateway → Client: { type: "res", ok: true, payload: { status: "accepted" } }   ← tussenstap
(agent denkt na...)
Gateway → Client: { type: "res", id: ..., ok: true, payload: { result: { payloads: [{text: "..."}] } } }  ← finaal
```

CrewHub wacht nu op de **tweede `res`** (het finale antwoord), met timeout van 120s.

### Hoe streaming werkt (naast de blocking call)

Tegelijk met de blocking call stuurt de gateway **event messages** naar alle verbonden clients:

```
(tijdens agent run)
Gateway → Client: { type: "event", event: "chat", payload: { state: "delta", message: { content: [{text: "Dag "}] } } }
Gateway → Client: { type: "event", event: "chat", payload: { state: "delta", message: { content: [{text: "Dag Nicky, "}] } } }
Gateway → Client: { type: "event", event: "chat", payload: { state: "delta", message: { content: [{text: "Dag Nicky, hoe "}] } } }
...
Gateway → Client: { type: "event", event: "chat", payload: { state: "final" } }
```

**Sleutelpunt:** Deze events komen binnen in `_listen_loop` in `openclaw.py`, maar worden **niet gebruikt** door CrewHub (event handler voor `"chat"` is nooit geregistreerd).

---

## CrewHub Huidige Situatie

### Backend

#### `chat.py` — `POST /api/chat/{session_key}/send`

- Stuurt bericht via `conn.send_chat(message, agent_id, timeout=120s)`
- `send_chat()` roept `self.call("agent", ..., wait_for_final_agent_result=True)` aan
- Wacht tot de **volledige response** terug is
- Geeft `{ response: "...", success: true }` terug als JSON
- **Geen streaming**, **geen SSE**

#### `openclaw.py` — `_listen_loop()`

- Verwerkt WS berichten van gateway
- Routes `res` messages naar wachtende callers
- Routes `event` messages naar geregistreerde handlers
- **`"chat"` event heeft geen registered handler** → wordt genegeerd
- `subscribe()` methode bestaat en werkt, maar wordt nooit gebruikt voor streaming

#### `sse.py` — `/events`

- SSE infrastructure bestaat al ✅
- Gebruikt voor `sessions-refresh`, `session-removed` events
- Niet gekoppeld aan chat streaming

### Frontend

#### `useAgentChat.ts`

```typescript
// Huidig patroon (blocking)
const resp = await fetch(`${API_BASE}/chat/${sessionKey}/send`, {
  method: 'POST',
  body: JSON.stringify({ message: trimmed }),
})
const data = await resp.json()
// data.response bevat de volledige tekst in één keer
setMessages(prev => [...prev, { content: data.response, ... }])
```

- Geen `EventSource`, geen streaming fetch
- Wacht op volledige JSON response
- UI toont "thinking..." indicator en dan ineens de volledige tekst

#### `AgentChatWindow.tsx`

- Toont `isSending && <span>thinking...</span>`
- Geen "typing cursor" of progressieve rendering
- `ChatMessageBubble` rendert markdown pas na ontvangst van volledig bericht

### Bestaande SSE infra (frontend)

- `useSSEStatus.ts` + `lib/sseManager.ts` — EventSource verbinding met `/events`
- Ontvangt al `sessions-refresh`, `session-removed` events
- Kan worden uitgebreid voor chat-delta events

---

## Gap Analyse

### Wat ontbreekt

| Component | Wat | Prioriteit |
|---|---|---|
| `openclaw.py` | `send_chat_streaming()` die event-subscriptie combineert met `agent` call | Hoog |
| `chat.py` | Nieuw SSE endpoint: `POST /api/chat/{session_key}/stream` | Hoog |
| `useAgentChat.ts` | `sendMessageStream()` die SSE/fetch streaming leest | Hoog |
| `AgentChatWindow.tsx` | Progressieve rendering: tekst opdatering terwijl streaming | Hoog |
| `ChatMessageBubble.tsx` | "Typing cursor" animatie tijdens streaming | Laag |

### Risico's & aandachtspunten

1. **Correlatie**: De gateway stuurt `chat` events voor ALLE sessies. Bij meerdere gelijktijdige chats moet je filteren op `sessionKey` (en optioneel `runId`).

2. **Cumulative vs. delta text**: De `message.content[0].text` bevat de **volledige tekst tot nu toe**, niet alleen het nieuwe stukje. Frontend of backend moet de diff bijhouden.

3. **Concurrency**: Als twee gebruikers tegelijk met dezelfde agent chatten, kunnen events door elkaar komen. Oplossing: filter op `idempotencyKey` / `runId`.

4. **Timeout**: De huidige 120s timeout kan te groot zijn bij streaming — liever een per-chunk timeout instellen.

5. **Markdown rendering**: Progressieve markdown rendering (terwijl streamen) kan "flikkeren" bij incomplete syntax (bijv. half-geopende code blocks). Overweeg throttling: update elke ~100ms in plaats van per chunk.

---

## Implementatieplan

### Stap 1: Backend — Streaming endpoint

**Bestand:** `backend/app/services/connections/openclaw.py`

Voeg toe: `send_chat_streaming()` als een async generator:

```python
async def send_chat_streaming(
    self,
    message: str,
    agent_id: str = "main",
    session_id: Optional[str] = None,
    timeout: float = 120.0,
) -> AsyncGenerator[str, None]:
    """Send a chat message and yield text chunks as they arrive."""
    import asyncio
    import uuid
    
    idempotency_key = str(uuid.uuid4())
    chunk_queue: asyncio.Queue = asyncio.Queue()
    sent_length = 0
    
    def on_chat_event(payload: dict):
        nonlocal sent_length
        if payload.get("sessionKey") != f"agent:{agent_id}:main":
            return
        state = payload.get("state")
        if state == "delta":
            text = (payload.get("message", {})
                    .get("content", [{}])[0]
                    .get("text", ""))
            new_chunk = text[sent_length:]
            sent_length = len(text)
            if new_chunk:
                chunk_queue.put_nowait(("delta", new_chunk))
        elif state in ("final", "error", "aborted"):
            chunk_queue.put_nowait(("done", state))
    
    self.subscribe("chat", on_chat_event)
    
    try:
        # Fire-and-forget the agent call (don't await final result here)
        asyncio.create_task(self.call(
            "agent",
            {
                "message": message,
                "agentId": agent_id,
                "deliver": False,
                "idempotencyKey": idempotency_key,
                **({"sessionId": session_id} if session_id else {}),
            },
            timeout=timeout,
            wait_for_final_agent_result=True,
        ))
        
        while True:
            try:
                kind, data = await asyncio.wait_for(
                    chunk_queue.get(), timeout=30.0
                )
                if kind == "delta":
                    yield data
                else:
                    break  # "done"
            except asyncio.TimeoutError:
                break  # Geen chunk ontvangen in 30s
    finally:
        self.unsubscribe("chat", on_chat_event)
```

**Bestand:** `backend/app/routes/chat.py`

Voeg toe: streaming endpoint:

```python
from fastapi.responses import StreamingResponse

@router.post("/api/chat/{session_key}/stream")
async def stream_chat_message(session_key: str, body: SendMessageBody):
    """Send a message and stream back the response via SSE."""
    _validate_session_key(session_key)
    _check_rate_limit(session_key)
    
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    agent_id = _get_agent_id(session_key)
    
    manager = await get_connection_manager()
    conn = manager.get_default_openclaw()
    if not conn:
        raise HTTPException(status_code=503, detail="No OpenClaw connection")
    
    async def generate():
        yield "event: start\ndata: {}\n\n"
        async for chunk in conn.send_chat_streaming(message, agent_id=agent_id):
            import json
            yield f"event: delta\ndata: {json.dumps({'text': chunk})}\n\n"
        yield "event: done\ndata: {}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
```

### Stap 2: Frontend — Streaming hook

**Bestand:** `frontend/src/hooks/useAgentChat.ts`

Voeg toe naast `sendMessage`:

```typescript
const sendMessageStream = useCallback(async (text: string) => {
  const trimmed = text.trim()
  if (!trimmed || isSending) return
  
  // Optimistically add user message
  const userMsg: ChatMessageData = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: trimmed,
    timestamp: Date.now(),
  }
  setMessages(prev => [...prev, userMsg])
  setIsSending(true)
  setError(null)
  
  // Add empty assistant message (will be filled progressively)
  const assistantId = `assistant-${Date.now()}`
  const assistantMsg: ChatMessageData = {
    id: assistantId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
  }
  setMessages(prev => [...prev, assistantMsg])
  
  try {
    const resp = await fetch(
      `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      }
    )
    
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line.includes('"text"')) {
          const data = JSON.parse(line.slice(6))
          accumulated += data.text
          setMessages(prev => prev.map(m => 
            m.id === assistantId 
              ? { ...m, content: accumulated }
              : m
          ))
        }
      }
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Streaming failed')
  } finally {
    setIsSending(false)
  }
}, [sessionKey, isSending])
```

### Stap 3: Frontend — UI update

**Bestand:** `AgentChatWindow.tsx`

- Gebruik `sendMessageStream` in plaats van `sendMessage`
- Voeg "typing cursor" toe: als `isSending && lastMessage.role === 'assistant'`, toon een cursor na de tekst
- Throttle markdown re-renders: update state max elke 80ms (via debounce ref)

**Bestand:** `ChatMessageBubble.tsx`

- Voeg `isStreaming?: boolean` prop toe
- Toon knipperende cursor (`▋`) op het einde als `isStreaming`

---

## Geschatte Effort

| Stap | Component | Effort |
|---|---|---|
| 1a | `send_chat_streaming()` in `openclaw.py` | ~3-4 uur |
| 1b | `POST /stream` endpoint in `chat.py` | ~1 uur |
| 1c | Context envelope integreren in stream flow | ~30 min |
| 2a | `sendMessageStream()` in `useAgentChat.ts` | ~2 uur |
| 2b | Progressieve state updates + throttling | ~1 uur |
| 3a | Streaming cursor in UI | ~1 uur |
| 3b | Testen + edge cases | ~2 uur |
| **Totaal** | | **~11 uur** |

### Alternatief: SSE via broadcast (eenvoudiger maar minder direct)

In plaats van de `send_chat_streaming()` generator, kan je ook:
1. Backend registreert `chat` event handler die altijd broadcast via `sse.broadcast()`
2. Frontend luistert via bestaande SSE verbinding (`/events`) op `chat_delta` events
3. Frontend koppelt ontvangen chunks aan lopende chatvensters

**Voordeel:** Hergebruikt bestaande SSE infra, minder code.  
**Nadeel:** Iedereen die verbonden is ontvangt delta's van iedereen (privacy/security issue bij meerdere users). Vereist session-key filtering op frontend.

### Aanbeveling

Begin met het **directe streaming approach** (Stap 1-3). Dit is cleaner, heeft geen privacy-issues, en werkt per-request. Effort is ~1.5 dag werk voor een Opus subagent.

---

## Samenvatting

| Vraag | Antwoord |
|---|---|
| Ondersteunt OpenClaw streaming? | ✅ Ja, via WebSocket `chat` events met `state: "delta"` |
| Is er een HTTP SSE endpoint? | ❌ Nee, alleen WebSocket |
| Hoe werkt het? | Gateway stuurt cumulatieve tekst per event, ontvanger berekent diff |
| Heeft CrewHub streaming? | ❌ Nee, alles is blocking (wachten op volledig antwoord) |
| Wat is er nodig? | Backend streaming generator + SSE proxy endpoint + frontend EventSource reader |
| Effort | ~11 uur / ~1.5 dag |
