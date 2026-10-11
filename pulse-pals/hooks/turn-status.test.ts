import { test, expect } from 'claude-code/testing'
import { applyTurnStatusEvent, initialTurnStatus, DONE_FADE_MS } from './turn-status'
import type { TurnStatusState } from './turn-status'

test('initialTurnStatus starts idle', ($, on) => {
  expect(initialTurnStatus().status).toBe('idle')
})

test('promptSubmit moves any state to working and stamps the time', ($, on) => {
  const state = applyTurnStatusEvent(initialTurnStatus(), { type: 'promptSubmit', now: 1000 })
  expect(state).toEqual({ status: 'working', since: 1000 })
})

test('checkAsk while working moves to waiting', ($, on) => {
  const working: TurnStatusState = { status: 'working', since: 0 }
  const state = applyTurnStatusEvent(working, { type: 'checkAsk', now: 1500 })
  expect(state).toEqual({ status: 'waiting', since: 1500 })
})

test('checkAsk while idle is ignored — a stray/replayed ask cannot resurrect a finished or never-started bar', ($, on) => {
  const idle: TurnStatusState = { status: 'idle', since: 0 }
  const state = applyTurnStatusEvent(idle, { type: 'checkAsk', now: 1500 })
  expect(state).toEqual(idle)
})

test('checkAsk while done is ignored, same reasoning', ($, on) => {
  const done: TurnStatusState = { status: 'done', since: 500 }
  const state = applyTurnStatusEvent(done, { type: 'checkAsk', now: 1500 })
  expect(state).toEqual(done)
})

test('checkResolved while waiting moves back to working', ($, on) => {
  const waiting: TurnStatusState = { status: 'waiting', since: 1000 }
  const state = applyTurnStatusEvent(waiting, { type: 'checkResolved', now: 2000 })
  expect(state).toEqual({ status: 'working', since: 2000 })
})

test('checkResolved while already working is a no-op, not a timestamp bump', ($, on) => {
  const working: TurnStatusState = { status: 'working', since: 1000 }
  const state = applyTurnStatusEvent(working, { type: 'checkResolved', now: 2000 })
  expect(state).toEqual(working)
})

test('checkResolved while idle is a no-op', ($, on) => {
  const idle: TurnStatusState = { status: 'idle', since: 0 }
  expect(applyTurnStatusEvent(idle, { type: 'checkResolved', now: 999 })).toEqual(idle)
})

test('turnComplete moves to done from any prior state, including waiting (a denied/aborted turn still ends)', ($, on) => {
  const waiting: TurnStatusState = { status: 'waiting', since: 1000 }
  const state = applyTurnStatusEvent(waiting, { type: 'turnComplete', now: 3000 })
  expect(state).toEqual({ status: 'done', since: 3000 })
})

test('fade moves done to idle once DONE_FADE_MS has elapsed', ($, on) => {
  const done: TurnStatusState = { status: 'done', since: 1000 }
  const state = applyTurnStatusEvent(done, { type: 'fade', now: 1000 + DONE_FADE_MS })
  expect(state).toEqual({ status: 'idle', since: 1000 + DONE_FADE_MS })
})

test('fade before DONE_FADE_MS has elapsed leaves it done', ($, on) => {
  const done: TurnStatusState = { status: 'done', since: 1000 }
  const state = applyTurnStatusEvent(done, { type: 'fade', now: 1000 + DONE_FADE_MS - 1 })
  expect(state).toEqual(done)
})

test('fade while not done (e.g. a new prompt started before the old fade timer fired) is a no-op', ($, on) => {
  const working: TurnStatusState = { status: 'working', since: 5000 }
  const state = applyTurnStatusEvent(working, { type: 'fade', now: 999999 })
  expect(state).toEqual(working)
})
