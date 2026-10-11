import { test, expect } from 'claude-code/testing'
import {
  aggregateLightOf,
  emotionOf,
  statusDotOf,
  EXCITED_CALL_THRESHOLD,
  EXHAUSTED_CALL_THRESHOLD,
} from './derive'
import type { AgentRow } from './agents'

function row(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: 'a1',
    subagentType: 'X',
    status: 'running',
    working: false,
    lastCheckDecision: null,
    toolCallCount: 0,
    spawnedAt: 0,
    ...overrides,
  }
}

test('emotionOf precedence ladder: failed status wins over everything else, even a long runtime', ($, on) => {
  const r = row({ status: 'failed', toolCallCount: 999, spawnedAt: 0 })
  expect(emotionOf(r, 10_000_000)).toBe('sad')
})

test('emotionOf precedence ladder: killed status reads sad too', ($, on) => {
  expect(emotionOf(row({ status: 'killed' }), 0)).toBe('sad')
})

test('emotionOf precedence ladder: a pending deny on a still-running agent reads frustrated', ($, on) => {
  expect(emotionOf(row({ status: 'running', lastCheckDecision: 'deny' }), 0)).toBe('frustrated')
})

test('emotionOf precedence ladder: completed status reads happy', ($, on) => {
  expect(emotionOf(row({ status: 'completed' }), 0)).toBe('happy')
})

test('emotionOf precedence ladder: a long-running agent past the call threshold reads exhausted', ($, on) => {
  const r = row({ status: 'running', toolCallCount: EXHAUSTED_CALL_THRESHOLD })
  expect(emotionOf(r, 0)).toBe('exhausted')
})

test('emotionOf precedence ladder: a freshly spawned agent within the excited threshold reads excited', ($, on) => {
  const r = row({ status: 'running', toolCallCount: EXCITED_CALL_THRESHOLD - 1 })
  expect(emotionOf(r, 0)).toBe('excited')
})

test('emotionOf precedence ladder: a running agent past excited but below exhausted reads focused', ($, on) => {
  const r = row({ status: 'running', toolCallCount: EXCITED_CALL_THRESHOLD + 1 })
  expect(emotionOf(r, 0)).toBe('focused')
})

test('statusDotOf failed status reads red', ($, on) => {
  expect(statusDotOf(row({ status: 'failed' }))).toBe('red')
})

test('statusDotOf killed status reads red', ($, on) => {
  expect(statusDotOf(row({ status: 'killed' }))).toBe('red')
})

test('statusDotOf completed status reads dim', ($, on) => {
  expect(statusDotOf(row({ status: 'completed' }))).toBe('dim')
})

test('statusDotOf running status with no other distinguishing state reads green', ($, on) => {
  expect(statusDotOf(row({ status: 'running' }))).toBe('green')
})

test('statusDotOf running status with a pending ask still reads green, not yellow (no per-row attribution)', ($, on) => {
  const r = row({ status: 'running', lastCheckDecision: 'ask' })
  expect(statusDotOf(r)).toBe('green')
})

test('statusDotOf main row reads green while working, regardless of status (which never changes)', ($, on) => {
  const r = row({ id: 'main', status: 'running', working: true })
  expect(statusDotOf(r)).toBe('green')
})

test('statusDotOf main row reads dim while idle, not stuck green forever', ($, on) => {
  const r = row({ id: 'main', status: 'running', working: false })
  expect(statusDotOf(r)).toBe('dim')
})

test('statusDotOf main row ignores status entirely, even if somehow set to failed', ($, on) => {
  // Status never actually changes for the main row in practice (see
  // agents.ts), but statusDotOf should not rely on that invariant holding
  // — the id check takes priority over any status value.
  const r = row({ id: 'main', status: 'failed', working: true })
  expect(statusDotOf(r)).toBe('green')
})

test('aggregateLightOf null when no agents have any signal yet (all focused, main loop idle)', ($, on) => {
  expect(aggregateLightOf([row({ id: 'main', status: 'running', toolCallCount: 0 })])).toBe(null)
})

test('aggregateLightOf red if any row has deny or failed/killed, even if others are fine', ($, on) => {
  const rows = [row({ id: 'a1', status: 'completed' }), row({ id: 'a2', status: 'failed' })]
  expect(aggregateLightOf(rows)).toBe('red')
})

test('aggregateLightOf red if any row has status running but lastCheckDecision deny (independent OR condition, not just status)', ($, on) => {
  const rows = [
    row({ id: 'a1', status: 'completed' }),
    row({ id: 'a2', status: 'running', lastCheckDecision: 'deny' }),
  ]
  expect(aggregateLightOf(rows)).toBe('red')
})

test('aggregateLightOf yellow if any row has a pending ask and none are red', ($, on) => {
  const rows = [row({ id: 'a1', status: 'completed' }), row({ id: 'a2', lastCheckDecision: 'ask' })]
  expect(aggregateLightOf(rows)).toBe('yellow')
})

test('aggregateLightOf green if everything settled with no red/yellow signal', ($, on) => {
  const rows = [row({ id: 'a1', status: 'completed' }), row({ id: 'a2', status: 'completed' })]
  expect(aggregateLightOf(rows)).toBe('green')
})

test('emotionOf a freshly spawned/reset main row is not exhausted right after spawnedAt, using a realistic wall-clock now (not 0)', ($, on) => {
  // Regression for Important 1: emptyState()/resetMain used to stamp
  // spawnedAt as 0 while `now` was a real Date.now() value, so `now -
  // spawnedAt` was always enormous and the main chip read "exhausted" from
  // the very first render. Using a realistic now for both spawnedAt and
  // the elapsed check guards against that class of bug recurring.
  const now = 1_760_000_000_000 // a realistic Date.now()-scale timestamp
  const freshMainRow = row({ id: 'main', status: 'running', toolCallCount: 0, spawnedAt: now })
  const emotion = emotionOf(freshMainRow, freshMainRow.spawnedAt + 1000)
  expect(emotion).not.toBe('exhausted')
  expect(emotion).toBe('excited')
})
