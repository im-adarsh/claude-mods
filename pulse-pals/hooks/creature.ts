import type { Emotion } from './derive'
import type { Role } from './icons'

/**
 * Pixel-art avatars, drawn as real terminal cells (a `Raster`), not an image
 * file: `Image` only paints over cells on kitty/Ghostty/iTerm2/WezTerm/foot
 * (see this file's header note in band.tsx) — `Raster`'s glyph-plus-two-colors
 * cells are plain ANSI/truecolor text, so they render the same everywhere a
 * terminal does 24-bit color, with no graphics-protocol dependency.
 *
 * Each pixel is a half of a cell: codepoint '▀' (upper half block) paints its
 * foreground as the top pixel and its background as the bottom one, doubling
 * vertical resolution — a 7×6 logical pixel grid becomes 7 columns × 3
 * terminal rows.
 */

export type Pixel = string | null // a '#rrggbb' hex color, or null for "see-through" (terminal's own background)

export type RoleKey = Role | 'main'

const COLS = 7
const ROWS = 6
export const CREATURE_COLUMNS = COLS
export const CREATURE_TEXT_ROWS = ROWS / 2

const EYE = '#2b2320'

type Accessory = 'crown' | 'antenna' | 'flower' | 'check' | 'glass' | 'antennae' | 'flag' | 'dot'

type RoleTheme = { body: string; foot: string; accessory: Accessory; accent: string }

// Body color + topper is the role's "species"; kept in sync with the design
// canvas's pixel-creature mockup (docs/superpowers/specs).
const ROLE_THEME: Record<RoleKey, RoleTheme> = {
  main: { body: '#d8b36b', foot: '#a8824a', accessory: 'crown', accent: '#f4e4b8' },
  developer: { body: '#8fa6b8', foot: '#66808f', accessory: 'antenna', accent: '#cfe8f2' },
  designer: { body: '#e8a9c0', foot: '#c97e9b', accessory: 'flower', accent: '#f6d4e2' },
  reviewer: { body: '#8fbf8a', foot: '#5f9a5c', accessory: 'check', accent: '#d7f0d0' },
  researcher: { body: '#7fb8b0', foot: '#548c85', accessory: 'glass', accent: '#cdede8' },
  tester: { body: '#c98a52', foot: '#9c6436', accessory: 'antennae', accent: '#3a2c1c' },
  planner: { body: '#b6a6d9', foot: '#8a77b8', accessory: 'flag', accent: '#e7def5' },
  generic: { body: '#a8a296', foot: '#7d786d', accessory: 'dot', accent: '#d6d2c6' },
}

function emptyGrid(): Pixel[][] {
  return Array.from({ length: ROWS }, () => Array<Pixel>(COLS).fill(null))
}

function paintBody(g: Pixel[][], body: string, foot: string): void {
  for (let r = 1; r <= 4; r++) {
    for (let c = 1; c <= 5; c++) {
      const row = g[r]
      if (row) row[c] = body
    }
  }
  const feet = g[5]
  if (feet) {
    feet[1] = foot
    feet[2] = foot
    feet[4] = foot
    feet[5] = foot
  }
}

function set(g: Pixel[][], r: number, c: number, color: Pixel): void {
  const row = g[r]
  if (row) row[c] = color
}

function paintAccessory(g: Pixel[][], kind: Accessory, accent: string): void {
  switch (kind) {
    case 'crown':
      set(g, 0, 2, accent); set(g, 0, 3, accent); set(g, 0, 4, accent)
      break
    case 'antenna':
      set(g, 0, 3, accent); set(g, 1, 3, accent)
      break
    case 'flower':
      set(g, 0, 2, accent); set(g, 0, 4, accent); set(g, 0, 3, '#c9507e')
      break
    case 'check':
      set(g, 0, 2, accent); set(g, 0, 4, accent)
      break
    case 'glass':
      set(g, 0, 5, accent); set(g, 1, 5, accent)
      break
    case 'antennae':
      set(g, 0, 2, accent); set(g, 0, 4, accent)
      break
    case 'flag':
      set(g, 0, 2, accent); set(g, 0, 3, accent); set(g, 0, 4, accent)
      break
    case 'dot':
      set(g, 0, 3, accent)
      break
  }
}

function paintEmotion(g: Pixel[][], emotion: Emotion, body: string): void {
  switch (emotion) {
    case 'happy':
      set(g, 2, 2, EYE); set(g, 2, 4, EYE); set(g, 4, 3, '#f4e4b8')
      break
    case 'excited':
      set(g, 2, 2, '#ffffff'); set(g, 2, 4, '#ffffff'); set(g, 0, 0, '#ffd866'); set(g, 0, 6, '#ffd866')
      break
    case 'focused':
      set(g, 2, 2, EYE); set(g, 2, 4, EYE)
      break
    case 'exhausted':
      set(g, 2, 2, '#6b6356'); set(g, 2, 4, '#6b6356')
      break
    case 'frustrated':
      set(g, 1, 2, EYE); set(g, 1, 4, EYE); set(g, 2, 2, body); set(g, 2, 4, body); set(g, 4, 3, EYE)
      break
    case 'sad':
      set(g, 2, 2, EYE); set(g, 2, 4, EYE); set(g, 3, 2, '#6fa8d8'); set(g, 4, 3, EYE)
      break
  }
}

// Closing the eyes overrides whatever the emotion painted there, leaving any
// brow/mouth accent (which lives on different rows) alone — a blink reads as
// a brief animation on top of the current mood, not a mood change.
function closeEyes(g: Pixel[][], body: string): void {
  set(g, 2, 1, EYE); set(g, 2, 5, EYE)
  set(g, 2, 2, body); set(g, 2, 4, body)
}

export function creatureGrid(role: RoleKey, emotion: Emotion, blinking: boolean): Pixel[][] {
  const theme = ROLE_THEME[role]
  const g = emptyGrid()
  paintBody(g, theme.body, theme.foot)
  paintAccessory(g, theme.accessory, theme.accent)
  paintEmotion(g, emotion, theme.body)
  if (blinking) closeEyes(g, theme.body)
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

// Encodes a 7x6 pixel grid as RasterProps['cells']: row-major base64 of
// columns*rows little-endian u32 [codePoint, foreground, background]
// triplets, packing two pixel rows into one text row via the half-block
// glyph (see this file's header comment).
export function creatureRasterCells(grid: Pixel[][]): string {
  const words = new Uint32Array(COLS * CREATURE_TEXT_ROWS * 3)
  let i = 0
  for (let textRow = 0; textRow < CREATURE_TEXT_ROWS; textRow++) {
    const top = grid[textRow * 2]
    const bottom = grid[textRow * 2 + 1]
    for (let c = 0; c < COLS; c++) {
      words[i++] = UPPER_HALF_BLOCK
      words[i++] = colorWord(top ? top[c] ?? null : null)
      words[i++] = colorWord(bottom ? bottom[c] ?? null : null)
    }
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
