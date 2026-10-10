import { describe, expect, test } from 'bun:test'
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

describe('emotionOf precedence ladder', () => {
  test('failed status wins over everything else, even a long runtime', () => {
    const r = row({ status: 'failed', toolCallCount: 999, spawnedAt: 0 })
    expect(emotionOf(r, 10_000_000)).toBe('sad')
  })

  test('killed status reads sad too', () => {
    expect(emotionOf(row({ status: 'killed' }), 0)).toBe('sad')
  })

  test('a pending deny on a still-running agent reads frustrated', () => {
    expect(emotionOf(row({ status: 'running', lastCheckDecision: 'deny' }), 0)).toBe('frustrated')
  })

  test('completed status reads happy', () => {
    expect(emotionOf(row({ status: 'completed' }), 0)).toBe('happy')
  })

  test('a long-running agent past the call threshold reads exhausted', () => {
    const r = row({ status: 'running', toolCallCount: EXHAUSTED_CALL_THRESHOLD })
    expect(emotionOf(r, 0)).toBe('exhausted')
  })

  test('a freshly spawned agent within the excited threshold reads excited', () => {
    const r = row({ status: 'running', toolCallCount: EXCITED_CALL_THRESHOLD - 1 })
    expect(emotionOf(r, 0)).toBe('excited')
  })

  test('a running agent past excited but below exhausted reads focused', () => {
    const r = row({ status: 'running', toolCallCount: EXCITED_CALL_THRESHOLD + 1 })
    expect(emotionOf(r, 0)).toBe('focused')
  })
})

describe('statusDotOf', () => {
  test('failed status reads red', () => {
    expect(statusDotOf(row({ status: 'failed' }))).toBe('red')
  })

  test('killed status reads red', () => {
    expect(statusDotOf(row({ status: 'killed' }))).toBe('red')
  })

  test('completed status reads dim', () => {
    expect(statusDotOf(row({ status: 'completed' }))).toBe('dim')
  })

  test('running status with no other distinguishing state reads green', () => {
    expect(statusDotOf(row({ status: 'running' }))).toBe('green')
  })

  test('running status with a pending ask still reads green, not yellow (no per-row attribution)', () => {
    const r = row({ status: 'running', lastCheckDecision: 'ask' })
    expect(statusDotOf(r)).toBe('green')
  })
})

describe('aggregateLightOf', () => {
  test('null when no agents have any signal yet (all focused, main loop idle)', () => {
    expect(aggregateLightOf([row({ id: 'main', status: 'running', toolCallCount: 0 })])).toBe(null)
  })

  test('red if any row has deny or failed/killed, even if others are fine', () => {
    const rows = [row({ id: 'a1', status: 'completed' }), row({ id: 'a2', status: 'failed' })]
    expect(aggregateLightOf(rows)).toBe('red')
  })

  test('red if any row has status running but lastCheckDecision deny (independent OR condition, not just status)', () => {
    const rows = [
      row({ id: 'a1', status: 'completed' }),
      row({ id: 'a2', status: 'running', lastCheckDecision: 'deny' }),
    ]
    expect(aggregateLightOf(rows)).toBe('red')
  })

  test('yellow if any row has a pending ask and none are red', () => {
    const rows = [row({ id: 'a1', status: 'completed' }), row({ id: 'a2', lastCheckDecision: 'ask' })]
    expect(aggregateLightOf(rows)).toBe('yellow')
  })

  test('green if everything settled with no red/yellow signal', () => {
    const rows = [row({ id: 'a1', status: 'completed' }), row({ id: 'a2', status: 'completed' })]
    expect(aggregateLightOf(rows)).toBe('green')
  })
})
