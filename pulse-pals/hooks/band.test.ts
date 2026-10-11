import { test, expect } from 'claude-code/testing'
import { pickChipMode, renderBand } from './band'
import type { RasterBuilder, Tree } from './band'
import type { AgentRow } from './agents'
import type { TurnStatusState } from './turn-status'
import { STATUS_DOT_GLYPH } from './icons'

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

// Flattens every Text leaf's own string content (not its descendants') with
// its props, so a test can find "the rule" (a run of RULE_CHAR) separately
// from the label or the badge without depending on its position among a
// variable number of chips.
type TextLeaf = { text: string; props?: Record<string, unknown> }
function collectTexts(tree: unknown): TextLeaf[] {
  if (!tree || typeof tree !== 'object') return []
  const node = tree as TreeLike
  if (node.type === 'Text') {
    const text = (node.children ?? []).filter((c): c is string => typeof c === 'string').join('')
    return [{ text, props: node.props }]
  }
  return (node.children ?? []).flatMap(collectTexts)
}

const RULE_CHAR = '─'
function ruleSegments(tree: Tree): TextLeaf[] {
  return collectTexts(tree).filter(leaf => [...leaf.text].every(ch => ch === RULE_CHAR))
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

test('renderBand is a single row — avatars, the rule, and the status text all in one Box, not stacked rows', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, IDLE, 200, 0, stubRaster)
  expect(tree.type).toBe('Box')
  expect(tree.props?.flexDirection).toBe('row')
  expect(tree.props?.borderStyle).toBeUndefined()
})

test('renderBand renders the todo fraction from a real progress value, riding along on the rule', ($, on) => {
  const tree = renderBand([row()], { done: 2, total: 4 }, IDLE, 200, 0, stubRaster)
  expect(findText(tree, '2/4')).toBe(true)
})

test('renderBand reserves width for the aggregate light before sizing chips, not just the chips themselves', ($, on) => {
  // pickChipMode on its own has no idea the light exists (renderBand reserves
  // its width before ever calling it) — so this is a renderBand-level
  // behavior, not a pickChipMode one. Same single chip either way; only the
  // aggregate light differs (null vs yellow, +2 columns). At a width that
  // fits the plain row's chip *and* dot but not the extra 2 columns the
  // signal-bearing row's light costs, the signal-bearing row must drop its
  // dot (icons-only) to make room.
  const todo = { done: 0, total: 0 }
  const plain = renderBand([row({ id: 'main' })], todo, IDLE, 7, 0, stubRaster)
  const withSignal = renderBand([row({ id: 'main', lastCheckDecision: 'ask' })], todo, IDLE, 7, 0, stubRaster)
  expect(findText(plain, STATUS_DOT_GLYPH)).toBe(true)
  expect(findText(withSignal, STATUS_DOT_GLYPH)).toBe(false)
})

test('pickChipMode badge width reflects the real "+N done" string length, degrading further when N is large', ($, on) => {
  const rows = [
    row({ id: 'main' }),
    ...Array.from({ length: 15 }, (_, i) => row({ id: `a${i}`, status: 'completed' as const, subagentType: 'X' })),
  ]
  // '+15 done' is 8 columns. At width 14 even collapsed-finished's single
  // visible chip (main) plus the badge don't fit; at 15 they do.
  expect(pickChipMode(rows, 14)).toBe('icons-only')
  expect(pickChipMode(rows, 15)).toBe('collapsed-finished')
})

test('renderBand\'s rule shrinks (not the fraction) as the total width narrows, when idle with todos pending', ($, on) => {
  const wide = renderBand([row()], { done: 3, total: 10 }, IDLE, 50, 0, stubRaster)
  const narrow = renderBand([row()], { done: 3, total: 10 }, IDLE, 10, 0, stubRaster)

  const wideRuleLength = ruleSegments(wide).reduce((sum, leaf) => sum + leaf.text.length, 0)
  const narrowRuleLength = ruleSegments(narrow).reduce((sum, leaf) => sum + leaf.text.length, 0)

  expect(narrowRuleLength).toBeLessThan(wideRuleLength)
  // The number itself never shrinks or wraps — only the rule does.
  expect(findText(narrow, ' 3/10 ')).toBe(true)
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

test('renderBand reads "working…" while a turn is in flight', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, WORKING, 200, 0, stubRaster)
  expect(findText(tree, 'working')).toBe(true)
})

test('renderBand reads "waiting on you" while a tool call needs approval', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, WAITING, 200, 0, stubRaster)
  expect(findText(tree, 'waiting on you')).toBe(true)
})

test('renderBand reads "done" right after a turn completes', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, DONE, 200, 0, stubRaster)
  expect(findText(tree, 'done')).toBe(true)
})

test('renderBand\'s rule color follows turn status, since the real prompt box border is theme-owned, not plugin-settable', ($, on) => {
  const todo = { done: 0, total: 0 }
  const colorOf = (turn: TurnStatusState) => {
    const segments = ruleSegments(renderBand([row()], todo, turn, 200, 0, stubRaster))
    return segments[0]?.props?.color
  }

  expect(colorOf(IDLE)).toBe('gray')
  expect(colorOf(WORKING)).toBe('cyan')
  expect(colorOf(WAITING)).toBe('yellow')
  expect(colorOf(DONE)).toBe('green')
})
