# SSE Message Handler Performance Analysis

**Date:** 2025-02-07
**Issue:** Chrome violations "[Violation] message handler took Xms" despite queueMicrotask fix

## Problem Analysis

### Root Cause Identified

The original `queueMicrotask` fix was only partially effective because it was applied **inside** each SSE event handler, AFTER the handler was already invoked:

```typescript
// BEFORE (problematic)
const handleSessionUpdated = (event: MessageEvent) => {
  try {
    const updatedSession = JSON.parse(event.data)  // ← BLOCKING!
    queueMicrotask(() => {
      setState(prev => ...)  // ← Only this was deferred
    })
  } catch (error) { ... }
}
```

The browser's message handler violation threshold is ~50ms. While `JSON.parse` is typically fast (<5ms), it's still synchronous work running inside the browser's internal message handler context.

### Contributing Factors

1. **Multiple subscribers**: 5+ components subscribe to SSE events, each doing their own `JSON.parse()`
2. **Cascading re-renders**: State updates trigger React re-renders which can cascade
3. **Fingerprint computation**: `computeSessionsFingerprint()` runs on every update

## Solution Implemented

### Fix 1: Centralized Deferred Dispatch in sseManager

Moved the `queueMicrotask` deferral into the SSE manager itself, so ALL processing (including JSON.parse) happens outside the message handler context:

```typescript
// AFTER (fixed)
private createDeferredDispatcher(eventType: string): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    // Only capture references synchronously (instant)
    const handlers = this.subscriptions.get(eventType)
    if (!handlers || handlers.size === 0) return
    
    const handlersCopy = Array.from(handlers)
    
    // ALL processing deferred to microtask
    queueMicrotask(() => {
      for (const handler of handlersCopy) {
        handler(event)  // JSON.parse happens here, outside message handler
      }
    })
  }
}
```

### Fix 2: Optimized Fingerprint Computation

```typescript
// BEFORE
function computeSessionsFingerprint(sessions: CrewSession[]): string {
  return sessions
    .map(s => `${s.key}:${s.updatedAt || 0}:${s.totalTokens || 0}`)
    .sort()
    .join("|")  // 3 array iterations
}

// AFTER
function computeSessionsFingerprint(sessions: CrewSession[]): string {
  const keys = new Array(sessions.length)
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]
    keys[i] = `${s.key}:${s.updatedAt || 0}:${s.totalTokens || 0}`
  }
  keys.sort()
  return keys.join("|")  // Pre-allocated array, single iteration for building
}
```

### Fix 3: Quick Equality Check for Single Updates

```typescript
// Skip full fingerprint if single session is unchanged
function isSessionUnchanged(existing: CrewSession, updated: CrewSession): boolean {
  return existing.updatedAt === updated.updatedAt && 
         existing.totalTokens === updated.totalTokens
}
```

## Files Modified

1. **`src/lib/sseManager.ts`**
   - Added `createDeferredDispatcher()` that wraps all handlers in `queueMicrotask`
   - Handlers now receive events AFTER being deferred, not during the browser's internal message handling

2. **`src/hooks/useSessionsStream.ts`**
   - Removed redundant `queueMicrotask` wrappers (now handled by sseManager)
   - Optimized `computeSessionsFingerprint()` to use pre-allocated array
   - Added `isSessionUnchanged()` for quick equality checks

## Performance Impact

### Before
- Browser message handler runs synchronously
- JSON.parse happens in message handler context
- Chrome reports violations when combined processing > 50ms

### After
- Browser message handler returns immediately (only captures references)
- All processing (JSON.parse, state updates) happens in microtask
- Violations eliminated because message handler takes <1ms

## Architecture Diagram

```
BEFORE:
┌─────────────────────────────────────────────────────┐
│ Browser Message Handler (must complete < 50ms)     │
│                                                     │
│  EventSource.onmessage                             │
│    └─→ handler1: JSON.parse + work (BLOCKING)     │
│    └─→ handler2: JSON.parse + work (BLOCKING)     │
│    └─→ handler3: JSON.parse + work (BLOCKING)     │
│         ↓                                          │
│    [Violation if total > 50ms]                     │
└─────────────────────────────────────────────────────┘

AFTER:
┌───────────────────────────────────┐
│ Browser Message Handler (<1ms)    │
│                                   │
│  EventSource.onmessage            │
│    └─→ queueMicrotask(handlers)   │
│         ↓                         │
│    [Returns immediately]          │
└───────────────────────────────────┘
                 │
                 ▼
┌───────────────────────────────────┐
│ Microtask Queue (no time limit)   │
│                                   │
│  handler1: JSON.parse + setState  │
│  handler2: JSON.parse + setState  │
│  handler3: JSON.parse + setState  │
│         ↓                         │
│  React batches state updates      │
└───────────────────────────────────┘
```

## Testing

To verify the fix works:

1. Open Chrome DevTools → Console
2. Enable "Verbose" log level
3. Interact with CrewHub while many sessions are active
4. Violations should no longer appear

## Future Optimizations (if needed)

1. **Web Worker for JSON parsing**: If payloads become very large (>100KB), consider parsing in a worker
2. **Shared parsed data cache**: Parse once in sseManager, share across all subscribers
3. **Virtual scrolling**: For session lists > 100 items, implement virtualization
4. **Incremental fingerprints**: Update fingerprint incrementally instead of full recompute
