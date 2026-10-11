import type { Register } from 'claude-code'
import { renderBand } from './band'
import { DONE_FADE_MS, applyTurnStatusEvent, initialTurnStatus } from './turn-status'
import type { TurnStatusState } from './turn-status'

let turnState: TurnStatusState = initialTurnStatus()

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
    $.ui.invalidate('ui.render')

    // The light fades done -> idle (the officer back to napping) on its own
    // after a few seconds, even with nothing else happening in the session
    // to trigger a redraw.
    $.clock.after(DONE_FADE_MS, () => {
      turnState = applyTurnStatusEvent(turnState, { type: 'fade', now: Date.now() })
      $.ui.invalidate('ui.render')
    })

    return result
  })

  on('ui.render', { component: 'AbovePrompt', surface: 'terminal' }, async ($, e, next) => {
    // hasSurvey: true means a survey holds the band; yield to it rather
    // than drawing over it.
    if (e.props.hasSurvey) return next(e)

    const { Raster } = $.ui.resolve(e)
    return renderBand(turnState, Raster)
  })
}
