import { useState, type CSSProperties } from 'react'
import { ImageLightbox } from './ImageLightbox'
import { getMediaUrl, type MediaAttachment } from '@/utils/mediaParser'

interface ImageThumbnailProps {
  readonly attachment: MediaAttachment
  readonly maxWidth?: number
}

/**
 * Thumbnail image with click-to-expand lightbox.
 */
export function ImageThumbnail({ attachment, maxWidth = 200 }: ImageThumbnailProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const mediaUrl = getMediaUrl(attachment.path)

  const containerStyle: CSSProperties = {
    display: 'inline-block',
    marginTop: '6px',
    marginBottom: '4px',
    cursor: 'pointer',
    borderRadius: '8px',
    overflow: 'hidden',
    background: 'rgba(0, 0, 0, 0.05)',
    minWidth: '80px',
    minHeight: '60px',
    position: 'relative',
  }

  const imageStyle: CSSProperties = {
    display: 'block',
    maxWidth: `${maxWidth}px`,
    maxHeight: '200px',
    objectFit: 'cover',
    borderRadius: '8px',
    transition: 'transform 0.2s, opacity 0.2s',
    opacity: imageLoaded ? 1 : 0,
  }

  const loadingStyle: CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#9ca3af',
    fontSize: '12px',
  }

  // Hide failed images completely instead of showing error placeholder
  if (imageError) {
    return null
  }

  return (
    <>
      <div
        style={containerStyle}
        onClick={() => setLightboxOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setLightboxOpen(true)
          }
        }}
        title="Click to view full size"
      >
        {!imageLoaded && (
          <div style={loadingStyle}>
            <span>Loading...</span>
          </div>
        )}
        <img
          src={mediaUrl}
          alt="Attached image"
          style={imageStyle}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
        />
      </div>

      {lightboxOpen && (
        <ImageLightbox src={mediaUrl} alt="Attached image" onClose={() => setLightboxOpen(false)} />
      )}
    </>
  )
}
