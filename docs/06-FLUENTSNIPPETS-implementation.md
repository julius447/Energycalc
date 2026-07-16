# Energikalkylatorn — WordPress / FluentSnippets / Bricks implementation guide

> **Audience:** Chris (developer). **Goal:** deploy Ampy's Energikalkylatorn into WordPress
> (Bricks theme + FluentSnippets plugin) as a **1-to-1 clone** of the approved standalone build —
> no pixel, weight, gradient, spacing, or word changes.
>
> **This is a FORMAT job, never a design job.** If anything here would change how the tool *looks*,
> stop — the packaging is wrong, not the design. The binding contract is
> `.claude/skills/ampy-webb-playbook/fluentsnippets-delivery.md` (the "10 rules"); this document maps
> Energycalc onto it, file-by-file.
>
> **Honest status up front:** per the contract's own retrofit ladder (§8), Energycalc is the **"Hard"**
> case. It was authored as a standalone page with generic classes (`.page`, `.tool`, `.input`,
> `.result`), global `html{}` / `body{}` / `*{}` / `:root{}` rules, `rem` units, and viewport `@media`
> — every one of which bleeds into or breaks under a WordPress theme. This guide is the conversion plan
> that removes those. It is more work than EV or Elcentral (which were born at the bar). Budget for it.

---

## 1. The model — why "born-ready", and the deliverable

A lead magnet shipped as a standalone HTML page forces a **hand-conversion** into WordPress. Every
hand-conversion is a chance for **drift**: the theme's root font-size silently rescales every `rem`; the
theme's CSS bleeds into unscoped selectors; a missing font weight faux-bolds. The owner's bar — *"1-to-1,
no quality lost"* — cannot be guaranteed by a conversion. It is guaranteed only by **eliminating** the
conversion: the tool is packaged into the exact files you paste, and the preview you sign off on **is**
those files. Approved == deployed.

### The deliverable — three files + a parity harness

| File | Contains | FluentSnippets snippet type | Run location |
|---|---|---|---|
| `dist/styles.css` | all CSS — scoped to the wrapper, px units, self-hosted `@font-face` | **CSS Snippet** | Frontend · `wp_head` |
| `dist/backend.php` | the markup as a **shortcode** `[ampy_ek]`, inline data-inject, nonce-gated REST lead route | **Functions – PHP Snippet** | **Frontend & Backend** |
| `dist/engine.js` | all behaviour: `data.js` + `engine.js` + `rank.js` + `app.js` concatenated in that order, IIFE, scoped to the widget root | **JS Snippet** | Frontend · `wp_footer` |
| `dist/fonts/` | `Outfit-Light.woff2` (300), `Outfit-Medium.woff2` (500), `Outfit-Black.woff2` (900) | uploaded to Media / `wp-content/uploads/ampy-fonts/` | — |

Plus **`preview/index.html`** — a thin host page that pulls those three files **by reference** (`<link>`
the CSS, paste the shortcode's markup, `<script>` the JS). This is what gets rendered and signed off, so
what the owner approves is byte-identical to what you paste into WordPress.

### Repo layout to produce

```
dist/
  styles.css      → paste verbatim into the CSS snippet (wp_head)
  backend.php     → paste verbatim into the Functions-PHP snippet (registers [ampy_ek] + REST)
  engine.js       → paste verbatim into the JS snippet (wp_footer)
  fonts/          → Outfit-Light/Medium/Black .woff2 (uploaded once to the server)
preview/
  index.html      → includes the three dist/ files BY REFERENCE (never a copy)
```

### In Bricks

Drop a **Shortcode element** containing `[ampy_ek]`. **Never** the Bricks **Code element** — it adds
code-signature friction and inconsistent escaping. One Shortcode element, nothing else. The tool renders
its own content; the page hero/H1 lives in Bricks above it (the tool keeps an `sr-only` H1 for a11y — do
not add a duplicate visible heading).

---

## 2. Current state → target state (honest gap analysis)

Verified against the live source in `Energycalc/vB/`. "File:line" points at the exact offender.

| # | Rule (contract §2) | Energycalc today | Compliant? | What remains |
|---|---|---|---|---|
| **1** | One wrapper, everything namespaced; no generic classes | Generic `.page` (`tool.css:133`), `.tool` (`:135`), `.input` (`index.html:46`), `.result` (`:133`), `.panes`, `.gear`, `.seg`, `.cta`, `.spark`, `.trust`, `.lead-*`, `.jump-pill` … + bare `button{}` (`tool.css:110`) | ❌ NO | Rename every class under `.ampy-ek` (see §3). This is the bulk of the work. |
| **2** | Tokens on the wrapper, never `:root` | `:root{ --teal … --sp-* … --ty-* … }` (`tool.css:24–88`), plus `:root` overrides at `:91` and `:97` | ❌ NO | Move the whole token block to `.ampy-ek{}`; scope the two overrides (see §4). |
| **3** | No global resets | `html{font-size:62.5%}` (`:20`), `body{…}` (`:21`), `*{box-sizing}` (`:109`), `button{}` (`:110`), `html{-webkit-tap-highlight}` (`:116`), `@media reduce{*{}}` (`:726`) | ❌ NO | Delete/scope each under `.ampy-ek` (see §4). |
| **4** | Ship px, not host-dependent `rem` | **203** `rem` values; depends on `html{font-size:62.5%}` which cannot ship | ❌ NO | Convert every `rem`→`px` at 1rem=10px; drop `html{62.5%}` (see §5). |
| **5** | Responsive via `@container`, not viewport `@media` | **0** `@container`; **8** width-based `@media` blocks (`tool.css:141,152,344,599,634,655,688,721`) | ❌ NO | Convert the 8 width `@media` → `@container`. **Keep** the ~15 *feature* `@media` (hover/pointer/reduced-motion/print/`@supports`) as-is — `@container` cannot express those (see §6). |
| **6** | Self-host fonts, one `@font-face` per weight, no CDN | 3 self-hosted `@font-face` woff2, weights 300/500/900, `font-display:swap` (`tool.css:16–18`); **zero** googleapis/gstatic/jsdelivr; icons are **inline SVG** in the markup (no Tabler CDN) | ✅ YES | Nothing — already compliant. Only 300/500/900 are shipped, and only 300/500/900 are used, so nothing faux-bolds. Just fix the font `url()` paths to the WP uploads dir (§10). *(Note: the contract §8 line about "inline the Tabler CDN icons" is stale — vB already uses inline SVG.)* |
| **7** | JS IIFE + strict, scoped to root, multi-instance-safe | IIFE + `'use strict'` ✅ (`app.js:20–21`); reads `window.AMPY_DATA` and early-exits if absent ✅ (`:27–40`); but `$`/`el` default to **`document`** (`:40–41`) and boot is single-shot `boot()` (no `querySelectorAll().forEach`, no `dataset.booted`) | ⚠️ PARTIAL | Root-scope selectors + add multi-instance boot (see §9). Small edit — only **1** `getElementById` and **0** raw `document.querySelector` calls to touch. |
| **8** | Data injected inline, strip `_`-prefixed keys | `window.AMPY_DATA` object in `data.js:19`; loads as a `<script src>` today | ⚠️ FORMAT | Inline it via PHP `wp_json_encode` (see §7). **Scan result: no `_`-prefixed keys exist in data.js** — the object is public-safe as-is; keep the strip step as a guard only. |
| **9** | PHP shortcode + REST, nonce-gated, no hardcoded webhook | **Does not exist** — there is no PHP; the lead handler is a `console.log` stub (`app.js:1958`) | ❌ NO | Write `backend.php` (see §7). |
| **10** | FluentSnippets placement | standalone `<head>`/`<body>` page | ❌ NO | Place per §11. |

**Bottom line:** rules 6 is done; 7 and 8 are small; 1, 2, 3, 4, 5, 9, 10 are the real conversion.
The single **go-live-critical** item is the lead wiring (§8) — today every lead is silently dropped.

---

## 3. The class-rename map (the central table)

Everything moves under **one wrapper**. To avoid colliding with the EV calculator's `.ampy-calc`, the
energikalkylatorn uses its own namespace:

- Outer host (container-query context): **`.ampy-ek-outer`**  ← was `.page`
- Inner root (tokens + all markup): **`.ampy-ek`** (id `ampyEk`)  ← was `.tool` (id `ampyTool`)
- Parts: **`.ampy-ek__<part>`** (BEM). State/variant classes stay as `.is-*` / `--modifier` but are only
  ever written **as descendants of `.ampy-ek`** (e.g. `.ampy-ek .is-rec`), never bare.

This map drives **both** the CSS selectors **and** the `class="…"` attributes in the markup — they must
change together or the tool renders unstyled.

### Structural / layout

| Today | Rename to |
|---|---|
| `.page` | `.ampy-ek-outer` |
| `.tool` (`#ampyTool`) | `.ampy-ek` (`#ampyEk`) |
| `.panes` | `.ampy-ek__panes` |
| `.input` | `.ampy-ek__input` |
| `.rightcol` | `.ampy-ek__rightcol` |
| `.result` | `.ampy-ek__result` |

### Input card

| Today | Rename to |
|---|---|
| `.gear` / `.gearhead` / `.gearcopy` / `.gear-inner` / `.gear-collapsed` | `.ampy-ek__gear` / `__gearhead` / `__gearcopy` / `__gear-inner` / `__gear-collapsed` |
| `.lbl` / `.lbl-row` / `.lbl-val` / `.lbl-soft` | `.ampy-ek__lbl` / `__lbl-row` / `__lbl-val` / `__lbl-soft` |
| `.antag` | `.ampy-ek__antag` |
| `.range` | `.ampy-ek__range` |
| `.heatpicker` / `.hp-legend` / `.hp-legend-soft` / `.hp-grid` / `.hp-subhead` | `.ampy-ek__heatpicker` / `__hp-legend` / `__hp-legend-soft` / `__hp-grid` / `__hp-subhead` |
| `.hp-card` / `.hp-card--quiet` / `.hp-ic` / `.hp-lbl` / `.hp-check` / `.hp-hint` | `.ampy-ek__hp-card` / `__hp-card--quiet` / `__hp-ic` / `__hp-lbl` / `__hp-check` / `__hp-hint` |
| `.hp-shares` / `.hp-shares-head` / `.hp-summary` / `.hp-share-row` / `.hp-share-inner` / `.hp-share-name` | `.ampy-ek__hp-shares` … (same `__` pattern) |
| `.capnote` / `.is-primary` | `.ampy-ek__capnote` / `.ampy-ek .is-primary` |
| `.seg` / `.seg-wrap` / `.seg-pill` / `.on` | `.ampy-ek__seg` / `__seg-wrap` / `__seg-pill` / `.ampy-ek__seg .on` |
| `.stepper` / `.stepbtn` / `.stepval` / `.bump` | `.ampy-ek__stepper` / `__stepbtn` / `__stepval` / `.ampy-ek__stepval.bump` |

### Result card

| Today | Rename to |
|---|---|
| `.eyebrow-row` / `.eyebrow` | `.ampy-ek__eyebrow-row` / `__eyebrow` |
| `.anchor-num` / `.anchor-per` / `.anchor-note` / `.flash` / `.nowrap` | `.ampy-ek__anchor-num` / `__anchor-per` / `__anchor-note` / `.ampy-ek__anchor-num.flash` / `.ampy-ek .nowrap` |
| `.storybar` / `.sb-seg` / `.sb-heat` / `.sb-vv` / `.sb-house` / `.is-drawing` / `.is-drawn` | `.ampy-ek__storybar` / `__sb-seg` / `__sb-heat` / `__sb-vv` / `__sb-house` / scoped `.is-drawing`,`.is-drawn` |
| `.sb-legend` / `.sb-dot(-heat/-vv/-house)` / `.sb-mix` / `.sb-house-row` | `.ampy-ek__sb-legend` / `__sb-dot…` / `__sb-mix` / `__sb-house-row` |
| `.spark` / `.spark-h` / `.spark-list` / `.spark-foot` | `.ampy-ek__spark` / `__spark-h` / `__spark-list` / `__spark-foot` |
| `.sp-item` / `.is-rec` / `.is-off` / `.sp-item--batt` | `.ampy-ek__sp-item` / scoped `.is-rec`,`.is-off` / `__sp-item--batt` |
| `.sp-row` / `.sp-row--static` / `.sp-flag` / `.sp-star` / `.sp-head` / `.sp-name` | `.ampy-ek__sp-row` … |
| `.sp-val` / `.sp-val--soft` / `.sp-val--amber` / `.sp-tag` / `.sp-note` / `.sp-caret` | `.ampy-ek__sp-val` / `__sp-val--soft` / `__sp-val--amber` / `__sp-tag` / `__sp-note` / `__sp-caret` |
| `.sp-barline` / `.sp-track` / `.sp-fill` / `.sp-band` / `.sp-pay` / `.sp-pay--weak` | `.ampy-ek__sp-barline` / `__sp-track` / `__sp-fill` / `__sp-band` / `__sp-pay` / `__sp-pay--weak` |
| `.sp-drop-body` / `.sp-verdict` / `.sp-rows` / `.sp-statrow` / `.sp-statrow-k` / `.sp-statrow-v` / `.sp-statrow-v--weak` | `.ampy-ek__sp-drop-body` … |

### CTA / share / method

| Today | Rename to |
|---|---|
| `.ctablock` / `.cta` / `.cta--primary` / `.is-close` | `.ampy-ek__ctablock` / `__cta` / `__cta--primary` / `.ampy-ek__cta.is-close` |
| `.share-wrap` / `.share-btn` / `.share-btn--quiet` | `.ampy-ek__share-wrap` / `__share-btn` / `__share-btn--quiet` |
| `.share-pop` / `.share-pop--below` / `.share-act` / `.share-act-lbl` / `.is-done` | `.ampy-ek__share-pop` / `__share-pop--below` / `__share-act` / `__share-act-lbl` / scoped `.is-done` |
| `.method` / `.method-body` / `.method-list` / `.method-legal` | `.ampy-ek__method` / `__method-body` / `__method-list` / `__method-legal` |

### Lead form

| Today | Rename to |
|---|---|
| `.lead-inline` / `.open` / `.lead-inline-body` | `.ampy-ek__lead-inline` / `.ampy-ek__lead-inline.open` / `__lead-inline-body` |
| `.lead-title` / `.lead-sub` / `.lead-lbl` / `.lead-req` | `.ampy-ek__lead-title` / `__lead-sub` / `__lead-lbl` / `__lead-req` |
| `.lead-field` / `.field-err` / `.lead-err` / `.leadclose` | `.ampy-ek__lead-field` / `__field-err` / `__lead-err` / `__leadclose` |
| `.hp` (honeypot) / `.lead-submit` / `.lead-consent` / `.lead-success` | `.ampy-ek__hp` / `__lead-submit` / `__lead-consent` / `__lead-success` |

### Trust block / jump-pill / utilities

| Today | Rename to |
|---|---|
| `.trust` / `.trust-photo` / `.trust-veil` / `.trust-inner` | `.ampy-ek__trust` / `__trust-photo` / `__trust-veil` / `__trust-inner` |
| `.trust-quote` / `.trust-mark` / `.trust-cite` / `.trust-rating` / `.trust-stars` / `.trust-rating-txt` / `.trust-divider` / `.trust-stat` | `.ampy-ek__trust-quote` … (same `__` pattern) |
| `.jump-pill` / `.jp-chip` / `.show` | `.ampy-ek__jump-pill` / `__jp-chip` / `.ampy-ek__jump-pill.show` |
| `.sr-only` / `.noscript-note` / `.enter` | `.ampy-ek__sr-only` / `__noscript-note` / `.ampy-ek__result.enter` |

**IDs stay as-is** (`#areaSlider`, `#leadForm`, `#result`, `#spark`, `#anchorNum` …) so the JS keeps
working unchanged — IDs are already unique and app.js queries them by id. (Only the two container ids
change: `#ampyTool`→`#ampyEk`, and add `id="ampyEk"` to the inner wrapper.) The rename is a **class-only**
transform across `styles.css` + the markup in `backend.php`.

> **How to do it safely:** transform `tool.css` and the markup **together** with a scripted
> find-replace keyed on the table above (longest class names first, so `.sp-val--soft` is replaced
> before `.sp-val`), then byte-diff the rendered preview against the approved reference (§ parity).
> Do **not** hand-edit 700 lines by eye.

**Modifier variants follow the same rule.** State/element modifiers rename by the identical `__`/`--`
pattern and do not each need a row: `.sb-dot-heat` / `.sb-dot-vv` / `.sb-dot-house` →
`.ampy-ek__sb-dot-heat` … ; `.sb-house-row`, `.sp-col-v--weak`, `.cta--primary`, `.seg-wrap`, `.lbl-row`,
`.gear-collapsed.open`, etc. all transform mechanically. The scripted find-replace catches them because
it keys on the class substring, not on this table.

**Dead CSS — drop, do not rename** (verified 0 occurrences in `index.html`, so they render nothing):
`.toolhead`, `.cta--ghost`, `.lead-eyebrow`. `tool.css:297` already documents the deleted `.reveal`
accordion. Removing these from `styles.css` during the transform is a free cleanup and shrinks the diff.

---

## 4. Global-rule scoping (the isolation boundary)

Every global/bare rule must move under `.ampy-ek`. Here is exactly what happens to each offender.

**Deleted outright (replaced by the rem→px transform, §5):**
```css
/* tool.css:20 — DELETE. The 62.5% base cannot ship; §5 converts every rem→px instead. */
html{font-size:62.5%;scroll-behavior:smooth}
```
`scroll-behavior:smooth` moves onto the wrapper: `.ampy-ek{ scroll-behavior:smooth; }` (harmless, scoped).

**`body{}` → wrapper (`tool.css:21–22`):** the page background and base font belong to the widget, not
the WP `<body>`:
```css
.ampy-ek{
  /* was body{} */
  font-size:16px;                 /* 1.6rem → 16px */
  font-family:'Outfit',system-ui,-apple-system,sans-serif;
  background:var(--pagebg); color:var(--ink);
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
}
```

**`*{box-sizing}` → scoped (`tool.css:109`):**
```css
.ampy-ek, .ampy-ek *, .ampy-ek *::before, .ampy-ek *::after{ box-sizing:border-box; }
```

**`button{font-family:inherit}` → scoped (`tool.css:110`):**
```css
.ampy-ek button{ font-family:inherit; }
```

**`html{-webkit-tap-highlight-color}` → wrapper (`tool.css:116`):**
```css
.ampy-ek{ -webkit-tap-highlight-color:transparent; }
```

**`:root{ …tokens… }` → wrapper (`tool.css:24–88`):** rename the whole block's selector `:root` →
`.ampy-ek`. Custom properties then live on the widget and (a) isolate from any theme variable of the same
name, (b) guarantee the exact Ampy palette. Every `rem` inside a token value is px-converted per §5:
```css
.ampy-ek{
  --teal:#00a991; --teal-bright:#19c39e; --teal-on-dark:#00c4a7;
  --midnight:#090b32; --mist:#f5f9ff; --ink:#1e1e1e; /* …all brand tokens unchanged… */
  --sp-4:16px;           /* was 1.6rem */
  --shell-max:1360px;    /* was 136rem */
  --ty-display:clamp(32px, 24px + 3vw, 52px);  /* was clamp(3.2rem, 2.4rem + 3vw, 5.2rem) */
  /* …etc. — values only reformatted rem→px, nothing else… */
}
```

**The two `:root` overrides → `.ampy-ek` (`tool.css:91`, `:97`):**
```css
@media (prefers-reduced-motion:reduce){
  .ampy-ek{ --t-fast:0ms; --t-mid:0ms; --t-slow:0ms; --t-stagger:0ms; }   /* was :root */
}
@supports not (font-size: clamp(1rem, 2vw, 3rem)){
  .ampy-ek{ --ty-display:40px; --ty-lead:19px; }   /* was :root; rem→px */
  .ampy-ek__cta{ font-size:17px; }                 /* was .cta{font-size:1.7rem} */
}
```

**The global reduced-motion `*{}` → scoped (`tool.css:726–728`):**
```css
@media (prefers-reduced-motion:reduce){
  .ampy-ek *{ animation-duration:0s!important; transition-duration:0s!important; }
  .ampy-ek{ scroll-behavior:auto!important; }
}
```

**`.jump-pill` is `position:fixed`** (`tool.css:586`) — it lives at the bottom of the viewport, so it is
appended to `<body>` at runtime, **outside** `.ampy-ek-outer`. Keep its selector namespaced
(`.ampy-ek__jump-pill`) but note it is the one element not physically inside the wrapper; its styles are
still fully self-contained (no bare selectors), so it stays isolated. Its `@media (max-width:991px)` show
rule (`:599`) is a **viewport** decision (is this a phone?) and legitimately **stays** a viewport `@media`
— a fixed, body-level element has no container to query.

### The scoped reset boundary (optional hardening for a hostile theme)

If the client's Bricks theme is aggressive (resets, `!important`, inherited `line-height`/`color` bleed),
add the stronger boundary from the contract skeleton at the top of `styles.css`:
```css
.ampy-ek-outer{ container-type:inline-size; container-name:ampyek; }
.ampy-ek{ all:initial; }                                  /* wipe inherited theme styling… */
.ampy-ek :where(*:not(svg,svg *),use){ all:revert; }      /* …but keep your own cascade at specificity 0 */
```
`all:initial` leaves **custom properties** (and `direction`/`unicode-bidi`) intact, so the token block
survives; `:where()` keeps the reset at specificity 0 so every real rule still wins. Ship this only if a
plain scoped reset shows bleed in the parity check — it is belt-and-braces, not mandatory.

---

## 5. rem → px (deterministic, format-only)

The design system authors in `rem` on a `html{font-size:62.5%}` base, i.e. **1rem = 10px**. That base is
a **host-page** rule and cannot ship (rule 3). And here is the subtlety that makes conversion mandatory,
not optional: **`rem` always resolves against `<html>`, never against a wrapper.** Setting `font-size` on
`.ampy-ek` does **not** re-root `rem` — the theme's `<html>` font-size (usually 16px) would win, and every
dimension would render **1.6× too large**. So we cannot "just set font-size on the wrapper." Every `rem`
must be transformed to its px equivalent:

```
px = rem_value × 10
```

- `1.6rem` → `16px`, `0.4rem` → `4px`, `136rem` → `1360px`, `4.4rem` → `44px`.
- Inside `clamp()`/`calc()`: convert each `rem` term, leave `vw`/`vh`/`%`/`em` untouched —
  `clamp(3.2rem, 2.4rem + 3vw, 5.2rem)` → `clamp(32px, 24px + 3vw, 52px)`.
- Inside token values too (`--sp-4:1.6rem` → `--sp-4:16px`), since those feed the whole sheet.
- `--r-pill:999rem` → `9990px` (still an effectively infinite radius — no visual change).

This is a pure arithmetic pass over the **203** `rem` occurrences. **It changes no pixel** — `1.6rem` on
a 10px base *was* 16px; it *is* 16px. It only removes the dependency on the host root font-size. Run it
mechanically (the `elkollen-fluent-snippets/_build/build.py` packager does exactly this — generalise it;
do not convert by hand). After the pass, `grep` the sheet for `rem` — the count must be **0**.

---

## 6. @container conversion (the 8 width breakpoints)

Put the container context on the outer wrapper and rewrite the **width-based** breakpoints so the tool
sizes off its **own** width — immune to Bricks' content-column width, sidebars, and any per-element CSS the
page applies:

```css
.ampy-ek-outer{ container-type:inline-size; container-name:ampyek; }
```

The 8 width `@media` blocks (`tool.css:141, 152, 344, 599, 634, 655, 688, 721`) become `@container`
queries. Two worked examples:

**Example A — the stacking breakpoint (`tool.css:634`):**
```css
/* BEFORE (viewport) */
@media (max-width:991px){
  .panes{flex-direction:column}
  .input{flex:auto;order:1;width:100%;max-width:none;position:static;top:auto}
  .rightcol{order:2;width:100%}
  .seg button{min-height:44px}
  /* … */
}
/* AFTER (container) */
@container ampyek (max-width:991px){
  .ampy-ek__panes{flex-direction:column}
  .ampy-ek__input{flex:auto;order:1;width:100%;max-width:none;position:static;top:auto}
  .ampy-ek__rightcol{order:2;width:100%}
  .ampy-ek__seg button{min-height:44px}
  /* … */
}
```

**Example B — the desktop two-pane band (`tool.css:688` and the compound `:721`):**
```css
/* BEFORE */
@media (min-width:992px){ .sp-track{height:1rem} /* … lead-form grid … */ }
@media (min-width:992px) and (max-width:1200px){ .sp-name{white-space:normal} }
/* AFTER */
@container ampyek (min-width:992px){ .ampy-ek__sp-track{height:10px} /* … */ }
@container ampyek (min-width:992px) and (max-width:1200px){ .ampy-ek__sp-name{white-space:normal} }
```

**Do NOT convert the feature queries.** The other ~15 `@media` blocks are *not* about viewport width and
have **no container equivalent** — leave them exactly as `@media`:
- `@media (hover:hover) and (pointer:fine)` — the many decorative-hover gates (e.g. `tool.css:210, 229,
  292, 305, 379, 454, 473, 489, 497, 537, 545`).
- `@media (prefers-reduced-motion:reduce)` (`:90, :726`).
- `@media print` (`:103`).
- `@supports not (font-size: clamp(...))` (`:96`) — a feature query, not media.
- `.ampy-ek__jump-pill`'s `@media (max-width:991px)` show rule (`:599`) — a body-level fixed element,
  no container; keep it viewport.

End state: **8** width `@media` → `@container ampyek`; **0** width `@media` remain; feature `@media`
untouched.

---

## 7. `backend.php` — shortcode + inline data + REST (write this; it does not exist)

Follows the Elcentral/EV pattern: the shortcode **returns** the markup (never `echo`), injects the data
global inline (no client fetch), publishes `restUrl` + a fresh nonce, and registers a nonce-gated REST
route that fires a `do_action` CRM hook. **The webhook URL is an owner-configured WP option — never
hardcoded.** `null` = leads are dropped = a launch-gate item.

```php
<?php
/**
 * Energikalkylatorn — Fluent Snippet 2/3 (type: Functions – PHP).
 * Run Location: Frontend & Backend.
 * Registers the [ampy_ek] shortcode (markup + inline data + REST nonce) and the
 * nonce-gated lead route POST /wp-json/ampy-ek/v1/lead.
 * Webhook is an owner-set option (ampy_ek_lead_webhook_url); null = leads dropped (launch gate).
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/* ── 1. The tool data (window.AMPY_DATA) ─────────────────────────────────
 * Paste the ENTIRE object literal from data.js here as a JSON string, in a
 * nowdoc so nothing is interpolated/escaped. The build script emits this block;
 * do not hand-transcribe. No `_`-prefixed keys exist in data.js (verified), so
 * the strip step is a no-op guard, kept for safety if data.js later adds one. */
if ( ! function_exists( 'ampy_ek_public_data' ) ) {
	function ampy_ek_public_data() {
		$json = <<<'AMPY_EK_DATA_EOF'
{ "meta": { "rounding": { "hero": 1000, "stat": 500, "payback": 0.5 } }, "...": "…the full AMPY_DATA object as JSON…" }
AMPY_EK_DATA_EOF;
		$data = json_decode( $json, true );
		// guard: strip any _-prefixed internal keys before it reaches the browser
		if ( is_array( $data ) ) { $data = ampy_ek_strip_internal( $data ); }
		return $data;
	}
	function ampy_ek_strip_internal( $arr ) {
		if ( ! is_array( $arr ) ) { return $arr; }
		$out = array();
		foreach ( $arr as $k => $v ) {
			if ( is_string( $k ) && strpos( $k, '_' ) === 0 ) { continue; }
			$out[ $k ] = is_array( $v ) ? ampy_ek_strip_internal( $v ) : $v;
		}
		return $out;
	}
}

/* ── 2. The shortcode: [ampy_ek] ─────────────────────────────────────────
 * RETURNS the byte-identical markup + inline data + REST handshake. */
if ( ! function_exists( 'ampy_ek_shortcode' ) ) {
	function ampy_ek_shortcode() {
		$data  = wp_json_encode( ampy_ek_public_data(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		$rest  = esc_url_raw( rest_url( 'ampy-ek/v1/lead' ) );
		$nonce = wp_create_nonce( 'wp_rest' );
		ob_start(); ?>
		<div class="ampy-ek-outer">
		  <div class="ampy-ek" id="ampyEk" lang="sv">
		    <!-- ====== byte-identical to the approved index.html body, with classes
		         renamed per §3 (.page→.ampy-ek-outer, .tool→.ampy-ek, .input→.ampy-ek__input, …).
		         The sr-only H1 stays; do NOT add a visible heading (the Bricks hero owns it). ====== -->
		  </div>
		</div>
		<script>
		  window.AMPY_DATA = <?php echo $data; ?>;
		  window.AmpyEK = { restUrl: <?php echo wp_json_encode( $rest ); ?>, nonce: <?php echo wp_json_encode( $nonce ); ?> };
		</script>
		<?php
		return ob_get_clean();   // shortcodes RETURN, never echo
	}
	add_shortcode( 'ampy_ek', 'ampy_ek_shortcode' );
}

/* ── 3. Fresh nonce survives page caching ────────────────────────────────
 * If the page is cached, the printed nonce can be stale. Refresh it client-side. */
if ( ! function_exists( 'ampy_ek_refresh_nonce' ) ) {
	function ampy_ek_refresh_nonce() {
		register_rest_route( 'ampy-ek/v1', '/nonce', array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => '__return_true',
			'callback'            => function () {
				return new WP_REST_Response( array( 'nonce' => wp_create_nonce( 'wp_rest' ) ), 200 );
			},
		) );
	}
	add_action( 'rest_api_init', 'ampy_ek_refresh_nonce' );
}

/* ── 4. The lead route: POST /wp-json/ampy-ek/v1/lead ────────────────────
 * Nonce-gated. Honeypot (hp_extra) → silent 200. Fires do_action for the CRM.
 * Webhook = owner option; null = drop (launch gate). */
if ( ! function_exists( 'ampy_ek_register_lead_route' ) ) {
	function ampy_ek_register_lead_route() {
		register_rest_route( 'ampy-ek/v1', '/lead', array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'ampy_ek_handle_lead',
			'permission_callback' => function ( $request ) {
				return (bool) wp_verify_nonce( $request->get_header( 'X-WP-Nonce' ), 'wp_rest' );
			},
		) );
	}
	add_action( 'rest_api_init', 'ampy_ek_register_lead_route' );
}

if ( ! function_exists( 'ampy_ek_handle_lead' ) ) {
	function ampy_ek_handle_lead( WP_REST_Request $request ) {
		$p = $request->get_json_params();
		if ( ! is_array( $p ) ) { $p = $request->get_params(); }

		// Honeypot: any content in hp_extra = bot → pretend success, drop.
		if ( ! empty( $p['hp_extra'] ) ) {
			return new WP_REST_Response( array( 'ok' => true ), 200 );
		}

		// Minimal lead = namn + telefon + postnr (+ e-post, obligatorisk sedan v29).
		$lead = array(
			'leadId'    => sanitize_text_field( $p['leadId'] ?? '' ),
			'consentTs' => sanitize_text_field( $p['consentTs'] ?? '' ),
			'name'      => sanitize_text_field( $p['name'] ?? '' ),
			'phone'     => sanitize_text_field( $p['phone'] ?? '' ),
			'email'     => sanitize_email( $p['email'] ?? '' ),
			'zip'       => sanitize_text_field( $p['zip'] ?? '' ),
			// full CRM enrichment (primary/complements/area/era/rec*/savingBucket/attribution/…)
			'context'   => is_array( $p['context'] ?? null ) ? $p['context'] : $p,
		);

		if ( empty( $lead['name'] ) || empty( $lead['phone'] ) || empty( $lead['zip'] ) || ! is_email( $lead['email'] ) ) {
			return new WP_Error( 'ampy_ek_fields', 'Fyll i namn, telefon, postnummer och en giltig e-postadress.', array( 'status' => 400 ) );
		}

		// CRM hook — the site owner attaches their handler to this action.
		do_action( 'ampy_ek_lead_received', $lead );

		// Owner-configured webhook (WP option). null/empty = leads are dropped (LAUNCH GATE).
		$webhook = get_option( 'ampy_ek_lead_webhook_url', null );
		if ( $webhook ) {
			$resp = wp_remote_post( esc_url_raw( $webhook ), array(
				'timeout' => 8,
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $lead ),
			) );
			if ( is_wp_error( $resp ) || (int) wp_remote_retrieve_response_code( $resp ) >= 300 ) {
				// fallback so a lead is never lost silently
				wp_mail( get_option( 'admin_email' ), '[Energikalkylatorn] Ny lead (webhook-fel)', print_r( $lead, true ) );
			}
		} else {
			wp_mail( get_option( 'admin_email' ), '[Energikalkylatorn] Ny lead', print_r( $lead, true ) );
		}

		return new WP_REST_Response( array( 'ok' => true ), 200 );
	}
}
```

To set the webhook (owner, once): `update_option( 'ampy_ek_lead_webhook_url', 'https://your-n8n/webhook/...' );`
(or expose it in a small settings field). Leaving it unset routes leads to the admin email as a safety net
— **it never silently drops** once this PHP is live, which is the whole point of §8.

Validate before pasting: `php -l backend.php` must be clean.

---

## 8. The lead wiring (go-live critical — the one silent 24/7 loss)

**Today, every lead is dropped.** In `app.js:1956–1985`, `submitLead()` builds a CRM-complete payload and
then only `console.log('[ampy lead]', {…})` (`app.js:1958`) — nothing is transmitted. The design, the
validation, the honeypot, the success state all work; the number just never leaves the browser.

The fix is one call. Keep the exact payload object that is built today (`leadId`, `consentTs`, `name`,
`phone`, `email`, `zip`, `primary`, `complements`, `area`, `era`, `occupants`, `priceArea`, `solarMode`,
`branch`, `rec*`, `savingBucket`, `attribution`, `referrer`, `page`, …). Assign it to a variable, then POST
it to the REST route with the nonce:

```js
// app.js:1958 — REPLACE the console.log stub with a real transmit.
var payload = {
  leadId: 'lm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
  consentTs: new Date().toISOString(),
  name: $('#leadName').value.trim(),
  phone: $('#leadPhone').value.trim(),
  email: $('#leadEmail').value.trim(),
  zip: $('#leadZip').value.trim(),
  hp_extra: $('#leadCompany').value,          // honeypot travels so the server can drop bots too
  context: { /* …all the existing enrichment fields, unchanged… */ }
};
postLead(payload);
```

with this helper (add near `track()`), using the handshake `backend.php` published as `window.AmpyEK`:

```js
function postLead(payload){
  var cfg = window.AmpyEK || {};
  if (!cfg.restUrl) { return; }               // standalone/preview with no WP backend → inert (dev only)
  fetch(cfg.restUrl, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce || '' },
    body: JSON.stringify(payload)
  }).catch(function(){ /* success UI already shown; server-side fallback email catches it */ });
}
```

The success UI already fires optimistically after submit (`app.js:1979–1982`) — keep that; the advisor
follow-up is driven server-side by `do_action('ampy_ek_lead_received')`. Optionally refresh a stale nonce
on a `403` by GETting `ampy-ek/v1/nonce` (from §7) and retrying once — needed only if the page is behind a
full-page cache.

`track('lead_submit', …)` already fires the consent-gated dataLayer event (`app.js:1983`) — that stays and
is where the Pixel hooks in (§12).

---

## 9. `engine.js` — packaging + root-scoping + multi-instance

**Packaging:** concatenate the four chassis files into one `dist/engine.js`, **in load order** (the same
order `index.html:282–285` loads them):

```
data.js  →  engine.js  →  rank.js  →  app.js
```

`data.js` defines `window.AMPY_DATA`; `engine.js` defines `window.AmpyEngine`; `rank.js` defines
`window.AmpyRank`/`window.AmpyCodec`; `app.js` reads all four (`app.js:22–25`) and early-exits if any is
missing (`:27–40`) — so the concatenation is inert on pages that don't host the shortcode. **However:**
`backend.php` injects `window.AMPY_DATA` inline in the shortcode (§7), so the `window.AMPY_DATA = {…}`
assignment at `data.js:19` becomes redundant. Two clean options — pick one and keep it consistent:
- **(a)** Keep `data.js` in the bundle and **drop** the inline `<script>window.AMPY_DATA=…</script>` from
  the shortcode (data ships in the JS snippet). Simplest; one source of the data.
- **(b)** Inline the data in PHP (§7) and **omit** `data.js` from the bundle (bundle = engine+rank+app).
  Matches the Elcentral/EV "data in PHP" convention and keeps the number injectable server-side.

Recommend **(b)** — it is the contract's rule 8 ("data injected inline") and lets the owner edit numbers in
one PHP place without touching the JS snippet.

**Root-scoping (rule 7).** `app.js` is already a strict IIFE, but its DOM helpers default to `document`
(`app.js:40–41`) and it boots once. Make it root-scoped and multi-instance-safe. Because there is only
**1** `getElementById` and **0** raw `document.querySelector` calls (everything goes through `$`/`el`), the
edit is small:

```js
// app.js — inside the IIFE, replace the single boot with a per-root init.
var ROOT = document;                      // becomes the widget root at init
function $(s, r){ return (r || ROOT).querySelector(s); }              // was: || document
function el(s, r){ return Array.prototype.slice.call((r || ROOT).querySelectorAll(s)); }  // was: || document

function init(root){
  if (root.dataset.booted === '1') return;  root.dataset.booted = '1';
  ROOT = root;                              // scope every $/el default to THIS instance
  var D = window.AMPY_DATA, ENGINE = window.AmpyEngine, RANK = window.AmpyRank, CODEC = window.AmpyCodec;
  if (!D || !ENGINE || !RANK) { /* the existing dead-skeleton guard, but querying inside root */ return; }
  /* …the entire current body of boot() moves in here, unchanged… */
}
function boot(){ document.querySelectorAll('.ampy-ek').forEach(init); }
document.readyState !== 'loading' ? boot() : document.addEventListener('DOMContentLoaded', boot);
```

Also change the one `getElementById` call to `ROOT.querySelector('#…')` (or leave it — a single
per-page id is fine while the tool is one-per-page). The `.ampy-ek__jump-pill` is appended to `<body>`, so
its wiring must query the pill by its id/class explicitly rather than through `ROOT` — keep that as a
document-level lookup (it is decorative, one per page).

> **Honest scope note:** true *two-instances-on-one-page* additionally requires the id-based lookups
> (`#areaSlider`, `#leadForm`, `#result`, …) to become root-scoped class lookups, because duplicate ids
> would collide. The energikalkylatorn ships **one per page** (a full-width lead magnet), so the
> `querySelectorAll().forEach` + `dataset.booted` guard above is the right robustness level: it is safe if
> the shortcode is accidentally placed twice (second instance no-ops) without a full id→class refactor.
> Flag an id→class pass only if the owner ever wants two live calculators on one URL.

---

## 10. Fonts

Already compliant (`tool.css:16–18`): 3 self-hosted `@font-face` woff2 (Outfit 300/500/900),
`font-display:swap`, zero CDN. Two deploy steps:

1. Upload the three woff2 to `wp-content/uploads/ampy-fonts/`:
   `Outfit-Light.woff2` (300), `Outfit-Medium.woff2` (500), `Outfit-Black.woff2` (900).
2. Point the `@font-face` `url()`s at that absolute path (they currently use the standalone `../fonts/`):

```css
@font-face{ font-family:Outfit; font-weight:300; font-display:swap;
  src:url("/wp-content/uploads/ampy-fonts/Outfit-Light.woff2") format("woff2"); }
@font-face{ font-family:Outfit; font-weight:500; font-display:swap;
  src:url("/wp-content/uploads/ampy-fonts/Outfit-Medium.woff2") format("woff2"); }
@font-face{ font-family:Outfit; font-weight:900; font-display:swap;
  src:url("/wp-content/uploads/ampy-fonts/Outfit-Black.woff2") format("woff2"); }
```

Only 300/500/900 are declared **and** only 300/500/900 are used in the sheet (verified: no
`font-weight:400/600/700/800` requests anywhere), so the browser never faux-bolds a missing weight — no
extra faces needed. The `<link rel=preload>` for fonts (standalone `index.html:28–30`) can optionally be
re-added via a small `wp_head` echo, but is not required. **Zero** `googleapis`/`gstatic`/`jsdelivr`
requests — keep it that way (also the GDPR-safe choice: no third-party font fetch for Consent Mode to
block).

---

## 11. FluentSnippets placement

| Snippet | Type | Run location | Notes |
|---|---|---|---|
| `dist/styles.css` | CSS | Frontend · `wp_head` | The stylesheet — loads before paint. |
| `dist/backend.php` | Functions – PHP | **Frontend & Backend** | Registers `[ampy_ek]` + REST (REST needs backend). |
| `dist/engine.js` | JS | Frontend · `wp_footer` | DOM exists before the IIFE runs. |

Then in **Bricks**: add a **Shortcode element**, value `[ampy_ek]`. Not the Code element. Keep all
responsive rules inside the CSS `@container` queries — **never** in Bricks' per-element custom-CSS boxes
(they behave inconsistently across breakpoints).

---

## 12. Consent & tracking (hook documented; Pixel owner-parked)

The tool is already consent-gated: `track()` (`app.js:80–87`) no-ops unless `window.ampyConsent === true`
(or `window.AMPY_CONSENT === true`) (`hasConsent()`, `app.js:79`), and it pushes bucketed, experiment-tagged
events to `window.dataLayer`. Wiring:

- **Set consent from the page CMP.** When the site's consent tool grants analytics/marketing, set
  `window.ampyConsent = true` (and re-emit if it changes). Until then, no event fires — correct default.
- **The lead event is the conversion hook.** On submit, `track('lead_submit', { branch })` fires
  (`app.js:1983`). This is where the **Meta Pixel** attaches: map `ek_lead_submit` → a Pixel `Lead` event,
  with `savingBucket` (already computed, `app.js`’s `bucketKr`) as the event `value` and a fixed `currency`.
  Do this via GTM (listen for the `dataLayer` `event: 'ek_lead_submit'`) so it stays consent-gated through
  Consent Mode — **do not** hardcode `fbq()` into the bundle.
- **Status:** the owner has **parked** Pixel/GTM to the site push (per the calculator's audit). Document
  the hook now; the container is added at go-live. No `<script>` for Pixel ships in the bundle today.

---

## 13. Chris-ready checklist + go-live gates

**Format / packaging (the contract's pre-handoff checklist):**
- [ ] Three files exist: `dist/styles.css`, `dist/backend.php`, `dist/engine.js` (+ `dist/fonts/`).
- [ ] `preview/index.html` includes the three **by reference** and renders **pixel-identical** to the
      approved `vB/index.html` on desktop **and** mobile (attach the `ampy-syn` proof).
- [ ] CSS: no `:root`, no global `*{}`/`body{}`/`html{font-size}`/bare `button{}`; everything under
      `.ampy-ek`; **`grep rem` returns 0**.
- [ ] Responsive: the 8 width breakpoints are `@container ampyek`; feature `@media`
      (hover/pointer/reduced-motion/print/`@supports`) left as `@media`; **0** width `@media` remain.
- [ ] Fonts: self-hosted `@font-face` (300/500/900), `url()`→`/wp-content/uploads/ampy-fonts/`, zero
      googleapis/gstatic/jsdelivr.
- [ ] `backend.php`: `[ampy_ek]` **returns** (not echoes); data injected inline via `wp_json_encode`
      (`_`-key strip guard present); REST nonce-gated; `do_action('ampy_ek_lead_received')` present; **no
      hardcoded webhook** (uses `ampy_ek_lead_webhook_url` option); `php -l` clean.
- [ ] JS: IIFE + strict; `$`/`el` default to the widget root; `querySelectorAll('.ampy-ek').forEach(init)`
      + `dataset.booted` guard; inert when `window.AMPY_DATA` absent.
- [ ] Byte-diff: the CSS/JS pasted into FluentSnippets `diff`s clean against `dist/`.

**Parity verification (before handoff — `ampy-syn` WEB mode):**
- [ ] Visual screenshots desktop **1280** + mobile **390** vs the approved reference.
- [ ] `getComputedStyle` spot-check on `.ampy-ek`, `.ampy-ek__anchor-num`, a heading, `.ampy-ek__cta`:
      `font-family`, `font-weight`, `font-size`, `line-height`, `color`, `padding` all match (catches
      theme bleed the reset missed).

**Go-live gates (owner/config — the tool ships only when these are cleared):**
- [ ] **LEAD WEBHOOK** — set `ampy_ek_lead_webhook_url` (or confirm the admin-email fallback is acceptable).
      Until §8 is deployed, **every lead is dropped**; this is the single most important gate.
- [ ] **Pixel / consent** — CMP sets `window.ampyConsent`; GTM/Meta `Lead` mapping added (owner-parked to
      the site push).
- [ ] **`[GAP]` sign-offs** in `data.js` — the research placeholders awaiting an energy-expert signature
      (e.g. `servedShare 0.7`, bergvärme SPF/price, winter price-curve, the `[GAP-R*]`/`[GAP-V4-*]` tags).
      These are number gates, independent of this format work.
- [ ] **OG image** — present ✅ (`vB/og.png`, 1200×630, `?v=2`); re-host on WP and update the meta URL, or
      let the SEO plugin own social tags (leave `backend.php`'s optional OG block disabled to avoid double
      tags).
- [ ] **`php -l`** clean on staging; smoke-test a real submit end-to-end (network tab shows a 200 from
      `/wp-json/ampy-ek/v1/lead`, and `do_action` reaches the CRM).

---

### Reference implementations to mirror (don't reinvent)
- **`ev-kalkylatorn/`** — the template: wrapper-scoped px base + `@container`, shortcode
  `ampy_ev_lead_magnet`, REST `ampy-ev-calc/v1`, webhook from a WP option, `wp_json_encode` inline data.
- **`elcentral-kollen/`** — the PHP/REST reference: `ampy-ec/v1/lead`, nonce via `X-WP-Nonce` →
  `wp_verify_nonce($…, 'wp_rest')`, honeypot → silent 200, `do_action('ampy_ec_lead_received')`,
  multi-instance `querySelectorAll('.ampy-ec').forEach` + `dataset.booted`.
- **`elkollen-fluent-snippets/_build/build.py`** — the deterministic packager: rem→px, strips
  `html{62.5%}`, scopes the page-global rules to the wrapper, embeds the data JSON, emits the parity
  preview. **Generalise this for Energycalc; do not hand-convert.**
