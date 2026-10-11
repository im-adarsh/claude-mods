/**
 * statusDotOf/aggregateLightOf attribution decision (overrides the
 * original plan's sample code; see Task 1's finding recorded in
 * agents.ts's header comment): tool.check's event carries no agent
 * identity at all, so a future hook can only ever attribute a
 * tool.check decision to the main-loop row, never to the specific
 * subagent actually asked or denied. A per-row yellow/red dot built on
 * row.lastCheckDecision would therefore misattribute every subagent's
 * pending approval to the main-loop chip.
 *
 * statusDotOf uses ONLY row.status (never lastCheckDecision) because
 * status comes from a different, correctly-attributed data source
 * (AgentInfo via $.agent.list()) and is reliable per-row regardless of
 * the tool.check attribution gap.
 *
 * aggregateLightOf reads lastCheckDecision directly across all rows
 * (not via statusDotOf) because misattribution doesn't matter at the
 * aggregate level — it's answering "did anything, anywhere, get asked
 * or denied," not "which specific agent."
 */

import type { AgentRow } from './agents'

export type Emotion = 'sad' | 'frustrated' | 'happy' | 'exhausted' | 'excited' | 'focused'
export type StatusDot = 'green' | 'dim' | 'red'
export type TrafficLight = 'green' | 'yellow' | 'red' | null

export const EXHAUSTED_CALL_THRESHOLD = 15
export const EXHAUSTED_MS_THRESHOLD = 5 * 60 * 1000
export const EXCITED_CALL_THRESHOLD = 2

export function emotionOf(row: AgentRow, now: number): Emotion {
  if (row.status === 'failed' || row.status === 'killed') return 'sad'
  if (row.status === 'running' && row.lastCheckDecision === 'deny') return 'frustrated'
  if (row.status === 'completed') return 'happy'

  const elapsed = now - row.spawnedAt
  if (row.toolCallCount >= EXHAUSTED_CALL_THRESHOLD || elapsed >= EXHAUSTED_MS_THRESHOLD) {
    return 'exhausted'
  }
  if (row.toolCallCount < EXCITED_CALL_THRESHOLD) return 'excited'

  return 'focused'
}

export function statusDotOf(row: AgentRow): StatusDot {
  // The main loop has no AgentInfo entry of its own (see agents.ts), so
  // its `status` never leaves 'running' — red/dim would be permanently
  // unreachable for it. Its dot instead reflects `working`: green while
  // actively mid-call, dim while idle. Subagent rows keep the
  // status-based scheme, since their status IS reliably attributed.
  if (row.id === 'main') {
    return row.working ? 'green' : 'dim'
  }
  if (row.status === 'failed' || row.status === 'killed') return 'red'
  if (row.status === 'completed') return 'dim'
  return 'green'
}

export function aggregateLightOf(rows: readonly AgentRow[]): TrafficLight {
  const anyRed = rows.some(
    row => row.status === 'failed' || row.status === 'killed' || row.lastCheckDecision === 'deny',
  )
  if (anyRed) return 'red'

  const anyYellow = rows.some(row => row.lastCheckDecision === 'ask')
  if (anyYellow) return 'yellow'

  const anySignal = rows.some(
    row => row.status !== 'running' || row.lastCheckDecision !== null,
  )
  return anySignal ? 'green' : null
}
