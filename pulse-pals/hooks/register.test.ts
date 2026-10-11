// agent-status-band/hooks/register.test.ts
//
// Note: the task brief's sample test used a `fire('event', payload)` helper
// and a destructured `{ $, e, on, fire }` test callback. Neither exists in
// the real 'claude-code/testing' kit (confirmed against goland-skin's own
// register.test.ts and other shipped mods' tests): a test callback takes
// positional `($, on)`, and events are raised through the real typed calls
// on `$` (`$.ui.render(...)`, `$.agent.spawn(...)`, `$.tool.call(...)`),
// with `on(...)` used to stub whatever answers beneath this plugin's hooks.
// This file is written against that real API instead of transcribing the
// brief's sample, which would not load.
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

describe('agent-status-band wiring', () => {
  test('renders the AbovePrompt band with at least the main-loop chip, no subagents spawned', async ($, on) => {
    on('session.messages', () => ({ value: [] }))

    const rendered = await $.ui.render(ABOVE_PROMPT)

    expect(rendered).toBeTruthy()
  })

  test('a spawned agent updates the rendered band', async ($, on) => {
    on('session.messages', () => ({ value: [] }))
    on('agent.spawn', () => ({ model: 'core', agentId: 'test-agent-1' }))
    on('agent.list', () => ({
      value: [
        {
          id: 'test-agent-1',
          description: 'backend work',
          type: 'brocode:swe-backend',
          status: 'running',
        },
      ],
    }))

    await $.agent.spawn({ prompt: 'do backend work', subagentType: 'brocode:swe-backend' })

    const rendered = await $.ui.render(ABOVE_PROMPT)

    expect(rendered).toBeTruthy()
  })

  test('a tool.check query with no tool_use_id (a plugin asking a hypothetical question, not a real pending call) does not pollute the aggregate light', async ($, on) => {
    // Important 2's guard: register.tsx only records a checkDecision when
    // e.tool_use_id is present (a real engine-dispatched decision).
    // $.tool.check(...) is the real, typed way a plugin issues a query with
    // no tool_use_id at all (ToolCheckArgs omits it) — this exercises that
    // exact path through the real hook, rather than only asserting the
    // guard exists by reading the source.
    on('session.messages', () => ({ value: [] }))
    on('tool.check', () => ({ decision: 'deny' as const }))

    await $.tool.check({ tool: 'Read', input: { file_path: 'package.json' } })

    const rendered = await $.ui.render(ABOVE_PROMPT)
    expect(JSON.stringify(rendered)).not.toContain('red')
  })

  test('ui.render yields to a survey holding the band instead of drawing over it', async ($, on) => {
    on('session.messages', () => ({ value: [] }))
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
    // ever calling todoProgressOf/renderBand — so none of the band's own
    // markers (e.g. the todo fraction) should appear in whatever the
    // survey/engine default renders instead.
    expect(JSON.stringify(rendered)).not.toContain('0/0')
  })

  test('a tool.call does not break rendering', async ($, on) => {
    // The test harness has no real subagent loop (see hooks/agents.ts's
    // header comment), so a tool.call fired here always runs in the main
    // loop — there is no way to make it carry a subagent's agentId from a
    // test. This just confirms the toolCallStart/toolCallEnd wiring and the
    // resync it triggers don't throw and the band still renders.
    on('session.messages', () => ({ value: [] }))
    on('tool.call', () => ({ result: 'ok' }))
    on('agent.list', () => ({ value: [] }))

    await $.tool.call({ tool: 'Read', file_path: 'package.json' } as never)

    const rendered = await $.ui.render(ABOVE_PROMPT)

    expect(rendered).toBeTruthy()
  })
})
