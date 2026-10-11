import { test, expect } from 'claude-code/testing'
import { todoProgressOf } from './todo-progress'
import type { SessionMessageLike } from './todo-progress'

test('todoProgressOf 0/0 when no TodoWrite call has happened', ($, on) => {
  const messages: SessionMessageLike[] = [{ toolUses: [] }]
  expect(todoProgressOf(messages)).toEqual({ done: 0, total: 0 })
})

test('todoProgressOf 0/0 (not divide-by-zero, not confused with "no call") when the latest call has an empty todos array', ($, on) => {
  const messages: SessionMessageLike[] = [
    { toolUses: [{ tool: 'TodoWrite', input: { todos: [] } }] },
  ]
  expect(todoProgressOf(messages)).toEqual({ done: 0, total: 0 })
})

test('todoProgressOf counts completed vs total from a populated list', ($, on) => {
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

test('todoProgressOf uses only the latest TodoWrite call, ignoring earlier superseded ones', ($, on) => {
  const messages: SessionMessageLike[] = [
    { toolUses: [{ tool: 'TodoWrite', input: { todos: [{ status: 'completed' }, { status: 'pending' }] } }] },
    { toolUses: [{ tool: 'TodoWrite', input: { todos: [{ status: 'completed' }] } }] },
  ]
  expect(todoProgressOf(messages)).toEqual({ done: 1, total: 1 })
})

test('todoProgressOf ignores tool uses that are not TodoWrite', ($, on) => {
  const messages: SessionMessageLike[] = [
    { toolUses: [{ tool: 'Read', input: { file_path: 'x' } }] },
  ]
  expect(todoProgressOf(messages)).toEqual({ done: 0, total: 0 })
})
