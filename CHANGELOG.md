# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] — 2026-05-08

### Fixed
- **Critical: mobile PDF capture corruption** — html2canvas was capturing slides at the mobile viewport width (e.g. 390px) instead of the design 1920px, then PDF embed stretched the small raster, garbling all text. Fixed by forcing `width: 1920, height: 1080, windowWidth: 1920, windowHeight: 1080` in html2canvas options for `exportPdfHighQuality`, `viewPdfMobile`, and `captureFirstSlide`. Mobile-rendered PDFs now have desktop-quality typography.

## [1.2.0] — 2026-05-08

### Added
- **High-quality PDF export** (`exportPdfHighQuality`) — jsPDF@2.5.1 + html2canvas@1.4.1 dynamically loaded only on first PDF click. 16:9 landscape (1920×1080 px). Per-slide canvas capture at 2x scale → JPEG 0.92 → embed. Letterbox padding for non-16:9 ratios. 100% visual fidelity (gradients/Korean fonts/mermaid all preserved as raster).
- **Mobile PDF viewer** (`viewPdfMobile`) — same engine but `pdf.output('blob')` → `URL.createObjectURL` → `window.open` instead of download. Mobile native PDF viewer handles rotation + pinch-zoom. Auto-detected via `isMobileDevice()` (touch + viewport < 900px).
- **Mobile floating banner** — auto-shown 1.5s after load on mobile. "PDF 로 보기" CTA. Dismissible (24h localStorage).
- **Korean font preload** (`preloadFonts`) — uses Document Fonts API to ensure Pretendard/Outfit/SF Pro/Noto Sans KR/Spoqa/Gmarket/Playfair Display/Noto Serif KR all loaded before capture. 150ms additional render wait.
- **`PresentationEditor.isMobile()`** API exposed.
- **3-tier PDF buttons** in toolbar: 📄 PDF (인쇄) / 📄 PDF 고품질 / 📱 PDF 새 탭 (mobile only).

### Architecture
- All PDF/HEIC/html2canvas dependencies remain dynamically loaded — core stays at zero deps.

## [1.1.1] — 2026-05-08

### Fixed
- **Theme-aware PDF gradient fallback** — `beforeprint` handler now reads `window.PresentationEditor.theme` and applies matching fallback color (ios26 #6155f5 / sunset #ff8d28 / classic #2d2dff). Previously sunset themed presentations showed indigo fallback in PDF, now show matching orange.
- `applyTheme()` sets `--print-fallback-color` CSS variable per theme so static print CSS rules also pick up correct color.

### Added
- **OG image capture** — `captureFirstSlide()` uses html2canvas to render first slide → 1200×630 PNG with letterbox.
- **`downloadOgImage()`** — saves PNG locally with slug-based filename.
- **`uploadOgToAxAdmin()`** — on `axhub.space`, finds presentation by slug via `/api/v1/presentations`, then PATCH multipart with `thumbnail` blob (cookie auth, owner only).
- **OG capture toolbar buttons** — 📸 OG 다운로드 (always) + ☁️ 업로드 (axhub/localhost only).

## [1.1.0] — 2026-05-08

### Added
- **Image 4-way upload** — drag-drop (existing) + clipboard paste (Cmd+V) + URL paste + file picker with `capture="environment"` for mobile camera.
- **HEIC/HEIF auto-conversion** — `isHeic(file)` detection + `heic2any@0.0.4` dynamic load via jsDelivr CDN. iPhone photos auto-converted to JPEG before save.
- **Canvas-based image compression** (`compressImageCanvas`) — longest edge ≤ 1920px, JPEG quality 0.85, files < 500KB skipped. Zero external dependencies.
- **IndexedDB persistence layer** (`PresentationEditor.db`) — `images` and `edits` object stores keyed by `location.pathname::id`. 6 KV operations + `migrateFromLocalStorage()` + `restoreImages()`. Auto-runs migration 600ms after load, then restores images 200ms later.
- **Layer A** — auto text editing on `.slide-content h1/h2/p`, `.note-bar`, `.cover h1` etc. with localStorage debounced auto-save (400ms). Generic selectors override-able via `window.PT_EDITABLE_SELECTORS`.
- **Layer B** — toast notification system (`setupToast` + `showToast`).
- **Layer C** — lightbox for `.mermaid-wrap` and `[data-pt-zoom]` elements with smooth modal expand.
- **Font picker** — 6 curated Korean+English pairs: iOS Pro, Outfit·Pretendard, Inter·Noto Sans KR, Outfit·Spoqa Han Sans Neo, Gmarket Sans, Playfair Display·Noto Serif KR. Modal with live preview + localStorage memory.
- **Theme switcher integrated into editor toolbar** — dot pickers for ios26/sunset/classic in toolbar's bottom row. Removed standalone floating box.
- **Toolbar starts minimized** — opacity 0.45 on idle, 1.0 on hover. `minimizeToolbar(state)` API.
- **iframe fullscreen fallback** — `tryFullscreen(el)` detects iframe context, opens raw URL in new tab when `requestFullscreen()` fails.
- **`↗ 새 창` button** in toolbar shown only inside iframes.

### Fixed
- **Critical: HTML parser premature `</script>` close** — library docstring contained `<script src="..."></script>` example text. When inlined into HTML, parser closed outer `<script>` tag prematurely, leaking JS source as plain text after last slide. Fixed by escaping all `</script>` → `<\/script>` in upload pipeline (and recommendation in skill docs).

### Changed
- Library moved to standalone repo at `~/presentation-editor/` (was inside Claude skill `~/.claude/skills/seunghan-32inch-ppt/assets/interactive-editor.js`).
- Mirror copy maintained at `~/ax_admin/public/lib/presentation-editor.js` for CDN-style serving.

## [1.0.0] — 2026-05-08

### Added
- Initial release based on existing `interactive-editor.js` from `seunghan-32inch-ppt` Claude skill.
- **Idempotent guard** (`window.__ptEditorLoaded`) — multi-load safe.
- **CJK IME composition tracking** — `compositionstart` / `compositionend` listeners + Enter handler skips on `e.isComposing` || `keyCode 229`. Prevents Hangul syllable corruption.
- **Per-feature try/catch** — one plugin failure won't block others.
- **Theme system** — `body[data-pt-theme]` → `html.pt-theme-*`. Two themes:
  - `ios26.css` — Apple iOS 26 system tokens (default).
  - `classic.css` — Electric blue (`#2d2dff`, Pretendard + Outfit, 12px radius, vivid).
- Both themes expose `--pt-*` tokens with legacy `--color-*` aliases for backward compat with existing decks.
- **Layout editor toolbar** — font/padding/width ± controls, ratio lock, reset.
- **12-layout slide builder** — Cover/Quote/Cards/Stats/Diagram/Code/Closing modal picker.
- **Image placeholder** (`.ph-image`) — drag-drop or click upload, base64 inline.
- **Aspect toggle** — 16:9 ↔ 4:3, persists via localStorage.
- **HTML export** + **PDF print** with editor UI auto-hide via `@media print`.
- **Slide QR code** — auto-injected top-left of each slide pointing to current URL.
- **Version manager** — integrates with ax_admin's `presentation_versions` API for save/rollback.
- **Slide navigation** — keyboard ← → ↑ ↓ Space PageUp/Down Home/End F.
