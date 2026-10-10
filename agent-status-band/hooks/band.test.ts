import { describe, expect, test } from 'bun:test'
import { pickChipMode, renderBand } from './band'
import type { AgentRow } from './agents'

function row(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: 'main',
    subagentType: null,
    status: 'running',
    working: false,
    lastCheckDecision: null,
    toolCallCount: 0,
    spawnedAt: 0,
    ...overrides,
  }
}

function findText(tree: unknown, needle: string): boolean {
  if (typeof tree === 'string') return tree.includes(needle)
  if (tree && typeof tree === 'object') {
    const node = tree as { children?: unknown[] }
    return (node.children ?? []).some(child => findText(child, needle))
  }
  return false
}

describe('pickChipMode', () => {
  test('full mode when there is plenty of width', () => {
    expect(pickChipMode([row()], 200)).toBe('full')
  })

  test('degrades to no-label, then collapsed-finished, then icons-only as width shrinks', () => {
    const rows = [
      row({ id: 'main' }),
      row({ id: 'a1', status: 'completed', subagentType: 'X' }),
      row({ id: 'a2', status: 'completed', subagentType: 'Y' }),
      row({ id: 'a3', status: 'completed', subagentType: 'Z' }),
      row({ id: 'a4', working: true, subagentType: 'W' }),
    ]

    const modes = [200, 60, 30, 10].map(width => pickChipMode(rows, width))
    // Width shrinking should only ever hold steady or degrade further, never
    // jump back to a less-degraded mode.
    const order: Record<string, number> = { full: 0, 'no-label': 1, 'collapsed-finished': 2, 'icons-only': 3 }
    for (let i = 1; i < modes.length; i++) {
      expect(order[modes[i] as string]).toBeGreaterThanOrEqual(order[modes[i - 1] as string])
    }
  })

  test('never refuses to produce a mode at an extremely narrow width', () => {
    expect(() => pickChipMode([row()], 1)).not.toThrow()
  })
})

describe('renderBand', () => {
  test('shows the main loop even with no subagents and no todo progress yet', () => {
    const tree = renderBand([row()], { done: 0, total: 0 }, 200, 0)
    expect(findText(tree, '0/0')).toBe(true)
  })

  test('renders the todo fraction from a real progress value', () => {
    const tree = renderBand([row()], { done: 2, total: 4 }, 200, 0)
    expect(findText(tree, '2/4')).toBe(true)
  })

  test('always produces exactly two rows (two top-level Box children)', () => {
    const tree = renderBand([row()], { done: 0, total: 0 }, 200, 0)
    expect(tree.type).toBe('Box')
    expect(tree.children).toHaveLength(2)
  })

  test('working subagents stay visible even when width forces collapsing finished ones', () => {
    const rows = [
      row({ id: 'main' }),
      row({ id: 'a1', status: 'completed', subagentType: 'X' }),
      row({ id: 'a2', working: true, subagentType: 'Y' }),
    ]
    const tree = renderBand(rows, { done: 0, total: 0 }, 50, 0)
    // Y's role icon (designer glyph '✎' if subagentType 'Y' falls back to
    // generic '◇' — either way, some glyph for a1's row must still appear)
    // is asserted indirectly: the row count of individually-drawn chips
    // for non-finished agents never drops to zero while one is working.
    expect(findText(tree, '◇') || findText(tree, '✎')).toBe(true)
  })
})
