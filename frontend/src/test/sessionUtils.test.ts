import { describe, it, expect } from 'vitest'
import {
  isSubagent,
  getParentSessionKey,
  getChildSessions,
} from '../lib/sessionUtils'
import type { CrewSession } from '../lib/api'

describe('isSubagent', () => {
  it('returns true for subagent sessions', () => {
    expect(isSubagent('agent:main:subagent:abc123')).toBe(true)
  })

  it('returns true for spawn sessions', () => {
    expect(isSubagent('agent:dev:spawn:def456')).toBe(true)
  })

  it('returns false for main sessions', () => {
    expect(isSubagent('agent:main:main')).toBe(false)
  })

  it('returns false for cron sessions', () => {
    expect(isSubagent('agent:main:cron:daily')).toBe(false)
  })
})

describe('getParentSessionKey', () => {
  it('returns parent key for main agent subagents', () => {
    expect(getParentSessionKey('agent:main:subagent:abc')).toBe('agent:main:main')
  })

  it('returns parent key for dev agent subagents', () => {
    expect(getParentSessionKey('agent:dev:subagent:abc')).toBe('agent:dev:dev')
  })

  it('returns null for non-subagent sessions', () => {
    expect(getParentSessionKey('agent:main:main')).toBeNull()
  })

  it('returns null for short keys', () => {
    expect(getParentSessionKey('agent:main')).toBeNull()
  })
})

describe('getChildSessions', () => {
  const mockSessions: CrewSession[] = [
    { key: 'agent:main:main', kind: 'agent', channel: 'cli', updatedAt: Date.now(), sessionId: 's1' },
    { key: 'agent:main:subagent:abc', kind: 'agent', channel: 'cli', updatedAt: Date.now(), sessionId: 's2' },
    { key: 'agent:main:subagent:def', kind: 'agent', channel: 'cli', updatedAt: Date.now(), sessionId: 's3' },
    { key: 'agent:dev:main', kind: 'agent', channel: 'cli', updatedAt: Date.now(), sessionId: 's4' },
  ]

  it('returns child sessions for a parent', () => {
    const children = getChildSessions('agent:main:main', mockSessions)
    expect(children.length).toBe(2)
    expect(children.map(c => c.key)).toContain('agent:main:subagent:abc')
    expect(children.map(c => c.key)).toContain('agent:main:subagent:def')
  })

  it('returns empty array when no children', () => {
    const children = getChildSessions('agent:dev:main', mockSessions)
    expect(children.length).toBe(0)
  })
})
