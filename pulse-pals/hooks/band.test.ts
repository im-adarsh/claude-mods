import { test, expect } from 'claude-code/testing'
import { pickChipMode, renderBand } from './band'
import type { RasterBuilder, Tree } from './band'
import type { AgentRow } from './agents'
import type { TurnStatusState } from './turn-status'

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

const IDLE: TurnStatusState = { status: 'idle', since: 0 }
const WORKING: TurnStatusState = { status: 'working', since: 0 }
const WAITING: TurnStatusState = { status: 'waiting', since: 0 }
const DONE: TurnStatusState = { status: 'done', since: 0 }

// band.tsx never builds a Raster leaf itself (it has no `$` to resolve the
// real element constructor from) — tests inject this stub the same way
// register.tsx injects the real $.ui.resolve(e).Raster.
const stubRaster: RasterBuilder = props => ({ type: 'Raster', props })

type TreeLike = { type?: string; props?: Record<string, unknown>; children?: Array<TreeLike | string> }

function findText(tree: unknown, needle: string): boolean {
  if (typeof tree === 'string') return tree.includes(needle)
  if (tree && typeof tree === 'object') {
    const node = tree as TreeLike
    return (node.children ?? []).some(child => findText(child, needle))
  }
  return false
}

function findRasterKeys(tree: unknown): string[] {
  if (!tree || typeof tree !== 'object') return []
  const node = tree as TreeLike
  const own = node.type === 'Raster' && typeof node.props?.key === 'string' ? [node.props.key as string] : []
  const nested = (node.children ?? []).flatMap(findRasterKeys)
  return [...own, ...nested]
}

test('pickChipMode normal mode when there is plenty of width', ($, on) => {
  expect(pickChipMode([row()], 200)).toBe('normal')
})

test('pickChipMode degrades to collapsed-finished, then icons-only as width shrinks, never back up', ($, on) => {
  const rows = [
    row({ id: 'main' }),
    row({ id: 'a1', status: 'completed', subagentType: 'X' }),
    row({ id: 'a2', status: 'completed', subagentType: 'Y' }),
    row({ id: 'a3', status: 'completed', subagentType: 'Z' }),
    row({ id: 'a4', working: true, subagentType: 'W' }),
  ]

  const modes = [200, 30, 20, 10].map(width => pickChipMode(rows, width))
  const order: Record<string, number> = { normal: 0, 'collapsed-finished': 1, 'icons-only': 2 }
  for (let i = 1; i < modes.length; i++) {
    expect(order[modes[i] as string]).toBeGreaterThanOrEqual(order[modes[i - 1] as string])
  }
})

test('pickChipMode never refuses to produce a mode at an extremely narrow width', ($, on) => {
  expect(() => pickChipMode([row()], 1)).not.toThrow()
})

test('renderBand shows the main loop\'s avatar even with no subagents and no todo progress yet, and no longer renders a bare "0/0"', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, IDLE, 200, 0, stubRaster)
  expect(findRasterKeys(tree)).toContain('avatar-main')
  expect(findText(tree, '0/0')).toBe(false)
})

test('renderBand draws no label text next to the avatar — role and emotion are carried by the avatar itself', ($, on) => {
  const rows = [row({ id: 'main' }), row({ id: 'a1', subagentType: 'brocode:swe-backend' })]
  const tree = renderBand(rows, { done: 0, total: 0 }, IDLE, 200, 0, stubRaster)
  expect(findText(tree, 'main')).toBe(false)
  expect(findText(tree, 'developer')).toBe(false)
})

test('renderBand renders the todo fraction from a real progress value, riding along on the rule row', ($, on) => {
  const tree = renderBand([row()], { done: 2, total: 4 }, IDLE, 200, 0, stubRaster)
  expect(findText(tree, '2/4')).toBe(true)
})

test('renderBand always produces exactly two rows (chip row, rule row) as its top-level Box children', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, IDLE, 200, 0, stubRaster)
  expect(tree.type).toBe('Box')
  expect(tree.children).toHaveLength(2)
})

test('renderBand draws no enclosing border box around the band — the colored rule row is the only "border"', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, WORKING, 200, 0, stubRaster)
  expect(tree.props?.borderStyle).toBeUndefined()
})

test('pickChipMode (totalWidth) accounts for the aggregate light glyph and its gap, not just the chips', ($, on) => {
  const plain = [row({ id: 'main' })]
  const withSignal = [row({ id: 'main', lastCheckDecision: 'ask' })]
  // Same chip layout either way; only the aggregate light differs (null vs
  // yellow, +2 columns). At a width that fits the plain row's chip but not
  // the extra 2 columns the signal-bearing row's light costs, the
  // signal-bearing row must degrade.
  expect(pickChipMode(plain, 8)).toBe('normal')
  expect(pickChipMode(withSignal, 8)).toBe('icons-only')
})

test('pickChipMode badge width reflects the real "+N done" string length, degrading further when N is large', ($, on) => {
  const rows = [
    row({ id: 'main' }),
    ...Array.from({ length: 15 }, (_, i) => row({ id: `a${i}`, status: 'completed' as const, subagentType: 'X' })),
  ]
  // '+15 done' is 8 columns. At width 16 even collapsed-finished's single
  // visible chip (main) plus the badge and light don't fit; at 17 they do.
  expect(pickChipMode(rows, 16)).toBe('icons-only')
  expect(pickChipMode(rows, 17)).toBe('collapsed-finished')
})

test('renderRuleRow bar shrinks (not the fraction) as bodyColumns narrows, when idle with todos pending', ($, on) => {
  const wide = renderBand([row()], { done: 3, total: 10 }, IDLE, 50, 0, stubRaster)
  const narrow = renderBand([row()], { done: 3, total: 10 }, IDLE, 10, 0, stubRaster)

  const wideRuleRow = wide.children?.[1] as TreeLike
  const narrowRuleRow = narrow.children?.[1] as TreeLike

  const wideRule = (wideRuleRow.children?.[0] as TreeLike).children?.[0] as string
  const narrowRule = (narrowRuleRow.children?.[0] as TreeLike).children?.[0] as string
  const narrowFraction = (narrowRuleRow.children?.[1] as TreeLike).children?.[0] as string

  expect(narrowRule.length).toBeLessThan(wideRule.length)
  // The number itself never shrinks or wraps — only the rule graphic does.
  expect(narrowFraction).toBe(' 3/10 ')
})

test('renderBand working subagents stay visible (their avatar still drawn) even when width forces collapsing finished ones', ($, on) => {
  const rows = [
    row({ id: 'main' }),
    row({ id: 'a1', status: 'completed', subagentType: 'X' }),
    row({ id: 'a2', status: 'completed', subagentType: 'Z' }),
    row({ id: 'a3', working: true, subagentType: 'Y' }),
  ]
  // At width 25 these 4 rows land in 'collapsed-finished': a1/a2 (finished)
  // collapse into "+2 done", a3 (still working) must stay visible.
  const tree = renderBand(rows, { done: 0, total: 0 }, IDLE, 25, 0, stubRaster)
  const keys = findRasterKeys(tree)
  expect(keys).toContain('avatar-main')
  expect(keys).toContain('avatar-a3')
  expect(keys).not.toContain('avatar-a1')
  expect(keys).not.toContain('avatar-a2')
  expect(findText(tree, '+2 done')).toBe(true)
})

test('renderBand draws one Raster avatar per visible agent, each keyed by its agent id', ($, on) => {
  const rows = [row({ id: 'main' }), row({ id: 'a1', subagentType: 'brocode:swe-backend' })]
  const tree = renderBand(rows, { done: 0, total: 0 }, IDLE, 200, 0, stubRaster)
  expect(findRasterKeys(tree)).toEqual(['avatar-main', 'avatar-a1'])
})

test('renderBand rule row reads "working…" while a turn is in flight', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, WORKING, 200, 0, stubRaster)
  expect(findText(tree, 'working')).toBe(true)
})

test('renderBand rule row reads "waiting on you" while a tool call needs approval', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, WAITING, 200, 0, stubRaster)
  expect(findText(tree, 'waiting on you')).toBe(true)
})

test('renderBand rule row reads "done" right after a turn completes', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, DONE, 200, 0, stubRaster)
  expect(findText(tree, 'done')).toBe(true)
})

test('renderBand rule row color follows turn status, since the real prompt box border is theme-owned, not plugin-settable', ($, on) => {
  const todo = { done: 0, total: 0 }
  const idle = renderBand([row()], todo, IDLE, 200, 0, stubRaster)
  const working = renderBand([row()], todo, WORKING, 200, 0, stubRaster)
  const waiting = renderBand([row()], todo, WAITING, 200, 0, stubRaster)
  const done = renderBand([row()], todo, DONE, 200, 0, stubRaster)

  // The rule is a single colored Text for idle/waiting/done, but a Box of
  // three colored segments while working (the sweep) — walk down to
  // whichever one actually carries the `color` prop.
  function firstColor(tree: unknown): unknown {
    if (!tree || typeof tree !== 'object') return undefined
    const node = tree as TreeLike
    if (node.props?.color !== undefined) return node.props.color
    for (const child of node.children ?? []) {
      const found = firstColor(child)
      if (found !== undefined) return found
    }
    return undefined
  }
  const ruleColorOf = (tree: Tree): unknown => firstColor((tree as { children?: Tree[] }).children?.[1])

  expect(ruleColorOf(idle)).toBe('gray')
  expect(ruleColorOf(working)).toBe('cyan')
  expect(ruleColorOf(waiting)).toBe('yellow')
  expect(ruleColorOf(done)).toBe('green')
})
