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

test('creatureGrid is always 6 pixel rows by 7 columns, whatever the role or emotion', ($, on) => {
  const g = creatureGrid('developer', 'focused', false)
  expect(g).toHaveLength(6)
  for (const row of g) expect(row).toHaveLength(7)
})

test('creatureGrid role sets the body color across the torso and a distinct foot color at the bottom', ($, on) => {
  const g = creatureGrid('developer', 'focused', false)
  // rows 1-4, cols 1-5 are torso; row 5 cols 1,2,4,5 are feet (col 3 is the gap between feet)
  expect(g[1]?.[1]).toBe('#8fa6b8')
  expect(g[4]?.[5]).toBe('#8fa6b8')
  expect(g[5]?.[1]).toBe('#66808f')
  expect(g[5]?.[3]).toBe(null)
})

test('creatureGrid two different roles paint different body colors and different accessory pixels', ($, on) => {
  const developer = creatureGrid('developer', 'focused', false)
  const designer = creatureGrid('designer', 'focused', false)
  expect(developer[2]?.[1]).not.toBe(designer[2]?.[1])
  // developer's antenna is a single stalk at col 3, rows 0-1; designer's flower
  // instead paints col 2 and col 4 on row 0 too.
  expect(developer[0]?.[2]).toBe(null)
  expect(designer[0]?.[2]).not.toBe(null)
})

test('creatureGrid main loop gets its own "crown" accessory, distinct from every subagent role', ($, on) => {
  const main = creatureGrid('main', 'focused', false)
  expect(main[0]?.[2]).toBe('#f4e4b8')
  expect(main[0]?.[3]).toBe('#f4e4b8')
  expect(main[0]?.[4]).toBe('#f4e4b8')
})

test('creatureGrid emotion changes the eye pixels, independent of role', ($, on) => {
  const happy = creatureGrid('tester', 'happy', false)
  const sad = creatureGrid('tester', 'sad', false)
  const excited = creatureGrid('tester', 'excited', false)
  expect(happy[2]?.[2]).toBe('#2b2320')
  expect(excited[2]?.[2]).toBe('#ffffff') // excited eyes are bright, not the usual dark dot
  expect(sad[3]?.[2]).not.toBe(happy[3]?.[2]) // sad adds a tear pixel happy/excited don't
})

test('creatureGrid blinking closes the eyes (overrides them to body color) without erasing the accessory', ($, on) => {
  const open = creatureGrid('researcher', 'happy', false)
  const blinking = creatureGrid('researcher', 'happy', true)
  expect(open[2]?.[2]).not.toBe(blinking[2]?.[2])
  // accessory lives on rows 0-1, untouched by closing the eyes on row 2
  expect(open[0]?.[5]).toBe(blinking[0]?.[5])
})

test('creatureRasterCells encodes exactly columns*rows cells as padded base64 (7 cols x 3 text rows x 3 u32 words x 4 bytes = 252 bytes -> 336 base64 chars, no padding)', ($, on) => {
  const cells = creatureRasterCells(creatureGrid('planner', 'focused', false))
  expect(CREATURE_COLUMNS).toBe(7)
  expect(CREATURE_TEXT_ROWS).toBe(3)
  expect(cells).toHaveLength(336)
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
  // the blink window (BLINK_DURATION_MS) is a small fraction of the full period
  expect(blinkingCount).toBeLessThan(samples.length / 2)
  expect(BLINK_DURATION_MS).toBeLessThan(BLINK_PERIOD_MS)
})

test('isBlinking gives different agents a different phase, so a row of chips never blinks in unison', ($, on) => {
  // 'main' happens to land in its blink window right at now=199; none of
  // these other ids do at that same instant — confirms the phase really is
  // per-id, not a global clock every chip shares.
  const now = 199
  expect(isBlinking('main', now)).toBe(true)
  expect(isBlinking('a1', now)).toBe(false)
  expect(isBlinking('a2', now)).toBe(false)
})
