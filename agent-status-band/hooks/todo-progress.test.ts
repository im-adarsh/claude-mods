import { describe, expect, test } from 'bun:test'
import { todoProgressOf } from './todo-progress'
import type { SessionMessageLike } from './todo-progress'

describe('todoProgressOf', () => {
  test('0/0 when no TodoWrite call has happened', () => {
    const messages: SessionMessageLike[] = [{ toolUses: [] }]
    expect(todoProgressOf(messages)).toEqual({ done: 0, total: 0 })
  })

  test('0/0 (not divide-by-zero, not confused with "no call") when the latest call has an empty todos array', () => {
    const messages: SessionMessageLike[] = [
      { toolUses: [{ tool: 'TodoWrite', input: { todos: [] } }] },
    ]
    expect(todoProgressOf(messages)).toEqual({ done: 0, total: 0 })
  })

  test('counts completed vs total from a populated list', () => {
    const messages: SessionMessageLike[] = [
      {
        toolUses: [
          {
            tool: 'TodoWrite',
            input: {
              todos: [
                { content: 'a', status: 'completed' },
                { content: 'b', status: 'completed' },
                { content: 'c', status: 'in_progress' },
                { content: 'd', status: 'pending' },
              ],
            },
          },
        ],
      },
    ]
    expect(todoProgressOf(messages)).toEqual({ done: 2, total: 4 })
  })

  test('uses only the latest TodoWrite call, ignoring earlier superseded ones', () => {
    const messages: SessionMessageLike[] = [
      { toolUses: [{ tool: 'TodoWrite', input: { todos: [{ status: 'completed' }, { status: 'pending' }] } }] },
      { toolUses: [{ tool: 'TodoWrite', input: { todos: [{ status: 'completed' }] } }] },
    ]
    expect(todoProgressOf(messages)).toEqual({ done: 1, total: 1 })
  })

  test('ignores tool uses that are not TodoWrite', () => {
    const messages: SessionMessageLike[] = [
      { toolUses: [{ tool: 'Read', input: { file_path: 'x' } }] },
    ]
    expect(todoProgressOf(messages)).toEqual({ done: 0, total: 0 })
  })
})
