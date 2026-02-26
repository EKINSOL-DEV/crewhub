import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { rehypeHighlightLite } from './rehypeHighlightLite'
import { CodeBlock } from './CodeBlock'

const BORDER_1PX_SOLID_VAR_ZEN_BORDER_HSL_V = '1px solid var(--zen-border, hsl(var(--border)))'
const VAR_ZEN_FG = 'var(--zen-fg, hsl(var(--foreground)))'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^\w]+/g, '-')
    .replaceAll(/^-|-$/g, '')
}

function extractText(node: any): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node?.props?.children) return extractText(node.props.children)
  return ''
}

// ── Module-level markdown component renderers ──────────────────

function MdH1({ children, ...props }: any) {
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
        color: VAR_ZEN_FG,
        borderBottom: BORDER_1PX_SOLID_VAR_ZEN_BORDER_HSL_V,
        paddingBottom: 8,
      }}
    >
      {children}
    </h1>
  )
}

function MdH2({ children, ...props }: any) {
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
        color: VAR_ZEN_FG,
        borderBottom: BORDER_1PX_SOLID_VAR_ZEN_BORDER_HSL_V,
        paddingBottom: 6,
      }}
    >
      {children}
    </h2>
  )
}

function MdH3({ children, ...props }: any) {
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
        color: VAR_ZEN_FG,
      }}
    >
      {children}
    </h3>
  )
}

function MdH4({ children, ...props }: any) {
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
        color: VAR_ZEN_FG,
      }}
    >
      {children}
    </h4>
  )
}

function MdP({ children }: any) {
  return (
    <p
      style={{
        marginBottom: 12,
        lineHeight: 1.7,
        color: VAR_ZEN_FG,
      }}
    >
      {children}
    </p>
  )
}

function MdUl({ children }: any) {
  return <ul style={{ marginBottom: 12, paddingLeft: 24, listStyleType: 'disc' }}>{children}</ul>
}

function MdOl({ children }: any) {
  return <ol style={{ marginBottom: 12, paddingLeft: 24, listStyleType: 'decimal' }}>{children}</ol>
}

function MdLi({ children }: any) {
  return (
    <li
      style={{
        marginBottom: 4,
        lineHeight: 1.6,
        color: VAR_ZEN_FG,
      }}
    >
      {children}
    </li>
  )
}

function MdA({ href, children }: any) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--zen-accent, hsl(var(--primary)))', textDecoration: 'underline' }}
    >
      {children}
    </a>
  )
}

function MdBlockquote({ children }: any) {
  return (
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
  )
}

function MdTable({ children }: any) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>{children}</table>
    </div>
  )
}

function MdTh({ children }: any) {
  return (
    <th
      style={{
        border: BORDER_1PX_SOLID_VAR_ZEN_BORDER_HSL_V,
        padding: '8px 12px',
        textAlign: 'left',
        fontWeight: 600,
        background: 'var(--zen-bg-elevated, hsl(var(--secondary)))',
      }}
    >
      {children}
    </th>
  )
}

function MdTd({ children }: any) {
  return (
    <td style={{ border: BORDER_1PX_SOLID_VAR_ZEN_BORDER_HSL_V, padding: '8px 12px' }}>
      {children}
    </td>
  )
}

function MdCode({ className, children, ...props }: any) {
  const isBlock =
    className?.startsWith('language-') || (typeof children === 'string' && children.includes('\n'))
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
}

function MdPre({ children }: any) {
  return <>{children}</>
}

function MdHr() {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: BORDER_1PX_SOLID_VAR_ZEN_BORDER_HSL_V,
        margin: '24px 0',
      }}
    />
  )
}

function MdImg({ src, alt }: any) {
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
}

function MdInput({ type, checked, ...props }: any) {
  if (type === 'checkbox') {
    return (
      <input type="checkbox" checked={checked} disabled style={{ marginRight: 6 }} {...props} />
    )
  }
  return <input {...props} />
}

// ── Static components map (created once at module level) ───────

const MD_COMPONENTS = {
  h1: MdH1,
  h2: MdH2,
  h3: MdH3,
  h4: MdH4,
  p: MdP,
  ul: MdUl,
  ol: MdOl,
  li: MdLi,
  a: MdA,
  blockquote: MdBlockquote,
  table: MdTable,
  th: MdTh,
  td: MdTd,
  code: MdCode,
  pre: MdPre,
  hr: MdHr,
  img: MdImg,
  input: MdInput,
}

// ── MarkdownViewer ─────────────────────────────────────────────

interface MarkdownViewerProps {
  readonly content: string
  readonly className?: string
  readonly maxHeight?: string
}

export function MarkdownViewer({ content, className, maxHeight }: MarkdownViewerProps) {
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
        color: VAR_ZEN_FG,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlightLite]}
        components={MD_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
