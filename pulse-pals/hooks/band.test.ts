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

test('renderBand shows the main loop\'s avatar even with no subagents and no todo progress yet, and no longer renders a bare "0/0"', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, IDLE, 200, 0, stubRaster)
  expect(findRasterKeys(tree)).toContain('avatar-main')
  expect(findText(tree, '0/0')).toBe(false)
})

test('renderBand renders the todo fraction from a real progress value, riding along on the pulse row', ($, on) => {
  const tree = renderBand([row()], { done: 2, total: 4 }, IDLE, 200, 0, stubRaster)
  expect(findText(tree, '2/4')).toBe(true)
})

test('renderBand always produces exactly two rows (chip row, pulse row) as its top-level Box children', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, IDLE, 200, 0, stubRaster)
  expect(tree.type).toBe('Box')
  expect(tree.children).toHaveLength(2)
})

test('pickChipMode (totalWidth) accounts for the aggregate light glyph and its gap, not just the chips', ($, on) => {
  const plain = [row({ id: 'main' })]
  const withSignal = [row({ id: 'main', lastCheckDecision: 'ask' })]
  // Same chip layout either way; only the aggregate light differs (null vs
  // yellow, +2 columns). At a width that fits the plain row's "full" chip
  // but not the extra 2 columns the signal-bearing row's light costs, the
  // signal-bearing row must degrade one stage further.
  expect(pickChipMode(plain, 12)).toBe('full')
  expect(pickChipMode(withSignal, 12)).toBe('no-label')
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

test('renderPulseRow bar shrinks (not the fraction) as bodyColumns narrows, when idle with todos pending', ($, on) => {
  const wide = renderBand([row()], { done: 3, total: 10 }, IDLE, 50, 0, stubRaster)
  const narrow = renderBand([row()], { done: 3, total: 10 }, IDLE, 8, 0, stubRaster)

  const widePulseRow = wide.children?.[1] as TreeLike
  const narrowPulseRow = narrow.children?.[1] as TreeLike

  const wideBar = (widePulseRow.children?.[0] as TreeLike).children?.[0] as string
  const narrowBar = (narrowPulseRow.children?.[0] as TreeLike).children?.[0] as string
  const narrowFraction = (narrowPulseRow.children?.[1] as TreeLike).children?.[0] as string

  expect(narrowBar.length).toBeLessThan(wideBar.length)
  // The number itself never shrinks or wraps — only the bar graphic does.
  expect(narrowFraction).toBe(' 3/10')
})

test('renderBand working subagents stay visible (their avatar still drawn) even when width forces collapsing finished ones', ($, on) => {
  const rows = [
    row({ id: 'main' }),
    row({ id: 'a1', status: 'completed', subagentType: 'X' }),
    row({ id: 'a2', status: 'completed', subagentType: 'Z' }),
    row({ id: 'a3', working: true, subagentType: 'Y' }),
  ]
  // renderBand reserves 4 columns for its own status-colored border before
  // sizing the chips (see BORDER_OVERHEAD_COLS); at an outer width of 29
  // the inner 25 columns land in 'collapsed-finished': a1/a2 (finished)
  // collapse into "+2 done", a3 (still working) must stay visible.
  const tree = renderBand(rows, { done: 0, total: 0 }, IDLE, 29, 0, stubRaster)
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

test('renderBand pulse row reads "working…" while a turn is in flight', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, WORKING, 200, 0, stubRaster)
  expect(findText(tree, 'working')).toBe(true)
})

test('renderBand pulse row reads "waiting on you" while a tool call needs approval', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, WAITING, 200, 0, stubRaster)
  expect(findText(tree, 'waiting on you')).toBe(true)
})

test('renderBand pulse row reads "done" right after a turn completes', ($, on) => {
  const tree = renderBand([row()], { done: 0, total: 0 }, DONE, 200, 0, stubRaster)
  expect(findText(tree, 'done')).toBe(true)
})

test('renderBand wraps the whole band in a border whose color follows turn status, since the real prompt box border is theme-owned, not plugin-settable', ($, on) => {
  const todo = { done: 0, total: 0 }
  const idle = renderBand([row()], todo, IDLE, 200, 0, stubRaster)
  const working = renderBand([row()], todo, WORKING, 200, 0, stubRaster)
  const waiting = renderBand([row()], todo, WAITING, 200, 0, stubRaster)
  const done = renderBand([row()], todo, DONE, 200, 0, stubRaster)

  expect(idle.props?.borderColor).toBe('gray')
  expect(idle.props?.borderDimColor).toBe(true)
  expect(working.props?.borderColor).toBe('cyan')
  expect(waiting.props?.borderColor).toBe('yellow')
  expect(done.props?.borderColor).toBe('green')
  expect(working.props?.borderDimColor).toBe(false)
})
