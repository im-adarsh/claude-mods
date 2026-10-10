# agent-status-band

A fixed two-line band above Claude Code's prompt box showing every agent in
the session — the main loop plus any spawned subagents — without reading
the transcript.

## What it shows

**Row 1 — agent chips:** one per agent, `<role icon><emotion glyph><status
dot>` (label shown too when there's room): a diamond glyph for developer
agents, a pencil for designers, a checkmark for reviewers, and so on (see
`hooks/icons.ts` for the full table). For a subagent, the status dot is
green while running, dim/gray when completed, red if failed or killed. The
main-loop chip is different — it has no completed/failed state of its own
(it isn't a dispatched task the way a subagent is), so its dot instead
tracks whether it's actively mid-call right now: green while working, dim
while idle. The aggregate traffic light sits at the row's right edge and
shows yellow when any agent is waiting on approval — that distinction
can't be attributed to a specific agent per-row, so it only shows at the
aggregate level (see the design spec for details). Emotion (sad/
frustrated/happy/exhausted/excited/focused) is derived from each agent's
own status, call volume, and runtime — not random.

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
