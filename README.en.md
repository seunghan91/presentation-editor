# Presentation Editor

> Vanilla JS library for in-browser editing of static HTML presentations.
> One inline `<script>` line activates: text editing · image upload (HEIC) · theme/font switcher · IndexedDB persistence.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-brightgreen.svg)](https://github.com/seunghan91/presentation-editor)

🌐 **Languages**: [한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [中文](README.zh.md)

![Demo](docs/demo.gif)

## What it does

Drop a `<script>` tag into any pre-built HTML presentation and instantly get an **editor toolbar, theme switcher, font picker, image uploader, and PDF exporter**. No React, no Vue, no build pipeline — works on any static HTML.

## Usage

```html
<body data-pt-theme="ios26">
  <link rel="stylesheet" href="./themes/ios26.css">

  <div class="slide">...</div>
  <div class="slide">...</div>

  <!-- Optional: QR · mermaid -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

  <!-- Main library -->
  <script src="./src/presentation-editor.js"></script>
</body>
```

## Features

### Editor toolbar (top-right, starts collapsed — hover to expand)
- 🎨 Edit mode ON/OFF · font/padding/width ± · aspect lock
- 🎨 **Themes**: ios26 / sunset / classic
- 🔤 **Font pairs**: 6 curated (iOS Pro, Outfit·Pretendard, Inter·Noto Sans KR, Outfit·Spoqa, Gmarket Sans, Playfair·Noto Serif)
- ➕ Add new slide (12 layout templates)
- 📄 PDF (print) / 📄 PDF high-quality / 📱 PDF new tab (mobile)
- 📸 OG image capture (download · upload)
- 🖼️ 16:9 ↔ 4:3 toggle
- ⛶ Fullscreen (F)

### Auto text editing
- `.slide-content h1/h2/p`, `.note-bar`, `.cover h1` etc. become editable on click
- 400ms debounced auto-save (localStorage + IndexedDB)
- ✏️ Toast notifications on save

### Image upload — 4-way input
- Drag-drop / clipboard paste (Cmd+V) / URL paste / file picker
- Mobile: camera capture (`capture="environment"`)
- Auto-compress large files (Canvas-based, longest edge 1920px / JPEG 0.85)
- **HEIC/HEIF auto-conversion** — drop iPhone photos, heic2any loads on demand → JPEG

### IndexedDB persistence
- Images + text edits stored permanently (bypass localStorage 5MB limit)
- Auto-migration from localStorage
- Per-page isolation via `location.pathname`

### CJK / Korean support
- IME composition guard (`compositionstart/end` + `e.isComposing` + `keyCode 229`)
- Skip keystrokes during Hangul composition → no last-syllable corruption

### Mobile PDF viewer
- Auto-shows floating banner on mobile devices
- "Open as PDF" → jsPDF + html2canvas dynamic load → new tab PDF viewer
- Native mobile PDF viewers handle landscape rotation + pinch-zoom

### PDF export — 3-tier
| Mode | Engine | File size | Visual fidelity |
|---|---|---|---|
| 📄 Print | `window.print()` | 5-10MB | Gradient fallback |
| 📄 High-quality | jsPDF + html2canvas (200KB lazy load) | 15-25MB | 100% (raster) |
| 📱 Mobile | Same engine + blob URL | Same | Same (opens in new tab) |

## Dependencies

- Core: **0** (zero deps)
- Optional (CDN, on-demand): `mermaid`, `qrcode-generator`
- Lazy-loaded only when used: `heic2any@0.0.4`, `html2canvas@1.4.1`, `jspdf@2.5.1`

## Repo layout

```
~/presentation-editor/
├── src/presentation-editor.js   # Main library (~110KB)
├── themes/
│   ├── ios26.css                # Apple iOS 26 system tokens
│   └── classic.css              # Electric blue (#2d2dff)
├── docs/demo.gif                # README hero
├── examples/                    # Self-contained demos
├── README.md                    # Korean (default)
├── README.en.md                 # English (this file)
├── README.ja.md                 # Japanese
├── README.zh.md                 # Chinese
├── LICENSE                      # MIT
└── package.json
```

## API (global `window.PresentationEditor`)

```js
PresentationEditor.version       // '1.2.0'
PresentationEditor.theme         // 'ios26' | 'sunset' | 'classic'
PresentationEditor.fontPair      // current font pair key
PresentationEditor.isComposing   // CJK IME active
PresentationEditor.isMobile()

PresentationEditor.applyTheme(name)
PresentationEditor.applyFontPair(key)
PresentationEditor.minimizeToolbar(state)
PresentationEditor.tryFullscreen(el)
PresentationEditor.openInNewTab()
PresentationEditor.toast(msg)

PresentationEditor.compressImage(file, maxDim, quality)
PresentationEditor.convertHeic(file)
PresentationEditor.loadImageInto(ph, file)

PresentationEditor.exportPdfHighQuality(opts)
PresentationEditor.viewPdfMobile()
PresentationEditor.captureFirstSlide()      // 1200×630 PNG blob
PresentationEditor.downloadOgImage()

PresentationEditor.db.{
  putImage, getImage, deleteImage,
  putEdit, getEdit,
  listImages, estimate,
  migrateFromLocalStorage, restoreImages
}
```

## Idempotency

If `window.__ptEditorLoaded` is truthy, second load returns immediately. Safe to inline-inject from a server-side controller.

## Adding a theme

In `src/presentation-editor.js`, add to the `THEMES` object:

```js
mytheme: {
  name: 'My Theme',
  dot: '#ff00ff',
  css: [
    '.pt-theme-mytheme {',
    '  --color-blue: #ff00ff;',
    '  --pt-gradient-em: linear-gradient(135deg, #ff00ff, #00ffff);',
    '}',
    // ... more
  ].join('\n')
}
```

## License

MIT — see `LICENSE`.

## Author

**김승한 (Seunghan)** · [@seunghan91](https://github.com/seunghan91)

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Contributing

Issues and PRs welcome.
