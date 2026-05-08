# Presentation Editor

> Vanilla JS 라이브러리 — 정적 HTML 발표자료의 in-browser 편집.
> 한 줄 인라인으로 모든 기능 활성: 텍스트 편집 · 이미지 업로드 (HEIC) · 테마/폰트 전환 · IndexedDB 영구 저장.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-brightgreen.svg)](https://github.com/seunghan91/presentation-editor)

🌐 **Languages**: [한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [中文](README.zh.md)

![Demo](docs/demo.gif)

## 빠른 시작 — CDN 한 줄

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@beast2025/presentation-editor@latest/themes/ios26.css">
<script src="https://cdn.jsdelivr.net/npm/@beast2025/presentation-editor@latest/src/presentation-editor.js"></script>
```

또는 npm:
```bash
npm install @beast2025/presentation-editor
```

[![npm](https://img.shields.io/npm/v/@beast2025/presentation-editor.svg?color=cb3837)](https://www.npmjs.com/package/@beast2025/presentation-editor)
[![jsDelivr](https://data.jsdelivr.com/v1/package/npm/@beast2025/presentation-editor/badge)](https://www.jsdelivr.com/package/npm/@beast2025/presentation-editor)


## 무엇을 하는가

이미 빌드된 HTML 발표자료에 `<script>` 한 줄 인라인으로 박으면 **편집기·테마 스위처·폰트 picker·이미지 업로드·PDF 내보내기** 가 활성화됨. React/Vue/build pipeline 없음 — 어떤 정적 HTML 에도 즉시 작동.

## 사용

```html
<body data-pt-theme="ios26">
  <link rel="stylesheet" href="./themes/ios26.css">

  <div class="slide">...</div>
  <div class="slide">...</div>

  <!-- 선택: QR · mermaid -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

  <!-- 메인 -->
  <script src="./src/presentation-editor.js"></script>
</body>
```

## 기능

### 편집기 toolbar (우상단, 닫힌 상태로 시작 — 호버 시 펼침)
- 🎨 편집모드 ON/OFF · 폰트/패딩/너비 ± 조절 · 비율 유지
- 🎨 **테마**: ios26 / sunset / classic
- 🔤 **폰트**: 6 페어 (iOS Pro, Outfit·Pretendard, Inter·Noto Sans KR, Outfit·Spoqa, Gmarket Sans, Playfair·Noto Serif)
- ➕ 새 슬라이드 (12 레이아웃 픽커)
- 📄 PDF (인쇄) / 📄 PDF 고품질 / 📱 PDF 새 탭 (모바일)
- 📸 OG 이미지 캡처 (다운로드 · 업로드)
- 🖼️ 16:9 ↔ 4:3 토글
- ⛶ 풀스크린 (F)

### 자동 텍스트 편집
- `.slide-content h1/h2/p`, `.note-bar`, `.cover h1` 등 클릭만 하면 즉시 편집
- 400ms debounce 자동 저장 (localStorage + IndexedDB 양쪽)
- ✏️ 토스트 알림

### 이미지 4-way 업로드
- 드래그-드롭 / 클립보드 paste (Cmd+V) / URL paste / 파일 picker
- 모바일: 카메라 capture (`capture="environment"`)
- 큰 파일 자동 압축 (Canvas 기반, 긴 변 1920px / JPEG 0.85)
- **HEIC/HEIF 자동 변환** — iPhone 사진 드롭 시 heic2any 동적 로드 → JPEG

### IndexedDB 영구 저장
- 이미지 + 텍스트 편집 영구 저장 (localStorage 5MB 한계 회피)
- localStorage → IDB 자동 마이그레이션
- 페이지별 분리 (`location.pathname` 기반)

### CJK / 한글 지원
- IME composition 가드 (`compositionstart/end` + `e.isComposing` + `keyCode 229`)
- 한글 조합 중 keystroke skip → 마지막 글자 깨짐 방지

### 모바일 PDF 뷰어
- 모바일 감지 시 하단 floating 배너 자동 표시
- "PDF 로 보기" 클릭 → jsPDF + html2canvas 동적 로드 → 새 탭 PDF 뷰어
- 모바일 네이티브 PDF 뷰어가 가로 회전 + pinch-zoom 자동 처리

### PDF 내보내기 — 3-tier
| 모드 | 엔진 | 파일 크기 | 시각 충실도 |
|---|---|---|---|
| 📄 인쇄 | `window.print()` | 5-10MB | 그라데이션 fallback |
| 📄 고품질 | jsPDF + html2canvas (200KB 동적 로드) | 15-25MB | 100% (raster) |
| 📱 모바일 | 동일 엔진 + blob URL | 동일 | 같음 (탭에서 열림) |

## 의존성

- 코어: **0** (zero deps)
- 선택 (CDN, on-demand 로드): `mermaid`, `qrcode-generator`
- 동적 (사용 시에만 로드): `heic2any@0.0.4`, `html2canvas@1.4.1`, `jspdf@2.5.1`

## 디렉토리 구조

```
~/presentation-editor/
├── src/presentation-editor.js   # 메인 라이브러리 (~110KB)
├── themes/
│   ├── ios26.css                # Apple iOS 26 시스템 토큰
│   └── classic.css              # Electric blue (#2d2dff)
├── docs/demo.gif                # 데모 (이 README 상단)
├── examples/                    # 사용 예시
├── README.md                    # 한국어 (this file)
├── README.en.md                 # English
├── README.ja.md                 # 日本語
├── README.zh.md                 # 中文
├── LICENSE                      # MIT
└── package.json                 # @beast2025/presentation-editor
```

## API (전역 `window.PresentationEditor`)

```js
PresentationEditor.version       // '1.2.0'
PresentationEditor.theme         // 'ios26' | 'sunset' | 'classic'
PresentationEditor.fontPair      // current font pair key
PresentationEditor.isComposing   // CJK IME 활성 여부
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
PresentationEditor.uploadOgToAxAdmin()      // axhub.space owner only

PresentationEditor.db.{
  putImage, getImage, deleteImage,
  putEdit, getEdit,
  listImages, estimate,
  migrateFromLocalStorage, restoreImages
}
```

## 멱등 가드

`window.__ptEditorLoaded` 가 truthy 면 두 번째 로드 시 즉시 return.

## 테마 추가

`src/presentation-editor.js` 의 `THEMES` 객체에 새 항목 추가:

```js
mytheme: {
  name: 'My Theme',
  dot: '#ff00ff',
  css: [
    '.pt-theme-mytheme {',
    '  --color-blue: #ff00ff;',
    '  --pt-gradient-em: linear-gradient(135deg, #ff00ff, #00ffff);',
    '}',
    // ... 더
  ].join('\n')
}
```

## 라이선스

MIT — `LICENSE` 파일 참조.

## 작자

**김승한 (Seunghan)** · [@seunghan91](https://github.com/seunghan91)

## 변경 이력

[CHANGELOG.md](CHANGELOG.md) 참조.

## 기여

이슈 / PR 환영. [CONTRIBUTING.md](CONTRIBUTING.md) 참조 (예정).
