import { describe, it, expect, vi, afterEach } from 'vitest'
import type { CrewSession } from '@/lib/api'
import {
  getAccurateBotStatus,
  humanizeLabel,
  extractTaskSummary,
  getActivityText,
} from '@/components/world3d/utils/botActivity'

vi.mock('@/lib/minionUtils', () => ({ hasActiveSubagents: vi.fn() }))
import { hasActiveSubagents } from '@/lib/minionUtils'

function session(overrides: Partial<CrewSession> = {}): CrewSession {
  return {
    key: 'agent:main:main',
    kind: 'agent',
    channel: 'whatsapp',
    updatedAt: Date.now(),
    sessionId: 's1',
    messages: [],
    ...overrides,
  }
}

afterEach(() => vi.restoreAllMocks())

describe('botActivity utils', () => {
  it('humanizes labels with gerunds and acronyms', () => {
    expect(humanizeLabel('fix-api_pr')).toBe('Fixing API PR')
    expect(humanizeLabel('')).toBe('')
  })

  it('computes accurate bot status across thresholds', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    ;(hasActiveSubagents as any).mockReturnValue(true)

    expect(getAccurateBotStatus(session({ updatedAt: now - 1_000 }), true)).toBe('active')
    expect(getAccurateBotStatus(session({ updatedAt: now - 121_000 }), false, [session()])).toBe(
      'supervising'
    )
    ;(hasActiveSubagents as any).mockReturnValue(false)
    expect(getAccurateBotStatus(session({ updatedAt: now - 1_000_000 }), false, [])).toBe(
      'sleeping'
    )
    expect(getAccurateBotStatus(session({ updatedAt: now - 2_000_000 }), false, [])).toBe('offline')
  })

  it('extracts thinking/tool summaries from messages', () => {
    expect(extractTaskSummary([])).toBeNull()
    expect(
      extractTaskSummary([
        { role: 'assistant', content: [{ type: 'thinking' }] as any },
      ] as CrewSession['messages'])
    ).toBe('💭 Thinking…')
    expect(
      extractTaskSummary([
        { role: 'assistant', content: [{ type: 'toolCall', name: 'exec' }] as any },
      ] as CrewSession['messages'])
    ).toBe('🔧 exec')
  })

  it('builds activity text for supervising, active and idle', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    ;(hasActiveSubagents as any).mockReturnValue(true)

    const parent = session({ key: 'agent:main:main', label: 'review-pr', updatedAt: now - 999_999 })
    const child = session({
      key: 'agent:main:subagent:123',
      label: 'fix-ui-bug',
      updatedAt: now - 1000,
    })
    expect(getActivityText(parent, false, [parent, child])).toContain(
      '👁️ Supervising: Fixing UI bug'
    )
    ;(hasActiveSubagents as any).mockReturnValue(false)
    expect(getActivityText(session({ label: 'build-api' }), true, [])).toBe('Building API…')
    expect(getActivityText(session({ label: 'deploy' }), false, [])).toBe('✅ Deploying')
    expect(getActivityText(session({ label: '' }), false, [])).toBe('💤 Idle')
  })
})
