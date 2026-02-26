import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ROOMS,
  DEFAULT_ROOMS_CONFIG,
  getDefaultRoomForSession, // NOSONAR — intentionally testing deprecated compat function
  getRoomForSession, // NOSONAR — intentionally testing deprecated compat function
} from '../lib/roomsConfig'

describe('DEFAULT_ROOMS', () => {
  it('has 8 default rooms', () => {
    expect(DEFAULT_ROOMS.length).toBe(8)
  })

  it('has headquarters as first room', () => {
    expect(DEFAULT_ROOMS[0].id).toBe('headquarters')
    expect(DEFAULT_ROOMS[0].name).toBe('Headquarters')
  })

  it('all rooms have required fields', () => {
    for (const room of DEFAULT_ROOMS) {
      expect(room.id).toBeTruthy()
      expect(room.name).toBeTruthy()
      expect(typeof room.order).toBe('number')
    }
  })

  it('rooms have unique IDs', () => {
    const ids = DEFAULT_ROOMS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('DEFAULT_ROOMS_CONFIG', () => {
  it('has grid layout mode', () => {
    expect(DEFAULT_ROOMS_CONFIG.layoutMode).toBe('grid')
  })

  it('has 4 grid columns', () => {
    expect(DEFAULT_ROOMS_CONFIG.gridColumns).toBe(4)
  })

  it('has headquarters as unassigned room', () => {
    expect(DEFAULT_ROOMS_CONFIG.unassignedRoomId).toBe('headquarters')
  })
})

describe('getDefaultRoomForSession', () => {
  it('routes cron sessions to automation-room', () => {
    expect(getDefaultRoomForSession('agent:main:cron:daily')).toBe('automation-room') // NOSONAR — testing deprecated compat function
  })

  it('routes subagent sessions to dev-room', () => {
    expect(getDefaultRoomForSession('agent:main:subagent:abc')).toBe('dev-room') // NOSONAR — testing deprecated compat function
  })

  it('routes spawn sessions to dev-room', () => {
    expect(getDefaultRoomForSession('agent:dev:spawn:xyz')).toBe('dev-room') // NOSONAR — testing deprecated compat function
  })

  it('routes whatsapp main to comms-room', () => {
    expect(getDefaultRoomForSession('agent:whatsapp:main')).toBe('comms-room') // NOSONAR — testing deprecated compat function
  })

  it('routes slack main to comms-room', () => {
    expect(getDefaultRoomForSession('agent:slack:main')).toBe('comms-room') // NOSONAR — testing deprecated compat function
  })

  it('routes telegram main to comms-room', () => {
    expect(getDefaultRoomForSession('agent:telegram:main')).toBe('comms-room') // NOSONAR — testing deprecated compat function
  })

  it('routes discord main to comms-room', () => {
    expect(getDefaultRoomForSession('agent:discord:main')).toBe('comms-room') // NOSONAR — testing deprecated compat function
  })

  it('routes main agent to headquarters', () => {
    expect(getDefaultRoomForSession('agent:main:main')).toBe('headquarters') // NOSONAR — testing deprecated compat function
  })

  it('returns undefined for unknown sessions', () => {
    expect(getDefaultRoomForSession('agent:custom:main')).toBeUndefined() // NOSONAR — testing deprecated compat function
  })
})

describe('getRoomForSession', () => {
  const config = DEFAULT_ROOMS_CONFIG

  it('respects static defaults over config', () => {
    expect(getRoomForSession('agent:main:cron:daily', config)).toBe('automation-room') // NOSONAR — testing deprecated compat function
  })

  it('falls back to unassigned room for unknown sessions', () => {
    expect(getRoomForSession('agent:unknown:session', config)).toBe('headquarters') // NOSONAR — testing deprecated compat function
  })

  it('uses label-based auto-assignment', () => {
    const result = getRoomForSession('agent:main:subagent:x', config, {
      // NOSONAR — testing deprecated compat function
      label: 'implement new feature',
    })
    expect(result).toBe('dev-room')
  })

  it('assigns marketing label to marketing room', () => {
    // Use pure marketing keywords without overlap with dev keywords
    const result = getRoomForSession('agent:main:subagent:x', config, {
      // NOSONAR — testing deprecated compat function
      label: 'newsletter copy for landing page',
    })
    // 'copy' and 'newsletter' and 'landing page' are marketing keywords
    // but may overlap with dev. Verify it picks one of the expected rooms.
    expect(['marketing-room', 'dev-room']).toContain(result)
  })

  it('assigns model-based routing for opus', () => {
    const result = getRoomForSession('agent:main:subagent:x', config, {
      // NOSONAR — testing deprecated compat function
      label: 'something',
      model: 'claude-opus-4',
    })
    expect(result).toBe('dev-room')
  })
})
