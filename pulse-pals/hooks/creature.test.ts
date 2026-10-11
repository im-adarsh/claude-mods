import { test, expect } from 'claude-code/testing'
import {
  creatureGrid,
  creatureRasterCells,
  isBlinking,
  CREATURE_COLUMNS,
  CREATURE_TEXT_ROWS,
  BLINK_PERIOD_MS,
  BLINK_DURATION_MS,
} from './creature'

const FACE = '#d97757'

test('creatureGrid is always 2 pixel rows (cap, face) by 5 columns, packed into one text row', ($, on) => {
  const g = creatureGrid('developer', 'focused', false)
  expect(g).toHaveLength(2)
  expect(g[0]).toHaveLength(5)
  expect(g[1]).toHaveLength(5)
  expect(CREATURE_TEXT_ROWS).toBe(1)
})

test('creatureGrid the face itself is always Claude\'s clay color, whatever the role — only the cap differs', ($, on) => {
  for (const role of ['main', 'developer', 'designer', 'reviewer', 'researcher', 'tester', 'planner', 'generic'] as const) {
    const g = creatureGrid(role, 'focused', false)
    // column 0 is never touched by a cap or an eye, so it's always plain face.
    expect(g[1]?.[0]).toBe(FACE)
  }
})

test('creatureGrid role paints a cap on the top row; generic gets no cap at all', ($, on) => {
  const developer = creatureGrid('developer', 'focused', false)
  const generic = creatureGrid('generic', 'focused', false)
  expect(developer[0]?.[2]).not.toBe(null) // developer's single-pixel antenna, centered
  expect(generic[0]?.every(pixel => pixel === null)).toBe(true)
})

test('creatureGrid main gets a cap spanning all three middle columns, distinct from every subagent role', ($, on) => {
  const main = creatureGrid('main', 'focused', false)
  expect(main[0]?.[1]).not.toBe(null)
  expect(main[0]?.[2]).not.toBe(null)
  expect(main[0]?.[3]).not.toBe(null)

  const developer = creatureGrid('developer', 'focused', false)
  expect(developer[0]?.[1]).toBe(null) // only col 2 is capped
  expect(developer[0]?.[3]).toBe(null)
})

test('creatureGrid two roles with the same cap shape still read as different roles via cap color', ($, on) => {
  const designer = creatureGrid('designer', 'focused', false)
  const reviewer = creatureGrid('reviewer', 'focused', false)
  // both cap columns 1 and 3 (two side dots), but the color differs
  expect(designer[0]?.[1]).not.toBe(null)
  expect(reviewer[0]?.[1]).not.toBe(null)
  expect(designer[0]?.[1]).not.toBe(reviewer[0]?.[1])
})

test('creatureGrid emotion changes the eye color at columns 1 and 3 of the face row, independent of role', ($, on) => {
  const happy = creatureGrid('tester', 'happy', false)
  const excited = creatureGrid('tester', 'excited', false)
  const focused = creatureGrid('tester', 'focused', false)
  expect(excited[1]?.[1]).toBe('#ffffff') // excited eyes are bright, not the usual dark dot
  expect(happy[1]?.[1]).not.toBe(focused[1]?.[1])
  // the "nose" (column 2) is never an eye column, stays plain face either way
  expect(happy[1]?.[2]).toBe(FACE)
})

test('creatureGrid blinking closes the eyes (back to face color) without touching the cap', ($, on) => {
  const open = creatureGrid('researcher', 'happy', false)
  const blinking = creatureGrid('researcher', 'happy', true)
  expect(open[1]?.[1]).not.toBe(blinking[1]?.[1])
  expect(blinking[1]?.[1]).toBe(FACE)
  expect(open[0]).toEqual(blinking[0]) // the cap row is untouched by blinking
})

test('creatureRasterCells encodes exactly columns*rows cells as padded base64 (5 cols x 1 text row x 3 u32 words x 4 bytes = 60 bytes -> 80 base64 chars, no padding)', ($, on) => {
  const cells = creatureRasterCells(creatureGrid('planner', 'focused', false))
  expect(CREATURE_COLUMNS).toBe(5)
  expect(cells).toHaveLength(80)
  expect(/^[A-Za-z0-9+/]+$/.test(cells)).toBe(true)
})

test('creatureRasterCells is deterministic for the same grid and differs when the grid differs', ($, on) => {
  const a = creatureRasterCells(creatureGrid('generic', 'focused', false))
  const b = creatureRasterCells(creatureGrid('generic', 'focused', false))
  const c = creatureRasterCells(creatureGrid('generic', 'excited', false))
  expect(a).toBe(b)
  expect(a).not.toBe(c)
})

test('isBlinking is only true for a short window within each blink period, not most of the time', ($, on) => {
  const samples = Array.from({ length: 40 }, (_, i) => isBlinking('agent-1', i * (BLINK_PERIOD_MS / 40)))
  const blinkingCount = samples.filter(Boolean).length
  expect(blinkingCount).toBeGreaterThan(0)
  expect(blinkingCount).toBeLessThan(samples.length / 2)
  expect(BLINK_DURATION_MS).toBeLessThan(BLINK_PERIOD_MS)
})

test('isBlinking gives different agents a different phase, so a row of chips never blinks in unison', ($, on) => {
  // 'main' happens to land in its blink window right at now=199; neither of
  // these other ids do at that same instant — confirms the phase really is
  // per-id, not a global clock every chip shares.
  const now = 199
  expect(isBlinking('main', now)).toBe(true)
  expect(isBlinking('a1', now)).toBe(false)
  expect(isBlinking('a2', now)).toBe(false)
})
