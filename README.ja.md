# Presentation Editor

> 静的 HTML プレゼンテーションをブラウザ内で編集する Vanilla JS ライブラリ。
> インライン `<script>` 1 行で起動: テキスト編集 · 画像アップロード (HEIC) · テーマ/フォント切替 · IndexedDB 永続化。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.1-brightgreen.svg)](https://github.com/seunghan91/presentation-editor)

🌐 **言語**: [한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [中文](README.zh.md)

![Demo](docs/demo.gif)

## 概要

ビルド済み HTML プレゼンテーションに `<script>` を 1 行入れるだけで、**編集 toolbar・テーマスイッチャー・フォントピッカー・画像アップローダー・PDF エクスポート** が有効になります。React / Vue / ビルドパイプライン不要 — どんな静的 HTML でもそのまま動作。

## 使い方

```html
<body data-pt-theme="ios26">
  <link rel="stylesheet" href="./themes/ios26.css">

  <div class="slide">...</div>
  <div class="slide">...</div>

  <!-- オプション: QR · mermaid -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

  <!-- メインライブラリ -->
  <script src="./src/presentation-editor.js"></script>
</body>
```

## 機能

### 編集 toolbar (右上、初期は折りたたみ — ホバーで展開)
- 🎨 編集モード ON/OFF · フォント/パディング/幅 ± 調整 · アスペクト比固定
- 🎨 **テーマ**: ios26 / sunset / classic
- 🔤 **フォントペア**: 6 種類のキュレーション (iOS Pro, Outfit·Pretendard, Inter·Noto Sans KR, Outfit·Spoqa, Gmarket Sans, Playfair·Noto Serif)
- ➕ 新スライド追加 (12 レイアウトテンプレート)
- 📄 PDF (印刷) / 📄 PDF 高品質 / 📱 PDF 新タブ (モバイル)
- 📸 OG 画像キャプチャ (ダウンロード · アップロード)
- 🖼️ 16:9 ↔ 4:3 切替
- ⛶ フルスクリーン (F)

### 自動テキスト編集
- `.slide-content h1/h2/p`、`.note-bar`、`.cover h1` などをクリックで即編集
- 400ms debounce 自動保存 (localStorage + IndexedDB 両方)
- ✏️ 保存時にトースト通知

### 画像アップロード — 4 通り入力
- ドラッグ&ドロップ / クリップボードペースト (Cmd+V) / URL ペースト / ファイルピッカー
- モバイル: カメラキャプチャ (`capture="environment"`)
- 大きいファイルは自動圧縮 (Canvas 基盤、長辺 1920px / JPEG 0.85)
- **HEIC/HEIF 自動変換** — iPhone 写真ドロップ時、heic2any を動的ロード → JPEG

### IndexedDB 永続化
- 画像 + テキスト編集を永続保存 (localStorage 5MB 制限を回避)
- localStorage → IDB 自動マイグレーション
- ページ別分離 (`location.pathname` ベース)

### CJK / 日本語サポート
- IME composition ガード (`compositionstart/end` + `e.isComposing` + `keyCode 229`)
- 漢字変換中の keystroke を skip → 最後の文字消失を防止

### モバイル PDF ビューア
- モバイル端末で下部にフローティングバナー自動表示
- "PDF で見る" → jsPDF + html2canvas 動的ロード → 新タブで PDF ビューア
- ネイティブ PDF ビューアが横画面回転 + pinch-zoom を自動処理

### PDF エクスポート — 3 段階
| モード | エンジン | ファイルサイズ | 視覚忠実度 |
|---|---|---|---|
| 📄 印刷 | `window.print()` | 5-10MB | グラデ fallback |
| 📄 高品質 | jsPDF + html2canvas (200KB 遅延ロード) | 15-25MB | 100% (raster) |
| 📱 モバイル | 同エンジン + blob URL | 同じ | 同じ (新タブで開く) |

## 依存関係

- コア: **0** (zero deps)
- オプション (CDN, on-demand): `mermaid`, `qrcode-generator`
- 必要時のみロード: `heic2any@0.0.4`, `html2canvas@1.4.1`, `jspdf@2.5.1`

## ディレクトリ構造

```
~/presentation-editor/
├── src/presentation-editor.js   # メインライブラリ (~110KB)
├── themes/
│   ├── ios26.css                # Apple iOS 26 システムトークン
│   └── classic.css              # Electric blue (#2d2dff)
├── docs/demo.gif                # README ヒーロー
├── examples/                    # 自己完結型デモ
├── README.md (한국어)
├── README.en.md (English)
├── README.ja.md (this file)
├── README.zh.md (中文)
├── LICENSE                      # MIT
└── package.json
```

## API (グローバル `window.PresentationEditor`)

```js
PresentationEditor.version       // '1.2.1'
PresentationEditor.theme         // 'ios26' | 'sunset' | 'classic'
PresentationEditor.fontPair      // 現在のフォントペアキー
PresentationEditor.isComposing   // CJK IME 有効
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

## 冪等性ガード

`window.__ptEditorLoaded` が truthy の場合、2 回目のロードは即座に return。サーバーサイドコントローラーから安全にインライン注入可能。

## テーマ追加

`src/presentation-editor.js` の `THEMES` オブジェクトに追加:

```js
mytheme: {
  name: 'My Theme',
  dot: '#ff00ff',
  css: [
    '.pt-theme-mytheme {',
    '  --color-blue: #ff00ff;',
    '  --pt-gradient-em: linear-gradient(135deg, #ff00ff, #00ffff);',
    '}',
    // ... さらに
  ].join('\n')
}
```

## ライセンス

MIT — `LICENSE` 参照。

## 作者

**김승한 (Seunghan)** · [@seunghan91](https://github.com/seunghan91)

## 変更履歴

[CHANGELOG.md](CHANGELOG.md) 参照。

## 貢献

Issue / PR 歓迎です。
