# Pulse Pals

A band above Claude Code's prompt box showing every agent in the session —
the main loop plus any spawned subagents — without reading the transcript.
Formerly `agent-status-band`.

## What it shows

**Row 1 — agent chips:** one little pixel-art creature per agent, plus its
label and status dot when there's room. Each creature is real ANSI pixel
art drawn as colored terminal cells (a `Raster`, not an image file — see
"Why pixel art as text" below), 7 columns wide by 3 text rows tall (the
half-block trick doubles vertical resolution, so it's a 7×6 logical pixel
grid).

- **Role** is the creature's color and topper: a gold crown for the main
  loop, a little antenna for developers, a flower for designers, a check
  for reviewers, a monocle for researchers, antennae for testers, a flag
  for planners, a plain dot for anything unrecognized (see `hooks/creature.ts`
  for the full table). The label text still spells the role out too.
- **Emotion** (sad / frustrated / happy / exhausted / excited / focused) is
  baked into the same face — different eyes and mouth, not a separate
  glyph — and is derived from the agent's own status, call volume and
  runtime (`hooks/derive.ts`), never random.
- Every creature blinks every few seconds, out of phase per agent so a row
  of several chips never blinks in unison.
- The status dot is green while running, dim/gray when completed, red if
  failed or killed. The main-loop chip has no completed/failed state of its
  own (it isn't a dispatched task the way a subagent is), so its dot
  instead tracks whether it's actively mid-call: green while working, dim
  while idle.
- The aggregate traffic light sits at the row's right edge and turns yellow
  when any agent is waiting on approval — that signal can't be attributed
  to one specific agent (`tool.check`'s event carries no per-agent id), so
  it only ever shows at the aggregate level, never on an individual dot.

**Row 2 — the pulse bar:** a hairline (~2px, drawn with the one-eighth
block character) that always has something to say: `idle`, `working…`
(a segment sweeps back and forth), `waiting on you` (solid amber the
moment a tool call needs approval), or `done` (solid green, fading back to
idle a few seconds after the turn completes). The todo fraction, read from
the transcript's latest `TodoWrite` call, rides along on the same row when
there are any — it no longer sits alone as a bare `0/0` on a session with
no todos.

No minimum terminal width — the band degrades (dropping labels, then
collapsing finished agents into a `+N done` badge, then icons-only, which
still keeps each creature's color/accessory/emotion) rather than refusing
to render or asking for a wider terminal.

## Why pixel art as text

Real image protocols (`Image`, sixel/kitty-style) only paint over cells on
a handful of terminals (kitty, Ghostty, iTerm2, WezTerm, foot) and draw
nothing (well, dim `alt` text) everywhere else. `Raster` cells are plain
glyph + foreground + background — ordinary ANSI/truecolor text — so the
same pixel art renders identically on any terminal with color support, no
graphics-protocol dependency. It's also why role and emotion are drawn as
colors and shapes rather than Unicode dingbats: a previous version used a
rare glyph for emotion that tofu'd in thinner terminal fonts.

## Install

```bash
claude plugin install pulse-pals@im-adarsh/claude-mods
```

or for local development:

```bash
claude --plugin-dir pulse-pals
```

## Design

See [`docs/superpowers/specs/2026-10-10-agent-status-band-design.md`](../docs/superpowers/specs/2026-10-10-agent-status-band-design.md)
in the repo root for the original design rationale, and the published
design canvas (linked in the PR/commit that introduced the pixel-art
rework) for the avatar system.

## License

MIT
