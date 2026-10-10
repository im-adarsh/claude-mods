import { describe, expect, test } from 'bun:test'
import { roleOf, ROLE_ICON, EMOTION_GLYPH } from './icons'

describe('roleOf', () => {
  test('maps known brocode developer agents to the developer role', () => {
    expect(roleOf('brocode:swe-backend')).toBe('developer')
    expect(roleOf('brocode:swe-frontend')).toBe('developer')
  })

  test('maps design-oriented agents to the designer role', () => {
    expect(roleOf('frontend-design')).toBe('designer')
    expect(roleOf('ui-ux-pro-max')).toBe('designer')
  })

  test('maps review agents to the reviewer role', () => {
    expect(roleOf('pr-review-toolkit:code-reviewer')).toBe('reviewer')
  })

  test('maps exploration agents to the researcher role', () => {
    expect(roleOf('Explore')).toBe('researcher')
    expect(roleOf('understand-anything:architecture-analyzer')).toBe('researcher')
  })

  test('maps brocode:qa to the tester role', () => {
    expect(roleOf('brocode:qa')).toBe('tester')
  })

  test('maps planning agents to the planner role', () => {
    expect(roleOf('brocode:pm')).toBe('planner')
    expect(roleOf('brocode:tpm')).toBe('planner')
  })

  test('an unrecognized subagentType falls back to generic, never throws', () => {
    expect(() => roleOf('totally-unknown-agent-xyz')).not.toThrow()
    expect(roleOf('totally-unknown-agent-xyz')).toBe('generic')
  })

  test('null (main loop) also falls back to generic rather than throwing', () => {
    expect(roleOf(null)).toBe('generic')
  })
})

describe('icon tables cover every role and emotion with a non-empty glyph', () => {
  test('ROLE_ICON has a non-empty entry for every Role', () => {
    const roles: Array<keyof typeof ROLE_ICON> = [
      'developer', 'designer', 'reviewer', 'researcher', 'tester', 'planner', 'generic',
    ]
    for (const role of roles) {
      expect(ROLE_ICON[role]).toBeTruthy()
      expect(ROLE_ICON[role].length).toBe(1)
    }
  })

  test('EMOTION_GLYPH has a non-empty entry for every Emotion', () => {
    const emotions: Array<keyof typeof EMOTION_GLYPH> = [
      'sad', 'frustrated', 'happy', 'exhausted', 'excited', 'focused',
    ]
    for (const emotion of emotions) {
      expect(EMOTION_GLYPH[emotion]).toBeTruthy()
      expect(EMOTION_GLYPH[emotion].length).toBe(1)
    }
  })
})
