import { test, expect } from 'claude-code/testing'
import { renderBand, renderOfficerRow, renderUsageRow } from './band'
import type { RasterBuilder, Tree } from './band'
import type { TurnStatusState } from './turn-status'

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
function ruleColor(tree: Tree): unknown {
  const rule = collectTexts(tree).find(leaf => [...leaf.text].every(ch => ch === RULE_CHAR))
  return rule?.props?.color
}

test('renderOfficerRow always draws both the officer and the traffic light, keyed', ($, on) => {
  const tree = renderOfficerRow(IDLE, 200, 0, stubRaster)
  expect(findRasterKeys(tree)).toEqual(['officer', 'light'])
})

test('renderBand falls back to the officer row when idle (no usage text to show yet)', ($, on) => {
  const tree = renderBand(IDLE, null, 200, 0, stubRaster)
  expect(findRasterKeys(tree)).toEqual(['officer', 'light'])
})

test('renderBand shows the officer row while working, waiting, and done-with-no-usage-text — only done-with-text swaps it out', ($, on) => {
  expect(findRasterKeys(renderBand(WORKING, null, 200, 0, stubRaster))).toEqual(['officer', 'light'])
  expect(findRasterKeys(renderBand(WAITING, null, 200, 0, stubRaster))).toEqual(['officer', 'light'])
  expect(findRasterKeys(renderBand(DONE, null, 200, 0, stubRaster))).toEqual(['officer', 'light'])
})

test('renderBand swaps to the usage row during the done window when usage text is available, no officer/light drawn then', ($, on) => {
  const tree = renderBand(DONE, 'ctx 42% · 5h 18% · $0.37', 200, 0, stubRaster)
  expect(findRasterKeys(tree)).toEqual([])
  expect(findText(tree, 'ctx 42%')).toBe(true)
})

test('renderBand does not show the usage row outside the done status, even if usage text happens to be set', ($, on) => {
  const tree = renderBand(WORKING, 'ctx 42%', 200, 0, stubRaster)
  expect(findText(tree, 'ctx 42%')).toBe(false)
  expect(findRasterKeys(tree)).toEqual(['officer', 'light'])
})

test('renderOfficerRow rule color follows status: gray idle, amber working, red waiting, green done — same scheme the light lights up in', ($, on) => {
  expect(ruleColor(renderOfficerRow(IDLE, 200, 0, stubRaster))).toBe('gray')
  expect(ruleColor(renderOfficerRow(WORKING, 200, 0, stubRaster))).toBe('#e3b341')
  expect(ruleColor(renderOfficerRow(WAITING, 200, 0, stubRaster))).toBe('#f85149')
  expect(ruleColor(renderOfficerRow(DONE, 200, 0, stubRaster))).toBe('#3fb950')
})

test('renderUsageRow colors its rule and text green, the "done" color, since it only ever shows during that window', ($, on) => {
  const tree = renderUsageRow('ctx 10%', 200)
  expect(ruleColor(tree)).toBe('#3fb950')
  const label = collectTexts(tree).find(leaf => leaf.text.includes('ctx 10%'))
  expect(label?.props?.color).toBe('#3fb950')
})

test('renderOfficerRow\'s rule shrinks as the total width narrows, reserving room for the officer and light first', ($, on) => {
  const wide = renderOfficerRow(IDLE, 50, 0, stubRaster)
  const narrow = renderOfficerRow(IDLE, 10, 0, stubRaster)

  const ruleLengthOf = (tree: Tree) => collectTexts(tree).find(leaf => [...leaf.text].every(ch => ch === RULE_CHAR))?.text.length ?? 0

  expect(ruleLengthOf(narrow)).toBeLessThan(ruleLengthOf(wide))
  // the officer and light are always drawn — they never give way to a
  // narrow width the way the rule does.
  expect(findRasterKeys(narrow)).toEqual(['officer', 'light'])
})

test('renderUsageRow\'s rule shrinks (not the label) as the total width narrows', ($, on) => {
  const wide = renderUsageRow('ctx 42% · 5h 18% · $0.37', 50)
  const narrow = renderUsageRow('ctx 42% · 5h 18% · $0.37', 20)

  const ruleLengthOf = (tree: Tree) => collectTexts(tree).find(leaf => [...leaf.text].every(ch => ch === RULE_CHAR))?.text.length ?? 0

  expect(ruleLengthOf(narrow)).toBeLessThan(ruleLengthOf(wide))
  expect(findText(narrow, 'ctx 42% · 5h 18% · $0.37')).toBe(true)
})
