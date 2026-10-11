import { test, expect } from 'claude-code/testing'
import {
  LIGHT_DONE_PNG_B64,
  LIGHT_IDLE_PNG_B64,
  LIGHT_WAITING_PNG_B64,
  LIGHT_WORKING_PNG_B64,
  OFFICER_DONE_PNG_B64,
  OFFICER_IDLE_PNG_B64,
  OFFICER_WAITING_PNG_B64,
  OFFICER_WORKING_PNG_B64,
} from './officer-images'

const ALL = {
  OFFICER_IDLE_PNG_B64,
  OFFICER_WORKING_PNG_B64,
  OFFICER_WAITING_PNG_B64,
  OFFICER_DONE_PNG_B64,
  LIGHT_IDLE_PNG_B64,
  LIGHT_WORKING_PNG_B64,
  LIGHT_WAITING_PNG_B64,
  LIGHT_DONE_PNG_B64,
}

// PNG magic bytes, base64: the first 8 bytes of any PNG file encode to this.
const PNG_MAGIC_B64_PREFIX = 'iVBORw0KGgo'

test('every officer and light picture is a non-empty, plain-base64 PNG', ($, on) => {
  for (const [name, value] of Object.entries(ALL)) {
    expect(value.length).toBeGreaterThan(100)
    expect(/^[A-Za-z0-9+/]+=*$/.test(value)).toBe(true)
    expect(value.startsWith(PNG_MAGIC_B64_PREFIX)).toBe(true)
  }
})

test('the 4 officer pictures are all distinct, and so are the 4 light pictures', ($, on) => {
  const officers = new Set([OFFICER_IDLE_PNG_B64, OFFICER_WORKING_PNG_B64, OFFICER_WAITING_PNG_B64, OFFICER_DONE_PNG_B64])
  const lights = new Set([LIGHT_IDLE_PNG_B64, LIGHT_WORKING_PNG_B64, LIGHT_WAITING_PNG_B64, LIGHT_DONE_PNG_B64])
  expect(officers.size).toBe(4)
  expect(lights.size).toBe(4)
})
