/**
 * What the officer and traffic light show: not the todo list, but what the
 * turn is actually doing right now — idle (napping), working, waiting on an
 * approval, or just finished.
 */

export type TurnStatus = 'idle' | 'working' | 'waiting' | 'done'

export type TurnStatusState = {
  status: TurnStatus
  since: number
}

// How long the bar stays solid green after a turn finishes before fading
// back to idle.
export const DONE_FADE_MS = 4000

export function initialTurnStatus(): TurnStatusState {
  return { status: 'idle', since: 0 }
}

export type TurnStatusEvent =
  | { type: 'promptSubmit'; now: number }
  | { type: 'checkAsk'; now: number }
  | { type: 'checkResolved'; now: number }
  | { type: 'turnComplete'; now: number }
  | { type: 'fade'; now: number }

export function applyTurnStatusEvent(state: TurnStatusState, event: TurnStatusEvent): TurnStatusState {
  switch (event.type) {
    case 'promptSubmit':
      return { status: 'working', since: event.now }

    case 'checkAsk':
      // tool.check resolving to "ask" means the engine put it to the
      // person's approval dialog — there's no separate event for the dialog
      // itself resolving (see register.tsx's tool.check handler), so this
      // only has meaning while a turn is actually in flight; a stray ask
      // (or one replayed after the bar already faded) shouldn't resurrect it.
      return state.status === 'working' || state.status === 'waiting'
        ? { status: 'waiting', since: event.now }
        : state

    case 'checkResolved':
      // The only reliable signal that an approval was granted is a real
      // tool call actually starting to run (see register.tsx) — so this
      // only ever moves waiting -> working, never idle/done -> working.
      return state.status === 'waiting' ? { status: 'working', since: event.now } : state

    case 'turnComplete':
      return { status: 'done', since: event.now }

    case 'fade':
      return state.status === 'done' && event.now - state.since >= DONE_FADE_MS
        ? { status: 'idle', since: event.now }
        : state
  }
}
