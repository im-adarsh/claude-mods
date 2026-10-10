# diagram-preview

Two small Claude Code skills that preview a diagram you already have — paste
it, point to a file, or (for Excalidraw) describe it — instead of building
one from scratch.

## What's inside

```
diagram-preview/
├── .claude-plugin/
│   └── plugin.json              # plugin manifest
└── skills/
    ├── diagram-mermaid/
    │   └── SKILL.md             # preview Mermaid source as an Artifact
    └── diagram-excalidraw/
        └── SKILL.md             # preview an Excalidraw scene as an Artifact
```

Both skills are read-only/preview-only: they render what you give them as a
Claude Code Artifact and never write to any other file.

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
- "Preview this Excalidraw file" or paste Excalidraw scene JSON directly
- For Excalidraw, you can also just describe what you want drawn — the skill
  hands off to the `excalidraw-diagram` skill to build it, then previews it

## License

MIT
