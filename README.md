# Presentation Editor

> **AI가 생성한 HTML 슬라이드 어디에든 인라인 편집 + 영구 저장 + 재생성 안전성을 추가하는 Vanilla JS 레이어.**
> `<script>` 한 줄. 어떤 deck, 어떤 테마, 어떤 생성기든.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.3.0-brightgreen.svg)](https://github.com/seunghan91/presentation-editor)

🌐 **Languages**: [한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [中文](README.zh.md)

![Demo](docs/demo.gif)

## 무엇이 다른가

AI HTML deck 생성기 (frontend-slides, html-slides, slides-ai-plugin, NotebookLM) 를 써본 사람이라면 익숙한 페인:

> *"한 단어만 고치고 싶은데, AI 에 다시 프롬프트를 던지면 deck 전체가 새로 생성되고 내 편집은 사라진다."*

이 라이브러리는 그 사이에 들어간다. **사용자 편집을 IndexedDB 에 영구 저장**하고, AI 가 deck 을 재생성해도 **신뢰도 점수 + 제안형 다이얼로그**로 다시 적용할 수 있게 해준다. 자동 머지가 아닌 *suggestion-based* — 사용자가 블록 단위로 결정.

## 호환 매트릭스

| 생성기 | 슬라이드 셀렉터 | 자동 감지 | 검증 |
|---|---|---|---|
| [zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides) | `section.slide` | ✓ | 검증됨 |
| [bluedusk/html-slides](https://github.com/bluedusk/html-slides) | `section.slide` | ✓ | 검증됨 |
| [proyecto26/slides-ai-plugin](https://github.com/proyecto26/slides-ai-plugin) | `section.slide` | ✓ | 검증됨 |
| [reveal.js](https://github.com/hakimel/reveal.js) | `.reveal .slides > section` | ✓ | 검증됨 |
| [Marp](https://marp.app) HTML export | `section[data-marpit-svg]` | ✓ | 검증됨 |
| Vanilla `<div class="slide">` | `.slide` | ✓ | 검증됨 |

## 빠른 시작 — CDN 한 줄

이미 빌드된 HTML deck (어떤 생성기든) 의 `</body>` 바로 위에 박으면 됨.

```html
<script src="https://cdn.jsdelivr.net/npm/@beast2025/presentation-editor@latest/src/presentation-editor.js"></script>
```

또는 npm:
```bash
npm install @beast2025/presentation-editor
```

[![npm](https://img.shields.io/npm/v/@beast2025/presentation-editor.svg?color=cb3837)](https://www.npmjs.com/package/@beast2025/presentation-editor)
[![jsDelivr](https://data.jsdelivr.com/v1/package/npm/@beast2025/presentation-editor/badge)](https://www.jsdelivr.com/package/npm/@beast2025/presentation-editor)

자동으로:
1. 슬라이드 셀렉터 감지 (`section.slide` → `.reveal .slides > section` → `section[data-marpit-svg]` → `.slide`)
2. content-hash deckId 계산 (URL 무관, 복사·재export 추적 가능)
3. 이전 편집 있으면 신뢰도-버킷 다이얼로그 표시

## 핵심 기능

### 🔄 재생성-안전 편집 메모리 (Phase 3)

```
사용자 편집 → MutationObserver 캡처 → IndexedDB 영구 저장
                                          ↓
                            AI 가 deck 재생성 (HTML 파일 교체)
                                          ↓
페이지 로드 → deckId 계산 → 저장된 편집과 diff
                                          ↓
                        ┌─ HIGH (>0.85): 자동 적용 + 토스트
                        ├─ MEDIUM (0.5-0.85): 다이얼로그 (체크 ON)
                        └─ LOW (<0.5): 다이얼로그 (체크 OFF, "uncertain")
```

3-way diff (AI v1 / 사용자 / AI v2) 를 슬라이드별·블록별로 표시. 사용자가 "당신 버전 / AI 버전 / 수동 머지" 선택.

**슬라이드 락**: `PresentationEditor.lockSlide(el, true)` — AI 재생성 시 무조건 사용자 버전 강제 복원. HTML 코멘트 마커 (`<!-- pe:locked v1 hash=... -->`) 가 export 에 포함되어 외부 regenerator 도 신호 인식 가능.

### 인라인 편집

- `<h1/h2/h3/p/li/td>` 등 텍스트 블록 자동 contenteditable
- 800ms debounce 자동 저장 (IndexedDB)
- CJK / 한글 IME 안전 (`compositionstart/end` + `keyCode 229` 가드)

### 깨끗한 export

```js
const { html, blob } = await PresentationEditor.exportClean({ download: true });
```

Editor 오염 (toolbar, modal, `data-pe-original`, 우리 `<script>`) 모두 제거. 이미지는 `data:` URI 로 인라인. 락 마커는 보존. 멱등 — 재import → 재export = 동일.

### 이미지 4-way 업로드 + HEIC

드래그-드롭 / 클립보드 paste / URL paste / 파일 picker. iPhone HEIC/HEIF 자동 변환 (heic2any 동적 로드 → JPEG). 큰 파일 자동 압축 (Canvas 기반, 1920px / JPEG 0.85). IndexedDB 영구 저장.

### PDF 내보내기 — 3-tier

| 모드 | 엔진 | 파일 크기 | 시각 충실도 |
|---|---|---|---|
| 📄 인쇄 | `window.print()` | 5-10MB | 그라데이션 fallback |
| 📄 고품질 | jsPDF + html2canvas (동적 로드) | 15-25MB | 100% (raster) |
| 📱 모바일 | 동일 엔진 + blob URL | 동일 | 같음 (새 탭) |

### iOS 26 기본 테마 (선택)

생성기가 자체 테마를 갖고 있으면 그걸 그대로 존중. 자체 테마가 없는 deck 에는 옵션으로 iOS 26 시스템 토큰 + Liquid Glass 카드 사용 가능:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@beast2025/presentation-editor@latest/themes/ios26.css">
<body data-pt-theme="ios26">
```

`themes/classic.css` (Electric blue), `themes/sunset.css` 도 포함. 라이브러리 코어는 테마 무관 (`PresentationEditor.init({ theme: null })`).

## 명시적 init (선택)

자동 감지가 정확하면 호출 불필요. override 가 필요할 때:

```js
PresentationEditor.init({
  slideSelector: '.my-custom-slide',   // override 자동 감지
  theme: 'ios26',                       // null = data-pt-theme 자체 감지
  autoDetect: true,
  regen: { enabled: true }              // false 로 재생성-검출 비활성
});
```

## API (전역 `window.PresentationEditor`)

```js
// — 상태
PresentationEditor.version          // '1.3.0'
PresentationEditor.deckId           // 'd_a1b2c3d4e5f6' (content hash)
PresentationEditor.deckLSH          // 4-band MinHash signature
PresentationEditor.theme            // 'ios26' | ... | null
PresentationEditor.config           // { slideSelector, theme, autoDetect, regen }
PresentationEditor.isComposing      // CJK IME 활성 여부
PresentationEditor.isMobile()

// — 라이프사이클
PresentationEditor.init(opts)
PresentationEditor.computeDeckId()
PresentationEditor.detectAndReapply()    // 수동 트리거 (기본은 deckId 확정 후 자동)

// — 슬라이드 락
PresentationEditor.lockSlide(sectionEl, true|false)

// — Export
PresentationEditor.exportClean({ download, filename, inlineBlobs })
                       // → Promise<{ html, blob, blobs }>
PresentationEditor.exportPdfHighQuality(opts)
PresentationEditor.viewPdfMobile()
PresentationEditor.captureFirstSlide()          // 1200×630 PNG blob

// — 테마/폰트
PresentationEditor.applyTheme(name)
PresentationEditor.applyFontPair(key)

// — 이미지
PresentationEditor.compressImage(file, maxDim, quality)
PresentationEditor.convertHeic(file)
PresentationEditor.loadImageInto(ph, file)

// — IndexedDB (Phase 3 추가)
PresentationEditor.db.{
  // v1 (기존)
  putImage, getImage, deleteImage,
  putEdit, getEdit, listImages, estimate,
  migrateFromLocalStorage, restoreImages,
  // v2 (Phase 3 추가)
  putDeck, getDeck, listDecks,
  putSlideEdit, getSlideEditsForDeck, deleteSlideEdit
}

// — 이벤트
window.addEventListener('pe:deck-identified', e => {
  console.log(e.detail.deckId, e.detail.deckLSH);
});
```

## 의존성

- 코어: **0** (zero deps)
- 선택 (CDN, on-demand 로드): `mermaid`, `qrcode-generator`
- 동적 (사용 시에만 로드): `heic2any@0.0.4`, `html2canvas@1.4.1`, `jspdf@2.5.1`

## 멱등 가드

`window.__ptEditorLoaded` 가 truthy 면 두 번째 로드 시 즉시 return.

## 디렉토리 구조

```
~/presentation-editor/
├── src/presentation-editor.js          # 메인 라이브러리 (~140KB)
├── themes/{ios26,classic,sunset}.css   # 옵션 테마
├── docs/REGEN-PRESERVATION.md          # Phase 3 설계 (1900단어)
├── docs/demo.gif
├── examples/
│   ├── basic.html, advanced.html, minimal.html, themes.html
│   ├── compat-frontend-slides.html     # frontend-slides shape 검증
│   └── compat-other-deck.html
├── README.{md,en.md,ja.md,zh.md}
├── CHANGELOG.md
├── LICENSE (MIT)
└── package.json
```

## 라이선스

MIT — `LICENSE` 파일 참조.

## 작자

**김승한 (Seunghan)** · [@seunghan91](https://github.com/seunghan91)

## 변경 이력

[CHANGELOG.md](CHANGELOG.md) 참조.

## 기여

이슈 / PR 환영. 새로운 AI deck 생성기 어댑터 PR 특히 환영.
