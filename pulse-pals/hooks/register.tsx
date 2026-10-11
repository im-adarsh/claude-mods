import type { Register } from 'claude-code'
import { renderBand } from './band'
import { DONE_FADE_MS, applyTurnStatusEvent, initialTurnStatus } from './turn-status'
import type { TurnStatusState } from './turn-status'

let turnState: TurnStatusState = initialTurnStatus()
// Only meaningful while turnState.status === 'done': the usage line shown
// in that window instead of the officer, cleared once it fades to idle.
let usageText: string | null = null
let animationStarted = false

// How often the band redraws on its own, with nothing else happening, so
// the working-state pulse actually animates instead of only updating on
// the rare redraw a tool call happens to trigger.
const ANIMATION_TICK_MS = 500

type UsageLike = {
  context: { percent?: number }
  rateLimits: ReadonlyArray<{ kind: string; percentUsed: number }>
  cost?: { usd: number }
}

// "ctx 42% · 5h 18% · $0.37" — each piece only where the engine actually has
// it (SessionUsage documents rateLimits as empty off a subscription and
// cost as absent where the host keeps no ledger); null when none of it is
// available at all, so the band falls back to the normal officer view
// rather than showing an empty line.
function formatUsage(usage: UsageLike): string | null {
  const parts: string[] = []
  if (usage.context.percent !== undefined) parts.push(`ctx ${Math.round(usage.context.percent)}%`)
  const fiveHour = usage.rateLimits.find(r => r.kind === 'five_hour')
  if (fiveHour) parts.push(`5h ${Math.round(fiveHour.percentUsed)}%`)
  if (usage.cost) parts.push(`$${usage.cost.usd.toFixed(2)}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

export const register: Register = on => {
  // A real call actually starting to run is the only reliable sign an
  // earlier "ask" was granted (tool.check's own result can't tell us that —
  // see the tool.check handler below), so this is what moves waiting back
  // to working.
  on('tool.call', async ($, e, next) => {
    turnState = applyTurnStatusEvent(turnState, { type: 'checkResolved', now: Date.now() })
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const result = await next(e)
    // Guard: `tool_use_id` is present only when the engine is deciding a
    // real pending call; it's absent when another plugin calls
    // `$.tool.check(...)` just to ask a hypothetical question. Skip
    // recording entirely for the latter — otherwise a query with no real
    // call behind it could flip the light to red with nothing actually
    // pending.
    if (e.tool_use_id) {
      const now = Date.now()
      turnState = result.decision === 'ask'
        ? applyTurnStatusEvent(turnState, { type: 'checkAsk', now })
        : applyTurnStatusEvent(turnState, { type: 'checkResolved', now })
      $.ui.invalidate('ui.render')
    }
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    turnState = applyTurnStatusEvent(turnState, { type: 'promptSubmit', now: Date.now() })
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    turnState = applyTurnStatusEvent(turnState, { type: 'turnComplete', now: Date.now() })
    // The plain call (no `breakdown`) is free — the status line's own
    // figures, no token-count API calls.
    usageText = formatUsage(await $.session.usage())
    $.ui.invalidate('ui.render')

    // The band fades done -> idle (and the usage line clears with it) on
    // its own after a few seconds, even with nothing else happening in the
    // session to trigger a redraw.
    $.clock.after(DONE_FADE_MS, () => {
      turnState = applyTurnStatusEvent(turnState, { type: 'fade', now: Date.now() })
      usageText = null
      $.ui.invalidate('ui.render')
    })

    return result
  })

  on('ui.render', { component: 'AbovePrompt', surface: 'terminal' }, async ($, e, next) => {
    // hasSurvey: true means a survey holds the band; yield to it rather
    // than drawing over it.
    if (e.props.hasSurvey) return next(e)

    if (!animationStarted) {
      animationStarted = true
      $.clock.every(ANIMATION_TICK_MS, () => $.ui.invalidate('ui.render'))
    }

    const { Raster } = $.ui.resolve(e)
    return renderBand(turnState, usageText, e.props.bodyColumns, Date.now(), Raster)
  })
}
