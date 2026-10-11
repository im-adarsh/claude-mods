import {
  LIGHT_DONE_PNG_B64,
  LIGHT_IDLE_PNG_B64,
  LIGHT_WAITING_PNG_B64,
  LIGHT_WORKING_PNG_B64,
  OFFICER_DONE_PNG_B64,
  OFFICER_IDLE_PNG_B64,
  OFFICER_WAITING_PNG_B64,
  OFFICER_WORKING_PNG_B64,
} from './officer-images'
import type { TurnStatus, TurnStatusState } from './turn-status'

/**
 * One officer, one traffic light — not one avatar per agent. Both are real
 * bitmap PNGs drawn with `Image`, not flat terminal cells: a `Raster` of
 * ANSI blocks was tried first and renders everywhere, but at the handful of
 * cells a band above the prompt can spare, it never reads as more than
 * colored rectangles. `Image` only paints over cells on terminals with an
 * image protocol (kitty, Ghostty, iTerm2, WezTerm, foot) — elsewhere it
 * draws its `alt` text, dim, in the same place. That tradeoff — real
 * detail on supporting terminals, plain words everywhere else — is the one
 * accepted here.
 */

export type Tree = {
  type: 'Box' | 'Text' | 'Image'
  props?: Record<string, unknown>
  children?: Array<Tree | string>
}

// ImageProps as the engine defines them; built by the real element
// constructor at the call site ($.ui.resolve(e).Image in register.tsx) so
// this file stays a pure, $-free function — tests inject a plain-object
// stub instead.
export type ImageLeaf = { key: string; source: { png: string }; columns: number; rows: number; alt: string }
export type ImageBuilder = (props: ImageLeaf) => Tree

function box(props: Tree['props'], children: Tree['children']): Tree {
  return { type: 'Box', props, children }
}

// Native pixel size is 144x160 (officer) and 64x160 (light); both scaled
// to the same row count so they sit level beside each other.
const OFFICER_COLUMNS = 9
const LIGHT_COLUMNS = 4
const IMAGE_ROWS = 5
const GAP_COLS = 1

const OFFICER_PNG: Record<TurnStatus, string> = {
  idle: OFFICER_IDLE_PNG_B64,
  working: OFFICER_WORKING_PNG_B64,
  waiting: OFFICER_WAITING_PNG_B64,
  done: OFFICER_DONE_PNG_B64,
}

const LIGHT_PNG: Record<TurnStatus, string> = {
  idle: LIGHT_IDLE_PNG_B64,
  working: LIGHT_WORKING_PNG_B64,
  waiting: LIGHT_WAITING_PNG_B64,
  done: LIGHT_DONE_PNG_B64,
}

// What a terminal with no image protocol shows instead, dim, in the
// officer's and light's place — also read by a screen reader.
const OFFICER_ALT: Record<TurnStatus, string> = {
  idle: 'officer napping',
  working: 'officer on duty',
  waiting: 'officer waiting on your approval',
  done: 'officer done',
}

const LIGHT_ALT: Record<TurnStatus, string> = {
  idle: 'light off',
  working: 'amber light',
  waiting: 'red light',
  done: 'green light',
}

// The whole band: the officer and the traffic light, side by side. Nothing
// else — no box, no border, no usage report, no label. The two of them are
// the entire signal.
export function renderBand(turn: TurnStatusState, Image: ImageBuilder): Tree {
  const officer = Image({
    key: 'officer',
    source: { png: OFFICER_PNG[turn.status] },
    columns: OFFICER_COLUMNS,
    rows: IMAGE_ROWS,
    alt: OFFICER_ALT[turn.status],
  })
  const light = Image({
    key: 'light',
    source: { png: LIGHT_PNG[turn.status] },
    columns: LIGHT_COLUMNS,
    rows: IMAGE_ROWS,
    alt: LIGHT_ALT[turn.status],
  })

  return box({ flexDirection: 'row', alignItems: 'center' }, [officer, box({ marginLeft: GAP_COLS }, [light])])
}
