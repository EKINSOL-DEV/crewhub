/**
 * Dev Mode Error Logging Store
 * Captures and persists frontend errors for debugging.
 * Only active in development mode.
 */

export interface DevError {
  id: string
  timestamp: number
  type: 'console.error' | 'unhandled-exception' | 'unhandled-rejection' | 'react-error' | 'custom'
  message: string
  stack?: string
  componentStack?: string
  source?: string // file/component where error occurred
  colno?: number
  lineno?: number
  userAgent: string
  url: string
}

const STORAGE_KEY = 'crewhub-dev-errors'
const MAX_ERRORS = 200

let listeners: Array<() => void> = []
let errorCache: DevError[] | null = null

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function getErrors(): DevError[] {
  if (errorCache) return errorCache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    errorCache = raw ? JSON.parse(raw) : []
  } catch {
    errorCache = []
  }
  return errorCache!
}

function saveErrors(errors: DevError[]) {
  errorCache = errors
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errors))
  } catch {
    // localStorage full - trim
    errorCache = errors.slice(-50)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errorCache))
  }
  listeners.forEach((fn) => fn())
}

export function addError(
  partial: Omit<DevError, 'id' | 'timestamp' | 'userAgent' | 'url'>
): DevError {
  const error: DevError = {
    ...partial,
    id: generateId(),
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  }
  const errors = [...getErrors(), error].slice(-MAX_ERRORS)
  saveErrors(errors)
  return error
}

export function getAllErrors(): DevError[] {
  return getErrors()
}

export function clearErrors() {
  saveErrors([])
}

export function getErrorCount(): number {
  return getErrors().length
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

// ── Global Error Capture Setup ─────────────────────────────────

let installed = false

export function installGlobalErrorCapture() {
  if (installed || import.meta.env.PROD) return
  installed = true

  // 1. window.onerror - uncaught exceptions
  const origOnError = window.onerror
  window.onerror = (message, source, lineno, colno, error) => {
    addError({
      type: 'unhandled-exception',
      message: String(message),
      stack: error?.stack,
      source: source || undefined,
      lineno: lineno || undefined,
      colno: colno || undefined,
    })
    if (origOnError) origOnError(message, source, lineno, colno, error)
  }

  // 2. unhandledrejection - unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    addError({
      type: 'unhandled-rejection',
      message: reason?.message || String(reason),
      stack: reason?.stack,
    })
  })

  // 3. Wrap console.error
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    // Skip React internal double-render warnings in strict mode
    const msg = args
      .map((a) => {
        if (a instanceof Error) return a.message
        if (typeof a === 'string') return a
        try {
          return JSON.stringify(a)
        } catch {
          return String(a)
        }
      })
      .join(' ')

    // Don't capture our own logging or trivial messages
    if (!msg.includes('DevErrorStore')) {
      addError({
        type: 'console.error',
        message: msg.slice(0, 2000),
        stack: args.find((a) => a instanceof Error)?.stack as string | undefined,
      })
    }

    origConsoleError.apply(console, args)
  }
}

// Helper for ErrorBoundary integration
export function captureReactError(error: Error, errorInfo?: { componentStack?: string }) {
  if (import.meta.env.PROD) return
  addError({
    type: 'react-error',
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack || undefined,
  })
}
