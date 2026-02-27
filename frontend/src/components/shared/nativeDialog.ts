import { useEffect, type MouseEvent, type RefObject } from 'react'

export const NATIVE_DIALOG_CLASSNAME =
  'backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0'

export function useNativeDialogSync(
  dialogRef: RefObject<HTMLDialogElement | null>,
  isOpen: boolean
): void {
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) dialog.showModal()
      return
    }

    if (dialog.open) dialog.close()
  }, [dialogRef, isOpen])
}

export function closeOnDialogBackdropClick(
  event: MouseEvent<HTMLDialogElement>,
  onClose: () => void
): void {
  if (event.target === event.currentTarget) {
    onClose()
  }
}
