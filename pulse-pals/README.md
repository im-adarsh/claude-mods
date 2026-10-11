# Pulse Pals

A band above Claude Code's prompt box: one officer and a traffic light.
Nothing else. Formerly `agent-status-band`, and formerly a per-agent
avatar design before that.

## What it shows

One row, singular — not one chip per agent, so there's no "how many fit"
problem at any width:

- **An officer** (5 columns, 2 text rows, flat colored blocks — a `Raster`
  of real terminal cells, not an image file, see "Why flat blocks" below).
  Cap, badge and baton stay constant; only the eyes and one accent pixel
  change: closed eyes + a pale blue "z" accent while idle (nothing to do —
  napping), normal open eyes while working, wide white alert eyes + a red
  accent while waiting on your approval. The accent pixel blinks on a timer
  so it's reliably visible, not just on an incidental redraw.
- **A traffic light** beside it (1 column, same height): amber lit while
  working, red while waiting on you, green when done, nothing lit while
  idle.

That's the whole band. No box, no border, no status text, no usage
report, no per-agent breakdown — those were all tried, in various
combinations, and dropped. The officer and the light are the entire
signal.

## Why this isn't the real prompt box's border

Earlier revisions wrapped the officer and light in a bordered box, colored
by status, trying to approximate "the prompt box's border changes color."
**The real prompt box's own border cannot be recolored by a plugin** — its
color is a theme value (`promptBorder`), not something any hook can touch
per render — so that box was never the real thing, just a separate strip
drawn above it. It read as clutter rather than signal and is gone now.

## Why it's one officer, not one per agent

Earlier revisions drew one small avatar per agent — but however that
degrades, N of them in a row either gets wide or gets cramped, and
per-agent detail never read as more than colored blocks at real terminal
size. Going singular (one officer, one light, representing the turn as a
whole) sidesteps the problem entirely: fixed width regardless of whether
the session has one agent or ten.

## Why flat blocks, no shading

Real image protocols (`Image`, sixel/kitty-style) only paint over cells on
a handful of terminals (kitty, Ghostty, iTerm2, WezTerm, foot) and draw
nothing (well, dim `alt` text) everywhere else. `Raster` cells are plain
glyph + foreground + background — ordinary ANSI/truecolor text, flat
rectangles only, no circles or shading — so it renders identically on any
terminal with color support, no graphics-protocol dependency. It's also
why the officer can't adapt to light/dark mode the way styled text does:
`Raster` cells are fixed RGB pixels, not theme-aware.

## Install

```bash
claude plugin install pulse-pals@im-adarsh/claude-mods
```

or for local development:

```bash
claude --plugin-dir pulse-pals
```

## Design

The published design canvas (linked in the commits that built this)
has the mockups this went through.

## License

MIT
