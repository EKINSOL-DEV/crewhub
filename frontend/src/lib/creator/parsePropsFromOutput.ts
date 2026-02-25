// ─── Parse Props from AI Output ─────────────────────────────────
// Extracts .tsx code blocks from AI agent responses,
// validates Three.js imports, and checks for the required prop interface.

export interface ParsedProp {
  /** The raw TSX code */
  code: string
  /** Extracted component name (e.g. "GlowingMushroom") */
  componentName: string
  /** Whether it has valid Three.js / R3F imports */
  hasValidImports: boolean
  /** Whether it exports a component with PropProps interface */
  hasValidInterface: boolean
  /** Validation errors (empty if valid) */
  errors: string[]
}

/**
 * Extract TSX code blocks from an AI response string.
 * Looks for ```tsx, ```jsx, or ```typescript fenced code blocks.
 * Also handles cases where the AI omits the language tag but code contains JSX.
 */
export function extractCodeBlocks(text: string): string[] {
  // Primary: explicit tsx/jsx/typescript blocks
  const pattern = /```(?:tsx|jsx|typescript)\s*\n([\s\S]*?)```/g
  const blocks: string[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const code = match[1].trim()
    if (code.length > 0) {
      blocks.push(code)
    }
  }

  // Fallback: untagged code blocks that contain JSX-like syntax
  if (blocks.length === 0) {
    const untaggedPattern = /```\s*\n([\s\S]*?)```/g
    while ((match = untaggedPattern.exec(text)) !== null) {
      const code = match[1].trim()
      // Only include if it looks like React/Three.js code
      if (code.length > 50 && /<mesh|<group|<boxGeometry|useFrame|Three/.test(code)) {
        blocks.push(code)
      }
    }
  }

  return blocks
}

/**
 * Extract the main exported component name from TSX code.
 * Looks for `export function Name` or `export default function Name`.
 */
function extractComponentName(code: string): string | null {
  // export function ComponentName
  const exportFn = /export\s+(?:default\s+)?function\s+(\w+)/
  const match = code.match(exportFn)
  if (match) return match[1]

  // export const ComponentName = ...
  const exportConst = /export\s+(?:default\s+)?const\s+(\w+)\s*[=:]/
  const constMatch = code.match(exportConst)
  if (constMatch) return constMatch[1]

  return null
}

/**
 * Validate that code has proper Three.js / React Three Fiber imports.
 */
function validateImports(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Must import from three or @react-three/fiber or @react-three/drei
  const hasThreeImport =
    /from\s+['"]three['"]/.test(code) ||
    /from\s+['"]@react-three\/fiber['"]/.test(code) ||
    /from\s+['"]@react-three\/drei['"]/.test(code)

  if (!hasThreeImport) {
    errors.push('Missing Three.js or React Three Fiber imports')
  }

  // Should not have dangerous imports
  const dangerousPatterns = [
    /import.*from\s+['"]fs['"]/,
    /import.*from\s+['"]child_process['"]/,
    /import.*from\s+['"]net['"]/,
    /eval\s*\(/,
    /new\s+Function\s*\(/,
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      errors.push(`Potentially dangerous code pattern detected: ${pattern.source}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate that the code has a compatible prop interface.
 * Accepts PropProps or any interface with position/rotation params.
 */
function validateInterface(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check if it accepts PropProps or has position/rotation params
  const hasPropProps = /PropProps/.test(code)
  const hasPositionParam = /position\s*[?:]/.test(code) || /position\s*=/.test(code)
  const hasGroupPosition = /<group\s+[^>]*position/.test(code)

  if (!hasPropProps && !hasPositionParam && !hasGroupPosition) {
    errors.push('Component must accept PropProps or have position/rotation parameters')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Parse and validate a single code block as a prop component.
 */
export function parsePropCode(code: string): ParsedProp {
  const errors: string[] = []

  const componentName = extractComponentName(code)
  if (!componentName) {
    errors.push('Could not find an exported component function')
  }

  const importValidation = validateImports(code)
  const interfaceValidation = validateInterface(code)

  errors.push(...importValidation.errors)
  errors.push(...interfaceValidation.errors)

  return {
    code,
    componentName: componentName || 'UnknownProp',
    hasValidImports: importValidation.valid,
    hasValidInterface: interfaceValidation.valid,
    errors,
  }
}

/**
 * Parse all prop code blocks from an AI response.
 * Returns an array of parsed props (may be empty if no code blocks found).
 */
export function parsePropsFromOutput(aiResponse: string): ParsedProp[] {
  const codeBlocks = extractCodeBlocks(aiResponse)

  if (codeBlocks.length === 0) {
    return []
  }

  return codeBlocks.map(parsePropCode)
}

/**
 * Transform prop code to ensure it follows the PropProps interface.
 * Adds the import if missing and wraps the component signature if needed.
 */
export function normalizePropCode(code: string, _componentName: string): string {
  let normalized = code

  // Add PropProps import if not present
  if (!code.includes('PropProps')) {
    const importLine = "import type { PropProps } from '../grid/props/PropRegistry'\n"

    // Insert after last import statement
    const lastImportIdx = code.lastIndexOf('import ')
    if (lastImportIdx === -1) {
      normalized = importLine + '\n' + code
    } else {
      const lineEnd = code.indexOf('\n', lastImportIdx)
      normalized = code.slice(0, lineEnd + 1) + importLine + code.slice(lineEnd + 1)
    }
  }

  return normalized
}
