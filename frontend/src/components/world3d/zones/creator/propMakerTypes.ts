/**
 * Shared types for FullscreenPropMaker and its sub-components.
 */

import type { PropPart } from './DynamicProp'

export interface ModelOption {
  key: string
  id: string
  label: string
  provider: string
}

export interface ThinkingLine {
  text: string
  type:
    | 'status'
    | 'thinking'
    | 'text'
    | 'tool'
    | 'tool_result'
    | 'correction'
    | 'complete'
    | 'error'
    | 'model'
    | 'prompt'
}

export interface GenerationRecord {
  id: string
  prompt: string
  name: string
  model: string
  modelLabel: string
  method: string
  fullPrompt: string
  toolCalls: { name: string; input: string }[]
  corrections: string[]
  diagnostics: string[]
  parts: PropPart[]
  code: string
  createdAt: string
  error: string | null
}

export interface PropUsagePlacement {
  blueprintId: string
  blueprintName: string
  roomId: string
  instanceCount: number
}

export type TabId = 'generate' | 'history' | 'advanced'
export type TransformMode = 'translate' | 'rotate' | 'scale'
export type GenerationMode = 'standard' | 'hybrid'
