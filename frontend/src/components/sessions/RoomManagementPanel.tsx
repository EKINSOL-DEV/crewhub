import { useState, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useRooms, type Room } from '@/hooks/useRooms'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2, GripVertical, Edit2, Check, X } from 'lucide-react'
import { EditRoomDialog, ROOM_ICONS, ROOM_COLORS } from '@/components/shared/EditRoomDialog'
import {
  NATIVE_DIALOG_CLASSNAME,
  closeOnDialogBackdropClick,
  useNativeDialogSync,
} from '@/components/shared/nativeDialog'

interface RoomManagementPanelProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function RoomManagementPanel({ open, onOpenChange }: RoomManagementPanelProps) {
  const { rooms, createRoom, updateRoom, deleteRoom, reorderRooms, isLoading } = useRooms()
  const { toast } = useToast()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Native dialog refs
  const createDialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)

  // New room form state
  const [newRoom, setNewRoom] = useState({
    name: '',
    icon: '🏛️',
    color: '#4f46e5',
  })

  useNativeDialogSync(createDialogRef, showCreateDialog)
  useNativeDialogSync(deleteDialogRef, Boolean(deleteConfirm))

  const generateRoomId = (name: string) => {
    return (
      name
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/(^-|-$)/g, '') + '-room'
    )
  }

  const handleCreateRoom = async () => {
    if (!newRoom.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a room name',
        variant: 'destructive',
      })
      return
    }

    const roomId = generateRoomId(newRoom.name)
    const result = await createRoom({
      id: roomId,
      name: newRoom.name.trim(),
      icon: newRoom.icon,
      color: newRoom.color,
      sort_order: rooms.length,
    })

    if (result.success) {
      toast({ title: 'Room Created!', description: `${newRoom.icon} ${newRoom.name} is ready` })
      setShowCreateDialog(false)
      setNewRoom({ name: '', icon: '🏛️', color: '#4f46e5' })
    } else {
      toast({ title: 'Failed to create room', description: result.error, variant: 'destructive' })
    }
  }

  const handleUpdateRoom = async (room: Room) => {
    const result = await updateRoom(room.id, {
      name: room.name,
      icon: room.icon || undefined,
      color: room.color || undefined,
    })

    if (result.success) {
      toast({ title: 'Room Updated!', description: `${room.icon} ${room.name} saved` })
      setEditingRoom(null)
    } else {
      toast({ title: 'Failed to update room', description: result.error, variant: 'destructive' })
    }
  }

  const handleEditRoomSave = async (
    roomId: string,
    updates: {
      name?: string
      icon?: string
      color?: string
      floor_style?: string
      wall_style?: string
    }
  ) => {
    const result = await updateRoom(roomId, updates)
    if (result.success) {
      toast({
        title: 'Room Updated!',
        description: `${updates.icon || '🏠'} ${updates.name || ''} saved`,
      })
      setEditingRoom(null)
    } else {
      toast({ title: 'Failed to update room', description: result.error, variant: 'destructive' })
    }
    return result
  }

  const openEditDialog = (room: Room) => {
    setEditingRoom(room)
    setShowEditDialog(true)
  }

  const handleDeleteRoom = async (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId)
    const result = await deleteRoom(roomId)

    if (result.success) {
      toast({ title: 'Room Deleted', description: `${room?.icon} ${room?.name} removed` })
      setDeleteConfirm(null)
    } else {
      toast({ title: 'Failed to delete room', description: result.error, variant: 'destructive' })
    }
  }

  const moveRoom = async (roomId: string, direction: 'up' | 'down') => {
    const currentIndex = rooms.findIndex((r) => r.id === roomId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= rooms.length) return

    const newOrder = [...rooms.map((r) => r.id)]
    ;[newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]]

    await reorderRooms(newOrder)
  }

  const sortedRooms = [...rooms].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[450px] sm:max-w-[450px]">
          <SheetHeader>
            <SheetTitle>🏢 Room Management</SheetTitle>
            <SheetDescription>Create, edit, and organize your workspace rooms</SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
            <Button onClick={() => setShowCreateDialog(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Create New Room
            </Button>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Rooms ({rooms.length})</Label>

              {(() => {
                if (isLoading) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">Loading rooms...</div>
                  )
                }

                if (sortedRooms.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      No rooms yet. Create one!
                    </div>
                  )
                }

                return (
                  <div className="space-y-2">
                    {sortedRooms.map((room, index) => (
                      <div
                        key={room.id}
                        className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveRoom(room.id, 'up')}
                            disabled={index === 0}
                            className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                          >
                            <GripVertical className="h-3 w-3 rotate-90" />
                          </button>
                          <button
                            onClick={() => moveRoom(room.id, 'down')}
                            disabled={index === sortedRooms.length - 1}
                            className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                          >
                            <GripVertical className="h-3 w-3 -rotate-90" />
                          </button>
                        </div>

                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{
                            backgroundColor: `${room.color}20`,
                            border: `2px solid ${room.color}`,
                          }}
                        >
                          {room.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          {editingRoom?.id === room.id ? (
                            <div className="flex gap-2">
                              <Input
                                value={editingRoom.name}
                                onChange={(e) =>
                                  setEditingRoom({ ...editingRoom, name: e.target.value })
                                }
                                className="h-8"
                                autoFocus
                              />
                              <button
                                onClick={() => handleUpdateRoom(editingRoom)}
                                className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingRoom(null)}
                                className="p-1.5 hover:bg-muted rounded text-muted-foreground"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="font-medium truncate flex items-center gap-1.5">
                                {room.name}
                                {room.is_hq && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                                    style={{ backgroundColor: 'var(--zen-accent, #6366f1)' }}
                                    title="Protected system room — cannot be deleted"
                                  >
                                    🏢 HQ
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {room.id}
                              </div>
                            </>
                          )}
                        </div>

                        {editingRoom?.id !== room.id && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEditDialog(room)}
                              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {!room.is_hq && (
                              <button
                                onClick={() => setDeleteConfirm(room.id)}
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-muted-foreground hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Room Dialog */}
      <dialog // NOSONAR: <dialog> is a native interactive HTML element
        ref={createDialogRef}
        onClose={() => setShowCreateDialog(false)}
        onClick={(e) => closeOnDialogBackdropClick(e, () => setShowCreateDialog(false))}
        className={NATIVE_DIALOG_CLASSNAME}
      >
        <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden">
          {/* Header */}
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
                value={newRoom.name}
                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                placeholder="e.g., Research Lab"
              />
              {newRoom.name && (
                <p className="text-xs text-muted-foreground">ID: {generateRoomId(newRoom.name)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {ROOM_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setNewRoom({ ...newRoom, icon })}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 transition-all ${
                      newRoom.icon === icon
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
                    onClick={() => setNewRoom({ ...newRoom, color })}
                    className={`w-8 h-8 rounded-full transition-all ${
                      newRoom.color === color
                        ? 'ring-2 ring-offset-2 ring-primary'
                        : 'hover:scale-110'
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
                    backgroundColor: `${newRoom.color}20`,
                    border: `2px solid ${newRoom.color}`,
                  }}
                >
                  {newRoom.icon}
                </div>
                <div>
                  <div className="font-semibold">{newRoom.name || 'Room Name'}</div>
                  <div className="text-xs text-muted-foreground">
                    {newRoom.name ? generateRoomId(newRoom.name) : 'room-id'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRoom}>Create Room</Button>
          </div>
        </div>
      </dialog>

      {/* Edit Room Dialog (shared component) */}
      <EditRoomDialog
        room={editingRoom}
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open)
          if (!open) setEditingRoom(null)
        }}
        onSave={handleEditRoomSave}
      />

      {/* Delete Confirmation Dialog */}
      <dialog // NOSONAR: <dialog> is a native interactive HTML element
        ref={deleteDialogRef}
        onClose={() => setDeleteConfirm(null)}
        onClick={(e) => closeOnDialogBackdropClick(e, () => setDeleteConfirm(null))}
        className={NATIVE_DIALOG_CLASSNAME}
      >
        <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold">Delete Room?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This will remove the room and unassign any sessions from it. This action cannot be
              undone.
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteRoom(deleteConfirm)}
            >
              Delete Room
            </Button>
          </div>
        </div>
      </dialog>
    </>
  )
}
