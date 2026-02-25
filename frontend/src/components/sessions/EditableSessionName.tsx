import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X, Trash2 } from 'lucide-react'
import { useSessionDisplayName } from '@/hooks/useSessionDisplayNames'
import { useToast } from '@/hooks/use-toast'

interface EditableSessionNameProps {
  readonly sessionKey: string
  readonly fallbackName: string
  readonly className?: string
  readonly showEditIcon?: boolean
  readonly onNameChange?: () => void
}

/**
 * Editable session display name component.
 * Shows the custom name if set, otherwise the fallback.
 * Click to edit, with save/cancel/delete actions.
 */
export function EditableSessionName({
  sessionKey,
  fallbackName,
  className = '',
  showEditIcon = true,
  onNameChange,
}: EditableSessionNameProps) {
  const { displayName, loading, update, remove } = useSessionDisplayName(sessionKey)
  const { toast } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentName = displayName || fallbackName

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const startEditing = () => {
    setEditValue(displayName || '')
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditValue('')
  }

  const saveEdit = async () => {
    const trimmed = editValue.trim()
    if (!trimmed) {
      // Empty = delete the custom name
      await handleDelete()
      return
    }

    setIsSaving(true)
    try {
      const success = await update(trimmed)
      if (success) {
        toast({ title: '✏️ Name Updated', description: `Session renamed to "${trimmed}"` })
        onNameChange?.()
      } else {
        toast({ title: 'Failed to update name', variant: 'destructive' })
      }
    } finally {
      setIsSaving(false)
      setIsEditing(false)
    }
  }

  const handleDelete = async () => {
    setIsSaving(true)
    try {
      const success = await remove()
      if (success) {
        toast({ title: '🗑️ Custom Name Removed', description: 'Using default name' })
        onNameChange?.()
      } else {
        toast({ title: 'Failed to remove name', variant: 'destructive' })
      }
    } finally {
      setIsSaving(false)
      setIsEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit()
    else if (e.key === 'Escape') cancelEditing()
  }

  if (loading) {
    return <span className={`opacity-50 ${className}`}>{fallbackName}</span>
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={fallbackName}
          disabled={isSaving}
          className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
        />
        <button
          onClick={saveEdit}
          disabled={isSaving}
          className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
          title="Save"
        >
          <Check size={16} />
        </button>
        <button
          onClick={cancelEditing}
          disabled={isSaving}
          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
          title="Cancel"
        >
          <X size={16} />
        </button>
        {displayName && (
          <button
            onClick={handleDelete}
            disabled={isSaving}
            className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
            title="Remove custom name"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    )
  }

  return (
    <span
      className={`group cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 ${className}`}
      onClick={startEditing}
      title={
        displayName
          ? `Custom name: ${displayName}\nSession: ${sessionKey}`
          : `Click to set custom name\nSession: ${sessionKey}`
      }
    >
      {currentName}
      {showEditIcon && (
        <Pencil
          size={12}
          className="inline-block ml-1 opacity-0 group-hover:opacity-50 transition-opacity"
        />
      )}
      {displayName && <span className="ml-1 text-xs opacity-50">(custom)</span>}
    </span>
  )
}
