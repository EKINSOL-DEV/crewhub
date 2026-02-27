import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface DeleteRoomDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onConfirm: () => void
  readonly dialogClassName?: string
  readonly zIndexStyle?: number
}

export function DeleteRoomDialog({
  open,
  onOpenChange,
  onConfirm,
  dialogClassName = 'backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0',
  zIndexStyle,
}: DeleteRoomDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog // NOSONAR: <dialog> is a native interactive HTML element
      ref={dialogRef}
      onClose={() => onOpenChange(false)}
      onClick={(event) => event.target === event.currentTarget && onOpenChange(false)}
      className={dialogClassName}
      style={zIndexStyle ? { zIndex: zIndexStyle } : undefined}
    >
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold">Delete Room?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This will remove the room and unassign any sessions from it. This action cannot be
            undone.
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete Room
          </Button>
        </div>
      </div>
    </dialog>
  )
}
