/**
 * Lightweight rehype-highlight alternative that imports only needed languages.
 * Avoids importing lowlight/common which bundles ~40 languages (~300KB).
 * Instead, we use createLowlight() with only the languages we need (~50KB).
 */
import { createLowlight } from 'lowlight'
import type { Root, Element, ElementContent, Text } from 'hast'
import { visit } from 'unist-util-visit'

// Import only the languages we actually need
// @ts-ignore — highlight.js language modules lack type declarations
import javascript from 'highlight.js/lib/languages/javascript'
// @ts-ignore — highlight.js language modules lack type declarations
import typescript from 'highlight.js/lib/languages/typescript'
// @ts-ignore — highlight.js language modules lack type declarations
import python from 'highlight.js/lib/languages/python'
// @ts-ignore — highlight.js language modules lack type declarations
import bash from 'highlight.js/lib/languages/bash'
// @ts-ignore — highlight.js language modules lack type declarations
import json from 'highlight.js/lib/languages/json'
// @ts-ignore — highlight.js language modules lack type declarations
import markdown from 'highlight.js/lib/languages/markdown'
// @ts-ignore — highlight.js language modules lack type declarations
import yaml from 'highlight.js/lib/languages/yaml'
// @ts-ignore — highlight.js language modules lack type declarations
import xml from 'highlight.js/lib/languages/xml'
// @ts-ignore — highlight.js language modules lack type declarations
import css from 'highlight.js/lib/languages/css'
// @ts-ignore — highlight.js language modules lack type declarations
import sql from 'highlight.js/lib/languages/sql'

const lowlight = createLowlight()

// Register languages
lowlight.register('javascript', javascript)
lowlight.register('typescript', typescript)
lowlight.register('python', python)
lowlight.register('bash', bash)
lowlight.register('json', json)
lowlight.register('markdown', markdown)
lowlight.register('yaml', yaml)
lowlight.register('xml', xml)
lowlight.register('css', css)
lowlight.register('sql', sql)

// Register aliases
lowlight.registerAlias('javascript', ['js'])
lowlight.registerAlias('typescript', ['ts', 'tsx'])
lowlight.registerAlias('python', ['py'])
lowlight.registerAlias('bash', ['sh', 'shell', 'zsh'])
lowlight.registerAlias('xml', ['html', 'svg'])
lowlight.registerAlias('yaml', ['yml'])

/** Extract plain text from a hast node tree */
function hastToString(node: Element | Text): string {
  if (node.type === 'text') return node.value
  if ('children' in node) {
    return (node.children as Array<Element | Text>).map(hastToString).join('')
  }
  return ''
}

/**
 * Rehype plugin to highlight code blocks using lowlight with only needed languages.
 */
export function rehypeHighlightLite() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, _index, parent) => {
      if (
        node.tagName !== 'code' ||
        !parent ||
        (parent as Element).tagName !== 'pre'
      ) {
        return
      }

      const className = (node.properties?.className as string[] | undefined) || []
      const langClass = className.find((c: string) => c.startsWith('language-'))
      const lang = langClass?.replace('language-', '')

      if (!lang) return

      const text = hastToString(node)

      try {
        const result = lowlight.highlight(lang, text)
        node.children = result.children as ElementContent[]
        // Ensure the language class is preserved
        const classes = [...className]
        if (!classes.includes(`language-${lang}`)) {
          classes.push(`language-${lang}`)
        }
        if (!classes.includes('hljs')) {
          classes.push('hljs')
        }
        node.properties = { ...node.properties, className: classes }
      } catch {
        // Language not registered or parse error — leave as-is
      }
    })
  }
}
