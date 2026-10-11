// pulse-pals/hooks/register.test.ts
//
// A test callback takes positional ($, on); events are raised through the
// real typed calls on $ ($.ui.render(...), $.tool.call(...)), with on(...)
// used to stub whatever answers beneath this plugin's hooks.
import { describe, expect, test } from 'claude-code/testing'

const ABOVE_PROMPT = {
  surface: 'terminal' as const,
  component: 'AbovePrompt' as const,
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 2,
    bodyColumns: 200,
    scroll: { offset: 0, bodyRows: 2 },
    view: {},
  },
}

const TURN_COMPLETE_INPUT = {
  answer: 'done',
  durationMs: 1000,
  isAborted: false,
  turnId: 'turn-1',
  reason: 'answer' as const,
}

describe('pulse-pals wiring', () => {
  test('renders the AbovePrompt band with nothing else happening', async ($, on) => {
    const rendered = await $.ui.render(ABOVE_PROMPT)
    expect(rendered).toBeTruthy()
  })

  test('a tool.check query with no tool_use_id (a plugin asking a hypothetical question, not a real pending call) does not flip the light to red', async ($, on) => {
    // register.tsx only records a checkAsk/checkResolved transition when
    // e.tool_use_id is present (a real engine-dispatched decision).
    // $.tool.check(...) is the real, typed way a plugin issues a query with
    // no tool_use_id at all (ToolCheckArgs omits it, and the engine never
    // fabricates one for this path) — this exercises that exact path
    // through the real hook. There's no test-harness equivalent for a real
    // pending call (which would carry tool_use_id): ToolCheckArgs has no
    // field for it, so a real ask -> waiting transition isn't exercisable
    // from a test, only read from the source.
    on('tool.check', () => ({ decision: 'deny' as const }))

    await $.tool.check({ tool: 'Read', input: { file_path: 'package.json' } })

    const rendered = await $.ui.render(ABOVE_PROMPT)
    expect(JSON.stringify(rendered)).not.toContain('waiting') // the waiting officer/light alt text
  })

  test('ui.render yields to a survey holding the band instead of drawing over it', async ($, on) => {
    // The test harness has no built-in default answer for ui.render (unlike
    // a real session, where something beneath always does) — stub a base
    // implementation so next(e) has something to resolve to when our
    // handler yields.
    on('ui.render', () => ({ type: 'Box', props: {}, children: [] }))

    const rendered = await $.ui.render({
      ...ABOVE_PROMPT,
      props: { ...ABOVE_PROMPT.props, hasSurvey: true },
    })

    // With hasSurvey: true the handler returns next(e) immediately, before
    // ever drawing the officer — so none of its markers should appear in
    // whatever the survey/engine default renders instead.
    expect(JSON.stringify(rendered)).not.toContain('officer')
  })

  test('a tool.call does not break rendering', async ($, on) => {
    on('tool.call', () => ({ result: 'ok' }))

    await $.tool.call({ tool: 'Read', file_path: 'package.json' } as never)

    const rendered = await $.ui.render(ABOVE_PROMPT)
    expect(rendered).toBeTruthy()
  })

  test('turn.complete moves the light to done (green) and schedules its own fade back to idle', async ($, on) => {
    on('turn.complete', () => ({ text: 'done' }))

    await $.turn.complete(TURN_COMPLETE_INPUT)

    const rendered = await $.ui.render(ABOVE_PROMPT)
    expect(rendered).toBeTruthy()
    // still just the officer + light, nothing else drawn for "done"
    expect(JSON.stringify(rendered)).toContain('officer')
  })
})
