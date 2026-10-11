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

// Not a boxed frame around the band (that read as a UI widget sitting on
// top of the prompt) — one colored rule, doing double duty as both the
// "border" and the status signal, same color the traffic light lights up:
// red = waiting (stop, needs you), amber = working (in progress), green =
// done, dim gray = idle.
const RULE_CHAR = '─'
const STATUS_COLOR: Record<TurnStatus, string> = {
  idle: 'gray',
  working: '#e3b341',
  waiting: '#f85149',
  done: '#3fb950',
}

function renderRule(status: TurnStatus, width: number): Tree {
  return text(RULE_CHAR.repeat(Math.max(0, width)), {
    color: STATUS_COLOR[status],
    dimColor: status === 'idle',
  })
}

// 1 column each side's gap, between the officer, the light and the rule.
const GAP_COLS = 1

export function renderOfficerRow(
  turn: TurnStatusState,
  maxCols: number,
  now: number,
  Raster: RasterBuilder,
): Tree {
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

  const reserved = OFFICER_COLUMNS + GAP_COLS + LIGHT_COLUMNS + GAP_COLS
  const ruleWidth = maxCols - reserved

  return box({ flexDirection: 'row', alignItems: 'center' }, [
    box({ marginRight: GAP_COLS }, [officer]),
    box({ marginRight: GAP_COLS }, [light]),
    renderRule(turn.status, ruleWidth),
  ])
}

// Once in a while (right after a turn finishes, during the same window the
// rule is briefly solid green) the row shows the usage report instead of
// the officer — see register.tsx's turn.complete handler.
export function renderUsageRow(usageText: string, maxCols: number): Tree {
  const label = ` ${usageText} `
  const ruleWidth = maxCols - label.length

  return box({ flexDirection: 'row', alignItems: 'center' }, [
    renderRule('done', ruleWidth),
    text(label, { color: STATUS_COLOR.done, wrap: 'truncate-end' }),
  ])
}

export function renderBand(
  turn: TurnStatusState,
  usageText: string | null,
  maxCols: number,
  now: number,
  Raster: RasterBuilder,
): Tree {
  if (turn.status === 'done' && usageText) {
    return renderUsageRow(usageText, maxCols)
  }
  return renderOfficerRow(turn, maxCols, now, Raster)
}
