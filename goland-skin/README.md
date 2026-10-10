# goland-skin

JetBrains **GoLand Darcula** colors for [Claude Code](https://claude.com/claude-code), plus a matching [Warp](https://www.warp.dev/) terminal theme so the whole terminal — not just Claude's own output — looks like the IDE.

Claude Code's theme covers Claude's own colors (text, accents, diffs, panels, status badges). It does not repaint the terminal background, your font, or arbitrary command output — that's the terminal's job, which is why this skin ships a Warp theme alongside it.

## What's inside

```
goland-skin/
├── .claude-plugin/
│   └── plugin.json       # plugin manifest; themes/ is auto-loaded
├── themes/
│   └── goland-dark.json  # Claude Code custom theme (56 tokens, base: dark-ansi)
└── warp/
    └── goland_dark.yaml  # Warp terminal theme (background, font colors, ANSI palette)
```

`base: "dark-ansi"` means Claude Code's own code highlighting (in replies, diffs) draws from the terminal's 16-color ANSI palette rather than a fixed built-in scheme — so `warp/goland_dark.yaml`'s bright color slots double as GoLand's syntax colors (keywords, strings, types, comments). Install both halves together for the full effect.

## Install

**As a Claude Code plugin** (auto-loads the theme, no manual file copying):

```bash
claude plugin install goland-skin@im-adarsh/claude-mods
```

or point `--plugin-dir` at this folder directly during development:

```bash
claude --plugin-dir goland-skin
```

**Manually**, if you'd rather not install it as a plugin:

```bash
cp goland-skin/themes/goland-dark.json ~/.claude/themes/goland-dark.json
cp goland-skin/warp/goland_dark.yaml   ~/.warp/themes/goland_dark.yaml
```

## Activate

1. **Claude Code** — run `/theme` and pick **GoLand Dark**, or set it directly in `~/.claude/settings.json`:
   ```json
   { "theme": "custom:goland-dark" }
   ```
2. **Warp** — Settings → Appearance → Themes → **GoLand Dark**, and turn off "Follow macOS appearance" so it doesn't get overridden on a light/dark switch.
3. **Font** (optional, for the full IDE feel) — GoLand ships with JetBrains Mono:
   ```bash
   brew install --cask font-jetbrains-mono
   ```
   Then set it in Warp → Settings → Appearance → Text, regular weight, with line height around `1.2`.

## Palette

| Token | Color | Used for |
|---|---|---|
| `text` | `#BCBEC4` | Primary text |
| `claude` / `permission` | `#548AF7` | Accent, Claude's own color, permission prompts |
| `success` | `#6AAB73` | Success states |
| `error` | `#F75464` | Errors |
| `warning` | `#E0BB65` | Warnings |
| `autoAccept` / `skill` | `#C77DBB` | Auto-accept mode, skills |
| `remember` / `fastMode` | `#CF8E6D` | Memory, fast mode |
| `planMode` | `#2AACB8` | Plan mode |
| `userMessageBackground` | `#2B2D30` | Message panels (GoLand's tool-window gray) |
| `selectionBg` | `#214283` | Text selection |

Full token list in [`themes/goland-dark.json`](themes/goland-dark.json).

## Credit

Colors taken from JetBrains' GoLand Darcula theme. Not affiliated with or endorsed by JetBrains.

## License

MIT
