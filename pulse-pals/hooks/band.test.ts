import { test, expect } from 'claude-code/testing'
import { renderBand } from './band'
import type { ImageBuilder, Tree } from './band'
import type { TurnStatusState } from './turn-status'

const IDLE: TurnStatusState = { status: 'idle', since: 0 }
const WORKING: TurnStatusState = { status: 'working', since: 0 }
const WAITING: TurnStatusState = { status: 'waiting', since: 0 }
const DONE: TurnStatusState = { status: 'done', since: 0 }

// band.tsx never builds an Image leaf itself (it has no `$` to resolve the
// real element constructor from) — tests inject this stub the same way
// register.tsx injects the real $.ui.resolve(e).Image.
const stubImage: ImageBuilder = props => ({ type: 'Image', props })

type TreeLike = { type?: string; props?: Record<string, unknown>; children?: Array<TreeLike | string> }

function findImageKeys(tree: unknown): string[] {
  if (!tree || typeof tree !== 'object') return []
  const node = tree as TreeLike
  const own = node.type === 'Image' && typeof node.props?.key === 'string' ? [node.props.key as string] : []
  const nested = (node.children ?? []).flatMap(findImageKeys)
  return [...own, ...nested]
}

test('renderBand always draws exactly the officer and the traffic light, keyed', ($, on) => {
  for (const turn of [IDLE, WORKING, WAITING, DONE]) {
    expect(findImageKeys(renderBand(turn, stubImage))).toEqual(['officer', 'light'])
  }
})

test('renderBand draws nothing beyond the officer and the light — no box, no border, no text, no usage report', ($, on) => {
  const tree: Tree = renderBand(WORKING, stubImage)
  expect(tree.type).toBe('Box')
  expect(tree.props?.borderStyle).toBeUndefined()
  expect(tree.props?.width).toBeUndefined()
  expect(tree.children).toHaveLength(2)
})

test('renderBand picks a different officer and light picture per status, each with a non-empty alt', ($, on) => {
  const seen = new Set<string>()
  for (const turn of [IDLE, WORKING, WAITING, DONE]) {
    const tree = renderBand(turn, stubImage)
    const officer = (tree.children?.[0] as TreeLike).props
    const light = ((tree.children?.[1] as TreeLike).children?.[0] as TreeLike).props
    expect(typeof officer?.source).toBe('object')
    expect((officer?.alt as string)?.length).toBeGreaterThan(0)
    expect((light?.alt as string)?.length).toBeGreaterThan(0)
    seen.add(JSON.stringify(officer?.source))
  }
  // 4 statuses, 4 distinct officer pictures
  expect(seen.size).toBe(4)
})
