import type { AgentRow } from './agents'
import { aggregateLightOf, emotionOf, statusDotOf } from './derive'
import { AGGREGATE_LIGHT_GLYPH, DOT_COLOR, LIGHT_COLOR, STATUS_DOT_GLYPH, roleOf } from './icons'
import { CREATURE_COLUMNS, CREATURE_TEXT_ROWS, creatureGrid, creatureRasterCells, isBlinking } from './creature'
import type { RoleKey } from './creature'
import type { TodoProgress } from './todo-progress'
import type { TurnStatus, TurnStatusState } from './turn-status'

// No label stage anymore — the avatar (color + cap + eyes) carries role and
// emotion on its own; a role NAME beside it was the "weird name on its
// side" nobody wanted. 'normal' shows every agent's avatar; narrower widths
// collapse finished ones, then drop the dot too.
export type ChipMode = 'normal' | 'collapsed-finished' | 'icons-only'

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

// A rough per-chip column estimate per mode, used only to decide which
// mode fits — not the actual rendered width (the terminal does that).
function estimatedChipWidth(mode: ChipMode): number {
  const avatar = CREATURE_COLUMNS
  const dot = mode === 'icons-only' ? 0 : 1
  const gap = 1
  return avatar + dot + gap
}

function totalChipsWidth(rows: readonly AgentRow[], mode: ChipMode): number {
  const visible = mode === 'collapsed-finished' || mode === 'icons-only'
    ? rows.filter(row => row.id === 'main' || !isFinished(row))
    : rows
  const chipsWidth = visible.length * estimatedChipWidth(mode)

  const finishedCount = rows.filter(isFinished).length
  const badge = finishedCount > 0 && (mode === 'collapsed-finished' || mode === 'icons-only')
    ? `+${finishedCount} done`.length
    : 0

  return chipsWidth + badge
}

export function pickChipMode(rows: readonly AgentRow[], maxCols: number): ChipMode {
  const stages: ChipMode[] = ['normal', 'collapsed-finished', 'icons-only']
  for (const stage of stages) {
    if (totalChipsWidth(rows, stage) <= maxCols) return stage
  }
  return 'icons-only' // narrowest stage always "fits" even if it visually clips
}

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
  if (mode !== 'icons-only') {
    children.push(text(STATUS_DOT_GLYPH, { color: DOT_COLOR[dot], wrap: 'truncate-end' }))
  }

  return box({ flexDirection: 'row', alignItems: 'center', marginRight: 1 }, children)
}

// Every visible avatar plus the "+N done" badge, flat — not wrapped in its
// own row, since the whole band is one row now: chips sit directly at the
// rule line's left edge, like a little badge perched on the border, rather
// than a separate row stacked above it.
function renderChips(rows: readonly AgentRow[], mode: ChipMode, now: number, Raster: RasterBuilder): Tree[] {
  const collapsing = mode === 'collapsed-finished' || mode === 'icons-only'
  const visibleRows = collapsing
    ? rows.filter(row => row.id === 'main' || !isFinished(row))
    : rows
  const finishedCount = rows.filter(isFinished).length

  const chips = visibleRows.map(row => renderChip(row, mode, now, Raster))
  if (collapsing && finishedCount > 0) {
    chips.push(text(`+${finishedCount} done`, { dimColor: true, wrap: 'truncate-end' }))
  }
  return chips
}

const RULE_CHAR = '─'
const SWEEP_PERIOD_MS = 1400
const SWEEP_SEGMENT_COLS = 6

const STATUS_LABEL: Record<TurnStatus, string> = {
  idle: '',
  working: 'working…',
  waiting: 'waiting on you',
  done: 'done',
}

const STATUS_COLOR: Record<TurnStatus, string> = {
  idle: 'gray',
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

// The "border": not a boxed frame around the band (that read as a UI widget
// sitting on top of the prompt), just this rule — a colored line doing
// double duty as both the status border and the progress bar. While
// working, a brighter segment sweeps across it.
function renderRule(turn: TurnStatusState, ruleWidth: number, now: number): Tree {
  const color = STATUS_COLOR[turn.status]
  if (turn.status === 'working') {
    const segment = Math.min(SWEEP_SEGMENT_COLS, ruleWidth)
    const start = sweepStart(now, ruleWidth, segment)
    const tail = Math.max(0, ruleWidth - start - segment)
    return box({ flexDirection: 'row' }, [
      text(RULE_CHAR.repeat(start), { color, dimColor: true }),
      text(RULE_CHAR.repeat(segment), { color }),
      text(RULE_CHAR.repeat(tail), { color, dimColor: true }),
    ])
  }
  return text(RULE_CHAR.repeat(ruleWidth), { color, dimColor: turn.status === 'idle' })
}

export function renderBand(
  rows: readonly AgentRow[],
  todo: TodoProgress,
  turn: TurnStatusState,
  maxCols: number,
  now: number,
  Raster: RasterBuilder,
): Tree {
  const label = statusLabel(turn, todo)
  const labelText = label ? ` ${label} ` : ''
  const light = aggregateLightOf(rows)
  // +1 gap before the glyph, same as the old aggregate-light spacing.
  const lightWidth = light ? 2 : 0
  const reserved = labelText.length + lightWidth

  const mode = pickChipMode(rows, Math.max(0, maxCols - reserved))
  const chips = renderChips(rows, mode, now, Raster)
  const chipsWidth = totalChipsWidth(rows, mode)
  const ruleWidth = Math.max(0, maxCols - chipsWidth - reserved)

  const children: Tree['children'] = [...chips, renderRule(turn, ruleWidth, now)]
  if (labelText) {
    children.push(text(labelText, { color: STATUS_COLOR[turn.status], wrap: 'truncate-end' }))
  }
  if (light) {
    children.push(text(AGGREGATE_LIGHT_GLYPH, { color: LIGHT_COLOR[light] }))
  }

  return box({ flexDirection: 'row', alignItems: 'center' }, children)
}
