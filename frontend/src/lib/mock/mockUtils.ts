/**
 * Mock API — shared utilities: localStorage helpers, response builders, URL matcher
 */

// ─── localStorage persistence helpers ──────────────────────────

export const LS_PREFIX = 'crewhub-demo-'

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (raw) return JSON.parse(raw) as T
  } catch { /* ignore */ }
  return fallback
}

/* lsSet — available for future mutation persistence to localStorage
export function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)) } catch {}
}
*/

// ─── Mock Response Helpers ─────────────────────────────────────

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function okResponse(data?: unknown): Response {
  return jsonResponse(data ?? { success: true })
}

// ─── URL Matching (robust, handles absolute + relative) ────────

export function getApiPathname(input: string | URL | Request): string | null {
  try {
    let url: string
    if (typeof input === 'string') {
      url = input
    } else if (input instanceof URL) {
      url = input.toString()
    } else if (input instanceof Request) {
      url = input.url
    } else {
      return null
    }
    const parsed = new URL(url, window.location.origin)
    const pathname = parsed.pathname
    if (pathname.startsWith('/api/') || pathname === '/api') {
      return pathname
    }
    return null
  } catch {
    return null
  }
}
