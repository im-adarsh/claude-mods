import { test, expect } from 'claude-code/testing'
import { LIGHT_COLUMNS, LIGHT_GRID, OFFICER_COLUMNS, OFFICER_GRID, PIXEL_ROWS } from './officer-pixels'

const STATUSES = ['idle', 'working', 'waiting', 'done'] as const

test('every officer and light grid is PIXEL_ROWS tall by its own column count wide', ($, on) => {
  for (const status of STATUSES) {
    const officer = OFFICER_GRID[status]
    expect(officer).toHaveLength(PIXEL_ROWS)
    for (const row of officer) expect(row).toHaveLength(OFFICER_COLUMNS)

    const light = LIGHT_GRID[status]
    expect(light).toHaveLength(PIXEL_ROWS)
    for (const row of light) expect(row).toHaveLength(LIGHT_COLUMNS)
  }
})

test('PIXEL_ROWS is even, so it packs into whole terminal rows via the half-block trick', ($, on) => {
  expect(PIXEL_ROWS % 2).toBe(0)
})

test('the 4 officer grids are all distinct, and so are the 4 light grids', ($, on) => {
  const serialize = (g: unknown) => JSON.stringify(g)
  const officers = new Set(STATUSES.map(s => serialize(OFFICER_GRID[s])))
  const lights = new Set(STATUSES.map(s => serialize(LIGHT_GRID[s])))
  expect(officers.size).toBe(4)
  expect(lights.size).toBe(4)
})

test('every grid has at least some drawn (non-null) pixels, not a blank/transparent sheet', ($, on) => {
  for (const status of STATUSES) {
    const officerDrawn = OFFICER_GRID[status].flat().filter(p => p !== null).length
    const lightDrawn = LIGHT_GRID[status].flat().filter(p => p !== null).length
    expect(officerDrawn).toBeGreaterThan(0)
    expect(lightDrawn).toBeGreaterThan(0)
  }
})

test('waiting lights up red somewhere in the light grid that idle does not', ($, on) => {
  const isReddish = (hex: string) => {
    const r = Number.parseInt(hex.slice(1, 3), 16)
    const g = Number.parseInt(hex.slice(3, 5), 16)
    const b = Number.parseInt(hex.slice(5, 7), 16)
    return r > 180 && g < 100 && b < 100
  }
  const waitingHasRed = LIGHT_GRID.waiting.flat().some(p => p !== null && isReddish(p))
  const idleHasRed = LIGHT_GRID.idle.flat().some(p => p !== null && isReddish(p))
  expect(waitingHasRed).toBe(true)
  expect(idleHasRed).toBe(false)
})
