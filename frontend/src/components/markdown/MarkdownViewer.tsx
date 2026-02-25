import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { rehypeHighlightLite } from './rehypeHighlightLite'
import { CodeBlock } from './CodeBlock'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractText(node: any): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node?.props?.children) return extractText(node.props.children)
  return ''
}

interface MarkdownViewerProps {
  content: string
  className?: string
  maxHeight?: string
}

export function MarkdownViewer({ content, className, maxHeight }: MarkdownViewerProps) {
  const components = useMemo(
    () => ({
      h1: ({ children, ...props }: any) => {
        const text = extractText(children)
        const id = slugify(text)
        return (
          <h1
            id={id}
            {...props}
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 24,
              marginBottom: 12,
              color: 'var(--zen-fg, hsl(var(--foreground)))',
              borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
              paddingBottom: 8,
            }}
          >
            {children}
          </h1>
        )
      },
      h2: ({ children, ...props }: any) => {
        const text = extractText(children)
        const id = slugify(text)
        return (
          <h2
            id={id}
            {...props}
            style={{
              fontSize: 20,
              fontWeight: 600,
              marginTop: 20,
              marginBottom: 10,
              color: 'var(--zen-fg, hsl(var(--foreground)))',
              borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
              paddingBottom: 6,
            }}
          >
            {children}
          </h2>
        )
      },
      h3: ({ children, ...props }: any) => {
        const text = extractText(children)
        const id = slugify(text)
        return (
          <h3
            id={id}
            {...props}
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginTop: 16,
              marginBottom: 8,
              color: 'var(--zen-fg, hsl(var(--foreground)))',
            }}
          >
            {children}
          </h3>
        )
      },
      h4: ({ children, ...props }: any) => {
        const text = extractText(children)
        const id = slugify(text)
        return (
          <h4
            id={id}
            {...props}
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginTop: 14,
              marginBottom: 6,
              color: 'var(--zen-fg, hsl(var(--foreground)))',
            }}
          >
            {children}
          </h4>
        )
      },
      p: ({ children }: any) => (
        <p
          style={{
            marginBottom: 12,
            lineHeight: 1.7,
            color: 'var(--zen-fg, hsl(var(--foreground)))',
          }}
        >
          {children}
        </p>
      ),
      ul: ({ children }: any) => (
        <ul style={{ marginBottom: 12, paddingLeft: 24, listStyleType: 'disc' }}>{children}</ul>
      ),
      ol: ({ children }: any) => (
        <ol style={{ marginBottom: 12, paddingLeft: 24, listStyleType: 'decimal' }}>{children}</ol>
      ),
      li: ({ children }: any) => (
        <li
          style={{
            marginBottom: 4,
            lineHeight: 1.6,
            color: 'var(--zen-fg, hsl(var(--foreground)))',
          }}
        >
          {children}
        </li>
      ),
      a: ({ href, children }: any) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--zen-accent, hsl(var(--primary)))', textDecoration: 'underline' }}
        >
          {children}
        </a>
      ),
      blockquote: ({ children }: any) => (
        <blockquote
          style={{
            borderLeft: '3px solid var(--zen-accent, hsl(var(--primary)))',
            paddingLeft: 16,
            margin: '12px 0',
            color: 'var(--zen-fg-muted, hsl(var(--muted-foreground)))',
            fontStyle: 'italic',
          }}
        >
          {children}
        </blockquote>
      ),
      table: ({ children }: any) => (
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            {children}
          </table>
        </div>
      ),
      th: ({ children }: any) => (
        <th
          style={{
            border: '1px solid var(--zen-border, hsl(var(--border)))',
            padding: '8px 12px',
            textAlign: 'left',
            fontWeight: 600,
            background: 'var(--zen-bg-elevated, hsl(var(--secondary)))',
          }}
        >
          {children}
        </th>
      ),
      td: ({ children }: any) => (
        <td
          style={{ border: '1px solid var(--zen-border, hsl(var(--border)))', padding: '8px 12px' }}
        >
          {children}
        </td>
      ),
      code: ({ className, children, ...props }: any) => {
        const isBlock =
          className?.startsWith('language-') ||
          (typeof children === 'string' && children.includes('\n'))
        if (isBlock) {
          return <CodeBlock className={className}>{children}</CodeBlock>
        }
        return (
          <code
            style={{
              background: 'var(--zen-bg-elevated, hsl(var(--secondary)))',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: '0.9em',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}
            {...props}
          >
            {children}
          </code>
        )
      },
      pre: ({ children }: any) => <>{children}</>,
      hr: () => (
        <hr
          style={{
            border: 'none',
            borderTop: '1px solid var(--zen-border, hsl(var(--border)))',
            margin: '24px 0',
          }}
        />
      ),
      img: ({ src, alt }: any) => {
        // Only render remote images
        if (src?.startsWith('http')) {
          return (
            <img
              src={src}
              alt={alt || ''}
              style={{ maxWidth: '100%', borderRadius: 8, margin: '12px 0' }}
            />
          )
        }
        return (
          <span
            style={{
              color: 'var(--zen-fg-muted, hsl(var(--muted-foreground)))',
              fontStyle: 'italic',
            }}
          >
            [Image: {alt || src}]
          </span>
        )
      },
      input: ({ type, checked, ...props }: any) => {
        if (type === 'checkbox') {
          return (
            <input
              type="checkbox"
              checked={checked}
              disabled
              style={{ marginRight: 6 }}
              {...props}
            />
          )
        }
        return <input {...props} />
      },
    }),
    []
  )

  return (
    <div
      className={className}
      style={{
        maxHeight,
        overflow: maxHeight ? 'auto' : undefined,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
        lineHeight: 1.7,
        maxWidth: 720,
        color: 'var(--zen-fg, hsl(var(--foreground)))',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlightLite]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
