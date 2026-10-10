# diagram-preview

Two small Claude Code skills that preview a diagram you already have — paste
it, point to a file, or (for Excalidraw) describe it — instead of building
one from scratch. Both render full color, pixel-accurate output, inline in
the response:

- **Mermaid** renders to a PNG with `@mermaid-js/mermaid-cli` (via `npx`, no
  install needed), then displays it with Claude Code's native inline image
  rendering (`Read` on the file) — not by opening an OS image viewer.
- **Excalidraw** renders as a Claude Code Artifact, since there's no
  maintained headless CLI that exports an Excalidraw scene to an image file.

There are two different ways to get an image in front of you here, and only
one of them actually works: writing Kitty graphics / iTerm2 / Sixel escape
codes to Bash's stdout does **not** render — Claude Code's shell tool
captures that output as text rather than piping raw bytes to the terminal,
so the codes show up as literal escaped text (confirmed by testing, not
assumed). But `Read`-ing an image file is a separate, first-class Claude
Code capability that does display inline, in terminals that support it —
that's the path both skills use for the file-based route.

## What's inside

```
diagram-preview/
├── .claude-plugin/
│   └── plugin.json              # plugin manifest
└── skills/
    ├── diagram-mermaid/
    │   └── SKILL.md             # render Mermaid to PNG via mmdc, then Read it inline
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
  — renders to PNG and shows it inline in the response. First run pulls down
  mermaid-cli's headless Chromium via `npx`, which can take a minute.
- "Preview this Excalidraw file" or paste Excalidraw scene JSON directly —
  opens as a Claude Code Artifact.
- For Excalidraw, you can also just describe what you want drawn — the skill
  hands off to the `excalidraw-diagram` skill to build it, then previews it

## License

MIT
