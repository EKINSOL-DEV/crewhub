import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useDemoMode } from "@/contexts/DemoContext"
import { API_BASE } from "@/lib/api"

interface EditBioDialogProps {
  agentId: string | null
  agentName: string
  currentBio: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function EditBioDialog({
  agentId,
  agentName,
  currentBio,
  open,
  onOpenChange,
  onSaved,
}: EditBioDialogProps) {
  const { isDemoMode } = useDemoMode()
  const [bio, setBio] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCreating = !currentBio

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setBio(currentBio || "")
      setError(null)
    }
  }, [open, currentBio])

  const handleSave = async () => {
    if (!agentId || isDemoMode) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bio.trim() || null }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to save bio")
      }

      // Notify other components that agents were updated
      window.dispatchEvent(new CustomEvent("agents-updated"))

      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      console.error("Failed to save bio:", err)
      setError(err instanceof Error ? err.message : "Failed to save bio")
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" style={{ zIndex: 100 }}>
        <DialogHeader>
          <DialogTitle>
            {isCreating ? "✨ Create Bio" : "✏️ Update Bio"}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? `Give ${agentName} a personality! Write a short bio that describes who they are.`
              : `Update ${agentName}'s bio description.`}
          </DialogDescription>
        </DialogHeader>

        {/* Demo mode warning */}
        {isDemoMode && (
          <div className="rounded-lg border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-3 text-sm text-amber-800 flex items-center gap-2">
            <span>🎮</span>
            <span>
              <strong>Demo Mode</strong> — Changes won't be saved.
            </span>
          </div>
        )}

        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="bio-textarea">Bio</Label>
            <Textarea
              id="bio-textarea"
              value={bio}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
              placeholder="A hardworking crew member who..."
              rows={4}
              className="resize-none"
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground text-right">
              {bio.length}/500
            </div>
          </div>

          {error && (
            <div className="mt-3 text-sm text-destructive">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isDemoMode}>
            {saving ? "Saving…" : "Save Bio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
