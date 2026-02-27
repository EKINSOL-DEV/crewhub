/**
 * Parse structured meeting output markdown into typed sections.
 * Handles the synthesis prompt format from MeetingOrchestrator.
 */

export type ActionItemPriority = 'high' | 'medium' | 'low'

export interface ParsedActionItem {
  id: string
  text: string
  assignee?: string
  priority: ActionItemPriority
  checked: boolean
}

export interface ParsedSection {
  heading: string
  content: string
  level: number
}

export interface ParsedMeetingOutput {
  title: string
  goal: string
  participants: string[]
  summary: string[]
  actionItems: ParsedActionItem[]
  decisions: string[]
  blockers: string[]
  sections: ParsedSection[]
  rawMd: string
}

function parseActionItem(line: string, index: number): ParsedActionItem {
  // Format: - [ ] @agent_name: description [priority: high/medium/low]
  // Or: - [x] @agent_name: description [priority: high]
  const checked = line.startsWith('- [x]') || line.startsWith('- [X]')
  let text = line.replace(/^- \[[ xX]\]\s*/, '')

  let assignee: string | undefined
  const assigneeMatch = /^@(\S+):\s*/.exec(text)
  if (assigneeMatch) {
    assignee = assigneeMatch[1]
    text = text.slice(assigneeMatch[0].length)
  }

  let priority: ActionItemPriority = 'medium'
  const priorityMatch = /\[priority:\s*(high|medium|low)\]\s*$/.exec(text)
  if (priorityMatch) {
    priority = priorityMatch[1] as ActionItemPriority
    text = text.slice(0, -priorityMatch[0].length).trim()
  }

  return {
    id: `ai_${index}`,
    text: text.trim(),
    assignee,
    priority,
    checked,
  }
}

export function parseMeetingOutput(md: string): ParsedMeetingOutput {
  const result: ParsedMeetingOutput = {
    title: '',
    goal: '',
    participants: [],
    summary: [],
    actionItems: [],
    decisions: [],
    blockers: [],
    sections: [],
    rawMd: md,
  }

  if (!md) return result

  const lines = md.split('\n')
  let currentSection = ''
  let currentContent: string[] = []
  let actionItemIndex = 0

  const flushSection = () => {
    if (!currentSection) return
    const content = currentContent.join('\n').trim()
    const lower = currentSection.toLowerCase()

    if (lower.includes('goal')) {
      result.goal = content
    } else if (lower.includes('participant')) {
      result.participants = content
        .split('\n')
        .map((l) => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
    } else if (lower.includes('summary') || lower.includes('discussion')) {
      result.summary = content
        .split('\n')
        .filter((l) => l.trim().startsWith('-') || l.trim().startsWith('•'))
        .map((l) => l.replace(/^[-•*]\s*/, '').trim())
      if (result.summary.length === 0 && content) {
        result.summary = [content]
      }
    } else if (lower.includes('action item') || lower.includes('next step')) {
      content.split('\n').forEach((line) => {
        if (/^- \[[ xX]\]/.exec(line.trim())) {
          result.actionItems.push(parseActionItem(line.trim(), actionItemIndex++))
        }
      })
    } else if (lower.includes('decision')) {
      result.decisions = content
        .split('\n')
        .map((l) => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
    } else if (lower.includes('blocker')) {
      result.blockers = content
        .split('\n')
        .map((l) => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
    }

    result.sections.push({
      heading: currentSection,
      content,
      level: 2,
    })

    currentContent = []
  }

  for (const line of lines) {
    // H1 title
    if (line.startsWith('# ') && !result.title) {
      result.title = line.slice(2).trim()
      continue
    }

    // H2 section headers
    if (line.startsWith('## ')) {
      flushSection()
      currentSection = line.slice(3).trim()
      continue
    }

    if (currentSection) {
      currentContent.push(line)
    }
  }

  // Flush last section
  flushSection()

  return result
}
