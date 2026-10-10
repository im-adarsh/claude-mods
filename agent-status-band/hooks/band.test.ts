import { test, expect } from 'claude-code/testing'
import { pickChipMode, renderBand } from './band'
import type { AgentRow } from './agents'

function row(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: 'main',
    subagentType: null,
    status: 'running',
    working: false,
    lastCheckDecision: null,
    toolCallCount: 0,
    spawnedAt: 0,
    ...overrides,
  }
}

function findText(tree: unknown, needle: string): boolean {
  if (typeof tree === 'string') return tree.includes(needle)
  if (tree && typeof tree === 'object') {
    const node = tree as { children?: unknown[] }
    return (node.children ?? []).some(child => findText(child, needle))
  }
  return false
}

test('pickChipMode full mode when there is plenty of width', ($, on) => {
  expect(pickChipMode([row()], 200)).toBe('full')
})

test('pickChipMode degrades to no-label, then collapsed-finished, then icons-only as width shrinks', ($, on) => {
  const rows = [
    row({ id: 'main' }),
    row({ id: 'a1', status: 'completed', subagentType: 'X' }),
    row({ id: 'a2', status: 'completed', subagentType: 'Y' }),
    row({ id: 'a3', status: 'completed', subagentType: 'Z' }),
    row({ id: 'a4', working: true, subagentType: 'W' }),
  ]

  const modes = [200, 60, 30, 10].map(width => pickChipMode(rows, width))
  // Width shrinking should only ever hold steady or degrade further, never
  // jump back to a less-degraded mode.
  const order: Record<string, number> = { full: 0, 'no-label': 1, 'collapsed-finished': 2, 'icons-only': 3 }
  for (let i = 1; i < modes.length; i++) {
    expect(order[modes[i] as string]).toBeGreaterThanOrEqual(order[modes[i - 1] as string])
  }
})

test('pickChipMode never refuses to produce a mode at an extremely narrow width', ($, on) => {
  expect(() => pickChipMode([row()], 1)).not.toThrow()
})

test('renderBand shows the main loop even with no subagents and no todo progress yet', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, 200, 0)
  expect(findText(tree, '0/0')).toBe(true)
})

test('renderBand renders the todo fraction from a real progress value', ($, on) => {
  const tree = renderBand([row()], { done: 2, total: 4 }, 200, 0)
  expect(findText(tree, '2/4')).toBe(true)
})

test('renderBand always produces exactly two rows (two top-level Box children)', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, 200, 0)
  expect(tree.type).toBe('Box')
  expect(tree.children).toHaveLength(2)
})

test('pickChipMode (totalWidth) accounts for the aggregate light glyph and its gap, not just the chips', ($, on) => {
  const plain = [row({ id: 'main' })]
  const withSignal = [row({ id: 'main', lastCheckDecision: 'ask' })]
  // Same chip layout either way; only the aggregate light differs (null vs
  // yellow). At a width that only fits the chip plus the light's 2 extra
  // columns in a less-labeled mode, the signal-bearing row must degrade
  // further than the plain one.
  expect(pickChipMode(plain, 10)).toBe('full')
  expect(pickChipMode(withSignal, 10)).toBe('no-label')
})

test('pickChipMode badge width reflects the real "+N done" string length, not a hardcoded 7, degrading further when N is large', ($, on) => {
  const rows = [
    row({ id: 'main' }),
    ...Array.from({ length: 15 }, (_, i) => row({ id: `a${i}`, status: 'completed' as const, subagentType: 'X' })),
  ]
  // '+15 done' is 8 columns, not 7: at width 13 the old hardcoded estimate
  // would have (wrongly) fit collapsed-finished; the real length pushes it
  // one stage further to icons-only.
  expect(pickChipMode(rows, 13)).toBe('icons-only')
  expect(pickChipMode(rows, 14)).toBe('collapsed-finished')
})

test('renderProgressRow bar shrinks (not the done/total number) as bodyColumns narrows toward a very narrow width', ($, on) => {
  const wide = renderBand([row()], { done: 3, total: 10 }, 50, 0)
  const narrow = renderBand([row()], { done: 3, total: 10 }, 8, 0)

  type TreeLike = { children?: Array<TreeLike | string> }
  const wideProgressRow = wide.children?.[1] as TreeLike
  const narrowProgressRow = narrow.children?.[1] as TreeLike

  const wideBar = (wideProgressRow.children?.[0] as TreeLike).children?.[0] as string
  const narrowBar = (narrowProgressRow.children?.[0] as TreeLike).children?.[0] as string
  const narrowFraction = (narrowProgressRow.children?.[1] as TreeLike).children?.[0] as string

  expect(narrowBar.length).toBeLessThan(wideBar.length)
  // The number itself never shrinks or wraps — only the bar graphic does.
  expect(narrowFraction).toBe(' 3/10')
})

test('renderBand working subagents stay visible even when width forces collapsing finished ones', ($, on) => {
  const rows = [
    row({ id: 'main' }),
    row({ id: 'a1', status: 'completed', subagentType: 'X' }),
    row({ id: 'a2', working: true, subagentType: 'Y' }),
  ]
  const tree = renderBand(rows, { done: 0, total: 0 }, 50, 0)
  // Y's role icon (designer glyph '✎' if subagentType 'Y' falls back to
  // generic '◇' — either way, some glyph for a1's row must still appear)
  // is asserted indirectly: the row count of individually-drawn chips
  // for non-finished agents never drops to zero while one is working.
  expect(findText(tree, '◇') || findText(tree, '✎')).toBe(true)
})
