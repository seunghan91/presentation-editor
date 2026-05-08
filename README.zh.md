# Presentation Editor

> 浏览器内编辑静态 HTML 演示文稿的 Vanilla JS 库。
> 一行内联 `<script>` 即可激活: 文本编辑 · 图片上传 (HEIC) · 主题/字体切换 · IndexedDB 持久化。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.1-brightgreen.svg)](https://github.com/seunghan91/presentation-editor)

🌐 **语言**: [한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [中文](README.zh.md)

![Demo](docs/demo.gif)

## 简介

在已构建的 HTML 演示文稿中插入一行 `<script>`,即可立即获得 **编辑工具栏、主题切换、字体选择器、图片上传器和 PDF 导出**。无需 React/Vue/构建管道 — 适用于任何静态 HTML。

## 使用方法

```html
<body data-pt-theme="ios26">
  <link rel="stylesheet" href="./themes/ios26.css">

  <div class="slide">...</div>
  <div class="slide">...</div>

  <!-- 可选: QR · mermaid -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

  <!-- 主库 -->
  <script src="./src/presentation-editor.js"></script>
</body>
```

## 功能

### 编辑工具栏 (右上,默认折叠 — 悬停展开)
- 🎨 编辑模式 ON/OFF · 字体/内边距/宽度 ± 调整 · 比例锁定
- 🎨 **主题**: ios26 / sunset / classic
- 🔤 **字体对**: 6 种精选搭配 (iOS Pro, Outfit·Pretendard, Inter·Noto Sans KR, Outfit·Spoqa, Gmarket Sans, Playfair·Noto Serif)
- ➕ 添加新幻灯片 (12 种布局模板)
- 📄 PDF (打印) / 📄 PDF 高品质 / 📱 PDF 新标签 (移动)
- 📸 OG 图片捕获 (下载 · 上传)
- 🖼️ 16:9 ↔ 4:3 切换
- ⛶ 全屏 (F)

### 自动文本编辑
- `.slide-content h1/h2/p`、`.note-bar`、`.cover h1` 等点击即可立即编辑
- 400ms 防抖自动保存 (localStorage + IndexedDB)
- ✏️ 保存提示 toast

### 图片上传 — 4 种输入方式
- 拖放 / 剪贴板粘贴 (Cmd+V) / URL 粘贴 / 文件选择器
- 移动端: 摄像头捕获 (`capture="environment"`)
- 自动压缩大文件 (Canvas 基础,最长边 1920px / JPEG 0.85)
- **HEIC/HEIF 自动转换** — iPhone 照片拖入时动态加载 heic2any → JPEG

### IndexedDB 持久化
- 图片 + 文本编辑永久保存 (绕过 localStorage 5MB 限制)
- localStorage → IDB 自动迁移
- 按页面隔离 (基于 `location.pathname`)

### CJK / 中文支持
- IME composition 防护 (`compositionstart/end` + `e.isComposing` + `keyCode 229`)
- 输入法组合期间跳过 keystroke → 防止最后字符丢失

### 移动 PDF 查看器
- 移动设备自动显示底部浮动横幅
- "PDF 查看" → jsPDF + html2canvas 动态加载 → 新标签 PDF 查看器
- 移动原生 PDF 查看器自动处理横屏旋转 + pinch-zoom

### PDF 导出 — 3 层
| 模式 | 引擎 | 文件大小 | 视觉保真度 |
|---|---|---|---|
| 📄 打印 | `window.print()` | 5-10MB | 渐变 fallback |
| 📄 高品质 | jsPDF + html2canvas (200KB 懒加载) | 15-25MB | 100% (raster) |
| 📱 移动 | 同引擎 + blob URL | 相同 | 相同 (新标签打开) |

## 依赖

- 核心: **0** (零依赖)
- 可选 (CDN, 按需): `mermaid`, `qrcode-generator`
- 仅在使用时加载: `heic2any@0.0.4`, `html2canvas@1.4.1`, `jspdf@2.5.1`

## 目录结构

```
~/presentation-editor/
├── src/presentation-editor.js   # 主库 (~110KB)
├── themes/
│   ├── ios26.css                # Apple iOS 26 系统令牌
│   └── classic.css              # Electric blue (#2d2dff)
├── docs/demo.gif                # README 主图
├── examples/                    # 自包含演示
├── README.md (한국어)
├── README.en.md (English)
├── README.ja.md (日本語)
├── README.zh.md (this file)
├── LICENSE                      # MIT
└── package.json
```

## API (全局 `window.PresentationEditor`)

```js
PresentationEditor.version       // '1.2.1'
PresentationEditor.theme         // 'ios26' | 'sunset' | 'classic'
PresentationEditor.fontPair      // 当前字体对 key
PresentationEditor.isComposing   // CJK IME 激活
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

## 幂等性保护

如果 `window.__ptEditorLoaded` 为 truthy,第二次加载立即 return。可从服务端控制器安全内联注入。

## 添加主题

在 `src/presentation-editor.js` 的 `THEMES` 对象中添加:

```js
mytheme: {
  name: 'My Theme',
  dot: '#ff00ff',
  css: [
    '.pt-theme-mytheme {',
    '  --color-blue: #ff00ff;',
    '  --pt-gradient-em: linear-gradient(135deg, #ff00ff, #00ffff);',
    '}',
    // ... 更多
  ].join('\n')
}
```

## 许可证

MIT — 见 `LICENSE`。

## 作者

**김승한 (Seunghan)** · [@seunghan91](https://github.com/seunghan91)

## 变更日志

参见 [CHANGELOG.md](CHANGELOG.md)。

## 贡献

欢迎 Issue / PR。
