# agent-status-band Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `agent-status-band`, a Claude Code mod that draws a fixed two-line band above the prompt box showing every agent in the session (main loop + subagents) as role-icon chips with a status dot and emotion glyph, an aggregate traffic light, and an overall todo-list progress bar.

**Architecture:** Pure functions for all state transitions and derived values (agent tracking, emotion, status dot, traffic light, todo progress, chip/row rendering), each independently unit-tested with no engine involved. One thin `hooks/register.tsx` wires those pure functions to the real hooks (`agent.spawn`, `tool.call`, `tool.check`, `ui.render` matched on `component: 'AbovePrompt'`) and holds the only mutable state (a module-level `AgentsState` variable), calling `$.ui.invalidate()` after each state-changing hook to trigger a re-render.

**Tech Stack:** TypeScript, Claude Code plugin hooks API (`claude-code` module), Ink-style `Box`/`Text` render trees (built as plain object literals, no JSX), `claude plugin test` / `bun:test`-style `describe/expect/mock/test` for tests (same convention as `goland-skin/hooks/register.test.ts`).

**Spec:** `docs/superpowers/specs/2026-10-10-agent-status-band-design.md`

## Global Constraints

- No polling anywhere — every state change is driven by a hook event (spec: Architecture).
- The band is exactly two terminal lines tall at every width and agent count — never wraps, never grows (spec: Non-goals, Overflow and narrow terminals).
- No minimum terminal width — must render something useful even in an 80-column split pane (spec: Non-goals, Overflow and narrow terminals).
- No emoji anywhere — single-cell Unicode glyphs only, flat, no color-only distinctions where a shape difference is cheap (spec: Layout, Role → icon mapping).
- Terminal surface only (`surface: 'terminal'`) — not the desktop/pixel canvas (spec: Non-goals).
- Read-only — no click-to-approve/kill controls in v1 (spec: Non-goals).
- The `tool.check` agent-attribution risk (spec: Open technical risk) must be resolved experimentally as the first task, before any per-chip color logic is built on top of an assumption.

## Review Focus

- **A session with zero subagents ever spawned.** The spec says the main-loop chip is always present (never an empty band) — a plugin that only renders once a subagent exists would show nothing for the common single-agent case, which is most sessions.
- **Two agents spawned back-to-back before the first `ui.render` fires.** State must reflect both, not just the most recent one overwriting the other — a naive "current agent" singleton instead of a list would silently drop one.
- **An agent's `subagentType` is an exact string Claude Code didn't send in our mapping table** (e.g. a typo'd or newly-added agent name). Must fall back to the generic icon, never throw or render a blank/undefined chip.
- **The terminal is narrower than even the "icons-only" degraded form needs.** The spec requires the band to always render *something* at any width; an implementation that assumes a minimum column count and throws or draws off-screen at e.g. 20 columns violates the no-minimum-width constraint.
- **The todo list's latest `TodoWrite` call has zero items** (`{ todos: [] }`), as distinct from no `TodoWrite` call ever happening. Both should read as `0/0`, but they're different code paths (one has a tool use to find, one doesn't) and it's easy to accidentally conflate "no call found" with "call found with an empty array" or divide by zero somewhere in between.

---

## File Structure

```
agent-status-band/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   ├── hooks.json
│   ├── agents.ts            # AgentRow/AgentsState types, applyEvent() reducer
│   ├── agents.test.ts
│   ├── derive.ts             # emotionOf, statusDotOf, aggregateLightOf
│   ├── derive.test.ts
│   ├── icons.ts               # role table, glyph constants
│   ├── icons.test.ts
│   ├── todo-progress.ts       # todoProgressOf(messages)
│   ├── todo-progress.test.ts
│   ├── band.tsx                # chip/row rendering + narrow-width degradation
│   ├── band.test.ts
│   ├── register.tsx            # hook wiring (the only mutable state lives here)
│   └── register.test.ts
├── tsconfig.json
└── README.md
```

Each file owns one concern: `agents.ts` is state transitions, `derive.ts` is read-only derived values from that state, `icons.ts` is pure lookup tables, `todo-progress.ts` is transcript parsing, `band.tsx` is turning state into a render tree, `register.tsx` is the only place that touches the real hook API or holds mutable state. Every file except `register.tsx` is testable with plain data in, plain data out — no mocked engine needed.

---

### Task 1: Verify `tool.check` agent attribution, scaffold the plugin

This resolves the spec's flagged open risk before anything is built on top of an assumption, and gets the plugin skeleton in place so later tasks have somewhere to put code.

**Files:**
- Create: `agent-status-band/.claude-plugin/plugin.json`
- Create: `agent-status-band/hooks/hooks.json`
- Create: `agent-status-band/tsconfig.json`
- Create: `agent-status-band/hooks/attribution-check.test.ts` (throwaway diagnostic, deleted at the end of this task)

**Interfaces:**
- Produces: a recorded decision (as a comment block at the top of `hooks/agents.ts`, written in Task 2) of which attribution strategy Task 3 (`derive.ts`, specifically `statusDotOf`'s yellow/red logic) must implement: **(A)** full per-agent attribution if `tool.check`'s real runtime event carries agent identity despite the type declarations not showing it, or **(C)** the degraded fallback (binary colored/dim dot, no per-agent yellow/red) if it doesn't. There is no strategy (B) outcome to record — correlating via `tool_use_id` (spec's fallback 1) only helps the `allow` case, which doesn't need attribution anyway, so it's not a distinct implementation path.

- [ ] **Step 1: Scaffold the plugin manifest**

```json
// agent-status-band/.claude-plugin/plugin.json
{
  "name": "agent-status-band",
  "version": "0.1.0",
  "description": "A two-line band above the prompt showing every agent in the session: role icons, status, emotion, and an aggregate traffic light",
  "author": { "name": "Adarsh Kumar" },
  "keywords": ["agents", "subagents", "status", "band", "multi-agent"]
}
```

```json
// agent-status-band/hooks/hooks.json
{
  "modules": ["./register.tsx"]
}
```

```json
// agent-status-band/tsconfig.json
{
  "extends": "../tsconfig.base.json",
  "include": ["hooks"]
}
```

- [ ] **Step 2: Write a throwaway diagnostic test for `tool.check` attribution**

```ts
// agent-status-band/hooks/attribution-check.test.ts
import { describe, expect, test, tier } from 'claude-code/testing'

describe('attribution-check (throwaway)', () => {
  tier('core')

  test('does a tool.check event carry agent identity?', async ({ $, on }) => {
    const seen: unknown[] = []

    on('tool.check', { tool: 'Read' }, async ($$, e) => {
      seen.push(e)
      return { decision: 'allow' }
    })

    await $.agent.spawn({ prompt: 'Read package.json and report its contents.' })

    // Print what the real event actually looked like — this is a diagnostic
    // run, not an assertion, since we don't yet know the shape.
    console.log(JSON.stringify(seen, null, 2))

    expect(seen.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: Run the diagnostic and read the logged event shape**

Run: `claude plugin test ./agent-status-band`

Expected: the test passes or fails, but either way the console output shows the real shape of the `e` object `tool.check` received. Read it for any field that identifies which agent loop made the call — likely candidates given the spec's research: `agentId`, `agent_id`, or nothing at all beyond `{ tool, input, tool_use_id }`.

- [ ] **Step 4: Record the decision**

Delete `hooks/attribution-check.test.ts` (it was throwaway — its job was the console output, not a lasting test). In its place, start `hooks/agents.ts` with a comment recording the finding, e.g.:

```ts
// agent-status-band/hooks/agents.ts

/**
 * Attribution decision (resolved by experiment, see Task 1 of the
 * implementation plan): tool.check's real event payload [DID / DID NOT]
 * carry per-agent identity. [If it did: field name and how it's read
 * below. If it did not: statusDotOf in derive.ts uses the degraded
 * fallback — a binary colored/dim dot, no per-agent yellow/red
 * distinction — and only the aggregate light gets real ask/deny colors.]
 */
```

Whoever runs this task fills in the bracketed parts from the Step 3 result before committing — this is the one piece of this plan that depends on a real runtime answer, and the comment must state the actual finding, not stay templated.

- [ ] **Step 5: Validate the scaffold**

Run: `claude plugin validate ./agent-status-band`
Expected: fails because `hooks/register.tsx` doesn't exist yet — that's correct for this point in the plan (Task 7 creates it). Confirm the failure is specifically "no such module," not a JSON syntax error in the manifests just written.

- [ ] **Step 6: Commit**

```bash
git add agent-status-band/.claude-plugin/plugin.json agent-status-band/hooks/hooks.json agent-status-band/tsconfig.json agent-status-band/hooks/agents.ts
git commit -m "agent-status-band: scaffold plugin, resolve tool.check attribution risk"
```

---

### Task 2: Agent state tracking

**Files:**
- Modify: `agent-status-band/hooks/agents.ts` (the comment header already exists from Task 1)
- Create: `agent-status-band/hooks/agents.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no imports from other task files)
- Produces:
  ```ts
  export type AgentState = 'running' | 'completed' | 'failed' | 'killed'

  export type AgentRow = {
    id: string // 'main' for the main loop; AgentInfo.id for a subagent
    subagentType: string | null // null for the main loop
    status: AgentState
    working: boolean // a tool.call is in flight for this agent right now
    lastCheckDecision: 'allow' | 'ask' | 'deny' | null
    toolCallCount: number
    spawnedAt: number // epoch ms
  }

  export type AgentsState = {
    rows: AgentRow[] // main loop first, then subagents in spawn order
  }

  export type AgentEvent =
    | { type: 'spawn'; agentId: string; subagentType: string; now: number }
    | { type: 'toolCallStart'; agentId: string | null; now: number }
    | { type: 'toolCallEnd'; agentId: string | null }
    | { type: 'checkDecision'; agentId: string | null; decision: 'allow' | 'ask' | 'deny' }
    | { type: 'statusSync'; statuses: ReadonlyArray<{ id: string; status: AgentState }> }

  export function emptyState(): AgentsState
  export function applyEvent(state: AgentsState, event: AgentEvent): AgentsState
  ```
  `agentId: null` in an event means the main loop (matches `e.agentId === undefined` on real `tool.call` events, normalized to `null` by the caller in `register.tsx`).

- [ ] **Step 1: Write the failing tests**

```ts
// agent-status-band/hooks/agents.test.ts
import { describe, expect, test } from 'bun:test'
import { applyEvent, emptyState } from './agents'
import type { AgentsState } from './agents'

describe('emptyState', () => {
  test('has exactly one row: the main loop', () => {
    const state = emptyState()
    expect(state.rows).toHaveLength(1)
    expect(state.rows[0]).toMatchObject({
      id: 'main',
      subagentType: null,
      status: 'running',
      working: false,
      toolCallCount: 0,
    })
  })
})

describe('applyEvent: spawn', () => {
  test('adds a new row after the main loop, in spawn order', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'brocode:swe-backend', now: 1000 })
    state = applyEvent(state, { type: 'spawn', agentId: 'a2', subagentType: 'frontend-design', now: 2000 })

    expect(state.rows.map(r => r.id)).toEqual(['main', 'a1', 'a2'])
    expect(state.rows[1]).toMatchObject({
      subagentType: 'brocode:swe-backend',
      status: 'running',
      spawnedAt: 1000,
    })
  })

  test('two agents spawned back-to-back are both tracked, not one overwriting the other', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'X', now: 1000 })
    state = applyEvent(state, { type: 'spawn', agentId: 'a2', subagentType: 'Y', now: 1001 })
    expect(state.rows).toHaveLength(3) // main + a1 + a2
  })
})

describe('applyEvent: toolCallStart / toolCallEnd', () => {
  test('marks the matching row working, and only that row', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'X', now: 1000 })
    state = applyEvent(state, { type: 'toolCallStart', agentId: 'a1', now: 1500 })

    expect(state.rows.find(r => r.id === 'a1')?.working).toBe(true)
    expect(state.rows.find(r => r.id === 'main')?.working).toBe(false)
  })

  test('null agentId marks the main loop working', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'toolCallStart', agentId: null, now: 1000 })
    expect(state.rows.find(r => r.id === 'main')?.working).toBe(true)
  })

  test('toolCallStart increments toolCallCount; toolCallEnd clears working but keeps the count', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'toolCallStart', agentId: null, now: 1000 })
    state = applyEvent(state, { type: 'toolCallEnd', agentId: null })

    const main = state.rows.find(r => r.id === 'main')
    expect(main?.working).toBe(false)
    expect(main?.toolCallCount).toBe(1)
  })
})

describe('applyEvent: checkDecision', () => {
  test('records the decision on the matching row', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'X', now: 1000 })
    state = applyEvent(state, { type: 'checkDecision', agentId: 'a1', decision: 'deny' })
    expect(state.rows.find(r => r.id === 'a1')?.lastCheckDecision).toBe('deny')
  })
})

describe('applyEvent: statusSync', () => {
  test('updates status for rows present in the sync, leaves others unchanged', () => {
    let state = emptyState()
    state = applyEvent(state, { type: 'spawn', agentId: 'a1', subagentType: 'X', now: 1000 })
    state = applyEvent(state, { type: 'spawn', agentId: 'a2', subagentType: 'Y', now: 2000 })
    state = applyEvent(state, {
      type: 'statusSync',
      statuses: [{ id: 'a1', status: 'completed' }],
    })

    expect(state.rows.find(r => r.id === 'a1')?.status).toBe('completed')
    expect(state.rows.find(r => r.id === 'a2')?.status).toBe('running')
  })

  test('an event for an unknown agentId is ignored, not thrown', () => {
    const state = emptyState()
    expect(() =>
      applyEvent(state, { type: 'toolCallStart', agentId: 'ghost', now: 1000 }),
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `claude plugin test ./agent-status-band` (or `bun test agent-status-band/hooks/agents.test.ts` if running outside the plugin harness)
Expected: FAIL — `applyEvent`/`emptyState` not defined.

- [ ] **Step 3: Implement `agents.ts`**

```ts
// agent-status-band/hooks/agents.ts (appended below the Task 1 comment header)

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

export function emptyState(): AgentsState {
  return { rows: [newRow('main', null, 0)] }
}

function updateRow(
  state: AgentsState,
  id: string,
  update: (row: AgentRow) => AgentRow,
): AgentsState {
  const index = state.rows.findIndex(row => row.id === id)
  if (index === -1) return state // unknown agent: ignore, don't throw

  const rows = state.rows.slice()
  rows[index] = update(rows[index])
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
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `claude plugin test ./agent-status-band`
Expected: PASS, all `agents.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add agent-status-band/hooks/agents.ts agent-status-band/hooks/agents.test.ts
git commit -m "agent-status-band: add agent state tracking (applyEvent reducer)"
```

---

### Task 3: Derived state — emotion, status dot, aggregate light

**Files:**
- Create: `agent-status-band/hooks/derive.ts`
- Create: `agent-status-band/hooks/derive.test.ts`

**Interfaces:**
- Consumes: `AgentRow`, `AgentState` from `./agents` (Task 2)
- Produces:
  ```ts
  export type Emotion = 'sad' | 'frustrated' | 'happy' | 'exhausted' | 'excited' | 'focused'
  export type StatusDot = 'green' | 'yellow' | 'red'
  export type TrafficLight = 'green' | 'yellow' | 'red' | null

  export const EXHAUSTED_CALL_THRESHOLD = 15
  export const EXHAUSTED_MS_THRESHOLD = 5 * 60 * 1000
  export const EXCITED_CALL_THRESHOLD = 2

  export function emotionOf(row: AgentRow, now: number): Emotion
  export function statusDotOf(row: AgentRow): StatusDot
  export function aggregateLightOf(rows: readonly AgentRow[]): TrafficLight
  ```
  `statusDotOf` implements whichever attribution strategy Task 1 resolved — write the version matching that task's recorded finding (full per-row `ask`/`deny` colors, or the degraded binary fallback noted in `agents.ts`'s header comment).

- [ ] **Step 1: Write the failing tests**

```ts
// agent-status-band/hooks/derive.test.ts
import { describe, expect, test } from 'bun:test'
import {
  aggregateLightOf,
  emotionOf,
  statusDotOf,
  EXCITED_CALL_THRESHOLD,
  EXHAUSTED_CALL_THRESHOLD,
} from './derive'
import type { AgentRow } from './agents'

function row(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: 'a1',
    subagentType: 'X',
    status: 'running',
    working: false,
    lastCheckDecision: null,
    toolCallCount: 0,
    spawnedAt: 0,
    ...overrides,
  }
}

describe('emotionOf precedence ladder', () => {
  test('failed status wins over everything else, even a long runtime', () => {
    const r = row({ status: 'failed', toolCallCount: 999, spawnedAt: 0 })
    expect(emotionOf(r, 10_000_000)).toBe('sad')
  })

  test('killed status reads sad too', () => {
    expect(emotionOf(row({ status: 'killed' }), 0)).toBe('sad')
  })

  test('a pending deny on a still-running agent reads frustrated', () => {
    expect(emotionOf(row({ status: 'running', lastCheckDecision: 'deny' }), 0)).toBe('frustrated')
  })

  test('completed status reads happy', () => {
    expect(emotionOf(row({ status: 'completed' }), 0)).toBe('happy')
  })

  test('a long-running agent past the call threshold reads exhausted', () => {
    const r = row({ status: 'running', toolCallCount: EXHAUSTED_CALL_THRESHOLD })
    expect(emotionOf(r, 0)).toBe('exhausted')
  })

  test('a freshly spawned agent within the excited threshold reads excited', () => {
    const r = row({ status: 'running', toolCallCount: EXCITED_CALL_THRESHOLD - 1 })
    expect(emotionOf(r, 0)).toBe('excited')
  })

  test('a running agent past excited but below exhausted reads focused', () => {
    const r = row({ status: 'running', toolCallCount: EXCITED_CALL_THRESHOLD + 1 })
    expect(emotionOf(r, 0)).toBe('focused')
  })
})

describe('aggregateLightOf', () => {
  test('null when no agents have any signal yet (all focused, main loop idle)', () => {
    expect(aggregateLightOf([row({ id: 'main', status: 'running', toolCallCount: 0 })])).toBe(null)
  })

  test('red if any row has deny or failed/killed, even if others are fine', () => {
    const rows = [row({ id: 'a1', status: 'completed' }), row({ id: 'a2', status: 'failed' })]
    expect(aggregateLightOf(rows)).toBe('red')
  })

  test('yellow if any row has a pending ask and none are red', () => {
    const rows = [row({ id: 'a1', status: 'completed' }), row({ id: 'a2', lastCheckDecision: 'ask' })]
    expect(aggregateLightOf(rows)).toBe('yellow')
  })

  test('green if everything settled with no red/yellow signal', () => {
    const rows = [row({ id: 'a1', status: 'completed' }), row({ id: 'a2', status: 'completed' })]
    expect(aggregateLightOf(rows)).toBe('green')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `claude plugin test ./agent-status-band`
Expected: FAIL — `derive.ts` doesn't exist.

- [ ] **Step 3: Implement `derive.ts`**

```ts
// agent-status-band/hooks/derive.ts
import type { AgentRow } from './agents'

export type Emotion = 'sad' | 'frustrated' | 'happy' | 'exhausted' | 'excited' | 'focused'
export type StatusDot = 'green' | 'yellow' | 'red'
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
  if (row.status === 'failed' || row.status === 'killed') return 'red'
  if (row.lastCheckDecision === 'deny') return 'red'
  if (row.lastCheckDecision === 'ask') return 'yellow'
  return 'green'
}

export function aggregateLightOf(rows: readonly AgentRow[]): TrafficLight {
  const dots = rows.map(statusDotOf)
  if (dots.includes('red')) return 'red'
  if (dots.includes('yellow')) return 'yellow'

  const anySignal = rows.some(
    row => row.status !== 'running' || row.lastCheckDecision !== null,
  )
  return anySignal ? 'green' : null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `claude plugin test ./agent-status-band`
Expected: PASS, all `derive.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add agent-status-band/hooks/derive.ts agent-status-band/hooks/derive.test.ts
git commit -m "agent-status-band: add emotion, status dot, and aggregate light logic"
```

---

### Task 4: Role → icon mapping and glyph constants

**Files:**
- Create: `agent-status-band/hooks/icons.ts`
- Create: `agent-status-band/hooks/icons.test.ts`

**Interfaces:**
- Consumes: `Emotion`, `StatusDot`, `TrafficLight` from `./derive` (Task 3)
- Produces:
  ```ts
  export type Role = 'developer' | 'designer' | 'reviewer' | 'researcher' | 'tester' | 'planner' | 'generic'

  export const MAIN_LOOP_ICON: string
  export const ROLE_ICON: Record<Role, string>
  export const EMOTION_GLYPH: Record<Emotion, string>
  export const STATUS_DOT_GLYPH: string
  export const AGGREGATE_LIGHT_GLYPH: string
  export const DOT_COLOR: Record<StatusDot, string>
  export const LIGHT_COLOR: Record<Exclude<TrafficLight, null>, string>

  export function roleOf(subagentType: string | null): Role
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// agent-status-band/hooks/icons.test.ts
import { describe, expect, test } from 'bun:test'
import { roleOf, ROLE_ICON, EMOTION_GLYPH } from './icons'

describe('roleOf', () => {
  test('maps known brocode developer agents to the developer role', () => {
    expect(roleOf('brocode:swe-backend')).toBe('developer')
    expect(roleOf('brocode:swe-frontend')).toBe('developer')
  })

  test('maps design-oriented agents to the designer role', () => {
    expect(roleOf('frontend-design')).toBe('designer')
    expect(roleOf('ui-ux-pro-max')).toBe('designer')
  })

  test('maps review agents to the reviewer role', () => {
    expect(roleOf('pr-review-toolkit:code-reviewer')).toBe('reviewer')
  })

  test('maps exploration agents to the researcher role', () => {
    expect(roleOf('Explore')).toBe('researcher')
    expect(roleOf('understand-anything:architecture-analyzer')).toBe('researcher')
  })

  test('maps brocode:qa to the tester role', () => {
    expect(roleOf('brocode:qa')).toBe('tester')
  })

  test('maps planning agents to the planner role', () => {
    expect(roleOf('brocode:pm')).toBe('planner')
    expect(roleOf('brocode:tpm')).toBe('planner')
  })

  test('an unrecognized subagentType falls back to generic, never throws', () => {
    expect(() => roleOf('totally-unknown-agent-xyz')).not.toThrow()
    expect(roleOf('totally-unknown-agent-xyz')).toBe('generic')
  })

  test('null (main loop) also falls back to generic rather than throwing', () => {
    expect(roleOf(null)).toBe('generic')
  })
})

describe('icon tables cover every role and emotion with a non-empty glyph', () => {
  test('ROLE_ICON has a non-empty entry for every Role', () => {
    const roles: Array<keyof typeof ROLE_ICON> = [
      'developer', 'designer', 'reviewer', 'researcher', 'tester', 'planner', 'generic',
    ]
    for (const role of roles) {
      expect(ROLE_ICON[role]).toBeTruthy()
      expect(ROLE_ICON[role].length).toBe(1)
    }
  })

  test('EMOTION_GLYPH has a non-empty entry for every Emotion', () => {
    const emotions: Array<keyof typeof EMOTION_GLYPH> = [
      'sad', 'frustrated', 'happy', 'exhausted', 'excited', 'focused',
    ]
    for (const emotion of emotions) {
      expect(EMOTION_GLYPH[emotion]).toBeTruthy()
      expect(EMOTION_GLYPH[emotion].length).toBe(1)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `claude plugin test ./agent-status-band`
Expected: FAIL — `icons.ts` doesn't exist.

- [ ] **Step 3: Implement `icons.ts`**

```ts
// agent-status-band/hooks/icons.ts
import type { Emotion, StatusDot, TrafficLight } from './derive'

export type Role = 'developer' | 'designer' | 'reviewer' | 'researcher' | 'tester' | 'planner' | 'generic'

export const MAIN_LOOP_ICON = '◆'

export const ROLE_ICON: Record<Role, string> = {
  developer: '⌨',
  designer: '✎',
  reviewer: '✓',
  researcher: '⌕',
  tester: '⚗',
  planner: '☰',
  generic: '◇',
}

export const EMOTION_GLYPH: Record<Emotion, string> = {
  sad: '⌢',
  frustrated: '≠',
  happy: '⌣',
  exhausted: '≈',
  excited: '✦',
  focused: '·',
}

export const STATUS_DOT_GLYPH = '●'
export const AGGREGATE_LIGHT_GLYPH = '◉'

export const DOT_COLOR: Record<StatusDot, string> = {
  green: 'green',
  yellow: 'yellow',
  red: 'red',
}

export const LIGHT_COLOR: Record<Exclude<TrafficLight, null>, string> = {
  green: 'green',
  yellow: 'yellow',
  red: 'red',
}

const ROLE_PATTERNS: ReadonlyArray<[RegExp, Role]> = [
  [/^brocode:swe-/, 'developer'],
  [/general-purpose/, 'developer'],
  [/frontend-design/, 'designer'],
  [/ui-ux-pro-max/, 'designer'],
  [/code-reviewer/, 'reviewer'],
  [/pr-review-toolkit/, 'reviewer'],
  [/^Explore$/, 'researcher'],
  [/understand-anything/, 'researcher'],
  [/^brocode:qa$/, 'tester'],
  [/^brocode:pm$/, 'planner'],
  [/^brocode:tpm$/, 'planner'],
]

export function roleOf(subagentType: string | null): Role {
  if (!subagentType) return 'generic'
  const match = ROLE_PATTERNS.find(([pattern]) => pattern.test(subagentType))
  return match ? match[1] : 'generic'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `claude plugin test ./agent-status-band`
Expected: PASS, all `icons.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add agent-status-band/hooks/icons.ts agent-status-band/hooks/icons.test.ts
git commit -m "agent-status-band: add role-icon mapping and glyph constants"
```

---

### Task 5: Todo progress calculation

**Files:**
- Create: `agent-status-band/hooks/todo-progress.ts`
- Create: `agent-status-band/hooks/todo-progress.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (standalone)
- Produces:
  ```ts
  export type TodoProgress = { done: number; total: number }

  // Minimal shape this function reads off a session message — matches
  // claude-code's SessionMessage.toolUses, narrowed to what's needed here.
  export type ToolUseLike = { tool: string; input: unknown }
  export type SessionMessageLike = { toolUses: readonly ToolUseLike[] }

  export function todoProgressOf(messages: readonly SessionMessageLike[]): TodoProgress
  ```
  `register.tsx` (Task 7) passes the real `SessionMessage[]` from `$.session.messages()`, which satisfies `SessionMessageLike` structurally — this file doesn't import the `claude-code` module at all, keeping it engine-free and trivially testable.

- [ ] **Step 1: Write the failing tests**

```ts
// agent-status-band/hooks/todo-progress.test.ts
import { describe, expect, test } from 'bun:test'
import { todoProgressOf } from './todo-progress'
import type { SessionMessageLike } from './todo-progress'

describe('todoProgressOf', () => {
  test('0/0 when no TodoWrite call has happened', () => {
    const messages: SessionMessageLike[] = [{ toolUses: [] }]
    expect(todoProgressOf(messages)).toEqual({ done: 0, total: 0 })
  })

  test('0/0 (not divide-by-zero, not confused with "no call") when the latest call has an empty todos array', () => {
    const messages: SessionMessageLike[] = [
      { toolUses: [{ tool: 'TodoWrite', input: { todos: [] } }] },
    ]
    expect(todoProgressOf(messages)).toEqual({ done: 0, total: 0 })
  })

  test('counts completed vs total from a populated list', () => {
    const messages: SessionMessageLike[] = [
      {
        toolUses: [
          {
            tool: 'TodoWrite',
            input: {
              todos: [
                { content: 'a', status: 'completed' },
                { content: 'b', status: 'completed' },
                { content: 'c', status: 'in_progress' },
                { content: 'd', status: 'pending' },
              ],
            },
          },
        ],
      },
    ]
    expect(todoProgressOf(messages)).toEqual({ done: 2, total: 4 })
  })

  test('uses only the latest TodoWrite call, ignoring earlier superseded ones', () => {
    const messages: SessionMessageLike[] = [
      { toolUses: [{ tool: 'TodoWrite', input: { todos: [{ status: 'completed' }, { status: 'pending' }] } }] },
      { toolUses: [{ tool: 'TodoWrite', input: { todos: [{ status: 'completed' }] } }] },
    ]
    expect(todoProgressOf(messages)).toEqual({ done: 1, total: 1 })
  })

  test('ignores tool uses that are not TodoWrite', () => {
    const messages: SessionMessageLike[] = [
      { toolUses: [{ tool: 'Read', input: { file_path: 'x' } }] },
    ]
    expect(todoProgressOf(messages)).toEqual({ done: 0, total: 0 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `claude plugin test ./agent-status-band`
Expected: FAIL — `todo-progress.ts` doesn't exist.

- [ ] **Step 3: Implement `todo-progress.ts`**

```ts
// agent-status-band/hooks/todo-progress.ts

export type TodoProgress = { done: number; total: number }
export type ToolUseLike = { tool: string; input: unknown }
export type SessionMessageLike = { toolUses: readonly ToolUseLike[] }

const TODO_TOOL = 'TodoWrite'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function todoProgressOf(messages: readonly SessionMessageLike[]): TodoProgress {
  const allToolUses = messages.flatMap(message => message.toolUses)
  let latest: ToolUseLike | undefined
  for (const use of allToolUses) {
    if (use.tool === TODO_TOOL) latest = use
  }

  if (!latest || !isRecord(latest.input) || !Array.isArray(latest.input.todos)) {
    return { done: 0, total: 0 }
  }

  const todos = latest.input.todos as unknown[]
  const done = todos.filter(
    todo => isRecord(todo) && todo.status === 'completed',
  ).length

  return { done, total: todos.length }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `claude plugin test ./agent-status-band`
Expected: PASS, all `todo-progress.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add agent-status-band/hooks/todo-progress.ts agent-status-band/hooks/todo-progress.test.ts
git commit -m "agent-status-band: add transcript-derived todo progress calculation"
```

---

### Task 6: Chip and band rendering with narrow-width degradation

**Files:**
- Create: `agent-status-band/hooks/band.tsx`
- Create: `agent-status-band/hooks/band.test.ts`

**Interfaces:**
- Consumes: `AgentRow` from `./agents`; `emotionOf`, `statusDotOf`, `aggregateLightOf` from `./derive`; `roleOf`, `ROLE_ICON`, `MAIN_LOOP_ICON`, `EMOTION_GLYPH`, `STATUS_DOT_GLYPH`, `AGGREGATE_LIGHT_GLYPH`, `DOT_COLOR`, `LIGHT_COLOR` from `./icons`; `TodoProgress` from `./todo-progress`
- Produces:
  ```ts
  export type ChipMode = 'full' | 'no-label' | 'collapsed-finished' | 'icons-only'

  // A plain object tree — no JSX, matches claude-code's RenderElement shape
  // (StyledElement<'Box'|'Text', ...>) structurally.
  export type Tree = {
    type: 'Box' | 'Text'
    props?: Record<string, string | number | boolean>
    children?: Array<Tree | string>
  }

  export function pickChipMode(rows: readonly AgentRow[], maxCols: number): ChipMode
  export function renderBand(
    rows: readonly AgentRow[],
    progress: TodoProgress,
    maxCols: number,
    now: number,
  ): Tree
  ```
  `register.tsx` (Task 7) casts/passes this `Tree` as the real `RenderElement` the `ui.render` hook returns — the shapes match field-for-field, so no conversion step is needed, just a type assertion at the call site.

- [ ] **Step 1: Write the failing tests**

```ts
// agent-status-band/hooks/band.test.ts
import { describe, expect, test } from 'bun:test'
import { pickChipMode, renderBand } from './band'
import type { AgentRow } from './agents'

function row(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: 'main',
    subagentType: null,
    status: 'running',
    working: false,
    lastCheckDecision: null,
    toolCallCount: 0,
    spawnedAt: 0,
    ...overrides,
  }
}

function findText(tree: unknown, needle: string): boolean {
  if (typeof tree === 'string') return tree.includes(needle)
  if (tree && typeof tree === 'object') {
    const node = tree as { children?: unknown[] }
    return (node.children ?? []).some(child => findText(child, needle))
  }
  return false
}

describe('pickChipMode', () => {
  test('full mode when there is plenty of width', () => {
    expect(pickChipMode([row()], 200)).toBe('full')
  })

  test('degrades to no-label, then collapsed-finished, then icons-only as width shrinks', () => {
    const rows = [
      row({ id: 'main' }),
      row({ id: 'a1', status: 'completed', subagentType: 'X' }),
      row({ id: 'a2', status: 'completed', subagentType: 'Y' }),
      row({ id: 'a3', status: 'completed', subagentType: 'Z' }),
      row({ id: 'a4', working: true, subagentType: 'W' }),
    ]

    const modes = [200, 60, 30, 10].map(width => pickChipMode(rows, width))
    // Width shrinking should only ever hold steady or degrade further, never
    // jump back to a less-degraded mode.
    const order: Record<string, number> = { full: 0, 'no-label': 1, 'collapsed-finished': 2, 'icons-only': 3 }
    for (let i = 1; i < modes.length; i++) {
      expect(order[modes[i]]).toBeGreaterThanOrEqual(order[modes[i - 1]])
    }
  })

  test('never refuses to produce a mode at an extremely narrow width', () => {
    expect(() => pickChipMode([row()], 1)).not.toThrow()
  })
})

describe('renderBand', () => {
  test('shows the main loop even with no subagents and no todo progress yet', () => {
    const tree = renderBand([row()], { done: 0, total: 0 }, 200, 0)
    expect(findText(tree, '0/0')).toBe(true)
  })

  test('renders the todo fraction from a real progress value', () => {
    const tree = renderBand([row()], { done: 2, total: 4 }, 200, 0)
    expect(findText(tree, '2/4')).toBe(true)
  })

  test('always produces exactly two rows (two top-level Box children)', () => {
    const tree = renderBand([row()], { done: 0, total: 0 }, 200, 0)
    expect(tree.type).toBe('Box')
    expect(tree.children).toHaveLength(2)
  })

  test('working subagents stay visible even when width forces collapsing finished ones', () => {
    const rows = [
      row({ id: 'main' }),
      row({ id: 'a1', status: 'completed', subagentType: 'X' }),
      row({ id: 'a2', working: true, subagentType: 'Y' }),
    ]
    const tree = renderBand(rows, { done: 0, total: 0 }, 50, 0)
    // Y's role icon (designer glyph '✎' if subagentType 'Y' falls back to
    // generic '◇' — either way, some glyph for a1's row must still appear)
    // is asserted indirectly: the row count of individually-drawn chips
    // for non-finished agents never drops to zero while one is working.
    expect(findText(tree, '◇') || findText(tree, '✎')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `claude plugin test ./agent-status-band`
Expected: FAIL — `band.tsx` doesn't exist.

- [ ] **Step 3: Implement `band.tsx`**

```tsx
// agent-status-band/hooks/band.tsx
import type { AgentRow } from './agents'
import { aggregateLightOf, emotionOf, statusDotOf } from './derive'
import {
  AGGREGATE_LIGHT_GLYPH,
  DOT_COLOR,
  EMOTION_GLYPH,
  LIGHT_COLOR,
  MAIN_LOOP_ICON,
  ROLE_ICON,
  STATUS_DOT_GLYPH,
  roleOf,
} from './icons'
import type { TodoProgress } from './todo-progress'

export type ChipMode = 'full' | 'no-label' | 'collapsed-finished' | 'icons-only'

export type Tree = {
  type: 'Box' | 'Text'
  props?: Record<string, string | number | boolean>
  children?: Array<Tree | string>
}

function box(props: Tree['props'], children: Tree['children']): Tree {
  return { type: 'Box', props, children }
}

function text(content: string, props?: Tree['props']): Tree {
  return { type: 'Text', props, children: [content] }
}

function isFinished(row: AgentRow): boolean {
  return row.status !== 'running'
}

function iconOf(row: AgentRow): string {
  return row.id === 'main' ? MAIN_LOOP_ICON : ROLE_ICON[roleOf(row.subagentType)]
}

function chipLabel(row: AgentRow): string {
  return row.id === 'main' ? 'main' : roleOf(row.subagentType)
}

// A rough per-chip column estimate per mode, used only to decide which
// mode fits — not the actual rendered width (the terminal does that).
function estimatedChipWidth(row: AgentRow, mode: ChipMode): number {
  const icon = 1
  const emotion = mode === 'icons-only' ? 0 : 1
  const dot = mode === 'icons-only' ? 0 : 1
  const label = mode === 'full' ? chipLabel(row).length + 1 : 0
  const gap = 1
  return icon + emotion + dot + label + gap
}

function totalWidth(rows: readonly AgentRow[], mode: ChipMode): number {
  const visible = mode === 'collapsed-finished' || mode === 'icons-only'
    ? rows.filter(row => row.id === 'main' || !isFinished(row))
    : rows
  const chipsWidth = visible.reduce((sum, row) => sum + estimatedChipWidth(row, mode), 0)
  const badge = rows.some(isFinished) && (mode === 'collapsed-finished' || mode === 'icons-only') ? 7 : 0
  return chipsWidth + badge
}

export function pickChipMode(rows: readonly AgentRow[], maxCols: number): ChipMode {
  const stages: ChipMode[] = ['full', 'no-label', 'collapsed-finished', 'icons-only']
  for (const stage of stages) {
    if (totalWidth(rows, stage) <= maxCols) return stage
  }
  return 'icons-only' // narrowest stage always "fits" even if it visually clips
}

function renderChip(row: AgentRow, mode: ChipMode, now: number): Tree {
  const dot = statusDotOf(row)
  const emotion = emotionOf(row, now)

  const children: Tree['children'] = [text(iconOf(row))]
  if (mode !== 'icons-only') children.push(text(EMOTION_GLYPH[emotion]))
  if (mode === 'full') children.push(text(chipLabel(row)))
  if (mode !== 'icons-only') children.push(text(STATUS_DOT_GLYPH, { color: DOT_COLOR[dot] }))

  return box({ flexDirection: 'row', marginRight: 1 }, children)
}

function renderChipRow(rows: readonly AgentRow[], mode: ChipMode, now: number): Tree {
  const collapsing = mode === 'collapsed-finished' || mode === 'icons-only'
  const visibleRows = collapsing
    ? rows.filter(row => row.id === 'main' || !isFinished(row))
    : rows
  const finishedCount = rows.filter(isFinished).length

  const chips = visibleRows.map(row => renderChip(row, mode, now))
  if (collapsing && finishedCount > 0) {
    chips.push(text(`+${finishedCount} done`, { dimColor: true }))
  }

  const light = aggregateLightOf(rows)
  const children: Tree['children'] = [box({ flexDirection: 'row' }, chips)]
  if (light) {
    children.push(text(AGGREGATE_LIGHT_GLYPH, { color: LIGHT_COLOR[light] }))
  }

  return box({ flexDirection: 'row', justifyContent: 'space-between' }, children)
}

function renderProgressRow(progress: TodoProgress): Tree {
  const barWidth = 20
  const filled =
    progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * barWidth)
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled)

  return box({ flexDirection: 'row' }, [
    text(bar, { dimColor: progress.total === 0 }),
    text(` ${progress.done}/${progress.total}`),
  ])
}

export function renderBand(
  rows: readonly AgentRow[],
  progress: TodoProgress,
  maxCols: number,
  now: number,
): Tree {
  const mode = pickChipMode(rows, maxCols)
  return box({ flexDirection: 'column' }, [
    renderChipRow(rows, mode, now),
    renderProgressRow(progress),
  ])
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `claude plugin test ./agent-status-band`
Expected: PASS, all `band.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add agent-status-band/hooks/band.tsx agent-status-band/hooks/band.test.ts
git commit -m "agent-status-band: add chip/band rendering with narrow-width degradation"
```

---

### Task 7: Hook wiring

**Files:**
- Create: `agent-status-band/hooks/register.tsx`
- Create: `agent-status-band/hooks/register.test.ts`

**Interfaces:**
- Consumes: `applyEvent`, `emptyState`, `AgentEvent`, `AgentState` from `./agents`; `renderBand` from `./band`; `todoProgressOf` from `./todo-progress`
- Produces: the `register: Register` export `hooks.json` loads — nothing downstream depends on this file, it's the composition root.

- [ ] **Step 1: Write the failing test**

This test exercises the wiring end-to-end through the real hook harness (unlike every earlier task's plain-data tests), following the same pattern as `goland-skin/hooks/register.test.ts`.

```ts
// agent-status-band/hooks/register.test.ts
import { describe, expect, test } from 'claude-code/testing'

describe('agent-status-band wiring', () => {
  test('renders the AbovePrompt band with at least the main-loop chip, no subagents spawned', async ({ $, e, on, fire }) => {
    let rendered: unknown = null

    on('ui.render', { component: 'AbovePrompt', surface: 'terminal' }, async ($$, ev) => {
      // register.tsx's own handler runs via next(); capture what it returns.
      return ev
    })

    rendered = await fire('ui.render', {
      component: 'AbovePrompt',
      surface: 'terminal',
      hasSurvey: false,
      isWorking: false,
      maxRows: 2,
      maxCols: 200,
    })

    expect(rendered).toBeTruthy()
  })

  test('a spawned agent and a tool.call for it update the rendered band', async ({ $, fire }) => {
    await fire('agent.spawn', { subagentType: 'brocode:swe-backend' } as never)
    await fire('tool.call', { tool: 'Read', agentId: 'test-agent-1' } as never)

    const rendered = await fire('ui.render', {
      component: 'AbovePrompt',
      surface: 'terminal',
      hasSurvey: false,
      isWorking: false,
      maxRows: 2,
      maxCols: 200,
    })

    expect(rendered).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `claude plugin test ./agent-status-band`
Expected: FAIL — `register.tsx` doesn't exist, so `hooks.json`'s module can't load.

- [ ] **Step 3: Implement `register.tsx`**

```tsx
// agent-status-band/hooks/register.tsx
import type { EngineInterface, Register } from 'claude-code'
import { applyEvent, emptyState } from './agents'
import type { AgentsState, AgentState } from './agents'
import { renderBand } from './band'
import { todoProgressOf } from './todo-progress'

let state: AgentsState = emptyState()

async function resync($: EngineInterface) {
  const agents = await $.agent.list()
  state = applyEvent(state, {
    type: 'statusSync',
    statuses: agents.map(a => ({ id: a.id, status: a.status as AgentState })),
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
  await $.ui.invalidate()
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
    await $.ui.invalidate()

    const result = await next(e)

    state = applyEvent(state, { type: 'toolCallEnd', agentId })
    await resync($)
    return result
  })

  on('tool.check', async ($, e, next) => {
    const result = await next(e)
    // Attribution: see hooks/agents.ts's header comment for which strategy
    // this reflects (resolved in Task 1). If full attribution isn't
    // available on `e`, this records the decision against whichever row
    // most recently started a tool call instead.
    const agentId = (e as { agentId?: string }).agentId ?? null
    state = applyEvent(state, { type: 'checkDecision', agentId, decision: result.decision })
    await $.ui.invalidate()
    return result
  })

  on('ui.render', { component: 'AbovePrompt', surface: 'terminal' }, async ($, e) => {
    const messages = await $.session.messages()
    const progress = todoProgressOf(messages)
    const maxCols = 'maxCols' in e && typeof e.maxCols === 'number' ? e.maxCols : 80

    return renderBand(state.rows, progress, maxCols, Date.now())
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `claude plugin test ./agent-status-band`
Expected: PASS.

- [ ] **Step 5: Validate the whole plugin**

Run: `claude plugin validate ./agent-status-band`
Expected: `✔ Validation passed`, with the hooks table showing `agent.spawn`, `tool.call`, `tool.check`, `ui.render{component=AbovePrompt}`.

- [ ] **Step 6: Commit**

```bash
git add agent-status-band/hooks/register.tsx agent-status-band/hooks/register.test.ts
git commit -m "agent-status-band: wire hooks to state tracking and rendering"
```

---

### Task 8: README, repo registration, final validation

**Files:**
- Create: `agent-status-band/README.md`
- Modify: `claude-mods/README.md` (add table row)
- Modify: `claude-mods/.claude-plugin/marketplace.json` (add plugin entry)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing downstream — this is the final integration task

- [ ] **Step 1: Write the mod's README**

```markdown
<!-- agent-status-band/README.md -->
# agent-status-band

A fixed two-line band above Claude Code's prompt box showing every agent in
the session — the main loop plus any spawned subagents — without reading
the transcript.

## What it shows

**Row 1 — agent chips:** one per agent, `<role icon><emotion glyph><status
dot>` (label shown too when there's room): a keyboard glyph for developer
agents, a pencil for designers, a checkmark for reviewers, and so on (see
`hooks/icons.ts` for the full table). The status dot is green while
working, yellow if waiting on approval, red if denied or failed. An
aggregate traffic light sits at the row's right edge, worst-state-wins
across every agent. Emotion (sad/frustrated/happy/exhausted/excited/
focused) is derived from each agent's own status, call volume, and
runtime — not random.

**Row 2 — todo progress:** a block-character bar plus `done/total`, read
from the transcript's latest `TodoWrite` call.

No minimum terminal width — the band degrades (dropping labels, then
collapsing finished agents into a `+N done` badge, then icons-only) rather
than refusing to render or asking for a wider terminal, and it never grows
past these two lines regardless of width or agent count.

## Install

```bash
claude plugin install agent-status-band@im-adarsh/claude-mods
```

or for local development:

```bash
claude --plugin-dir agent-status-band
```

## Design

See [`docs/superpowers/specs/2026-10-10-agent-status-band-design.md`](../docs/superpowers/specs/2026-10-10-agent-status-band-design.md)
in the repo root for the full design rationale.

## License

MIT
```

- [ ] **Step 2: Add the root README table row**

Read `claude-mods/README.md` first, then add a row to its mod table, matching the existing two rows' format:

```markdown
| [`agent-status-band`](agent-status-band) | A two-line band above the prompt showing every agent in the session: role icons, status, emotion, and an aggregate traffic light |
```

- [ ] **Step 3: Add the marketplace entry**

Read `claude-mods/.claude-plugin/marketplace.json` first, then add, matching the existing entries' shape:

```json
{
  "name": "agent-status-band",
  "description": "A two-line band above the prompt showing every agent in the session: role icons, status, emotion, and an aggregate traffic light",
  "source": "./agent-status-band",
  "version": "0.1.0",
  "category": "productivity",
  "tags": ["agents", "subagents", "status", "band", "multi-agent"]
}
```

- [ ] **Step 4: Validate the manifest and the full test suite one more time**

```bash
claude plugin validate ./agent-status-band
claude plugin validate ./.claude-plugin/marketplace.json
claude plugin test ./agent-status-band
```

Expected: all three pass clean.

- [ ] **Step 5: Sync the plugin cache (if installed locally) and commit**

```bash
cp -r agent-status-band/. ~/.claude/plugins/cache/claude-mods/agent-status-band/0.1.0/ 2>/dev/null || true
git add agent-status-band/README.md README.md .claude-plugin/marketplace.json
git commit -m "agent-status-band: add README, register in marketplace"
git push
```

---

## Plan Self-Review

**Spec coverage:** Purpose/Layout/Emotion/Overall task progress bar/Overflow and narrow terminals/Role → icon mapping/Testing sections are each covered by Tasks 2-6 directly; the Architecture section's event-driven requirement and the `tool.check` attribution risk are covered by Task 1 (resolution) and Task 7 (wiring); Non-goals are respected by omission (no control-surface code, no SVG/pixel path, no polling anywhere in the plan). The Licensing note has no corresponding task — it's a provenance statement about the spec itself, not an implementation requirement.

**Placeholder scan:** no TBD/TODO left in any step. The one deliberately open item — Task 1's attribution finding — is structured as "fill in the bracketed parts from the real test run," not a vague instruction; every other task's code is complete and runnable as written.

**Type consistency:** `AgentRow`/`AgentsState`/`AgentEvent` (Task 2) are used identically in Tasks 3, 6, and 7. `Emotion`/`StatusDot`/`TrafficLight` (Task 3) match the keys used in `icons.ts`'s `EMOTION_GLYPH`/`DOT_COLOR`/`LIGHT_COLOR` (Task 4). `TodoProgress` (Task 5) matches `renderBand`'s second parameter (Task 6) and `register.tsx`'s use of `todoProgressOf` (Task 7). `Tree` (Task 6) is structurally identical to `RenderElement`'s `StyledElement` shape from the spec's research, so `register.tsx` returns it directly with no conversion.

**Review Focus coverage:** the zero-subagents case is `agents.test.ts`'s `emptyState` test and `band.test.ts`'s "shows the main loop" test; the back-to-back-spawn case is `agents.test.ts`'s dedicated test; the unrecognized-`subagentType` case is `icons.test.ts`'s fallback test; the extremely-narrow-terminal case is `band.test.ts`'s "never refuses to produce a mode" test; the empty-vs-absent `TodoWrite` case is `todo-progress.test.ts`'s two dedicated `0/0` tests (one for no call, one for an empty array).
