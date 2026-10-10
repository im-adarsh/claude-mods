import { describe, expect, test } from 'bun:test'
import { applyEvent, emptyState } from './agents'
import type { AgentsState } from './agents'

describe('emptyState', () => {
  test('has exactly one row: the main loop', () => {
    const state = emptyState()
    expect(state.rows).toHaveLength(1)
    expect(state.rows[0]).toMatchObject({
      id: 'main',
      subagentType: null,
      status: 'running',
      working: false,
      toolCallCount: 0,
    })
  })
})

describe('applyEvent: spawn', () => {
  test('adds a new row after the main loop, in spawn order', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'brocode:swe-backend', now: 1000 })
    state = applyEvent(state, { type: 'spawn', agentId: 'a2', subagentType: 'frontend-design', now: 2000 })

    expect(state.rows.map(r => r.id)).toEqual(['main', 'a1', 'a2'])
    expect(state.rows[1]).toMatchObject({
      subagentType: 'brocode:swe-backend',
      status: 'running',
      spawnedAt: 1000,
    })
  })

  test('two agents spawned back-to-back are both tracked, not one overwriting the other', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'X', now: 1000 })
    state = applyEvent(state, { type: 'spawn', agentId: 'a2', subagentType: 'Y', now: 1001 })
    expect(state.rows).toHaveLength(3) // main + a1 + a2
  })
})

describe('applyEvent: toolCallStart / toolCallEnd', () => {
  test('marks the matching row working, and only that row', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'X', now: 1000 })
    state = applyEvent(state, { type: 'toolCallStart', agentId: 'a1', now: 1500 })

    expect(state.rows.find(r => r.id === 'a1')?.working).toBe(true)
    expect(state.rows.find(r => r.id === 'main')?.working).toBe(false)
  })

  test('null agentId marks the main loop working', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'toolCallStart', agentId: null, now: 1000 })
    expect(state.rows.find(r => r.id === 'main')?.working).toBe(true)
  })

  test('toolCallStart increments toolCallCount; toolCallEnd clears working but keeps the count', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'toolCallStart', agentId: null, now: 1000 })
    state = applyEvent(state, { type: 'toolCallEnd', agentId: null })

    const main = state.rows.find(r => r.id === 'main')
    expect(main?.working).toBe(false)
    expect(main?.toolCallCount).toBe(1)
  })
})

describe('applyEvent: checkDecision', () => {
  test('records the decision on the matching row', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'X', now: 1000 })
    state = applyEvent(state, { type: 'checkDecision', agentId: 'a1', decision: 'deny' })
    expect(state.rows.find(r => r.id === 'a1')?.lastCheckDecision).toBe('deny')
  })
})

describe('applyEvent: statusSync', () => {
  test('updates status for rows present in the sync, leaves others unchanged', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'X', now: 1000 })
    state = applyEvent(state, { type: 'spawn', agentId: 'a2', subagentType: 'Y', now: 2000 })
    state = applyEvent(state, {
      type: 'statusSync',
      statuses: [{ id: 'a1', status: 'completed' }],
    })

    expect(state.rows.find(r => r.id === 'a1')?.status).toBe('completed')
    expect(state.rows.find(r => r.id === 'a2')?.status).toBe('running')
  })

  test('an event for an unknown agentId is ignored, not thrown', () => {
    const state = emptyState()
    expect(() =>
      applyEvent(state, { type: 'toolCallStart', agentId: 'ghost', now: 1000 }),
    ).not.toThrow()
  })
})
