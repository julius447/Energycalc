# Energikalkylatorn — `app.js`, the Renderer

> **Audience:** Chris (WordPress / Bricks / FluentSnippets) + any maintainer. Document 5 of 6.
> **Scope:** `vB/app.js` (2048 lines) — the renderer + interaction layer. The frozen math core
> (`data.js` / `engine.js` / `rank.js`) is doc 04; the DOM it drives is doc 02; the WordPress port is doc 06.
> **The one thing to carry out of this doc:** all rounding and Swedish number formatting happen **here**, and
> the lead pipe is a **`console.log` stub** — leads are dropped until you wire one `fetch`.
> Swedish UI strings are quoted verbatim; voice is owner-locked — copy edits go through `S` (§4), not inline.

---

## 1. File structure & boot

`app.js` is a single **IIFE** with `'use strict'` (lines 20–21). Everything is module-private; nothing leaks
to `window` except what it reads.

### 1.1 Dependencies + the hard-fail guard (lines 22–37)

It reads four globals set by the earlier scripts:
```js
var D = window.AMPY_DATA;      // data.js
var ENGINE = window.AmpyEngine; // engine.js
var RANK = window.AmpyRank;     // rank.js
var CODEC = window.AmpyCodec;   // rank.js (share codec)
```
If `D`, `ENGINE`, or `RANK` is missing (a script aborted — common on flaky mobile), it does **not** die
silently: it writes a visible message into `#anchorNum` — `Kalkylatorn kunde inte laddas. Ladda om sidan.` —
at a sentence-sized font, then `return`s (lines 26–37). **Preserve the load order** (`data → engine → rank →
app`) on the port or this branch fires.

### 1.2 Boot flow (`boot()`, lines 2011–2041)

```
boot()
 ├─ applyDecoded()   inside try/catch  ← ?-param prefill (house state only, never identity); a throw is swallowed
 ├─ buildInputs()                      ← builds the 5 segmented groups + heat cards, initial sync
 ├─ syncAsmTags()                      ← (antagande) tags
 ├─ wireControls()                     ← sliders, stepper, share, lead form, blur-validation
 ├─ wireJumpPill()                     ← mobile "Se resultatet" pill (IO)
 ├─ if (decodedAny) firstTouch(true)   ← a shared link counts as "touched" (suppresses assumed-state notes)
 ├─ recompute()                        ← FIRST real render
 ├─ booted = true
 └─ entrance animation (skipped under prefers-reduced-motion)
```
Kicked off at line 2041: `if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();`. A separate `document.fonts.ready` hook (2044–2046) re-places the sliding pills once Outfit
loads (font swap changes button widths). The `applyDecoded` try/catch is a deliberate **boot belt** — a
malformed query param must never stop the tool from rendering (the live-reproduced P0; see doc 01).

---

## 2. The state model (lines 281–301)

One private `state` object is the single source of UI truth (the engine gets a derived snapshot, §3):

| Field | Default | Meaning |
|---|---|---|
| `priceArea` | `D.defaultPriceArea` | Selected elområde. |
| `era` | `'x'` | Byggår band; `'x'` = Vet inte → treated as `midcentury` in `getInputs`. |
| `eraTouched` | `false` | Drives the "(antagande)" tag. |
| `seTouched` | `false` | Elområde touched (→ payload `seAssumed`). |
| `heat` | `{}` | `{ systemId: { on, stop(index), assumed, seeded? } }` — the multi-select heat map. |
| `vetinte` | `false` | The "Vet inte" heat card is active (counts conservatively on direktel). |
| `ownMode` | `'vetinte'` | Own-figure seg: `vetinte` \| `ja`. |
| `ownKwh` | `D.own.defaultKwh` (20000) | Own-figure slider value. |
| `solarMode` | `'nej'` | `nej` \| `finns` \| `planeras`. |
| `solarKwh` | `D.solar.prodDefault` (8000) | Solar production slider. |
| `selectedOption` | `null` | The open Sparstaplarna row id (`null` = all collapsed). |
| `selectedByUser` | `false` | A user tap survives recompute; a default selection re-defaults to the lead. |

**Seeded default primary** (line 297): so the tool paints a real answer on first load, the default heat system
is seeded `{ on:true, stop:DEFAULT_STOP, assumed:true, seeded:true }`. The `seeded` flag makes it an *assumed*
selection that the **first real card tap evicts** (`toggleCard`, lines 402–477) — a genuine direktel+X house
re-taps Direktel. `DEFAULT_STOP = 1` ("En del" → `multi.defaultCoverage` 0.40).

Module-level companions: `userTouched`, `booted` (line 299), `lastRank` / `lastRec` / `lastResult` (300),
`leadSent` (301, the post-submit state cleared by the next input change).

---

## 3. The render cycle (this is where numbers get their Swedish shape)

```
input event → scheduleRecompute() [rAF-throttled] or settleRecompute() [drag-end]
            → recompute()  (792)
                 ├─ getInputs()            (739)  DOM/state → the engine input contract
                 ├─ RANK.rankOptions(inp,D)        → R
                 ├─ RANK.recommend(R,inp,D)        → rec        (owner rules P1–P5)
                 ├─ cache lastRank/lastRec/lastResult
                 ├─ selection reconcile (P3: a deliberate collapse survives a recompute)
                 ├─ clear leadSent if an input changed
                 └─ render(R, rec)          (825)
                       ├─ renderAnchor(R)        (874)  the "kr per år" total
                       ├─ renderStorybar(R)      (898)  3 segment widths + member cost lines
                       ├─ renderSpark(R, rec)   (1196)  the Sparstaplarna rows (full rebuild)
                       ├─ renderCtaBlock(rec)   (1396)  CTA label
                       ├─ renderHpSummary(R)    (1406)  multi-system split line
                       ├─ complementCapNote toggle
                       ├─ methodBody = methodHtml(R,rec) (1448)
                       ├─ announceResult(R,rec) (1423)  the sr-only live region (debounced 800 ms)
                       └─ checkStickyIntegrity()
```

`getInputs()` (739–761) is the **only** bridge from UI to engine. It converts state into the engine contract:
`heatSelection()` → `{primary, complements}`; `area`/`occupants` read live from the DOM; `era 'x' → 'midcentury'`;
constants that were removed as inputs are pinned here (`indoorTemp:21`, `distribution:'radiator'`, `dso:'vetej'`);
`hasWaterborne` is **inferred** (`inferWaterborne`, 311–316), not asked.

**Rounding + formatting live in `app.js`, nowhere else** (lines 45–75). The engine/rank return raw numbers;
`app.js` shapes them:
- `nf(n)` (line 45) — `Math.round(n).toLocaleString('sv-SE')` then normalises every space variant to a
  **non-breaking space** so figures never wrap mid-number. This is the sv-SE thousands format ("12 000").
- `roundTo(n, step)` / `krStr` / `krRange` / `savRangeYr` / `pbRange` / `yrStr` (comma decimal) / `pct`.
- `ROUND` (line 76) = `D.meta.rounding` or `{hero:1000, stat:500, payback:0.5}` — hero total to nearest 1000,
  stat figures to 500, payback to half-years.

If you re-implement any display in another language/locale on the port, **do it here** — the core stays frozen.

---

## 4. Where the copy and icons live (what Chris edits for text/glyphs)

- **`S` — the copy deck** (lines 109–211). Every visible string that `app.js` renders is a key on `S`:
  hints (`S.hintVetinte`, `S.hintFjarr`), card names (`S.cardName`), the Sparstaplarna verdicts/intros
  (`S.spark.*`), the story-bar mix lines (`S.sbMix`), CTA labels (`S.cta.plan` / `S.cta.sent`), share strings
  (`S.share*`), validation errors (`S.err.*`), and the methodology legal line (`S.methodLegal`).
  Templated strings use `{slot}` filled at render by `fill()` (102–108); `{b}…{/b}` becomes `<b>…</b>`. **The
  copy never hard-codes a kr/år or payback figure — every number is a slot** filled from engine output. To
  change wording, edit `S`; do not inject text into the DOM elsewhere. (Static strings that are not in `S`
  live directly in `index.html` — the trust block, the lead-form headings, the two `.gear` headers.)
- **`ICONS` — the inline SVG set** (`icsvg()` builder line 227; `ICONS` map 231–253). 24×24, stroke 1.75,
  `currentColor`, `aria-hidden`. Heat-card glyphs (`bolt`, `ac`, `hearth`, `building`, `mountain`, `droplet`,
  `dropbolt`, `wind`, `pellets`, `flame`), plus `sun`, `check`, `chevUp`. `HEAT_CARDS` (260–270) maps each
  system id → label + icon key; `UI_HIDDEN_SYSTEMS` (272) keeps `olja`/`vedpellets` in the engine but off the
  UI. **No icon font, no CDN** — every glyph is a string here. Edit an icon = edit its path in `ICONS`.

---

## 5. The lead pipe (KEY — leads are dropped today)

`submitLead(e)` (lines 1935–2001), wired at line 1581.

**Order of operations:**
1. `e.preventDefault()`.
2. **Honeypot** (1937): `if ($('#leadCompany').value) return;` — a filled `hp_extra` silently drops the
   submission (bot / autofill). See doc 02 §4 for why the field is named `hp_extra`.
3. **Validation** — all four required, forgiving where humans vary:
   - `validateName` (1861) — non-empty.
   - `validatePhone` (1866) — `v.replace(/\D/g,'').length >= 7`, i.e. **≥7 digits, punctuation-agnostic**
     (spaces, `+46`, dashes all fine).
   - `validateZip` (1872) — `/^\d{5}$/` after stripping spaces (**5 digits**).
   - `validateEmail` (1877) — **now mandatory** (`S.err.emailReq` if empty) then a light `x@y.z` shape check.
   On failure it focuses the first `[aria-invalid="true"]` and returns.
4. **Send** — the payload is assembled and **`console.log('[ampy lead]', payload)`** (line 1958). *This is the
   entire delivery mechanism.* **There is no network call. Every lead is dropped.** The payload is already
   CRM-complete, so going live is **one `fetch` line** replacing/joining the `console.log` — see doc 06 §8.
5. On success: `leadSent = true`, hide the form, show `#leadSuccess`, move focus there. Any unexpected throw
   shows `#leadErr` (`S.leadErr`).

**The payload, field by field** (lines 1958–1989):

| Field | Source | Note |
|---|---|---|
| `leadId` | `'lm-' + Date.now().toString(36) + '-' + random` | Client-generated id. |
| `consentTs` | `new Date().toISOString()` | Pressing submit IS the consent (button text = the consent line). |
| `name` / `phone` / `email` / `zip` | the four lead fields (trimmed) | The only identity data collected. |
| `primary` | `heatSelection().primary` | Current primary heat system. |
| `complements` | `sel.complements[].system` | Array of complement system ids. |
| `override` | `R.baseline.overrideMode` | `'kwh'` when the own-figure slider was used, else null. |
| `area` | `#areaSlider.value` | Boyta (m²). |
| `era` | `state.era` | Byggår band (`'x'` = vet inte). |
| `occupants` | `#occupantsField.value` | Count. |
| `priceArea` | `state.priceArea` | Elområde. |
| `seAssumed` | `!state.seTouched` | True if the visitor never set the elområde. |
| `solarMode` | `state.solarMode` | `nej`/`finns`/`planeras`. |
| `solarKwh` | `state.solarKwh` when finns | else null. |
| `branch` | `R.verdict.branch` | Engine branch. |
| `recBranch` / `recLead` / `recLeadType` | `rec.*` | The recommendation (`recLeadType` = `option`\|`action`). |
| `recLongPb` | `!!rec.longPb` | Honest long-payback flag. |
| `recSavingLo` / `recSavingHi` | lead option `saving[0]`/`[2]`, rounded | The **displayed** saving range (null if action-lead). |
| `recPaybackMid` | lead `paybackMid`, rounded | Half-year rounding. |
| `best` | `R.verdict.bestOptionId` | |
| `savingBucket` | `bucketKr(R.verdict.bestSavingMid)` | **Bucketed** (5000-wide), never raw. |
| `kwhBucket` | `bucketKwh(state.ownKwh)` when own-active | Bucketed. |
| `attribution` | `utm_*` / `fbclid` / `gclid` from the query string | Campaign params survive to CRM (1951–1955). |
| `referrer` | `document.referrer` | |
| `page` | `location.href.split('?')[0]` | The bare page URL. |

The advisor-relevant numbers (`recSaving*`, `recPaybackMid`) are the **displayed** figures, so a caller sees
exactly what the homeowner saw.

---

## 6. Consent + instrumentation (fires into nothing today)

- **`hasConsent()`** (line 79): `window.ampyConsent === true || window.AMPY_CONSENT === true`. **No event fires
  without one of these flags set true.** Nothing on the current page sets them, so tracking is dark by design
  until the site's consent layer sets the global (doc 06 §12).
- **`track(ev, params)`** (80–87): guarded by `hasConsent()`, then
  `dataLayer.push({ event: 'ek_' + ev, experiment_id: 'energikalkylatorn-v10', …params })`. **No Meta Pixel,
  no GTM container, no gtag** — it only pushes onto `window.dataLayer`; a container has to read it. Owner-parked
  until the move to `ampy.se`.
- **Bucketing** (88–97): savings and kWh are pushed **bucketed** (`bucketKr` / `bucketKwh`, 5000-wide bands),
  never raw — a playbook privacy rule; keep it.
- **Event names** (all auto-prefixed `ek_`): `calc_first_touch`, `heat_select`, `vetinte_used`, `se_area_set`,
  `solar_mode`, `own_slider_set`, `compare_select`, `share_click`, `share_channel`, `jump_result`, `lead_open`,
  `lead_submit`.

---

## 7. Share codec + the jump-pill

- **`wireShare()`** (1599–1705): the primary path is **`navigator.share`** (native OS sheet) where present —
  the premium mobile pattern; it drops the popover ARIA in that case (1606–1610). Otherwise it opens the
  anchored **`#sharePop`** popover (`Kopiera länk` / `Dela via mejl` / `Dela på Facebook`), which flips
  `--below` when viewport space above is tight, closes on outside `pointerdown` (falling back to
  `touchstart`/`mousedown` on older devices without `PointerEvent`), and supports full keyboard menu nav
  (Esc / arrows / Home / End / Tab-wrap). Copy uses `navigator.clipboard` with a `legacyCopy` `execCommand`
  fallback, and only shows "Länk kopierad" when the copy actually succeeded.
- **The URL codec round-trip** (house state only — never identity):
  - `shareState()` (1769–1785) builds a compact object (primary system, complements+stops, area **band**,
    era token, own-kWh when all-electric, elområde, solar) → `CODEC.encode(...)` → `?`-query.
  - `applyDecoded()` (1787–1849) reverses it on load: `CODEC.decode(location.search)`, clamped and rounded to
    each slider's band/step, UI-hidden systems (olja/vedpellets) mapped to the Vet inte state, legacy `?kr`/`?vb`
    params decoded and dropped. Wrapped in the boot try/catch so a bad link never blocks render.
- **The mobile jump-pill** (`#jumpPill`, `pillUpdate`/`wireJumpPill`, 1712–1741): **v35/v36 behaviour** — it is
  **visible from load on mobile** (`≤991px`), the owner call being that the hesitant cold visitor is exactly who
  needs the hook (the old arm-on-first-interaction gate hid it from them). An `IntersectionObserver` on
  `#result` hides it once the result scrolls into view; it also hides while the lead form is open. Because rAF
  and IO callbacks are **suspended on hidden loads** (Facebook in-app pre-render, background tabs), a
  `setTimeout(pillUpdate, 400)` **belt** guarantees it appears when the tab becomes visible. No IO support →
  the pill removes itself (never a stuck one).

---

## 8. WordPress / Bricks port notes (cross-ref doc 06)

`app.js` is already an `'use strict'` IIFE with no framework and no global leakage — a good start. Two things
must change for a robust WordPress embed:

1. **It is `document`-scoped, not root-scoped.** The helpers are
   `$ = (s, r) => (r||document).querySelector(s)` and `el = (s, r) => …(r||document).querySelectorAll(s)`
   (lines 40–41), and most call sites pass **no root**, so lookups run against the whole document. Fine as a
   standalone page; on the port, scope every lookup to the tool wrapper (`#ampyTool`) so the snippet can't
   collide with other Bricks markup on the same page.
2. **It is not multi-instance.** `state`, `segBoxes`, and the module-level caches are singletons; two instances
   on one page would fight. If two are ever needed, wrap the IIFE in a per-root factory. For the single
   embed this is a non-issue — just don't enqueue it twice.

The two things that must be supplied by the WordPress environment (both owner-parked) are the **lead webhook**
(replace the `console.log` at line 1958 with one `fetch` — §5) and the **consent globals** `window.ampyConsent`
/ `window.AMPY_CONSENT` plus a `dataLayer` reader (§6). Both are specified in **doc 06** (§8 webhook, §12
consent + measurement). Rounding, formatting, copy, and icons stay in this file and travel unchanged.
