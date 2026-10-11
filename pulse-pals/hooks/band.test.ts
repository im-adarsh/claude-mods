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

test('renderOfficerRow always draws both the officer and the traffic light, keyed', ($, on) => {
  const tree = renderOfficerRow(IDLE, 0, stubRaster)
  expect(findRasterKeys(tree)).toEqual(['officer', 'light'])
})

test('renderOfficerRow wraps the officer+light in a bordered box, colored by status', ($, on) => {
  expect(renderOfficerRow(IDLE, 0, stubRaster).props?.borderColor).toBe('inactive')
  expect(renderOfficerRow(IDLE, 0, stubRaster).props?.borderDimColor).toBe(true)
  expect(renderOfficerRow(WORKING, 0, stubRaster).props?.borderColor).toBe('warning')
  expect(renderOfficerRow(WAITING, 0, stubRaster).props?.borderColor).toBe('error')
  expect(renderOfficerRow(DONE, 0, stubRaster).props?.borderColor).toBe('success')
  expect(renderOfficerRow(WORKING, 0, stubRaster).props?.borderDimColor).toBe(false)
})

test('renderBand falls back to the officer row when idle (no usage text to show yet)', ($, on) => {
  const tree = renderBand(IDLE, null, 0, stubRaster)
  expect(findRasterKeys(tree)).toEqual(['officer', 'light'])
})

test('renderBand shows the officer row while working, waiting, and done-with-no-usage-text — only done-with-text swaps it out', ($, on) => {
  expect(findRasterKeys(renderBand(WORKING, null, 0, stubRaster))).toEqual(['officer', 'light'])
  expect(findRasterKeys(renderBand(WAITING, null, 0, stubRaster))).toEqual(['officer', 'light'])
  expect(findRasterKeys(renderBand(DONE, null, 0, stubRaster))).toEqual(['officer', 'light'])
})

test('renderBand swaps to the usage row during the done window when usage text is available, no officer/light drawn then', ($, on) => {
  const tree = renderBand(DONE, 'ctx 42% · 5h 18% · $0.37', 0, stubRaster)
  expect(findRasterKeys(tree)).toEqual([])
  expect(findText(tree, 'ctx 42%')).toBe(true)
})

test('renderBand does not show the usage row outside the done status, even if usage text happens to be set', ($, on) => {
  const tree = renderBand(WORKING, 'ctx 42%', 0, stubRaster)
  expect(findText(tree, 'ctx 42%')).toBe(false)
  expect(findRasterKeys(tree)).toEqual(['officer', 'light'])
})

test('renderUsageRow is boxed in the same "done" bordered-box style the officer row uses, text colored by the theme\'s success key', ($, on) => {
  const tree: Tree = renderUsageRow('ctx 10%')
  expect(tree.type).toBe('Box')
  expect(tree.props?.borderColor).toBe('success')
  expect(findText(tree, 'ctx 10%')).toBe(true)
})
