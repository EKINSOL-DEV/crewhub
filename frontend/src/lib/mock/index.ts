/**
 * Mock API Layer for Demo Mode
 *
 * Intercepts all /api/* requests when VITE_DEMO_MODE=true.
 * Returns realistic mock data so the entire frontend runs without a backend.
 *
 * Features:
 * - Monkey-patches window.fetch for /api/* routes
 * - Installs a mock EventSource for SSE /api/events
 * - Emits periodic session-update events to trigger bot movement
 * - Persists user edits (rooms, assignments, settings) to localStorage
 * - Bypasses onboarding
 */

import { createMockEventSource } from './mockSessions'
import { handleMockRequest } from './mockRouter'
import { getApiPathname, okResponse, lsGet } from './mockUtils'
import { MOCK_SETTINGS } from './mockSettings'

// Re-exports for backward compatibility
export * from './types'
export * from './mockRooms'
export * from './mockAgents'
export * from './mockProjects'
export * from './mockTasks'
export * from './mockSettings'
export * from './mockSessions'
export * from './mockUtils'
export * from './mockRouter'

// ─── Main Setup ────────────────────────────────────────────────

export function setupMockApi() {
  console.log('[MockAPI] 🎬 Setting up demo mode mock API...')

  // 1. Patch window.fetch
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const pathname = getApiPathname(input as string | URL | Request)

    // Not an /api/ request — pass through
    if (!pathname) {
      return originalFetch(input, init)
    }

    const method = init?.method?.toUpperCase() || 'GET'

    // Add tiny delay to simulate network
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 80))

    // Try to handle with mock router
    const response = handleMockRequest(pathname, method, init?.body)
    if (response) return response

    // Fallback: unhandled mutations succeed silently
    if (method !== 'GET') {
      console.warn(`[MockAPI] Unhandled mutation: ${method} ${pathname} → 200 (no-op)`)
      return okResponse()
    }

    // Unhandled GET — warn and 404
    console.warn(`[MockAPI] ⚠ Unhandled GET: ${pathname} → 404`)
    return new Response(JSON.stringify({ detail: 'Not found (demo mode)' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Patch EventSource for SSE
  createMockEventSource()

  // 3. Auto-enable demo mode in localStorage
  localStorage.setItem('crewhub-demo-mode', 'true')

  // 4. Skip onboarding
  localStorage.setItem('crewhub-onboarded', 'true')

  // 5. Set default settings in localStorage for immediate availability
  const settings = lsGet('settings', MOCK_SETTINGS)
  for (const [key, value] of Object.entries(settings)) {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, value)
    }
  }

  // 6. Add noindex meta tag for demo builds
  if (!document.querySelector('meta[name="robots"]')) {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
  }

  console.log('[MockAPI] ✅ Demo mode ready — all /api/* requests intercepted')
}
