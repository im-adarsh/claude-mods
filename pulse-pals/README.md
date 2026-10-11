# Pulse Pals

A band above Claude Code's prompt box: one officer and a traffic light.
Nothing else. Formerly `agent-status-band`, and formerly a per-agent
avatar design before that.

## What it shows

One row, singular — not one chip per agent, so there's no "how many fit"
problem at any width:

- **An officer** (hand-drawn bitmap PNG, drawn with `Image`, see "Why a
  real image" below). Napping (eyes closed, soft smile) while idle —
  nothing to do; normal face while working; wide alert eyes while waiting
  on your approval; a big smile when done.
- **A traffic light** beside it, same art style: amber lit while working,
  red while waiting on you, green when done, nothing lit while idle.

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

## Why a real image, not flat terminal blocks

An earlier revision drew the officer and light as a `Raster` — flat
ANSI/truecolor cells, real rectangles only, no circles or shading. It
renders identically on any terminal with color support, no
graphics-protocol dependency — but at the handful of cells a band above
the prompt can spare, it never read as more than colored blocks, and that
gap only grew clearer side by side with a detailed mockup.

This revision draws both as real bitmap PNGs instead, via `Image`
(hand-drawn with rounded shapes — cap brim, badge, star, eyebrows, cheeks —
in a Python/PIL script; not an AI-generated or 3D-rendered image, which is
out of reach without an image-generation tool, but a real picture rather
than a 20-pixel grid). The tradeoff: `Image` only paints over cells on
terminals with an image protocol (kitty, Ghostty, iTerm2, WezTerm, foot);
everywhere else it draws its `alt` text, dim, in the same place — plain
words ("officer waiting on your approval", "red light") instead of no
signal at all. Like the `Raster` it replaced, the art is fixed RGB
pixels baked into the PNG, so it doesn't adapt to light/dark mode the way
styled text does.

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
