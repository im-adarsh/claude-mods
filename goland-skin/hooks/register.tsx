import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const THEME_KEY = 'theme'
const THEME_VALUE = 'custom:goland-dark'
const WARP_RELATIVE = '.warp/themes/goland_dark.yaml'

const previousTheme = atom(
  { plugin: 'goland-skin', key: 'previousTheme' } as const,
  null,
)

async function installWarpTheme($: EngineInterface) {
  const home = await $.env.get('HOME')
  if (!home) return { installed: false, path: null as string | null }

  const path = `${home}/${WARP_RELATIVE}`
  if (await $.fs.exists(path)) return { installed: true, path }

  const yaml = await $.fs.read(`${$.plugin.root}/warp/goland_dark.yaml`)
  await $.fs.write(path, yaml)
  return { installed: true, path }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'goland',
      description: 'Switch Claude Code to the GoLand Dark theme',
      argumentHint: '[on|off|status]',
    })

    return next(e)
  })

  on('command.run', { command: 'goland' }, async ($, e) => {
    const action = e.args.trim().toLowerCase() || 'on'

    if (action === 'status') {
      const rows = await $.config.list()
      const current = rows.find(row => row.key === THEME_KEY)?.value
      const { installed, path } = await installWarpTheme($).catch(() => ({
        installed: false,
        path: null,
      }))
      const isOn = current === THEME_VALUE

      return {
        text: [
          `Claude Code theme: ${String(current)}${isOn ? ' (GoLand Dark)' : ''}`,
          installed
            ? `Warp theme file: installed at ${path}`
            : 'Warp theme file: not installed (no $HOME found)',
        ].join('\n'),
      }
    }

    if (action === 'off') {
      const saved = await read($, previousTheme)
      const { deny } = await $.config.set({
        key: THEME_KEY,
        value: saved ?? 'dark',
      })

      return { text: deny ?? `Theme restored${saved ? ` to ${saved}` : ''}.` }
    }

    if (action !== 'on') {
      return { text: `Unknown action "${action}". Use on, off, or status.` }
    }

    const rows = await $.config.list()
    const current = rows.find(row => row.key === THEME_KEY)?.value
    if (typeof current === 'string' && current !== THEME_VALUE) {
      await update($, previousTheme, () => current)
    }

    const { deny } = await $.config.set({ key: THEME_KEY, value: THEME_VALUE })
    if (deny) return { text: deny }

    const { installed, path } = await installWarpTheme($).catch(() => ({
      installed: false,
      path: null,
    }))

    return {
      text: installed
        ? `Claude Code switched to GoLand Dark.\nWarp theme file is at ${path} — pick "GoLand Dark" once in Warp → Settings → Appearance → Themes.`
        : 'Claude Code switched to GoLand Dark. Could not place the Warp theme file (no $HOME found); copy warp/goland_dark.yaml manually.',
    }
  })
}
