import { useEffect, useCallback, type CSSProperties } from 'react'
import { X } from 'lucide-react'

interface ImageLightboxProps {
  readonly src: string
  readonly alt?: string
  readonly onClose: () => void
}

/**
 * Fullscreen lightbox overlay for viewing images.
 * Closes on click outside, X button, or Escape key.
 */
export function ImageLightbox({ src, alt = 'Image', onClose }: ImageLightboxProps) {
  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    cursor: 'pointer',
    padding: '40px',
  }

  const imageContainerStyle: CSSProperties = {
    position: 'relative',
    maxWidth: '100%',
    maxHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const imageStyle: CSSProperties = {
    maxWidth: '100%',
    maxHeight: 'calc(100vh - 80px)',
    objectFit: 'contain',
    borderRadius: '8px',
    cursor: 'default',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  }

  const closeButtonStyle: CSSProperties = {
    position: 'fixed',
    top: '16px',
    right: '16px',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    zIndex: 10001,
  }

  return (
    <div // NOSONAR: backdrop div closes lightbox on click; role='dialog' conveys purpose
      style={overlayStyle}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Close button */}
      <button
        style={closeButtonStyle}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
        }}
        aria-label="Close"
      >
        <X size={24} />
      </button>

      {/* Image container - stop propagation to prevent closing when clicking image */}
      <div style={imageContainerStyle} onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} style={imageStyle} loading="eager" />
      </div>
    </div>
  )
}
