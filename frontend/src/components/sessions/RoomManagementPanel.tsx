import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useRooms, type Room, type FloorStyle, type WallStyle } from "@/hooks/useRooms"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, GripVertical, Edit2, Check, X } from "lucide-react"

const FLOOR_STYLES: { value: FloorStyle; label: string; icon: string }[] = [
  { value: 'default', label: 'Default', icon: '⬜' },
  { value: 'tiles', label: 'Tiles', icon: '🔲' },
  { value: 'wood', label: 'Wood', icon: '🪵' },
  { value: 'concrete', label: 'Concrete', icon: '🧱' },
  { value: 'carpet', label: 'Carpet', icon: '🟫' },
  { value: 'lab', label: 'Lab', icon: '🔬' },
]

const WALL_STYLES: { value: WallStyle; label: string; icon: string }[] = [
  { value: 'default', label: 'Default', icon: '⬜' },
  { value: 'accent-band', label: 'Accent Band', icon: '🟰' },
  { value: 'two-tone', label: 'Two-Tone', icon: '🔳' },
  { value: 'wainscoting', label: 'Wainscoting', icon: '📏' },
]

interface RoomManagementPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ROOM_ICONS = ["🏛️", "💻", "🎨", "🧠", "⚙️", "📡", "🛠️", "📢", "🚀", "📊", "🔬", "📝", "🎯", "💡", "🔧", "📦"]
const ROOM_COLORS = [
  "#4f46e5", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#14b8a6", "#f97316", "#ec4899",
  "#3b82f6", "#ef4444", "#84cc16", "#a855f7", "#0ea5e9", "#f43f5e", "#22c55e", "#6366f1"
]

export function RoomManagementPanel({ open, onOpenChange }: RoomManagementPanelProps) {
  const { rooms, createRoom, updateRoom, deleteRoom, reorderRooms, isLoading } = useRooms()
  const { toast } = useToast()
  
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editFormRoom, setEditFormRoom] = useState<{
    name: string; icon: string | null; color: string | null
    floor_style: FloorStyle; wall_style: WallStyle
  } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  // New room form state
  const [newRoom, setNewRoom] = useState({
    name: "",
    icon: "🏛️",
    color: "#4f46e5"
  })

  const generateRoomId = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-room"
  }

  const handleCreateRoom = async () => {
    if (!newRoom.name.trim()) {
      toast({ title: "Name required", description: "Please enter a room name", variant: "destructive" })
      return
    }
    
    const roomId = generateRoomId(newRoom.name)
    const result = await createRoom({
      id: roomId,
      name: newRoom.name.trim(),
      icon: newRoom.icon,
      color: newRoom.color,
      sort_order: rooms.length
    })
    
    if (result.success) {
      toast({ title: "Room Created!", description: `${newRoom.icon} ${newRoom.name} is ready` })
      setShowCreateDialog(false)
      setNewRoom({ name: "", icon: "🏛️", color: "#4f46e5" })
    } else {
      toast({ title: "Failed to create room", description: result.error, variant: "destructive" })
    }
  }

  const handleUpdateRoom = async (room: Room) => {
    const result = await updateRoom(room.id, {
      name: room.name,
      icon: room.icon || undefined,
      color: room.color || undefined
    })
    
    if (result.success) {
      toast({ title: "Room Updated!", description: `${room.icon} ${room.name} saved` })
      setEditingRoom(null)
    } else {
      toast({ title: "Failed to update room", description: result.error, variant: "destructive" })
    }
  }

  const handleUpdateRoomStyles = async () => {
    if (!editingRoom || !editFormRoom) return
    const result = await updateRoom(editingRoom.id, {
      name: editFormRoom.name,
      icon: editFormRoom.icon || undefined,
      color: editFormRoom.color || undefined,
      floor_style: editFormRoom.floor_style,
      wall_style: editFormRoom.wall_style,
    })
    if (result.success) {
      toast({ title: "Room Updated!", description: `${editFormRoom.icon} ${editFormRoom.name} saved` })
      setShowEditDialog(false)
      setEditingRoom(null)
      setEditFormRoom(null)
    } else {
      toast({ title: "Failed to update room", description: result.error, variant: "destructive" })
    }
  }

  const openEditDialog = (room: Room) => {
    setEditingRoom(room)
    setEditFormRoom({
      name: room.name,
      icon: room.icon,
      color: room.color,
      floor_style: room.floor_style || 'default',
      wall_style: room.wall_style || 'default',
    })
    setShowEditDialog(true)
  }

  const handleDeleteRoom = async (roomId: string) => {
    const room = rooms.find(r => r.id === roomId)
    const result = await deleteRoom(roomId)
    
    if (result.success) {
      toast({ title: "Room Deleted", description: `${room?.icon} ${room?.name} removed` })
      setDeleteConfirm(null)
    } else {
      toast({ title: "Failed to delete room", description: result.error, variant: "destructive" })
    }
  }

  const moveRoom = async (roomId: string, direction: "up" | "down") => {
    const currentIndex = rooms.findIndex(r => r.id === roomId)
    if (currentIndex === -1) return
    
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= rooms.length) return
    
    const newOrder = [...rooms.map(r => r.id)]
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
              
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading rooms...</div>
              ) : sortedRooms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No rooms yet. Create one!</div>
              ) : (
                <div className="space-y-2">
                  {sortedRooms.map((room, index) => (
                    <div
                      key={room.id}
                      className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveRoom(room.id, "up")}
                          disabled={index === 0}
                          className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                        >
                          <GripVertical className="h-3 w-3 rotate-90" />
                        </button>
                        <button
                          onClick={() => moveRoom(room.id, "down")}
                          disabled={index === sortedRooms.length - 1}
                          className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                        >
                          <GripVertical className="h-3 w-3 -rotate-90" />
                        </button>
                      </div>
                      
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                        style={{ backgroundColor: `${room.color}20`, border: `2px solid ${room.color}` }}
                      >
                        {room.icon}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {editingRoom?.id === room.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={editingRoom.name}
                              onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
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
                            <div className="font-medium truncate">{room.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{room.id}</div>
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
                          <button
                            onClick={() => setDeleteConfirm(room.id)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-muted-foreground hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Room Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Room</DialogTitle>
            <DialogDescription>
              Add a new workspace room for organizing your agents and sessions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="room-name">Room Name</Label>
              <Input
                id="room-name"
                value={newRoom.name}
                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                placeholder="e.g., Research Lab"
              />
              {newRoom.name && (
                <p className="text-xs text-muted-foreground">
                  ID: {generateRoomId(newRoom.name)}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {ROOM_ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewRoom({ ...newRoom, icon })}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 transition-all ${
                      newRoom.icon === icon 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-muted-foreground"
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
                {ROOM_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewRoom({ ...newRoom, color })}
                    className={`w-8 h-8 rounded-full transition-all ${
                      newRoom.color === color 
                        ? "ring-2 ring-offset-2 ring-primary" 
                        : "hover:scale-110"
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
                  style={{ backgroundColor: `${newRoom.color}20`, border: `2px solid ${newRoom.color}` }}
                >
                  {newRoom.icon}
                </div>
                <div>
                  <div className="font-semibold">{newRoom.name || "Room Name"}</div>
                  <div className="text-xs text-muted-foreground">
                    {newRoom.name ? generateRoomId(newRoom.name) : "room-id"}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateRoom}>Create Room</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) { setEditingRoom(null); setEditFormRoom(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
            <DialogDescription>
              Update room settings, floor texture, and wall style
            </DialogDescription>
          </DialogHeader>

          {editFormRoom && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="edit-room-name">Room Name</Label>
                <Input
                  id="edit-room-name"
                  value={editFormRoom.name}
                  onChange={(e) => setEditFormRoom({ ...editFormRoom, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {ROOM_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setEditFormRoom({ ...editFormRoom, icon })}
                      className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 transition-all ${
                        editFormRoom.icon === icon
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground"
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
                  {ROOM_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditFormRoom({ ...editFormRoom, color: c })}
                      className={`w-8 h-8 rounded-full transition-all ${
                        editFormRoom.color === c
                          ? "ring-2 ring-offset-2 ring-primary"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Floor Texture</Label>
                <div className="grid grid-cols-3 gap-2">
                  {FLOOR_STYLES.map((fs) => (
                    <button
                      key={fs.value}
                      onClick={() => setEditFormRoom({ ...editFormRoom, floor_style: fs.value })}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-sm transition-all ${
                        editFormRoom.floor_style === fs.value
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <span className="text-lg">{fs.icon}</span>
                      <span>{fs.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Wall Style</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WALL_STYLES.map((ws) => (
                    <button
                      key={ws.value}
                      onClick={() => setEditFormRoom({ ...editFormRoom, wall_style: ws.value })}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-sm transition-all ${
                        editFormRoom.wall_style === ws.value
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <span className="text-lg">{ws.icon}</span>
                      <span>{ws.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingRoom(null); setEditFormRoom(null) }}>Cancel</Button>
            <Button onClick={handleUpdateRoomStyles}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room?</DialogTitle>
            <DialogDescription>
              This will remove the room and unassign any sessions from it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDeleteRoom(deleteConfirm)}>
              Delete Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
