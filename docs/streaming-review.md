# Streaming Architecture Review

**Datum:** 19 februari 2026  
**Reviewer:** Reviewer Agent (subagent)  
**Bronbestanden:** `docs/streaming-analysis.md`, `backend/app/services/connections/openclaw.py`, `backend/app/routes/chat.py`

---

## Executive Summary

De geplande streaming architectuur is een solide en pragmatische aanpak die de bestaande WebSocket-infrastructuur van OpenClaw correct benut. De kern-aanpak — event subscription combineren met een asyncio.Queue als bridge naar SSE — is architectureel correct. Er zijn echter **twee kritische bugs** die tot data-corruptie en silent failures leiden bij gelijktijdig gebruik, plus een aantal robuustheids-issues in de frontend. Met de onderstaande fixes is de implementatie klaar voor productie. Zonder die fixes werkt het prima in solo-gebruik maar faalt het onvoorspelbaar bij concurrency.

---

## Bevindingen

### 🔴 Kritisch (moet opgelost worden)

---

#### 🔴 1. runId-filtering ontbreekt → corruptie bij gelijktijdige requests op dezelfde agent

**Probleem:**  
De `on_chat_event` handler filtert alleen op `sessionKey`:

```python
if payload.get("sessionKey") != f"agent:{agent_id}:main":
    return
```

Dit is onvoldoende. De gateway stuurt events voor **alle lopende runs** van dezelfde agent, en meerdere gelijktijdige requests op bijv. `agent:main:main` (2 browservensters, of een cron + gebruiker) produceren events die allemaal door dezelfde sessiekey-check komen.

**Wat er fout gaat:**  
Stel User A en User B sturen tegelijk een bericht naar `agent:main:main`:
- Run A produceert cumulatieve tekst: `"Hallo"`, `"Hallo hoe"`, `"Hallo hoe gaat"` (sent_length A: 0→5→9→13)
- Run B start: cumulatieve tekst reset naar `"Goed"` (2 chars)
- Handler A ziet Run B's event: `text = "Goed"`, `new_chunk = text[13:] = ""` → **lege chunk, B's tekst weggegooid**
- Erger: als sent_length A = 3 en Run B tekst = "Ja": `new_chunk = "Ja"[3:] = ""` → verlies

Het gevolg: willekeurige stukken tekst worden weggegooid of dubbel getoond, afhankelijk van race-timing.

**Oplossing:**  
Stap 1 — geef de `agent` call een `idempotencyKey` mee en filter events op `runId`:

```python
async def send_chat_streaming(self, message, agent_id="main", session_id=None, timeout=120.0):
    idempotency_key = str(uuid.uuid4())
    chunk_queue: asyncio.Queue = asyncio.Queue()
    sent_length = 0
    active_run_id: Optional[str] = None  # ← vast zodra gateway run start bevestigt

    def on_chat_event(payload: dict):
        nonlocal sent_length, active_run_id
        if payload.get("sessionKey") != f"agent:{agent_id}:main":
            return

        run_id = payload.get("runId")
        
        # Latch de run_id bij eerste delta die we ontvangen
        if active_run_id is None and payload.get("state") == "delta":
            active_run_id = run_id
        
        # Negeer events van andere runs
        if run_id and active_run_id and run_id != active_run_id:
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
    ...
```

Als alternatief: geef de `idempotencyKey` als correlatie-ID mee en verwacht dat de gateway `runId` teruggeeft in het eerste event.

---

#### 🔴 2. Gateway disconnect signaleert chunk_queue niet → silent hang van 30 seconden

**Probleem:**  
Wanneer de gateway disconnecteert, stuurt `_listen_loop` alleen fout-berichten naar `_response_queues`:

```python
# In _listen_loop finally block:
for req_id, q in list(self._response_queues.items()):
    q.put_nowait({"ok": False, "error": {"code": "DISCONNECTED", ...}})
self._response_queues.clear()
```

De lokale `chunk_queue` in `send_chat_streaming()` staat **niet** in `_response_queues`. Bij gateway disconnect komen er geen events meer binnen, maar de while-loop wacht gewoon de volledige 30s timeout af. De gebruiker ziet een speldenknop-achtige freeze.

**Oplossing:**  
Registreer chunk_queues in een apart dict zodat ze bij disconnect gesignaleerd worden:

```python
# In __init__:
self._stream_queues: dict[str, asyncio.Queue] = {}

# In send_chat_streaming():
stream_id = str(uuid.uuid4())
self._stream_queues[stream_id] = chunk_queue
try:
    ...
finally:
    self._stream_queues.pop(stream_id, None)
    self.unsubscribe("chat", on_chat_event)

# In _listen_loop finally block (toevoegen):
for stream_id, sq in list(self._stream_queues.items()):
    try:
        sq.put_nowait(("error", "DISCONNECTED"))
    except asyncio.QueueFull:
        pass
self._stream_queues.clear()
```

En in de generator-loop:
```python
kind, data = await asyncio.wait_for(chunk_queue.get(), timeout=30.0)
if kind == "error":
    raise RuntimeError(f"Gateway disconnected: {data}")
```

---

#### 🔴 3. Frontend checkt `resp.ok` niet voor streamen → crash bij HTTP errors

**Probleem:**  
In het voorgestelde frontend-patroon:

```typescript
const resp = await fetch(`${API_BASE}/chat/${sessionKey}/stream`, { ... })
const reader = resp.body!.getReader()  // ← crasht als resp.status = 429, 503, etc.
```

Als het endpoint een 429 (rate limit), 503 (no connection) of 404 retourneert, is `resp.body` een JSON error body. De code probeert die als SSE stream te lezen en gooit cryptische parse-errors.

**Oplossing:**

```typescript
const resp = await fetch(...)
if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }))
    throw new Error(err.detail ?? err.error ?? `HTTP ${resp.status}`)
}
const reader = resp.body!.getReader()
```

---

### 🟡 Belangrijk (sterk aanbevolen)

---

#### 🟡 4. Rate limiter blokkeert follow-up berichten tijdens/na streaming

**Probleem:**  
`_check_rate_limit()` heeft een cooldown van **3 seconden** per session_key. Een streaming response duurt 5–30 seconden. De cooldown-timer start op het moment van de POST, niet bij het einde van de response. Dit betekent: zodra de stream klaar is, heeft de gebruiker al ruim 3s gewacht → rate limit is vervallen. OK voor `/send`, maar bij `/stream` is de timing irrelevant — de request duurt zolang als de stream duurt.

**Risico:** Als dezelfde sessie twee overlappende `/stream` POST's stuurt (browservenster refresh tijdens streaming), lopen twee simultane streams voor dezelfde agent. De rate limiter helpt hier niet: de tweede request komt 3s na de eerste binnen, terwijl de eerste nog actief is.

**Aanbeveling:** Track een "is_streaming" vlag per session_key:

```python
_active_streams: set[str] = set()

def _check_stream_conflict(session_key: str) -> None:
    if session_key in _active_streams:
        raise HTTPException(status_code=409, detail="Stream already active for this session")

# In stream endpoint:
_active_streams.add(session_key)
try:
    async def generate():
        ...
    return StreamingResponse(generate(), ...)
finally:
    # Dit werkt NIET — finally loopt af vóór de generator klaar is
    # Gebruik een context manager in generate():
    pass
```

Correcte aanpak in de generator:

```python
async def generate():
    _active_streams.add(session_key)
    try:
        yield "event: start\ndata: {}\n\n"
        async for chunk in conn.send_chat_streaming(...):
            yield f"event: delta\ndata: {json.dumps({'text': chunk})}\n\n"
        yield "event: done\ndata: {}\n\n"
    finally:
        _active_streams.discard(session_key)
```

---

#### 🟡 5. asyncio.create_task fire-and-forget loopt 120s door na client disconnect

**Probleem:**  
```python
asyncio.create_task(self.call(
    "agent", {...}, timeout=timeout, wait_for_final_agent_result=True
))
```

Wanneer de client de SSE verbinding verbreekt, wordt de generator gesloten (via `aclose()`). Maar de `create_task` loopt onafhankelijk door tot het finale agent-antwoord (max 120s). Dit is geen memory leak (de task ruimt zichzelf op via `_response_queues`), maar het is **resource-verspilling**: de agent blijft denken terwijl niemand het antwoord wil.

**Aanbeveling:** Bewaar een referentie naar de task en cancel deze in de generator's `finally`:

```python
agent_task = asyncio.create_task(self.call("agent", {...}))
try:
    while True:
        ...
finally:
    if not agent_task.done():
        agent_task.cancel()
        try:
            await agent_task
        except (asyncio.CancelledError, Exception):
            pass
    self.unsubscribe("chat", on_chat_event)
    self._stream_queues.pop(stream_id, None)
```

**Let op:** Cancelling de task cancelt alleen het *wachten* op het antwoord, niet de agent-run zelf bij de gateway. De agent zal zijn run afmaken; we luisteren alleen niet meer.

---

#### 🟡 6. SSE partial-read parser is fragiel voor multi-chunk events

**Probleem:**  
Het voorgestelde frontend SSE-parsing patroon:

```typescript
const lines = buffer.split('\n')
buffer = lines.pop() ?? ''
for (const line of lines) {
    if (line.startsWith('data: ') && line.includes('"text"')) {
```

Dit split op `\n` maar SSE events worden gescheiden door `\n\n`. Als een TCP packet eindigt halverwege een `event:` + `data:` paar, worden de twee regels in aparte `read()` calls ontvangen. De code handelt dit correct voor losse `data:` regels, maar:

1. `line.includes('"text"')` is een fragiele check — breekt als de JSON een `"text"` key bevat in een ander veld
2. De `event:` type-lijn (bijv. `event: delta`) wordt volledig genegeerd — code zou moeten luisteren naar het event-type
3. Multi-line data (theoretisch mogelijk in SSE) wordt niet ondersteund

**Aanbeveling:** Gebruik een proper SSE state machine:

```typescript
let buffer = ''
let currentEvent = ''

while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    buffer += decoder.decode(value, { stream: true })
    
    // Split op SSE event boundary (double newline)
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''  // laatste incomplete event bewaren
    
    for (const eventBlock of events) {
        const lines = eventBlock.split('\n')
        let eventType = 'message'
        let dataLine = ''
        
        for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim()
            else if (line.startsWith('data: ')) dataLine = line.slice(6).trim()
        }
        
        if (eventType === 'delta' && dataLine) {
            const data = JSON.parse(dataLine)
            accumulated += data.text
            setMessages(prev => prev.map(m => 
                m.id === assistantId ? { ...m, content: accumulated } : m
            ))
        } else if (eventType === 'done') {
            break
        }
    }
}
```

---

#### 🟡 7. Context envelope bouwt asyncio.Queue vooraf — latency onnodig

**Probleem:**  
In `send_chat_message()` (het huidige `/send` endpoint) wordt de context envelope gesynchroniseerd gebouwd vóór het bericht verstuurd wordt. Voor het nieuwe `/stream` endpoint is dit patroon potentieel traag: de envelope-bouw (database queries + API calls) kan 50–200ms duren vóórdat de SSE response start, wat de "first byte" latency verhoogt.

**Aanbeveling:** Start de SSE response onmiddellijk met een `event: start`, bouw de envelope asynchroon, en inject die in het eerste agent-bericht. Of bouw de envelope concurrent met het opbouwen van de WebSocket call.

---

#### 🟡 8. SSE headers: `Connection: keep-alive` ontbreekt

**Huidig (voorgesteld):**
```python
headers={
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}
```

**Ontbreekt:** `"Connection": "keep-alive"` voor HTTP/1.1 clients (browsers zonder HTTP/2).

**Compleet:**
```python
headers={
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",      # nginx: schakel proxy buffering uit
    "Connection": "keep-alive",      # HTTP/1.1 persistent connection
    "Transfer-Encoding": "chunked",  # Optioneel, FastAPI doet dit automatisch
}
```

Voor nginx proxy (als die er ooit komt), voeg toe aan nginx config:
```nginx
proxy_buffering off;
proxy_read_timeout 300s;
```

---

### 🟢 Goed / Verbeterpunten (nice to have)

---

#### 🟢 9. `finally` block met unsubscribe is correct

De `try/finally` structuur in de voorgestelde `send_chat_streaming()` garandeert dat `self.unsubscribe("chat", on_chat_event)` altijd aangeroepen wordt, ook bij exceptions of generator cancellation. Dit is correct. ✅

**Kleine opmerking:** Python's async generator `finally` wordt aangeroepen wanneer:
- De generator normaal afloopt
- `aclose()` wordt aangeroepen (client disconnect via Starlette)
- Een exception wordt gegooid

Starlette/FastAPI roept `aclose()` correct aan op async generators bij client disconnect. ✅

---

#### 🟢 10. 80ms throttling interval is goed gekozen

Bij 80ms throttling: **~12.5 React renders/seconde**. Dit is een goede balans:
- Vloeiend genoeg voor streaming UX (perceptueel "real-time")
- Laag genoeg om markdown re-rendering niet te overbelasten
- react-markdown met syntax highlighting is ~2–5ms per render; bij 12.5/s = ~25–62ms/s renderwerk → veilig

**Suggestie:** Overweeg 50ms (20 FPS) voor snellere initiële text-verschijning. Bij een snelle agent (200 tokens/sec) kan 80ms achterlopen. Bij 50ms voelt het meer als "live typing".

**Markdown incomplete syntax:** react-markdown is redelijk robuust voor incomplete syntax. Risico's:
- ``` ` ` ` zonder sluiting → wordt als code-inline gerenderd
- `**bold` zonder sluiting → als raw `**bold` tekst
- Tabellen met halve rows → rendering artefacten

**Aanbeveling:** Gooi een `dangerouslyAllowHtml={false}` + syntaxHighlighter met `PreTag` wrapper, en optioneel: toon tekst als plain text tijdens streaming, schakel over naar full markdown render bij `event: done`. Dit vermijdt alle flicker.

---

#### 🟢 11. Architectuur: Unified hook vs. composable hooks

**Huidige situatie:** `useAgentChat` doet history loading + message sending in één hook.

**Voordelen unified hook:**
- Component API blijft simpel: `const { messages, sendMessage, isLoading } = useAgentChat(sessionKey)`
- Shared state (messages list) in één plek
- Consistente loading states

**Nadelen unified hook:**
- Groeit snel uit tot een "god hook" met 200+ regels
- Moeilijker unit-testen
- History reload na streaming moet coördineren met streaming state

**Aanbeveling (pragmatisch):** Behoud `useAgentChat` als public interface, maar refactor intern naar composable hooks:

```typescript
// Intern:
const { messages, loadMore, hasMore } = useChatHistory(sessionKey)
const { sendMessage, isStreaming, streamingContent } = useChatStream(sessionKey, {
    onComplete: (msg) => history.append(msg),
})

// Extern (useAgentChat):
return { messages: [...messages, streamingMsg], sendMessage, isStreaming, loadMore }
```

History loading hoort **niet** exclusief in de streaming hook — history is ook relevant zonder streaming (bijv. als fallback naar `/send` actief is).

---

#### 🟢 12. Fallback strategie: wanneer te triggeren?

De analyse vermeldt een fallback naar `/send` maar specificeert niet wanneer:

**Aanbevolen trigger volgorde:**
1. **Altijd proberen:** `POST /stream` (streaming)
2. **Fallback naar `/send` bij:**
   - `resp.status === 404` (endpoint nog niet beschikbaar)
   - `resp.status === 503` (no gateway connection)
   - `EventSource` / stream open error binnen 5 seconden
   - Streaming start maar geen `event: delta` binnen 10s (agent denkt te lang → user experience: toon "thinking..." indicator)
3. **Fallback ook mislukt:** Toon expliciete error UI met retry-knop. Geen silent fail.

```typescript
const sendWithFallback = async (text: string) => {
    try {
        await sendMessageStream(text)
    } catch (streamErr) {
        logger.warn('Streaming failed, falling back to /send', streamErr)
        try {
            await sendMessage(text)
        } catch (sendErr) {
            setError('Kon bericht niet versturen. Probeer opnieuw.')
        }
    }
}
```

---

## Aanbevelingen: Concrete code suggesties voor kritische bevindingen

### Fix #1: runId filtering in `send_chat_streaming()`

```python
async def send_chat_streaming(
    self,
    message: str,
    agent_id: str = "main",
    session_id: Optional[str] = None,
    timeout: float = 120.0,
) -> AsyncGenerator[str, None]:
    idempotency_key = str(uuid.uuid4())
    chunk_queue: asyncio.Queue = asyncio.Queue()
    sent_length = 0
    active_run_id: Optional[str] = None
    stream_id = str(uuid.uuid4())
    
    expected_session_key = f"agent:{agent_id}:main"
    
    def on_chat_event(payload: dict):
        nonlocal sent_length, active_run_id
        
        if payload.get("sessionKey") != expected_session_key:
            return
        
        run_id = payload.get("runId")
        state = payload.get("state")
        
        # Latch de run_id bij het eerste delta event
        if active_run_id is None and state == "delta":
            active_run_id = run_id
        
        # Negeer events van andere runs (bijv. gelijktijdige requests)
        if run_id and active_run_id and run_id != active_run_id:
            return
        
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
    self._stream_queues[stream_id] = chunk_queue  # voor disconnect signaling
    
    agent_task = asyncio.create_task(self.call(
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
    
    try:
        start_time = asyncio.get_event_loop().time()
        while True:
            elapsed = asyncio.get_event_loop().time() - start_time
            remaining = timeout - elapsed
            if remaining <= 0:
                break
            
            try:
                kind, data = await asyncio.wait_for(
                    chunk_queue.get(),
                    timeout=min(30.0, remaining)
                )
                if kind == "delta":
                    yield data
                elif kind == "error":
                    raise RuntimeError(f"Stream interrupted: {data}")
                else:
                    break  # "done"
            except asyncio.TimeoutError:
                logger.warning(f"No chunk received in 30s for {agent_id}")
                break
    finally:
        if not agent_task.done():
            agent_task.cancel()
            try:
                await agent_task
            except (asyncio.CancelledError, Exception):
                pass
        self.unsubscribe("chat", on_chat_event)
        self._stream_queues.pop(stream_id, None)
```

### Fix #2: `_stream_queues` toevoegen aan `__init__` en `_listen_loop`

In `__init__`:
```python
self._stream_queues: dict[str, asyncio.Queue] = {}
```

In `_listen_loop` finally block (na `self._response_queues.clear()`):
```python
# Signal active stream queues of disconnect
for stream_id, sq in list(self._stream_queues.items()):
    try:
        sq.put_nowait(("error", "DISCONNECTED"))
    except asyncio.QueueFull:
        pass
# Note: niet clearen — de generator ruimt zelf op in zijn finally block
```

### Fix #3: Frontend `resp.ok` check + proper SSE parser

```typescript
const sendMessageStream = useCallback(async (text: string) => {
    // ... optimistic updates ...
    
    try {
        const resp = await fetch(
            `${API_BASE}/chat/${encodeURIComponent(sessionKey)}/stream`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: trimmed }),
            }
        )
        
        // ← Kritisch: check HTTP status vóór streamen
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: resp.statusText }))
            throw new Error(err.detail ?? `HTTP ${resp.status}`)
        }
        
        const reader = resp.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accumulated = ''
        let throttleTimer: ReturnType<typeof setTimeout> | null = null
        let pendingContent = ''
        
        const flushUpdate = () => {
            if (pendingContent !== accumulated) {
                accumulated = pendingContent
                setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, content: accumulated } : m
                ))
            }
        }
        
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            buffer += decoder.decode(value, { stream: true })
            
            // Split op SSE event boundary (double newline)
            const events = buffer.split('\n\n')
            buffer = events.pop() ?? ''
            
            for (const eventBlock of events) {
                const lines = eventBlock.split('\n')
                let eventType = 'message'
                let dataLine = ''
                
                for (const line of lines) {
                    if (line.startsWith('event: ')) eventType = line.slice(7).trim()
                    else if (line.startsWith('data: ')) dataLine = line.slice(6).trim()
                }
                
                if (eventType === 'delta' && dataLine) {
                    const data = JSON.parse(dataLine)
                    pendingContent += data.text
                    
                    // 80ms throttling: debounce state updates
                    if (!throttleTimer) {
                        throttleTimer = setTimeout(() => {
                            flushUpdate()
                            throttleTimer = null
                        }, 80)
                    }
                } else if (eventType === 'done') {
                    if (throttleTimer) clearTimeout(throttleTimer)
                    flushUpdate()
                    break
                }
            }
        }
        
        // Finale flush
        if (throttleTimer) clearTimeout(throttleTimer)
        flushUpdate()
        
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Streaming mislukt')
        // Verwijder lege assistant message bij fout
        setMessages(prev => prev.filter(m => m.id !== assistantId || m.content))
    } finally {
        setIsSending(false)
    }
}, [sessionKey, isSending])
```

---

## Conclusie

**Oordeel: Bijna klaar — 2 blocking issues moeten opgelost zijn vóór implementatie.**

| Issue | Ernst | Fix effort |
|-------|-------|------------|
| runId-filtering ontbreekt | 🔴 BLOCKING | ~30 min |
| Disconnect signaleert chunk_queue niet | 🔴 BLOCKING | ~45 min |
| Frontend resp.ok check ontbreekt | 🔴 BLOCKING | ~10 min |
| Active stream conflict check | 🟡 Sterk aanbevolen | ~45 min |
| Task cancellation bij disconnect | 🟡 Sterk aanbevolen | ~30 min |
| SSE parser verbetering | 🟡 Sterk aanbevolen | ~1 uur |
| Connection keep-alive header | 🟡 Aanbevolen | ~5 min |
| 80ms throttling frontend | 🟢 Prima zo | — |
| finally/unsubscribe structuur | 🟢 Correct ✅ | — |
| sessionKey validatie | 🟢 Goed ✅ | — |

De architectuur als geheel is goed doordacht: het gebruik van asyncio.Queue als bridge tussen WebSocket events en SSE response is de juiste aanpak. De unsubscribe cleanup in `finally` is correct. De fallback-structuur is logisch. Met de 3 kritische fixes (~1.5 uur werk) en de aanbevolen verbeteringen (~3 uur) is de implementatie robuust genoeg voor productiegebruik.

**Aanbevolen volgorde van implementatie:**
1. Fix runId-filtering + `_stream_queues` mechanisme (backend)
2. Fix `resp.ok` check + SSE parser (frontend)
3. Implementeer active stream conflict check (backend)
4. Task cancellation op disconnect (backend)
5. Rest: progressieve implementatie
