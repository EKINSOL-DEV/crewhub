/**
 * Media attachment parser for chat messages.
 * Detects and extracts image attachments from message content.
 */

export interface MediaAttachment {
  type: 'image'
  path: string
  mimeType: string
  originalText: string
}

export interface ParsedMessage {
  text: string
  attachments: MediaAttachment[]
}

// Supported image MIME types
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

// Pattern for [media attached: <path> (<mime>)]
const MEDIA_ATTACHED_REGEX = /\[media attached:\s*([^\s]+)\s+\(([^)]+)\)\]/gi

// Pattern for MEDIA: prefix (alternative format)
const MEDIA_PREFIX_REGEX = /MEDIA:\s*([^\s]+)/gi

/**
 * Check if a MIME type is a supported image type.
 */
export function isImageMimeType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.has(mimeType.toLowerCase())
}

/**
 * Convert a file path to a media API URL.
 */
export function getMediaUrl(path: string): string {
  // Encode the path for URL safety
  const encodedPath = encodeURIComponent(path)
  return `/api/media/${encodedPath}`
}

/**
 * Parse a message and extract media attachments.
 * Returns the remaining text and a list of attachments.
 */
export function parseMediaAttachments(content: string): ParsedMessage {
  const attachments: MediaAttachment[] = []
  let text = content

  // Parse [media attached: /path/to/file.jpg (image/jpeg)] pattern
  let match: RegExpExecArray | null
  const mediaAttachedRegex = new RegExp(MEDIA_ATTACHED_REGEX)
  
  while ((match = mediaAttachedRegex.exec(content)) !== null) {
    const [fullMatch, path, mimeType] = match
    
    if (isImageMimeType(mimeType)) {
      attachments.push({
        type: 'image',
        path,
        mimeType,
        originalText: fullMatch,
      })
      // Remove the media text from the message
      text = text.replace(fullMatch, '').trim()
    }
  }

  // Parse MEDIA: /path/to/file.jpg pattern (infer MIME from extension)
  const mediaPrefixRegex = new RegExp(MEDIA_PREFIX_REGEX)
  
  while ((match = mediaPrefixRegex.exec(content)) !== null) {
    const [fullMatch, path] = match
    
    // Infer MIME type from extension
    const ext = path.split('.').pop()?.toLowerCase()
    let mimeType: string | null = null
    
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        mimeType = 'image/jpeg'
        break
      case 'png':
        mimeType = 'image/png'
        break
      case 'gif':
        mimeType = 'image/gif'
        break
      case 'webp':
        mimeType = 'image/webp'
        break
    }
    
    if (mimeType) {
      // Check if we already added this attachment (avoid duplicates)
      const alreadyAdded = attachments.some(a => a.path === path)
      if (!alreadyAdded) {
        attachments.push({
          type: 'image',
          path,
          mimeType,
          originalText: fullMatch,
        })
        text = text.replace(fullMatch, '').trim()
      }
    }
  }

  // Remove OpenClaw media instruction hint (injected context for AI)
  const mediaHintPattern = /To send an image back,.*?Keep caption in the text body\.\n?/gs
  text = text.replace(mediaHintPattern, '')

  // Clean up multiple newlines from removed media
  text = text.replace(/\n{3,}/g, '\n\n').trim()

  return { text, attachments }
}
