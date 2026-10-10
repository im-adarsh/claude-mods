import { test, expect } from 'claude-code/testing'

test('/goland on switches the theme row to custom:goland-dark', async ($, on) => {
  const sets: unknown[] = []

  on('config.list', () => ({
    value: [
      {
        key: 'theme',
        label: 'Theme',
        kind: 'choice',
        value: 'dark',
        provider: { kind: 'engine' },
      },
    ],
  }))
  on('config.set', ($$, e) => {
    sets.push(e.value)
    return { value: e.value }
  })
  on('env.get', () => ({ value: undefined }))

  const { text } = await $.command.run({ command: 'goland', args: 'on' })

  expect(sets).toEqual(['custom:goland-dark'])
  expect(text).toContain('GoLand Dark')
})

test('/goland with an unknown action does not touch the theme', async $ => {
  const { text } = await $.command.run({ command: 'goland', args: 'nonsense' })

  expect(text).toContain('Unknown action')
})
