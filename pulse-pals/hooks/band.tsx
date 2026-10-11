import { LIGHT_COLUMNS, LIGHT_GRID, OFFICER_COLUMNS, OFFICER_GRID, PIXEL_ROWS } from './officer-pixels'
import { encodeRasterCells } from './raster'
import type { TurnStatusState } from './turn-status'

/**
 * One officer, one traffic light — not one avatar per agent. Both are drawn
 * as real terminal cells (`Raster`), sampled from the same hand-drawn art
 * that an earlier revision tried to show as a real bitmap (`Image`
 * element): `Image` only paints over cells on kitty/Ghostty/iTerm2/WezTerm/
 * foot — not Warp, not most terminals — and draws nothing (well, dim `alt`
 * text) everywhere else. `Raster`'s glyph-plus-two-colors cells are plain
 * ANSI/truecolor text, so this renders identically on any terminal with
 * color, no graphics-protocol dependency — the same technique Claude
 * Code's own startup logo uses. The resolution here (11x12 / 5x12 pixels)
 * is sampled straight from the real art, not redrawn as flat shapes, so it
 * reads much closer to that art than the first Raster attempt's 5x4 grid
 * did, while staying universal.
 */

export type Tree = {
  type: 'Box' | 'Text' | 'Raster'
  props?: Record<string, string | number | boolean>
  children?: Array<Tree | string>
}

// RasterProps as officer-pixels.ts's grids encode them; built by the real
// element constructor at the call site ($.ui.resolve(e).Raster in
// register.tsx) so this file stays a pure, $-free function — tests inject
// a plain-object stub instead.
export type RasterLeaf = { key: string; columns: number; rows: number; cells: string }
export type RasterBuilder = (props: RasterLeaf) => Tree

function box(props: Tree['props'], children: Tree['children']): Tree {
  return { type: 'Box', props, children }
}

const TEXT_ROWS = PIXEL_ROWS / 2
const GAP_COLS = 1

// The whole band: the officer and the traffic light, side by side. Nothing
// else — no box, no border, no usage report, no label. The two of them are
// the entire signal.
export function renderBand(turn: TurnStatusState, Raster: RasterBuilder): Tree {
  const officer = Raster({
    key: 'officer',
    columns: OFFICER_COLUMNS,
    rows: TEXT_ROWS,
    cells: encodeRasterCells(OFFICER_GRID[turn.status], OFFICER_COLUMNS, PIXEL_ROWS),
  })
  const light = Raster({
    key: 'light',
    columns: LIGHT_COLUMNS,
    rows: TEXT_ROWS,
    cells: encodeRasterCells(LIGHT_GRID[turn.status], LIGHT_COLUMNS, PIXEL_ROWS),
  })

  return box({ flexDirection: 'row', alignItems: 'center' }, [officer, box({ marginLeft: GAP_COLS }, [light])])
}
