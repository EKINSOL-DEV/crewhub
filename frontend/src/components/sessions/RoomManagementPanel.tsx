import { useState } from 'react'
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
import { EditRoomDialog } from '@/components/shared/EditRoomDialog'
import { CreateRoomDialog } from '@/components/shared/CreateRoomDialog'
import { DeleteRoomDialog } from '@/components/shared/DeleteRoomDialog'
import { generateRoomId } from '@/components/shared/roomUtils'

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

  const [newRoom, setNewRoom] = useState({
    name: '',
    icon: '🏛️',
    color: '#4f46e5',
  })

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

      <CreateRoomDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        value={newRoom}
        onChange={setNewRoom}
        onCreate={handleCreateRoom}
      />

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

      <DeleteRoomDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null)
        }}
        onConfirm={() => deleteConfirm && handleDeleteRoom(deleteConfirm)}
      />
    </>
  )
}
