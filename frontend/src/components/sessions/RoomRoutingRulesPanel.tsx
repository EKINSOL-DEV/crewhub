import { useState, useMemo, useRef, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useRoomAssignmentRules, type RoomAssignmentRule } from "@/hooks/useRoomAssignmentRules"
import { useRooms } from "@/hooks/useRooms"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, AlertCircle } from "lucide-react"

interface RoomRoutingRulesPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  testSessions?: { key: string; label?: string; model?: string; channel?: string }[]
}

const RULE_TYPES = [
  { value: "session_key_contains", label: "Session Key Contains", description: "Match if session key includes text" },
  { value: "keyword", label: "Label Keyword", description: "Match if label contains keyword" },
  { value: "model", label: "Model Name", description: "Match if model includes text" },
  { value: "label_pattern", label: "Regex Pattern", description: "Match label with regex" },
  { value: "session_type", label: "Session Type", description: "Match by session type" },
] as const

const SESSION_TYPES = [
  { value: "main", label: "Main Session" },
  { value: "cron", label: "Cron Job" },
  { value: "subagent", label: "Subagent/Spawn" },
  { value: "slack", label: "Slack" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
]

export function RoomRoutingRulesPanel({ open, onOpenChange, testSessions = [] }: RoomRoutingRulesPanelProps) {
  const { rules, createRule, deleteRule, updateRule, isLoading } = useRoomAssignmentRules()
  const { rooms, getRoomFromRules } = useRooms()
  const { toast } = useToast()
  
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  // Native dialog refs
  const createDialogRef = useRef<HTMLDialogElement>(null)
  const previewDialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  
  // New rule form state
  const [newRule, setNewRule] = useState({
    rule_type: "session_key_contains" as RoomAssignmentRule["rule_type"],
    rule_value: "",
    room_id: rooms[0]?.id || "",
    priority: 50
  })

  // Sync create dialog
  useEffect(() => {
    const dialog = createDialogRef.current
    if (!dialog) return
    if (showCreateDialog) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [showCreateDialog])

  // Sync preview dialog
  useEffect(() => {
    const dialog = previewDialogRef.current
    if (!dialog) return
    if (showPreviewDialog) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [showPreviewDialog])

  // Sync delete dialog
  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!dialog) return
    if (deleteConfirm) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [deleteConfirm])

  const handleCreateRule = async () => {
    if (!newRule.rule_value.trim()) {
      toast({ title: "Value required", description: "Please enter a rule value", variant: "destructive" })
      return
    }
    if (!newRule.room_id) {
      toast({ title: "Room required", description: "Please select a target room", variant: "destructive" })
      return
    }
    
    const success = await createRule({
      rule_type: newRule.rule_type,
      rule_value: newRule.rule_value.trim(),
      room_id: newRule.room_id,
      priority: newRule.priority
    })
    
    if (success) {
      toast({ title: "Rule Created!", description: "New routing rule is active" })
      setShowCreateDialog(false)
      setNewRule({ rule_type: "session_key_contains", rule_value: "", room_id: rooms[0]?.id || "", priority: 50 })
    } else {
      toast({ title: "Failed to create rule", variant: "destructive" })
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    const success = await deleteRule(ruleId)
    
    if (success) {
      toast({ title: "Rule Deleted" })
      setDeleteConfirm(null)
    } else {
      toast({ title: "Failed to delete rule", variant: "destructive" })
    }
  }

  const adjustPriority = async (ruleId: string, delta: number) => {
    const rule = rules.find(r => r.id === ruleId)
    if (!rule) return
    
    const newPriority = Math.max(0, Math.min(100, rule.priority + delta))
    await updateRule(ruleId, { priority: newPriority })
  }

  const getRoomName = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId)
    return room ? `${room.icon || ""} ${room.name}`.trim() : roomId
  }

  const getRuleTypeLabel = (type: string) => {
    return RULE_TYPES.find(t => t.value === type)?.label || type
  }

  // Preview: show which sessions match which rules
  const previewResults = useMemo(() => {
    if (!testSessions.length) return []
    
    return testSessions.map(session => {
      const matchedRoomId = getRoomFromRules(session.key, {
        label: session.label,
        model: session.model,
        channel: session.channel
      })
      
      // Find which rule matched
      const matchedRule = rules.find(rule => {
        switch (rule.rule_type) {
          case "session_key_contains":
            return session.key.includes(rule.rule_value)
          case "keyword":
            return session.label?.toLowerCase().includes(rule.rule_value.toLowerCase())
          case "model":
            return session.model?.toLowerCase().includes(rule.rule_value.toLowerCase())
          case "session_type":
            if (rule.rule_value === "cron") return session.key.includes(":cron:")
            if (rule.rule_value === "subagent") return session.key.includes(":subagent:") || session.key.includes(":spawn:")
            if (rule.rule_value === "main") return session.key === "agent:main:main"
            return session.key.includes(rule.rule_value) || session.channel === rule.rule_value
          default:
            return false
        }
      })
      
      return {
        session,
        matchedRoom: matchedRoomId ? getRoomName(matchedRoomId) : "No match (default)",
        matchedRule: matchedRule ? `${getRuleTypeLabel(matchedRule.rule_type)}: ${matchedRule.rule_value}` : null
      }
    })
  }, [testSessions, rules, getRoomFromRules])

  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>🔀 Room Routing Rules</SheetTitle>
            <SheetDescription>
              Configure how sessions are automatically assigned to rooms
            </SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateDialog(true)} className="flex-1 gap-2">
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
              {testSessions.length > 0 && (
                <Button variant="outline" onClick={() => setShowPreviewDialog(true)} className="gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
              )}
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">
                    Rules are evaluated in order of priority (highest first). The first matching rule determines the room assignment.
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Active Rules ({rules.length})</Label>
              
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading rules...</div>
              ) : sortedRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No rules configured. Sessions will use default routing.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedRules.map((rule) => {
                    const room = rooms.find(r => r.id === rule.room_id)
                    return (
                      <div
                        key={rule.id}
                        className="p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={() => adjustPriority(rule.id, 10)}
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                              title="Increase priority"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <Badge variant="secondary" className="text-xs font-mono">
                              {rule.priority}
                            </Badge>
                            <button
                              onClick={() => adjustPriority(rule.id, -10)}
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                              title="Decrease priority"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {getRuleTypeLabel(rule.rule_type)}
                              </Badge>
                              <code className="text-sm bg-muted px-2 py-0.5 rounded font-mono">
                                {rule.rule_value}
                              </code>
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>→</span>
                              {room && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-medium"
                                  style={{ 
                                    backgroundColor: `${room.color || "#4f46e5"}20`, 
                                    color: room.color || "#4f46e5",
                                    border: `1px solid ${room.color || "#4f46e5"}40`
                                  }}
                                >
                                  {room.icon} {room.name}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => setDeleteConfirm(rule.id)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-muted-foreground hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Rule Dialog */}
      <dialog
        ref={createDialogRef}
        onClose={() => setShowCreateDialog(false)}
        onClick={(e) => e.target === e.currentTarget && setShowCreateDialog(false)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden"
        >
          {/* Header */}
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
                onValueChange={(value) => setNewRule({ 
                  ...newRule, 
                  rule_type: value as RoomAssignmentRule["rule_type"],
                  rule_value: value === "session_type" ? SESSION_TYPES[0].value : ""
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map(type => (
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
              <Label>
                {newRule.rule_type === "session_type" ? "Session Type" : "Match Value"}
              </Label>
              {newRule.rule_type === "session_type" ? (
                <Select
                  value={newRule.rule_value}
                  onValueChange={(value) => setNewRule({ ...newRule, rule_value: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPES.map(type => (
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
                    newRule.rule_type === "session_key_contains" ? "e.g., :cron:" :
                    newRule.rule_type === "keyword" ? "e.g., implement" :
                    newRule.rule_type === "model" ? "e.g., opus" :
                    "Enter pattern..."
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
                  {rooms.map(room => (
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
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-12 text-right">{newRule.priority}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Higher priority rules are evaluated first (100 = highest, 0 = lowest)
              </p>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateRule}>Create Rule</Button>
          </div>
        </div>
      </dialog>

      {/* Preview Dialog */}
      <dialog
        ref={previewDialogRef}
        onClose={() => setShowPreviewDialog(false)}
        onClick={(e) => e.target === e.currentTarget && setShowPreviewDialog(false)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold">Rule Preview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              See which room each active session would be assigned to
            </p>
          </div>
          
          <div className="px-6 pb-4 max-h-96 overflow-y-auto space-y-2">
            {previewResults.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No sessions to preview</p>
            ) : (
              previewResults.map(({ session, matchedRoom, matchedRule }) => (
                <div key={session.key} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm truncate">{session.key}</div>
                      {session.label && (
                        <div className="text-xs text-muted-foreground truncate">{session.label}</div>
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
          
          {/* Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </div>
        </div>
      </dialog>

      {/* Delete Confirmation Dialog */}
      <dialog
        ref={deleteDialogRef}
        onClose={() => setDeleteConfirm(null)}
        onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold">Delete Rule?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This rule will be permanently removed. Sessions may be routed differently.
            </p>
          </div>
          
          {/* Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDeleteRule(deleteConfirm)}>
              Delete Rule
            </Button>
          </div>
        </div>
      </dialog>
    </>
  )
}
