import { useCallback } from 'react'

interface Toast {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

/**
 * Lightweight toast hook for notifications.
 * Currently logs to console; can be extended with a proper toast UI library.
 */
export function useToast() {
  const toast = useCallback(({ title, description, variant }: Toast) => {
    // Only log errors to console in production
    // Regular toasts are silent (extend with UI library as needed)
    if (variant === 'destructive') {
      const message = description ? `${title}: ${description}` : title
      console.error(`[Toast] ${message}`)
    }
  }, [])

  return { toast }
}
