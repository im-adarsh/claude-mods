# Pulse Pals

A band above Claude Code's prompt box showing every agent in the session —
the main loop plus any spawned subagents — without reading the transcript.
Formerly `agent-status-band`.

## What it shows

One row, not two: each agent's avatar sits right at the left edge of a
single colored line that stretches the rest of the width — the avatar
reads like a little badge perched on the border, the line itself is both
that border and the progress indicator. No label text anywhere; role and
emotion are carried entirely by the avatar.

**The avatars.** Every avatar is "a little Claude" — the face is always
Anthropic's own clay accent color, one text row tall (a `Raster` of real
terminal cells, not an image file — see "Why pixel art as text" below), 5
columns wide. What varies:

- **Role** is a small colored cap on top: a cream crown for the main loop,
  a single blue dot for developers, pink side-dots for designers, green
  side-dots for reviewers, a teal dot for researchers, an amber dot for
  testers, a lavender bar for planners, no cap at all for anything
  unrecognized (see `hooks/creature.ts` for the full table).
- **Emotion** (sad / frustrated / happy / exhausted / excited / focused)
  colors the eyes, derived from the agent's own status, call volume and
  runtime (`hooks/derive.ts`), never random. Excited and frustrated also
  get a little corner spark — the two most "animated" moods get a touch
  more personality than eye color alone.
- Every avatar blinks every few seconds, out of phase per agent so a row of
  several chips never blinks in unison — and it's reliably visible: the
  band redraws itself on its own twice a second, not only when a tool call
  happens to trigger a redraw.
- The status dot (dropped at the narrowest widths) is green while running,
  dim/gray when completed, red if failed or killed. The main-loop chip has
  no completed/failed state of its own (it isn't a dispatched task the way
  a subagent is), so its dot instead tracks whether it's actively mid-call:
  green while working, dim while idle.
- The aggregate traffic light sits at the far right and turns yellow when
  any agent is waiting on approval — that signal can't be attributed to one
  specific agent (`tool.check`'s event carries no per-agent id), so it only
  ever shows at the aggregate level, never on an individual dot.

**The rule.** Not a boxed frame around the band (an earlier revision
wrapped the whole thing in a bordered box, which just read as an extra UI
widget sitting on top of the prompt) — one colored horizontal line, doing
double duty as both the "border" and the progress indicator. It always has
something to say: idle (dim gray), `working…` (cyan, a brighter segment
sweeping back and forth), `waiting on you` (solid amber the moment a tool
call needs approval), or `done` (solid green, fading back to idle a few
seconds after the turn completes). The todo fraction, read from the
transcript's latest `TodoWrite` call, rides along at the end when there are
any — it no longer sits alone as a bare `0/0` on a session with no todos.

No minimum terminal width — the band degrades (collapsing finished agents
into a `+N done` badge, then icons-only, which still keeps each avatar's
cap color and emotion) rather than refusing to render or asking for a
wider terminal.

## Why pixel art as text

Real image protocols (`Image`, sixel/kitty-style) only paint over cells on
a handful of terminals (kitty, Ghostty, iTerm2, WezTerm, foot) and draw
nothing (well, dim `alt` text) everywhere else. `Raster` cells are plain
glyph + foreground + background — ordinary ANSI/truecolor text — so the
same pixel art renders identically on any terminal with color support, no
graphics-protocol dependency. It's also why role and emotion are drawn as
colors rather than Unicode dingbats: an earlier version used a rare glyph
for emotion that tofu'd in thinner terminal fonts, and an earlier
pixel-avatar revision was a 7×6, 3-text-row creature that read as too
heavy/blocky in a real terminal — this one is deliberately a single text
row.

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
