/**
 * Media attachment parser for chat messages.
 * Detects and extracts image, video, and audio attachments from message content.
 */

export interface MediaAttachment {
  type: 'image' | 'video' | 'audio'
  path: string
  mimeType: string
  originalText: string
  /** Duration in seconds (audio only) */
  duration?: number
  /** Whisper transcript text (audio only, if available) */
  transcript?: string
  /** Transcription error message (audio only, if transcription failed) */
  transcriptError?: string
}

export interface ParsedMessage {
  text: string
  attachments: MediaAttachment[]
}

// Supported image MIME types
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

// Supported video MIME types
const SUPPORTED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'])

// Supported audio MIME types
const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/mpeg',
  'audio/x-m4a',
])

// Pattern for [media attached: <path> (<mime>)]
const MEDIA_ATTACHED_REGEX = /\[media attached:\s*([^\s]+)\s+\(([^)]+)\)\]/gi

// Pattern for [audio attached: <path> (<mime>) <duration>s]
const AUDIO_ATTACHED_REGEX = /\[audio attached:\s*([^\s]+)\s+\(([^)]+)\)(?:\s+([\d.]+)s)?\]/gi

// Pattern for Transcript: "text" line following an audio attachment
const TRANSCRIPT_REGEX = /^Transcript:\s*"(.+)"$/m

// Pattern for [Voice transcription unavailable: reason] line
const TRANSCRIPT_ERROR_REGEX = /\[Voice transcription unavailable:\s*([^\]]+)\]/

// Pattern for MEDIA: prefix (alternative format)
const MEDIA_PREFIX_REGEX = /MEDIA:\s*([^\s]+)/gi

/**
 * Check if a MIME type is a supported image type.
 */
export function isImageMimeType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.has(mimeType.toLowerCase())
}

/**
 * Check if a MIME type is a supported video type.
 */
export function isVideoMimeType(mimeType: string): boolean {
  return SUPPORTED_VIDEO_TYPES.has(mimeType.toLowerCase())
}

/**
 * Check if a MIME type is a supported audio type.
 */
export function isAudioMimeType(mimeType: string): boolean {
  const base = mimeType.toLowerCase().split(';')[0].trim()
  return SUPPORTED_AUDIO_TYPES.has(base) || base.startsWith('audio/')
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

  // Parse [audio attached: /path/to/file.webm (audio/webm) 5.2s] pattern
  // Also parses optional Transcript: "..." or [Voice transcription unavailable: ...] lines
  let match: RegExpExecArray | null
  const audioAttachedRegex = new RegExp(AUDIO_ATTACHED_REGEX)

  while ((match = audioAttachedRegex.exec(content)) !== null) {
    const [fullMatch, path, mimeType, durationStr] = match
    const baseMime = mimeType.toLowerCase().split(';')[0].trim()
    if (isAudioMimeType(baseMime)) {
      // Look for transcript line immediately after the audio tag
      const afterTag = content.slice(match.index + fullMatch.length)

      let transcript: string | undefined
      let transcriptError: string | undefined
      let transcriptMatchText = ''

      const transcriptMatch = TRANSCRIPT_REGEX.exec(afterTag)
      if (transcriptMatch) {
        transcript = transcriptMatch[1]
        transcriptMatchText = transcriptMatch[0]
      } else {
        const errorMatch = TRANSCRIPT_ERROR_REGEX.exec(afterTag)
        if (errorMatch) {
          transcriptError = errorMatch[1].trim()
          transcriptMatchText = errorMatch[0]
        }
      }

      attachments.push({
        type: 'audio',
        path,
        mimeType: baseMime,
        originalText: fullMatch + (transcriptMatchText ? '\n' + transcriptMatchText : ''),
        duration: durationStr ? parseFloat(durationStr) : undefined,
        transcript,
        transcriptError,
      })
      // Remove the audio tag and associated transcript line from text
      let removeText = fullMatch
      if (transcriptMatchText) {
        removeText = fullMatch + '\n' + transcriptMatchText
      }
      text = text.replace(removeText, '').trim()
    }
  }

  // Parse [media attached: /path/to/file.jpg (image/jpeg)] pattern
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
      text = text.replace(fullMatch, '').trim()
    } else if (isVideoMimeType(mimeType)) {
      attachments.push({
        type: 'video',
        path,
        mimeType,
        originalText: fullMatch,
      })
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
    let mediaType: 'image' | 'video' = 'image'

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
      case 'mp4':
        mimeType = 'video/mp4'
        mediaType = 'video'
        break
      case 'webm':
        mimeType = 'video/webm'
        mediaType = 'video'
        break
      case 'mov':
        mimeType = 'video/quicktime'
        mediaType = 'video'
        break
    }

    if (mimeType) {
      // Check if we already added this attachment (avoid duplicates)
      const alreadyAdded = attachments.some((a) => a.path === path)
      if (!alreadyAdded) {
        attachments.push({
          type: mediaType,
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

  // Remove WhatsApp/channel metadata (timestamp, message_id)
  // Pattern: [WhatsApp +324... +1m 2026-02-07 11:41 GMT+1]
  const channelMetaPattern = /\[(WhatsApp|Telegram|Signal|Discord|iMessage|Slack)[^\]]*\]\n?/gi
  text = text.replace(channelMetaPattern, '')

  // Pattern: [message_id: ...]
  const messageIdPattern = /\[message_id:\s*[^\]]+\]\n?/gi
  text = text.replace(messageIdPattern, '')

  // Clean up multiple newlines from removed media
  text = text.replaceAll(/\n{3,}/g, '\n\n').trim()

  return { text, attachments }
}
