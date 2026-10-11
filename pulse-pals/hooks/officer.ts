import type { TurnStatus } from './turn-status'

/**
 * One officer, one traffic light — not one avatar per agent. Both are drawn
 * as real terminal cells (`Raster`), not an image file: `Image` only paints
 * over cells on kitty/Ghostty/iTerm2/WezTerm/foot, nothing everywhere else.
 * `Raster`'s glyph-plus-two-colors cells are plain ANSI/truecolor text, so
 * this renders identically on any terminal with color, no graphics-protocol
 * dependency, and — unlike the per-agent face tried before — flat
 * rectangular blocks only, never a shape a 5x2 grid can't actually draw.
 *
 * 4 pixel rows, packed into 2 terminal rows via the half-block glyph ('▀':
 * foreground = the top pixel of each pair, background = the bottom one).
 */

export type Pixel = string | null // '#rrggbb', or null for "see-through" (terminal's own background)

export const OFFICER_COLUMNS = 5
export const LIGHT_COLUMNS = 1
export const TEXT_ROWS = 2

const NAVY = '#1f2733'
const SKIN = '#d9a679'
const GOLD = '#e3b341'
const EYE_OPEN = NAVY
const EYE_ALERT = '#ffffff'
const SLEEP_ACCENT = '#6fa8d8'
const ALERT_ACCENT = '#f85149'
const BATON = '#5c4027'

// cap / face / collar / body+badge, plus a baton held at the side (column 4,
// always free of any status accent, which only ever touches column 0 or the
// cap row) — the officer's constant shape; only the eyes and one corner
// accent pixel change with status.
function officerBase(): Pixel[][] {
  return [
    [null, NAVY, NAVY, NAVY, null],
    [null, SKIN, SKIN, SKIN, null],
    [null, NAVY, NAVY, NAVY, BATON],
    [null, NAVY, GOLD, NAVY, BATON],
  ]
}

// `pulse` makes the one accent pixel (the sleeping "z", the waiting alert)
// blink on and off every animation tick, instead of a flat always-on dot —
// a little more alive without needing a face that can actually blink.
export function officerGrid(status: TurnStatus, pulse: boolean): Pixel[][] {
  const g = officerBase()
  const face = g[1]
  const cap = g[0]
  if (!face || !cap) return g

  if (status === 'idle') {
    // Eyes closed: the default (both already plain face color) needs no
    // change — only the sleep accent, top-right corner.
    cap[4] = pulse ? SLEEP_ACCENT : null
  } else if (status === 'waiting') {
    face[1] = EYE_ALERT
    face[3] = EYE_ALERT
    cap[0] = pulse ? ALERT_ACCENT : null
  } else {
    // working or done: normal open eyes, no accent.
    face[1] = EYE_OPEN
    face[3] = EYE_OPEN
  }
  return g
}

const DARK_RED = '#3a1414'
const DARK_AMBER = '#3a2c14'
const DARK_GREEN = '#14321a'
const LIT_RED = '#f85149'
const LIT_AMBER = '#e3b341'
const LIT_GREEN = '#3fb950'
const BEZEL = '#1a1a1a'

// red = waiting (stop, needs you), amber = working (in progress), green =
// done; idle lights nothing.
export function lightGrid(status: TurnStatus): Pixel[][] {
  return [
    [status === 'waiting' ? LIT_RED : DARK_RED],
    [status === 'working' ? LIT_AMBER : DARK_AMBER],
    [status === 'done' ? LIT_GREEN : DARK_GREEN],
    [BEZEL],
  ]
}

const TERMINAL_DEFAULT_COLOR = 0x01000000
const UPPER_HALF_BLOCK = 0x2580 // '▀'

function colorWord(pixel: Pixel): number {
  if (pixel === null) return TERMINAL_DEFAULT_COLOR
  return Number.parseInt(pixel.slice(1), 16)
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Written by hand rather than relying on the newer Uint8Array.prototype.toBase64
// (not yet in this project's configured TS lib target, and unconfirmed in
// the engine's own runtime) — standard padded base64, same output either way.
function toBase64(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const b0 = bytes[i]!
    const b1 = bytes[i + 1]!
    const b2 = bytes[i + 2]!
    out += BASE64_CHARS[b0 >> 2]
    out += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)]
    out += BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)]
    out += BASE64_CHARS[b2 & 0x3f]
  }
  const remaining = bytes.length - i
  if (remaining === 1) {
    const b0 = bytes[i]!
    out += BASE64_CHARS[b0 >> 2]
    out += BASE64_CHARS[(b0 & 0x03) << 4]
    out += '=='
  } else if (remaining === 2) {
    const b0 = bytes[i]!
    const b1 = bytes[i + 1]!
    out += BASE64_CHARS[b0 >> 2]
    out += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)]
    out += BASE64_CHARS[(b1 & 0x0f) << 2]
    out += '='
  }
  return out
}

// Encodes a `columns` x 4-pixel-row grid as RasterProps['cells']: row-major
// base64 of columns*TEXT_ROWS little-endian u32 [codePoint, foreground,
// background] triplets, packing two pixel rows into each text row (see this
// file's header comment). Shared by both the officer (5 cols) and the
// traffic light (1 col) — same packing, different width.
export function encodeRasterCells(grid: Pixel[][], columns: number): string {
  const words = new Uint32Array(columns * TEXT_ROWS * 3)
  let i = 0
  for (let textRow = 0; textRow < TEXT_ROWS; textRow++) {
    const top = grid[textRow * 2]
    const bottom = grid[textRow * 2 + 1]
    for (let c = 0; c < columns; c++) {
      words[i++] = UPPER_HALF_BLOCK
      words[i++] = colorWord(top ? top[c] ?? null : null)
      words[i++] = colorWord(bottom ? bottom[c] ?? null : null)
    }
  }
  return toBase64(new Uint8Array(words.buffer))
}
