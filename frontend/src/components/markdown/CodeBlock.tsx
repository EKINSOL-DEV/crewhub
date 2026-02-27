import { useState, useCallback } from 'react'

interface CodeBlockProps {
  readonly className?: string
  readonly children: string | number | boolean | null | undefined
}

export function CodeBlock({ className, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const language = className?.replace('language-', '') || ''

  const handleCopy = useCallback(() => {
    const text = String(children).replace(/\n$/, '')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [children])

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      {language && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            fontSize: 10,
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 600,
          }}
        >
          {language}
        </div>
      )}
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'hsl(var(--secondary))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: 11,
          color: 'hsl(var(--muted-foreground))',
          cursor: 'pointer',
          opacity: 0.7,
          transition: 'opacity 0.15s',
          zIndex: 1,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <pre
        style={{
          background: 'hsl(var(--secondary))',
          borderRadius: 8,
          padding: language ? '32px 16px 16px' : '16px',
          overflow: 'auto',
          fontSize: 13,
          lineHeight: 1.5,
          border: '1px solid hsl(var(--border))',
        }}
      >
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}
