import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Eye,
  GripVertical,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRooms, type Room } from '@/hooks/useRooms'
import { useRoomAssignmentRules, type RoomAssignmentRule } from '@/hooks/useRoomAssignmentRules'
import { useToast } from '@/hooks/use-toast'
import type { CrewSession } from '@/lib/api'
import { CollapsibleSection } from './shared'

// ─── Constants ────────────────────────────────────────────────────────────────

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

const RULE_TYPES = [
  {
    value: 'session_key_contains',
    label: 'Session Key Contains',
    description: 'Match if session key includes text',
  },
  { value: 'keyword', label: 'Label Keyword', description: 'Match if label contains keyword' },
  { value: 'model', label: 'Model Name', description: 'Match if model includes text' },
  { value: 'label_pattern', label: 'Regex Pattern', description: 'Match label with regex' },
  { value: 'session_type', label: 'Session Type', description: 'Match by session type' },
] as const

const SESSION_TYPES = [
  { value: 'main', label: 'Main Session' },
  { value: 'cron', label: 'Cron Job' },
  { value: 'subagent', label: 'Subagent/Spawn' },
  { value: 'slack', label: 'Slack' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoomsTabProps {
  /** Active sessions for testing routing rules */
  sessions?: CrewSession[]
  /** Called whenever a dialog opens or closes so parent can guard Escape key */
  onModalStateChange?: (hasOpenModal: boolean) => void
}

// ─── Sortable Rule Item ───────────────────────────────────────────────────────

function SortableRuleItem({
  rule,
  room,
  onAdjustPriority,
  onDelete,
  getRuleTypeLabel,
}: {
  rule: RoomAssignmentRule
  room: Room | undefined
  onAdjustPriority: (ruleId: string, delta: number) => void
  onDelete: (ruleId: string) => void
  getRuleTypeLabel: (type: string) => string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 rounded-lg border bg-background hover:bg-accent/20 transition-colors ${isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        {/* Drag handle */}
        <button
          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0 mt-1"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Priority controls */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <button
            onClick={() => onAdjustPriority(rule.id, 10)}
            className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
            title="Increase priority"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <Badge variant="secondary" className="text-[10px] font-mono px-1.5">
            {rule.priority}
          </Badge>
          <button
            onClick={() => onAdjustPriority(rule.id, -10)}
            className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
            title="Decrease priority"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Rule info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px]">
              {getRuleTypeLabel(rule.rule_type)}
            </Badge>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
              {rule.rule_value}
            </code>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>→</span>
            {room && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: `${room.color || '#4f46e5'}20`,
                  color: room.color || '#4f46e5',
                  border: `1px solid ${room.color || '#4f46e5'}40`,
                }}
              >
                {room.icon} {room.name}
              </span>
            )}
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(rule.id)}
          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-muted-foreground hover:text-red-600 shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RoomsTab({ sessions: activeSessions, onModalStateChange }: RoomsTabProps) {
  const {
    rooms,
    createRoom,
    updateRoom,
    deleteRoom,
    reorderRooms,
    isLoading: roomsLoading,
    getRoomFromRules,
  } = useRooms()
  const {
    rules,
    createRule,
    deleteRule,
    updateRule,
    isLoading: rulesLoading,
  } = useRoomAssignmentRules()
  const { toast } = useToast()

  // ─── Room management state ───
  const [showCreateRoomDialog, setShowCreateRoomDialog] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [deleteRoomConfirm, setDeleteRoomConfirm] = useState<string | null>(null)
  const [newRoom, setNewRoom] = useState({ name: '', icon: '🏛️', color: '#4f46e5' })

  // ─── Routing rules state ───
  const [showCreateRuleDialog, setShowCreateRuleDialog] = useState(false)
  const [deleteRuleConfirm, setDeleteRuleConfirm] = useState<string | null>(null)
  const [showTestRulesDialog, setShowTestRulesDialog] = useState(false)
  const [newRule, setNewRule] = useState({
    rule_type: 'session_key_contains' as RoomAssignmentRule['rule_type'],
    rule_value: '',
    room_id: '',
    priority: 50,
  })

  // ─── Native dialog refs ───
  const createRoomDialogRef = useRef<HTMLDialogElement>(null)
  const deleteRoomDialogRef = useRef<HTMLDialogElement>(null)
  const createRuleDialogRef = useRef<HTMLDialogElement>(null)
  const deleteRuleDialogRef = useRef<HTMLDialogElement>(null)
  const testRulesDialogRef = useRef<HTMLDialogElement>(null)

  // ─── Notify parent when any dialog opens/closes ───
  useEffect(() => {
    const hasOpenModal =
      showCreateRoomDialog ||
      !!deleteRoomConfirm ||
      showCreateRuleDialog ||
      !!deleteRuleConfirm ||
      showTestRulesDialog
    onModalStateChange?.(hasOpenModal)
  }, [
    showCreateRoomDialog,
    deleteRoomConfirm,
    showCreateRuleDialog,
    deleteRuleConfirm,
    showTestRulesDialog,
    onModalStateChange,
  ])

  // ─── Sync native dialogs ───
  useEffect(() => {
    const dialog = createRoomDialogRef.current
    if (!dialog) return
    if (showCreateRoomDialog) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [showCreateRoomDialog])

  useEffect(() => {
    const dialog = deleteRoomDialogRef.current
    if (!dialog) return
    if (deleteRoomConfirm) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [deleteRoomConfirm])

  useEffect(() => {
    const dialog = createRuleDialogRef.current
    if (!dialog) return
    if (showCreateRuleDialog) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [showCreateRuleDialog])

  useEffect(() => {
    const dialog = deleteRuleDialogRef.current
    if (!dialog) return
    if (deleteRuleConfirm) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [deleteRuleConfirm])

  useEffect(() => {
    const dialog = testRulesDialogRef.current
    if (!dialog) return
    if (showTestRulesDialog) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [showTestRulesDialog])

  // ─── Helpers ───
  const generateRoomId = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-room'

  const getRuleTypeLabel = (type: string) => RULE_TYPES.find((t) => t.value === type)?.label || type

  // ─── Room handlers ───
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
      setShowCreateRoomDialog(false)
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

  const handleDeleteRoom = async (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId)
    const result = await deleteRoom(roomId)
    if (result.success) {
      toast({ title: 'Room Deleted', description: `${room?.icon} ${room?.name} removed` })
      setDeleteRoomConfirm(null)
    } else {
      toast({ title: 'Failed to delete room', description: result.error, variant: 'destructive' })
    }
  }

  const moveRoom = async (roomId: string, direction: 'up' | 'down') => {
    const currentIndex = sortedRooms.findIndex((r) => r.id === roomId)
    if (currentIndex === -1) return
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= rooms.length) return
    const newOrder = [...sortedRooms.map((r) => r.id)]
    ;[newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]]
    await reorderRooms(newOrder)
  }

  // ─── Rule handlers ───
  const handleCreateRule = async () => {
    if (!newRule.rule_value.trim()) {
      toast({
        title: 'Value required',
        description: 'Please enter a rule value',
        variant: 'destructive',
      })
      return
    }
    if (!newRule.room_id) {
      toast({
        title: 'Room required',
        description: 'Please select a target room',
        variant: 'destructive',
      })
      return
    }
    const success = await createRule({
      rule_type: newRule.rule_type,
      rule_value: newRule.rule_value.trim(),
      room_id: newRule.room_id,
      priority: newRule.priority,
    })
    if (success) {
      toast({ title: 'Rule Created!', description: 'New routing rule is active' })
      setShowCreateRuleDialog(false)
      setNewRule({
        rule_type: 'session_key_contains',
        rule_value: '',
        room_id: rooms[0]?.id || '',
        priority: 50,
      })
    } else {
      toast({ title: 'Failed to create rule', variant: 'destructive' })
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    const success = await deleteRule(ruleId)
    if (success) {
      toast({ title: 'Rule Deleted' })
      setDeleteRuleConfirm(null)
    } else {
      toast({ title: 'Failed to delete rule', variant: 'destructive' })
    }
  }

  const adjustPriority = async (ruleId: string, delta: number) => {
    const rule = rules.find((r) => r.id === ruleId)
    if (!rule) return
    const newPriority = Math.max(0, Math.min(100, rule.priority + delta))
    await updateRule(ruleId, { priority: newPriority })
  }

  // ─── DnD sensors ───
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const currentOrder = [...rules].sort((a, b) => b.priority - a.priority)
      const oldIndex = currentOrder.findIndex((r) => r.id === active.id)
      const newIndex = currentOrder.findIndex((r) => r.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = [...currentOrder]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)

      const maxPriority = reordered.length * 10
      const updates = reordered.map((rule, index) => ({
        id: rule.id,
        priority: maxPriority - index * 10,
      }))

      for (const update of updates) {
        await updateRule(update.id, { priority: update.priority })
      }
    },
    [rules, updateRule]
  )

  // ─── Computed ───
  const sortedRooms = [...rooms].sort((a, b) => a.sort_order - b.sort_order)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority)

  const testRulesResults = useMemo(() => {
    if (!showTestRulesDialog || !activeSessions?.length) return []
    return activeSessions.map((session) => {
      const matchedRoomId = getRoomFromRules(session.key, {
        label: session.label,
        model: session.model,
        channel:
          ((session as unknown as Record<string, unknown>).lastChannel as string) ||
          session.channel,
      })
      const matchedRoom = matchedRoomId ? rooms.find((r) => r.id === matchedRoomId) : null
      const matchedRule = rules.find((rule) => {
        switch (rule.rule_type) {
          case 'session_key_contains':
            return session.key.includes(rule.rule_value)
          case 'keyword':
            return session.label?.toLowerCase().includes(rule.rule_value.toLowerCase())
          case 'model':
            return session.model?.toLowerCase().includes(rule.rule_value.toLowerCase())
          case 'label_pattern':
            try {
              return (
                new RegExp(rule.rule_value, 'i').test(session.label || '') ||
                new RegExp(rule.rule_value, 'i').test(session.key)
              )
            } catch {
              return false
            }
          case 'session_type':
            if (rule.rule_value === 'cron') return session.key.includes(':cron:')
            if (rule.rule_value === 'subagent')
              return session.key.includes(':subagent:') || session.key.includes(':spawn:')
            if (rule.rule_value === 'main') return session.key === 'agent:main:main'
            return session.key.includes(rule.rule_value) || session.channel === rule.rule_value
          default:
            return false
        }
      })
      return {
        session,
        matchedRoom: matchedRoom
          ? `${matchedRoom.icon || ''} ${matchedRoom.name}`.trim()
          : 'No match (default)',
        matchedRule: matchedRule
          ? `${getRuleTypeLabel(matchedRule.rule_type)}: ${matchedRule.rule_value}`
          : null,
      }
    })
  }, [showTestRulesDialog, activeSessions, getRoomFromRules, rooms, rules])

  return (
    <>
      {/* ─── Tab content ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <CollapsibleSection title="🏢 Room Management" badge={`${rooms.length} rooms`}>
          <Button onClick={() => setShowCreateRoomDialog(true)} size="sm" className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Create New Room
          </Button>

          {roomsLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Loading rooms…</div>
          ) : sortedRooms.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No rooms yet. Create one to get started!
            </div>
          ) : (
            <div className="space-y-2">
              {sortedRooms.map((room, index) => (
                <div
                  key={room.id}
                  className="flex items-center gap-2 p-3 rounded-lg border bg-background hover:bg-accent/30 transition-colors"
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveRoom(room.id, 'up')}
                      disabled={index === 0}
                      className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => moveRoom(room.id, 'down')}
                      disabled={index === sortedRooms.length - 1}
                      className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Room icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{
                      backgroundColor: `${room.color}20`,
                      border: `2px solid ${room.color}`,
                    }}
                  >
                    {room.icon}
                  </div>

                  {/* Name / edit */}
                  <div className="flex-1 min-w-0">
                    {editingRoom?.id === room.id ? (
                      <div className="flex gap-1.5">
                        <Input
                          value={editingRoom.name}
                          onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateRoom(editingRoom)
                            if (e.key === 'Escape') setEditingRoom(null)
                          }}
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
                        <div className="font-medium text-sm truncate">{room.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{room.id}</div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {editingRoom?.id !== room.id && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setEditingRoom({ ...room })}
                        className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteRoomConfirm(room.id)}
                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="🔀 Routing Rules" badge={`${rules.length} rules`}>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setNewRule((r) => ({ ...r, room_id: rooms[0]?.id || '' }))
                setShowCreateRuleDialog(true)
              }}
              size="sm"
              className="flex-1 gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Rule
            </Button>
            {activeSessions && activeSessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTestRulesDialog(true)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Test Rules
              </Button>
            )}
          </div>

          <div className="p-3 rounded-lg bg-muted/50 text-xs flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground">
              Rules are evaluated by priority (highest first). First match wins.
            </p>
          </div>

          {rulesLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Loading rules…</div>
          ) : sortedRules.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No rules yet. Sessions will use default routing.
            </div>
          ) : (
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedRules.map((r) => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {sortedRules.map((rule) => (
                    <SortableRuleItem
                      key={rule.id}
                      rule={rule}
                      room={rooms.find((r) => r.id === rule.room_id)}
                      onAdjustPriority={adjustPriority}
                      onDelete={(id) => setDeleteRuleConfirm(id)}
                      getRuleTypeLabel={getRuleTypeLabel}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CollapsibleSection>
      </div>

      {/* ─── Create Room Dialog ─── */}
      <dialog
        ref={createRoomDialogRef}
        onClose={() => setShowCreateRoomDialog(false)}
        onClick={(e) => e.target === e.currentTarget && setShowCreateRoomDialog(false)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0 z-[80]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden"
        >
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateRoom()
                }}
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
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setShowCreateRoomDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRoom}>Create Room</Button>
          </div>
        </div>
      </dialog>

      {/* ─── Delete Room Dialog ─── */}
      <dialog
        ref={deleteRoomDialogRef}
        onClose={() => setDeleteRoomConfirm(null)}
        onClick={(e) => e.target === e.currentTarget && setDeleteRoomConfirm(null)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0 z-[80]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden"
        >
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold">Delete Room?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This will remove the room and unassign any sessions from it. This action cannot be
              undone.
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setDeleteRoomConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteRoomConfirm && handleDeleteRoom(deleteRoomConfirm)}
            >
              Delete Room
            </Button>
          </div>
        </div>
      </dialog>

      {/* ─── Create Rule Dialog ─── */}
      <dialog
        ref={createRuleDialogRef}
        onClose={() => setShowCreateRuleDialog(false)}
        onClick={(e) => e.target === e.currentTarget && setShowCreateRuleDialog(false)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0 z-[80]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden"
        >
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold">Create Routing Rule</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Define a condition to automatically route sessions to a room
            </p>
          </div>
          <div className="px-6 pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Rule Type</Label>
              <Select
                value={newRule.rule_type}
                onValueChange={(value) =>
                  setNewRule({
                    ...newRule,
                    rule_type: value as RoomAssignmentRule['rule_type'],
                    rule_value: value === 'session_type' ? SESSION_TYPES[0].value : '',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div>{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{newRule.rule_type === 'session_type' ? 'Session Type' : 'Match Value'}</Label>
              {newRule.rule_type === 'session_type' ? (
                <Select
                  value={newRule.rule_value}
                  onValueChange={(value) => setNewRule({ ...newRule, rule_value: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={newRule.rule_value}
                  onChange={(e) => setNewRule({ ...newRule, rule_value: e.target.value })}
                  placeholder={
                    newRule.rule_type === 'session_key_contains'
                      ? 'e.g., :cron:'
                      : newRule.rule_type === 'keyword'
                        ? 'e.g., implement'
                        : newRule.rule_type === 'model'
                          ? 'e.g., opus'
                          : 'Enter pattern...'
                  }
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Target Room</Label>
              <Select
                value={newRule.room_id}
                onValueChange={(value) => setNewRule({ ...newRule, room_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      <div className="flex items-center gap-2">
                        <span>{room.icon}</span>
                        <span>{room.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority ({newRule.priority})</Label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={newRule.priority}
                  onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
                  className="flex-1 accent-primary"
                />
                <span className="text-sm text-muted-foreground w-12 text-right font-mono">
                  {newRule.priority}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Higher priority rules are evaluated first (100 = highest, 0 = lowest)
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setShowCreateRuleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRule}>Create Rule</Button>
          </div>
        </div>
      </dialog>

      {/* ─── Delete Rule Dialog ─── */}
      <dialog
        ref={deleteRuleDialogRef}
        onClose={() => setDeleteRuleConfirm(null)}
        onClick={(e) => e.target === e.currentTarget && setDeleteRuleConfirm(null)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0 z-[80]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden"
        >
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold">Delete Rule?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This rule will be permanently removed. Sessions may be routed differently.
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setDeleteRuleConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteRuleConfirm && handleDeleteRule(deleteRuleConfirm)}
            >
              Delete Rule
            </Button>
          </div>
        </div>
      </dialog>

      {/* ─── Test Rules Preview Dialog ─── */}
      <dialog
        ref={testRulesDialogRef}
        onClose={() => setShowTestRulesDialog(false)}
        onClick={(e) => e.target === e.currentTarget && setShowTestRulesDialog(false)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0 z-[80]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4 overflow-hidden"
        >
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold">🧪 Test Routing Rules</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Preview how current rules would route your {activeSessions?.length || 0} active
              session{(activeSessions?.length || 0) !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="px-6 pb-4 max-h-96 overflow-y-auto space-y-2">
            {testRulesResults.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No active sessions to test</p>
            ) : (
              testRulesResults.map(({ session, matchedRoom, matchedRule }) => (
                <div key={session.key} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm truncate">{session.key}</div>
                      {session.label && (
                        <div className="text-xs text-muted-foreground truncate">
                          {session.label}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium">{matchedRoom}</div>
                      {matchedRule && (
                        <div className="text-xs text-muted-foreground">{matchedRule}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button onClick={() => setShowTestRulesDialog(false)}>Close</Button>
          </div>
        </div>
      </dialog>
    </>
  )
}
