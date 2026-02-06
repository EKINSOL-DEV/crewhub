import { useState } from "react"
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
import { Sparkles, Loader2 } from "lucide-react"

interface EditBioDialogProps {
  agentId: string | null
  agentName: string
  currentBio: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

/**
 * EditBioDialog - Dialog for editing agent bios
 * 
 * IMPORTANT: This component uses conditional rendering (only renders when open)
 * to work around a Radix UI bug with React 19 where compose-refs can cause
 * infinite update loops. See: https://github.com/radix-ui/primitives/issues/3799
 * 
 * The inner content is extracted to EditBioDialogContent which initializes
 * state from props on mount, avoiding useEffect-based state syncing.
 */
export function EditBioDialog({
  agentId,
  agentName,
  currentBio,
  open,
  onOpenChange,
  onSaved,
}: EditBioDialogProps) {
  // Only render the dialog when open - this avoids the Radix/React 19 
  // compose-refs infinite loop bug by ensuring the dialog mounts fresh
  // each time it opens, rather than trying to sync state via useEffect
  if (!open) return null

  return (
    <EditBioDialogContent
      agentId={agentId}
      agentName={agentName}
      currentBio={currentBio}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
    />
  )
}

/**
 * Inner dialog content - only mounted when dialog is open
 * Initializes state from props on mount, no useEffect needed
 */
function EditBioDialogContent({
  agentId,
  agentName,
  currentBio,
  onOpenChange,
  onSaved,
}: Omit<EditBioDialogProps, 'open'>) {
  const { isDemoMode } = useDemoMode()
  // Initialize state directly from props - component only mounts when dialog opens
  const [bio, setBio] = useState(currentBio ?? "")
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCreating = !currentBio

  const handleGenerate = async () => {
    if (!agentId || isDemoMode) return

    setGenerating(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/agents/${agentId}/generate-bio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to generate bio")
      }

      const data = await response.json()
      if (data.bio) {
        setBio(data.bio)
      }
    } catch (err) {
      console.error("Failed to generate bio:", err)
      setError(err instanceof Error ? err.message : "Failed to generate bio")
    } finally {
      setGenerating(false)
    }
  }

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
    <Dialog open={true} onOpenChange={onOpenChange}>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="bio-textarea">Bio</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleGenerate()
                }}
                disabled={generating || isDemoMode}
                className="h-7 gap-1.5 text-xs"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    Generate
                  </>
                )}
              </Button>
            </div>
            <Textarea
              id="bio-textarea"
              value={bio}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
              placeholder="A hardworking crew member who..."
              rows={4}
              className="resize-none"
              maxLength={500}
              disabled={generating}
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
