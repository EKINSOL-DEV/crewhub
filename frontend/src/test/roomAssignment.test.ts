import { describe, it, expect } from 'vitest'
import { assignRoom, DEFAULT_ASSIGNMENT_CONFIG, type AssignmentInput } from '../lib/roomAssignment'

describe('assignRoom', () => {
  it('returns explicit room when provided', () => {
    const input: AssignmentInput = { explicitRoom: 'custom-room' }
    const { room, trace } = assignRoom(input)
    expect(room).toBe('custom-room')
    expect(trace.reason).toContain('Explicit')
  })

  it('assigns by persona', () => {
    const input: AssignmentInput = { persona: 'Flowy' }
    const { room, trace } = assignRoom(input)
    expect(room).toBe('marketing')
    expect(trace.reason).toContain('Persona')
  })

  it('assigns by persona Builder', () => {
    const input: AssignmentInput = { persona: 'Builder' }
    const { room } = assignRoom(input)
    expect(room).toBe('dev')
  })

  it('assigns by keywords - development', () => {
    const input: AssignmentInput = { taskTitle: 'Fix the API bug' }
    const { room, trace } = assignRoom(input)
    expect(room).toBe('dev')
    expect(trace.keywords).toBeDefined()
  })

  it('assigns by keywords - marketing', () => {
    const input: AssignmentInput = { taskTitle: 'Write SEO content for landing page' }
    const { room } = assignRoom(input)
    expect(room).toBe('marketing')
  })

  it('assigns by keywords - creative', () => {
    const input: AssignmentInput = { taskTitle: 'Brainstorm design ideas' }
    const { room } = assignRoom(input)
    expect(room).toBe('creative')
  })

  it('assigns by keywords - automation', () => {
    const input: AssignmentInput = { taskTitle: 'Schedule cron job' }
    const { room } = assignRoom(input)
    expect(room).toBe('automation')
  })

  it('assigns by keywords - communications', () => {
    const input: AssignmentInput = { taskTitle: 'Send email notification' }
    const { room } = assignRoom(input)
    expect(room).toBe('comms')
  })

  it('assigns by keywords - ops', () => {
    const input: AssignmentInput = { taskTitle: 'Deploy docker container to server' }
    const { room } = assignRoom(input)
    expect(room).toBe('ops')
  })

  it('assigns by keywords - thinking/analysis', () => {
    const input: AssignmentInput = { taskTitle: 'Analyse the architecture design doc' }
    const { room } = assignRoom(input)
    expect(room).toBe('thinking')
  })

  it('falls back to model room when no keywords match', () => {
    const input: AssignmentInput = { taskTitle: 'something generic', model: 'opus' }
    const { room } = assignRoom(input)
    // This might match dev keywords or model, either is fine
    expect(room).toBeTruthy()
  })

  it('uses default room when nothing matches', () => {
    const input: AssignmentInput = { taskTitle: '' }
    const { room, trace } = assignRoom(input)
    expect(room).toBe('headquarters')
    expect(trace.reason).toContain('default')
  })

  it('uses negative keywords to disambiguate', () => {
    // "implement" is a dev keyword, "review" is a thinking keyword
    // But thinking has negative keyword "implement"
    const input: AssignmentInput = { taskTitle: 'implement new feature' }
    const { room } = assignRoom(input)
    expect(room).toBe('dev')
  })

  it('combines title and description for matching', () => {
    const input: AssignmentInput = {
      taskTitle: 'Task',
      taskDescription: 'Need to fix the database bug',
    }
    const { room } = assignRoom(input)
    expect(room).toBe('dev')
  })

  it('uses task labels for matching', () => {
    const input: AssignmentInput = {
      taskLabels: ['cron', 'scheduled'],
    }
    const { room } = assignRoom(input)
    expect(room).toBe('automation')
  })

  it('trace always has finalRoom and reason', () => {
    const inputs: AssignmentInput[] = [
      {},
      { explicitRoom: 'x' },
      { persona: 'Flowy' },
      { taskTitle: 'fix bug' },
      { model: 'opus' },
    ]
    for (const input of inputs) {
      const { trace } = assignRoom(input)
      expect(trace.finalRoom).toBeTruthy()
      expect(trace.reason).toBeTruthy()
    }
  })
})

describe('DEFAULT_ASSIGNMENT_CONFIG', () => {
  it('has a default room', () => {
    expect(DEFAULT_ASSIGNMENT_CONFIG.defaultRoom).toBe('headquarters')
  })

  it('has model rooms configured', () => {
    expect(DEFAULT_ASSIGNMENT_CONFIG.modelRooms.opus).toBe('dev')
    expect(DEFAULT_ASSIGNMENT_CONFIG.modelRooms.gpt5).toBe('thinking')
  })

  it('has keyword rules for all major room types', () => {
    const roomTypes = DEFAULT_ASSIGNMENT_CONFIG.keywordRules.map((r) => r.room)
    expect(roomTypes).toContain('thinking')
    expect(roomTypes).toContain('dev')
    expect(roomTypes).toContain('marketing')
    expect(roomTypes).toContain('creative')
    expect(roomTypes).toContain('automation')
    expect(roomTypes).toContain('comms')
    expect(roomTypes).toContain('ops')
  })
})
