import type { Emotion } from './derive'
import type { Role } from './icons'

/**
 * Tiny avatars, drawn as real terminal cells (a `Raster`), not an image
 * file: `Image` only paints over cells on kitty/Ghostty/iTerm2/WezTerm/foot,
 * nothing everywhere else. `Raster`'s glyph-plus-two-colors cells are plain
 * ANSI/truecolor text, so they render the same everywhere a terminal does
 * 24-bit color, with no graphics-protocol dependency.
 *
 * Every agent is "a little Claude": the face is always Anthropic's own clay
 * accent, the same one regardless of role — what differs is a small colored
 * cap on top (role) and the eye color (emotion). One pixel row, packed into
 * one terminal cell via the half-block glyph ('▀': foreground = the cap
 * pixel, background = the face pixel) — a single text row, not a multi-row
 * creature, so it sits inline with the label instead of towering over it.
 */

export type Pixel = string | null // a '#rrggbb' hex color, or null for "see-through" (terminal's own background)

export type RoleKey = Role | 'main'

const COLS = 5
export const CREATURE_COLUMNS = COLS
export const CREATURE_TEXT_ROWS = 1

// Anthropic's clay accent — the one color every avatar shares, so the whole
// row reads as "Claude" first and role/emotion second.
const FACE = '#d97757'
const EYE_DEFAULT = '#2b2320'

type CapShape = ReadonlyArray<number> // which of columns 0-4 the cap paints

const CAP_SHAPE: Record<RoleKey, CapShape> = {
  main: [1, 2, 3],
  developer: [2],
  designer: [1, 3],
  reviewer: [1, 3],
  researcher: [3],
  tester: [1],
  planner: [1, 2],
  generic: [],
}

const CAP_COLOR: Record<RoleKey, string> = {
  main: '#f4e4b8',
  developer: '#8fa6b8',
  designer: '#e8a9c0',
  reviewer: '#8fbf8a',
  researcher: '#7fb8b0',
  tester: '#c98a52',
  planner: '#b6a6d9',
  generic: '#a8a296',
}

const EYE_COLOR: Record<Emotion, string> = {
  happy: '#f4e4b8',
  excited: '#ffffff',
  focused: EYE_DEFAULT,
  exhausted: '#6b6356',
  frustrated: '#c85c3a',
  sad: '#6fa8d8',
}

function emptyGrid(): Pixel[][] {
  return [Array<Pixel>(COLS).fill(null), Array<Pixel>(COLS).fill(FACE)]
}

function paintCap(g: Pixel[][], role: RoleKey): void {
  const top = g[0]
  if (!top) return
  for (const col of CAP_SHAPE[role]) top[col] = CAP_COLOR[role]
}

// Eyes sit at columns 1 and 3 of the face row; column 2 ("the nose") and the
// two edge columns stay plain face color.
function paintEyes(g: Pixel[][], emotion: Emotion): void {
  const face = g[1]
  if (!face) return
  const color = EYE_COLOR[emotion]
  face[1] = color
  face[3] = color
}

function closeEyes(g: Pixel[][]): void {
  const face = g[1]
  if (!face) return
  face[1] = FACE
  face[3] = FACE
}

export function creatureGrid(role: RoleKey, emotion: Emotion, blinking: boolean): Pixel[][] {
  const g = emptyGrid()
  paintCap(g, role)
  paintEyes(g, emotion)
  if (blinking) closeEyes(g)
  return g
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

// Encodes the 5x2 pixel grid as RasterProps['cells']: row-major base64 of
// columns*rows little-endian u32 [codePoint, foreground, background]
// triplets, packing both pixel rows into one text row via the half-block
// glyph (see this file's header comment).
export function creatureRasterCells(grid: Pixel[][]): string {
  const words = new Uint32Array(COLS * CREATURE_TEXT_ROWS * 3)
  const top = grid[0]
  const bottom = grid[1]
  let i = 0
  for (let c = 0; c < COLS; c++) {
    words[i++] = UPPER_HALF_BLOCK
    words[i++] = colorWord(top ? top[c] ?? null : null)
    words[i++] = colorWord(bottom ? bottom[c] ?? null : null)
  }
  return toBase64(new Uint8Array(words.buffer))
}

export const BLINK_PERIOD_MS = 4000
export const BLINK_DURATION_MS = 220

// A simple string hash gives each agent a stable, different phase so a row
// of several chips doesn't blink in unison.
function phaseOffset(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return hash % BLINK_PERIOD_MS
}

export function isBlinking(id: string, now: number): boolean {
  const t = (now + phaseOffset(id)) % BLINK_PERIOD_MS
  return t < BLINK_DURATION_MS
}
