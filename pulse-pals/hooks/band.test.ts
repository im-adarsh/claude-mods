import { test, expect } from 'claude-code/testing'
import { renderBand } from './band'
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

function findRasterKeys(tree: unknown): string[] {
  if (!tree || typeof tree !== 'object') return []
  const node = tree as TreeLike
  const own = node.type === 'Raster' && typeof node.props?.key === 'string' ? [node.props.key as string] : []
  const nested = (node.children ?? []).flatMap(findRasterKeys)
  return [...own, ...nested]
}

test('renderBand always draws exactly the officer and the traffic light, keyed', ($, on) => {
  for (const turn of [IDLE, WORKING, WAITING, DONE]) {
    expect(findRasterKeys(renderBand(turn, 0, stubRaster))).toEqual(['officer', 'light'])
  }
})

test('renderBand draws nothing beyond the officer and the light — no box, no border, no text, no usage report', ($, on) => {
  const tree: Tree = renderBand(WORKING, 0, stubRaster)
  expect(tree.type).toBe('Box')
  expect(tree.props?.borderStyle).toBeUndefined()
  expect(tree.props?.width).toBeUndefined()
  expect(tree.children).toHaveLength(2)
})
