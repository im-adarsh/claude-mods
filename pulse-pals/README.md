# Pulse Pals

A band above Claude Code's prompt box: one officer and a traffic light.
Nothing else. Formerly `agent-status-band`, and formerly a per-agent
avatar design before that.

## What it shows

One row, singular — not one chip per agent, so there's no "how many fit"
problem at any width:

- **An officer** (a Raster of real terminal cells, sampled from hand-drawn
  art — see "Why a sampled Raster" below). Napping (eyes closed, soft
  smile) while idle — nothing to do; normal face while working; wide alert
  eyes while waiting on your approval; a big smile when done.
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

## Why a sampled Raster, not an embedded image

A revision in between drew the officer and light as a real bitmap PNG via
the `Image` element — true art (cap brim, badge, star, eyebrows, cheeks),
hand-drawn with a Python/PIL script. But `Image` only paints over cells on
a handful of terminals (kitty, Ghostty, iTerm2, WezTerm, foot) — not Warp,
not most terminals — and the plugin SDK gives a plugin no way to detect
whether the current terminal is one of them, so there's no way to draw
`Image` only where it will actually show: everywhere else it silently
fell back to dim `alt` text, and that fallback was most people's entire
experience of this mod. Claude Code's own startup logo settles this by a
different route: colored block characters (`Raster`), not an embedded
image — the same technique renders identically on any terminal with color
support, no graphics-protocol dependency.

So this revision keeps the detail and drops the gamble: the same
hand-drawn art is downsampled (alpha-premultiplied Lanczos resize) into a
much finer `Raster` grid than the first flat-block attempt's 5x4 pixels —
11x12 for the officer, 5x12 for the light, in `officer-pixels.ts` — real
colors sampled from the real art, packed two pixel rows per terminal row
via the half-block glyph trick (`raster.ts`). It reads far closer to the
actual art than 20 flat pixels ever did, and renders everywhere the
startup logo does. Like `Image`, the baked-in colors don't adapt to
light/dark mode the way styled text does.

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
