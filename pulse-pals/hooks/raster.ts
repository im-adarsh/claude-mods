/**
 * Encodes a pixel grid (real RGB colors, sampled from actual art or
 * hand-drawn) as `RasterProps['cells']`: real terminal cells, ordinary
 * ANSI/truecolor text — flat rectangles only, no circles or shading, but
 * rendering identically on any terminal with color support, no
 * graphics-protocol dependency (unlike `Image`, which only paints over
 * cells on a handful of terminals and draws nothing elsewhere).
 *
 * Packs 2 pixel rows into 1 terminal row via the half-block glyph ('▀':
 * foreground = the top pixel of each pair, background = the bottom one).
 */

export type Pixel = string | null // '#rrggbb', or null for "see-through" (terminal's own background)

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

// Encodes a `columns` x `pixelRows`-pixel-row grid as RasterProps['cells']:
// row-major base64 of columns*(pixelRows/2) little-endian u32 [codePoint,
// foreground, background] triplets, packing two pixel rows into each text
// row (see this file's header comment). `pixelRows` must be even.
export function encodeRasterCells(grid: Pixel[][], columns: number, pixelRows: number): string {
  const textRows = pixelRows / 2
  const words = new Uint32Array(columns * textRows * 3)
  let i = 0
  for (let textRow = 0; textRow < textRows; textRow++) {
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
