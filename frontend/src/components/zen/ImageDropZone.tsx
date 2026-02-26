/**
 * Image Drop Zone for Zen Mode Chat
 * Handles paste (Ctrl+V) and drag & drop of images
 */

import {
  useState,
  useRef,
  useCallback,
  type DragEvent,
  type ClipboardEvent,
  type ReactNode,
} from 'react'
import { API_BASE } from '@/lib/api'

export interface PendingImage {
  id: string
  file: File
  preview: string
  uploading: boolean
  error?: string
  uploadedPath?: string
}

interface ImageDropZoneProps {
  readonly children: ReactNode
  readonly onImagesChange: (images: PendingImage[]) => void
  readonly images: PendingImage[]
  readonly disabled?: boolean
}

// Accepted image types
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

/**
 * Check if a file is an accepted image type
 */
function isAcceptedImage(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type)
}

/**
 * Generate a unique ID for a pending image
 */
function generateId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Upload a single image to the server
 */
async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(error.detail || `Upload failed: ${response.status}`)
  }

  const data = await response.json()
  return data.path
}

export function ImageDropZone({ children, onImagesChange, images, disabled }: ImageDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCountRef = useRef(0)

  /**
   * Process files from paste or drop
   */
  const processFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter(isAcceptedImage)
      if (imageFiles.length === 0) return

      // Create pending images with previews
      const newImages: PendingImage[] = imageFiles.map((file) => ({
        id: generateId(),
        file,
        preview: URL.createObjectURL(file),
        uploading: true,
      }))

      // Add to state immediately (with uploading state)
      onImagesChange([...images, ...newImages])

      // Upload each image
      const updatedImages = await Promise.all(
        newImages.map(async (img) => {
          try {
            const uploadedPath = await uploadImage(img.file)
            return { ...img, uploading: false, uploadedPath }
          } catch (e) {
            return {
              ...img,
              uploading: false,
              error: e instanceof Error ? e.message : 'Upload failed',
            }
          }
        })
      )

      // Update with upload results
      onImagesChange([...images, ...updatedImages])
    },
    [images, onImagesChange]
  )

  /**
   * Handle paste event (Ctrl+V)
   */
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (disabled) return

      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        processFiles(files)
      }
    },
    [disabled, processFiles]
  )

  /**
   * Handle drag enter
   */
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current++

    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
  }, [])

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current--

    if (dragCountRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  /**
   * Handle drag over (needed for drop to work)
   */
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  /**
   * Handle drop
   */
  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCountRef.current = 0
      setIsDragOver(false)

      if (disabled) return

      const files = Array.from(e.dataTransfer.files)
      processFiles(files)
    },
    [disabled, processFiles]
  )

  return (
    <div
      className={`zen-image-drop-zone ${isDragOver ? 'zen-image-drop-zone-active' : ''}`}
      onPaste={handlePaste}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      {isDragOver && (
        <div className="zen-drop-overlay">
          <div className="zen-drop-overlay-content">
            <span className="zen-drop-icon">📷</span>
            <span>Drop images here</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Image preview thumbnails with remove button
 */
interface ImagePreviewsProps {
  readonly images: PendingImage[]
  readonly onRemove: (id: string) => void
}

export function ImagePreviews({ images, onRemove }: ImagePreviewsProps) {
  if (images.length === 0) return null

  return (
    <div className="zen-image-previews">
      {images.map((img) => (
        <div
          key={img.id}
          className={`zen-image-preview ${img.uploading ? 'zen-image-preview-uploading' : ''} ${img.error ? 'zen-image-preview-error' : ''}`}
        >
          <img src={img.preview} alt="Preview" />

          {/* Loading spinner */}
          {img.uploading && (
            <div className="zen-image-preview-loading">
              <span className="zen-spinner" />
            </div>
          )}

          {/* Error indicator */}
          {img.error && (
            <div className="zen-image-preview-error-badge" title={img.error}>
              ⚠️
            </div>
          )}

          {/* Remove button */}
          <button
            type="button"
            className="zen-image-preview-remove"
            onClick={() => {
              // Revoke preview URL to free memory
              URL.revokeObjectURL(img.preview)
              onRemove(img.id)
            }}
            aria-label="Remove image"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
