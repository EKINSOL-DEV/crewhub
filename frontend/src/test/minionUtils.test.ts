import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatModel,
  timeAgo,
  getSessionStatus,
  getStatusIndicator,
  formatTokens,
  formatCost,
  getTokenMeterLevel,
  getMinionType,
  getSessionDisplayName,
  shouldBeInParkingLane,
  getIdleOpacity,
  getIdleTimeSeconds,
} from '../lib/minionUtils'
import type { CrewSession } from '../lib/api'

const makeMockSession = (overrides: Partial<CrewSession> = {}): CrewSession => ({
  key: 'agent:main:main',
  kind: 'agent',
  channel: 'cli',
  updatedAt: Date.now(),
  sessionId: 'test-123',
  ...overrides,
})

describe('formatModel', () => {
  it('formats anthropic models', () => {
    expect(formatModel('anthropic/claude-sonnet-4-20250514')).toBe('Sonnet 4-20250514')
    expect(formatModel('anthropic/claude-opus-4')).toBe('Opus 4')
  })

  it('formats openai models', () => {
    expect(formatModel('openai/gpt-4')).toBe('gpt-4')
  })

  it('formats bare claude models', () => {
    expect(formatModel('claude-sonnet-4')).toBe('Sonnet 4')
    expect(formatModel('claude-opus-4')).toBe('Opus 4')
  })
})

describe('timeAgo', () => {
  it('shows "Just now" for <10s', () => {
    expect(timeAgo(Date.now() - 5000)).toBe('Just now')
  })

  it('shows seconds for <1m', () => {
    expect(timeAgo(Date.now() - 30000)).toBe('30s ago')
  })

  it('shows minutes for <1h', () => {
    expect(timeAgo(Date.now() - 120000)).toBe('2m ago')
  })

  it('shows hours for <1d', () => {
    expect(timeAgo(Date.now() - 7200000)).toBe('2h ago')
  })

  it('shows days for >1d', () => {
    expect(timeAgo(Date.now() - 172800000)).toBe('2d ago')
  })
})

describe('getSessionStatus', () => {
  it('returns active for recent sessions', () => {
    expect(getSessionStatus(makeMockSession({ updatedAt: Date.now() }))).toBe('active')
  })

  it('returns idle for sessions 10 minutes old', () => {
    expect(getSessionStatus(makeMockSession({ updatedAt: Date.now() - 10 * 60 * 1000 }))).toBe(
      'idle'
    )
  })

  it('returns sleeping for sessions 1 hour old', () => {
    expect(getSessionStatus(makeMockSession({ updatedAt: Date.now() - 60 * 60 * 1000 }))).toBe(
      'sleeping'
    )
  })

  it('returns supervising when parent has active subagents', () => {
    const parentSession = makeMockSession({
      key: 'agent:dev:main',
      updatedAt: Date.now() - 10 * 60 * 1000, // 10 min ago (would be idle)
    })
    const activeSubagent = makeMockSession({
      key: 'agent:dev:subagent:abc123',
      updatedAt: Date.now() - 30 * 1000, // 30s ago (active)
    })
    const allSessions = [parentSession, activeSubagent]
    expect(getSessionStatus(parentSession, allSessions)).toBe('supervising')
  })

  it('returns idle when subagents are also idle', () => {
    const parentSession = makeMockSession({
      key: 'agent:dev:main',
      updatedAt: Date.now() - 10 * 60 * 1000,
    })
    const staleSubagent = makeMockSession({
      key: 'agent:dev:subagent:abc123',
      updatedAt: Date.now() - 20 * 60 * 1000, // 20 min ago (not active)
    })
    const allSessions = [parentSession, staleSubagent]
    expect(getSessionStatus(parentSession, allSessions)).toBe('idle')
  })

  it('does not mark subagent as supervising its siblings', () => {
    const subagent1 = makeMockSession({
      key: 'agent:dev:subagent:abc',
      updatedAt: Date.now() - 10 * 60 * 1000,
    })
    const subagent2 = makeMockSession({
      key: 'agent:dev:subagent:def',
      updatedAt: Date.now() - 30 * 1000,
    })
    expect(getSessionStatus(subagent1, [subagent1, subagent2])).toBe('idle')
  })

  it('cron session shows supervising when its subagent is active', () => {
    const cronSession = makeMockSession({
      key: 'agent:main:cron:daily',
      updatedAt: Date.now() - 10 * 60 * 1000,
    })
    const subagent = makeMockSession({
      key: 'agent:main:subagent:task1',
      updatedAt: Date.now() - 30 * 1000,
    })
    expect(getSessionStatus(cronSession, [cronSession, subagent])).toBe('supervising')
  })
})

describe('getStatusIndicator', () => {
  it('returns green for active', () => {
    const indicator = getStatusIndicator('active')
    expect(indicator.emoji).toBe('🟢')
    expect(indicator.label).toBe('Active')
  })

  it('returns yellow for idle', () => {
    const indicator = getStatusIndicator('idle')
    expect(indicator.emoji).toBe('🟡')
    expect(indicator.label).toBe('Idle')
  })

  it('returns supervising indicator', () => {
    const indicator = getStatusIndicator('supervising')
    expect(indicator.emoji).toBe('👁️')
    expect(indicator.label).toBe('Supervising')
  })

  it('returns sleeping indicator', () => {
    const indicator = getStatusIndicator('sleeping')
    expect(indicator.emoji).toBe('💤')
    expect(indicator.label).toBe('Sleeping')
  })
})

describe('formatTokens', () => {
  it('formats millions', () => {
    expect(formatTokens(1500000)).toBe('1.5M')
  })

  it('formats thousands', () => {
    expect(formatTokens(1500)).toBe('1.5K')
  })

  it('formats small numbers', () => {
    expect(formatTokens(500)).toBe('500')
  })

  it('formats zero', () => {
    expect(formatTokens(0)).toBe('0')
  })
})

describe('formatCost', () => {
  it('formats small costs with 4 decimals', () => {
    expect(formatCost(0.0012)).toBe('$0.0012')
  })

  it('formats medium costs with 3 decimals', () => {
    expect(formatCost(0.123)).toBe('$0.123')
  })

  it('formats large costs with 2 decimals', () => {
    expect(formatCost(12.34)).toBe('$12.34')
  })
})

describe('getTokenMeterLevel', () => {
  it('returns 0 for no tokens', () => {
    expect(getTokenMeterLevel(0)).toBe(0)
  })

  it('returns 1 for small token count', () => {
    expect(getTokenMeterLevel(100)).toBe(1)
  })

  it('returns 5 for very large token count', () => {
    expect(getTokenMeterLevel(100000)).toBe(5)
  })
})

describe('getMinionType', () => {
  it('identifies main agent', () => {
    const t = getMinionType(makeMockSession({ key: 'agent:main:main' }))
    expect(t.type).toBe('Main Agent')
  })

  it('identifies cron worker', () => {
    const t = getMinionType(makeMockSession({ key: 'agent:main:cron:daily' }))
    expect(t.type).toBe('Cron Worker')
  })

  it('identifies subagent', () => {
    const t = getMinionType(makeMockSession({ key: 'agent:main:subagent:abc' }))
    expect(t.type).toBe('Subagent')
  })

  it('identifies spawn as subagent', () => {
    const t = getMinionType(makeMockSession({ key: 'agent:main:spawn:abc' }))
    expect(t.type).toBe('Subagent')
  })

  it('identifies whatsapp bot', () => {
    const t = getMinionType(makeMockSession({ key: 'agent:main:whatsapp:123' }))
    expect(t.type).toBe('WhatsApp Bot')
  })

  it('identifies slack bot', () => {
    const t = getMinionType(makeMockSession({ key: 'agent:main:slack:123' }))
    expect(t.type).toBe('Slack Bot')
  })

  it('identifies telegram bot', () => {
    const t = getMinionType(makeMockSession({ key: 'agent:main:telegram:123' }))
    expect(t.type).toBe('Telegram Bot')
  })

  it('returns generic agent for unknown', () => {
    const t = getMinionType(makeMockSession({ key: 'agent:unknown:something' }))
    expect(t.type).toBe('Agent')
  })
})

describe('getSessionDisplayName', () => {
  it('uses custom name if provided', () => {
    expect(getSessionDisplayName(makeMockSession(), 'Custom Name')).toBe('Custom Name')
  })

  it('uses label if available', () => {
    expect(getSessionDisplayName(makeMockSession({ label: 'My Task' }))).toBe('My Task')
  })

  it('uses agent name for main sessions', () => {
    const name = getSessionDisplayName(makeMockSession({ key: 'agent:main:main' }))
    expect(name).toBe('Assistent')
  })

  it('uses agent name for dev main', () => {
    const name = getSessionDisplayName(makeMockSession({ key: 'agent:dev:main' }))
    expect(name).toBe('Dev')
  })

  it('generates friendly name for subagents', () => {
    const name = getSessionDisplayName(makeMockSession({ key: 'agent:main:subagent:abc123' }))
    expect(name).toBeTruthy()
    expect(name).toContain('-') // adjective-noun format
  })
})

describe('shouldBeInParkingLane', () => {
  it('main agents never go to parking', () => {
    expect(shouldBeInParkingLane(makeMockSession({ key: 'agent:main:main', updatedAt: 0 }))).toBe(
      false
    )
    expect(shouldBeInParkingLane(makeMockSession({ key: 'agent:dev:main', updatedAt: 0 }))).toBe(
      false
    )
  })

  it('sleeping sessions go to parking', () => {
    expect(
      shouldBeInParkingLane(
        makeMockSession({
          key: 'agent:main:subagent:abc',
          updatedAt: Date.now() - 60 * 60 * 1000,
        })
      )
    ).toBe(true)
  })

  it('active subagents stay out of parking', () => {
    expect(
      shouldBeInParkingLane(
        makeMockSession({
          key: 'agent:main:subagent:abc',
          updatedAt: Date.now(),
        }),
        true
      )
    ).toBe(false)
  })
})

describe('getIdleOpacity', () => {
  it('returns 1.0 for <60s idle', () => {
    expect(getIdleOpacity(30)).toBe(1.0)
  })

  it('returns 0 for >300s idle', () => {
    expect(getIdleOpacity(400)).toBe(0)
  })

  it('fades progressively', () => {
    const opacities = [30, 90, 150, 210, 270, 400].map(getIdleOpacity)
    // Each should be <= the previous
    for (let i = 1; i < opacities.length; i++) {
      expect(opacities[i]).toBeLessThanOrEqual(opacities[i - 1])
    }
  })
})

describe('getIdleTimeSeconds', () => {
  it('calculates idle time from updatedAt', () => {
    const session = makeMockSession({ updatedAt: Date.now() - 5000 })
    const idle = getIdleTimeSeconds(session)
    expect(idle).toBeGreaterThanOrEqual(4)
    expect(idle).toBeLessThanOrEqual(6)
  })
})
