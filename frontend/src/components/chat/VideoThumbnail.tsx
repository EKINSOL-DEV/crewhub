import { useState, type CSSProperties } from 'react'
import { getMediaUrl, type MediaAttachment } from '@/utils/mediaParser'

interface VideoThumbnailProps {
  attachment: MediaAttachment
  maxWidth?: number
}

/**
 * Video player with click-to-expand controls.
 */
export function VideoThumbnail({ attachment, maxWidth = 300 }: VideoThumbnailProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [videoError, setVideoError] = useState(false)

  const mediaUrl = getMediaUrl(attachment.path)

  if (videoError) {
    return (
      <div
        style={{
          padding: '12px 16px',
          background: 'rgba(255, 100, 100, 0.1)',
          borderRadius: '8px',
          color: '#ff6b6b',
          fontSize: '12px',
        }}
      >
        ⚠️ Failed to load video
      </div>
    )
  }

  const containerStyle: CSSProperties = {
    position: 'relative',
    maxWidth: isExpanded ? '100%' : maxWidth,
    borderRadius: '8px',
    overflow: 'hidden',
    background: '#000',
  }

  const videoStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    maxHeight: isExpanded ? '80vh' : '200px',
    objectFit: 'contain',
    borderRadius: '8px',
  }

  const expandButtonStyle: CSSProperties = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '4px 8px',
    background: 'rgba(0, 0, 0, 0.6)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
    zIndex: 10,
  }

  return (
    <div style={containerStyle}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={expandButtonStyle}
        title={isExpanded ? 'Collapse' : 'Expand'}
      >
        {isExpanded ? '⊟ Collapse' : '⊞ Expand'}
      </button>
      <video
        src={mediaUrl}
        controls
        playsInline
        preload="metadata"
        style={videoStyle}
        onError={() => setVideoError(true)}
      >
        Your browser does not support video playback.
      </video>
    </div>
  )
}
