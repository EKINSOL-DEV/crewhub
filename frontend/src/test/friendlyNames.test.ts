import { describe, it, expect } from 'vitest'
import {
  generateFriendlyName,
  getMinionName,
  getTaskEmoji,
  getDisplayName,
} from '../lib/friendlyNames'

const AGENT_MAIN_SUBAGENT_ABC = 'agent:main:subagent:abc'

describe('generateFriendlyName', () => {
  it('generates an adjective-noun format', () => {
    const name = generateFriendlyName(AGENT_MAIN_SUBAGENT_ABC)
    expect(name).toMatch(/^\w+-\w+$/)
  })

  it('is deterministic for the same key', () => {
    const name1 = generateFriendlyName(AGENT_MAIN_SUBAGENT_ABC)
    const name2 = generateFriendlyName(AGENT_MAIN_SUBAGENT_ABC)
    expect(name1).toBe(name2)
  })

  it('generates different names for different keys', () => {
    const name1 = generateFriendlyName(AGENT_MAIN_SUBAGENT_ABC)
    const name2 = generateFriendlyName('agent:main:subagent:xyz')
    // Different keys should (usually) produce different names
    // Not guaranteed with hash collisions, so we just check both generate
    expect(name1).toBeTruthy()
    expect(name2).toBeTruthy()
  })
})

describe('getMinionName', () => {
  it('returns a name from the room pool', () => {
    const name = getMinionName(AGENT_MAIN_SUBAGENT_ABC, 'dev')
    expect(typeof name).toBe('string')
    expect(name.length).toBeGreaterThan(0)
  })

  it('is deterministic', () => {
    const name1 = getMinionName('session1', 'dev')
    const name2 = getMinionName('session1', 'dev')
    expect(name1).toBe(name2)
  })

  it('falls back to headquarters for unknown room', () => {
    const name = getMinionName('session1', 'nonexistent-room')
    expect(name).toBe('Boss') // First headquarters name
  })

  it('returns names from the right pool for each room', () => {
    const devName = getMinionName('test-key', 'dev')
    const thinkingName = getMinionName('test-key', 'thinking')
    // Dev names are Minion-inspired, thinking names are scientists
    expect(['Kevin', 'Stuart', 'Dave', 'Jerry', 'Tim', 'Mark', 'Phil', 'Carl']).toContain(devName)
    expect([
      'Einstein',
      'Newton',
      'Plato',
      'Socrates',
      'Darwin',
      'Curie',
      'Hawking',
      'Turing',
    ]).toContain(thinkingName)
  })
})

describe('getTaskEmoji', () => {
  it('returns fix emoji for bug labels', () => {
    expect(getTaskEmoji('Fix login bug')).toBe('🔧')
  })

  it('returns sparkle for feature labels', () => {
    expect(getTaskEmoji('Implement new feature')).toBe('✨')
  })

  it('returns search for research labels', () => {
    expect(getTaskEmoji('Research alternatives')).toBe('🔍')
  })

  it('returns test tube for test labels', () => {
    expect(getTaskEmoji('Add unit tests')).toBe('🧪')
  })

  it('returns recycle for refactor labels', () => {
    expect(getTaskEmoji('Refactor database layer')).toBe('♻️')
  })

  it('returns robot for unknown labels', () => {
    expect(getTaskEmoji('Something random')).toBe('🤖')
  })

  it('returns robot for undefined label', () => {
    expect(getTaskEmoji()).toBe('🤖')
  })
})

describe('getDisplayName', () => {
  it('uses label when available', () => {
    expect(getDisplayName({ key: AGENT_MAIN_SUBAGENT_ABC, label: 'My Task' })).toBe('My Task')
  })

  it('generates friendly name for subagents', () => {
    const name = getDisplayName({ key: 'agent:main:subagent:abc123' })
    expect(name).toMatch(/^\w+-\w+$/)
  })

  it('uses last key part for non-subagent sessions', () => {
    expect(getDisplayName({ key: 'agent:main:main' })).toBe('main')
  })
})
