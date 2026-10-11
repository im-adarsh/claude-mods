export type TodoProgress = { done: number; total: number }
export type ToolUseLike = { tool: string; input: unknown }
export type SessionMessageLike = { toolUses: readonly ToolUseLike[] }

const TODO_TOOL = 'TodoWrite'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function todoProgressOf(messages: readonly SessionMessageLike[]): TodoProgress {
  let latest: ToolUseLike | undefined
  for (const message of messages) {
    for (const use of message.toolUses) {
      if (use.tool === TODO_TOOL) latest = use
    }
  }

  if (!latest || !isRecord(latest.input) || !Array.isArray(latest.input.todos)) {
    return { done: 0, total: 0 }
  }

  const todos = latest.input.todos as unknown[]
  const done = todos.filter(
    todo => isRecord(todo) && todo.status === 'completed',
  ).length

  return { done, total: todos.length }
}
