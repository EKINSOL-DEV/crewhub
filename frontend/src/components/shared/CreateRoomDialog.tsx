import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROOM_ICONS, ROOM_COLORS } from '@/components/shared/EditRoomDialog'
import { generateRoomId } from '@/components/shared/roomUtils'

interface NewRoomDraft {
  name: string
  icon: string
  color: string
}

interface CreateRoomDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly value: NewRoomDraft
  readonly onChange: (draft: NewRoomDraft) => void
  readonly onCreate: () => void
  readonly dialogClassName?: string
  readonly zIndexStyle?: number
}

export function CreateRoomDialog({
  open,
  onOpenChange,
  value,
  onChange,
  onCreate,
  dialogClassName = 'backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0',
  zIndexStyle,
}: CreateRoomDialogProps) {
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
          <h2 className="text-lg font-semibold">Create New Room</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Add a new workspace room for organizing your agents and sessions
          </p>
        </div>

        <div className="px-6 pb-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-name">Room Name</Label>
            <Input
              id="room-name"
              value={value.name}
              onChange={(event) => onChange({ ...value, name: event.target.value })}
              placeholder="e.g., Research Lab"
              onKeyDown={(event) => {
                if (event.key === 'Enter') onCreate()
              }}
            />
            {value.name && (
              <p className="text-xs text-muted-foreground">ID: {generateRoomId(value.name)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ROOM_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => onChange({ ...value, icon })}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 transition-all ${
                    value.icon === icon
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {ROOM_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onChange({ ...value, color })}
                  className={`w-8 h-8 rounded-full transition-all ${
                    value.color === color ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-muted/30">
            <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                style={{
                  backgroundColor: `${value.color}20`,
                  border: `2px solid ${value.color}`,
                }}
              >
                {value.icon}
              </div>
              <div>
                <div className="font-semibold">{value.name || 'Room Name'}</div>
                <div className="text-xs text-muted-foreground">
                  {value.name ? generateRoomId(value.name) : 'room-id'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreate}>Create Room</Button>
        </div>
      </div>
    </dialog>
  )
}

export type { NewRoomDraft }
