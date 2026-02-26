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

// ── Extension → MIME type map ─────────────────────────────────

const EXT_TO_MIME: Record<string, { mimeType: string; mediaType: 'image' | 'video' }> = {
  jpg: { mimeType: 'image/jpeg', mediaType: 'image' },
  jpeg: { mimeType: 'image/jpeg', mediaType: 'image' },
  png: { mimeType: 'image/png', mediaType: 'image' },
  gif: { mimeType: 'image/gif', mediaType: 'image' },
  webp: { mimeType: 'image/webp', mediaType: 'image' },
  mp4: { mimeType: 'video/mp4', mediaType: 'video' },
  webm: { mimeType: 'video/webm', mediaType: 'video' },
  mov: { mimeType: 'video/quicktime', mediaType: 'video' },
}

// ── Helpers ───────────────────────────────────────────────────

function extractAudioTranscript(
  content: string,
  matchIndex: number,
  fullMatchLength: number
): { transcript?: string; transcriptError?: string; matchText: string } {
  const afterTag = content.slice(matchIndex + fullMatchLength)

  const transcriptMatch = TRANSCRIPT_REGEX.exec(afterTag)
  if (transcriptMatch) {
    return { transcript: transcriptMatch[1], matchText: transcriptMatch[0] }
  }

  const errorMatch = TRANSCRIPT_ERROR_REGEX.exec(afterTag)
  if (errorMatch) {
    return { transcriptError: errorMatch[1].trim(), matchText: errorMatch[0] }
  }

  return { matchText: '' }
}

function parseAudioAttachments(
  content: string,
  attachments: MediaAttachment[],
  text: string
): string {
  const audioRegex = new RegExp(AUDIO_ATTACHED_REGEX)
  let match: RegExpExecArray | null

  while ((match = audioRegex.exec(content)) !== null) {
    const [fullMatch, path, mimeType, durationStr] = match
    const baseMime = mimeType.toLowerCase().split(';')[0].trim()
    if (!isAudioMimeType(baseMime)) continue

    const { transcript, transcriptError, matchText } = extractAudioTranscript(
      content,
      match.index,
      fullMatch.length
    )

    attachments.push({
      type: 'audio',
      path,
      mimeType: baseMime,
      originalText: fullMatch + (matchText ? '\n' + matchText : ''),
      duration: durationStr ? parseFloat(durationStr) : undefined,
      transcript,
      transcriptError,
    })

    const removeText = matchText ? fullMatch + '\n' + matchText : fullMatch
    text = text.replace(removeText, '').trim()
  }

  return text
}

function parseImageVideoAttachments(
  content: string,
  attachments: MediaAttachment[],
  text: string
): string {
  const mediaRegex = new RegExp(MEDIA_ATTACHED_REGEX)
  let match: RegExpExecArray | null

  while ((match = mediaRegex.exec(content)) !== null) {
    const [fullMatch, path, mimeType] = match

    if (isImageMimeType(mimeType)) {
      attachments.push({ type: 'image', path, mimeType, originalText: fullMatch })
      text = text.replace(fullMatch, '').trim()
    } else if (isVideoMimeType(mimeType)) {
      attachments.push({ type: 'video', path, mimeType, originalText: fullMatch })
      text = text.replace(fullMatch, '').trim()
    }
  }

  return text
}

function parseMediaPrefixAttachments(
  content: string,
  attachments: MediaAttachment[],
  text: string
): string {
  const mediaPrefixRegex = new RegExp(MEDIA_PREFIX_REGEX)
  let match: RegExpExecArray | null

  while ((match = mediaPrefixRegex.exec(content)) !== null) {
    const [fullMatch, path] = match
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    const info = EXT_TO_MIME[ext]
    if (!info) continue

    const alreadyAdded = attachments.some((a) => a.path === path)
    if (!alreadyAdded) {
      attachments.push({
        type: info.mediaType,
        path,
        mimeType: info.mimeType,
        originalText: fullMatch,
      })
      text = text.replace(fullMatch, '').trim()
    }
  }

  return text
}

function cleanupMessageText(text: string): string {
  // Remove OpenClaw media instruction hint
  text = text.replace(/To send an image back,.*?Keep caption in the text body\.\n?/gs, '')
  // Remove WhatsApp/channel metadata
  text = text.replace(/\[(WhatsApp|Telegram|Signal|Discord|iMessage|Slack)[^\]]*\]\n?/gi, '')
  // Remove message_id annotations
  text = text.replace(/\[message_id:\s*[^\]]+\]\n?/gi, '')
  // Clean up multiple newlines
  text = text.replaceAll(/\n{3,}/g, '\n\n').trim()
  return text
}

/**
 * Parse a message and extract media attachments.
 * Returns the remaining text and a list of attachments.
 */
export function parseMediaAttachments(content: string): ParsedMessage {
  const attachments: MediaAttachment[] = []
  let text = content

  text = parseAudioAttachments(content, attachments, text)
  text = parseImageVideoAttachments(content, attachments, text)
  text = parseMediaPrefixAttachments(content, attachments, text)
  text = cleanupMessageText(text)

  return { text, attachments }
}
