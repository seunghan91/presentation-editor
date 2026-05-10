# Presentation Editor

> **A Vanilla JS layer that adds inline editing, persistent storage, and regen-safe edit memory to any AI-generated HTML deck.**
> One `<script>` tag. Any deck, any theme, any generator.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.3.0-brightgreen.svg)](https://github.com/seunghan91/presentation-editor)

🌐 **Languages**: [한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [中文](README.zh.md)

![Demo](docs/demo.gif)

## What's different

If you've used any AI HTML deck generator (frontend-slides, html-slides, slides-ai-plugin, NotebookLM), you've felt this pain:

> *"I want to fix one word, but if I re-prompt the AI, the entire deck gets regenerated and my edits are gone."*

This library sits between the generator and you. **User edits are persisted to IndexedDB**, and when the AI regenerates the deck, a **confidence-scored, suggestion-based dialog** lets you re-apply them block by block. Not auto-merge — *suggestion-based*.

## Compatibility matrix

| Generator | Slide selector | Auto-detect | Verified |
|---|---|---|---|
| [zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides) | `section.slide` | ✓ | yes |
| [bluedusk/html-slides](https://github.com/bluedusk/html-slides) | `section.slide` | ✓ | yes |
| [proyecto26/slides-ai-plugin](https://github.com/proyecto26/slides-ai-plugin) | `section.slide` | ✓ | yes |
| [reveal.js](https://github.com/hakimel/reveal.js) | `.reveal .slides > section` | ✓ | yes |
| [Marp](https://marp.app) HTML export | `section[data-marpit-svg]` | ✓ | yes |
| Vanilla `<div class="slide">` | `.slide` | ✓ | yes |

## Quick start — one CDN line

Drop into any HTML deck just before `</body>`.

```html
<script src="https://cdn.jsdelivr.net/npm/@beast2025/presentation-editor@latest/src/presentation-editor.js"></script>
```

Or via npm:
```bash
npm install @beast2025/presentation-editor
```

[![npm](https://img.shields.io/npm/v/@beast2025/presentation-editor.svg?color=cb3837)](https://www.npmjs.com/package/@beast2025/presentation-editor)
[![jsDelivr](https://data.jsdelivr.com/v1/package/npm/@beast2025/presentation-editor/badge)](https://www.jsdelivr.com/package/npm/@beast2025/presentation-editor)

The library will automatically:
1. Detect the slide selector (`section.slide` → `.reveal .slides > section` → `section[data-marpit-svg]` → `.slide`)
2. Compute a content-hash deckId (URL-independent, survives copy / re-export)
3. If prior edits exist, show the confidence-bucketed re-apply dialog

## Core features

### 🔄 Regen-safe edit memory (Phase 3)

```
User edit → MutationObserver capture → IndexedDB persist
                                          ↓
                            AI regenerates deck (HTML file replaced)
                                          ↓
Page load → deckId computed → diff against stored edits
                                          ↓
                        ├─ HIGH (>0.85): silent auto-apply + toast
                        ├─ MEDIUM (0.5-0.85): dialog (checked by default)
                        └─ LOW (<0.5): dialog (unchecked, "uncertain")
```

Three-way diff (AI v1 / user / AI v2) shown per slide and per block.

**Slide lock**: `PresentationEditor.lockSlide(el, true)` forces user version on regen. HTML comment markers (`<!-- pe:locked v1 hash=... -->`) survive in clean export so external regenerators can read the signal.

### Inline editing

- Auto-contenteditable for `<h1/h2/h3/p/li/td>` and other text blocks
- 800ms debounced auto-save to IndexedDB
- CJK / Korean IME safe

### Clean export

```js
const { html, blob } = await PresentationEditor.exportClean({ download: true });
```

All editor pollution stripped. Images inlined as `data:` URIs. Lock markers preserved. Idempotent.

### 4-way image upload + HEIC

Drag-drop / clipboard paste / URL paste / file picker. iPhone HEIC/HEIF auto-converted. Persisted to IndexedDB.

### PDF export — 3-tier

| Mode | Engine | Size | Fidelity |
|---|---|---|---|
| 📄 Print | `window.print()` | 5-10MB | gradient fallback |
| 📄 High-quality | jsPDF + html2canvas | 15-25MB | 100% raster |
| 📱 Mobile | Same + blob URL | Same | New tab |

### iOS 26 default theme (optional)

If your generator brings its own theme, it's preserved. For decks without a theme, optionally:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@beast2025/presentation-editor@latest/themes/ios26.css">
<body data-pt-theme="ios26">
```

Library core is theme-agnostic.

## Explicit init (optional)

```js
PresentationEditor.init({
  slideSelector: '.my-custom-slide',
  theme: 'ios26',
  autoDetect: true,
  regen: { enabled: true }
});
```

## API (`window.PresentationEditor`)

```js
PresentationEditor.version          // '1.3.0'
PresentationEditor.deckId           // 'd_a1b2c3d4e5f6'
PresentationEditor.deckLSH
PresentationEditor.config

PresentationEditor.init(opts)
PresentationEditor.detectAndReapply()
PresentationEditor.lockSlide(sectionEl, true|false)
PresentationEditor.exportClean({ download, filename, inlineBlobs })
PresentationEditor.exportPdfHighQuality(opts)

PresentationEditor.db.{
  putImage, getImage, deleteImage, putEdit, getEdit,    // v1
  putDeck, getDeck, listDecks,                          // v2
  putSlideEdit, getSlideEditsForDeck, deleteSlideEdit   // v2
}

window.addEventListener('pe:deck-identified', e => {
  console.log(e.detail.deckId, e.detail.deckLSH);
});
```

## Dependencies

- Core: **0**
- Optional CDN (on-demand): `mermaid`, `qrcode-generator`
- Dynamic (used only on demand): `heic2any@0.0.4`, `html2canvas@1.4.1`, `jspdf@2.5.1`

## License

MIT — see `LICENSE`.

## Author

**Seunghan Kim (김승한)** · [@seunghan91](https://github.com/seunghan91)

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Contributing

Issues and PRs welcome. New AI deck generator adapters especially welcome.
