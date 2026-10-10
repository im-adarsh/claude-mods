import { test, expect } from 'claude-code/testing'
import { applyEvent, emptyState } from './agents'
import type { AgentsState } from './agents'

test('emptyState has exactly one row: the main loop', ($, on) => {
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

test('applyEvent: spawn adds a new row after the main loop, in spawn order', ($, on) => {
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

test('applyEvent: spawn two agents spawned back-to-back are both tracked, not one overwriting the other', ($, on) => {
  let state = emptyState()
  state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'X', now: 1000 })
  state = applyEvent(state, { type: 'spawn', agentId: 'a2', subagentType: 'Y', now: 1001 })
  expect(state.rows).toHaveLength(3) // main + a1 + a2
})

test('applyEvent: toolCallStart / toolCallEnd marks the matching row working, and only that row', ($, on) => {
  let state = emptyState()
  state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'X', now: 1000 })
  state = applyEvent(state, { type: 'toolCallStart', agentId: 'a1', now: 1500 })

  expect(state.rows.find(r => r.id === 'a1')?.working).toBe(true)
  expect(state.rows.find(r => r.id === 'main')?.working).toBe(false)
})

test('applyEvent: toolCallStart / toolCallEnd null agentId marks the main loop working', ($, on) => {
  let state = emptyState()
  state = applyEvent(state, { type: 'toolCallStart', agentId: null, now: 1000 })
  expect(state.rows.find(r => r.id === 'main')?.working).toBe(true)
})

test('applyEvent: toolCallStart / toolCallEnd toolCallStart increments toolCallCount; toolCallEnd clears working but keeps the count', ($, on) => {
  let state = emptyState()
  state = applyEvent(state, { type: 'toolCallStart', agentId: null, now: 1000 })
  state = applyEvent(state, { type: 'toolCallEnd', agentId: null })

  const main = state.rows.find(r => r.id === 'main')
  expect(main?.working).toBe(false)
  expect(main?.toolCallCount).toBe(1)
})

test('applyEvent: checkDecision records the decision on the matching row', ($, on) => {
  let state = emptyState()
  state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'X', now: 1000 })
  state = applyEvent(state, { type: 'checkDecision', agentId: 'a1', decision: 'deny' })
  expect(state.rows.find(r => r.id === 'a1')?.lastCheckDecision).toBe('deny')
})

test('applyEvent: statusSync updates status for rows present in the sync, leaves others unchanged', ($, on) => {
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

test('applyEvent: statusSync an event for an unknown agentId is ignored, not thrown', ($, on) => {
  const state = emptyState()
  expect(() =>
    applyEvent(state, { type: 'toolCallStart', agentId: 'ghost', now: 1000 }),
  ).not.toThrow()
})
