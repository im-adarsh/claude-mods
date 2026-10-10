import type { Emotion, StatusDot, TrafficLight } from './derive'

export type Role = 'developer' | 'designer' | 'reviewer' | 'researcher' | 'tester' | 'planner' | 'generic'

export const MAIN_LOOP_ICON = '◆'

export const ROLE_ICON: Record<Role, string> = {
  // '⌨' (keyboard) and '⚗' (alembic) can render as emoji or double-width in
  // some terminal/font combinations, against the project's no-emoji,
  // single-cell rule. '◈' and '◎' are plain text-presentation glyphs from
  // the same geometric/dingbat blocks as the rest of this table.
  developer: '◈',
  designer: '✎',
  reviewer: '✓',
  researcher: '⌕',
  tester: '◎',
  planner: '☰',
  generic: '◇',
}

export const EMOTION_GLYPH: Record<Emotion, string> = {
  sad: '⌢',
  frustrated: '≠',
  happy: '⌣',
  exhausted: '≈',
  excited: '✦',
  focused: '·',
}

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
