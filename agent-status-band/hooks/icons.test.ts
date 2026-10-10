import { test, expect } from 'claude-code/testing'
import { roleOf, ROLE_ICON, EMOTION_GLYPH } from './icons'

test('roleOf maps known brocode developer agents to the developer role', ($, on) => {
  expect(roleOf('brocode:swe-backend')).toBe('developer')
  expect(roleOf('brocode:swe-frontend')).toBe('developer')
})

test('roleOf maps design-oriented agents to the designer role', ($, on) => {
  expect(roleOf('frontend-design')).toBe('designer')
  expect(roleOf('ui-ux-pro-max')).toBe('designer')
})

test('roleOf maps review agents to the reviewer role', ($, on) => {
  expect(roleOf('pr-review-toolkit:code-reviewer')).toBe('reviewer')
})

test('roleOf maps exploration agents to the researcher role', ($, on) => {
  expect(roleOf('Explore')).toBe('researcher')
  expect(roleOf('understand-anything:architecture-analyzer')).toBe('researcher')
})

test('roleOf maps brocode:qa to the tester role', ($, on) => {
  expect(roleOf('brocode:qa')).toBe('tester')
})

test('roleOf maps planning agents to the planner role', ($, on) => {
  expect(roleOf('brocode:pm')).toBe('planner')
  expect(roleOf('brocode:tpm')).toBe('planner')
})

test('roleOf an unrecognized subagentType falls back to generic, never throws', ($, on) => {
  expect(() => roleOf('totally-unknown-agent-xyz')).not.toThrow()
  expect(roleOf('totally-unknown-agent-xyz')).toBe('generic')
})

test('roleOf null (main loop) also falls back to generic rather than throwing', ($, on) => {
  expect(roleOf(null)).toBe('generic')
})

test('icon tables cover every role and emotion with a non-empty glyph: ROLE_ICON has a non-empty entry for every Role', ($, on) => {
  const roles: Array<keyof typeof ROLE_ICON> = [
    'developer', 'designer', 'reviewer', 'researcher', 'tester', 'planner', 'generic',
  ]
  for (const role of roles) {
    expect(ROLE_ICON[role]).toBeTruthy()
    expect(ROLE_ICON[role].length).toBe(1)
  }
})

test('icon tables cover every role and emotion with a non-empty glyph: EMOTION_GLYPH has a non-empty entry for every Emotion', ($, on) => {
  const emotions: Array<keyof typeof EMOTION_GLYPH> = [
    'sad', 'frustrated', 'happy', 'exhausted', 'excited', 'focused',
  ]
  for (const emotion of emotions) {
    expect(EMOTION_GLYPH[emotion]).toBeTruthy()
    expect(EMOTION_GLYPH[emotion].length).toBe(1)
  }
})
