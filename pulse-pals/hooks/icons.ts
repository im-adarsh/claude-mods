import type { StatusDot, TrafficLight } from './derive'

export type Role = 'developer' | 'designer' | 'reviewer' | 'researcher' | 'tester' | 'planner' | 'generic'

// Role used to be drawn as a standalone dingbat (and emotion as a second
// one) beside the chip — creature.ts's pixel avatar now carries both (a
// role-colored body + topper, emotion-driven eyes), so those glyph tables
// are gone; only the status dot and aggregate light stay plain text.
export const STATUS_DOT_GLYPH = '●'
export const AGGREGATE_LIGHT_GLYPH = '◉'

export const DOT_COLOR: Record<StatusDot, string> = {
  green: 'green',
  dim: 'gray',
  red: 'red',
}

export const LIGHT_COLOR: Record<Exclude<TrafficLight, null>, string> = {
  green: 'green',
  yellow: 'yellow',
  red: 'red',
}

const ROLE_PATTERNS: Array<[RegExp, Role]> = [
  [/^brocode:swe-/, 'developer'],
  [/general-purpose/, 'developer'],
  [/frontend-design/, 'designer'],
  [/ui-ux-pro-max/, 'designer'],
  [/code-reviewer/, 'reviewer'],
  [/pr-review-toolkit/, 'reviewer'],
  [/^Explore$/, 'researcher'],
  [/understand-anything/, 'researcher'],
  [/^brocode:qa$/, 'tester'],
  [/^brocode:pm$/, 'planner'],
  [/^brocode:tpm$/, 'planner'],
]

export function roleOf(subagentType: string | null): Role {
  if (!subagentType) return 'generic'
  const match = ROLE_PATTERNS.find(([pattern]) => pattern.test(subagentType))
  return match ? match[1] : 'generic'
}
