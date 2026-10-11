# Pulse Pals

A band above Claude Code's prompt box — one officer, one traffic light, one
colored line. Formerly `agent-status-band`, and formerly a per-agent avatar
design before that; see "Why it's one officer, not one per agent" below.

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
- **A colored rule** filling the rest of the width, the same color the
  light lights up in — gray/dim idle, amber working, red waiting, green
  done. Not a boxed frame around the band (an earlier revision wrapped the
  whole thing in a bordered box, which just read as an extra UI widget
  sitting on the prompt) — just the one line. No status text on it; the
  color alone carries it.

**Once in a while — a usage report.** For a few seconds right after each
turn finishes (the same window the rule is briefly solid green, before it
fades back to idle), the whole row swaps to a compact readout instead of
the officer: `ctx 42% · 5h 18% · $0.37` — context window fill, the
account's 5-hour rate-limit window, and the session's cost so far, read
from `$.session.usage()` (the same figures the status line has; the plain
call is free, no token-count API requests). Whatever the engine doesn't
have is left out rather than shown as a blank — on a host with no cost
ledger it's just `ctx 42% · 5h 18%`, and if none of it is available at all
the row stays the ordinary officer view instead of showing something
empty.

## Why it's one officer, not one per agent

Earlier revisions drew one small avatar per agent — a role-colored "little
Claude" face, then a thinner two-cell version — but kept running into the
same wall: however it degrades, N of them in a row either gets wide or
gets cramped, and the per-agent detail (a 5-pixel face) never read as
anything more than colored blocks at real terminal size. Going singular
(one officer, one light, representing the turn as a whole rather than any
one agent) sidesteps the whole problem: the band is a fixed width
regardless of whether the session has one agent or ten.

## Why flat blocks, no shading

Real image protocols (`Image`, sixel/kitty-style) only paint over cells on
a handful of terminals (kitty, Ghostty, iTerm2, WezTerm, foot) and draw
nothing (well, dim `alt` text) everywhere else. `Raster` cells are plain
glyph + foreground + background — ordinary ANSI/truecolor text, flat
rectangles only, no circles or shading — so it renders identically on any
terminal with color support, no graphics-protocol dependency. A fancier
CSS mockup with rounded corners and soft shadows was genuinely considered
and rejected for this reason: it would have looked nothing like what
actually ships.

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
has the mockups this went through, flat-block versions included.

## License

MIT
