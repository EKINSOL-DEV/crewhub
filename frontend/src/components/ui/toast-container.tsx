import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { ToastEvent } from '@/lib/toast'

interface Toast extends ToastEvent {
  id: number
}

let toastId = 0

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastEvent>).detail
      const id = ++toastId
      setToasts(prev => [...prev, { ...detail, id }])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, detail.duration || 5000)
    }
    window.addEventListener('crewhub-toast', handler)
    return () => window.removeEventListener('crewhub-toast', handler)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={cn(
            "bg-background border rounded-lg shadow-lg p-3 flex items-center gap-3",
            "animate-in slide-in-from-bottom-5 fade-in duration-300"
          )}
        >
          <span className="text-sm flex-1">{toast.message}</span>
          {toast.action && (
            <button
              className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
              onClick={() => {
                toast.action!.onClick()
                dismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
