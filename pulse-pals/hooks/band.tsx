import {
  OFFICER_COLUMNS,
  LIGHT_COLUMNS,
  TEXT_ROWS,
  encodeRasterCells,
  lightGrid,
  officerGrid,
} from './officer'
import type { TurnStatus, TurnStatusState } from './turn-status'

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

// The officer + traffic light, boxed in a colored border — the concept
// confirmed as the right one. The border can't be the real prompt box's
// own border (that's a theme value, not something a hook sets — see the
// README), so this is our own small bordered box sitting directly above
// it, colored the same as the light: gray/dim idle, amber working, red
// waiting on you, green done.
const BORDER_STYLE = 'round'
const BORDER_COLOR: Record<TurnStatus, string> = {
  idle: 'inactive',
  working: 'warning',
  waiting: 'error',
  done: 'success',
}

const GAP_COLS = 1 // between the officer and the light

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

  return box(
    {
      flexDirection: 'row',
      alignItems: 'center',
      borderStyle: BORDER_STYLE,
      borderColor: BORDER_COLOR[turn.status],
      borderDimColor: turn.status === 'idle',
      paddingX: 1,
    },
    [officer, box({ marginLeft: GAP_COLS }, [light])],
  )
}

// Once in a while (right after a turn finishes) the row shows the usage
// report instead of the officer — see register.tsx's turn.complete
// handler. `success` is a theme key, not a fixed hex: unlike the officer
// and light (Raster, which can only ever be fixed colors — there's no
// theme-aware pixel), plain text can and should follow the person's actual
// theme, light or dark.
export function renderUsageRow(usageText: string): Tree {
  return box(
    { borderStyle: BORDER_STYLE, borderColor: BORDER_COLOR.done, paddingX: 1 },
    [text(usageText, { color: 'success', wrap: 'truncate-end' })],
  )
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
