import { test, expect } from 'claude-code/testing'
import { encodeRasterCells } from './raster'
import type { Pixel } from './raster'

function solidGrid(columns: number, pixelRows: number, color: Pixel): Pixel[][] {
  return Array.from({ length: pixelRows }, () => Array.from({ length: columns }, () => color))
}

test('encodeRasterCells produces columns*(pixelRows/2) cells as padded base64 (4 cols, 12 pixel rows -> 4*6*3*4=288 bytes -> 384 base64 chars, no padding)', ($, on) => {
  const cells = encodeRasterCells(solidGrid(4, 12, '#ff0000'), 4, 12)
  expect(cells).toHaveLength(384)
  expect(/^[A-Za-z0-9+/]+=*$/.test(cells)).toBe(true)
})

test('encodeRasterCells for a 1-column, 2-pixel-row grid (1*1*3*4=12 bytes -> 16 base64 chars)', ($, on) => {
  const cells = encodeRasterCells(solidGrid(1, 2, null), 1, 2)
  expect(cells).toHaveLength(16)
})

test('encodeRasterCells is deterministic and differs when the grid differs', ($, on) => {
  const a = encodeRasterCells(solidGrid(3, 4, '#112233'), 3, 4)
  const b = encodeRasterCells(solidGrid(3, 4, '#112233'), 3, 4)
  const c = encodeRasterCells(solidGrid(3, 4, '#332211'), 3, 4)
  expect(a).toBe(b)
  expect(a).not.toBe(c)
})

test('encodeRasterCells treats a missing row or column the same as null (see-through)', ($, on) => {
  const sparse: Pixel[][] = [['#ff0000']] // 1 row, 1 col -- rows[1] and col[1] are both out of range
  const a = encodeRasterCells(sparse, 2, 2)
  const b = encodeRasterCells([['#ff0000', null], [null, null]], 2, 2)
  expect(a).toBe(b)
})
