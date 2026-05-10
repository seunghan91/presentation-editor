# Regen-Safe Edit Memory — Design Doc

> Status: design (2026-05-11). Source of truth for Phase 3 implementation.
> Reviewed by: codex strategy review (2026-05-10), Plan agent (2026-05-11).

A Vanilla JS library (`presentation-editor`) that sits on top of AI-generated HTML decks, captures user edits in-browser, and — when the AI regenerates the same deck — surfaces a confidence-scored re-apply dialog. We do not promise automerge. We promise **"your edits weren't lost; here's what changed, decide per block."**

## 0. Codex review — non-negotiables

- "Confidence-scored, suggestion-based re-apply" UX. Never silent automerge above 'high' bucket without one-click undo.
- Edit unit = **editable block** (h1/h2/p/li/td/figcaption). Never raw `TextNode`.
- Slide identity must NOT rely on index. Composite: title + shingles + DOM path.
- Semantic equivalence: `<h2><span>Foo</span></h2>` ≡ `<h2>Foo</h2>`.
- Type-aware patches: text / image / chart / code.
- IndexedDB key = **deck content hash**, not URL/path. (Existing v1.2.x uses `location.pathname`; needs migration.)
- No MutationObserver loops; flag during own writes.
- Clean export must NOT pollute deck with editor metadata.
- Handle nested slides, fragments, animation classes, speaker notes.
- Shadow DOM / iframe / chart canvas → flag, don't merge.
- Don't conflict with generator's own edit mode (frontend-slides "press E").

---

## 1. Slide Identity Algorithm

```
slideFingerprint(sectionEl) -> {
  primary:   sha1(normalizedTitle)              // strongest
  shingles:  [sha1(s) for s in shingles(body, k=5)]   // ~32, MinHash
  structure: sha1(structuralSkeleton(sectionEl))      // tag seq, depth-2
  domPath:   "section[2]/section[0]"            // weak, tiebreak
  mediaSig:  [sha1(perceptualHash(img)) for img in imgs]   // optional
  notes:     sha1(normalizedSpeakerNotes)
}
```

- `normalizedTitle`: first `h1|h2|h3|[data-pe-title]`, lowercase NFKC, collapsed whitespace, no emoji, max 200 chars.
- `shingles(body, k=5)`: sliding window of 5 word-tokens over editable-block visible text → MinHash 32.
- `structuralSkeleton`: pre-order tag names, depth ≤ 2.
- `mediaSig`: pHash via canvas 8×8 dct.

**Match scoring (per old↔new pair)**

```
score = 0.40 * titleEqual(a.primary, b.primary)
      + 0.35 * jaccard(a.shingles, b.shingles)
      + 0.15 * skeletonSim(a.structure, b.structure)
      + 0.05 * mediaOverlap(a.mediaSig, b.mediaSig)
      + 0.05 * domPathProximity(a.domPath, b.domPath)
```

Greedy assignment, threshold 0.45. Unmatched old → orphan bucket. Unmatched new → "new slide".

**OPEN Q1**: title is itself the user's edit → fingerprint pre-edit AND post-edit, use whichever scores higher.

## 2. Edit Storage Schema (IndexedDB)

DB `pe-edit-memory` v1. Stores: `decks`, `slides`, `blobs`.

```ts
interface DeckRecord {
  deckId: string;       // §3
  firstSeen: number; lastSeen: number;
  title: string;
  slideCount: number;
  generatorHint: 'reveal' | 'marp' | 'frontend-slides' | 'slidev' | 'unknown';
}

interface SlideEditRecord {
  id: string;           // ${deckId}::${fp.primary}::${fp.structure.slice(0,8)}
  deckId: string;       // index
  fingerprint: SlideFingerprint;
  blocks: BlockEdit[];
  locked: boolean;      // §7
  updatedAt: number;
}

interface BlockEdit {
  blockKey: string;     // §6
  type: 'text' | 'image' | 'chart' | 'code' | 'table-cell';
  originalHTML: string; // semantic-normalized
  originalText: string;
  editedHTML: string;
  editedText: string;
  imageSrc?: { before: string; after: string; afterBlobKey?: string };
  codeLang?: string;
  editedAt: number;
}

interface BlobRecord {
  key: string;          // sha256(blob)
  blob: Blob;
  mime: string;
}
```

Indexes: `slides.deckId`, `slides.updatedAt`. Save policy: 800ms debounce per block; immediate on blur or image swap.

## 3. Deck Identity

```
deckId = "d_" + sha1(deckSignature).slice(0, 12)

deckSignature = JSON.stringify({
  title: normalize(documentTitle),
  slideTitles: [normalize(firstHeading(s)) for s in slides].sort(),
  topShingles: minhashTop16(allBodyText),
  generator: detectGenerator()
})
```

Sorted slide titles → robust to reorder. MinHash → ~30% paraphrase still hashes close.

**Two keys stored**:
- `deckId` — strict, fast path
- `deckLSH` — MinHash band sig (4×8). On strict miss, query by band; if Jaccard > 0.6 → "Looks like a regenerated version of '...' (74% match). Apply your saved edits?" → user confirms → rebind `deckId`.

**OPEN Q2**: cross-device sync. Punt to v2; content-hash makes it natural.

## 4. Diff / Match Algorithm

```
for each storedSlide:
  candidates = liveSlides.map(s => ({slide:s, score: matchScore(storedSlide.fp, fp(s))}))
  best = candidates.max(score)
  if best.score < 0.45: emit { kind:'orphan-slide', stored:storedSlide }; continue

  for each storedBlock in storedSlide.blocks:
    liveBlock = findBlockInSlide(best.slide, storedBlock.blockKey, storedBlock.type)
    emit diffBlock(storedBlock, liveBlock)
```

```ts
interface DiffItem {
  slideMatchScore: number;
  blockMatchScore: number;
  confidence: number;
  originalText: string; userEditedText: string; newAIText: string;
  suggestedAction: 'auto-apply' | 'prompt' | 'flag-only' | 'skip-identical' | 'skip-user-already-matches';
  reason: string;
}
```

**blockMatchScore (text)**:
- key + tag match → 1.0
- same tag + Levenshtein/max < 0.3 → 0.8
- shingle Jaccard > 0.5 → 0.6
- else 0.0 (likely deleted)

`confidence = 0.5*slideMatch + 0.5*blockMatch`. Buckets:

| Bucket | Range | Action |
|---|---|---|
| high | > 0.85 | auto-apply silently, toast "Re-applied N. Undo?" |
| medium | 0.5–0.85 | dialog, default checked |
| low | < 0.5 | dialog, default unchecked, "uncertain" |
| skip | identical | hidden |

**Type-specific overrides**:
- image: auto-apply only if user swapped to stored Blob; URL → prompt (404 risk)
- chart canvas / SVG-data: never auto; flag-only
- code block: never auto if codeLang differs
- table cell: match by `(rowHeader, colHeader)` not `(r,c)` index

### `findBlockInSlide`

```
1. exact match on (key, tag) in current block enumeration → return
2. same tag, fuzzy text vs stored.originalText, sim>0.6 → return
3. heading-class fallback (h2→h3 demotion), sim>0.75 → return {demoted:true}
4. null (orphan)
```

## 5. Conflict UX

Single modal at deck load. Skip if no non-skip items.

```
+------------------------------------------------------------------+
|  Re-apply your edits?                                            |
|  We found 9 edits from your last session on this deck.           |
|  [Apply all high-confidence] [Review each] [Discard all]         |
+------------------------------------------------------------------+
|  Slide 2 — "Why now"                              Match: 92%     |
|  [x] h2 heading                                            HIGH  |
|      AI v1: Why now                                              |
|      You:   Why now (Q2)                                         |
|      AI v2: Why this quarter                                     |
|      → Will replace AI v2 with: "Why now (Q2)"  [accept] [skip]  |
|                                                                  |
|  [x] paragraph #1                                        MEDIUM  |
|      side-by-side: [your version] | [new AI version]             |
|      [accept yours] [keep AI] [merge manually]                   |
|                                                                  |
|  [ ] image swap (figure 1)                                  LOW  |
|      [preview] [accept your image] [keep AI image]               |
+------------------------------------------------------------------+
|  Slide 5 — "Pricing"                       Match: 51% UNCERTAIN  |
|  ... (collapsed) ...                                             |
+------------------------------------------------------------------+
|  Orphaned (slide deleted in regen): 1 edit on "Old roadmap"      |
|  [view] [export as note] [discard]                               |
+------------------------------------------------------------------+
|                                       [ Cancel ] [ Apply 7 ]    |
+------------------------------------------------------------------+
```

Rules:
- per-block checkbox (not per-slide)
- high auto-checked, medium auto-checked w/ caution, low auto-unchecked
- "Apply all high-confidence" 1-click for the 80% case
- Orphans never silently dropped → exportable as notes
- All applies = single Undo step

## 6. Edit Boundary Detection

```
EDITABLE_TAGS = h1 h2 h3 h4 h5 h6 p li td th figcaption blockquote
                pre/code summary dt dd
IMAGE_BLOCKS  = img picture figure>img video[poster]
CHART_BLOCKS  = canvas[data-chart] svg[data-chart] [data-pe-chart]
```

Rules:
1. Walk slide section, depth-first.
2. Block iff tag ∈ EDITABLE_TAGS AND no descendant block.
3. Override: `[data-pe-block]` forces, `[data-pe-no-edit]` disables.
4. Semantic equivalence via `.textContent`-normalized + tag, not innerHTML.
5. `blockKey` = `{tag}#{nthOfTagWithinSlide}` (e.g. `li#3`, `td#7`). Nested: `ul#0>li#2`.

Lists: each `li` = block. Tables: each `td/th` block, addressed by header texts. Code: whole `<pre><code>` = one block (line-diff inside dialog only).

## 7. Lock Marker & Regenerator Protocol

`data-pe-locked="true"` on `<section>` = user hand-tuned, AI must not rewrite.

Two-channel:

1. Attribute: `data-pe-locked="true" data-pe-locked-at="..."`
2. HTML comment (survives more pipelines):

```html
<!-- pe:locked v1 hash=3c2e8b1c -->
<section> ... </section>
<!-- /pe:locked -->
```

README publishes contract: regenerators MUST preserve content between markers verbatim. Hash detects tampering.

UI: lock icon per slide; context menu. Locked slides skip diff prompt.

**OPEN Q3**: partial block-level lock → punt to v2.

## 8. Clean Export

`pe.exportClean()` returns Document clone, all editor pollution stripped.

**Stripped**: all `data-pe-*` EXCEPT `data-pe-locked` and `data-pe-block`; our injected `contenteditable` (preserve pre-existing); editor DOM (`#pe-toolbar`, modals); inline styles tagged `data-pe-style`; the `<script>` tag; `<style data-pe>`.

**Kept**: user edits; lock markers; pasted images inlined as data: if <50KB else returned as `Map<filename, Blob>`.

Idempotent: re-import → re-export = byte-identical (modulo lock timestamps when content unchanged).

## 9. MutationObserver Strategy

Three observers, narrowly scoped:

1. **Edit observer** on `[contenteditable=true]` subtrees. char/childList → 800ms debounce → snapshot → diff vs originalHTML → persist. **Loop guard**: own writes set `pe.writing=true` microtask; observer early-returns.
2. **Slide observer** on deck root for added/removed `<section>` (mid-session regen). Fingerprint recompute affected only.
3. **Generator-conflict guard**: feature-sniff `window.Reveal`, `window.Slidev`, `window.__fs_edit__`. If detected → don't add `contenteditable` ourselves; wait for their edit mode; hook commit events; never re-emit synthetic input.

All observers paused during `pe.applyEdits()` via single `applying` boolean.

## 10. Failure Modes

| Scenario | Behavior |
|---|---|
| Shadow DOM | Detect attachShadow; treat host as opaque block. Toast: "Some elements aren't editable in this deck." |
| Iframe | Same; don't recurse cross-origin. |
| Chart canvas | Capture user-uploaded replacement only. Never diff pixels. |
| SVG bound data | Mark as chart, flag-only on regen. |
| Slidev (Vue HMR) | Detect `__VUE__`. "Annotation mode" — store edits, don't write live DOM until export. |
| Reveal vertical | Recursive fingerprint; child domPath includes parent index. Match within parent first. |
| Fragments | Single block; preserve fragment classes on re-apply. |
| Animation classes | Snapshot includes classes; we diff text not classes. Re-apply preserves new AI's classes. |
| Speaker notes | Block type 'notes'; participates in fingerprint and diff. |
| IDB unavailable | Fallback localStorage for last 1 deck; warn. Quota: in-memory only. |
| Storage corruption | try/catch; quarantine on parse fail, prompt user. |
| Two tabs | BroadcastChannel `pe-edits-${deckId}`; last-write-wins per block, conflict flagged. |

## Open Questions Summary

1. Pre-edit vs post-edit title fingerprint → store BOTH.
2. Cross-device sync → v2.
3. Partial block-level lock → v2.
4. Slide match in 0.45–0.55 zone → currently prompt; consider "force-match to slide X" affordance.
5. LSH Jaccard 0.6 threshold for "regen vs new deck" → guess; needs telemetry.

## Migration from v1.2.x

Existing `pt-editor` IDB v1 stores keyed by `location.pathname`. Plan:

- Bump IDB to v2; add `decks`, `slides`, `blobs` stores. Keep old `images`, `edits` stores read-only.
- On first v2 load: compute deckId for current pathname; if old data exists at this pathname, attribute it to the new deckId as a one-time import. Toast user.
- Old API (`window.PT_EDITABLE_SELECTORS`, auto-init) preserved.
