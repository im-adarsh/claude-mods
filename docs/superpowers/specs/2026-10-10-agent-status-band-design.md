# agent-status-band — design spec

**Status:** approved (chat design), pending written-spec review
**Date:** 2026-10-10

## Purpose

A Claude Code mod that shows, at a glance, what every agent in the current
session is doing — the main loop plus any spawned subagents — without
reading the transcript. A single compact row pinned above the prompt box:
one icon chip per agent (role-specific icon + a status dot), plus one
aggregate traffic light summarizing the whole session's state.

Audience: the user themselves, during multi-agent sessions (subagent
dispatch, parallel forks, teammate-style loops) where it's otherwise hard to
tell who's doing what, and whether anything needs their attention, without
scrolling.

## Non-goals

- Not a replacement for Claude Code's own built-in agent progress rows in
  the transcript (those stay; this is a separate, persistent summary band).
- Not a control surface — no click-to-approve, click-to-kill, etc. in v1.
  Read-only visibility.
- Not pixel/SVG rendering — this targets the terminal surface specifically
  (character-based `ui.render`), not the desktop app's pixel canvas.

## Architecture

Fully event-driven — no polling. Every piece of state the band needs is
announced by a hook (unlike `diff`, which has to poll git's HEAD because
external git state has no announcing hook):

| Signal | Source |
|---|---|
| A new agent appears | `agent.spawn` (and/or diffing `$.agent.list()` after it) |
| An agent is actively working | `tool.call` with `e.agentId` set (in flight) |
| An agent finished / failed / was killed | `AgentInfo.status` (`running`\|`completed`\|`failed`\|`killed`) from `$.agent.list()` |
| An agent's call needs approval / was denied | `tool.check`'s returned `decision` (`allow`\|`ask`\|`deny`) |

The mod keeps one in-memory row per tracked agent (main-loop chip always
first, then one per live entry from `$.agent.list()` in spawn order),
rebuilt on the relevant hooks, and re-renders the band via `ui.render` —
same pattern `diff`'s `Pane` uses for its panel, but a single row.

### Open technical risk — `tool.check` agent attribution

`ToolCallInput` is typed as `ToolCallEnvelope & AgentLoop` (carries
`agentId`). `ToolCheckInput` is typed as just `{ tool, input, tool_use_id }`
— no `AgentLoop` merged in, based on the type declarations inspected
(`mods/types/claude-code.d.ts` in `anthropics/claude-code`, read-only,
behavior described here but not copied — see licensing note below). This
means per-agent attribution of an `ask`/`deny` verdict may not be directly
available from the `tool.check` payload.

**This must be verified experimentally before the per-chip dot feature is
built**, as the first implementation task. Two fallback strategies if
`tool.check` truly carries no agent identity:

1. Correlate via `tool_use_id` against the *next* `tool.call` for that id
   (if `tool.call` fires after the check resolves `allow`, the id lets us
   backfill which agent it was — but an `ask`/`deny` has no following
   `tool.call` to correlate against, so this only helps the `allow` case).
2. Heuristic fallback: attribute a pending `ask`/`deny` to whichever
   tracked agent most recently had `tool.call` activity. Imprecise when
   multiple agents are concurrently mid-call, but simple and likely right
   most of the time (subagents rarely interleave individual tool calls at
   sub-second granularity).
3. If neither holds up, degrade gracefully: keep the per-chip dot green/dim
   only (working vs idle vs done, no red/yellow distinction per chip), and
   rely on the aggregate light — which doesn't need per-agent attribution,
   just "has anything, anywhere, hit ask/deny right now" — for the
   red/yellow signal. This is an acceptable fallback, not a blocker for
   shipping v1, and should be the explicit decision if attribution can't be
   made to work.

## Layout

One `ui.render` row, full terminal width, pinned above the prompt box
(same general placement class as the existing usage band other mods use).

Per chip: `<role icon><emotion glyph><short label><status dot>`.

- Main-loop chip is always present and first, even when no subagents are
  spawned (confirmed: band is never empty once a session starts).
- One chip per live subagent, in spawn order, for the lifetime of the
  session (not removed on completion — folded per Overflow below).
- No emoji. Single-cell glyphs, in the style of claude-skins'
  `ICONS` convention (`○ ● ✕ ◌`) — proven legible at terminal density,
  and consistent with how other mods in this ecosystem already draw
  status.
- Status dot color: green = working or idle-ok, yellow = this agent's own
  pending `ask`, red = this agent's own `deny`/`failed`/`killed` — subject
  to the attribution risk above; may degrade to a binary (colored/dim)
  treatment if attribution doesn't hold up.
- Trailing aggregate traffic light at the row's right edge: worst-state-
  wins across every tracked agent — any red → red; else any yellow →
  yellow; else all settled → green. Absent (no light drawn) when nothing
  has been spawned and the main loop is idle.

## Emotion

A fourth chip element, derived from signals the band already tracks — not
random, not decorative-only. A small deterministic precedence ladder,
evaluated per agent on every re-render (highest-priority matching rule
wins):

| Priority | Condition | Emotion |
|---|---|---|
| 1 | Status `failed` or `killed` | sad |
| 2 | Most recent `tool.check` was `deny` (status still `running`) | frustrated |
| 3 | Status `completed` | happy |
| 4 | Still `running`, and tool-call count or elapsed time since spawn exceeds a threshold (exact numbers set during implementation — start around 15 calls / 5 minutes and tune) | exhausted |
| 5 | Still `running`, within the first tool call or two of spawning | excited |
| 6 | Still `running`, none of the above | focused (default/neutral) |

Same signals already powering the status dot and aggregate light (`tool.check`
decisions, `AgentInfo.status`, `tool.call` activity) — no new data source
needed. Inherits the same attribution risk noted above for `deny`
specifically (priority 2); the exhausted/excited/focused states don't
depend on that risk at all, since they're driven by `AgentInfo.status` and
`tool.call` volume/timing, both of which are confirmed available per-agent.

Each emotion maps to its own small unicode glyph (exact glyph choices
finalized during implementation, same no-emoji convention as the rest of
the band) — no color coding of its own; emotion is a separate signal from
the status dot's color, shown alongside it, not blended into it.

## Overflow

When chips would exceed terminal width: every `working` (actively mid-call)
chip stays visible — that's the band's whole point. Finished chips
(`completed`/`failed`/`killed`) collapse into a trailing `+N done` badge
once space runs out, oldest-finished collapsing first.

## Role → icon mapping

Built-in table, keyed by `subagentType` (the string `$.agent.list()` and
`agent.spawn` carry), covering what's actually installed in this user's own
plugin set — not an attempt to anticipate every possible subagent name
system-wide. A handful of representative entries (full table finalized
during implementation, against the user's actual installed agents):

| `subagentType` pattern | Role | Icon (unicode glyph, TBD exact choice) |
|---|---|---|
| `brocode:swe-*`, `general-purpose` (when coding) | developer | code-ish glyph |
| `frontend-design`, `ui-ux-pro-max` | designer | palette-ish glyph |
| `pr-review-toolkit:*`, `*code-reviewer*` | reviewer | check/magnifier-ish glyph |
| `Explore`, `understand-anything:*` | researcher | magnifier-ish glyph |
| `brocode:qa` | tester | flask-ish glyph |
| `brocode:pm`, `brocode:tpm` | planner | checklist-ish glyph |
| unrecognized | generic | dot/placeholder glyph |

Main-loop chip gets its own fixed icon (distinct from any role), since it's
not a `subagentType` entry at all — but it's a chip like any other
otherwise: it still gets a status dot and an emotion glyph, computed the
same way, using `tool.call` events where `e.agentId` is `undefined` (the
same signal `diff`'s `register.ts` uses to detect a main-loop edit) as its
"working" signal, since the main loop has no `AgentInfo` entry of its own
to read status from.

## Testing

Same convention as the repo's other TS mods: `hooks/*.test.ts` beside the
hook it covers, run via `claude plugin test ./agent-status-band`. Key cases:

- Band shows only the main-loop chip with no subagents spawned.
- A spawned subagent gets the correct role icon from its `subagentType`.
- An unrecognized `subagentType` falls back to the generic icon, not a
  crash or blank chip.
- `tool.call` activity toggles a chip's working indicator; `AgentInfo`
  status transitions update it to done/failed/killed.
- Aggregate light reflects worst-state-wins correctly across multiple
  concurrent agents in different states.
- Overflow collapses finished chips before truncating working ones.
- Emotion precedence ladder: each rule fires under the right condition and
  higher-priority rules correctly pre-empt lower ones (e.g. a `failed`
  agent shows sad even if it also had a long runtime that would otherwise
  read as exhausted).
- Whatever the `tool.check` attribution resolution turns out to be (full
  per-chip color, or the degraded binary fallback), it's covered by a test
  that pins down which behavior actually shipped.

## Licensing note

This spec is written from the user's own feature request plus
publicly-readable *type declarations* (`mods/types/claude-code.d.ts`) and
*behavior descriptions* (mod READMEs) in `anthropics/claude-code`, which
carries no open-source license (see prior licensing discussion in this
project). No source code from that repo is copied here — only the shape of
its documented hook event contract, which is necessary, factual
information about the platform API this mod is written against, not
Anthropic's own implementation. This mod's own implementation is original.
