import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDemoMode } from '@/contexts/DemoContext'
import type { Room, FloorStyle, WallStyle } from '@/hooks/useRooms'

// ── Constants ──────────────────────────────────────────────────

const FLOOR_STYLES: { value: FloorStyle; label: string; icon: string }[] = [
  { value: 'default', label: 'Default', icon: '⬜' },
  { value: 'tiles', label: 'Tiles', icon: '🔲' },
  { value: 'wood', label: 'Wood', icon: '🪵' },
  { value: 'concrete', label: 'Concrete', icon: '🧱' },
  { value: 'carpet', label: 'Carpet', icon: '🟫' },
  { value: 'lab', label: 'Lab', icon: '🔬' },
  { value: 'marble', label: 'Marble', icon: '🤍' },
  { value: 'light-wood', label: 'Light Wood', icon: '🌾' },
  { value: 'light-tiles', label: 'Light Tiles', icon: '🏳️' },
  { value: 'sand', label: 'Sand', icon: '🏖️' },
]

const WALL_STYLES: { value: WallStyle; label: string; icon: string }[] = [
  { value: 'default', label: 'Default', icon: '⬜' },
  { value: 'accent-band', label: 'Accent Band', icon: '🟰' },
  { value: 'two-tone', label: 'Two-Tone', icon: '🔳' },
  { value: 'wainscoting', label: 'Wainscoting', icon: '📏' },
  { value: 'light', label: 'Light', icon: '☁️' },
  { value: 'pastel-band', label: 'Pastel Band', icon: '🌸' },
  { value: 'glass', label: 'Glass', icon: '🧊' },
]

const ROOM_ICONS = [
  '🏛️',
  '💻',
  '🎨',
  '🧠',
  '⚙️',
  '📡',
  '🛠️',
  '📢',
  '🚀',
  '📊',
  '🔬',
  '📝',
  '🎯',
  '💡',
  '🔧',
  '📦',
]
const ROOM_COLORS = [
  '#4f46e5',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#14b8a6',
  '#f97316',
  '#ec4899',
  '#3b82f6',
  '#ef4444',
  '#84cc16',
  '#a855f7',
  '#0ea5e9',
  '#f43f5e',
  '#22c55e',
  '#6366f1',
]

// ── Types ──────────────────────────────────────────────────────

interface EditRoomForm {
  name: string
  icon: string | null
  color: string | null
  floor_style: FloorStyle
  wall_style: WallStyle
}

interface EditRoomDialogProps {
  readonly room: Room | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSave: (
    roomId: string,
    updates: {
      name?: string
      icon?: string
      color?: string
      floor_style?: string
      wall_style?: string
    }
  ) => Promise<{ success: boolean; error?: string }>
}

// ── Component ──────────────────────────────────────────────────

export function EditRoomDialog({ room, open, onOpenChange, onSave }: EditRoomDialogProps) {
  const { isDemoMode } = useDemoMode()
  const [form, setForm] = useState<EditRoomForm | null>(null)
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Sync dialog open state with native dialog
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [open])

  // Reset form when room changes or dialog opens
  useEffect(() => {
    if (room && open) {
      setForm({
        name: room.name,
        icon: room.icon,
        color: room.color,
        floor_style: room.floor_style || 'default',
        wall_style: room.wall_style || 'default',
      })
    }
  }, [room, open])

  const handleSave = async () => {
    if (!room || !form) return
    setSaving(true)
    try {
      const result = await onSave(room.id, {
        name: form.name,
        icon: form.icon || undefined,
        color: form.color || undefined,
        floor_style: form.floor_style,
        wall_style: form.wall_style,
      })
      if (result.success) {
        onOpenChange(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setForm(null)
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={() => onOpenChange(false)}
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
      className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0"
      style={{ zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold">Edit Room</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Update room settings, floor texture, and wall style
          </p>
        </div>

        <div className="px-6 pb-4">
          {/* Demo mode warning */}
          {isDemoMode && (
            <div className="rounded-lg border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-3 text-sm text-amber-800 flex items-center gap-2 mb-4">
              <span>🎮</span>
              <span>
                <strong>Demo Mode</strong> — Changes won't be saved. Feel free to explore the
                options!
              </span>
            </div>
          )}

          {form && (
            <div className="grid grid-cols-2 gap-6 py-4 px-1 max-h-[70vh] overflow-y-auto">
              {/* Left column: Name, Icon, Color */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-room-name">Room Name</Label>
                  <Input
                    id="edit-room-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Icon</Label>
                  <div className="flex flex-wrap gap-2">
                    {ROOM_ICONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setForm({ ...form, icon })}
                        className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 transition-all ${
                          form.icon === icon
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
                    {ROOM_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm({ ...form, color: c })}
                        className={`w-8 h-8 rounded-full transition-all ${
                          form.color === c ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column: Floor Texture, Wall Style */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Floor Texture</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {FLOOR_STYLES.map((fs) => (
                      <button
                        key={fs.value}
                        onClick={() => setForm({ ...form, floor_style: fs.value })}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-sm transition-all ${
                          form.floor_style === fs.value
                            ? 'border-primary bg-primary/10 font-medium'
                            : 'border-border hover:border-muted-foreground'
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
                        onClick={() => setForm({ ...form, wall_style: ws.value })}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-sm transition-all ${
                          form.wall_style === ws.value
                            ? 'border-primary bg-primary/10 font-medium'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                      >
                        <span className="text-lg">{ws.icon}</span>
                        <span>{ws.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

// Re-export constants for use in other components
export { FLOOR_STYLES, WALL_STYLES, ROOM_ICONS, ROOM_COLORS }
