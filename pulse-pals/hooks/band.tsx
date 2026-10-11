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

function text(content: string, props?: Tree['props']): Tree {
  return { type: 'Text', props, children: [content] }
}

// 1 column's gap between the officer and the light.
const GAP_COLS = 1

export function renderOfficerRow(turn: TurnStatusState, now: number, Raster: RasterBuilder): Tree {
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

// Once in a while (right after a turn finishes) the row shows the usage
// report instead of the officer — see register.tsx's turn.complete
// handler. `success` is a theme key, not a fixed hex: unlike the officer
// and light (Raster, which can only ever be fixed colors — there's no
// theme-aware pixel), plain text can and should follow the person's actual
// theme, light or dark.
export function renderUsageRow(usageText: string): Tree {
  return text(usageText, { color: 'success', wrap: 'truncate-end' })
}

export function renderBand(
  turn: TurnStatusState,
  usageText: string | null,
  now: number,
  Raster: RasterBuilder,
): Tree {
  if (turn.status === 'done' && usageText) {
    return renderUsageRow(usageText)
  }
  return renderOfficerRow(turn, now, Raster)
}
