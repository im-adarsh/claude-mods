import type { EngineInterface, Register } from 'claude-code'
import { applyEvent, emptyState } from './agents'
import type { AgentsState, AgentState } from './agents'
import { renderBand } from './band'
import { todoProgressOf } from './todo-progress'
import { DONE_FADE_MS, applyTurnStatusEvent, initialTurnStatus } from './turn-status'
import type { TurnStatusState } from './turn-status'

let state: AgentsState = emptyState(Date.now())
let turnState: TurnStatusState = initialTurnStatus()
let animationStarted = false

// How often the band redraws on its own, with nothing else happening, so the
// avatar's blink and the rule's working-sweep are actually visible instead
// of only updating on the rare redraw a tool call happens to trigger.
const ANIMATION_TICK_MS = 500

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
    // A real call actually starting to run is the only reliable sign an
    // earlier "ask" was granted — see turn-status.ts's checkResolved case.
    turnState = applyTurnStatusEvent(turnState, { type: 'checkResolved', now: Date.now() })
    $.ui.invalidate('ui.render')

    try {
      return await next(e)
    } finally {
      // Runs even if next(e) throws, so a failing call can't leave the row
      // permanently stuck at working: true with no resync ever happening.
      state = applyEvent(state, { type: 'toolCallEnd', agentId })
      await resync($)
    }
  })

  on('tool.check', async ($, e, next) => {
    const result = await next(e)
    // Attribution: see hooks/agents.ts's header comment (resolved in Task 1)
    // — tool.check's real event payload carries no per-agent identity at
    // all (ToolCheckInput has no AgentLoop mixin), on both the query path
    // and a real engine-dispatched call. So there is no `agentId` to read
    // off `e` here; every decision is recorded against the main-loop row.
    //
    // Guard: `tool_use_id` is present only when the engine is deciding a
    // real pending call; it's absent when another plugin calls
    // `$.tool.check(...)` just to ask a hypothetical question. Skip
    // recording entirely for the latter — otherwise a query with no real
    // call behind it could paint the main-loop row (and the aggregate
    // light) red/yellow for a decision nothing is actually waiting on, and
    // could flip the pulse bar to "waiting on you" with nothing pending.
    if (e.tool_use_id) {
      const agentId: string | null = null
      state = applyEvent(state, { type: 'checkDecision', agentId, decision: result.decision })
      const now = Date.now()
      turnState = result.decision === 'ask'
        ? applyTurnStatusEvent(turnState, { type: 'checkAsk', now })
        : applyTurnStatusEvent(turnState, { type: 'checkResolved', now })
      $.ui.invalidate('ui.render')
    }
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    // A new turn starting is the natural boundary to scope the main loop's
    // "exhaustion" to (Important 1) and to drop any stale ask/deny signal
    // left over from the previous turn (Important 2) — otherwise both
    // would otherwise persist for the rest of the session even once
    // nothing is actually pending or running long.
    const now = Date.now()
    state = applyEvent(state, { type: 'resetMain', now })
    state = applyEvent(state, { type: 'clearCheckDecision' })
    turnState = applyTurnStatusEvent(turnState, { type: 'promptSubmit', now })
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // A background subagent can finish its turn while the main loop stays
    // idle; without a resync here, nothing else would ever notice until an
    // unrelated agent.spawn/tool.call happened to fire one (Important 4).
    await resync($)

    turnState = applyTurnStatusEvent(turnState, { type: 'turnComplete', now: Date.now() })
    $.ui.invalidate('ui.render')
    // The pulse bar fades done -> idle on its own after a few seconds, even
    // with nothing else happening in the session to trigger a redraw.
    $.clock.after(DONE_FADE_MS, () => {
      turnState = applyTurnStatusEvent(turnState, { type: 'fade', now: Date.now() })
      $.ui.invalidate('ui.render')
    })

    return result
  })

  on('ui.render', { component: 'AbovePrompt', surface: 'terminal' }, async ($, e, next) => {
    // hasSurvey: true means a survey holds the band; yield to it rather
    // than drawing over it (Important 5).
    if (e.props.hasSurvey) return next(e)

    if (!animationStarted) {
      animationStarted = true
      $.clock.every(ANIMATION_TICK_MS, () => $.ui.invalidate('ui.render'))
    }

    const messages = await $.session.messages()
    const progress = todoProgressOf(messages)
    // AbovePrompt's props (hasSurvey, isWorking, maxRows, bodyColumns, scroll,
    // view) live under e.props, not flat on e — the ui.render envelope is
    // { surface, component, requestId, viewport?, props }.
    const maxCols = e.props.bodyColumns
    const { Raster } = $.ui.resolve(e)

    return renderBand(state.rows, progress, turnState, maxCols, Date.now(), Raster)
  })
}
