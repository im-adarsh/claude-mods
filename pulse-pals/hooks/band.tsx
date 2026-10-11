import type { AgentRow } from './agents'
import { aggregateLightOf, emotionOf, statusDotOf } from './derive'
import {
  AGGREGATE_LIGHT_GLYPH,
  DOT_COLOR,
  LIGHT_COLOR,
  STATUS_DOT_GLYPH,
  roleOf,
} from './icons'
import { CREATURE_COLUMNS, CREATURE_TEXT_ROWS, creatureGrid, creatureRasterCells, isBlinking } from './creature'
import type { RoleKey } from './creature'
import type { TodoProgress } from './todo-progress'
import type { TurnStatus, TurnStatusState } from './turn-status'

export type ChipMode = 'full' | 'no-label' | 'collapsed-finished' | 'icons-only'

export type Tree = {
  type: 'Box' | 'Text' | 'Raster'
  props?: Record<string, string | number | boolean>
  children?: Array<Tree | string>
}

// RasterProps as creature.ts encodes them; built by the real element
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

function isFinished(row: AgentRow): boolean {
  return row.status !== 'running'
}

function roleKeyOf(row: AgentRow): RoleKey {
  return row.id === 'main' ? 'main' : roleOf(row.subagentType)
}

function chipLabel(row: AgentRow): string {
  return row.id === 'main' ? 'main' : roleOf(row.subagentType)
}

// A rough per-chip column estimate per mode, used only to decide which
// mode fits — not the actual rendered width (the terminal does that).
function estimatedChipWidth(row: AgentRow, mode: ChipMode): number {
  const avatar = CREATURE_COLUMNS
  const dot = mode === 'icons-only' ? 0 : 1
  const label = mode === 'full' ? chipLabel(row).length + 1 : 0
  const gap = 1
  return avatar + dot + label + gap
}

function totalWidth(rows: readonly AgentRow[], mode: ChipMode): number {
  const visible = mode === 'collapsed-finished' || mode === 'icons-only'
    ? rows.filter(row => row.id === 'main' || !isFinished(row))
    : rows
  const chipsWidth = visible.reduce((sum, row) => sum + estimatedChipWidth(row, mode), 0)

  const finishedCount = rows.filter(isFinished).length
  const badge = finishedCount > 0 && (mode === 'collapsed-finished' || mode === 'icons-only')
    ? `+${finishedCount} done`.length
    : 0

  // renderChipRow draws the aggregate light (when non-null) as a 1-column
  // glyph plus a `justifyContent: 'space-between'` gap of 1 column between
  // it and the chip row; both must count toward the estimate or a row can
  // land 1-2 columns over budget right at a stage boundary.
  const light = aggregateLightOf(rows) !== null ? 1 + 1 : 0

  return chipsWidth + badge + light
}

export function pickChipMode(rows: readonly AgentRow[], maxCols: number): ChipMode {
  const stages: ChipMode[] = ['full', 'no-label', 'collapsed-finished', 'icons-only']
  for (const stage of stages) {
    if (totalWidth(rows, stage) <= maxCols) return stage
  }
  return 'icons-only' // narrowest stage always "fits" even if it visually clips
}

const TRUNCATE_END: Tree['props'] = { wrap: 'truncate-end' }

function renderChip(row: AgentRow, mode: ChipMode, now: number, Raster: RasterBuilder): Tree {
  const emotion = emotionOf(row, now)
  const dot = statusDotOf(row)
  const grid = creatureGrid(roleKeyOf(row), emotion, isBlinking(row.id, now))
  const avatar = Raster({
    key: `avatar-${row.id}`,
    columns: CREATURE_COLUMNS,
    rows: CREATURE_TEXT_ROWS,
    cells: creatureRasterCells(grid),
  })

  const children: Tree['children'] = [avatar]
  if (mode === 'full') children.push(text(chipLabel(row), TRUNCATE_END))
  if (mode !== 'icons-only') {
    children.push(text(STATUS_DOT_GLYPH, { color: DOT_COLOR[dot], wrap: 'truncate-end' }))
  }

  return box({ flexDirection: 'row', alignItems: 'center', marginRight: 1 }, children)
}

function renderChipRow(rows: readonly AgentRow[], mode: ChipMode, now: number, Raster: RasterBuilder): Tree {
  const collapsing = mode === 'collapsed-finished' || mode === 'icons-only'
  const visibleRows = collapsing
    ? rows.filter(row => row.id === 'main' || !isFinished(row))
    : rows
  const finishedCount = rows.filter(isFinished).length

  const chips = visibleRows.map(row => renderChip(row, mode, now, Raster))
  if (collapsing && finishedCount > 0) {
    chips.push(text(`+${finishedCount} done`, { dimColor: true, wrap: 'truncate-end' }))
  }

  const light = aggregateLightOf(rows)
  const children: Tree['children'] = [box({ flexDirection: 'row', alignItems: 'center' }, chips)]
  if (light) {
    children.push(text(AGGREGATE_LIGHT_GLYPH, { color: LIGHT_COLOR[light] }))
  }

  return box({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, children)
}

const PULSE_BAR_CHAR = '▁'
const SWEEP_PERIOD_MS = 1400
const SWEEP_SEGMENT_COLS = 5

const STATUS_LABEL: Record<TurnStatus, string> = {
  idle: '',
  working: 'working…',
  waiting: 'waiting on you',
  done: 'done',
}

const STATUS_COLOR: Record<TurnStatus, string | undefined> = {
  idle: undefined,
  working: 'cyan',
  waiting: 'yellow',
  done: 'green',
}

// Position of the sweeping segment: a ping-pong 0->1->0 so it reads as
// scanning back and forth rather than snapping to the start each loop.
function sweepStart(now: number, trackWidth: number, segment: number): number {
  if (trackWidth <= segment) return 0
  const t = (now % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS
  const p = t < 0.5 ? t * 2 : (1 - t) * 2
  return Math.round(p * (trackWidth - segment))
}

function statusLabel(turn: TurnStatusState, todo: TodoProgress): string {
  const base = STATUS_LABEL[turn.status]
  if (todo.total === 0) return base
  const fraction = `${todo.done}/${todo.total}`
  return base ? `${base} · ${fraction}` : fraction
}

function renderPulseRow(turn: TurnStatusState, todo: TodoProgress, bodyColumns: number, now: number): Tree {
  const label = statusLabel(turn, todo)
  const labelText = label ? ` ${label}` : ''
  // Reserve room for the label first, same shrink-the-graphic-not-the-text
  // approach as the old todo bar: the bar is what gives way at narrow widths.
  const barWidth = Math.max(0, bodyColumns - labelText.length)

  let bar: Tree
  if (turn.status === 'working') {
    const segment = Math.min(SWEEP_SEGMENT_COLS, barWidth)
    const start = sweepStart(now, barWidth, segment)
    const tail = Math.max(0, barWidth - start - segment)
    bar = box({ flexDirection: 'row' }, [
      text(PULSE_BAR_CHAR.repeat(start), { dimColor: true }),
      text(PULSE_BAR_CHAR.repeat(segment), { color: 'cyan' }),
      text(PULSE_BAR_CHAR.repeat(tail), { dimColor: true }),
    ])
  } else if (turn.status === 'waiting') {
    bar = text(PULSE_BAR_CHAR.repeat(barWidth), { color: 'yellow' })
  } else if (turn.status === 'done') {
    bar = text(PULSE_BAR_CHAR.repeat(barWidth), { color: 'green' })
  } else {
    bar = text(PULSE_BAR_CHAR.repeat(barWidth), { dimColor: true })
  }

  const labelProps: Tree['props'] = { wrap: 'truncate-end' }
  const labelColor = STATUS_COLOR[turn.status]
  if (labelColor) labelProps.color = labelColor

  return box({ flexDirection: 'row' }, [bar, text(labelText, labelProps)])
}

export function renderBand(
  rows: readonly AgentRow[],
  todo: TodoProgress,
  turn: TurnStatusState,
  maxCols: number,
  now: number,
  Raster: RasterBuilder,
): Tree {
  const mode = pickChipMode(rows, maxCols)
  return box({ flexDirection: 'column' }, [
    renderChipRow(rows, mode, now, Raster),
    renderPulseRow(turn, todo, maxCols, now),
  ])
}
