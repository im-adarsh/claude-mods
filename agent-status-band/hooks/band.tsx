import type { AgentRow } from './agents'
import { aggregateLightOf, emotionOf, statusDotOf } from './derive'
import {
  AGGREGATE_LIGHT_GLYPH,
  DOT_COLOR,
  EMOTION_GLYPH,
  LIGHT_COLOR,
  MAIN_LOOP_ICON,
  ROLE_ICON,
  STATUS_DOT_GLYPH,
  roleOf,
} from './icons'
import type { TodoProgress } from './todo-progress'

export type ChipMode = 'full' | 'no-label' | 'collapsed-finished' | 'icons-only'

export type Tree = {
  type: 'Box' | 'Text'
  props?: Record<string, string | number | boolean>
  children?: Array<Tree | string>
}

function box(props: Tree['props'], children: Tree['children']): Tree {
  return { type: 'Box', props, children }
}

function text(content: string, props?: Tree['props']): Tree {
  return { type: 'Text', props, children: [content] }
}

function isFinished(row: AgentRow): boolean {
  return row.status !== 'running'
}

function iconOf(row: AgentRow): string {
  return row.id === 'main' ? MAIN_LOOP_ICON : ROLE_ICON[roleOf(row.subagentType)]
}

function chipLabel(row: AgentRow): string {
  return row.id === 'main' ? 'main' : roleOf(row.subagentType)
}

// A rough per-chip column estimate per mode, used only to decide which
// mode fits — not the actual rendered width (the terminal does that).
function estimatedChipWidth(row: AgentRow, mode: ChipMode): number {
  const icon = 1
  const emotion = mode === 'icons-only' ? 0 : 1
  const dot = mode === 'icons-only' ? 0 : 1
  const label = mode === 'full' ? chipLabel(row).length + 1 : 0
  const gap = 1
  return icon + emotion + dot + label + gap
}

function totalWidth(rows: readonly AgentRow[], mode: ChipMode): number {
  const visible = mode === 'collapsed-finished' || mode === 'icons-only'
    ? rows.filter(row => row.id === 'main' || !isFinished(row))
    : rows
  const chipsWidth = visible.reduce((sum, row) => sum + estimatedChipWidth(row, mode), 0)
  const badge = rows.some(isFinished) && (mode === 'collapsed-finished' || mode === 'icons-only') ? 7 : 0
  return chipsWidth + badge
}

export function pickChipMode(rows: readonly AgentRow[], maxCols: number): ChipMode {
  const stages: ChipMode[] = ['full', 'no-label', 'collapsed-finished', 'icons-only']
  for (const stage of stages) {
    if (totalWidth(rows, stage) <= maxCols) return stage
  }
  return 'icons-only' // narrowest stage always "fits" even if it visually clips
}

function renderChip(row: AgentRow, mode: ChipMode, now: number): Tree {
  const dot = statusDotOf(row)
  const emotion = emotionOf(row, now)

  const children: Tree['children'] = [text(iconOf(row))]
  if (mode !== 'icons-only') children.push(text(EMOTION_GLYPH[emotion]))
  if (mode === 'full') children.push(text(chipLabel(row)))
  if (mode !== 'icons-only') children.push(text(STATUS_DOT_GLYPH, { color: DOT_COLOR[dot] }))

  return box({ flexDirection: 'row', marginRight: 1 }, children)
}

function renderChipRow(rows: readonly AgentRow[], mode: ChipMode, now: number): Tree {
  const collapsing = mode === 'collapsed-finished' || mode === 'icons-only'
  const visibleRows = collapsing
    ? rows.filter(row => row.id === 'main' || !isFinished(row))
    : rows
  const finishedCount = rows.filter(isFinished).length

  const chips = visibleRows.map(row => renderChip(row, mode, now))
  if (collapsing && finishedCount > 0) {
    chips.push(text(`+${finishedCount} done`, { dimColor: true }))
  }

  const light = aggregateLightOf(rows)
  const children: Tree['children'] = [box({ flexDirection: 'row' }, chips)]
  if (light) {
    children.push(text(AGGREGATE_LIGHT_GLYPH, { color: LIGHT_COLOR[light] }))
  }

  return box({ flexDirection: 'row', justifyContent: 'space-between' }, children)
}

function renderProgressRow(progress: TodoProgress): Tree {
  const barWidth = 20
  const filled =
    progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * barWidth)
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled)

  return box({ flexDirection: 'row' }, [
    text(bar, { dimColor: progress.total === 0 }),
    text(` ${progress.done}/${progress.total}`),
  ])
}

export function renderBand(
  rows: readonly AgentRow[],
  progress: TodoProgress,
  maxCols: number,
  now: number,
): Tree {
  const mode = pickChipMode(rows, maxCols)
  return box({ flexDirection: 'column' }, [
    renderChipRow(rows, mode, now),
    renderProgressRow(progress),
  ])
}
