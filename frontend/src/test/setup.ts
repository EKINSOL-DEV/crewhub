import '@testing-library/jest-dom'

// Mock ResizeObserver which is not available in jsdom
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
  class ResizeObserver {
    observe() {
      /* no-op mock */
    }
    unobserve() {
      /* no-op mock */
    }
    disconnect() {
      /* no-op mock */
    }
  } as unknown as typeof ResizeObserver

// Mock window.matchMedia which is not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
