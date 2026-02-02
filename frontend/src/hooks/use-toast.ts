import { useCallback } from "react"

interface Toast {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

export function useToast() {
  const toast = useCallback(({ title, description, variant }: Toast) => {
    const message = description ? `${title}: ${description}` : title
    if (variant === "destructive") {
      console.error(message)
    } else {
      console.log(message)
    }
  }, [])

  return { toast }
}
