import type { Skin } from '../skin'

// GoLand Darcula, mapped onto claude-skins' palette shape. Every color here
// traces back to a token already in ../themes/goland-dark.json (the Claude
// Code native theme this repo ships) — nothing invented for this file.
//
// Tool-kind colors reuse goland-dark.json's eight *_FOR_SUBAGENTS_ONLY hues,
// which are already a categorical palette meant for exactly this kind of
// per-kind tagging. `user` takes the JetBrains accent blue directly (it's
// labeled `briefLabelYou` in goland-dark.json — literally "you" already).
const skin: Skin = {
  name: 'goland',
  label: 'GoLand',
  palette: {
    read: '#2AACB8', // planMode / background
    write: '#CF8E6D', // remember / fastMode
    run: '#E0BB65', // warning
    search: '#C77DBB', // autoAccept / skill
    web: '#D99AD0', // pink_FOR_SUBAGENTS_ONLY
    mcp: '#6AAB73', // success
    other: '#9DA0A8', // inactiveShimmer
    user: '#548AF7', // claude / permission / briefLabelYou
    fg: '#BCBEC4', // text
    muted: '#7A7E85', // inactive
    surface: '#2B2D30', // userMessageBackground (GoLand's tool-window gray)
    zebra: '#313338', // userMessageBackgroundHover
    ok: '#6AAB73', // success
    err: '#F75464', // error
    warn: '#E0BB65', // warning
  },
  spinner: ['Indexing', 'Compiling', 'Building', 'Refactoring', 'Resolving', 'Debugging'],
  done: ['Indexed', 'Compiled', 'Built', 'Resolved'],
}

export default skin
