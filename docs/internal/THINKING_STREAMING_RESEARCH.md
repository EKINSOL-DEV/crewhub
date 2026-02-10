# Thinking Streaming Research

## Current State

### Frontend (`useAgentChat.ts`)
- Uses POST request to `/api/chat/{sessionKey}/send`
- Waits for full response before displaying
- Gets history via GET `/api/chat/{sessionKey}/history`
- Thinking blocks are only shown after the full response arrives (when `raw=true`)

### Backend (`routes/chat.py`)
- Marked as "Phase 1: non-streaming" in docstring
- POST `/api/chat/{sessionKey}/send` calls `conn.send_chat()` and waits for full response
- Returns complete response text, not streamed

### Gateway Connection (`services/connections/openclaw.py`)
- `send_chat()` method uses `call()` with `wait_for_final_agent_result=True`
- This is a request/response pattern, blocking until agent completes
- The Gateway uses WebSocket but for RPC-style calls, not streaming

### SSE Manager (`lib/sseManager.ts`)
- Central EventSource connection to `/api/events`
- Currently used for session events, task updates, etc.
- Could potentially be extended for chat streaming

## What Would Be Needed

### 1. OpenClaw Gateway API Support
- Check if Gateway supports streaming responses
- May need new WebSocket message type for streaming chunks
- Would need to emit thinking blocks as they're generated, not at the end

### 2. Backend Streaming Endpoint
Option A: Server-Sent Events (SSE)
```python
@router.get("/api/chat/{session_key}/stream")
async def stream_chat(session_key: str, message: str):
    async def event_generator():
        # Stream events as they arrive from gateway
        async for chunk in gateway.stream_chat(message):
            if chunk.type == "thinking":
                yield f"event: thinking\ndata: {json.dumps(chunk.content)}\n\n"
            elif chunk.type == "text":
                yield f"event: text\ndata: {json.dumps(chunk.content)}\n\n"
        yield f"event: done\ndata: {{}}\n\n"
    return EventSourceResponse(event_generator())
```

Option B: Reuse existing SSE connection
- Emit chat chunks on the existing `/api/events` SSE stream
- Filter by session key on the frontend

### 3. Frontend Hook Changes (`useAgentChat.ts`)

Would need new streaming variant:
```typescript
function useAgentChatStream(sessionKey: string) {
  const [streamingThinking, setStreamingThinking] = useState<string[]>([])
  const [streamingText, setStreamingText] = useState<string>("")
  
  const sendMessage = async (text: string) => {
    const eventSource = new EventSource(
      `/api/chat/${encodeURIComponent(sessionKey)}/stream?message=${encodeURIComponent(text)}`
    )
    
    eventSource.addEventListener('thinking', (e) => {
      setStreamingThinking(prev => [...prev, JSON.parse(e.data)])
    })
    
    eventSource.addEventListener('text', (e) => {
      setStreamingText(prev => prev + JSON.parse(e.data))
    })
    
    eventSource.addEventListener('done', () => {
      eventSource.close()
      // Finalize message
    })
  }
}
```

### 4. Chat Panel Updates (`ZenChatPanel.tsx`)
- Render streaming thinking blocks as they arrive
- Show partial text as it streams
- Indicate "still thinking" vs "complete" states

## Feasibility Assessment

### Blockers
1. **Gateway API**: Need to verify if OpenClaw Gateway supports streaming agent responses
2. **Anthropic API**: Claude's thinking blocks may only be available after response completion
3. **Latency**: SSE adds overhead vs WebSocket for bidirectional streaming

### Alternatives
1. **Polling**: Poll for partial results (not ideal, adds latency)
2. **WebSocket**: Use WebSocket for bidirectional chat streaming
3. **Wait for Gateway support**: If Gateway doesn't support streaming yet, wait for feature

## Recommendation

1. **Short term**: Keep current non-streaming approach, thinking blocks show after completion
2. **Medium term**: Add SSE streaming for text output (may be possible now)
3. **Long term**: Full thinking streaming when Gateway API supports it

## Files to Modify

If implementing streaming:
- `backend/app/routes/chat.py` - Add streaming endpoint
- `backend/app/services/connections/openclaw.py` - Add stream_chat method
- `frontend/src/hooks/useAgentChat.ts` - Add streaming support
- `frontend/src/components/zen/ZenChatPanel.tsx` - Render streaming thinking

## Next Steps

1. Check OpenClaw Gateway documentation for streaming support
2. Test if Gateway WebSocket emits intermediate thinking blocks
3. Prototype SSE endpoint for text streaming
4. Design incremental UI for streaming thinking display
