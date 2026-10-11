import { test, expect } from 'claude-code/testing'
import {
  officerGrid,
  lightGrid,
  encodeRasterCells,
  OFFICER_COLUMNS,
  LIGHT_COLUMNS,
  TEXT_ROWS,
} from './officer'

test('officerGrid is always 4 pixel rows (2 text rows) by OFFICER_COLUMNS wide', ($, on) => {
  const g = officerGrid('idle', false)
  expect(g).toHaveLength(4)
  for (const row of g) expect(row).toHaveLength(OFFICER_COLUMNS)
  expect(TEXT_ROWS).toBe(2)
  expect(OFFICER_COLUMNS).toBe(5)
})

test('officerGrid idle: eyes closed (plain face color, not a distinct eye color)', ($, on) => {
  const idle = officerGrid('idle', false)
  const working = officerGrid('working', false)
  // column 2 (the "nose") is always plain face color; an eye column matches
  // it while idle (closed) but differs while working (open)
  expect(idle[1]?.[1]).toBe(idle[1]?.[2])
  expect(working[1]?.[1]).not.toBe(working[1]?.[2])
})

test('officerGrid waiting gets alert (bright) eyes, distinct from working\'s normal eyes', ($, on) => {
  const waiting = officerGrid('waiting', false)
  const working = officerGrid('working', false)
  expect(waiting[1]?.[1]).toBe('#ffffff')
  expect(waiting[1]?.[1]).not.toBe(working[1]?.[1])
})

test('officerGrid done reuses working\'s normal open eyes (no separate "happy" rendering at this resolution)', ($, on) => {
  const done = officerGrid('done', false)
  const working = officerGrid('working', false)
  expect(done[1]?.[1]).toBe(working[1]?.[1])
})

test('officerGrid pulse toggles the one accent pixel on/off, for idle (sleep) and waiting (alert) only', ($, on) => {
  const idleOn = officerGrid('idle', true)
  const idleOff = officerGrid('idle', false)
  expect(idleOn[0]?.[4]).not.toBe(null)
  expect(idleOff[0]?.[4]).toBe(null)

  const waitingOn = officerGrid('waiting', true)
  const waitingOff = officerGrid('waiting', false)
  expect(waitingOn[0]?.[0]).not.toBe(null)
  expect(waitingOff[0]?.[0]).toBe(null)

  // working/done never show either accent, pulse or not
  expect(officerGrid('working', true)[0]?.[0]).toBe(null)
  expect(officerGrid('working', true)[0]?.[4]).toBe(null)
})

test('officerGrid always carries the baton pixels (column 4, collar and body rows), regardless of status', ($, on) => {
  for (const status of ['idle', 'working', 'waiting', 'done'] as const) {
    const g = officerGrid(status, true)
    expect(g[2]?.[4]).not.toBe(null)
    expect(g[3]?.[4]).not.toBe(null)
  }
})

test('lightGrid lights amber while working, red while waiting, green when done, and nothing while idle', ($, on) => {
  const idle = lightGrid('idle')
  const working = lightGrid('working')
  const waiting = lightGrid('waiting')
  const done = lightGrid('done')

  // row 0 = red, row 1 = amber, row 2 = green, row 3 = bezel
  expect(waiting[0]?.[0]).not.toBe(idle[0]?.[0])
  expect(working[1]?.[0]).not.toBe(idle[1]?.[0])
  expect(done[2]?.[0]).not.toBe(idle[2]?.[0])

  // idle has none of the three lit — same dark reading as every other status's unlit ones
  expect(idle[0]?.[0]).toBe(working[0]?.[0]) // red dark in both idle and working
  expect(idle[1]?.[0]).toBe(waiting[1]?.[0]) // amber dark in both idle and waiting
  expect(idle[2]?.[0]).toBe(waiting[2]?.[0]) // green dark in both idle and waiting
})

test('lightGrid is 4 rows by 1 column', ($, on) => {
  const g = lightGrid('working')
  expect(g).toHaveLength(4)
  for (const row of g) expect(row).toHaveLength(LIGHT_COLUMNS)
  expect(LIGHT_COLUMNS).toBe(1)
})

test('encodeRasterCells produces columns*TEXT_ROWS cells as padded base64 (5 cols -> 5*2*3*4=120 bytes -> 160 base64 chars, no padding)', ($, on) => {
  const cells = encodeRasterCells(officerGrid('working', false), OFFICER_COLUMNS)
  expect(cells).toHaveLength(160)
  expect(/^[A-Za-z0-9+/]+$/.test(cells)).toBe(true)
})

test('encodeRasterCells for the 1-column light (1*2*3*4=24 bytes -> 32 base64 chars)', ($, on) => {
  const cells = encodeRasterCells(lightGrid('idle'), LIGHT_COLUMNS)
  expect(cells).toHaveLength(32)
})

test('encodeRasterCells is deterministic and differs when the grid differs', ($, on) => {
  const a = encodeRasterCells(officerGrid('idle', false), OFFICER_COLUMNS)
  const b = encodeRasterCells(officerGrid('idle', false), OFFICER_COLUMNS)
  const c = encodeRasterCells(officerGrid('waiting', false), OFFICER_COLUMNS)
  expect(a).toBe(b)
  expect(a).not.toBe(c)
})
