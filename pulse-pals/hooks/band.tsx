import {
  OFFICER_COLUMNS,
  LIGHT_COLUMNS,
  TEXT_ROWS,
  encodeRasterCells,
  lightGrid,
  officerGrid,
} from './officer'
import type { TurnStatusState } from './turn-status'

export type Tree = {
  type: 'Box' | 'Text' | 'Raster'
  props?: Record<string, string | number | boolean>
  children?: Array<Tree | string>
}

// RasterProps as officer.ts encodes them; built by the real element
// constructor at the call site ($.ui.resolve(e).Raster in register.tsx) so
// this file stays a pure, $-free function the way the rest of band.tsx is —
// tests inject a plain-object stub instead.
export type RasterLeaf = { key: string; columns: number; rows: number; cells: string }
export type RasterBuilder = (props: RasterLeaf) => Tree

function box(props: Tree['props'], children: Tree['children']): Tree {
  return { type: 'Box', props, children }
}

// The whole band: the officer and the traffic light, side by side. Nothing
// else — no box, no border, no usage report, no label. The two of them are
// the entire signal.
const GAP_COLS = 1

export function renderBand(turn: TurnStatusState, now: number, Raster: RasterBuilder): Tree {
  const pulse = Math.floor(now / 500) % 2 === 0

  const officer = Raster({
    key: 'officer',
    columns: OFFICER_COLUMNS,
    rows: TEXT_ROWS,
    cells: encodeRasterCells(officerGrid(turn.status, pulse), OFFICER_COLUMNS),
  })
  const light = Raster({
    key: 'light',
    columns: LIGHT_COLUMNS,
    rows: TEXT_ROWS,
    cells: encodeRasterCells(lightGrid(turn.status), LIGHT_COLUMNS),
  })

  return box({ flexDirection: 'row', alignItems: 'center' }, [officer, box({ marginLeft: GAP_COLS }, [light])])
}
