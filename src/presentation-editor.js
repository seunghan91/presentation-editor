/* ============================================================
   presentation-editor.js v1.0.0
   Author: 김승한 (Seunghan) · License: MIT
   ------------------------------------------------------------
   발표자료(.slide 기반 HTML) 라이브 편집 라이브러리.

   Features:
   - 🎨 레이아웃 편집기 · ➕ 12 레이아웃 슬라이드 빌더
   - 🖼 점선 Placeholder + 이미지 드롭/업로드(base64)
   - ⛶ 풀스크린 + 키보드 네비 (←→↑↓ Space PageUp/Down Home/End F)
   - 📥 HTML/PDF/4:3 내보내기 · 🔢 슬라이드 카운터
   - 💾 서버 버전 저장/롤백 (cookie auth)
   - 🌐 한글/CJK IME composition 안전 처리
   - 🎭 테마 감지 (body[data-pt-theme] — ios26/classic/...)
   - 🔒 멱등 가드: 중복 로드 시 무시

   Usage:
   <body data-pt-theme="ios26">  <!-- or "classic" -->
     <link rel="stylesheet" href="https://www.axhub.space/lib/themes/ios26.css">
     ...
     <script src="https://www.axhub.space/lib/presentation-editor.js"><\/script>
   </body>

   Prerequisites:
   - .slide 클래스로 슬라이드 마크업
   - 테마 CSS 가 토큰 (--pt-color-*, --pt-bg-*, --pt-font-*) 정의 (선택)
   - mermaid (선택) · qrcode-generator (선택, QR 사용 시)
   ============================================================ */
(function () {
  'use strict';

  // ── 멱등 가드: 중복 로드 방지 (perplexity 권고) ────────────
  if (window.__ptEditorLoaded) {
    console.info('[presentation-editor] already loaded v' + window.__ptEditorLoaded + ', skipping');
    return;
  }
  window.__ptEditorLoaded = '1.3.0';
  window.PresentationEditor = window.PresentationEditor || {
    version: '1.3.0',
    theme: null,
    isComposing: false,
    deckId: null,        // §3 Regen-Preservation — content-hash deck identity (async, set by computeDeckId)
    deckLSH: null,       // MinHash band signature for fuzzy deck match across regenerations
    config: null         // Phase 1B — set by autodetect or PresentationEditor.init({...})
  };

  // ── Phase 1B: theme-agnostic core config ─────────────────────────────
  // 자동 감지 우선순위: section.slide → reveal.js → marp → legacy .slide.
  // 사용자 override: PresentationEditor.init({ slideSelector: '...' }).
  function _peAutoDetectSelector() {
    var candidates = [
      'section.slide',                // frontend-slides, html-slides, slides-ai-plugin
      '.reveal .slides > section',    // reveal.js
      'section[data-marpit-svg], section[data-marpit-fragments]', // Marp
      '.slide'                        // legacy / our own examples
    ];
    for (var i = 0; i < candidates.length; i++) {
      try {
        if (document.querySelector(candidates[i])) return candidates[i];
      } catch (_) {}
    }
    return '.slide';
  }

  function _peDefaultConfig() {
    return {
      slideSelector: _peAutoDetectSelector(),
      theme: null,                    // null = let detectTheme() pick from data-pt-theme attr
      autoDetect: true,
      regen: { enabled: true }        // Phase 3 토글
    };
  }

  // Public init API. Idempotent — can be called pre or post DOMContentLoaded.
  // Merges over auto-detected defaults; never wipes prior config.
  window.PresentationEditor.init = function (opts) {
    var cfg = window.PresentationEditor.config || _peDefaultConfig();
    if (opts && typeof opts === 'object') {
      if (typeof opts.slideSelector === 'string' && opts.slideSelector.trim()) cfg.slideSelector = opts.slideSelector.trim();
      if (typeof opts.theme === 'string') cfg.theme = opts.theme;
      if (typeof opts.autoDetect === 'boolean') cfg.autoDetect = opts.autoDetect;
      if (opts.regen && typeof opts.regen === 'object') cfg.regen = Object.assign(cfg.regen || {}, opts.regen);
    }
    window.PresentationEditor.config = cfg;
    return cfg;
  };

  // Internal accessor — replaces hardcoded '.slide' literals.
  function _peSel() {
    var c = window.PresentationEditor.config;
    return (c && c.slideSelector) || '.slide';
  }
  window.PresentationEditor._slideSelector = _peSel;

  // ── 테마 정의 (CSS 변수만 override — HTML 의 토큰 시스템 위에 카스케이드) ─
  var THEMES = {
    ios26: {
      name: 'iOS 26',
      dot: '#0088ff',
      css: '' // HTML 기본값 그대로
    },
    sunset: {
      name: 'Sunset',
      dot: '#ff8d28',
      css: [
        '.pt-theme-sunset {',
        '  --color-blue: #ff8d28;',
        '  --color-indigo: #cb30e0;',
        '  --pt-color-blue: #ff8d28;',
        '  --pt-color-indigo: #cb30e0;',
        '  --pt-accent: #ff8d28;',
        '  --pt-gradient-em: linear-gradient(135deg, #ff8d28 0%, #ff383c 50%, #cb30e0 100%);',
        '}',
        '.pt-theme-sunset .em {',
        '  background: linear-gradient(135deg,#ff8d28 0%,#ff383c 50%,#cb30e0 100%) !important;',
        '  -webkit-background-clip: text !important;',
        '  -webkit-text-fill-color: transparent !important;',
        '  background-clip: text !important;',
        '}',
        '.pt-theme-sunset .eyebrow,',
        '.pt-theme-sunset .cover-eyebrow { color: #ff8d28 !important; }',
        '.pt-theme-sunset .slide.featured { background: linear-gradient(135deg,#fff8f0 0%,#fff0f5 100%) !important; }',
        '.pt-theme-sunset .slide.accent-bg { background: linear-gradient(135deg,#ff8d28 0%,#ff383c 100%) !important; }',
        '.pt-theme-sunset .note-bar {',
        '  background: #fff8e7 !important;',
        '  border-left: 4px solid #ffcc00 !important;',
        '  border-radius: 10px;',
        '}',
        '.pt-theme-sunset .note-label { color: #b8860b !important; }',
        '.pt-theme-sunset .accent-bg .note-bar { background: rgba(0,0,0,.35) !important; color: #fff !important; border-color: #ffcc00 !important; }',
        '.pt-theme-sunset .accent-bg .note-label { color: #ffcc00 !important; }'
      ].join('\n')
    },
    classic: {
      name: 'Electric',
      dot: '#2d2dff',
      css: [
        '.pt-theme-classic {',
        '  --color-blue: #2d2dff;',
        '  --color-indigo: #6366f1;',
        '  --pt-color-blue: #2d2dff;',
        '  --pt-color-indigo: #6366f1;',
        '  --pt-accent: #2d2dff;',
        '  --pt-gradient-em: linear-gradient(135deg,#2d2dff 0%,#6366f1 100%);',
        '}',
        '.pt-theme-classic .em {',
        '  background: linear-gradient(135deg,#2d2dff 0%,#6366f1 100%) !important;',
        '  -webkit-background-clip: text !important;',
        '  -webkit-text-fill-color: transparent !important;',
        '  background-clip: text !important;',
        '}',
        '.pt-theme-classic .eyebrow,',
        '.pt-theme-classic .cover-eyebrow { color: #2d2dff !important; }',
        '.pt-theme-classic .slide.featured { background: linear-gradient(135deg,#ffffff 0%,#ebebff 100%) !important; }',
        '.pt-theme-classic .slide.accent-bg { background: linear-gradient(135deg,#2d2dff 0%,#6366f1 100%) !important; }'
      ].join('\n')
    }
  };
  window.PresentationEditor.themes = THEMES;
  var THEME_STORAGE_KEY = 'pt-theme-' + (location.pathname.split('/').pop() || 'page');

  function applyTheme(name) {
    if (!THEMES[name]) name = 'ios26';
    // remove old pt-theme-* class
    Object.keys(THEMES).forEach(function (k) {
      document.documentElement.classList.remove('pt-theme-' + k);
      document.body.classList && document.body.classList.remove('pt-theme-' + k);
    });
    document.documentElement.classList.add('pt-theme-' + name);
    if (document.body) {
      document.body.classList.add('pt-theme-' + name);
      document.body.dataset.ptTheme = name;
    }
    window.PresentationEditor.theme = name;
    try { localStorage.setItem(THEME_STORAGE_KEY, name); } catch (_) {}

    // PDF 인쇄 시 그라데이션 텍스트 fallback 색상 (테마별)
    var pdfFallback = { ios26: '#6155f5', sunset: '#ff8d28', classic: '#2d2dff' }[name] || '#6155f5';
    document.documentElement.style.setProperty('--print-fallback-color', pdfFallback);

    // inject all theme CSS once
    var styleEl = document.getElementById('pt-themes-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'pt-themes-style';
      var combined = '';
      Object.keys(THEMES).forEach(function (k) { combined += '\n' + THEMES[k].css; });
      styleEl.textContent = combined;
      document.head.appendChild(styleEl);
    }

    // notify
    window.PresentationEditor._dispatch && window.PresentationEditor._dispatch('themechange', { theme: name });
  }
  window.PresentationEditor.applyTheme = applyTheme;

  function detectTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (_) {}
    var fromBody = (document.body && document.body.dataset && document.body.dataset.ptTheme);
    var t = saved || fromBody || 'ios26';
    applyTheme(t);
    return t;
  }

  // ── iframe 감지 + fullscreen fallback ─────────────────────
  // iframe 안에서 requestFullscreen 은 부모 iframe 의 allow="fullscreen" 없으면 fail.
  // 그 경우 raw URL 을 새 탭에서 열어 top-level 컨텍스트로 폴백.
  function inIframe() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  function openInNewTab() {
    var url = location.pathname.match(/\/raw$/) ? location.href : (location.pathname.replace(/\/$/, '') + '/raw' + location.search);
    // ax_admin 패턴: /pt/{slug} → /pt/{slug}/raw 가 raw HTML
    if (!location.pathname.match(/\/raw$/) && location.pathname.match(/\/pt\//)) {
      url = location.origin + location.pathname.replace(/\/$/, '') + '/raw';
    }
    window.open(url, '_blank', 'noopener');
  }
  window.PresentationEditor.tryFullscreen = function (el) {
    el = el || document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!req) { openInNewTab(); return; }
    try {
      var p = req.call(el);
      if (p && p.catch) p.catch(function () { openInNewTab(); });
    } catch (e) { openInNewTab(); }
  };
  window.PresentationEditor.openInNewTab = openInNewTab;

  // ── 테마 스위처 UI: 편집기 toolbar 의 첫 줄에 통합 ──────────
  function initThemeSwitcher() {
    var tb = document.getElementById('ie-toolbar');
    if (!tb) {
      // toolbar 가 아직 없으면 50ms 뒤 재시도 (init 순서 안전망)
      return setTimeout(initThemeSwitcher, 50);
    }
    if (tb.querySelector('.pt-theme-row')) return;  // already injected

    var row = document.createElement('div');
    row.className = 'pt-theme-row';
    row.style.cssText = 'display:flex; align-items:center; gap:6px; padding:4px 0 2px; border-top:1px solid rgba(255,255,255,.10);';

    var label = document.createElement('span');
    label.textContent = '🎨 테마';
    label.style.cssText = 'font-size:11px; opacity:0.7; margin-right:4px;';
    row.appendChild(label);

    Object.keys(THEMES).forEach(function (key) {
      var t = THEMES[key];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.title = t.name + ' 테마';
      btn.dataset.theme = key;
      btn.style.cssText = [
        'width:22px','height:22px','border-radius:50%',
        'background:' + t.dot,
        'border:2px solid transparent',
        'cursor:pointer','padding:0',
        'transition:transform .15s,border-color .15s',
        'box-shadow:0 1px 3px rgba(0,0,0,.25)'
      ].join(';');
      btn.addEventListener('mouseenter', function(){ btn.style.transform = 'scale(1.15)'; });
      btn.addEventListener('mouseleave', function(){ btn.style.transform = 'scale(1)'; });
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        applyTheme(key);
        Array.from(row.querySelectorAll('button[data-theme]')).forEach(function(b){
          b.style.borderColor = b.dataset.theme === key ? '#fff' : 'transparent';
        });
      });
      row.appendChild(btn);
    });

    // 새 창 열기 (iframe 안에서만 표시)
    if (inIframe()) {
      var spacer = document.createElement('span');
      spacer.style.cssText = 'flex:1';
      row.appendChild(spacer);

      var newTabBtn = document.createElement('button');
      newTabBtn.type = 'button';
      newTabBtn.title = '새 창에서 풀스크린으로 열기 (F 키 활성)';
      newTabBtn.innerHTML = '↗ 새창';
      newTabBtn.style.cssText = [
        'background:rgba(255,255,255,.15)','color:#fff','border:none',
        'padding:4px 9px','border-radius:6px',
        'font-size:11px','font-weight:600','cursor:pointer',
        'transition:background .15s'
      ].join(';');
      newTabBtn.addEventListener('mouseenter', function(){ newTabBtn.style.background = '#0088ff'; });
      newTabBtn.addEventListener('mouseleave', function(){ newTabBtn.style.background = 'rgba(255,255,255,.15)'; });
      newTabBtn.addEventListener('click', function(e){
        e.stopPropagation();
        openInNewTab();
      });
      row.appendChild(newTabBtn);
    }

    tb.appendChild(row);

    // 현재 테마 표시
    var cur = window.PresentationEditor.theme;
    var curBtn = row.querySelector('button[data-theme="' + cur + '"]');
    if (curBtn) curBtn.style.borderColor = '#fff';
  }
  window.PresentationEditor.initThemeSwitcher = initThemeSwitcher;

  // ── IME composition 가드 (한글/CJK 안전) ──────────────────
  function setupIMEGuard() {
    document.addEventListener('compositionstart', function () {
      window.PresentationEditor.isComposing = true;
    }, true);
    document.addEventListener('compositionend', function () {
      setTimeout(function () { window.PresentationEditor.isComposing = false; }, 30);
    }, true);
  }
  window.PresentationEditor.shouldHandleKey = function () {
    return !window.PresentationEditor.isComposing;
  };

  function initAll() {
    detectTheme();
    setupIMEGuard();
    try { window.PresentationEditor.injectEditorStyles(); } catch(e) { console.warn('[pt] inject styles', e); }
    try { initLayoutEditor();   } catch(e) { console.warn('[pt] layout editor', e); }
    try { initPlaceholders();   } catch(e) { console.warn('[pt] placeholders', e); }
    try { initSlideBuilder();   } catch(e) { console.warn('[pt] slide builder', e); }
    try { initExporter();       } catch(e) { console.warn('[pt] exporter', e); }
    try { initSlideNav();       } catch(e) { console.warn('[pt] nav', e); }
    try { initAspectToggle();   } catch(e) { console.warn('[pt] aspect toggle', e); }
    try { initVersionManager(); } catch(e) { console.warn('[pt] version mgr', e); }
    try { initSlideQR();        } catch(e) { console.warn('[pt] slide QR', e); }
    try { initThemeSwitcher();  } catch(e) { console.warn('[pt] theme switcher', e); }
    try { initFontPicker();     } catch(e) { console.warn('[pt] font picker', e); }
    try { initOgButton();       } catch(e) { console.warn('[pt] og button', e); }
    // 모바일 배너 — 1.5초 후 표시 (사용자가 콘텐츠 본 다음)
    setTimeout(function () {
      try { window.PresentationEditor.initMobileBanner(); } catch(e) {}
    }, 1500);
    // Layer A/B/C — 자동 텍스트 편집 + 토스트 + 라이트박스
    try { window.PresentationEditor.setupToast();   } catch(e) { console.warn('[pt] toast', e); }
    try { window.PresentationEditor.initAutoEdit(); } catch(e) { console.warn('[pt] auto-edit', e); }
    try { setupClipboardPaste();                    } catch(e) { console.warn('[pt] clipboard paste', e); }
    // 라이트박스는 mermaid 렌더 후에 — 약간 딜레이
    setTimeout(function(){
      try { window.PresentationEditor.initLightbox(); } catch(e) { console.warn('[pt] lightbox', e); }
    }, 800);
    // 편집기 toolbar 는 닫힌 상태로 시작 (호버하거나 + 클릭 시 펼침)
    // 모든 row (theme/font 포함) 가 추가된 후 실행되도록 idle 시점에
    setTimeout(function(){
      try { window.PresentationEditor.minimizeToolbar && window.PresentationEditor.minimizeToolbar(true); } catch(e) {}
    }, 100);
    console.info('[presentation-editor] v' + window.PresentationEditor.version + ' ready · theme=' + window.PresentationEditor.theme + ' · ' + (window.PresentationEditor.editableCount||0) + ' editable elements');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    setTimeout(initAll, 50);
  }

  /* ------------------------------------------------------------
     레이아웃 편집기 — 폰트 크기·카드 크기·패딩 인터랙티브 조정
     ------------------------------------------------------------ */
  function initLayoutEditor() {
    // 기존 setupFAB 의 .edit-fab(텍스트 편집 자동저장 FAB) 숨김 — 새 툴바로 통합
    // 텍스트 자동저장은 백그라운드에서 그대로 동작
    const oldFab = document.querySelector('.edit-fab');
    if (oldFab) oldFab.style.display = 'none';

    const LAYOUT_PREFIX = 'ie-layout-' + (location.pathname.split('/').pop() || 'page') + '-';
    let editMode = false;
    let selected = null;
    let selectedRatio = 1;

    function getPath(el) {
      const parts = [];
      while (el && el !== document.body && el.parentNode) {
        const parent = el.parentNode;
        const idx = Array.from(parent.children).indexOf(el);
        parts.unshift(el.tagName + ':' + idx);
        el = parent;
      }
      return parts.join('>');
    }
    // 저장/복원 — !important 항상 적용 (CSS 룰 덮어쓰기용)
    function camelToKebab(k) { return k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()); }
    function saveStyle(el) {
      const path = getPath(el);
      const s = {};
      ['fontSize','width','height','padding','marginTop','marginBottom'].forEach(k => {
        const v = el.style.getPropertyValue(camelToKebab(k));
        if (v) s[k] = v;
      });
      if (Object.keys(s).length === 0) localStorage.removeItem(LAYOUT_PREFIX + path);
      else localStorage.setItem(LAYOUT_PREFIX + path, JSON.stringify(s));
    }
    function restoreAll() {
      Object.keys(localStorage).forEach(key => {
        if (!key.startsWith(LAYOUT_PREFIX)) return;
        const path = key.slice(LAYOUT_PREFIX.length);
        const tags = path.split('>');
        let el = document.body;
        for (const tag of tags) {
          const [, idxStr] = tag.split(':');
          const idx = parseInt(idxStr, 10);
          if (!el.children[idx]) { el = null; break; }
          el = el.children[idx];
        }
        if (!el) return;
        try {
          const s = JSON.parse(localStorage.getItem(key));
          Object.keys(s).forEach(k => el.style.setProperty(camelToKebab(k), s[k], 'important'));
        } catch (e) {}
      });
    }
    restoreAll();

    const tb = document.createElement('div');
    tb.id = 'ie-toolbar';
    tb.style.cssText = 'position:fixed; top:14px; right:14px; z-index:99999; background:rgba(28,28,30,0.94); color:#fff; padding:10px 12px; border-radius:14px; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); font-family:-apple-system,sans-serif; font-size:13px; box-shadow:0 8px 28px rgba(0,0,0,0.3); display:flex; flex-direction:column; gap:8px; max-width:380px; opacity:0.45; transition:opacity .2s ease;';
    tb.addEventListener('mouseenter', function(){ tb.style.opacity = '1'; });
    tb.addEventListener('mouseleave', function(){
      // 편집모드 ON 이거나 컨트롤 펼친 상태면 항상 진하게 유지
      var ctrls = tb.querySelector('#ie-controls');
      var expanded = ctrls && ctrls.style.display !== 'none';
      tb.style.opacity = expanded ? '1' : '0.45';
    });
    tb.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <button id="ie-toggle" style="background:#0088ff; color:#fff; border:none; padding:6px 12px; border-radius:8px; font-weight:700; cursor:pointer;">🎨 편집모드 OFF</button>
        <span id="ie-info" style="font-size:11px; opacity:0.7; flex:1;">꺼짐</span>
        <button id="ie-min" title="편집기 숨기기" style="background:rgba(255,255,255,0.15); color:#fff; border:none; padding:4px 9px; border-radius:6px; font-weight:700; cursor:pointer; font-size:14px; line-height:1;">−</button>
      </div>
      <div id="ie-controls" style="display:none; flex-direction:column; gap:6px;">
        <div id="ie-selected" style="font-size:11px; opacity:0.7; padding:4px 6px; background:rgba(255,255,255,0.08); border-radius:6px; max-height:32px; overflow:hidden;">선택된 요소 없음</div>
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:4px;">
          <button data-act="font-" class="ie-btn">A−</button>
          <button data-act="font+" class="ie-btn">A+</button>
          <button data-act="pad-" class="ie-btn">⇽⇾−</button>
          <button data-act="pad+" class="ie-btn">⇽⇾+</button>
          <button data-act="w-" class="ie-btn">W−</button>
          <button data-act="w+" class="ie-btn">W+</button>
          <button data-act="h-" class="ie-btn">H−</button>
          <button data-act="h+" class="ie-btn">H+</button>
        </div>
        <label style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer;">
          <input type="checkbox" id="ie-lock"> 비율 유지 (W변경 시 H 자동)
        </label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
          <button data-act="reset" class="ie-btn" style="background:#ff8d28;">↺ 이 요소만</button>
          <button data-act="reset-all" class="ie-btn" style="background:#ff383c;">⚠ 전체 초기화</button>
        </div>
        <div style="font-size:10px; opacity:0.55; line-height:1.4;">사용법: 편집ON → 요소 클릭 → 버튼<br>A: 폰트 ±2px · W/H: 크기 ±10px · Pad: ±4px</div>
      </div>
    `;
    document.body.appendChild(tb);

    const style = document.createElement('style');
    style.textContent = `
      .ie-btn { background:rgba(255,255,255,0.12); color:#fff; border:none; padding:8px 6px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer; transition:background 0.15s; }
      .ie-btn:hover { background:rgba(255,255,255,0.22); }
      .ie-btn:active { transform:scale(0.96); }
      body.ie-on *:hover:not(#ie-toolbar):not(#ie-toolbar *):not(#slide-builder-modal):not(#slide-builder-modal *) { outline:2px dashed rgba(0,136,255,0.5); outline-offset:1px; cursor:crosshair; }
      .ie-selected { outline:3px solid #0088ff !important; outline-offset:2px !important; }
    `;
    document.head.appendChild(style);

    const toggle = tb.querySelector('#ie-toggle');
    const controls = tb.querySelector('#ie-controls');
    const info = tb.querySelector('#ie-info');
    const selectedLabel = tb.querySelector('#ie-selected');
    const lockChk = tb.querySelector('#ie-lock');

    toggle.addEventListener('click', () => {
      editMode = !editMode;
      document.body.classList.toggle('ie-on', editMode);
      toggle.textContent = editMode ? '🎨 편집모드 ON' : '🎨 편집모드 OFF';
      toggle.style.background = editMode ? '#34c759' : '#0088ff';
      info.textContent = editMode ? '클릭해서 요소 선택 + 텍스트 직접 편집 가능' : '꺼짐';
      controls.style.display = editMode ? 'flex' : 'none';
      // 모든 .slide-content 를 contenteditable 로 (화이트리스트 미적용 div 도 편집 가능)
      document.querySelectorAll('.slide-content').forEach(el => {
        if (editMode) {
          if (!el.hasAttribute('contenteditable')) {
            el.setAttribute('contenteditable', 'true');
            el.dataset.ieEditTemp = '1';
          }
        } else if (el.dataset.ieEditTemp === '1') {
          el.removeAttribute('contenteditable');
          delete el.dataset.ieEditTemp;
        }
      });
      if (!editMode && selected) { selected.classList.remove('ie-selected'); selected = null; }
    });

    document.addEventListener('click', (e) => {
      if (!editMode) return;
      if (e.target.closest('#ie-toolbar')) return;
      if (e.target.closest('#slide-builder-modal')) return;
      if (selected) selected.classList.remove('ie-selected');
      selected = e.target;
      selected.classList.add('ie-selected');
      const rect = selected.getBoundingClientRect();
      selectedRatio = rect.height > 0 ? rect.width / rect.height : 1;
      const tag = selected.tagName.toLowerCase();
      const cls = (selected.className && typeof selected.className === 'string') ? '.' + selected.className.split(' ').slice(0,2).join('.') : '';
      const txt = (selected.textContent || '').trim().slice(0,24);
      selectedLabel.textContent = `${tag}${cls} — "${txt}"`;
    }, false);

    function px(v) { return parseFloat(v) || 0; }
    function setProp(el, prop, val) { el.style.setProperty(camelToKebab(prop), val, 'important'); }
    function applyAction(act) {
      if (!selected) { info.textContent = '먼저 요소를 클릭하세요'; return; }
      const cs = getComputedStyle(selected);
      switch(act) {
        case 'font+': case 'font-': {
          const cur = px(selected.style.fontSize) || px(cs.fontSize);
          setProp(selected, 'fontSize', (act === 'font+' ? cur + 2 : Math.max(8, cur - 2)) + 'px');
          break;
        }
        case 'pad+': case 'pad-': {
          const cur = px(selected.style.padding) || px(cs.paddingTop);
          setProp(selected, 'padding', (act === 'pad+' ? cur + 4 : Math.max(0, cur - 4)) + 'px');
          break;
        }
        case 'w+': case 'w-': {
          const rect = selected.getBoundingClientRect();
          const next = act === 'w+' ? rect.width + 10 : Math.max(20, rect.width - 10);
          setProp(selected, 'width', next + 'px');
          if (lockChk.checked && selectedRatio > 0) setProp(selected, 'height', (next / selectedRatio) + 'px');
          break;
        }
        case 'h+': case 'h-': {
          const rect = selected.getBoundingClientRect();
          const next = act === 'h+' ? rect.height + 10 : Math.max(20, rect.height - 10);
          setProp(selected, 'height', next + 'px');
          if (lockChk.checked && selectedRatio > 0) setProp(selected, 'width', (next * selectedRatio) + 'px');
          break;
        }
        case 'reset':
          ['fontSize','width','height','padding','marginTop','marginBottom'].forEach(k => selected.style.removeProperty(camelToKebab(k)));
          break;
        case 'reset-all':
          if (!confirm('이 페이지의 모든 레이아웃 편집을 초기화할까요?')) return;
          Object.keys(localStorage).forEach(k => { if (k.startsWith(LAYOUT_PREFIX)) localStorage.removeItem(k); });
          location.reload(); return;
      }
      saveStyle(selected);
    }
    tb.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      if (act) applyAction(act);
    });

    // 최소화 토글 — 펼침/접힘 + 풀스크린 자동 숨김
    const minBtn = tb.querySelector('#ie-min');
    let minimized = false;
    function applyMinimize(state) {
      minimized = state;
      Array.from(tb.children).forEach(child => {
        if (child !== tb.firstElementChild) child.style.display = minimized ? 'none' : '';
      });
      const firstRow = tb.firstElementChild;
      if (firstRow) {
        Array.from(firstRow.children).forEach(c => {
          if (c.id === 'ie-min') return;
          c.style.display = minimized ? 'none' : '';
        });
      }
      if (minimized) {
        tb.style.padding = '6px 8px';
        tb.style.opacity = '0.55';
        minBtn.textContent = '+';
        minBtn.title = '편집기 펼치기';
      } else {
        tb.style.padding = '10px 12px';
        tb.style.opacity = '';
        minBtn.textContent = '−';
        minBtn.title = '편집기 숨기기';
      }
    }
    tb.addEventListener('mouseenter', () => { if (minimized) tb.style.opacity = '0.95'; });
    tb.addEventListener('mouseleave', () => { if (minimized) tb.style.opacity = '0.55'; });
    minBtn.addEventListener('click', (e) => { e.stopPropagation(); applyMinimize(!minimized); });
    // expose for initAll to start minimized
    window.PresentationEditor.minimizeToolbar = applyMinimize;

    // 풀스크린 진입/탈출 시 자동 숨김·복원
    let preFullscreenMin = false;
    function onFsChange() {
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      const counter = document.getElementById('slide-counter');
      if (inFs) {
        preFullscreenMin = minimized;
        tb.style.display = 'none';
        if (counter) counter.style.display = 'none';
      } else {
        tb.style.display = '';
        if (counter) counter.style.display = '';
        applyMinimize(preFullscreenMin);
      }
    }
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    // contenteditable Enter 처리 — div/p 분리 대신 <br> 삽입
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      // CJK IME composition 중이면 skip (한글 조합 마지막 글자 흘림 방지)
      if (window.PresentationEditor && window.PresentationEditor.isComposing) return;
      if (e.isComposing || e.keyCode === 229) return;
      const t = e.target;
      if (!t || !t.isContentEditable) return;
      e.preventDefault();
      try { document.execCommand('insertLineBreak'); }
      catch (_) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const br = document.createElement('br');
        range.insertNode(br);
        range.setStartAfter(br);
        range.setEndAfter(br);
        sel.removeAllRanges(); sel.addRange(range);
      }
    });
  }

  /* ------------------------------------------------------------
     점선 Placeholder — 이미지 드롭/업로드 + 텍스트 편집
     ------------------------------------------------------------ */
  function initPlaceholders() {
    const phStyle = document.createElement('style');
    phStyle.id = 'pt-placeholder-styles';
    phStyle.textContent = `
      .ph-image, .ph-text {
        border: 2px dashed rgba(0,136,255,0.5);
        background: rgba(0,136,255,0.04);
        display: flex; align-items: center; justify-content: center;
        text-align: center; color: var(--label-secondary, #666);
        min-height: 120px; padding: 16px; cursor: pointer;
        transition: all 0.18s; position: relative; overflow: hidden;
        word-break: keep-all;
      }
      .ph-image:hover, .ph-text:hover { border-color: var(--color-blue, #0088ff); background: rgba(0,136,255,0.08); }
      .ph-image.has-image { border-style: solid; padding: 0; }
      .ph-image.has-image img { width:100%; height:100%; object-fit:contain; display:block; }
      .ph-image.dragover { border-color: var(--color-green, #34c759); background: rgba(52,199,89,0.12); }
      .ph-controls { position: absolute; top: 6px; right: 6px; display: none; gap: 4px; z-index: 5; }
      .ph-image:hover .ph-controls, .ph-image.has-image:hover .ph-controls { display: flex; }
      .ph-controls button { background: rgba(28,28,30,0.85); color: #fff; border: none; padding: 4px 8px; font-size: 11px; border-radius: 6px; cursor: pointer; }
      .ph-controls button:hover { background: rgba(28,28,30,1); }
      .ph-text { cursor: text; }
      .ph-text[contenteditable="true"]:focus { outline: 2px solid var(--color-blue, #0088ff); background: rgba(255,255,255,0.6); }
    `;
    document.head.appendChild(phStyle);
    setupPlaceholders(document);
  }

  function setupPlaceholders(root) {
    root.querySelectorAll('.ph-image').forEach(ph => {
      if (ph.dataset.phInit) return;
      ph.dataset.phInit = '1';
      if (!ph.querySelector('.ph-controls')) {
        const ctrl = document.createElement('div');
        ctrl.className = 'ph-controls';
        ctrl.innerHTML = `<button data-act="replace">교체</button><button data-act="clear">삭제</button>`;
        ph.appendChild(ctrl);
        ctrl.addEventListener('click', (e) => {
          e.stopPropagation();
          const a = e.target.dataset.act;
          if (a === 'clear') {
            ph.classList.remove('has-image');
            const img = ph.querySelector('img'); if (img) img.remove();
            const hint = ph.querySelector('.ph-hint'); if (hint) hint.style.display = '';
          } else if (a === 'replace') {
            triggerImageUpload(ph);
          }
        });
      }
      if (!ph.querySelector('.ph-hint') && !ph.querySelector('img')) {
        const hint = document.createElement('div');
        hint.className = 'ph-hint';
        hint.innerHTML = '📷 이미지 드롭<br><span style="font-size:12px; opacity:0.7;">또는 클릭해서 업로드</span>';
        ph.appendChild(hint);
      }
      ph.addEventListener('click', (e) => {
        if (e.target.closest('.ph-controls')) return;
        triggerImageUpload(ph);
      });
      ph.addEventListener('dragover', (e) => { e.preventDefault(); ph.classList.add('dragover'); });
      ph.addEventListener('dragleave', () => ph.classList.remove('dragover'));
      ph.addEventListener('drop', (e) => {
        e.preventDefault(); ph.classList.remove('dragover');
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) loadImageInto(ph, f);
      });
    });
    root.querySelectorAll('.ph-text').forEach(ph => {
      if (ph.dataset.phInit) return;
      ph.dataset.phInit = '1';
      ph.setAttribute('contenteditable', 'true');
    });
  }

  function triggerImageUpload(ph) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,.heic,.heif';
    // Mobile camera capture support
    inp.capture = 'environment';
    inp.onchange = () => { if (inp.files[0]) loadImageInto(ph, inp.files[0]); };
    inp.click();
  }

  // ── HEIC 감지 + 변환 (heic2any 동적 로드) ──────────────────
  function isHeic(file) {
    if (!file) return false;
    var name = (file.name || '').toLowerCase();
    var type = (file.type || '').toLowerCase();
    return name.endsWith('.heic') || name.endsWith('.heif') ||
           type === 'image/heic' || type === 'image/heif';
  }
  var heic2anyPromise = null;
  function loadHeic2any() {
    if (window.heic2any) return Promise.resolve(window.heic2any);
    if (heic2anyPromise) return heic2anyPromise;
    heic2anyPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      s.onload = function () { resolve(window.heic2any); };
      s.onerror = function () { reject(new Error('heic2any 로드 실패')); };
      document.head.appendChild(s);
    });
    return heic2anyPromise;
  }
  async function convertHeic(file) {
    var heic2any = await loadHeic2any();
    var blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    // heic2any may return single Blob or array
    if (Array.isArray(blob)) blob = blob[0];
    // Wrap as File for downstream
    return new File([blob], file.name.replace(/\.heic$|\.heif$/i, '.jpg'), { type: 'image/jpeg' });
  }

  // ── 이미지 압축 (Canvas 기반, 외부 lib 없이) ───────────────
  // 기준: 긴 변 1920px 이하, JPEG quality 0.85
  function compressImageCanvas(file, maxDim, quality) {
    maxDim = maxDim || 1920;
    quality = quality || 0.85;
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w <= maxDim && h <= maxDim && file.size < 500*1024) {
            // 작거나 이미 작은 파일은 압축 skip
            return resolve({ blob: file, width: w, height: h, skipped: true });
          }
          var ratio = Math.min(maxDim / w, maxDim / h, 1);
          var nw = Math.round(w * ratio), nh = Math.round(h * ratio);
          var canvas = document.createElement('canvas');
          canvas.width = nw; canvas.height = nh;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, nw, nh);
          canvas.toBlob(function (blob) {
            if (!blob) return reject(new Error('canvas toBlob failed'));
            resolve({ blob: blob, width: nw, height: nh, originalSize: file.size, compressedSize: blob.size });
          }, 'image/jpeg', quality);
        };
        img.onerror = function () { reject(new Error('image load failed')); };
        img.src = fr.result;
      };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(file);
    });
  }

  // ── 클립보드 paste 에서 이미지 추출 (전역 핸들러) ────────────
  function setupClipboardPaste() {
    document.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      // Find image item
      var imageItem = null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') === 0) { imageItem = items[i]; break; }
      }
      if (!imageItem) return;

      // Find target placeholder: focused .ph-image, or first empty one
      var target = document.querySelector('.ph-image:focus, .ph-image:focus-within');
      if (!target) {
        // Use the placeholder closest to viewport center that's empty
        var phs = Array.prototype.slice.call(document.querySelectorAll('.ph-image:not(.has-image)'));
        if (phs.length === 0) return;
        var center = window.innerHeight / 2;
        target = phs.sort(function (a, b) {
          return Math.abs(a.getBoundingClientRect().top - center) -
                 Math.abs(b.getBoundingClientRect().top - center);
        })[0];
      }
      if (!target) return;

      var file = imageItem.getAsFile();
      if (file) {
        e.preventDefault();
        loadImageInto(target, file);
        showToast && showToast('📋 클립보드 이미지 삽입');
      }
    });
  }

  // ── URL paste 처리 (이미지 URL 입력 시 자동 fetch) ──────────
  function loadImageFromUrl(ph, url) {
    var img = ph.querySelector('img');
    if (!img) { img = document.createElement('img'); ph.appendChild(img); }
    img.src = url;
    img.onload = function () {
      var hint = ph.querySelector('.ph-hint'); if (hint) hint.remove();
      ph.classList.add('has-image');
      showToast && showToast('🌐 URL 이미지 로드');
    };
    img.onerror = function () {
      showToast && showToast('⚠️ URL 이미지 로드 실패 (CORS?)');
    };
  }

  // ── 메인 이미지 로드 파이프라인 (HEIC → 압축 → IndexedDB → DOM) ─
  async function loadImageInto(ph, file) {
    var hint = ph.querySelector('.ph-hint');
    if (hint) hint.innerHTML = '⏳ 처리 중…';

    try {
      // Step 1: HEIC 감지 시 변환
      if (isHeic(file)) {
        if (hint) hint.innerHTML = '⏳ HEIC → JPEG 변환 중…';
        try { file = await convertHeic(file); }
        catch (e) {
          console.warn('[pt] HEIC conversion failed', e);
          showToast && showToast('⚠️ HEIC 변환 실패: ' + e.message);
          if (hint) hint.innerHTML = '📷 이미지 드롭<br><span style="font-size:12px; opacity:0.7;">또는 클릭해서 업로드</span>';
          return;
        }
      }

      // Step 2: 큰 이미지 압축
      var processed;
      if (file.size > 500 * 1024) {
        if (hint) hint.innerHTML = '⏳ 압축 중…';
        try {
          var result = await compressImageCanvas(file, 1920, 0.85);
          processed = result.blob;
          if (!result.skipped && result.compressedSize) {
            console.info('[pt] compressed ' + (result.originalSize/1024|0) + 'KB → ' + (result.compressedSize/1024|0) + 'KB');
          }
        } catch (e) { processed = file; }
      } else {
        processed = file;
      }

      // Step 3: base64 임베드 (IndexedDB 사용 시 ID로 저장 후 src=blob URL 가능)
      var dataUrl = await blobToDataUrl(processed);

      // Step 4: DOM 반영
      if (hint) hint.remove();
      var img = ph.querySelector('img');
      if (!img) { img = document.createElement('img'); ph.appendChild(img); }
      img.src = dataUrl;
      ph.classList.add('has-image');

      // Step 5: IndexedDB 저장 시도 (자동 백업)
      try {
        var key = ph.dataset.phId || ('ph-' + Math.random().toString(36).slice(2, 10));
        ph.dataset.phId = key;
        await ptDB.putImage(key, processed);
      } catch (e) {
        console.warn('[pt] IDB save failed (non-fatal)', e);
      }
    } catch (e) {
      console.error('[pt] image load failed', e);
      if (hint) hint.innerHTML = '⚠️ 로드 실패';
    }
  }
  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(blob);
    });
  }
  window.PresentationEditor.loadImageInto = loadImageInto;
  window.PresentationEditor.compressImage = compressImageCanvas;
  window.PresentationEditor.convertHeic = convertHeic;

  /* ------------------------------------------------------------
     슬라이드 빌더 — 12개 레이아웃 템플릿 (L1~L12)
     ------------------------------------------------------------ */
  function initSlideBuilder() {
    const layouts = {
      L1: { name: 'L1 · Cover (표지)', icon: '🎯', html: `
<div class="slide cover-slide featured">
  <div class="slide-content">
    <div class="cover">
      <div class="cover-eyebrow ph-text">EYEBROW · 부제</div>
      <h1 class="ph-text">새 표지 — <span class="em">강조 부분</span></h1>
      <div class="cover-sub ph-text">설명 1줄 · <strong>핵심 메시지</strong></div>
    </div>
  </div>
</div>` },
      L2: { name: 'L2 · Section Divider', icon: '📑', html: `
<div class="slide featured">
  <div class="slide-content" style="text-align:center;">
    <div class="ph-text" style="font-size:200px; font-weight:800; color:var(--color-blue); line-height:1; letter-spacing:-8px; opacity:0.4;">02</div>
    <h1 class="ph-text" style="font-size:64px; font-weight:700; letter-spacing:-1.5px; margin-top:-20px;">섹션 제목 <span class="em">강조</span></h1>
    <div class="ph-text" style="font-size:22px; color:var(--label-secondary); margin-top:24px;">한 줄 부제</div>
  </div>
</div>` },
      L3: { name: 'L3 · Hero Image', icon: '🖼️', html: `
<div class="slide">
  <div class="slide-content" style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
    <div class="ph-image" style="max-width:90%; height:75vh; width:1200px; border-radius:22px; box-shadow:0 24px 80px rgba(0,0,0,0.18);"></div>
    <div class="ph-text" style="margin-top:24px; font-size:24px; color:var(--label-secondary); border:none; background:none;">이미지 한 줄 캡션</div>
  </div>
</div>` },
      L4: { name: 'L4 · Quote (인용)', icon: '💬', html: `
<div class="slide student-bg">
  <div class="slide-content" style="display:flex; align-items:center;">
    <div style="max-width:1200px; margin:0 auto;">
      <div class="ph-text" style="font-size:64px; line-height:1.4; font-weight:600; letter-spacing:-1.5px; word-break:keep-all; border:none; background:none;">
        "큰 인용문을 <span style="color:var(--color-blue);">이렇게</span> 강조"
      </div>
      <div class="ph-text" style="margin-top:32px; font-size:18px; color:var(--label-secondary); border:none; background:none;">— 출처</div>
    </div>
  </div>
</div>` },
      L5: { name: 'L5 · Image+Text Split ⭐', icon: '🪟', html: `
<div class="slide">
  <div class="slide-content">
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:56px; max-width:1700px; align-items:center; margin:0 auto;">
      <div class="ph-image" style="width:100%; height:520px; border-radius:22px;"></div>
      <div>
        <div class="ph-text" style="font-size:13px; letter-spacing:1.5px; color:var(--color-blue); font-weight:600; text-transform:uppercase; border:none; background:none; min-height:0; padding:0;">EYEBROW</div>
        <h2 class="ph-text" style="font-size:44px; font-weight:700; letter-spacing:-0.8px; margin:12px 0 20px; border:none; background:none; min-height:0; padding:0;">제목</h2>
        <div class="ph-text" style="font-size:19px; line-height:1.65; word-break:keep-all; border:none; background:none; min-height:0; padding:0;">본문 한 단락. 4 bullets max 또는 짧은 단락.</div>
      </div>
    </div>
  </div>
</div>` },
      L6: { name: 'L6 · Two-Column Compare', icon: '⚖️', html: `
<div class="slide light">
  <div class="slide-content">
    <h2 class="ph-text" style="text-align:center; font-size:34px; font-weight:800; margin-bottom:24px; border:none; background:none; min-height:0; padding:0;">비교 제목</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:28px; max-width:1700px; margin:0 auto;">
      <div style="background:#fff; border:1px solid var(--separator); border-top:6px solid var(--color-red); padding:32px;">
        <div style="font-size:13px; color:var(--color-red); font-weight:800; letter-spacing:1.5px; margin-bottom:12px;">✗ 잘못된</div>
        <div class="ph-text" style="font-size:22px; font-weight:700; margin-bottom:12px; border:none; background:none; min-height:0; padding:0;">잘못된 제목</div>
        <div class="ph-text" style="font-size:17px; line-height:1.6; border:none; background:none; min-height:0; padding:0;">설명</div>
      </div>
      <div style="background:#fff; border:1px solid var(--separator); border-top:6px solid var(--color-green); padding:32px;">
        <div style="font-size:13px; color:var(--color-green); font-weight:800; letter-spacing:1.5px; margin-bottom:12px;">✓ 올바른</div>
        <div class="ph-text" style="font-size:22px; font-weight:700; margin-bottom:12px; border:none; background:none; min-height:0; padding:0;">올바른 제목</div>
        <div class="ph-text" style="font-size:17px; line-height:1.6; border:none; background:none; min-height:0; padding:0;">설명</div>
      </div>
    </div>
  </div>
</div>` },
      L7: { name: 'L7 · Cards Grid (3장)', icon: '🃏', html: `
<div class="slide light">
  <div class="slide-content">
    <h2 class="ph-text" style="text-align:center; font-size:34px; font-weight:800; margin-bottom:28px; border:none; background:none; min-height:0; padding:0;">카드 그리드 제목</h2>
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:22px; max-width:1700px; margin:0 auto;">
      ${[1,2,3].map(i => `
      <div style="background:#fff; border:1px solid var(--separator); border-top:5px solid var(--color-blue); padding:28px;">
        <div class="ph-text" style="font-size:13px; color:var(--color-blue); font-weight:800; letter-spacing:1.5px; margin-bottom:10px; border:none; background:none; min-height:0; padding:0;">카드 ${i}</div>
        <div class="ph-text" style="font-size:24px; font-weight:800; line-height:1.25; margin-bottom:12px; border:none; background:none; min-height:0; padding:0;">제목</div>
        <div class="ph-text" style="font-size:16px; line-height:1.6; border:none; background:none; min-height:0; padding:0;">본문 설명</div>
      </div>`).join('')}
    </div>
  </div>
</div>` },
      L8: { name: 'L8 · Stats / Metrics', icon: '📊', html: `
<div class="slide light">
  <div class="slide-content">
    <h2 class="ph-text" style="text-align:center; font-size:34px; font-weight:800; margin-bottom:28px; border:none; background:none; min-height:0; padding:0;">정량 지표 제목</h2>
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:32px; max-width:1500px; margin:0 auto;">
      ${[1,2,3,4].map(() => `
      <div style="text-align:center; padding:32px;">
        <div class="ph-text" style="font-size:96px; font-weight:800; line-height:1; color:var(--color-blue); letter-spacing:-3px; font-feature-settings:'tnum'; border:none; background:none; min-height:0; padding:0;">00</div>
        <div class="ph-text" style="margin-top:16px; font-size:17px; font-weight:600; border:none; background:none; min-height:0; padding:0;">라벨</div>
        <div class="ph-text" style="margin-top:6px; font-size:13px; color:var(--label-secondary); border:none; background:none; min-height:0; padding:0;">부연</div>
      </div>`).join('')}
    </div>
  </div>
</div>` },
      L9: { name: 'L9 · Diagram (mermaid)', icon: '🔀', html: `
<div class="slide light">
  <div class="slide-content">
    <h2 class="ph-text" style="text-align:center; font-size:30px; font-weight:800; margin-bottom:18px; border:none; background:none; min-height:0; padding:0;">다이어그램 제목</h2>
    <div class="mermaid-wrap" style="max-width:1500px; margin:0 auto; padding:24px; background:#fff; border:1px solid var(--separator);">
      <div class="mermaid">flowchart LR
  A[Step 1] --> B[Step 2] --> C[Step 3]</div>
    </div>
  </div>
</div>` },
      L10: { name: 'L10 · Roadmap (3단계)', icon: '🗺️', html: `
<div class="slide light">
  <div class="slide-content">
    <h2 class="ph-text" style="text-align:center; font-size:34px; font-weight:800; margin-bottom:28px; border:none; background:none; min-height:0; padding:0;">로드맵 제목</h2>
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:24px; max-width:1700px; margin:0 auto;">
      ${[1,2,3].map(i => `
      <div style="background:#fff; border:1px solid var(--separator); padding:28px; position:relative;">
        <div class="ph-text" style="font-size:13px; color:var(--color-blue); font-weight:800; letter-spacing:1.5px; margin-bottom:10px; border:none; background:none; min-height:0; padding:0;">${i}단계</div>
        <div class="ph-text" style="font-size:24px; font-weight:800; margin-bottom:12px; border:none; background:none; min-height:0; padding:0;">단계 제목</div>
        <div class="ph-text" style="font-size:16px; line-height:1.6; border:none; background:none; min-height:0; padding:0;">설명</div>
      </div>`).join('')}
    </div>
  </div>
</div>` },
      L11: { name: 'L11 · Code / Prompt', icon: '💻', html: `
<div class="slide light">
  <div class="slide-content">
    <h2 class="ph-text" style="text-align:center; font-size:30px; font-weight:800; margin-bottom:24px; border:none; background:none; min-height:0; padding:0;">코드 / 프롬프트 제목</h2>
    <div class="ph-text" style="font-family:var(--font-mono); font-size:16px; line-height:1.85; padding:28px 32px; background:#1c1c1e; color:#FAFAF9; max-width:1400px; margin:0 auto; min-height:300px; text-align:left; white-space:pre-wrap; border:none;"># 프롬프트 예시
$ 명령어 입력
출력 결과</div>
  </div>
</div>` },
      L12: { name: 'L12 · Closing', icon: '🎬', html: `
<div class="slide accent-bg">
  <div class="slide-content">
    <div class="closing" style="text-align:center; color:#fff;">
      <h1 class="ph-text" style="font-size:64px; font-weight:900; letter-spacing:-2px; margin-bottom:24px; border:none; background:none; min-height:0; padding:0;">마무리 슬로건<br><span class="em">강조 부분</span></h1>
      <div class="ph-text" style="font-size:22px; opacity:0.95; margin-bottom:20px; border:none; background:none; min-height:0; padding:0;">설명 한 줄</div>
      <div class="ph-text" style="font-size:18px; opacity:0.85; border:none; background:none; min-height:0; padding:0;">오늘 목표 → 한 줄</div>
    </div>
  </div>
</div>` },
    };

    const tb = document.getElementById('ie-toolbar');
    if (!tb) return;
    const addBtn = document.createElement('button');
    addBtn.id = 'sb-add';
    addBtn.textContent = '➕ 새 슬라이드';
    addBtn.style.cssText = 'background:#cb30e0; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:4px;';
    tb.appendChild(addBtn);

    const modal = document.createElement('div');
    modal.id = 'slide-builder-modal';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99998; display:none; align-items:center; justify-content:center; backdrop-filter:blur(8px);';
    modal.innerHTML = `
      <div style="background:#fff; max-width:1100px; max-height:85vh; overflow:auto; padding:32px; border-radius:16px; box-shadow:0 24px 60px rgba(0,0,0,0.4);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 style="font-size:24px; font-weight:800;">새 슬라이드 — 레이아웃 선택</h2>
          <button id="sb-close" style="background:#f2f2f7; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:700;">✕ 닫기</button>
        </div>
        <div style="font-size:14px; color:#666; margin-bottom:16px;">현재 보이는 슬라이드 <strong>다음</strong>에 삽입됩니다. 점선 박스를 클릭/드롭으로 채우세요.</div>
        <div id="sb-grid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px;"></div>
      </div>`;
    document.body.appendChild(modal);

    const grid = modal.querySelector('#sb-grid');
    Object.entries(layouts).forEach(([id, lay]) => {
      const card = document.createElement('div');
      card.style.cssText = 'border:2px solid #e5e5ea; padding:16px; border-radius:12px; cursor:pointer; transition:all 0.15s; background:#fafafc;';
      card.innerHTML = `<div style="font-size:32px; margin-bottom:8px;">${lay.icon}</div><div style="font-size:14px; font-weight:700; color:#000;">${lay.name}</div>`;
      card.addEventListener('mouseenter', () => { card.style.borderColor = '#0088ff'; card.style.background = '#e5f0ff'; });
      card.addEventListener('mouseleave', () => { card.style.borderColor = '#e5e5ea'; card.style.background = '#fafafc'; });
      card.addEventListener('click', () => insertSlide(id, lay));
      grid.appendChild(card);
    });

    addBtn.addEventListener('click', () => modal.style.display = 'flex');
    modal.querySelector('#sb-close').addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    function getCurrentSlide() {
      const slides = Array.from(document.querySelectorAll(_peSel()));
      const center = window.innerHeight / 2;
      let best = null, bestDist = Infinity;
      slides.forEach(s => {
        const r = s.getBoundingClientRect();
        const d = Math.abs((r.top + r.bottom) / 2 - center);
        if (d < bestDist) { bestDist = d; best = s; }
      });
      return best;
    }
    function insertSlide(id, lay) {
      modal.style.display = 'none';
      const wrapper = document.createElement('div');
      wrapper.innerHTML = lay.html.trim();
      const newSlide = wrapper.firstElementChild;
      const cur = getCurrentSlide();
      if (cur && cur.parentNode) cur.parentNode.insertBefore(newSlide, cur.nextSibling);
      else document.body.appendChild(newSlide);
      setupPlaceholders(newSlide);
      if (newSlide.querySelector('.mermaid') && window.mermaid) {
        try { window.mermaid.run({ nodes: newSlide.querySelectorAll('.mermaid') }); } catch(e) {}
      }
      setTimeout(() => newSlide.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }

  /* ------------------------------------------------------------
     내보내기 + 풀스크린 버튼
     ------------------------------------------------------------ */
  function initExporter() {
    const tb = document.getElementById('ie-toolbar');
    if (!tb) return;
    const exBtn = document.createElement('button');
    exBtn.textContent = '📥 HTML 내보내기';
    exBtn.style.cssText = 'background:#34c759; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:4px;';
    tb.appendChild(exBtn);

    const fsBtn = document.createElement('button');
    fsBtn.textContent = '⛶ 전체화면 (F)';
    fsBtn.style.cssText = 'background:#1c1c1e; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:4px;';
    tb.appendChild(fsBtn);
    fsBtn.addEventListener('click', toggleFullscreen);

    // PDF 인쇄 — 슬라이드별 페이지 분리, 편집 UI 숨김 (빠름·작음)
    const pdfBtn = document.createElement('button');
    pdfBtn.textContent = '📄 PDF (인쇄)';
    pdfBtn.title = 'window.print() — 빠름, 파일 작음, 그라데이션·한글 폰트는 fallback';
    pdfBtn.style.cssText = 'background:#ff8d28; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:4px;';
    tb.appendChild(pdfBtn);
    pdfBtn.addEventListener('click', () => window.print());

    // PDF 고품질 — html2canvas + jsPDF, 시각 100% (그라데이션·한글 폰트·mermaid 그대로)
    const pdfHqBtn = document.createElement('button');
    pdfHqBtn.textContent = '📄 PDF 고품질 (이미지)';
    pdfHqBtn.title = 'jsPDF + html2canvas 동적 로드. 시각 충실도 100%, 파일 큼 (15~25MB)';
    pdfHqBtn.style.cssText = 'background:#cb30e0; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:4px;';
    tb.appendChild(pdfHqBtn);
    pdfHqBtn.addEventListener('click', () => window.PresentationEditor.exportPdfHighQuality());

    // 모바일 PDF 보기 (모바일에서만 표시)
    if (window.PresentationEditor.isMobile && window.PresentationEditor.isMobile()) {
      const pdfMobileBtn = document.createElement('button');
      pdfMobileBtn.textContent = '📱 PDF 새 탭 (가로)';
      pdfMobileBtn.title = '모바일 PDF 뷰어에서 열기 — 좌우 회전 + pinch-zoom 지원';
      pdfMobileBtn.style.cssText = 'background:#0088ff; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:4px;';
      tb.appendChild(pdfMobileBtn);
      pdfMobileBtn.addEventListener('click', () => window.PresentationEditor.viewPdfMobile());
    }

    // 인쇄 직전 — 그라데이션 텍스트 인라인 style 직접 교체 (CSS !important 보다 확실)
    window.addEventListener('beforeprint', () => {
      const targets = [];
      document.querySelectorAll('h1, h2, h3, h4, span, div, p, strong, em, a').forEach(el => {
        const cs = getComputedStyle(el);
        const fill = cs.webkitTextFillColor || cs.getPropertyValue('-webkit-text-fill-color');
        const clip = cs.webkitBackgroundClip || cs.getPropertyValue('-webkit-background-clip') || cs.backgroundClip;
        const isTransparent = fill && (fill === 'rgba(0, 0, 0, 0)' || fill === 'transparent');
        const isBgClipText = clip === 'text';
        if (isTransparent || isBgClipText) targets.push(el);
      });
      // 현재 테마 기반 fallback 색상 (sunset / classic / ios26)
      const theme = (window.PresentationEditor && window.PresentationEditor.theme) || 'ios26';
      const themeFallback = {
        ios26:   '#6155f5',  // 인디고
        sunset:  '#ff8d28',  // 오렌지
        classic: '#2d2dff'   // 일렉트릭 블루
      }[theme] || '#6155f5';
      targets.forEach(el => {
        el.dataset.printSavedStyle = el.getAttribute('style') || '';
        const onAccent = el.closest('.accent-bg');
        const color = onAccent ? '#FFD60A' : themeFallback;
        el.style.setProperty('background', 'none', 'important');
        el.style.setProperty('background-image', 'none', 'important');
        el.style.setProperty('-webkit-background-clip', 'border-box', 'important');
        el.style.setProperty('background-clip', 'border-box', 'important');
        el.style.setProperty('-webkit-text-fill-color', color, 'important');
        el.style.setProperty('color', color, 'important');
        el.style.setProperty('padding-right', '0.25em', 'important');
        el.style.setProperty('letter-spacing', 'normal', 'important');
      });
    });
    window.addEventListener('afterprint', () => {
      document.querySelectorAll('[data-print-saved-style]').forEach(el => {
        const saved = el.dataset.printSavedStyle;
        if (saved) el.setAttribute('style', saved);
        else el.removeAttribute('style');
        delete el.dataset.printSavedStyle;
      });
    });

    // ⚠ width 는 initAspectToggle 에서 body class 기반으로 동적 적용 (16:9 = 1920px / 4:3 = 1440px)
    const printStyle = document.createElement('style');
    printStyle.id = 'pt-print-styles';
    printStyle.textContent = `
      @media print {
        html, body {
          height: auto !important; overflow: visible !important;
          margin: 0 !important; padding: 0 !important;
          scroll-snap-type: none !important;
        }
        .slide {
          page-break-after: always !important; break-after: page !important;
          page-break-inside: avoid !important; break-inside: avoid !important;
          height: 1080px !important;
          overflow: hidden !important; box-shadow: none !important;
          margin: 0 !important;
        }
        .slide:last-of-type, .slide:last-child {
          page-break-after: avoid !important; break-after: avoid !important;
        }
        #ie-toolbar, #slide-builder-modal, #slide-counter, .edit-fab,
        .ph-controls, .ph-hint { display: none !important; }
        .ph-image, .ph-text { border: none !important; background: none !important; }

        /* 그라데이션 텍스트(-webkit-background-clip:text) PDF 깨짐 fallback
           .em 클래스 + beforeprint 자동 마킹된 인라인 style span 모두 적용 */
        .cover h1 .em, .em,
        [data-print-gradient-fallback] {
          background: none !important; background-image: none !important;
          -webkit-background-clip: initial !important; background-clip: initial !important;
          -webkit-text-fill-color: var(--print-fallback-color, #6155f5) !important;
          color: var(--print-fallback-color, #6155f5) !important;
          padding-right: 0.06em !important;
        }
        .slide.accent-bg .em,
        .slide.accent-bg [data-print-gradient-fallback] {
          -webkit-text-fill-color: #FFD60A !important; color: #FFD60A !important;
        }

        /* 강사 노트 — 라이트/accent-bg 분기 */
        .note-bar { background: #f2f2f7 !important; color: #1c1c1e !important; }
        .slide.accent-bg .note-bar {
          background: rgba(0,0,0,0.35) !important; color: #fff !important;
        }
        .slide.accent-bg .note-bar * { color: #fff !important; }
        .slide.accent-bg .note-bar .note-label { color: #FFD60A !important; }

        *, *::before, *::after {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(printStyle);

    exBtn.addEventListener('click', () => {
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll('#ie-toolbar, #slide-builder-modal, #slide-counter').forEach(el => el.remove());
      clone.querySelectorAll('.ie-selected, .dragover').forEach(el => el.classList.remove('ie-selected', 'dragover'));
      clone.querySelectorAll('[data-ie-edit-temp="1"]').forEach(el => {
        el.removeAttribute('contenteditable');
        el.removeAttribute('data-ie-edit-temp');
      });
      const html = '<!DOCTYPE html>\n' + clone.outerHTML;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
      const base = (location.pathname.split('/').pop() || 'slides').replace(/\.html?$/, '');
      a.href = url;
      a.download = `${base}__aspect-16to9__${ts}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  function toggleFullscreen() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) {
      // iframe 안이면 fullscreen 불가 (parent allow="fullscreen" 필수) → 새 탭으로 폴백
      window.PresentationEditor.tryFullscreen(document.documentElement);
    } else {
      try { (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document); } catch(_) {}
    }
  }

  /* ------------------------------------------------------------
     화면 비율 토글 — 16:9 (기본) ↔ 4:3 (레터박스)
     ------------------------------------------------------------ */
  function initAspectToggle() {
    const tb = document.getElementById('ie-toolbar');
    if (!tb) return;
    const ASPECT_KEY = 'ie-aspect-mode-' + (location.pathname.split('/').pop() || 'page');
    let is43 = localStorage.getItem(ASPECT_KEY) === '4-3';

    // 화면 미리보기 — @media screen 으로 print 영향 차단
    const aspectStyle = document.createElement('style');
    aspectStyle.id = 'ie-aspect-style';
    aspectStyle.textContent = `
      @media screen {
        body.aspect-4-3 { background: #000 !important; }
        body.aspect-4-3 .slide {
          width: min(100vw, 133.333vh) !important;
          height: 100vh !important;
          margin: 0 auto !important;
        }
      }
    `;
    document.head.appendChild(aspectStyle);

    // 인쇄용 동적 룰 — body class 에 따라 @page size + .slide width 자동 변경
    const printAspectStyle = document.createElement('style');
    printAspectStyle.id = 'ie-print-aspect';
    document.head.appendChild(printAspectStyle);

    const btn = document.createElement('button');
    btn.style.cssText = 'background:#6155f5; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:4px;';
    tb.appendChild(btn);

    function applyAspect() {
      document.body.classList.toggle('aspect-4-3', is43);
      btn.textContent = is43 ? '🖼️ 현재 4:3 (→ 16:9)' : '🖼️ 현재 16:9 (→ 4:3)';
      const w = is43 ? 1440 : 1920;
      printAspectStyle.textContent = `
        @media print {
          @page { size: ${w}px 1080px; margin: 0; }
          body${is43 ? '.aspect-4-3' : ':not(.aspect-4-3)'} .slide {
            width: ${w}px !important;
          }
          body${is43 ? '.aspect-4-3' : ''} { background: #fff !important; }
        }
      `;
    }
    applyAspect();

    btn.addEventListener('click', () => {
      is43 = !is43;
      localStorage.setItem(ASPECT_KEY, is43 ? '4-3' : '16-9');
      applyAspect();
    });

    // 별도 버튼 — 4:3 전용 HTML 파일 생성 (현재 DOM + 4:3 베이크인)
    const exp43Btn = document.createElement('button');
    exp43Btn.textContent = '📥 4:3 별도 HTML 생성';
    exp43Btn.style.cssText = 'background:#6155f5; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:4px; opacity:0.85;';
    tb.appendChild(exp43Btn);
    exp43Btn.addEventListener('click', () => {
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll('#ie-toolbar, #slide-builder-modal, #slide-counter, #ie-aspect-style').forEach(el => el.remove());
      clone.querySelectorAll('.ie-selected, .dragover').forEach(el => el.classList.remove('ie-selected', 'dragover'));
      clone.querySelectorAll('[data-ie-edit-temp="1"]').forEach(el => {
        el.removeAttribute('contenteditable');
        el.removeAttribute('data-ie-edit-temp');
      });
      const cBody = clone.querySelector('body');
      if (cBody) cBody.classList.add('aspect-4-3');
      // <title> 에 [4:3] prefix
      const titleEl = clone.querySelector('title');
      if (titleEl && !/\[4:3\]/.test(titleEl.textContent)) {
        titleEl.textContent = '[4:3] ' + titleEl.textContent;
      }
      // 메타 표식
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'aspect-ratio');
      meta.setAttribute('content', '4:3 (1440x1080)');
      clone.querySelector('head').appendChild(meta);
      const cStyle = document.createElement('style');
      cStyle.setAttribute('data-aspect', '4-3');
      cStyle.textContent = `
        /* === 4:3 전용 강제 CSS (베이크인) === */
        body.aspect-4-3 { background: #000 !important; }
        body.aspect-4-3 .slide {
          width: min(100vw, 133.333vh) !important;
          height: 100vh !important;
          margin: 0 auto !important;
        }
        @media print {
          @page { size: 1440px 1080px; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; }
          body.aspect-4-3 .slide {
            width: 1440px !important; height: 1080px !important; margin: 0 !important;
          }
          body.aspect-4-3 { background: #fff !important; }
        }
      `;
      clone.querySelector('head').appendChild(cStyle);
      const html = '<!DOCTYPE html>\n<!-- Generated: aspect-ratio 4:3 (1440x1080) -->\n' + clone.outerHTML;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
      const base = (location.pathname.split('/').pop() || 'slides').replace(/\.html?$/, '');
      a.href = url;
      a.download = `${base}__aspect-4to3__${ts}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  /* ------------------------------------------------------------
     슬라이드 네비게이션 — 키보드 + 카운터
     ------------------------------------------------------------ */
  function initSlideNav() {
    const slides = () => Array.from(document.querySelectorAll(_peSel()));
    function getCurrentIdx() {
      const list = slides();
      const center = window.innerHeight / 2;
      let bestIdx = 0, bestDist = Infinity;
      list.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const d = Math.abs((r.top + r.bottom) / 2 - center);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      return bestIdx;
    }
    function goTo(idx) {
      const list = slides();
      const clamped = Math.max(0, Math.min(list.length - 1, idx));
      list[clamped].scrollIntoView({ behavior: 'smooth', block: 'start' });
      updateCounter();
    }

    const counter = document.createElement('div');
    counter.id = 'slide-counter';
    counter.style.cssText = 'position:fixed; bottom:14px; left:14px; z-index:99997; background:rgba(28,28,30,0.85); color:#fff; padding:6px 12px; border-radius:100px; font-size:12px; font-weight:700; backdrop-filter:blur(20px); font-family:"SF Mono",monospace; letter-spacing:0.5px; pointer-events:none;';
    document.body.appendChild(counter);

    function updateCounter() {
      const idx = getCurrentIdx();
      const total = slides().length;
      counter.textContent = `${idx + 1} / ${total}  ←→ 이동 · F 풀스크린`;
    }
    updateCounter();
    let scrollTimer;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(updateCounter, 80);
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const cur = getCurrentIdx();
      switch (e.key) {
        case 'ArrowDown': case 'ArrowRight': case 'PageDown': case ' ':
          e.preventDefault(); goTo(cur + 1); break;
        case 'ArrowUp': case 'ArrowLeft': case 'PageUp':
          e.preventDefault(); goTo(cur - 1); break;
        case 'Home': e.preventDefault(); goTo(0); break;
        case 'End': e.preventDefault(); goTo(slides().length - 1); break;
        case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
      }
    });
  }

  /* ------------------------------------------------------------
     슬라이드 QR — 모든 슬라이드 좌상단에 발표자료 URL QR 코드
     200인치+ 화면용. 클릭 시 모달 확대 (뒷자리 캡처용)
     필요: <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>
     ------------------------------------------------------------ */
  function initSlideQR() {
    if (typeof qrcode === 'undefined') {
      console.warn('[SlideQR] qrcode-generator 미로드 — qrcode-generator CDN 추가 필요');
      return;
    }
    // canonical URL 결정 (iframe / axhub 도메인 / 로컬 분기)
    const canonicalUrl = (function() {
      const slugMatch = location.pathname.match(/\/pt\/([^/]+)/);
      try {
        if (window.parent !== window && window.parent.location.href) {
          return window.parent.location.href.split('?')[0].replace(/\/raw\/?$/, '');
        }
      } catch(e) {}
      if (slugMatch) {
        return location.origin + '/pt/' + slugMatch[1];
      }
      return location.href;
    })();

    const qr = qrcode(0, 'M');
    qr.addData(canonicalUrl);
    qr.make();
    const svgString = qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });

    const qrStyle = document.createElement('style');
    qrStyle.id = 'slide-qr-style';
    qrStyle.textContent = `
      .slide { position: relative; }
      .slide-qr {
        position: absolute; top: 14px; left: 14px;
        width: 80px; height: 80px;
        background: rgba(255,255,255,0.95);
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 6px; padding: 5px; z-index: 10;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
      }
      .slide-qr:hover { transform: scale(1.06); box-shadow: 0 6px 18px rgba(0,0,0,0.18); }
      .slide-qr svg { width: 100%; height: 100%; display: block; pointer-events: none; }
      .slide.accent-bg .slide-qr { background: rgba(255,255,255,0.98); border-color: rgba(255,255,255,0.6); }
      .slide.cover-slide .slide-qr { width: 70px; height: 70px; top: 12px; left: 12px; }
      /* 챕터 태그 가운데 정렬 (QR 과 자리 겹침 방지) */
      .slide-topbar { position: relative; justify-content: flex-end; }
      .slide-topbar .chapter-tag {
        position: absolute; left: 50%; top: 16px;
        transform: translateX(-50%); margin: 0;
      }
      /* 확대 모달 */
      .slide-qr-modal {
        position: fixed; inset: 0; z-index: 99996;
        background: rgba(0,0,0,0.86);
        display: flex; align-items: center; justify-content: center;
        flex-direction: column; gap: 24px;
        backdrop-filter: blur(8px); cursor: zoom-out;
        animation: slideQrFadeIn 0.18s ease-out;
      }
      @keyframes slideQrFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .slide-qr-modal .qr-big {
        width: min(80vh, 80vw, 720px); height: min(80vh, 80vw, 720px);
        background: #fff; padding: 28px; border-radius: 18px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.5);
      }
      .slide-qr-modal .qr-big svg { width: 100%; height: 100%; display: block; }
      .slide-qr-modal .qr-url {
        color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;
        text-align: center; max-width: 90vw; word-break: break-all;
        font-family: 'SF Mono', Menlo, monospace;
        background: rgba(255,255,255,0.08); padding: 12px 22px; border-radius: 10px;
      }
      .slide-qr-modal .qr-hint {
        color: rgba(255,255,255,0.6); font-size: 14px;
        font-weight: 500; letter-spacing: 1px;
      }
      .slide-qr-modal .qr-close {
        position: absolute; top: 24px; right: 24px;
        background: rgba(255,255,255,0.12); color: #fff; border: none;
        width: 48px; height: 48px; border-radius: 50%; cursor: pointer;
        font-size: 20px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
      }
      .slide-qr-modal .qr-close:hover { background: rgba(255,255,255,0.22); }
      @media print { .slide-qr { display: block !important; } }
    `;
    document.head.appendChild(qrStyle);

    function openQrModal() {
      if (document.querySelector('.slide-qr-modal')) return;
      const modal = document.createElement('div');
      modal.className = 'slide-qr-modal';
      modal.innerHTML = `
        <button class="qr-close" title="닫기 (Esc)">✕</button>
        <div class="qr-big">${svgString}</div>
        <div class="qr-url">${canonicalUrl}</div>
        <div class="qr-hint">클릭 또는 ESC 로 닫기</div>
      `;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.addEventListener('click', (e) => {
        if (e.target.closest('.qr-big')) return;
        close();
      });
      modal.querySelector('.qr-close').addEventListener('click', close);
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          close();
          document.removeEventListener('keydown', onKey, true);
        }
      };
      document.addEventListener('keydown', onKey, true);
    }

    function injectIntoSlide(slide) {
      if (slide.querySelector('.slide-qr')) return;
      const wrap = document.createElement('div');
      wrap.className = 'slide-qr';
      wrap.setAttribute('role', 'button');
      wrap.setAttribute('aria-label', 'QR 코드 확대 보기');
      wrap.setAttribute('title', '클릭해서 크게 보기');
      wrap.innerHTML = svgString;
      wrap.addEventListener('click', (e) => {
        e.stopPropagation();
        openQrModal();
      });
      slide.appendChild(wrap);
    }
    document.querySelectorAll(_peSel()).forEach(injectIntoSlide);

    // 슬라이드 빌더로 추가된 새 슬라이드도 자동 주입
    new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.classList && node.classList.contains('slide')) {
            injectIntoSlide(node);
          }
        });
      });
    }).observe(document.body, { childList: true });
  }

  /* ------------------------------------------------------------
     버전 관리 — 💾 서버 저장 (새 버전) + 📜 버전 목록 + 자동저장
     백엔드: ax_admin Api::V1::PresentationVersionsController
     인증: 발표자료 owner 만 (cookie session)
     ------------------------------------------------------------ */
  function initVersionManager() {
    const tb = document.getElementById('ie-toolbar');
    if (!tb) return;

    // /pt/{slug} 경로 아니면 비활성화
    const slugMatch = location.pathname.match(/\/pt\/([^/]+)/);
    if (!slugMatch) {
      console.log('[VersionManager] /pt/{slug} 경로 아님 — 비활성화');
      return;
    }
    const slug = slugMatch[1];
    const AUTOSAVE_KEY = 'ie-autosave-' + slug;

    // iframe 안이면 부모 origin 사용
    const apiBase = (function() {
      try {
        if (window.parent !== window && window.parent.location.origin) {
          return window.parent.location.origin;
        }
      } catch(e) {}
      return location.origin;
    })();

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 서버 저장 (새 버전)';
    saveBtn.style.cssText = 'background:#cb30e0; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:4px;';
    tb.appendChild(saveBtn);

    const versionsBtn = document.createElement('button');
    versionsBtn.textContent = '📜 버전 목록';
    versionsBtn.style.cssText = 'background:#1c1c1e; color:#fff; border:1px solid rgba(255,255,255,0.2); padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer; margin-top:4px;';
    tb.appendChild(versionsBtn);

    const status = document.createElement('div');
    status.style.cssText = 'font-size:10px; color:rgba(255,255,255,0.55); margin-top:2px; line-height:1.4;';
    status.textContent = '자동저장 OFF (편집 시 활성)';
    tb.appendChild(status);

    let autosaveTimer;
    function scheduleAutosave() {
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        try {
          const html = serializeCurrentDOM();
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
            html, savedAt: new Date().toISOString()
          }));
          status.textContent = '✓ 자동저장됨 ' + new Date().toLocaleTimeString('ko-KR');
          status.style.color = 'rgba(52,199,89,0.9)';
        } catch (e) {
          status.textContent = '⚠ 자동저장 실패: ' + e.message;
          status.style.color = '#ff8d28';
        }
      }, 5000);
    }
    document.addEventListener('input', (e) => {
      if (e.target.isContentEditable) {
        status.textContent = '편집 중… (5초 후 자동저장)';
        status.style.color = 'rgba(255,255,255,0.7)';
        scheduleAutosave();
      }
    });

    // 자동저장 복원 안내
    try {
      const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null');
      if (saved && saved.savedAt) {
        const ageMin = (Date.now() - new Date(saved.savedAt)) / 60000;
        if (ageMin < 60 * 24 * 7) {
          status.textContent = `📝 미저장 자동저장 있음 (${Math.round(ageMin)}분 전) — 클릭해서 복원`;
          status.style.color = '#FFD60A';
          status.style.cursor = 'pointer';
          status.addEventListener('click', () => {
            if (!confirm('자동저장본으로 복원하시겠습니까? 현재 보이는 내용이 덮어써집니다.')) return;
            document.documentElement.innerHTML = saved.html;
            status.textContent = '✓ 복원됨 — 새로고침 권장';
          }, { once: true });
        }
      }
    } catch(e) {}

    function serializeCurrentDOM() {
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll('#ie-toolbar, #slide-builder-modal, #slide-counter, #ie-aspect-style, #ie-print-aspect, .slide-qr-modal').forEach(el => el.remove());
      clone.querySelectorAll('.ie-selected, .dragover').forEach(el => el.classList.remove('ie-selected', 'dragover'));
      clone.querySelectorAll('[data-ie-edit-temp="1"]').forEach(el => {
        el.removeAttribute('contenteditable');
        el.removeAttribute('data-ie-edit-temp');
      });
      return '<!DOCTYPE html>\n' + clone.outerHTML;
    }

    saveBtn.addEventListener('click', async () => {
      const label = prompt(
        '버전 라벨을 입력하세요 (선택):\n예) "오타 수정", "발표 직전 마지막 손질"\n\n빈칸이면 자동으로 v{N} 으로 저장됩니다.',
        ''
      );
      if (label === null) return;
      if (!confirm('새 버전으로 서버에 저장하시겠습니까?\n원본은 보존되며, 이 버전이 활성화됩니다.')) return;

      saveBtn.disabled = true;
      saveBtn.textContent = '💾 저장 중…';
      try {
        const html = serializeCurrentDOM();
        const csrfToken = await getCsrfToken();
        const res = await fetch(`${apiBase}/api/v1/presentations/${slug}/versions`, {
          method: 'POST', credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken, 'Accept': 'application/json'
          },
          body: JSON.stringify({ html_content: html, label: label || null })
        });
        if (res.status === 401) {
          alert(`로그인이 필요합니다.\n\n${apiBase}/login 에서 로그인 후 다시 시도하세요.`);
          window.open(`${apiBase}/login`, '_blank');
          return;
        }
        if (res.status === 403) { alert('본인 발표자료만 저장할 수 있습니다.'); return; }
        const data = await res.json();
        if (!res.ok) throw new Error((data.errors && JSON.stringify(data.errors)) || res.statusText);
        const v = data.version;
        alert(`✅ 저장 완료\nv${v.version_number} · ${v.label}\n${(v.html_size/1024).toFixed(1)} KB`);
        localStorage.removeItem(AUTOSAVE_KEY);
        status.textContent = `✓ 서버 저장됨: v${v.version_number}`;
        status.style.color = 'rgba(52,199,89,0.9)';
      } catch (e) {
        alert('❌ 저장 실패: ' + e.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 서버 저장 (새 버전)';
      }
    });

    versionsBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`${apiBase}/api/v1/presentations/${slug}/versions`, {
          credentials: 'include', headers: { 'Accept': 'application/json' }
        });
        if (res.status === 401) { alert('로그인이 필요합니다.'); return; }
        const data = await res.json();
        if (!res.ok) throw new Error(res.statusText);
        showVersionsModal(data.versions || []);
      } catch (e) { alert('버전 조회 실패: ' + e.message); }
    });

    function showVersionsModal(versions) {
      const old = document.getElementById('version-modal');
      if (old) old.remove();
      const modal = document.createElement('div');
      modal.id = 'version-modal';
      modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99998; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px);';
      modal.innerHTML = `
        <div style="background:#fff; max-width:680px; width:90vw; max-height:80vh; overflow:auto; padding:28px; border-radius:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
            <h2 style="font-size:22px; font-weight:800;">📜 버전 목록 (${versions.length}개)</h2>
            <button id="vm-close" style="background:#f2f2f7; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-weight:700;">✕</button>
          </div>
          <div style="font-size:13px; color:#666; margin-bottom:14px;">버전을 클릭하면 해당 버전을 활성화(롤백)합니다. 원본은 항상 보존됩니다.</div>
          <div id="vm-list" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#vm-close').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

      const list = modal.querySelector('#vm-list');
      versions.forEach(v => {
        const item = document.createElement('div');
        const active = v.is_active;
        item.style.cssText = `border:1px solid ${active ? '#34c759' : '#e5e5ea'}; background:${active ? '#f0fff5' : '#fafafc'}; padding:14px 16px; border-radius:10px; cursor:${active ? 'default' : 'pointer'};`;
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <div>
              <span style="font-weight:800; font-size:16px;">v${v.version_number}</span>
              ${active ? '<span style="margin-left:8px; padding:2px 8px; background:#34c759; color:#fff; font-size:11px; border-radius:100px; font-weight:700;">현재</span>' : ''}
              <span style="margin-left:8px; color:#666; font-size:14px;">${v.label}</span>
            </div>
            <div style="font-size:12px; color:#999;">${v.html_size ? (v.html_size/1024).toFixed(1)+' KB' : ''}</div>
          </div>
          <div style="font-size:11px; color:#888; margin-top:4px;">
            ${new Date(v.created_at).toLocaleString('ko-KR')}
            ${v.created_by ? ' · ' + v.created_by.username : ''}
          </div>`;
        if (!active) {
          item.addEventListener('click', async () => {
            if (!confirm(`v${v.version_number} (${v.label}) 으로 롤백하시겠습니까?\n현재 보이는 화면이 이 버전으로 교체되고 페이지 새로고침됩니다.`)) return;
            try {
              const csrfToken = await getCsrfToken();
              const res = await fetch(`${apiBase}/api/v1/presentations/${slug}/versions/${v.id}/activate`, {
                method: 'POST', credentials: 'include',
                headers: { 'X-CSRF-Token': csrfToken, 'Accept': 'application/json' }
              });
              if (!res.ok) throw new Error(res.statusText);
              alert(`✅ v${v.version_number} 활성화됨 — 새로고침합니다.`);
              location.reload();
            } catch (e) { alert('활성화 실패: ' + e.message); }
          });
        }
        list.appendChild(item);
      });
    }

    async function getCsrfToken() {
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (meta) return meta.getAttribute('content');
      try {
        const parentMeta = window.parent.document.querySelector('meta[name="csrf-token"]');
        if (parentMeta) return parentMeta.getAttribute('content');
      } catch(e) {}
      try {
        const res = await fetch(`${apiBase}/`, { credentials: 'include' });
        const text = await res.text();
        const match = text.match(/<meta name="csrf-token" content="([^"]+)"/);
        if (match) return match[1];
      } catch(e) {}
      return '';
    }
  }

  /* ============================================================
     Font Picker — 큐레이션된 한글+영문 폰트 페어
     Google Fonts / jsDelivr 에서 동적 로드. localStorage 기억.
     ============================================================ */
  var FONT_PAIRS = {
    'ios-pro': {
      name: 'iOS Pro',
      sub: '시스템 미니멀',
      display: "'SF Pro Display', 'Pretendard Variable', sans-serif",
      body: "'Pretendard Variable', 'Pretendard', 'SF Pro', sans-serif",
      mono: "'SF Mono', Menlo, Consolas, monospace",
      load: ['https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css'],
      previewKr: '발표자료',
      previewEn: 'Presentation'
    },
    'outfit-pretendard': {
      name: 'Outfit · Pretendard',
      sub: 'Vivid · 단단한 인상',
      display: "'Outfit', 'Pretendard Variable', sans-serif",
      body: "'Pretendard Variable', 'Pretendard', sans-serif",
      mono: "'JetBrains Mono', 'SF Mono', monospace",
      load: [
        'https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css',
        'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap'
      ],
      previewKr: '프레젠테이션',
      previewEn: 'Presentation'
    },
    'noto-modern': {
      name: 'Inter · Noto Sans KR',
      sub: '클래식 · 가독성 1등',
      display: "'Inter', 'Noto Sans KR', sans-serif",
      body: "'Noto Sans KR', 'Inter', sans-serif",
      mono: "'JetBrains Mono', monospace",
      load: ['https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Sans+KR:wght@400;500;700;900&display=swap'],
      previewKr: '발표 자료',
      previewEn: 'Presentation'
    },
    'spoqa': {
      name: 'Outfit · Spoqa',
      sub: '감성 · 부드러운',
      display: "'Outfit', 'Spoqa Han Sans Neo', sans-serif",
      body: "'Spoqa Han Sans Neo', 'Outfit', sans-serif",
      mono: "'JetBrains Mono', monospace",
      load: [
        'https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@latest/css/SpoqaHanSansNeo.css',
        'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap'
      ],
      previewKr: '발표자료',
      previewEn: 'Presentation'
    },
    'gmarket': {
      name: 'Gmarket Sans',
      sub: '강한 디스플레이',
      display: "'Gmarket Sans', 'Pretendard Variable', sans-serif",
      body: "'Pretendard Variable', sans-serif",
      mono: "'JetBrains Mono', monospace",
      load: [
        'https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css',
        'https://hangeul.pstatic.net/hangeul_static/css/gmarket-sans.css'
      ],
      previewKr: '발표자료',
      previewEn: 'Presentation'
    },
    'serif-editorial': {
      name: 'Playfair · Noto Serif KR',
      sub: '에디토리얼 · 격조',
      display: "'Playfair Display', 'Noto Serif KR', serif",
      body: "'Noto Serif KR', 'Playfair Display', serif",
      mono: "'JetBrains Mono', monospace",
      load: ['https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Noto+Serif+KR:wght@400;500;700;900&display=swap'],
      previewKr: '발표 자료',
      previewEn: 'Presentation'
    }
  };
  var FONT_STORAGE_KEY = 'pt-font-' + (location.pathname.split('/').pop() || 'page');

  function loadFontStylesheets(urls) {
    urls.forEach(function (url) {
      // skip if already loaded
      if (document.querySelector('link[data-pt-font="' + url + '"]')) return;
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.dataset.ptFont = url;
      document.head.appendChild(link);
    });
  }

  function applyFontPair(key) {
    var pair = FONT_PAIRS[key];
    if (!pair) return;
    loadFontStylesheets(pair.load || []);

    var styleEl = document.getElementById('pt-font-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'pt-font-style';
      document.head.appendChild(styleEl);
    }
    // Override CSS variables — affects both legacy --font-family and new --pt-font-*
    styleEl.textContent = [
      ':root, .pt-theme-ios26, .pt-theme-classic, .pt-theme-sunset {',
      '  --font-family: ' + pair.body + ' !important;',
      '  --font-mono: ' + pair.mono + ' !important;',
      '  --pt-font-family: ' + pair.body + ' !important;',
      '  --pt-font-display: ' + pair.display + ' !important;',
      '  --pt-font-mono: ' + pair.mono + ' !important;',
      '}',
      'body { font-family: ' + pair.body + ' !important; }',
      'h1, h2, h3, h4, .em, .cover h1, .closing h1, .section-title {',
      '  font-family: ' + pair.display + ' !important;',
      '}',
      'code, pre, kbd, .code-block, .cmd-block { font-family: ' + pair.mono + ' !important; }'
    ].join('\n');

    try { localStorage.setItem(FONT_STORAGE_KEY, key); } catch (_) {}
    window.PresentationEditor.fontPair = key;

    // Update picker UI selection state
    var picker = document.getElementById('pt-font-picker');
    if (picker) {
      Array.prototype.forEach.call(picker.querySelectorAll('button[data-font]'), function (b) {
        b.style.borderColor = b.dataset.font === key ? '#0088ff' : 'transparent';
        b.style.background = b.dataset.font === key ? 'rgba(0,136,255,.12)' : 'rgba(255,255,255,.06)';
      });
    }
  }
  window.PresentationEditor.applyFontPair = applyFontPair;
  window.PresentationEditor.fontPairs = FONT_PAIRS;

  function initFontPicker() {
    var tb = document.getElementById('ie-toolbar');
    if (!tb) { return setTimeout(initFontPicker, 50); }
    if (tb.querySelector('.pt-font-row')) return;

    // Restore saved font
    var saved = null;
    try { saved = localStorage.getItem(FONT_STORAGE_KEY); } catch (_) {}
    var initial = saved && FONT_PAIRS[saved] ? saved : null;
    if (initial) applyFontPair(initial);

    var row = document.createElement('div');
    row.className = 'pt-font-row';
    row.style.cssText = 'display:flex; align-items:center; gap:6px; padding:4px 0 2px; border-top:1px solid rgba(255,255,255,.10);';

    var label = document.createElement('span');
    label.textContent = '🔤 폰트';
    label.style.cssText = 'font-size:11px; opacity:0.7; margin-right:4px;';
    row.appendChild(label);

    var btnRow = document.createElement('button');
    btnRow.type = 'button';
    btnRow.id = 'pt-font-toggle';
    btnRow.textContent = (FONT_PAIRS[window.PresentationEditor.fontPair] && FONT_PAIRS[window.PresentationEditor.fontPair].name) || '기본';
    btnRow.title = '폰트 페어 변경';
    btnRow.style.cssText = [
      'flex:1','background:rgba(255,255,255,.10)','color:#fff','border:none',
      'padding:5px 10px','border-radius:6px',
      'font-size:11px','font-weight:600','cursor:pointer','text-align:left',
      'transition:background .15s'
    ].join(';');
    btnRow.addEventListener('mouseenter', function () { btnRow.style.background = 'rgba(255,255,255,.18)'; });
    btnRow.addEventListener('mouseleave', function () { btnRow.style.background = 'rgba(255,255,255,.10)'; });
    btnRow.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePickerModal();
    });
    row.appendChild(btnRow);
    tb.appendChild(row);

    // Modal picker
    function togglePickerModal() {
      var existing = document.getElementById('pt-font-picker');
      if (existing) { existing.remove(); return; }

      var picker = document.createElement('div');
      picker.id = 'pt-font-picker';
      picker.style.cssText = [
        'position:fixed','top:14px','right:14px',
        'background:rgba(28,28,30,0.96)','backdrop-filter:blur(20px)',
        '-webkit-backdrop-filter:blur(20px)','color:#fff',
        'border-radius:14px','padding:14px','min-width:320px','max-width:380px',
        'box-shadow:0 12px 40px rgba(0,0,0,.45)','z-index:99999',
        'font-family:-apple-system,sans-serif'
      ].join(';');

      var header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px';
      header.innerHTML = '<span style="font-size:13px;font-weight:700">🔤 폰트 페어 선택</span>';
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.style.cssText = 'background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:0 4px;line-height:1';
      closeBtn.addEventListener('click', function () { picker.remove(); });
      header.appendChild(closeBtn);
      picker.appendChild(header);

      var list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:6px;max-height:460px;overflow-y:auto';
      Object.keys(FONT_PAIRS).forEach(function (key) {
        var pair = FONT_PAIRS[key];
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.font = key;
        b.style.cssText = [
          'display:block','width:100%','text-align:left',
          'background:rgba(255,255,255,.06)','color:#fff',
          'border:2px solid transparent','padding:10px 12px',
          'border-radius:10px','cursor:pointer',
          'transition:background .12s,border-color .12s',
          'font-family:inherit'
        ].join(';');
        b.innerHTML = [
          '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px">',
          '  <span style="font-size:13px;font-weight:700">' + pair.name + '</span>',
          '  <span style="font-size:10px;opacity:0.65">' + pair.sub + '</span>',
          '</div>',
          '<div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;line-height:1.1;font-family:' + pair.display + '">',
          pair.previewEn + ' · ' + pair.previewKr,
          '</div>'
        ].join('');
        if (key === window.PresentationEditor.fontPair) {
          b.style.borderColor = '#0088ff';
          b.style.background = 'rgba(0,136,255,.12)';
        }
        b.addEventListener('mouseenter', function () { if (key !== window.PresentationEditor.fontPair) b.style.background = 'rgba(255,255,255,.12)'; });
        b.addEventListener('mouseleave', function () { if (key !== window.PresentationEditor.fontPair) b.style.background = 'rgba(255,255,255,.06)'; });
        b.addEventListener('click', function () {
          applyFontPair(key);
          btnRow.textContent = pair.name;
          showToast('🔤 ' + pair.name);
        });
        list.appendChild(b);
      });

      // 기본 (override 해제)
      var resetBtn = document.createElement('button');
      resetBtn.style.cssText = 'background:rgba(255,141,40,.15);color:#ff8d28;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;margin-top:8px';
      resetBtn.textContent = '↺ 기본 폰트로 초기화 (테마 기본)';
      resetBtn.addEventListener('click', function () {
        var s = document.getElementById('pt-font-style');
        if (s) s.remove();
        try { localStorage.removeItem(FONT_STORAGE_KEY); } catch (_) {}
        window.PresentationEditor.fontPair = null;
        btnRow.textContent = '기본';
        showToast('↺ 기본 폰트 적용');
        picker.remove();
      });
      list.appendChild(resetBtn);
      picker.appendChild(list);

      document.body.appendChild(picker);

      // Close on outside click
      setTimeout(function () {
        document.addEventListener('click', function close(e) {
          if (!picker.contains(e.target) && e.target !== btnRow) {
            picker.remove();
            document.removeEventListener('click', close);
          }
        });
      }, 50);
    }
  }
  window.PresentationEditor.initFontPicker = initFontPicker;

  /* ============================================================
     Layer A — 자동 텍스트 편집 + localStorage 자동 저장
     KITECH base.html 의 initEditMode 를 generic 화 해서 통합.
     window.PT_EDITABLE_SELECTORS 로 override 가능.
     ============================================================ */
  var STORAGE_PREFIX = 'pt-edit-' + (location.pathname.split('/').pop() || 'page') + '-';
  var DEFAULT_EDITABLE_SELECTORS = [
    // Cover / 표지
    '.cover h1', '.cover-sub', '.cover-eyebrow', '.cover-tagline',
    // Headings inside slide content
    '.slide-content h1', '.slide-content h2', '.slide-content h3', '.slide-content h4',
    // Paragraphs and list items
    '.slide-content p', '.slide-content li',
    // Common semantic classes
    '.slide-content .em', '.slide-content .eyebrow',
    '.section-title', '.section-sub',
    // Cards / generic
    '.card-title', '.card-sub', '.card-body',
    // Stats
    '.stat-num', '.stat-label', '.stat-desc',
    // Notes
    '.note-bar',
    // Closing
    '.closing h1', '.closing-sub', '.closing-tagline',
    // Explicit opt-in
    '[data-pt-edit]'
  ];
  var NON_EDITABLE_INSIDE = '.note-label, .page-num, .chap-tag, .slide-time, button, code, pre, .ph-prompt';

  function initAutoEdit() {
    var selectors = window.PT_EDITABLE_SELECTORS || DEFAULT_EDITABLE_SELECTORS;
    try { document.execCommand('defaultParagraphSeparator', false, 'br'); } catch(e) {}

    var count = 0;
    selectors.forEach(function(sel){
      var nodes;
      try { nodes = document.querySelectorAll(sel); } catch(e) { return; }
      Array.prototype.forEach.call(nodes, function(el, idx){
        // Skip if already editable or inside a non-editable parent (e.g. inside .ie-toolbar)
        if (el.closest('#ie-toolbar') || el.closest('#slide-builder-modal') || el.closest('.lightbox-overlay')) return;
        if (el.dataset.ptAutoEdit) return;  // idempotent
        var editId = sel.replace(/[^a-zA-Z0-9]/g, '_') + '_' + idx;
        el.dataset.editId = editId;
        el.dataset.ptAutoEdit = '1';
        el.setAttribute('contenteditable', 'true');
        el.spellcheck = false;

        // Disable child elements
        Array.prototype.forEach.call(el.querySelectorAll(NON_EDITABLE_INSIDE), function(child){
          child.setAttribute('contenteditable', 'false');
        });

        // Restore saved
        var saved = null;
        try { saved = localStorage.getItem(STORAGE_PREFIX + editId); } catch(_){}
        if (saved !== null) el.innerHTML = saved;

        // Auto-save on input (debounced 400ms)
        var timer;
        el.addEventListener('input', function(){
          clearTimeout(timer);
          updateEditStatus('편집 중…');
          timer = setTimeout(function(){
            try {
              localStorage.setItem(STORAGE_PREFIX + editId, el.innerHTML);
              updateEditStatus('저장됨', true);
              showToast('✏️ 자동 저장됨');
            } catch(e) { showToast('⚠️ 저장 실패: ' + e.message); }
          }, 400);
        });

        // Cmd/Ctrl+S → 즉시 저장
        el.addEventListener('keydown', function(e){
          // IME composition 중이면 무시 (한글 안전)
          if (window.PresentationEditor.isComposing) { e.stopPropagation(); return; }
          if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            try {
              localStorage.setItem(STORAGE_PREFIX + el.dataset.editId, el.innerHTML);
              showToast('💾 저장됨'); updateEditStatus('저장됨', true);
            } catch(_){}
          }
          // Tab/Arrow 키 stopPropagation (slide nav 가 가로채는 것 방지)
          e.stopPropagation();
        });

        el.addEventListener('focus', function(){ updateEditStatus('편집 중…'); });
        el.addEventListener('blur',  function(){ updateEditStatus('대기 중'); });

        count++;
      });
    });
    window.PresentationEditor.editableCount = count;
  }

  /* ============================================================
     Layer B — 토스트 알림 (저장 피드백)
     ============================================================ */
  function setupToast() {
    if (document.getElementById('edit-toast')) return;
    var t = document.createElement('div');
    t.id = 'edit-toast';
    t.className = 'edit-toast';
    t.innerHTML = '<span></span>';
    document.body.appendChild(t);
  }
  function showToast(msg){
    var t = document.getElementById('edit-toast'); if (!t) return;
    t.querySelector('span').textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function(){ t.classList.remove('show'); }, 1800);
  }
  window.PresentationEditor.toast = showToast;

  function updateEditStatus(text, saved){
    // Update toolbar status if available
    var info = document.getElementById('ie-info');
    if (info && saved) info.textContent = '✓ ' + text;
    else if (info) info.textContent = text;
  }

  /* ============================================================
     Layer C — 라이트박스 (mermaid / .lightbox-target 클릭 확대)
     ============================================================ */
  function initLightbox() {
    var overlay = document.getElementById('lightbox-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'lightbox-overlay';
      overlay.className = 'lightbox-overlay';
      overlay.innerHTML = '<button class="lightbox-close">×</button><div class="lightbox-content"></div>';
      document.body.appendChild(overlay);
    }
    var content = overlay.querySelector('.lightbox-content');
    var closeBtn = overlay.querySelector('.lightbox-close');
    function close(){ overlay.classList.remove('show'); content.innerHTML = ''; }
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && overlay.classList.contains('show')) close();
    });

    // Auto-target: .mermaid-wrap and any [data-pt-zoom]
    var targets = document.querySelectorAll('.mermaid-wrap, [data-pt-zoom]');
    Array.prototype.forEach.call(targets, function(t){
      if (t.dataset.ptLightbox) return;
      t.dataset.ptLightbox = '1';
      t.addEventListener('click', function(e){
        if (e.target.isContentEditable) return;  // editing → don't trigger
        if (e.target.closest('#ie-toolbar')) return;
        var clone = t.cloneNode(true);
        clone.style.maxWidth = 'none';
        clone.style.maxHeight = 'none';
        clone.style.cursor = 'default';
        // Strip auto-edit hooks from clone
        Array.prototype.forEach.call(clone.querySelectorAll('[contenteditable]'), function(el){ el.removeAttribute('contenteditable'); });
        content.innerHTML = '';
        content.appendChild(clone);
        overlay.classList.add('show');
      });
    });
  }

  /* ============================================================
     CSS 주입 — Layer A/B/C 가 의존하는 스타일
     발표자료 HTML 에 따로 박혀있지 않아도 라이브러리만으로 작동
     ============================================================ */
  function injectEditorStyles() {
    if (document.getElementById('pt-editor-styles')) return;
    var style = document.createElement('style');
    style.id = 'pt-editor-styles';
    style.textContent = [
      '/* Auto-edit visual feedback — 편집 모드 ON 일 때만 보임 */',
      '[data-pt-auto-edit][contenteditable="true"] { outline: none; }',
      '/* 평소엔 visual 변화 없음. 편집모드 ON (body.ie-on) 이거나 focus 시에만 표시 */',
      'body.ie-on [data-pt-auto-edit]:hover { background: rgba(0,136,255,0.06); border-radius: 4px; cursor: text; }',
      '[data-pt-auto-edit]:focus { background: rgba(0,136,255,0.08); box-shadow: 0 0 0 2px rgba(0,136,255,0.25); border-radius: 4px; outline: none; }',
      '/* Toast */',
      '.edit-toast {',
      '  position:fixed; bottom:30px; left:50%; transform:translateX(-50%) translateY(20px);',
      '  background:rgba(28,28,30,0.95); color:#fff; padding:12px 22px; border-radius:100px;',
      '  font-size:14px; font-weight:600; letter-spacing:-0.2px;',
      '  display:flex; align-items:center; gap:8px;',
      '  opacity:0; transition:opacity .2s, transform .2s;',
      '  pointer-events:none; z-index:99996;',
      '  box-shadow:0 8px 32px rgba(0,0,0,0.24); font-family:-apple-system,sans-serif;',
      '}',
      '.edit-toast.show { opacity:1; transform:translateX(-50%) translateY(0); }',
      '/* Lightbox (mermaid 등 클릭 확대) */',
      '.mermaid-wrap, [data-pt-zoom] { cursor: zoom-in; transition: transform .2s, box-shadow .2s; }',
      '.mermaid-wrap:hover, [data-pt-zoom]:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(0,136,255,0.18); }',
      '.mermaid-wrap::after, [data-pt-zoom]::after {',
      '  content: "⛶ 클릭하여 확대"; position: absolute; bottom: 18px; right: 22px;',
      '  font-size: 12px; color: rgba(60,60,67,0.78); background: #fff;',
      '  padding: 6px 14px; border-radius: 100px; border: 0.5px solid rgba(0,0,0,0.10);',
      '  pointer-events: none; opacity: 0; transition: opacity .2s; font-weight: 600;',
      '}',
      '.mermaid-wrap:hover::after, [data-pt-zoom]:hover::after { opacity: 1; }',
      '.lightbox-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.92); display: none;',
      '  align-items: center; justify-content: center; z-index: 99995; padding: 40px;',
      '  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); cursor: zoom-out; }',
      '.lightbox-overlay.show { display: flex; }',
      '.lightbox-content { background: #fff; border-radius: 28px; padding: 44px 52px;',
      '  max-width: 96vw; max-height: 92vh; overflow: auto; cursor: default;',
      '  box-shadow: 0 24px 80px rgba(0,0,0,0.6); }',
      '.lightbox-content svg { max-width: 100%; height: auto; max-height: 80vh; display: block; margin: 0 auto; }',
      '.lightbox-close { position: fixed; top: 28px; right: 28px; width: 56px; height: 56px;',
      '  background: rgba(255,255,255,0.96); border: 0.5px solid rgba(0,0,0,0.10); border-radius: 50%;',
      '  font-size: 30px; color: #000; cursor: pointer; z-index: 99996;',
      '  display: flex; align-items: center; justify-content: center;',
      '  box-shadow: 0 6px 24px rgba(0,0,0,0.40); transition: transform .15s, background .15s, color .15s; }',
      '.lightbox-close:hover { transform: scale(1.08); background: #ff383c; color: #fff; }',
      '/* Print: hide all editor UI */',
      '@media print { #ie-toolbar, .edit-toast, .lightbox-overlay, .lightbox-close, [data-pt-zoom]::after, .mermaid-wrap::after { display: none !important; } }'
    ].join('\n');
    document.head.appendChild(style);
  }
  window.PresentationEditor.injectEditorStyles = injectEditorStyles;
  window.PresentationEditor.initAutoEdit = initAutoEdit;
  window.PresentationEditor.initLightbox = initLightbox;
  window.PresentationEditor.setupToast = setupToast;

  /* ============================================================
     OG 이미지 캡처 — 첫 슬라이드 → 1200×630 PNG
     html2canvas 동적 로드. 다운로드 (또는 ax_admin API 자동 업로드).
     ============================================================ */
  var html2canvasPromise = null;
  function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (html2canvasPromise) return html2canvasPromise;
    html2canvasPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = function () { resolve(window.html2canvas); };
      s.onerror = function () { reject(new Error('html2canvas 로드 실패')); };
      document.head.appendChild(s);
    });
    return html2canvasPromise;
  }

  async function captureFirstSlide(opts) {
    opts = opts || {};
    var slide = document.querySelector(_peSel());
    if (!slide) throw new Error('첫 슬라이드를 찾을 수 없음');

    var html2canvas = await loadHtml2Canvas();

    // 잠시 toolbar/QR/카운터/lightbox 숨김
    var hideEls = document.querySelectorAll('#ie-toolbar, #pt-theme-switcher, #pt-font-picker, #slide-counter, .lightbox-overlay, .edit-fab, .edit-toast');
    var savedDisplays = [];
    hideEls.forEach(function (el) { savedDisplays.push([el, el.style.display]); el.style.display = 'none'; });

    try {
      // OG 1200x630 비율을 슬라이드 16:9 로 letterbox 처리
      // 슬라이드 자체는 100vw × 100vh = 화면 비율. capture 후 1200x630 캔버스에 fit.
      var canvas = await html2canvas(slide, {
        backgroundColor: getComputedStyle(slide).backgroundColor || '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        // 강제 1920x1080 — 모바일에서도 데스크톱 품질 OG 이미지
        width: 1920, height: 1080,
        windowWidth: 1920, windowHeight: 1080
      });

      // OG 사이즈로 리사이징 (1200×630, letterbox if needed)
      var og = document.createElement('canvas');
      og.width = 1200; og.height = 630;
      var ctx = og.getContext('2d');
      ctx.fillStyle = getComputedStyle(slide).backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, 1200, 630);

      var srcRatio = canvas.width / canvas.height;
      var dstRatio = 1200 / 630;
      var dw, dh, dx, dy;
      if (srcRatio > dstRatio) {
        // 가로가 더 긴 source → 가로 fit, 위아래 letterbox
        dw = 1200;
        dh = Math.round(1200 / srcRatio);
        dx = 0;
        dy = Math.round((630 - dh) / 2);
      } else {
        // 세로가 더 긴 source → 세로 fit, 좌우 letterbox
        dh = 630;
        dw = Math.round(630 * srcRatio);
        dx = Math.round((1200 - dw) / 2);
        dy = 0;
      }
      ctx.drawImage(canvas, dx, dy, dw, dh);

      return new Promise(function (resolve) {
        og.toBlob(function (blob) { resolve(blob); }, 'image/png');
      });
    } finally {
      savedDisplays.forEach(function (pair) { pair[0].style.display = pair[1]; });
    }
  }
  window.PresentationEditor.captureFirstSlide = captureFirstSlide;

  async function downloadOgImage() {
    showToast && showToast('📸 캡처 중…');
    try {
      var blob = await captureFirstSlide();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var slug = (location.pathname.match(/\/pt\/([^\/]+)/) || [])[1] || 'slide';
      a.href = url;
      a.download = slug + '-og-' + new Date().toISOString().slice(0, 10) + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showToast && showToast('📥 OG 이미지 다운로드 완료');
    } catch (e) {
      console.error('[pt] OG capture failed', e);
      showToast && showToast('⚠️ OG 캡처 실패: ' + e.message);
    }
  }

  // ax_admin 자동 업로드 (slug 기반, cookie auth, 본인만)
  async function uploadOgToAxAdmin() {
    showToast && showToast('📸 캡처 중…');
    try {
      var blob = await captureFirstSlide();
      var slug = (location.pathname.match(/\/pt\/([^\/]+)/) || [])[1];
      if (!slug) throw new Error('slug 없음 (ax_admin 외 환경?)');

      // ax_admin 의 PATCH /api/v1/presentations/:id 는 ID 필요 — 우선 slug 로 lookup
      var origin = (window.location !== window.parent.location) ? document.referrer.split('/').slice(0,3).join('/') : window.location.origin;
      // CSRF 토큰 추출
      var csrfMeta = document.querySelector('meta[name="csrf-token"]');
      var csrf = csrfMeta ? csrfMeta.content : '';
      // Find ID via /api/v1/presentations
      var listRes = await fetch(origin + '/api/v1/presentations', { credentials: 'include' });
      if (!listRes.ok) throw new Error('인증 필요 (로그인 후 다시 시도)');
      var list = await listRes.json();
      var pt = (list.presentations || []).find(function (p) { return p.slug === slug; });
      if (!pt) throw new Error('내 발표자료에 없음 (소유자만 가능)');

      var fd = new FormData();
      fd.append('thumbnail', blob, slug + '-og.png');
      var res = await fetch(origin + '/api/v1/presentations/' + pt.id, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrf, 'Accept': 'application/json' },
        body: fd
      });
      if (!res.ok) throw new Error('업로드 실패 ' + res.status);
      showToast && showToast('✅ OG 이미지 업로드 완료 — 새로고침 시 카드에 반영');
    } catch (e) {
      console.error('[pt] OG upload failed', e);
      showToast && showToast('⚠️ ' + e.message);
    }
  }
  window.PresentationEditor.downloadOgImage = downloadOgImage;
  window.PresentationEditor.uploadOgToAxAdmin = uploadOgToAxAdmin;

  /* ============================================================
     고품질 PDF 내보내기 — jsPDF + html2canvas 동적 로드
     window.print() 대비: 그라데이션 100%, 한글 폰트 raster 캡처,
     페이지 break 정확. 단점: 200KB 동적 로드 + 출력 PDF 큼 (이미지 PDF)
     ============================================================ */
  var jspdfPromise = null;
  function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (jspdfPromise) return jspdfPromise;
    jspdfPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s.onload = function () { resolve(window.jspdf.jsPDF); };
      s.onerror = function () { reject(new Error('jsPDF 로드 실패')); };
      document.head.appendChild(s);
    });
    return jspdfPromise;
  }

  async function preloadFonts() {
    if (!document.fonts || !document.fonts.ready) return;
    try {
      await document.fonts.ready;
      // 한글 + 영문 폰트 명시적 로드 (현재 사용 중인 것)
      var probes = [
        '400 16px "Pretendard"', '700 24px "Pretendard"',
        '400 16px "Pretendard Variable"', '700 24px "Pretendard Variable"',
        '400 16px "SF Pro Display"', '700 24px "SF Pro Display"',
        '400 16px "Outfit"', '700 24px "Outfit"',
        '400 16px "Noto Sans KR"', '700 24px "Noto Sans KR"',
        '400 16px "Spoqa Han Sans Neo"',
        '700 24px "Gmarket Sans"',
        '400 16px "Playfair Display"', '400 16px "Noto Serif KR"'
      ];
      await Promise.all(probes.map(function (p) {
        return document.fonts.load(p).catch(function () { return null; });
      }));
      // 추가 100ms 대기 — 렌더 완료 보장
      await new Promise(function (r) { setTimeout(r, 150); });
    } catch (e) { console.warn('[pt] font preload failed', e); }
  }

  async function exportPdfHighQuality(opts) {
    opts = opts || {};
    var slideSelector = opts.selector || _peSel();
    var slug = (location.pathname.match(/\/pt\/([^\/]+)/) || [])[1] || 'slides';

    showToast && showToast('⏳ PDF 라이브러리 로드 중…');

    try {
      var html2canvas = await loadHtml2Canvas();
      var jsPDF = await loadJsPdf();

      // 편집 UI 잠시 숨김
      var hideEls = document.querySelectorAll('#ie-toolbar, #pt-theme-switcher, #pt-font-picker, #slide-counter, .lightbox-overlay, .edit-fab, .edit-toast');
      var savedDisplays = [];
      hideEls.forEach(function (el) { savedDisplays.push([el, el.style.display]); el.style.display = 'none'; });

      try {
        showToast && showToast('🔤 폰트 로드 중…');
        await preloadFonts();

        var slides = document.querySelectorAll(slideSelector);
        if (slides.length === 0) throw new Error('슬라이드 없음');

        // 16:9 landscape PDF (1920×1080 비율)
        var pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [1920, 1080],
          compress: true,
          hotfixes: ['px_scaling']
        });

        for (var i = 0; i < slides.length; i++) {
          showToast && showToast('📸 캡처 중 ' + (i + 1) + '/' + slides.length);
          var slide = slides[i];

          var canvas = await html2canvas(slide, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: getComputedStyle(slide).backgroundColor || '#ffffff',
            imageTimeout: 15000,
            // 강제 1920x1080 — 모바일 viewport 에서도 데스크톱 캡처 품질
            width: 1920, height: 1080,
            windowWidth: 1920, windowHeight: 1080
          });

          if (i > 0) pdf.addPage([1920, 1080], 'landscape');

          // 캔버스를 페이지에 fit (16:9 letterbox if needed)
          var canvasRatio = canvas.width / canvas.height;
          var pageRatio = 1920 / 1080;
          var dw, dh, dx, dy;
          if (canvasRatio > pageRatio) {
            dw = 1920; dh = 1920 / canvasRatio; dx = 0; dy = (1080 - dh) / 2;
          } else {
            dh = 1080; dw = 1080 * canvasRatio; dx = (1920 - dw) / 2; dy = 0;
          }
          var imgData = canvas.toDataURL('image/jpeg', 0.92);
          pdf.addImage(imgData, 'JPEG', dx, dy, dw, dh, undefined, 'FAST');
        }

        showToast && showToast('💾 PDF 저장 중…');
        pdf.save(slug + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
        showToast && showToast('✅ 고품질 PDF 다운로드 완료');
      } finally {
        savedDisplays.forEach(function (pair) { pair[0].style.display = pair[1]; });
      }
    } catch (e) {
      console.error('[pt] PDF export failed', e);
      showToast && showToast('⚠️ PDF 생성 실패: ' + e.message);
    }
  }
  window.PresentationEditor.exportPdfHighQuality = exportPdfHighQuality;

  // 모바일 감지 (touch + 좁은 화면)
  function isMobileDevice() {
    return ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
           Math.min(window.innerWidth, window.innerHeight) < 900;
  }
  window.PresentationEditor.isMobile = isMobileDevice;

  // 모바일용 PDF 미리보기 — 다운로드 대신 새 탭/iframe 으로 열기
  async function viewPdfMobile() {
    showToast && showToast('⏳ PDF 생성 중… (10~20초)');
    try {
      var html2canvas = await loadHtml2Canvas();
      var jsPDF = await loadJsPdf();

      var hideEls = document.querySelectorAll('#ie-toolbar, #pt-theme-switcher, #pt-font-picker, #slide-counter, .lightbox-overlay, .edit-fab, .edit-toast, #pt-mobile-banner');
      var savedDisplays = [];
      hideEls.forEach(function (el) { savedDisplays.push([el, el.style.display]); el.style.display = 'none'; });

      try {
        await preloadFonts();
        var slides = document.querySelectorAll(_peSel());
        if (slides.length === 0) throw new Error('슬라이드 없음');

        var pdf = new jsPDF({
          orientation: 'landscape', unit: 'px', format: [1920, 1080],
          compress: true, hotfixes: ['px_scaling']
        });

        for (var i = 0; i < slides.length; i++) {
          if (i % 2 === 0) showToast && showToast('📸 ' + (i + 1) + '/' + slides.length);
          // 강제 1920x1080 캡처 (모바일 viewport 에서도 데스크톱 품질)
          var canvas = await html2canvas(slides[i], {
            scale: 1.5, useCORS: true, allowTaint: true, logging: false,
            backgroundColor: getComputedStyle(slides[i]).backgroundColor || '#ffffff',
            width: 1920, height: 1080,
            windowWidth: 1920, windowHeight: 1080
          });
          if (i > 0) pdf.addPage([1920, 1080], 'landscape');
          var ratio = canvas.width / canvas.height;
          var dw, dh, dx, dy;
          if (ratio > 1920/1080) { dw=1920; dh=1920/ratio; dx=0; dy=(1080-dh)/2; }
          else { dh=1080; dw=1080*ratio; dx=(1920-dw)/2; dy=0; }
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', dx, dy, dw, dh, undefined, 'FAST');
        }

        // 다운로드 대신 blob URL → 새 탭 (모바일 Safari/Chrome 이 PDF 뷰어로 열음)
        var blob = pdf.output('blob');
        var url = URL.createObjectURL(blob);
        showToast && showToast('✅ 새 탭에서 열기 — 좌우로 회전해서 보기');
        var win = window.open(url, '_blank');
        if (!win) {
          // 팝업 차단 시 다운로드 폴백
          var a = document.createElement('a');
          a.href = url; a.download = 'slides.pdf'; a.click();
        }
        // URL 은 30초 후 revoke (탭에서 로드 완료 후)
        setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      } finally {
        savedDisplays.forEach(function (pair) { pair[0].style.display = pair[1]; });
      }
    } catch (e) {
      console.error('[pt] mobile PDF view failed', e);
      showToast && showToast('⚠️ ' + e.message);
    }
  }
  window.PresentationEditor.viewPdfMobile = viewPdfMobile;

  // 모바일 floating 배너 — "📄 PDF 로 보기" 권장
  function initMobileBanner() {
    if (!isMobileDevice()) return;
    if (document.getElementById('pt-mobile-banner')) return;

    // 사용자가 한 번 닫으면 24시간 안 보임
    try {
      var dismissed = localStorage.getItem('pt-mobile-banner-dismissed');
      if (dismissed && Date.now() - parseInt(dismissed, 10) < 86400000) return;
    } catch (_) {}

    var banner = document.createElement('div');
    banner.id = 'pt-mobile-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:18px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(28,28,30,0.94)', 'color:#fff',
      'backdrop-filter:blur(14px)', '-webkit-backdrop-filter:blur(14px)',
      'border-radius:14px', 'padding:10px 14px',
      'display:flex', 'align-items:center', 'gap:10px',
      'box-shadow:0 8px 24px rgba(0,0,0,.4)',
      'z-index:99997', 'max-width:calc(100vw - 32px)',
      'font-family:-apple-system,sans-serif', 'font-size:13px'
    ].join(';');
    banner.innerHTML = [
      '<span style="font-size:20px">📄</span>',
      '<div style="flex:1;line-height:1.35">',
      '  <div style="font-weight:700">모바일 가독성 향상</div>',
      '  <div style="font-size:11px;opacity:0.75">PDF 로 보면 글자 큼 + 좌우 회전 가능</div>',
      '</div>',
      '<button id="pt-mb-go" style="background:#0088ff;color:#fff;border:none;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0">PDF 로 보기</button>',
      '<button id="pt-mb-x" style="background:rgba(255,255,255,.15);color:#fff;border:none;padding:8px 10px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;line-height:1;flex-shrink:0">×</button>'
    ].join('');
    document.body.appendChild(banner);

    document.getElementById('pt-mb-go').addEventListener('click', function () {
      banner.remove();
      viewPdfMobile();
    });
    document.getElementById('pt-mb-x').addEventListener('click', function () {
      banner.remove();
      try { localStorage.setItem('pt-mobile-banner-dismissed', String(Date.now())); } catch (_) {}
    });
  }
  window.PresentationEditor.initMobileBanner = initMobileBanner;

  // OG 캡처 버튼을 toolbar 에 추가
  function initOgButton() {
    var tb = document.getElementById('ie-toolbar');
    if (!tb) return setTimeout(initOgButton, 50);
    if (tb.querySelector('.pt-og-row')) return;

    var row = document.createElement('div');
    row.className = 'pt-og-row';
    row.style.cssText = 'display:flex; gap:6px; padding:4px 0 2px; border-top:1px solid rgba(255,255,255,.10);';

    var dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.innerHTML = '📸 OG 다운로드';
    dlBtn.title = '첫 슬라이드를 1200×630 PNG 로 캡처 → 로컬 다운로드';
    dlBtn.style.cssText = 'flex:1;background:rgba(255,255,255,.10);color:#fff;border:none;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;transition:background .15s';
    dlBtn.addEventListener('mouseenter', function () { dlBtn.style.background = 'rgba(255,255,255,.18)'; });
    dlBtn.addEventListener('mouseleave', function () { dlBtn.style.background = 'rgba(255,255,255,.10)'; });
    dlBtn.addEventListener('click', function (e) { e.stopPropagation(); downloadOgImage(); });
    row.appendChild(dlBtn);

    // ax_admin 환경 (axhub.space 도메인) 에서만 업로드 버튼 표시
    if (location.hostname.indexOf('axhub') >= 0 || location.hostname.indexOf('localhost') >= 0) {
      var upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.innerHTML = '☁️ 업로드';
      upBtn.title = 'ax_admin 에 OG 썸네일로 업로드 (본인 발표자료만)';
      upBtn.style.cssText = 'background:#34c759;color:#fff;border:none;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;transition:background .15s';
      upBtn.addEventListener('mouseenter', function () { upBtn.style.background = '#2eb150'; });
      upBtn.addEventListener('mouseleave', function () { upBtn.style.background = '#34c759'; });
      upBtn.addEventListener('click', function (e) { e.stopPropagation(); uploadOgToAxAdmin(); });
      row.appendChild(upBtn);
    }

    tb.appendChild(row);
  }
  window.PresentationEditor.initOgButton = initOgButton;

  /* ============================================================
     Regen-Preservation Phase 1A — Deck identity (content hash)
     ------------------------------------------------------------
     설계 문서: docs/REGEN-PRESERVATION.md §3
     목적: AI 가 deck 을 재생성해도 같은 deck 임을 인식하기 위한
           pathname 무관 content-hash ID. URL/파일 복사·재export
           에서도 살아남음. v1.2.x 의 pathname 기반 IDB 키와는
           완전 별개로 추가됨 (BC 보존).
     사용처: Phase 3 의 regen-detection 다이얼로그.
     ============================================================ */
  function _peNormalize(s) {
    if (!s) return '';
    // NFKC + lowercase + collapse whitespace + strip emoji-ish chars + max 200 chars
    try { s = s.normalize('NFKC'); } catch (_) {}
    return String(s).toLowerCase()
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
  }

  function _peSlideTitle(section) {
    var h = section.querySelector('h1, h2, h3, [data-pe-title]');
    return _peNormalize(h ? h.textContent : '');
  }

  function _peDetectGenerator() {
    if (window.Reveal) return 'reveal';
    if (window.Slidev || window.__VUE__) return 'slidev';
    if (document.querySelector('[data-marpit-svg], [data-marpit-fragments]')) return 'marp';
    if (window.__fs_edit__ || document.querySelector('section.slide .reveal')) return 'frontend-slides';
    return 'unknown';
  }

  // 즉시(스크립트 실행 시점) 한 번 스냅샷.
  // 목적: localStorage 기반 initAutoEdit 가 DOM 을 변경하기 *전* 의 AS-SERVED HTML 을 캡처.
  // 이게 없으면 사용자가 편집 → localStorage 저장 → 리로드 → initAutoEdit 가 복원 → deckId 가 매번 바뀜.
  var _peDeckSignatureSnapshot = null;
  function _peSnapshotDeckSignature() {
    if (_peDeckSignatureSnapshot) return _peDeckSignatureSnapshot;
    if (typeof document === 'undefined' || !document.querySelectorAll) return null;
    var sel = _peSel();
    var slides = document.querySelectorAll(sel);
    if (!slides || !slides.length) return null;        // body 미파싱 → 나중에 다시 시도
    var titles = [];
    var bodyText = [];
    for (var i = 0; i < slides.length; i++) {
      titles.push(_peSlideTitle(slides[i]));
      bodyText.push(_peNormalize(slides[i].textContent || '').slice(0, 500));
    }
    titles.sort(); // reorder-resistant
    _peDeckSignatureSnapshot = JSON.stringify({
      title: _peNormalize(document.title),
      slideTitles: titles,
      bodySample: bodyText.join('|').slice(0, 4000),
      generator: _peDetectGenerator(),
      slideCount: slides.length
    });
    return _peDeckSignatureSnapshot;
  }
  function _peDeckSignature() {
    return _peSnapshotDeckSignature() || (function () {
      // fallback: 라이브 DOM (initAutoEdit 영향 받음, sub-optimal)
      var sel = _peSel();
      var slides = document.querySelectorAll(sel);
      var titles = [], bodyText = [];
      for (var i = 0; i < slides.length; i++) {
        titles.push(_peSlideTitle(slides[i]));
        bodyText.push(_peNormalize(slides[i].textContent || '').slice(0, 500));
      }
      titles.sort();
      return JSON.stringify({
        title: _peNormalize(document.title),
        slideTitles: titles,
        bodySample: bodyText.join('|').slice(0, 4000),
        generator: _peDetectGenerator(),
        slideCount: slides.length
      });
    })();
  }
  // 스크립트 로드 시점에 즉시 시도. 이 시점에서 body 가 이미 파싱됐다면 snapshot 굳힘.
  if (typeof document !== 'undefined') {
    if (document.body) _peSnapshotDeckSignature();
    // body 파싱 진행 중이면 readystatechange 의 'interactive' 단계 (DCL 이전) 에서 한 번 더 시도.
    document.addEventListener('readystatechange', function _peSnap() {
      if (document.readyState === 'interactive') {
        _peSnapshotDeckSignature();
        document.removeEventListener('readystatechange', _peSnap);
      }
    });
  }

  // Cheap djb2-style hash — sufficient for deckId until SubtleCrypto resolves.
  function _peHash32(str) {
    var h = 5381 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h = (((h << 5) + h) + str.charCodeAt(i)) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  // SubtleCrypto-based stronger hash; resolves async, replaces sync djb2.
  function _peSha1Hex(str) {
    if (!(window.crypto && window.crypto.subtle)) {
      return Promise.resolve(_peHash32(str) + _peHash32(str.split('').reverse().join('')));
    }
    var enc = new TextEncoder().encode(str);
    return window.crypto.subtle.digest('SHA-1', enc).then(function (buf) {
      var arr = new Uint8Array(buf), out = '';
      for (var i = 0; i < arr.length; i++) out += arr[i].toString(16).padStart(2, '0');
      return out;
    });
  }

  // 4-band × 8-row MinHash sketch over body shingles, for fuzzy deck match.
  function _peDeckLSH() {
    var sel = _peSel();
    var text = '';
    var slides = document.querySelectorAll(sel);
    for (var i = 0; i < slides.length; i++) text += ' ' + _peNormalize(slides[i].textContent || '');
    var tokens = text.split(' ').filter(Boolean);
    if (tokens.length < 5) return [];
    var shingles = [];
    for (var j = 0; j + 5 <= tokens.length; j++) shingles.push(tokens.slice(j, j + 5).join(' '));
    var bands = [];
    for (var b = 0; b < 4; b++) {
      var rows = [];
      for (var r = 0; r < 8; r++) {
        var seed = (b * 8 + r) + 1;
        var min = 0xffffffff;
        for (var k = 0; k < shingles.length; k++) {
          var hh = _peHash32(seed + ':' + shingles[k]);
          var n = parseInt(hh, 16);
          if (n < min) min = n;
        }
        rows.push(min.toString(16));
      }
      bands.push(rows.join('-'));
    }
    return bands;
  }

  function _peComputeDeckId() {
    try {
      var sig = _peDeckSignature();
      _peSha1Hex(sig).then(function (hex) {
        window.PresentationEditor.deckId = 'd_' + hex.slice(0, 12);
        window.PresentationEditor.deckLSH = _peDeckLSH();
        window.dispatchEvent(new CustomEvent('pe:deck-identified', {
          detail: { deckId: window.PresentationEditor.deckId, deckLSH: window.PresentationEditor.deckLSH }
        }));
      }).catch(function (e) { console.warn('[pe] deckId compute failed', e); });
    } catch (e) {
      console.warn('[pe] deck signature failed', e);
    }
  }
  window.PresentationEditor.computeDeckId = _peComputeDeckId;

  /* ============================================================
     IndexedDB layer — 이미지 + 텍스트 편집 영구 저장
     localStorage 5MB 한계 회피. 페이지별 분리.
     dependency 없음 (idb wrapper 미사용 — 단순한 KV 만 필요)
     ============================================================ */
  var DB_NAME = 'pt-editor';
  var DB_VERSION = 2;                   // v2: + decks/slides/blobs stores for regen-preservation
  var STORE_IMAGES = 'images';
  var STORE_EDITS = 'edits';
  var STORE_DECKS = 'decks';            // §3 — { deckId, firstSeen, lastSeen, title, slideCount, generatorHint, deckLSH }
  var STORE_SLIDES = 'slides';          // §2 — SlideEditRecord (keyed by `${deckId}::${fp.primary}::${skel8}`)
  var STORE_BLOBS = 'blobs';            // user-pasted images, keyed by sha256(blob)
  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    if (!window.indexedDB) {
      dbPromise = Promise.reject(new Error('IndexedDB not supported'));
      return dbPromise;
    }
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_IMAGES)) {
          db.createObjectStore(STORE_IMAGES);
        }
        if (!db.objectStoreNames.contains(STORE_EDITS)) {
          db.createObjectStore(STORE_EDITS);
        }
        // v2: regen-preservation stores
        if (!db.objectStoreNames.contains(STORE_DECKS)) {
          db.createObjectStore(STORE_DECKS, { keyPath: 'deckId' });
        }
        if (!db.objectStoreNames.contains(STORE_SLIDES)) {
          var ss = db.createObjectStore(STORE_SLIDES, { keyPath: 'id' });
          ss.createIndex('deckId', 'deckId', { unique: false });
          ss.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'key' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function dbOp(store, mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, mode);
        var os = tx.objectStore(store);
        var req = fn(os);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  var ptDB = {
    putImage: function (key, blob) {
      return dbOp(STORE_IMAGES, 'readwrite', function (s) {
        return s.put({ blob: blob, ts: Date.now(), size: blob.size }, location.pathname + '::' + key);
      });
    },
    getImage: function (key) {
      return dbOp(STORE_IMAGES, 'readonly', function (s) {
        return s.get(location.pathname + '::' + key);
      });
    },
    deleteImage: function (key) {
      return dbOp(STORE_IMAGES, 'readwrite', function (s) {
        return s.delete(location.pathname + '::' + key);
      });
    },
    putEdit: function (editId, html) {
      return dbOp(STORE_EDITS, 'readwrite', function (s) {
        return s.put({ html: html, ts: Date.now() }, location.pathname + '::' + editId);
      });
    },
    getEdit: function (editId) {
      return dbOp(STORE_EDITS, 'readonly', function (s) {
        return s.get(location.pathname + '::' + editId);
      });
    },
    listImages: function () {
      return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE_IMAGES, 'readonly');
          var keys = [];
          var req = tx.objectStore(STORE_IMAGES).openKeyCursor();
          req.onsuccess = function (e) {
            var cur = e.target.result;
            if (!cur) return resolve(keys);
            keys.push(cur.key);
            cur.continue();
          };
          req.onerror = function () { reject(req.error); };
        });
      });
    },
    estimate: function () {
      if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate();
      return Promise.resolve({ usage: null, quota: null });
    },
    // localStorage → IndexedDB 마이그레이션 (1회성, idempotent)
    migrateFromLocalStorage: async function () {
      try {
        var migrated = 0;
        var keys = Object.keys(localStorage).filter(function (k) {
          return k.indexOf('pt-edit-') === 0 || k.indexOf('v2d-ios26-edit-') === 0;
        });
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          var html = localStorage.getItem(k);
          if (html) {
            await ptDB.putEdit(k, html);
            migrated++;
          }
        }
        if (migrated > 0) {
          console.info('[pt-db] migrated ' + migrated + ' edits from localStorage to IDB');
          // localStorage 는 롤백 가능하게 보존 (즉시 삭제 안 함)
        }
        return migrated;
      } catch (e) {
        console.warn('[pt-db] migration failed', e);
        return 0;
      }
    },
    // 이미지 placeholder 들을 IDB 에서 복원
    restoreImages: async function () {
      try {
        var phs = document.querySelectorAll('.ph-image[data-ph-id]');
        for (var i = 0; i < phs.length; i++) {
          var ph = phs[i];
          var key = ph.dataset.phId;
          var rec = await ptDB.getImage(key);
          if (rec && rec.blob && !ph.classList.contains('has-image')) {
            var url = URL.createObjectURL(rec.blob);
            var img = ph.querySelector('img') || document.createElement('img');
            img.src = url;
            if (!img.parentNode) ph.appendChild(img);
            var hint = ph.querySelector('.ph-hint'); if (hint) hint.remove();
            ph.classList.add('has-image');
          }
        }
      } catch (e) {
        console.warn('[pt-db] restoreImages failed', e);
      }
    }
  };
  // ── Phase 3: regen-preservation IDB methods ─────────────────────────
  ptDB.putDeck = function (rec) {
    return dbOp(STORE_DECKS, 'readwrite', function (s) { return s.put(rec); });
  };
  ptDB.getDeck = function (deckId) {
    return dbOp(STORE_DECKS, 'readonly', function (s) { return s.get(deckId); });
  };
  ptDB.listDecks = function () {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_DECKS, 'readonly');
        var out = [];
        var req = tx.objectStore(STORE_DECKS).openCursor();
        req.onsuccess = function (e) { var c = e.target.result; if (!c) return resolve(out); out.push(c.value); c.continue(); };
        req.onerror = function () { reject(req.error); };
      });
    });
  };
  ptDB.putSlideEdit = function (rec) {
    return dbOp(STORE_SLIDES, 'readwrite', function (s) { return s.put(rec); });
  };
  ptDB.getSlideEditsForDeck = function (deckId) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_SLIDES, 'readonly');
        var out = [];
        var idx = tx.objectStore(STORE_SLIDES).index('deckId');
        var req = idx.openCursor(IDBKeyRange.only(deckId));
        req.onsuccess = function (e) { var c = e.target.result; if (!c) return resolve(out); out.push(c.value); c.continue(); };
        req.onerror = function () { reject(req.error); };
      });
    });
  };
  ptDB.deleteSlideEdit = function (id) {
    return dbOp(STORE_SLIDES, 'readwrite', function (s) { return s.delete(id); });
  };
  window.PresentationEditor.db = ptDB;

  // 자동 시작: IDB 마이그레이션 + 이미지 복원
  if (window.indexedDB) {
    setTimeout(function () {
      ptDB.migrateFromLocalStorage().catch(function () {});
      setTimeout(function () { ptDB.restoreImages(); }, 200);
    }, 600);
  }

  /* ============================================================
     Phase 3: Regen-Preservation MVP
     ------------------------------------------------------------
     설계 문서: docs/REGEN-PRESERVATION.md
     포함: slideFingerprint, edit-capture observer, detect-and-reapply,
           confidence-bucketed conflict 다이얼로그.
     스코프 (MVP): text 블록만 자동 적용 (이미지/차트/코드는 v2).
                  whole-slide lock 만 (block-level lock 은 v2).
                  단일 탭 (BroadcastChannel 동기화 v2).
     ============================================================ */
  var PE_EDITABLE_TAGS = { H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, P:1, LI:1, TD:1, TH:1, FIGCAPTION:1, BLOCKQUOTE:1, SUMMARY:1, DT:1, DD:1 };

  // 6.1 Editable block 열거. 같은 깊이의 자식 block 보유 여부 확인 후 '잎' 만 block 으로.
  function _peEnumerateBlocks(sectionEl) {
    if (!sectionEl) return [];
    var blocks = [];
    var counters = {};      // tag -> nth
    var walker = document.createTreeWalker(sectionEl, NodeFilter.SHOW_ELEMENT, null);
    var node = walker.currentNode;
    while ((node = walker.nextNode())) {
      var tag = node.tagName;
      if (!PE_EDITABLE_TAGS[tag]) continue;
      if (node.hasAttribute && node.hasAttribute('data-pe-no-edit')) continue;
      // 잎 검사: 자식 중 editable tag 있으면 skip (외곽 컨테이너로 간주)
      var hasChildBlock = false;
      var children = node.querySelectorAll && node.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,td,th,figcaption,blockquote,summary,dt,dd');
      for (var i = 0; children && i < children.length; i++) {
        if (children[i] !== node && PE_EDITABLE_TAGS[children[i].tagName]) { hasChildBlock = true; break; }
      }
      if (hasChildBlock && !node.hasAttribute('data-pe-block')) continue;
      counters[tag] = (counters[tag] || 0);
      var key = tag.toLowerCase() + '#' + counters[tag];
      counters[tag]++;
      blocks.push({
        el: node,
        tag: tag.toLowerCase(),
        key: key,
        text: (node.textContent || '').trim(),
        html: node.innerHTML
      });
    }
    return blocks;
  }

  // 1. Slide fingerprint
  function _peSlideFingerprint(sectionEl) {
    var titleEl = sectionEl.querySelector('h1, h2, h3, [data-pe-title]');
    var titleNorm = _peNormalize(titleEl ? titleEl.textContent : '');
    var blocks = _peEnumerateBlocks(sectionEl);
    var bodyText = blocks.map(function (b) { return b.text; }).join(' ');
    var tokens = _peNormalize(bodyText).split(' ').filter(Boolean);
    var shingles = [];
    for (var i = 0; i + 5 <= tokens.length; i++) shingles.push(tokens.slice(i, i + 5).join(' '));
    var skeleton = blocks.map(function (b) { return b.tag; }).join(',');
    return {
      primary: _peHash32(titleNorm),
      titleNorm: titleNorm,
      shingleHashes: shingles.map(_peHash32),
      structure: _peHash32(skeleton),
      structureRaw: skeleton,
      domPath: _peDomPath(sectionEl),
      blockCount: blocks.length
    };
  }
  function _peDomPath(el) {
    var parts = [], cur = el;
    while (cur && cur.parentNode && cur.tagName) {
      var sibs = cur.parentNode.children, idx = 0;
      for (var i = 0; i < sibs.length; i++) { if (sibs[i] === cur) { idx = i; break; } }
      parts.unshift(cur.tagName.toLowerCase() + '[' + idx + ']');
      cur = cur.parentNode;
      if (cur === document.body) break;
    }
    return parts.join('/');
  }

  // 4.1 Slide-level match score (codex 권고: 0.40·title + 0.35·jaccard + 0.15·skeleton + 0.05·dom).
  function _peJaccard(a, b) {
    if (!a.length || !b.length) return 0;
    var sa = new Set(a), sb = new Set(b), inter = 0;
    sa.forEach(function (x) { if (sb.has(x)) inter++; });
    return inter / (sa.size + sb.size - inter);
  }
  function _peSlideMatchScore(fpA, fpB) {
    var titleEq = (fpA.primary === fpB.primary) ? 1 : 0;
    if (!titleEq && fpA.titleNorm && fpB.titleNorm) {
      // soft title fuzzy: substring containment
      if (fpA.titleNorm.indexOf(fpB.titleNorm) >= 0 || fpB.titleNorm.indexOf(fpA.titleNorm) >= 0) titleEq = 0.6;
    }
    var jacc = _peJaccard(fpA.shingleHashes, fpB.shingleHashes);
    var skel = (fpA.structure === fpB.structure) ? 1 : (fpA.structureRaw && fpB.structureRaw && _peJaccard(fpA.structureRaw.split(','), fpB.structureRaw.split(',')));
    var dom = (fpA.domPath === fpB.domPath) ? 1 : 0;
    return 0.40 * titleEq + 0.35 * jacc + 0.15 * (skel || 0) + 0.10 * dom;
  }

  // 4.2 Block-level match within a matched slide.
  function _peLevenshteinRatio(a, b) {
    if (!a && !b) return 1; if (!a || !b) return 0;
    if (a === b) return 1;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) / Math.max(la, lb) > 0.7) return 0;  // skip far-apart
    var v0 = new Array(lb + 1), v1 = new Array(lb + 1);
    for (var j = 0; j <= lb; j++) v0[j] = j;
    for (var i = 0; i < la; i++) {
      v1[0] = i + 1;
      for (var j2 = 0; j2 < lb; j2++) {
        var cost = a.charCodeAt(i) === b.charCodeAt(j2) ? 0 : 1;
        v1[j2 + 1] = Math.min(v1[j2] + 1, v0[j2 + 1] + 1, v0[j2] + cost);
      }
      var tmp = v0; v0 = v1; v1 = tmp;
    }
    return 1 - (v0[lb] / Math.max(la, lb));
  }
  function _peFindBlockInSlide(sectionEl, storedBlock) {
    var live = _peEnumerateBlocks(sectionEl);
    // 1. exact key+tag
    for (var i = 0; i < live.length; i++) {
      if (live[i].key === storedBlock.blockKey && live[i].tag === storedBlock.tag) return { live: live[i], score: 1.0 };
    }
    // 2. same tag, fuzzy text
    var sameTag = live.filter(function (b) { return b.tag === storedBlock.tag; });
    var best = null, bestScore = 0;
    for (var j = 0; j < sameTag.length; j++) {
      var s = _peLevenshteinRatio(sameTag[j].text, storedBlock.originalText);
      if (s > bestScore) { bestScore = s; best = sameTag[j]; }
    }
    if (best && bestScore > 0.6) return { live: best, score: bestScore * 0.8 };
    // 3. heading demotion (h2 -> h3)
    var HEAD = { h1:1, h2:1, h3:1, h4:1, h5:1, h6:1 };
    if (HEAD[storedBlock.tag]) {
      var headings = live.filter(function (b) { return HEAD[b.tag]; });
      var bestH = null, bestHS = 0;
      for (var k = 0; k < headings.length; k++) {
        var sh = _peLevenshteinRatio(headings[k].text, storedBlock.originalText);
        if (sh > bestHS) { bestHS = sh; bestH = headings[k]; }
      }
      if (bestH && bestHS > 0.75) return { live: bestH, score: bestHS * 0.6, demoted: true };
    }
    return null;
  }

  // 4.3 Bucket
  function _peBucket(confidence) {
    if (confidence > 0.85) return 'high';
    if (confidence > 0.5) return 'medium';
    return 'low';
  }

  // ── Edit-capture: 사용자 편집 → IDB 영구 저장 ─────────────────────
  var _peEditDebounce = {};
  var _peWriting = false;     // 자기 자신 write 시 observer 무시 (loop guard)
  function _peCaptureEdit(blockEl, sectionEl) {
    if (_peWriting) return;
    var fp = _peSlideFingerprint(sectionEl);
    var blocks = _peEnumerateBlocks(sectionEl);
    var blockData = null;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].el === blockEl) { blockData = blocks[i]; break; }
    }
    if (!blockData) return;

    var deckId = window.PresentationEditor.deckId;
    if (!deckId) return;     // deckId 아직 미계산 — skip
    var slideKey = deckId + '::' + fp.primary + '::' + (fp.structure + '').slice(0, 8);

    var debKey = slideKey + '|' + blockData.key;
    clearTimeout(_peEditDebounce[debKey]);
    _peEditDebounce[debKey] = setTimeout(function () {
      ptDB.getSlideEditsForDeck(deckId).then(function (recs) {
        var existing = recs.filter(function (r) { return r.id === slideKey; })[0];
        var origSnapshot = blockEl.dataset && blockEl.dataset.peOriginal;
        var blockEdit = {
          blockKey: blockData.key,
          tag: blockData.tag,
          type: 'text',
          originalHTML: origSnapshot || blockData.html,
          originalText: (origSnapshot ? origSnapshot.replace(/<[^>]+>/g, '') : blockData.text),
          editedHTML: blockData.html,
          editedText: blockData.text,
          editedAt: Date.now()
        };
        var rec = existing || {
          id: slideKey, deckId: deckId, fingerprint: fp,
          blocks: [], locked: false, updatedAt: Date.now()
        };
        // upsert block edit
        var idx = -1;
        for (var b = 0; b < rec.blocks.length; b++) if (rec.blocks[b].blockKey === blockData.key) { idx = b; break; }
        if (idx >= 0) {
          // preserve original from first capture
          blockEdit.originalHTML = rec.blocks[idx].originalHTML;
          blockEdit.originalText = rec.blocks[idx].originalText;
          rec.blocks[idx] = blockEdit;
        } else {
          rec.blocks.push(blockEdit);
        }
        rec.fingerprint = fp;
        rec.updatedAt = Date.now();
        return ptDB.putSlideEdit(rec);
      }).catch(function (e) { console.warn('[pe-regen] capture failed', e); });
    }, 800);
  }

  function _peStartEditCapture() {
    if (!window.PresentationEditor.config) return;
    var sel = _peSel();
    var slides = document.querySelectorAll(sel);
    if (!slides.length) return;

    // 1. 각 editable block 의 첫 화면 상태(=AI v1 originalHTML) 를 dataset 에 동결.
    //    이후 사용자 편집 시 originalHTML 은 보존, editedHTML 만 업데이트.
    for (var i = 0; i < slides.length; i++) {
      var blocks = _peEnumerateBlocks(slides[i]);
      for (var b = 0; b < blocks.length; b++) {
        var el = blocks[b].el;
        if (!el.dataset.peOriginal) el.dataset.peOriginal = el.innerHTML;
      }
    }

    // 2. MutationObserver — debounced, loop-guarded.
    var obs = new MutationObserver(function (muts) {
      if (_peWriting) return;
      var seen = new Set();
      for (var m = 0; m < muts.length; m++) {
        var t = muts[m].target;
        // ascend to nearest editable block
        var cur = t.nodeType === 1 ? t : t.parentElement;
        while (cur && cur.tagName && !PE_EDITABLE_TAGS[cur.tagName]) cur = cur.parentElement;
        if (!cur || seen.has(cur)) continue;
        seen.add(cur);
        // ascend to slide
        var sec = cur;
        while (sec && sec !== document.body && !sec.matches(_peSel())) sec = sec.parentElement;
        if (sec && sec.matches && sec.matches(_peSel())) _peCaptureEdit(cur, sec);
      }
    });
    for (var s = 0; s < slides.length; s++) {
      obs.observe(slides[s], { subtree: true, characterData: true, childList: true });
    }
    window.PresentationEditor._regenObserver = obs;
  }

  // ── 7. Lock helpers ──────────────────────────────────────────────
  function _peLockSlide(sectionEl, locked) {
    if (locked) {
      sectionEl.setAttribute('data-pe-locked', 'true');
      sectionEl.setAttribute('data-pe-locked-at', new Date().toISOString());
    } else {
      sectionEl.removeAttribute('data-pe-locked');
      sectionEl.removeAttribute('data-pe-locked-at');
    }
    // also persist on slide record
    var fp = _peSlideFingerprint(sectionEl);
    var deckId = window.PresentationEditor.deckId; if (!deckId) return;
    var slideKey = deckId + '::' + fp.primary + '::' + (fp.structure + '').slice(0, 8);
    ptDB.getSlideEditsForDeck(deckId).then(function (recs) {
      var rec = recs.filter(function (r) { return r.id === slideKey; })[0] || { id: slideKey, deckId: deckId, fingerprint: fp, blocks: [], updatedAt: Date.now() };
      rec.locked = !!locked; rec.updatedAt = Date.now();
      return ptDB.putSlideEdit(rec);
    });
  }
  window.PresentationEditor.lockSlide = _peLockSlide;

  // ── 4. Detect & Reapply ──────────────────────────────────────────
  // deckId 확정 후 호출. 저장된 edits 가 있으면 diff 계산 후 다이얼로그 띄움.
  async function _peDetectAndReapply() {
    if (!(window.PresentationEditor.config && window.PresentationEditor.config.regen && window.PresentationEditor.config.regen.enabled)) return;
    var deckId = window.PresentationEditor.deckId;
    if (!deckId) return;
    var stored;
    try { stored = await ptDB.getSlideEditsForDeck(deckId); }
    catch (e) { console.warn('[pe-regen] read failed', e); return; }
    if (!stored || !stored.length) {
      // 정확 일치 miss — LSH fuzzy match 시도
      var liveLSH = window.PresentationEditor.deckLSH || [];
      var allDecks = await ptDB.listDecks().catch(function () { return []; });
      var bestDeck = null, bestOverlap = 0;
      for (var d = 0; d < allDecks.length; d++) {
        var dr = allDecks[d];
        if (!dr.deckLSH) continue;
        var overlap = 0;
        for (var bi = 0; bi < liveLSH.length && bi < dr.deckLSH.length; bi++) {
          if (liveLSH[bi] === dr.deckLSH[bi]) overlap++;
        }
        if (overlap > bestOverlap) { bestOverlap = overlap; bestDeck = dr; }
      }
      if (bestDeck && bestOverlap >= 2) {       // 4밴드 중 2개 이상 일치 = LSH Jaccard ≥ 0.5
        var ok = window.confirm('이 deck 의 재생성된 버전으로 보입니다 ("' + (bestDeck.title || '?') + '"). 저장된 편집을 다시 적용하시겠습니까?');
        if (ok) {
          stored = await ptDB.getSlideEditsForDeck(bestDeck.deckId);
          // rebind: copy edits to new deckId
          for (var rs = 0; rs < stored.length; rs++) {
            var newRec = Object.assign({}, stored[rs]);
            newRec.deckId = deckId;
            newRec.id = deckId + '::' + newRec.fingerprint.primary + '::' + (newRec.fingerprint.structure + '').slice(0, 8);
            await ptDB.putSlideEdit(newRec);
          }
          stored = await ptDB.getSlideEditsForDeck(deckId);
        } else { return; }
      } else { return; }
    }
    // upsert deck record (firstSeen preserved across runs)
    ptDB.getDeck(deckId).then(function (existing) {
      ptDB.putDeck({
        deckId: deckId,
        title: document.title,
        slideCount: document.querySelectorAll(_peSel()).length,
        generatorHint: _peDetectGenerator(),
        deckLSH: window.PresentationEditor.deckLSH,
        firstSeen: (existing && existing.firstSeen) || Date.now(),
        lastSeen: Date.now()
      });
    });

    // 4.1 Slide-level match
    var liveSlides = Array.from(document.querySelectorAll(_peSel()));
    var liveFps = liveSlides.map(_peSlideFingerprint);
    var diffItems = [];
    var orphaned = [];
    var usedLive = new Set();
    // greedy assign
    var pairs = [];
    for (var si = 0; si < stored.length; si++) {
      for (var li = 0; li < liveSlides.length; li++) {
        pairs.push({ si: si, li: li, score: _peSlideMatchScore(stored[si].fingerprint, liveFps[li]) });
      }
    }
    pairs.sort(function (a, b) { return b.score - a.score; });
    var matched = {};   // si -> {liveIdx, score}
    for (var p = 0; p < pairs.length; p++) {
      var pair = pairs[p];
      if (pair.score < 0.45) break;
      if (matched[pair.si] || usedLive.has(pair.li)) continue;
      matched[pair.si] = { liveIdx: pair.li, score: pair.score };
      usedLive.add(pair.li);
    }

    var lockedSlides = [];
    for (var ss2 = 0; ss2 < stored.length; ss2++) {
      var rec = stored[ss2];
      var match = matched[ss2];
      if (!match) { orphaned.push(rec); continue; }
      var liveSlide = liveSlides[match.liveIdx];
      // 락된 슬라이드: diff 스킵하고 사용자 편집(저장된 editedHTML)을 무조건 복원.
      // 락은 "AI 가 다시 써도 무시하고 내 버전 유지" 의 명시적 표명이므로 다이얼로그 없이 즉시 적용.
      if (rec.locked) {
        var liveBlocks = _peEnumerateBlocks(liveSlide);
        for (var lb = 0; lb < rec.blocks.length; lb++) {
          var sbl = rec.blocks[lb];
          var foundLocked = _peFindBlockInSlide(liveSlide, sbl);
          if (foundLocked && foundLocked.live.text !== sbl.editedText) {
            _peWriting = true;
            try { foundLocked.live.el.innerHTML = sbl.editedHTML; foundLocked.live.el.dataset.peOriginal = sbl.editedHTML; }
            finally { setTimeout(function () { _peWriting = false; }, 50); }
          }
        }
        lockedSlides.push({ slideIdx: match.liveIdx + 1, title: _peSlideTitle(liveSlide), restored: rec.blocks.length });
        continue;
      }
      for (var bb = 0; bb < rec.blocks.length; bb++) {
        var sb = rec.blocks[bb];
        var found = _peFindBlockInSlide(liveSlide, sb);
        if (!found) {
          diffItems.push({
            slideIdx: match.liveIdx + 1, slideTitle: _peSlideTitle(liveSlide),
            block: sb, liveBlock: null,
            confidence: 0, bucket: 'low',
            reason: 'block-deleted',
            slideMatchScore: match.score
          });
          continue;
        }
        var liveText = found.live.text;
        // skip-identical: AI v2 already has user's text
        if (liveText === sb.editedText) continue;
        // skip-user-already-matches: AI v2 == user's edit anyway
        var blockMatch = found.score;
        var conf = 0.5 * match.score + 0.5 * blockMatch;
        diffItems.push({
          slideIdx: match.liveIdx + 1, slideTitle: _peSlideTitle(liveSlide),
          block: sb, liveBlock: found.live,
          liveEl: found.live.el,
          confidence: conf,
          bucket: _peBucket(conf),
          reason: liveText === sb.originalText ? 'AI-unchanged-user-edited' : 'three-way-conflict',
          slideMatchScore: match.score,
          locked: rec.locked
        });
      }
    }
    // Silent auto-apply: 모든 diff item 이 high 버킷 AND AI 가 원본 그대로 (재생성 안 한 단순 리로드)
    // 이 경우 사용자 편집을 조용히 복원 + 토스트만 표시. 다이얼로그 안 띄움.
    var allHigh = diffItems.length > 0 && diffItems.every(function (d) {
      return d.bucket === 'high' && d.reason === 'AI-unchanged-user-edited' && d.liveEl;
    });
    if (allHigh) {
      _peWriting = true;
      try {
        diffItems.forEach(function (d) {
          if (!d.liveEl) return;
          d.liveEl.innerHTML = d.block.editedHTML;
          d.liveEl.dataset.peOriginal = d.block.editedHTML;
        });
      } finally {
        setTimeout(function () { _peWriting = false; }, 50);
      }
      _peToast('편집 ' + diffItems.length + '개 자동 복원');
      if (lockedSlides.length) _peToast('락 슬라이드 ' + lockedSlides.length + '개 보존', 2200);
      return;
    }
    if (lockedSlides.length && !diffItems.length && !orphaned.length) {
      _peToast('락 슬라이드 ' + lockedSlides.length + '개 자동 보존', 2000);
      return;
    }
    if (diffItems.length === 0 && orphaned.length === 0) return;
    _peShowReapplyDialog(diffItems, orphaned, lockedSlides);
  }

  // 작은 토스트 helper (기존 setupToast 와 충돌 안 하도록 별도 namespace)
  function _peToast(msg, ttl) {
    var t = document.getElementById('pe-regen-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pe-regen-toast';
      t.setAttribute('data-pe-no-export', '1');
      t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(28,28,30,.92);color:#fff;padding:10px 18px;border-radius:10px;font:13px/1.4 -apple-system,system-ui,sans-serif;z-index:99998;box-shadow:0 8px 24px rgba(0,0,0,.3);transition:opacity .3s;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._peTtl);
    t._peTtl = setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 350); }, ttl || 1800);
  }
  window.PresentationEditor.detectAndReapply = _peDetectAndReapply;

  // ── 5. Conflict Dialog UI ────────────────────────────────────────
  function _peShowReapplyDialog(diffItems, orphaned, lockedSlides) {
    lockedSlides = lockedSlides || [];
    if (document.getElementById('pe-regen-dialog')) return;     // idempotent
    var bg = document.createElement('div');
    bg.id = 'pe-regen-dialog';
    bg.setAttribute('data-pe-no-export', '1');
    bg.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:#fff;color:#1a1a1a;width:min(720px,92vw);max-height:86vh;overflow:auto;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.4);padding:24px;';

    var counts = { high: 0, medium: 0, low: 0 };
    diffItems.forEach(function (d) { counts[d.bucket]++; });

    modal.innerHTML =
      '<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;">편집 다시 적용?</h2>' +
      '<p style="margin:0 0 16px;color:#555;font-size:13px;">이 deck 의 이전 편집 ' + diffItems.length + '개 발견. 새 AI 버전에 다시 적용하시겠습니까?</p>' +
      '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">' +
        '<button id="pe-apply-high" ' + (counts.high === 0 ? 'disabled' : '') + ' style="background:' + (counts.high === 0 ? '#c7c7cc' : '#0a84ff') + ';color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:600;cursor:' + (counts.high === 0 ? 'not-allowed' : 'pointer') + ';font-size:13px;">신뢰도 높음만 적용 (' + counts.high + ')</button>' +
        '<button id="pe-apply-all" style="background:#34c759;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;">선택한 항목 적용</button>' +
        '<button id="pe-discard" style="background:#f2f2f7;color:#1a1a1a;border:none;padding:8px 14px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;">전체 무시</button>' +
        '<button id="pe-cancel" style="margin-left:auto;background:transparent;border:none;color:#888;cursor:pointer;font-size:13px;">닫기</button>' +
      '</div>' +
      '<div id="pe-diff-list" style="display:flex;flex-direction:column;gap:10px;"></div>' +
      (lockedSlides.length ? '<div style="margin-top:14px;padding:10px 12px;background:#eef2ff;border-radius:8px;color:#3730a3;font-size:12px;">🔒 락 슬라이드 ' + lockedSlides.length + '개 자동 보존: ' + lockedSlides.map(function(l){return '#'+l.slideIdx+(l.title?' "'+l.title.slice(0,30)+'"':'');}).join(', ') + '</div>' : '') +
      (orphaned.length ? '<div style="margin-top:14px;padding-top:14px;border-top:1px solid #eee;color:#888;font-size:12px;">고아 편집 ' + orphaned.length + '개 (해당 슬라이드가 새 버전에 없음). 다이얼로그 닫으면 보존됨.</div>' : '');

    var list = modal.querySelector ? null : null;
    bg.appendChild(modal);
    document.body.appendChild(bg);
    list = document.getElementById('pe-diff-list');

    diffItems.forEach(function (d, idx) {
      var row = document.createElement('div');
      var bgColor = d.bucket === 'high' ? '#e8f5e9' : d.bucket === 'medium' ? '#fff8e1' : '#fbe9e7';
      var label = d.bucket === 'high' ? 'HIGH' : d.bucket === 'medium' ? 'MEDIUM' : 'LOW';
      var checked = (d.bucket === 'high' || d.bucket === 'medium') ? 'checked' : '';
      row.style.cssText = 'background:' + bgColor + ';border-radius:10px;padding:12px;font-size:13px;';
      row.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
          '<input type="checkbox" data-pe-idx="' + idx + '" ' + checked + ' style="margin:0;">' +
          '<b style="font-size:13px;">슬라이드 ' + d.slideIdx + ' — ' + (d.slideTitle || '(제목 없음)').slice(0, 50) + '</b>' +
          '<span style="margin-left:auto;background:rgba(0,0,0,.06);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">' + label + ' · ' + Math.round(d.confidence * 100) + '%</span>' +
        '</div>' +
        '<div style="font-size:12px;color:#666;margin-bottom:4px;"><b>' + (d.block.tag || '') + '</b> · ' + (d.reason === 'block-deleted' ? '블록 삭제됨' : d.reason) + '</div>' +
        (d.liveBlock ? (
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">' +
            '<div><div style="color:#888;font-size:11px;margin-bottom:2px;">당신의 편집</div><div style="background:rgba(255,255,255,.7);padding:6px 8px;border-radius:6px;">' + _peEscape(d.block.editedText).slice(0, 200) + '</div></div>' +
            '<div><div style="color:#888;font-size:11px;margin-bottom:2px;">AI v2</div><div style="background:rgba(255,255,255,.4);padding:6px 8px;border-radius:6px;">' + _peEscape(d.liveBlock.text).slice(0, 200) + '</div></div>' +
          '</div>'
        ) : '<div style="font-size:12px;color:#c00;">→ 적용 불가 (블록 위치 못 찾음)</div>');
      list.appendChild(row);
    });

    function applyDiffs(filterFn) {
      _peWriting = true;
      try {
        diffItems.forEach(function (d, idx) {
          if (!filterFn(d, idx)) return;
          if (!d.liveEl) return;
          d.liveEl.innerHTML = d.block.editedHTML;
          d.liveEl.dataset.peOriginal = d.block.editedHTML;     // new baseline
        });
      } finally {
        setTimeout(function () { _peWriting = false; }, 50);
      }
      bg.remove();
    }

    var btnHigh = document.getElementById('pe-apply-high');
    if (counts.high > 0) btnHigh.onclick = function () { applyDiffs(function (d) { return d.bucket === 'high'; }); };
    document.getElementById('pe-apply-all').onclick = function () {
      applyDiffs(function (d, idx) {
        var cb = list.querySelector('input[data-pe-idx="' + idx + '"]');
        return cb && cb.checked;
      });
    };
    document.getElementById('pe-discard').onclick = function () {
      // discard = remove all stored edits for this deck
      ptDB.getSlideEditsForDeck(window.PresentationEditor.deckId).then(function (recs) {
        recs.forEach(function (r) { ptDB.deleteSlideEdit(r.id); });
      });
      bg.remove();
    };
    document.getElementById('pe-cancel').onclick = function () { bg.remove(); };
  }
  function _peEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ============================================================
     Phase 4: Clean Export
     ------------------------------------------------------------
     설계 문서: docs/REGEN-PRESERVATION.md §8
     PresentationEditor.exportClean({ inlineBlobs, download, filename })
       → Promise<{ html, blob, blobs }> — editor 오염 제거된 HTML.
     멱등: 재import → 재export = 동일 결과 (modulo 락 timestamp).
     ============================================================ */
  var PE_STRIP_SELECTORS = [
    '#ie-toolbar', '#slide-builder-modal', '#slide-counter',
    '#pt-theme-switcher', '#pt-fontmenu', '.edit-fab', '#i-fontmenu',
    '#pe-regen-dialog', '#pe-regen-toast',
    '[data-pe-no-export]',
    'style#ie-aspect-style', 'style#ie-print-style', 'style#pt-theme-style', 'style#pt-print-style',
    'style#pt-editor-styles', 'style#pt-placeholder-styles', 'style#pt-print-styles',
    '.slide-qr-modal'
  ];
  var PE_STRIP_ATTRS = ['data-pe-original', 'data-pt-auto-edit', 'data-edit-id', 'data-ie-edit-temp', 'data-ph-active'];
  // contenteditable 은 우리가 추가한 경우만 제거 (data-pt-auto-edit 가 있던 element).

  function _peBlobToDataURL(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }

  async function _peExportClean(opts) {
    opts = opts || {};
    var clone = document.documentElement.cloneNode(true);

    // 1. DOM 제거
    PE_STRIP_SELECTORS.forEach(function (sel) {
      clone.querySelectorAll(sel).forEach(function (el) { el.remove(); });
    });

    // 2. 우리 라이브러리 <script> 태그 제거
    clone.querySelectorAll('script').forEach(function (s) {
      var src = s.getAttribute('src') || '';
      if (src.indexOf('presentation-editor') >= 0) s.remove();
    });

    // 3. contenteditable 제거 — 우리가 추가한 모든 케이스 (true / "" / plaintext-only / inherited 무관)
    clone.querySelectorAll('[contenteditable]').forEach(function (el) {
      // data-pt-auto-edit 마커가 있던 요소이거나 미리 사용자가 contenteditable 박은 게 아닌 경우 제거
      if (el.hasAttribute('data-pt-auto-edit') || el.hasAttribute('data-edit-id') || el.hasAttribute('data-ie-edit-temp')) {
        el.removeAttribute('contenteditable');
      } else {
        // 사용자가 직접 contenteditable 을 박은 경우는 보존
      }
    });

    // 4. 모든 element 의 strip 속성 정리. clone (html element) 자체도 포함.
    var allEls = Array.prototype.slice.call(clone.querySelectorAll('*'));
    allEls.push(clone);
    if (clone.querySelector) {
      var bodyEl = clone.querySelector('body'); if (bodyEl) allEls.push(bodyEl);
    }
    allEls.forEach(function (el) {
      PE_STRIP_ATTRS.forEach(function (a) { el.removeAttribute && el.removeAttribute(a); });
      ['ie-selected', 'dragover', 'pe-applying'].forEach(function (c) { el.classList && el.classList.remove(c); });
    });

    // 5. data-pe-locked / data-pe-locked-at / data-pe-block 은 보존 (의도된 사용자 시그널)
    //    추가로 락 슬라이드에 HTML 코멘트 보호 마커 삽입 (regenerator protocol).
    clone.querySelectorAll('[data-pe-locked="true"]').forEach(function (sec) {
      var hash = _peHash32((sec.textContent || '').trim().slice(0, 200));
      var openMark = document.createComment(' pe:locked v1 hash=' + hash + ' ');
      var closeMark = document.createComment(' /pe:locked ');
      // 같은 마커가 이미 있으면 중복 삽입 안 함
      var prev = sec.previousSibling;
      var hasPrev = prev && prev.nodeType === 8 && /pe:locked v1/.test(prev.textContent);
      var nextN = sec.nextSibling;
      var hasNext = nextN && nextN.nodeType === 8 && /\/pe:locked/.test(nextN.textContent);
      if (!hasPrev && sec.parentNode) sec.parentNode.insertBefore(openMark, sec);
      if (!hasNext && sec.parentNode) sec.parentNode.insertBefore(closeMark, sec.nextSibling);
    });

    // 6. 이미지 inline (blob: → data:URI). opts.inlineBlobs !== false 가 default.
    var blobsMap = {};
    if (opts.inlineBlobs !== false) {
      var imgs = clone.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        var src = img.getAttribute('src') || '';
        if (src.indexOf('blob:') !== 0 && src.indexOf('data:') !== 0) continue;
        if (src.indexOf('data:') === 0) continue;            // already inlined
        // blob URL 의 원본 blob 을 IDB 에서 찾아서 data:URI 로 변환
        var ph = img.closest && img.closest('.ph-image[data-ph-id]');
        if (!ph) { img.setAttribute('src', ''); continue; }   // blob URL 만 있고 IDB 추적 불가 → skip
        var phId = ph.getAttribute('data-ph-id');
        try {
          var rec = await ptDB.getImage(phId);
          if (rec && rec.blob) {
            var dataUrl = await _peBlobToDataURL(rec.blob);
            img.setAttribute('src', dataUrl);
          }
        } catch (e) { /* skip on IDB fail */ }
      }
    }

    var html = '<!DOCTYPE html>\n' + clone.outerHTML;
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });

    if (opts.download) {
      var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      var base = opts.filename || ((location.pathname.split('/').pop() || 'slides').replace(/\.html?$/, '') + '__clean__' + ts);
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = base + (base.endsWith('.html') ? '' : '.html'); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    return { html: html, blob: blob, blobs: blobsMap };
  }
  window.PresentationEditor.exportClean = _peExportClean;

  // Phase 1A+1B: config 자동 감지 + deckId 계산 (DOM 안정 후 1회).
  // 사용자가 명시적으로 PresentationEditor.init({...}) 를 먼저 부르면 그 값이 우선됨.
  function _peBootstrap() {
    if (!window.PresentationEditor.config) window.PresentationEditor.init();
    _peComputeDeckId();
    // Phase 3: deckId 확정 후 detect-and-reapply 1회 + edit capture observer 시작.
    window.addEventListener('pe:deck-identified', function onIdent() {
      window.removeEventListener('pe:deck-identified', onIdent);
      try { _peDetectAndReapply(); } catch (e) { console.warn('[pe-regen] detect failed', e); }
      try { _peStartEditCapture(); } catch (e) { console.warn('[pe-regen] capture start failed', e); }
    });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(_peBootstrap, 100); });
    } else {
      setTimeout(_peBootstrap, 100);
    }
  }
})();
