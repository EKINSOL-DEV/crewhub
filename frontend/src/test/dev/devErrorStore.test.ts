/**
 * Tests for src/lib/devErrorStore.ts
 *
 * Note: The store uses localStorage and module-level state.
 * We reset between tests via clearErrors().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Setup: must be in DEV mode ───────────────────────────────────
vi.stubEnv('DEV', true)
vi.stubEnv('PROD', false)

// ─── Minimal localStorage mock (jsdom provides one) ───────────────

import {
  addError,
  getAllErrors,
  clearErrors,
  getErrorCount,
  subscribe,
  captureReactError,
  installGlobalErrorCapture,
} from '@/lib/devErrorStore'

beforeEach(() => {
  clearErrors()
})

// ─── addError & getAllErrors ───────────────────────────────────────

describe('addError', () => {
  it('returns a DevError with all required fields', () => {
    const err = addError({ type: 'custom', message: 'test error' })
    expect(err.id).toBeTruthy()
    expect(err.timestamp).toBeGreaterThan(0)
    expect(err.message).toBe('test error')
    expect(err.type).toBe('custom')
    expect(err.url).toBeTruthy()
    expect(err.userAgent).toBeTruthy()
  })

  it('adds error to getAllErrors()', () => {
    addError({ type: 'custom', message: 'hello' })
    const all = getAllErrors()
    expect(all.length).toBe(1)
    expect(all[0].message).toBe('hello')
  })

  it('accumulates multiple errors', () => {
    addError({ type: 'custom', message: 'first' })
    addError({ type: 'console.error', message: 'second' })
    expect(getAllErrors().length).toBe(2)
  })

  it('assigns unique ids to each error', () => {
    const e1 = addError({ type: 'custom', message: 'a' })
    const e2 = addError({ type: 'custom', message: 'b' })
    expect(e1.id).not.toBe(e2.id)
  })

  it('persists optional fields (stack, source, lineno, colno)', () => {
    const err = addError({
      type: 'unhandled-exception',
      message: 'boom',
      stack: 'Error at foo.ts:10',
      source: 'foo.ts',
      lineno: 10,
      colno: 5,
    })
    expect(err.stack).toBe('Error at foo.ts:10')
    expect(err.source).toBe('foo.ts')
    expect(err.lineno).toBe(10)
    expect(err.colno).toBe(5)
  })

  it('stores componentStack when provided', () => {
    const err = addError({
      type: 'react-error',
      message: 'render crash',
      componentStack: '  at MyComponent\n  at App',
    })
    expect(err.componentStack).toContain('MyComponent')
  })
})

// ─── getErrorCount ────────────────────────────────────────────────

describe('getErrorCount', () => {
  it('returns 0 when store is empty', () => {
    expect(getErrorCount()).toBe(0)
  })

  it('returns correct count after adding errors', () => {
    addError({ type: 'custom', message: 'x' })
    addError({ type: 'custom', message: 'y' })
    expect(getErrorCount()).toBe(2)
  })

  it('returns 0 after clearErrors', () => {
    addError({ type: 'custom', message: 'x' })
    clearErrors()
    expect(getErrorCount()).toBe(0)
  })
})

// ─── clearErrors ──────────────────────────────────────────────────

describe('clearErrors', () => {
  it('empties the error list', () => {
    addError({ type: 'custom', message: 'x' })
    addError({ type: 'custom', message: 'y' })
    clearErrors()
    expect(getAllErrors().length).toBe(0)
  })

  it('is safe to call on empty store', () => {
    expect(() => clearErrors()).not.toThrow()
  })
})

// ─── subscribe / unsubscribe ──────────────────────────────────────

describe('subscribe', () => {
  it('calls listener when error is added', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)
    addError({ type: 'custom', message: 'event' })
    unsubscribe()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('calls listener when errors are cleared', () => {
    addError({ type: 'custom', message: 'pre' })
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)
    clearErrors()
    unsubscribe()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops calling listener after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)
    unsubscribe()
    addError({ type: 'custom', message: 'after' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('supports multiple listeners simultaneously', () => {
    const l1 = vi.fn()
    const l2 = vi.fn()
    const u1 = subscribe(l1)
    const u2 = subscribe(l2)
    addError({ type: 'custom', message: 'multi' })
    u1()
    u2()
    expect(l1).toHaveBeenCalledTimes(1)
    expect(l2).toHaveBeenCalledTimes(1)
  })
})

// ─── captureReactError ────────────────────────────────────────────

describe('captureReactError', () => {
  it('adds a react-error type error', () => {
    captureReactError(new Error('React crash'))
    const errors = getAllErrors()
    expect(errors.length).toBe(1)
    expect(errors[0].type).toBe('react-error')
    expect(errors[0].message).toBe('React crash')
  })

  it('includes componentStack when provided', () => {
    captureReactError(new Error('crash'), { componentStack: '  at MyComp' })
    const errors = getAllErrors()
    expect(errors[0].componentStack).toContain('MyComp')
  })

  it('preserves error stack', () => {
    const err = new Error('with stack')
    captureReactError(err)
    const errors = getAllErrors()
    expect(errors[0].stack).toBeTruthy()
  })

  it('is safe when errorInfo is omitted', () => {
    expect(() => captureReactError(new Error('no info'))).not.toThrow()
    expect(getAllErrors().length).toBe(1)
  })
})

// ─── installGlobalErrorCapture ────────────────────────────────────

describe('installGlobalErrorCapture', () => {
  it('runs without error', () => {
    expect(() => installGlobalErrorCapture()).not.toThrow()
  })

  it('is idempotent (can be called multiple times)', () => {
    expect(() => {
      installGlobalErrorCapture()
      installGlobalErrorCapture()
      installGlobalErrorCapture()
    }).not.toThrow()
  })
})

// ─── MAX_ERRORS cap ───────────────────────────────────────────────

describe('MAX_ERRORS cap', () => {
  it('keeps at most 200 errors', () => {
    // Add 205 errors
    for (let i = 0; i < 205; i++) {
      addError({ type: 'custom', message: `error-${i}` })
    }
    expect(getAllErrors().length).toBeLessThanOrEqual(200)
  })
})
