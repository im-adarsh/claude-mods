# diagram-preview

Two small Claude Code skills that preview a diagram you already have — paste
it, point to a file, or (for Excalidraw) describe it — instead of building
one from scratch. Both render full color, pixel-accurate output:

- **Mermaid** renders to a PNG with `@mermaid-js/mermaid-cli` (via `npx`,
  no install needed) and opens it with the OS's default image viewer.
- **Excalidraw** renders as a Claude Code Artifact, since there's no
  maintained headless CLI that exports an Excalidraw scene to an image file.

Neither renders inline as terminal text/images: Claude Code's Bash tool
captures stdout as text rather than piping raw bytes to the terminal, so
image protocols (Kitty graphics, iTerm2, Sixel) and even plain ANSI color
codes never reach the terminal as anything but literal escaped text — this
was confirmed by testing, not assumed. Opening a real file or an Artifact is
the only way to get a true color render from here.

## What's inside

```
diagram-preview/
├── .claude-plugin/
│   └── plugin.json              # plugin manifest
└── skills/
    ├── diagram-mermaid/
    │   └── SKILL.md             # render Mermaid to PNG via mmdc, then open it
    └── diagram-excalidraw/
        └── SKILL.md             # preview an Excalidraw scene as an Artifact
```

Both skills are read-only/preview-only: they render what you give them and
never write into your project tree (scratch directory only).

## Install

```bash
claude plugin install diagram-preview@im-adarsh/claude-mods
```

or point `--plugin-dir` at this folder directly during development:

```bash
claude --plugin-dir diagram-preview
```

## Use

- "Preview this Mermaid diagram: ```mermaid ... ```" or "render diagram.mmd"
  — opens a PNG in your image viewer. First run pulls down mermaid-cli's
  headless Chromium via `npx`, which can take a minute.
- "Preview this Excalidraw file" or paste Excalidraw scene JSON directly —
  opens as a Claude Code Artifact.
- For Excalidraw, you can also just describe what you want drawn — the skill
  hands off to the `excalidraw-diagram` skill to build it, then previews it

## License

MIT
