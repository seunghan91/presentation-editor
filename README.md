# Presentation Editor

Vanilla JS 라이브러리 — 정적 HTML 발표자료의 in-browser 편집.
**한 줄 인라인** 으로 모든 기능 활성: 텍스트 편집 · 이미지 업로드 (HEIC 포함) · 테마/폰트 전환 · IndexedDB 영구 저장.

**Version**: 1.1.0
**Author**: 김승한 (Seunghan)
**License**: MIT

## 사용

```html
<body data-pt-theme="ios26">
  <link rel="stylesheet" href="./themes/ios26.css">

  <div class="slide">...</div>

  <!-- 선택: QR · mermaid -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

  <!-- 메인 -->
  <script src="./src/presentation-editor.js"></script>
</body>
```

## 기능

### 편집기 toolbar (우상단)
- 🎨 편집모드 ON/OFF · A− A+ · W H · Pad · 비율 유지
- 🎨 테마: ios26 / sunset / classic
- 🔤 폰트: 6 페어 (iOS Pro, Outfit·Pretendard, Inter·Noto, Outfit·Spoqa, Gmarket, Playfair·Noto Serif)
- ➕ 새 슬라이드 (12 레이아웃 픽커)
- ⛶ 풀스크린 / 📥 HTML / 📄 PDF / 🖼️ 16:9 ↔ 4:3
- 닫힌 상태로 시작 (호버 시 펼침)

### 자동 편집
- `.slide-content h1/h2/p`, `.note-bar` 등 클릭만 하면 즉시 편집
- 400ms debounce 자동 저장 (localStorage + IndexedDB 양쪽)
- ✏️ 토스트 알림

### 이미지 업로드 (4-way)
- 드래그 드롭
- 클립보드 paste (Cmd+V)
- 파일 picker (모바일 카메라 capture 포함)
- URL paste (CORS 허용 시)

### HEIC/HEIF 자동 변환
- iPhone 사진 자동 감지 → heic2any 동적 로드 → JPEG 변환
- Safari 외 모든 브라우저 지원

### Canvas 압축
- 긴 변 1920px 초과 시 자동 리사이징
- JPEG quality 0.85 + 외부 lib 의존 0

### IndexedDB 저장
- 이미지 + 텍스트 편집 영구 저장 (localStorage 5MB 한계 회피)
- localStorage → IDB 자동 마이그레이션
- 페이지별 분리 (`location.pathname` 기반)

### CJK / 한글 지원
- IME composition 가드 (compositionstart/end + e.isComposing)
- word-break 친화적

### 테마 시스템
- `data-pt-theme="ios26|sunset|classic"` body 속성
- CSS 변수만 override (HTML 토큰 시스템 위에 카스케이드)
- 우상단 dot 클릭으로 즉시 전환 + localStorage 기억

## 디렉토리 구조

```
~/presentation-editor/
├── src/
│   └── presentation-editor.js   # 메인 라이브러리 (~100KB)
├── themes/
│   ├── ios26.css                # Apple iOS 26 시스템 토큰
│   └── classic.css              # Electric blue (pipc-ai 풍)
├── examples/                    # 사용 예시 HTML (TBD)
├── docs/                        # 추가 문서 (TBD)
└── README.md
```

## 의존성

- 코어: 0 (zero deps)
- 선택: `mermaid` (다이어그램), `qrcode-generator` (슬라이드 QR)
- 동적: `heic2any` (HEIC 파일 업로드 시에만 로드)

## API (전역 `window.PresentationEditor`)

```js
PresentationEditor.version       // '1.1.0'
PresentationEditor.theme         // 'ios26' | 'sunset' | 'classic'
PresentationEditor.fontPair      // current font pair key
PresentationEditor.applyTheme(name)
PresentationEditor.applyFontPair(key)
PresentationEditor.minimizeToolbar(true|false)
PresentationEditor.tryFullscreen(el)
PresentationEditor.openInNewTab()
PresentationEditor.toast(msg)
PresentationEditor.compressImage(file, maxDim, quality)
PresentationEditor.convertHeic(file)
PresentationEditor.loadImageInto(ph, file)
PresentationEditor.db.{putImage,getImage,deleteImage,putEdit,getEdit,listImages,estimate}
```

## 멱등 가드

`window.__ptEditorLoaded` 가 이미 truthy 면 두 번째 로드 시 즉시 return.

## 배포 위치

- 로컬: `~/presentation-editor/src/presentation-editor.js` (단일 source of truth)
- ax_admin: `/Users/seunghan/ax_admin/public/lib/presentation-editor.js` (mirror copy)
- 발표자료 HTML 에 **인라인 박음** (단일 파일 self-contained)

## Claude Skill 참조

`~/.claude/skills/seunghan-32inch-ppt/SKILL.md` 의 `assets/interactive-editor.js` 가 deprecated 이고, 대신 이 라이브러리를 인라인 inject 함.
