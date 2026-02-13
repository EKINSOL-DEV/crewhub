/**
 * Simple toast notification system using custom events.
 * Lightweight alternative to full toast library.
 */

export interface ToastEvent {
  message: string
  action?: { label: string; onClick: () => void }
  duration?: number
}

export function showToast(toast: ToastEvent) {
  window.dispatchEvent(new CustomEvent('crewhub-toast', { detail: toast }))
}
