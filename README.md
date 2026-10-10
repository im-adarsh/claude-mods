# claude-mods

A collection of small Claude Code mods and themes.

| Folder | What it is |
|---|---|
| [`goland-skin`](goland-skin) | JetBrains GoLand Darcula colors for Claude Code, plus a matching Warp terminal theme and an optional skin for [claude-skins](https://github.com/hellosverre/claude-skins). `/goland on\|off\|status` switches it live |
| [`diagram-preview`](diagram-preview) | Preview Mermaid and Excalidraw diagrams as Artifacts, from pasted source or a file |
| [`agent-status-band`](agent-status-band) | A two-line band above the prompt showing every agent in the session: role icons, status, emotion, and an aggregate traffic light |

## Adding a mod

Each mod is a self-contained top-level folder and a complete, independently
installable Claude Code plugin (`claude plugin install <mod>@im-adarsh/claude-mods`
installs just that folder, nothing else) — so a mod never imports across
folder boundaries, even if that means a little duplication between mods.

- `.claude-plugin/plugin.json` — manifest (`name`, `version`, `description`,
  `author`, `keywords`, plus `types` if the mod ships `.d.ts` declarations)
- A `hooks/hooks.json` naming its hook module(s), if the mod has behavior
  beyond a skill (a skill-only mod like `diagram-preview` has none)
- `tsconfig.json` extending the root `tsconfig.base.json`, for any mod with
  TypeScript hooks (see `goland-skin/tsconfig.json`) — editor/type support
  only; `claude-code`'s own module types aren't a standalone npm package, so
  this doesn't type-check clean via plain `tsc` outside the plugin runtime
- Add the mod to this table and to `.claude-plugin/marketplace.json`

## Testing

```bash
claude plugin validate ./<mod>   # manifest + hooks shape, works for every mod
claude plugin test ./<mod>       # runs hooks/*.test.ts, only for mods with hooks
```

CI (`.github/workflows/test.yml`) runs both for every mod in the matrix on
push and PR.

## License

MIT, unless a folder says otherwise.
