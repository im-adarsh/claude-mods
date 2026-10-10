/**
 * Attribution decision (resolved by experiment, see Task 1 of the
 * implementation plan): tool.check's real event payload DID NOT carry
 * per-agent identity.
 *
 * Dispositive evidence (static): `ToolCheckInput` (this build's generated
 * `claude-code` types) is `{ tool, input, tool_use_id? }` with no
 * `AgentLoop` mixin, unlike `ToolCallInput`, which is explicitly
 * `ToolCallEnvelope & AgentLoop` and so carries `agentId`. This type is
 * the same for both of `tool.check`'s two paths — a manual query
 * (`$.tool.check`) and a real engine-dispatched call (deciding an actual
 * tool use); only `tool_use_id`'s presence/absence differs between those
 * two cases per the type's own doc comment ("on a real call only; absent
 * on a query"), not `agentId`, which the type lacks in both cases. So the
 * type evidence alone settles this regardless of which path is observed.
 *
 * Corroborating evidence (dynamic, query path only): a throwaway `claude
 * plugin test` diagnostic (an inline test plugin's `agent.spawn` handler
 * calling `$.tool.check` directly, not a live engine-dispatched call)
 * logged the real `e` it received as exactly
 * `{ tool: "Read", input: { file_path: "package.json" } }` — no
 * `agentId`, `agent_id`, or anything else beyond the documented shape.
 * This confirms the query path only; `claude plugin test`'s harness has
 * no real subagent loop to drive, so no real-call capture was obtainable
 * there. The static evidence above is what covers the real-call path.
 *
 * Consequence: statusDotOf in derive.ts uses the degraded fallback — a
 * binary colored/dim dot, no per-agent yellow/red distinction — and only
 * the aggregate light gets real ask/deny colors. tool_use_id correlation
 * against tool.call (which does carry agentId) was considered and
 * rejected as a fallback: tool.call only fires once a call is already
 * allowed to proceed, so it never fires for the ask/deny cases that are
 * the ones needing per-agent attribution in the first place.
 */

export type AgentState = 'running' | 'completed' | 'failed' | 'killed'

export type AgentRow = {
  id: string
  subagentType: string | null
  status: AgentState
  working: boolean
  lastCheckDecision: 'allow' | 'ask' | 'deny' | null
  toolCallCount: number
  spawnedAt: number
}

export type AgentsState = {
  rows: AgentRow[]
}

export type AgentEvent =
  | { type: 'spawn'; agentId: string; subagentType: string; now: number }
  | { type: 'toolCallStart'; agentId: string | null; now: number }
  | { type: 'toolCallEnd'; agentId: string | null }
  | { type: 'checkDecision'; agentId: string | null; decision: 'allow' | 'ask' | 'deny' }
  | { type: 'statusSync'; statuses: ReadonlyArray<{ id: string; status: AgentState }> }
  | { type: 'resetMain'; now: number }
  | { type: 'clearCheckDecision' }

function rowId(agentId: string | null): string {
  return agentId ?? 'main'
}

function newRow(id: string, subagentType: string | null, now: number): AgentRow {
  return {
    id,
    subagentType,
    status: 'running',
    working: false,
    lastCheckDecision: null,
    toolCallCount: 0,
    spawnedAt: now,
  }
}

export function emptyState(now: number): AgentsState {
  return { rows: [newRow('main', null, now)] }
}

function updateRow(
  state: AgentsState,
  id: string,
  update: (row: AgentRow) => AgentRow,
): AgentsState {
  const index = state.rows.findIndex(row => row.id === id)
  if (index === -1) return state // unknown agent: ignore, don't throw

  const rows = state.rows.slice()
  const row = rows[index]
  if (!row) return state
  rows[index] = update(row)
  return { rows }
}

export function applyEvent(state: AgentsState, event: AgentEvent): AgentsState {
  switch (event.type) {
    case 'spawn':
      return {
        rows: [...state.rows, newRow(event.agentId, event.subagentType, event.now)],
      }

    case 'toolCallStart':
      return updateRow(state, rowId(event.agentId), row => ({
        ...row,
        working: true,
        toolCallCount: row.toolCallCount + 1,
      }))

    case 'toolCallEnd':
      return updateRow(state, rowId(event.agentId), row => ({
        ...row,
        working: false,
      }))

    case 'checkDecision':
      return updateRow(state, rowId(event.agentId), row => ({
        ...row,
        lastCheckDecision: event.decision,
      }))

    case 'statusSync': {
      const byId = new Map(event.statuses.map(s => [s.id, s.status]))
      return {
        rows: state.rows.map(row => {
          const status = byId.get(row.id)
          return status ? { ...row, status } : row
        }),
      }
    }

    case 'resetMain':
      // Scopes the main loop's "exhaustion" to the current turn: a fresh
      // prompt resets the clock and the call count so a long-running
      // *session* doesn't permanently pin the one chip that's always
      // visible to the exhausted state (see Important 1 of the final
      // review fix wave).
      return updateRow(state, 'main', row => ({
        ...row,
        toolCallCount: 0,
        spawnedAt: event.now,
      }))

    case 'clearCheckDecision':
      // Clears every row's pending ask/deny signal back to neutral. Without
      // this, the last check decision of a turn sticks forever — the
      // aggregate light (and a row's "frustrated" emotion) would stay
      // yellow/red indefinitely even once the session goes idle and
      // nothing is actually pending (Important 2 of the final review fix
      // wave).
      return {
        rows: state.rows.map(row => ({ ...row, lastCheckDecision: null })),
      }
  }
}
