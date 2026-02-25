import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface DocumentUploadZoneProps {
  readonly projectId: string
  readonly onUploadComplete: (path: string) => void
}

export function DocumentUploadZone({ projectId, onUploadComplete }: DocumentUploadZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith('.md')) {
      setError('Only .md files are allowed')
      return
    }
    setUploading(true)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/upload-document`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      const data = await res.json()
      onUploadComplete(data.path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) await uploadFile(file)
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
  }

  return (
    <div
      className={`border-2 border-dashed rounded-md p-4 text-center transition-colors ${
        dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {uploading ? (
        <div className="text-sm text-muted-foreground">Uploading...</div>
      ) : (
        <>
          <div className="text-sm mb-1">📁 Drag & drop .md file here</div>
          <div className="text-xs text-muted-foreground mb-1">or</div>
          <label className="cursor-pointer text-xs text-primary hover:underline">
            click to browse
            <input type="file" accept=".md" onChange={handleFileInput} className="hidden" />
          </label>
        </>
      )}
      {error && <div className="text-xs text-destructive mt-2">{error}</div>}
    </div>
  )
}
