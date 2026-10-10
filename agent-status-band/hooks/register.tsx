import type { EngineInterface, Register } from 'claude-code'
import { applyEvent, emptyState } from './agents'
import type { AgentsState, AgentState } from './agents'
import { renderBand } from './band'
import { todoProgressOf } from './todo-progress'

let state: AgentsState = emptyState()

// AgentInfo.status (from $.agent.list()) is documented as "running,
// completed, failed, killed, or another of the engine's task statuses" — it
// is a plain string, not guaranteed to be one of our 4-value AgentState
// union. Map anything unrecognized to 'running' (still in progress, nothing
// final) rather than casting, so a future/unknown engine status string can't
// silently mistype a row.
function toAgentState(status: string): AgentState {
  return status === 'completed' || status === 'failed' || status === 'killed'
    ? status
    : 'running'
}

async function resync($: EngineInterface) {
  const agents = await $.agent.list()
  state = applyEvent(state, {
    type: 'statusSync',
    statuses: agents.map(a => ({ id: a.id, status: toAgentState(a.status) })),
  })
  for (const agent of agents) {
    if (!state.rows.some(row => row.id === agent.id)) {
      state = applyEvent(state, {
        type: 'spawn',
        agentId: agent.id,
        subagentType: agent.type,
        now: Date.now(),
      })
    }
  }
  $.ui.invalidate('ui.render')
}

export const register: Register = on => {
  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await resync($)
    return result
  })

  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId ?? null
    state = applyEvent(state, { type: 'toolCallStart', agentId, now: Date.now() })
    $.ui.invalidate('ui.render')

    const result = await next(e)

    state = applyEvent(state, { type: 'toolCallEnd', agentId })
    await resync($)
    return result
  })

  on('tool.check', async ($, e, next) => {
    const result = await next(e)
    // Attribution: see hooks/agents.ts's header comment (resolved in Task 1)
    // — tool.check's real event payload carries no per-agent identity at
    // all (ToolCheckInput has no AgentLoop mixin), on both the query path
    // and a real engine-dispatched call. So there is no `agentId` to read
    // off `e` here; every decision is recorded against the main-loop row.
    const agentId: string | null = null
    state = applyEvent(state, { type: 'checkDecision', agentId, decision: result.decision })
    $.ui.invalidate('ui.render')
    return result
  })

  on('ui.render', { component: 'AbovePrompt', surface: 'terminal' }, async ($, e) => {
    const messages = await $.session.messages()
    const progress = todoProgressOf(messages)
    // AbovePrompt's props (hasSurvey, isWorking, maxRows, bodyColumns, scroll,
    // view) live under e.props, not flat on e — the ui.render envelope is
    // { surface, component, requestId, viewport?, props }.
    const maxCols = e.props.bodyColumns

    return renderBand(state.rows, progress, maxCols, Date.now())
  })
}
