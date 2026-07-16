# 03 — CSS Reference (`tool.css`, v36)

Technical reference for the single stylesheet behind the Ampy energikalkylator. Written for the
WordPress/Bricks developer (Chris) porting this tool to FluentSnippets. Every claim below is traced to a
line in `vB/tool.css` (728 lines, header stamped `v7 · V7-SPEC.md`; loaded by `index.html` as
`tool.css?v=36`). Swedish UI strings are quoted verbatim.

> Scope note: this document describes **what the CSS is today**, exactly as written. The isolation /
> namespacing work needed to make it safe inside a WordPress theme is **not** solved here — it is
> documented as-is and handed to **doc 06** (`@container` conversion + global-scope containment). Where a
> rule will bleed into WP, it is flagged with **[BLEED → doc 06]**; it is not fixed here.

---

## 1. Overview

`tool.css` is one of the five layers of the calculator chassis. The others are JavaScript:

| Layer | File (`index.html` L282-285) | Role |
|---|---|---|
| data | `data.js?v=36` | copy, options, constants |
| engine | `engine.js?v=36` | the cost/saving math |
| rank | `rank.js?v=36` | orders the Sparstaplar recommendations |
| app | `app.js?v=36` | DOM wiring, state, events |
| **surface** | **`tool.css?v=36`** | **all visual styling — this file** |

Division of responsibility:

- **All number rounding and formatting happens in JS**, never in CSS. CSS only renders tabular numerals
  (`font-variant-numeric:tabular-nums` — L129) so the JS-formatted strings stay column-aligned. The
  stylesheet never computes or truncates a value.
- **Motion is restricted to `opacity`, `transform`, and CSS-grid `grid-template-rows` fraction reveals
  (`0fr → 1fr`)**, all `≤300ms`, and all reduced-motion-safe. The file header states this explicitly
  (L9); no layout-thrashing animated properties (width on non-bar elements, height, top/left as motion)
  are used for entrance choreography — the two exceptions are the deliberate bar-width transitions on
  `.sb-seg` / `.sp-fill` / `.sp-band`, which animate `width` as the data visualization itself.
- **Two panes, one canvas**: a left white input card and a right midnight result card, de-boxed into a
  wide shell (L2-6 header, `.page`/`.tool`/`.panes` L133-140).
- **Single font** (Outfit), hierarchy carried by weight only — 300 / 500 / 900 (L7, L56).

The longest self-imposed constraints (from the header, L11-12): no em-dashes in copy; fonts live at
`../fonts/`; v7 components reuse the existing token set — **zero new colors, zero new type sizes** (the
one admitted exception is `--bar-house`, L31).

---

## 2. The token system (`:root`, L24-88)

`html{font-size:62.5%}` (L20) sets the root so that **`1rem = 10px`**. Every `rem` value below is
therefore trivially convertible: multiply by 10 for px. This 62.5% base is deliberately matched to the
production `ap*` framework (L20 comment) — see §6, it is also a global-scope bleed risk.

The `:root` block appears three times: the main declaration (L24-88), a reduced-motion override
(L90-92), and a `@supports`-guarded clamp fallback (L96-99).

### 2.1 Brand colors (L26-31)

| Token | Value | Purpose (from source) |
|---|---|---|
| `--teal` | `#00a991` | primary brand teal (borders, CTA, slider thumb) |
| `--teal-bright` | `#19c39e` | eyebrow tick accent |
| `--teal-on-dark` | `#00c4a7` | teal stroke on midnight, WCAG-tuned |
| `--midnight` | `#090b32` | result card + trust card background |
| `--mist` | `#f5f9ff` | heat-icon tile background |
| `--ink` | `#1e1e1e` | body text |
| `--muted` | `#51607a` | secondary text |
| `--line` | `#e1e8f4` | hairline |
| `--line2` | `#d7deeb` | stronger hairline / control borders |
| `--mint` | `#9fe1cb` | battery bar, flags, share icons |
| `--neon` | `#55ff9a` | focus rings on dark |
| `--slate` | `#7c86b0` | icon strokes, soft labels |
| `--inset` | `#0c1040` | Sparstapel track background |
| `--chip` | `#11163f` | popover / lead-form / pay-chip surface |
| `--eyebrow` | `#5dcaa5` | result eyebrow text |
| `--subtext` | `#aeb8d4` | midnight-card secondary text |
| `--footnote` | `#8a93b5` | midnight-card tertiary / footnotes |
| `--pagebg` | `#e9eff8` | page background |
| `--amber` | `#f0b429` | long-payback flag, trust stars |
| `--bar-house` | `rgba(124,134,176,.38)` | **the one admitted new token** — story-bar grey "Hushållsel" segment (L31) |

Plot-scoped fan colors (used only in the stacked-fan plot, L32-34): `--fan-primary:#8b95bd`,
`--fan-kamin:rgba(240,180,41,.16)`, `--fan-air:#6f7bb0`.

### 2.2 Spacing — 4px grid on the 10px base (L35-40)

| Token | Value | px |
|---|---|---|
| `--sp-0` | `0` | 0 |
| `--sp-1` | `0.4rem` | 4 |
| `--sp-2` | `0.8rem` | 8 |
| `--sp-3` | `1.2rem` | 12 |
| `--sp-4` | `1.6rem` | 16 |
| `--sp-5` | `2.0rem` | 20 |
| `--sp-6` | `2.4rem` | 24 |
| `--sp-7` | `3.2rem` | 32 |
| `--sp-8` | `4.0rem` | 40 |
| `--sp-9` | `5.6rem` | 56 |
| `--sp-1h` | `0.6rem` | 6 — capped half-step, segmented gap only |
| `--sp-2h` | `1.0rem` | 10 — card-grid half-step (between `--sp-2` and `--sp-3`) |
| `--cta-y` | `1.6rem` | 16 — capped half-step, CTA vertical pad only |

Shell tokens (L42-44): `--shell-max:136rem` (1360px premium shell width), `--shell-gutter:var(--sp-6)`.

### 2.3 Type scale (Outfit; L46-58)

| Token | Value | Notes |
|---|---|---|
| `--ty-display` | `clamp(3.2rem, 2.4rem + 3vw, 5.2rem)` | the anchor number (32→52px) |
| `--ty-h` | `2.0rem` | lead-title, section heads (20px) |
| `--ty-lead` | `clamp(1.8rem, 1.5rem + 0.8vw, 2.2rem)` | 18→22px |
| `--ty-sub` | `1.55rem` | lead-sub (15.5px) |
| `--ty-body` | `1.6rem` | fields, toggles, body (16px) |
| `--ty-label` | `1.35rem` | labels, hints, caption (13.5px) |
| `--ty-eyebrow` | `1.2rem` | eyebrows, gearhead, tag (12px) |
| `--ty-micro` | `1.05rem` | footnotes, chart tip (10.5px) |

Weights: `--w-body:300`, `--w-mid:500`, `--w-black:900` (L56). Line-heights: `--lh-display:1.0`,
`--lh-tight:1.15`, `--lh-snug:1.35`, `--lh-body:1.55` (L57). Tracking: `--tr-display:-0.02em`,
`--tr-eyebrow:0.14em` (L58).

**Two tokens use `clamp()`** (`--ty-display`, `--ty-lead`) — see §5 for the iOS ≤13.3 static fallback.

### 2.4 Radius (L60-61)

| Token | Value | px |
|---|---|---|
| `--r-xs` | `0.6rem` | 6 |
| `--r-sm` | `0.9rem` | 9 |
| `--r-md` | `1.2rem` | 12 |
| `--r-lg` | `1.6rem` | 16 |
| `--r-xl` | `2.0rem` | 20 |
| `--r-pill` | `999rem` | pill |

### 2.5 Borders / hairlines (L63-67)

| Token | Value |
|---|---|
| `--bd-light` | `1px solid #dbe4f2` |
| `--bd-light-2` | `1px solid var(--line2)` |
| `--bd-dark` | `1px solid rgba(255,255,255,.12)` |
| `--bd-teal-dark` | `1px solid rgba(85,255,154,.30)` |

Note `#dbe4f2` in `--bd-light` is a raw hex, not a token reference.

### 2.6 Elevation / shadows (navy-tinted, L69-75)

| Token | Value |
|---|---|
| `--shadow-1` | `0 1px 2px rgba(9,11,50,.06),0 1px 1px rgba(9,11,50,.04)` |
| `--shadow-2` | `0 .6rem 1.6rem -.4rem rgba(9,11,50,.12),0 .2rem .6rem rgba(9,11,50,.07)` |
| `--shadow-3` | `0 2.4rem 5rem -1rem rgba(9,11,50,.20),0 .8rem 1.6rem -.6rem rgba(9,11,50,.10)` |
| `--shadow-teal` | `0 1.2rem 3rem -.8rem rgba(0,169,145,.42)` |
| `--ring-light` | `0 0 0 .3rem rgba(0,169,145,.28)` |
| `--ring-dark` | `0 0 0 .3rem rgba(85,255,154,.30)` |

The shadow rgba tints are `rgba(9,11,50,…)` — the raw midnight value, not `var(--midnight)`.

### 2.7 Motion tokens (durations ≤300ms, L77-81)

| Token | Value |
|---|---|
| `--ease` | `cubic-bezier(0.2,0.6,0.2,1)` |
| `--ease-out` | `cubic-bezier(0.16,1,0.3,1)` |
| `--t-fast` | `140ms` |
| `--t-mid` | `220ms` |
| `--t-slow` | `300ms` |
| `--t-stagger` | `45ms` |

Under `prefers-reduced-motion` all four durations collapse to `0ms` at the root (L90-92):
`--t-fast:0ms; --t-mid:0ms; --t-slow:0ms; --t-stagger:0ms;`.

### 2.8 Aurora surface (L83-88)

`--aurora` is a three-layer stacked radial-gradient used as the glow inside the midnight result card:

```css
--aurora:
  radial-gradient(120% 90% at 78% -8%, rgba(0,196,167,.22), transparent 56%),
  radial-gradient(90% 70% at 8% 4%, rgba(85,255,154,.10), transparent 60%),
  radial-gradient(100% 120% at 60% 110%, rgba(9,11,50,.40), transparent 60%);
```

It is painted via `.result::before` (L153), never as a `background` shorthand on the card itself.

---

## 3. Component vocabulary

Every class below is present in `index.html`. Grouped by region, with what it does, its load-bearing
declarations, and its states.

### 3.1 Layout shell

| Class | Line | Role & key declarations |
|---|---|---|
| `.page` | L133-134 | outer max-width wrapper. `max-width:var(--shell-max)` (1360px); `margin:0 auto`; padding uses `max(--shell-gutter, env(safe-area-inset-*))` L/R so the card clears the notch in landscape. |
| `.tool` | L135 | fully de-boxed: `background:none;border:0;border-radius:0;padding:0`. |
| `.panes` | L140 | `display:flex;gap:var(--sp-7);align-items:flex-start`. Gap bumps to `--sp-8` at `≥1200px` (L141). `align-items:flex-start` (no stretch) is why the result card must self-size, see §4. |
| `.input` | L142-143 | left card. `flex:0 0 42rem;max-width:42rem`; `background:#fff`; `border:var(--bd-light)`; `border-radius:var(--r-xl)`; `padding:var(--sp-7)`; **`position:sticky;top:var(--sp-6)`** on desktop. `box-shadow:var(--shadow-2)`. |
| `.rightcol` | L149 | `flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--sp-6)`. Holds the result card **and** the trust block stacked; it inherited the old `.result` flex sizing so two-pane widths are byte-identical (L146-148 comment). |

`.input` sticky note: the old `.static` kill-switch is retired; a too-tall card gets a sticky-BOTTOM
fallback via an inline negative `top` set by `checkStickyIntegrity()` in JS (L144-145).

### 3.2 Result card container

| Class | Line | Role & key declarations |
|---|---|---|
| `.result` | L150-151 | `background:var(--midnight)`; `border-radius:var(--r-xl)`; `padding:var(--sp-7)` (`--sp-8` at ≥1200px, L152); `color:#fff`; `position:relative;overflow:hidden`; `box-shadow:var(--shadow-3)`; `scroll-margin-top:var(--sp-4)` (jump-pill anchor). |
| `.result::before` | L153 | full-inset aurora glow layer, `background:var(--aurora);pointer-events:none`. |
| `.result::after` | L154-155 | full-inset top inner-highlight, `box-shadow:inset 0 1px 0 rgba(255,255,255,.08)`. |
| `.result>*` | L156 | `position:relative;z-index:1` — lifts real content above the two pseudo layers. |

### 3.3 Input card — gears & labels

The left-card vertical rhythm (one scale, no drift) is codified at L158-177:

- label → its control: `--sp-2`
- gearhead → its content: `--sp-4`
- control → next group: `--sp-6`
- hairline section (`data-gear="n2"`): `--sp-6` above and below.

| Class | Line | Role |
|---|---|---|
| `.gear` | L164-176 | a question group. `.gear > * + *{margin-top:var(--sp-5)}` base rhythm; `.gear > .lbl`/`#ownRow` open with `--sp-6` (L169). |
| `.gear[data-gear="n2"]` | L175 | the "Din el" group — quiet hairline separator `border-top:1px solid #eef2f9`, `--sp-6` pad above+below. |
| `.gearhead` | L178-179 | the group eyebrow. `font-size:var(--ty-eyebrow)`; `letter-spacing:var(--tr-eyebrow)`; `text-transform:uppercase`; `color:var(--muted)`; `font-weight:500`; `margin-bottom:var(--sp-4)`. UI: `Ditt hus`, `Din el`. |
| `.gearcopy` | L180 | helper paragraph. `font-size:var(--ty-label)`; `font-weight:300`; `color:var(--muted)`. `[hidden]` → `display:none` (L193). |
| `.lbl` | L183-185 | field label (question). `font-size:var(--ty-body)`; `font-weight:500`; `color:var(--ink)`; flex row, `gap:.5rem;flex-wrap:wrap`. Inline `svg` sized `1.5rem`, stroke `var(--slate)`. |
| `.lbl-row` | L186-187 | label + live value on one row (`justify-content:space-between`). |
| `.lbl-val` | L188 | the live output value. `font-weight:500`; `transition:transform var(--t-fast)`. UI examples: `150 m²`, `20 000 kWh per år`. |
| `.lbl-soft` | L189 | soft helper inside a label. `font-size:var(--ty-label)`; `color:var(--slate)`; `font-weight:300`. UI: `ungefär räcker`, `styr varmvattnet`, `elområdet styr elpriset`. |
| `.antag` | L191-192 | reusable assumption tag, real text never colour-only. `font-size:var(--ty-micro)`; `color:var(--footnote)`. UI: `(antagande)`. |

Sub-gear coupling rules that matter for the port: `.gear > .gear-collapsed{margin-top:var(--sp-2)}`
(L171); `.gear > .gearhead + *{margin-top:0}` (L173) so the head owns its own gap.

#### `.range` — native slider (L195-213)

- `.range` (L198): `-webkit-appearance:none`; `height:4.4rem` (44px touch body); `background:transparent`;
  `touch-action:pan-y` so horizontal drags hit the slider and vertical swipes still scroll.
- Track (L199, L205): `height:.8rem;border-radius:.4rem;background:#e3e9f5` (WebKit + Moz).
- Thumb (L200-202, L206-207): `2.8rem` circle, `background:#fff`, `border:2px solid var(--teal)`,
  `box-shadow:0 1px 3px rgba(9,11,50,.18)`.
- States: `:active` thumb scales `1.12` (L203, L208); `:focus-visible` gets `box-shadow:var(--ring-light)`
  (WebKit, L204) and a `2px solid var(--teal)` outline (Moz, L209); hover scales `1.06` gated to real
  pointers (L210-213).

#### Heat picker — `.heatpicker` / `.hp-*` (L215-278)

| Class | Line | Role |
|---|---|---|
| `.heatpicker` | L216 | reset fieldset — `border:0;margin:0;padding:0;min-width:0`. |
| `.hp-legend` | L217-218 | the question. `font-size:var(--ty-body)`;`font-weight:500`;`color:var(--ink)`; flex-wrap baseline row. UI: `Vad värmer huset idag?`. |
| `.hp-legend-soft` | L219 | soft suffix. UI: `Välj en eller flera`. |
| `.hp-grid` | L220 | `display:grid;grid-template-columns:repeat(2,1fr);gap:var(--sp-2h);margin-top:var(--sp-3)`. |
| `.hp-subhead` | L221-222 | full-row uppercase subhead inside the grid. |
| `.hp-card` | L223-233 | the multi-select tile. `min-height:8.8rem`; `padding:var(--sp-3)`; `border:1.5px solid var(--line2)`; `border-radius:var(--r-md)`; `background:#fff`. Hover (real pointers, L229-231) lifts `-1px` + teal border; `:active` scales `.995`; `:focus-visible` teal outline. |
| `.hp-ic` | L234-237 | 4rem icon tile, `background:var(--mist);color:var(--teal)`; svg `2.2rem`. |
| `.hp-lbl` | L238 | tile label, `font-weight:500`. |
| `.hp-card[aria-pressed="true"]` | L239-240 | selected: teal border, `background:#f2fbf8`, `box-shadow:var(--ring-light)`; its `.hp-ic` inverts to `background:var(--teal);color:#fff`. |
| `.hp-check` | L241-245 | absolute teal check badge top-right; `opacity:0;transform:scale(.6)` → `1`/`scale(1)` when pressed. |
| `.hp-card--quiet` | L251-258 | the compact "don't know" card. `grid-column:1/-1`; `min-height:4.4rem`; single-line, `border-style:dashed`, `color:var(--muted)`. Specificity `.hp-grid .hp-card--quiet` (0,2,0) beats the media-query `min-height` (comment L249-250). |
| `.hp-card.is-primary .hp-ic` | L260 | primary marker = `box-shadow:0 0 0 2px var(--teal)` ring on the tile — **no word**, avoids a superlative. |
| `.hp-hint` | L261-262 | status hint, `color:var(--muted)`. `[hidden]`→none. |
| `.hp-shares` / `.hp-shares-head` / `.hp-summary` | L264-268 | the share-split block. `.hp-summary:empty{display:none}`. UI head: `Hur mycket värmer var och en?`. |
| `.hp-share-row` | L269-272 | grid-fraction reveal: `grid-template-rows:0fr;opacity:0` → `.in{grid-template-rows:1fr;opacity:1}`; inner has `overflow:hidden;min-height:0`. |
| `.hp-share-name` | L273-276 | row title, baseline space-between, `1.5rem` icon. |
| `.capnote` | L277-278 | cap note under the shares. UI: `Komplementen täcker tillsammans högst 70 % av värmen.` |

#### Segmented control — `.seg` / `.seg-pill` (L280-295)

- `.seg` (L281): `position:relative;display:flex;gap:var(--sp-1h)`. `.seg-wrap{flex-wrap:wrap}` (L282);
  wrapped buttons flex `1 1 30%` (L295).
- `.seg-pill` (L285-287): the sliding selection pill. `position:absolute;z-index:0`;
  `background:#00806e` (an a11y-derived teal shade for white-text 4.6:1 — **NOT a new token**, comment
  L283-284); animated via `transform`/`width`/`height` transitions.
- `.seg button` (L288-291): `z-index:1;flex:1 1 auto`; `font-size:var(--ty-label)`;
  `border:var(--bd-light-2)`; `border-radius:var(--r-xs)`; `color:var(--muted)`; `min-height:4.4rem`;
  `white-space:nowrap`. Hover (real pointers) teal border on unselected (L292). `.on` →
  `color:#fff;border-color:var(--teal)` (L293). `:focus-visible` teal outline (L294).

#### Stepper — `.stepper` (L301-313)

- `.stepper` (L302): inline-flex, `border:var(--bd-light-2);border-radius:var(--r-xs);overflow:hidden`.
- `.stepbtn` (L303-309): `4.4rem` square button, `font-size:1.8rem`. Hover `#f0f4fb` (L305); `:active`
  scale `.92`; `[disabled]` `opacity:.35` (44px hit box kept).
- `.stepval` (L310): the count, `font-size:var(--ty-h);font-weight:500`. `.bump` plays `@keyframes
  ampyBump` (L312-313), a real keyframe re-triggered via JS reflow (the old transition never painted).

### 3.4 Result card — content

#### Eyebrow & anchor (L316-329)

- `.eyebrow-row` (L316): flex wrap, `gap:var(--sp-3)`.
- `.eyebrow` (L317-319): `font-size:var(--ty-eyebrow)`; `letter-spacing:var(--tr-eyebrow)`;
  `color:var(--eyebrow)`; uppercase; `::before` draws a `2.4rem × 2px` teal-bright tick. UI: `Så förbrukar
  ditt hus energi idag`.
- `.anchor-num` (L321-322): the hero figure. `font-size:var(--ty-display);font-weight:900`;
  `line-height:1.08`; `letter-spacing:var(--tr-display)`; `color:#fff`; `margin:var(--sp-3) 0 var(--sp-4)`;
  tabular-nums. `.flash` plays `@keyframes ampyFlash` (opacity .4→1, L324-325).
- `.nowrap` (L326) and `.anchor-per` (L328-329): keep the figure/unit from wrapping mid-phrase;
  `.anchor-per` is `inline-block;font-size:var(--ty-body);font-weight:300;color:var(--subtext);
  white-space:nowrap`.

#### Story bar — `.storybar` / `.sb-*` (L331-351)

- `.storybar` (L332): `display:flex;height:3.6rem;border-radius:var(--r-sm);overflow:hidden;width:100%`.
- `.sb-seg` (L333-334): a segment; `transform-origin:left center;transition:width var(--t-slow)`; siblings
  divided by `border-left:1px solid rgba(9,11,50,.5)`.
- Segment fills (L335): `.sb-heat{background:var(--teal-on-dark)}`, `.sb-vv{background:var(--mint)}`,
  `.sb-house{background:var(--bar-house)}`.
- Entrance (L337-341): `.is-drawing .sb-seg{transform:scaleX(0)}` → `.is-drawn .sb-seg{transform:scaleX(1)}`
  with a `--t-stagger` cascade (heat 0ms, vv 45ms, house 90ms).
- `.sb-legend` (L342-346): column list that becomes a wrapping row at `≥481px` (L344). `b` is
  `font-weight:500;color:#fff`, tabular.
- `.sb-dot*` (L347-348): `1rem` colour swatches matching the segments.
- `.sb-mix` (L349-350) / `.anchor-note` (L351): micro footnotes, `color:var(--footnote)`; hidden when
  `[hidden]` or `:empty`. UI legend labels: `Uppvärmning`, `Varmvatten`, `Hushållsel`.

#### Sparstaplarna — `#spark` / `.sp-*` (L353-442)

The savings visual: horizontal saving bars, solid teal fill = "räknat lågt" (LOW), mint band = "upp
till" (HIGH), ★ ring on the lead, tap a row to expand a verdict + two figure lines (comment L353-356).

| Class | Line | Role |
|---|---|---|
| `.spark` | L357 | container. `margin-top:var(--sp-6);border:0;padding:0`. |
| `.spark-h` | L358 | heading. `font-size:var(--ty-h);font-weight:500;color:#fff`. UI: `Så mycket kan du spara per år`. |
| `.spark-list` | L360 | `margin-top:var(--sp-4);min-height:20rem` (reserves height → no CLS on first paint; shrinks to `12rem` at ≥992px, L692). |
| `.spark-foot` | L362-363 | solar "Planeras" note, `color:var(--footnote)`. `[hidden]`→none. |
| `.sp-item` | L365-374 | one recommendation row card. `background:rgba(255,255,255,.02)`; `border:1px solid rgba(255,255,255,.06)`; `border-radius:var(--r-md);overflow:hidden`. `+ .sp-item{margin-top:var(--sp-2h)}`. |
| `.sp-item.is-rec` | L368-369 | the recommended row — neon border `rgba(85,255,154,.55)`, tinted bg, `box-shadow:0 0 0 3px rgba(85,255,154,.10)`. |
| `.sp-item.is-off` | L370-372 | de-emphasised row, `opacity:.65` (was .4, now ~2:1 contrast); note + val stay readable via `var(--subtext)`. |
| `.sp-item--batt` | L373-374 | battery variant — mint fill/band/val. |
| `.sp-row` | L376-380 | the tappable row button. `display:block;width:100%;text-align:left`; `padding:var(--sp-3)`; `min-height:4.4rem`. `.sp-row--static{cursor:default}`. `:focus-visible` neon inset outline (L380). |
| `.sp-flag` | L382-386 | pill flag, `background:var(--mint);color:var(--midnight)`; `.sp-star` `1.2rem` fill midnight. |
| `.sp-head` | L388 | baseline flex row (name + value). Wraps on mobile (L651-652). |
| `.sp-name` | L389-392 | ellipsis name, `font-size:var(--ty-body);font-weight:300;color:var(--subtext)`; `.is-rec` → white/500. |
| `.sp-val` | L393-396 | the money value, `font-weight:500;color:var(--teal-on-dark)`, tabular, nowrap. Modifiers: `--soft` (footnote, `utan pris`), `--amber` (`dyrare`, wraps). |
| `.sp-tag` | L397-398 | inline mint pill tag. |
| `.sp-note` | L399-400 | reason line, `color:var(--footnote)`. |
| `.sp-caret` | L401-403 | disclosure chevron, `1.6rem;color:var(--slate)`; rotates 180° on `[aria-expanded="true"]`. |
| `.sp-barline` / `.sp-track` / `.sp-fill` / `.sp-band` | L405-411 | the bar. Track `height:1.2rem;background:var(--inset)`; fill `background:var(--teal-on-dark)` animates `width var(--t-mid)`; band `rgba(159,225,203,.34)` animates width+left. |
| `.sp-pay` | L412-414 | payback chip, `background:var(--chip)`, tabular; `--weak` fades it. |
| `.sp-drop-body` | L417 | expanded panel, `border-top:var(--bd-dark)`. |
| `.sp-verdict` | L418-420 | verdict sentence, `font-size:var(--ty-sub);color:var(--subtext);max-width:62ch`. |
| `.sp-rows` / `.sp-statrow` | L424-433 | the vertical stat rows (owner v30). Each row baseline space-between, hairline `rgba(255,255,255,.08)` between rows. `-k` label `color:var(--footnote)`; `-v` value `font-size:1.55rem;font-weight:500;color:#fff;white-space:nowrap`; `-v--weak` turns amber for long payback. UI keys: `Ny kostnad per år`, `Besparing per år`, `Återbetalningstid`. |

Sparstaplarna entrance (L437-442): `.spark-list.is-drawing` zeroes fill scaleX, band + pay opacity;
`.is-drawn` runs them back with staggered delays (fill immediate, band +140ms, pay +200ms), JS-toggled.

### 3.5 CTA block — `.ctablock` / `.cta` / `.share-*` (L444-491)

| Class | Line | Role |
|---|---|---|
| `.ctablock` | L445 | wrapper, `margin-top:var(--sp-7)`. |
| `.cta` | L448-461 | the one loud element. `display:block;width:100%;background:var(--teal);color:#fff`; `font-size:clamp(1.6rem, 1.5rem + 0.3vw, 1.8rem)`; `padding:var(--cta-y) var(--sp-4)`; `border-radius:var(--r-md)`. Inside `.ctablock`, `margin-top:0` (L452). `.cta--primary{min-height:5.2rem}` (L453). Hover (real pointers) lifts `-2px`, `background:#00b89e`, teal shadow (L454-455). `:active` scale `.99`; `:focus-visible` neon outline; `[disabled]` `opacity:.6` sent-state. |
| `.cta.is-close` | L463 | the CTA morphs to a ghost "Stäng" when the inline form opens — transparent, `border:1px solid rgba(255,255,255,.18);color:var(--subtext)`. |
| `.share-wrap` | L468 | relative wrapper for the popover. |
| `.share-btn` | L469-474 | demoted quiet text action, still `min-height:4.4rem`; transparent; `color:var(--subtext);font-weight:300`. `--quiet` hover underlines. |
| `.share-pop` | L478-483 | the desktop popover. `position:absolute;bottom:calc(100% + .6rem);left:50%;transform:translateX(-50%)`; `min-width:24rem;background:var(--chip)`; `box-shadow:var(--shadow-3)`. `[hidden]`→none. `--below` flips it below when space above is tight (L483). |
| `.share-act` | L484-491 | a popover row, `min-height:4.4rem`; svg `1.8rem;color:var(--mint)`. `.is-done .share-act-lbl{color:var(--mint)}`. |

UI: `Få kostnadsfri rådgivning` (primary), `Dela din kalkyl` (share), `Kopiera länk` / `Dela via mejl` /
`Dela på Facebook` (popover). The soft-branch `.cta--ghost` is **retired** — every branch now leads with
the solid teal primary (comment L464-465).

### 3.6 Methodology — `.method` (L493-507)

- `.method` (L494): `margin-top:var(--sp-4);border-top:1px solid rgba(255,255,255,.08)`.
- `.method summary` (L495-499): `list-style:none;cursor:pointer;font-size:var(--ty-label);
  color:var(--subtext);min-height:4.4rem`; native marker hidden (L496); svg rotates 90° on `[open]`
  (L500). UI: `Så har vi räknat`.
- `.method-body` (L501-502): `font-size:var(--ty-label);color:var(--footnote);max-width:70ch`.
- `.method-list` (L504-505): disc list, `padding-left:1.8rem`.
- `.method-legal` (L506-507): legal fritext, `border-top:1px solid rgba(255,255,255,.08)`;
  `font-size:var(--ty-micro);color:var(--footnote)`. The old curve is gone (comment L503).

### 3.7 Inline lead form — `.lead-*` / `.hp` (L509-551)

Opens *inside* the midnight card, after the CTA.

| Class | Line | Role |
|---|---|---|
| `.lead-inline` | L512-516 | the collapsible wrapper (shares `.gear-collapsed` grid mechanic). `.open{margin-top:var(--sp-5)}`; transitions `grid-template-rows`, `opacity`, `margin-top`. `[hidden]`→none. |
| `.lead-inline-body` | L517-518 | `background:var(--chip);border-radius:var(--r-lg);padding:var(--sp-5)`. |
| `.lead-title` | L521 | `font-size:var(--ty-h);font-weight:500;color:#fff;padding-right:3.6rem` (clears the close button). UI: `En elektriker räknar på ditt hus`. |
| `.lead-sub` | L522 | `font-size:var(--ty-sub);color:var(--subtext)`. UI: `Vi hör av oss inom en arbetsdag och ger dig en kostnadsfri rådgivning.` |
| `.lead-lbl` | L523 | field label, `font-size:var(--ty-eyebrow);color:var(--subtext)`. UI: `Ditt namn`, `Telefonnummer`, `Postnummer`, `E-postadress`. |
| `.lead-req` | L524 | red required marker `color:#ff8a8a` (Evify convention). |
| `.lead-field` | L525-528 | `width:100%;min-height:44px;padding:1.0rem 1.1rem`; `border:1px solid rgba(255,255,255,.12);border-radius:var(--r-sm)`; `color:#fff;background:rgba(255,255,255,.04)`. `:focus-visible` → neon border + `var(--ring-dark)`. Capped `max-width:48rem` at ≥992px (L696). |
| `.lead-field[aria-invalid="true"]` | L531 | **red border only** — `border-color:#ff8a8a;box-shadow:inset 0 0 0 .5px #ff8a8a`; messages live in `sr-only`, zero layout shift (comment L529-530). |
| `.lead-err` / `.field-err` | L532-533 | error text `color:#ff8a8a`; `[hidden]`→none. |
| `.leadclose` | L534-538 | absolute close button top-right, `3rem` square; hover `rgba(255,255,255,.06)`. |
| `.hp` (honeypot) | L539 | `position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden`. (Field `name="hp_extra"` in HTML — never an autofill token.) |
| `.lead-submit` | L540 | `margin-top:var(--sp-4)` (it is also a `.cta`). UI: `Boka kostnadsfri rådgivning`. |
| `.lead-consent` | L542-546 | consent line, `font-size:var(--ty-label)` (13.5px — legally load-bearing text is never micro, comment). Link underlined, taller tap target. |
| `.lead-success` | L547-551 | success panel, centered, `color:var(--subtext)`; svg `3rem;color:var(--teal)`; `p` white. `[hidden]`→none. |

### 3.8 Trust block — `.trust-*` (L553-581)

A real Ampy dusk photo under a left-weighted midnight veil; same radius/shadow family as the result card
so the seam reads seamless (comment L553-559).

| Class | Line | Role |
|---|---|---|
| `.trust` | L560-561 | `position:relative;border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--shadow-3);background:var(--midnight);isolation:isolate`. |
| `.trust-photo` | L562-563 | full-inset `object-fit:cover;object-position:64% 50%` (mobile crop `58% 42%`, L662). |
| `.trust-veil` | L564-566 | z-1 double gradient: a 103° left-weighted midnight fade `rgba(9,11,50,.94)→.28` plus a bottom-up seat `rgba(9,11,50,.66)→0`. Mobile re-tunes both (L665-667). |
| `.trust::after` | L567-568 | z-3 inner hairline highlight. |
| `.trust-inner` | L569 | z-2 content, `padding:3rem 3.2rem` (mobile `2.6rem 2.4rem`, L661). |
| `.trust-quote` / `.trust-mark` | L570-573 | blockquote, `max-width:30ch`; oversized decorative `”` mark `7.2rem;color:var(--teal-on-dark);opacity:.55` (mobile `6.4rem`, L663). Quote `p` white, `font-size:var(--ty-lead);font-weight:500`. UI: `Från start till mål levererades en service i världsklass.` |
| `.trust-cite` | L574-575 | `color:var(--subtext);font-style:normal`. UI: `Hugo Grafström Olsson`. |
| `.trust-rating` / `.trust-stars` | L576-579 | rating row; stars svg `1.8rem;fill:var(--amber)` with a drop-shadow to lift gold off bright sky. UI: `5 av 5 · Betyg på Google`. |
| `.trust-divider` | L580 | `height:1px;width:44%;min-width:22rem;background:rgba(255,255,255,.16)` (full-width on mobile, L664). |
| `.trust-stat` | L581 | `font-size:var(--ty-sub);font-weight:500;color:#fff`, tabular. UI: `3 000+ genomförda installationer om året`. |

### 3.9 Mobile jump-pill — `.jump-pill` / `.jp-chip` (L583-605)

- `.jump-pill` (L586-595): fixed pill, `left:50%;bottom:calc(1.6rem + env(safe-area-inset-bottom,0px));
  z-index:60`; `background:var(--midnight)` (solid, no gradient); `min-height:4.6rem`;
  `border:1px solid rgba(255,255,255,.16)`. Hidden by default (`display:none`), shown as `inline-flex`
  only at `≤991px` (L599), and only `.show` makes it `opacity:1;pointer-events:auto` (L600).
- `.jp-chip` (L596-597): `3.4rem` teal circle holding the down-arrow svg.
- `@keyframes jpNudge` (L604): a 2.6s idle bob on the chevron, `translateY(0)→.2rem→0` — runs only when
  `.show` (L601) and is killed under reduced-motion (L605).
- UI: `Se resultatet`.

### 3.10 Reveal mechanic — `.gear-collapsed` (L607-617)

The shared disclosure engine (used by sub-gears, share rows, and the lead form): `display:grid;
grid-template-rows:0fr;opacity:0` → `.open{grid-template-rows:1fr;opacity:1}` (L609-611); inner uses
`overflow:hidden;min-height:0` (L612). A closed panel is forced to zero space (`:not(.open){margin-top:0;
padding-top:0}`, L616-617) so no phantom margin leaks into the group rhythm.

---

## 4. Responsive — breakpoints, exactly

23 `@media` blocks, **0 `@container` queries** (verified: `grep -c @container` = 0). The breakpoint
bands are contiguous and deliberately gapless (comment L630-633): **≤991 stacked / ≥992 two-pane**. The
old 769-991 two-pane band was deleted because ~430px starved the result column. **This viewport-query
model is the current state; the `@container` conversion is doc 06's job** — you are reading the
as-shipped baseline.

### 4.1 Width breakpoints (8 blocks)

| Line | Query | What it does |
|---|---|---|
| L141 | `min-width:1200px` | `.panes` gap → `--sp-8` |
| L152 | `min-width:1200px` | `.result` padding → `--sp-8` |
| L344 | `min-width:481px` | `.sb-legend` becomes a wrapping row |
| L599 | `max-width:991px` | `.jump-pill{display:inline-flex}` (pill enabled) |
| L634-654 | `max-width:991px` | **the stack**: `.panes` column; `.input` full-width, `position:static`, `order:1`; `.rightcol` `order:2`; 44px touch floors on `.seg button`/`.stepbtn`/`.leadclose`; `.sp-head` wraps, `.sp-name` breaks by word |
| L655-687 | `max-width:480px` | **mobile tune**: `.page` padding `--sp-4 --sp-3 --sp-8`; `.result` padding `--sp-4`; `.input` padding `--sp-5`; trust re-crop/re-veil; `.hp-ic` → 3.4rem; `.storybar` → 3.2rem; the left-column breathing pass (group rhythm steps up: `.lbl`/`#ownRow` → `--sp-7`, seg buttons → `4.8rem`); `.method summary` → 1.5rem |
| L688-718 | `min-width:992px` | **the two-pane desktop**: `.sp-track` → 1rem; `.spark-list` min-height → 12rem; `.lead-field` `max-width:48rem`; **`#leadForm` becomes a 2-col grid** with explicit `grid-row`/`grid-column` placement for Namn+Telefon then Postnummer+E-post, submit pinned to `grid-row:7`, consent row 8, error row 9 (L697-717) |
| L721-723 | `min-width:992px and max-width:1200px` | narrow two-pane band (incl. iPad landscape 1024) — `.sp-name{white-space:normal}` so the ★ title wraps instead of clipping |

### 4.2 Non-width `@media` (15 blocks)

- **`prefers-reduced-motion:reduce`** ×3 — L90-92 (zeroes motion tokens at `:root`), L605 (kills the
  jpNudge bob), L726-728 (global belt-and-braces: `*{animation-duration:0s!important;
  transition-duration:0s!important;scroll-behavior:auto!important}`).
- **`print`** ×1 — L103-107 (see §5).
- **`hover:hover and pointer:fine`** ×11 — L210, L229, L292, L305, L379, L454, L473, L489, L497, L537,
  L545. All decorative hovers are gated to real pointers so touch devices get no sticky-hover state.

---

## 5. Motion & accessibility

- **Reduced motion is handled twice.** First the four motion-duration tokens collapse to `0ms` at the
  root (L90-92), which zeroes every token-driven transition/animation-delay. Then a global override
  (L726-728) forces `animation-duration:0s`, `transition-duration:0s`, `scroll-behavior:auto` on `*` with
  `!important` — a deliberate belt-and-braces on top of the zeroed tokens.
- **Entrance choreography** (L619-627): `@keyframes ampyRise{from{opacity:0;transform:translateY(12px)}
  to{opacity:1;transform:none}}`. `.result.enter > *` runs it, with staggered `animation-delay`
  multiples of `--t-stagger` (anchor ×1, storybar ×2, legend ×3, spark ×4, ctablock ×6). `.input` also
  rises (L627). Because the delays are `calc(var(--t-stagger)*n)` and `--t-stagger` is `0ms` under
  reduced motion, the stagger flattens automatically.
- **Grid-fraction reveals** are the house disclosure technique: `grid-template-rows:0fr → 1fr` on
  `.gear-collapsed` (L609-611), `.hp-share-row` (L269-271), and `.lead-inline` (L512-515). No `height`
  animation, no `display` swap — the collapsed state is genuinely zero-height (L616).
- **Other keyframes**: `ampyBump` (stepper value, L312), `ampyFlash` (anchor number, L324), `jpNudge`
  (jump-pill chip, L604). `ampyBump`/`ampyFlash` are re-triggered from JS via forced reflow because a
  plain class add/remove never repainted (comments L312, L323-324).
- **`@media print`** (L103-107): browsers drop backgrounds when printing, which would print the midnight
  result card white-on-white. This block hides `.jump-pill` and `#sharePop`, forces
  `-webkit-print-color-adjust:exact;print-color-adjust:exact` on `.result`/`.trust`, and pins `.input`
  to `position:static`.
- **`@supports not (font-size: clamp(...))`** (L96-99): on iOS ≤13.3 `clamp()` is unsupported, and a
  `var()` substitution of an invalid clamp goes invalid-at-computed-value (a plain cascade fallback line
  does **not** rescue it), so the two clamp tokens are re-declared static there: `--ty-display:4.0rem`,
  `--ty-lead:1.9rem`, and `.cta{font-size:1.7rem}`.
- **Tap-highlight off** (L116): `html{-webkit-tap-highlight-color:transparent}`; interaction surfaces
  (`button,.range,.seg,.stepper,.hp-card,.sp-row,.method summary`, plus `.input .lbl,.sb-legend`) get
  `user-select:none` (L117-119) so dragging a slider never selects label text. Form fields and body copy
  stay selectable.
- **Focus rings**: light surfaces use `2px solid var(--teal)`; dark surfaces use `var(--neon)` /
  `var(--ring-dark)`. All are `:focus-visible` (keyboard-only), never bare `:focus`.
- **Touch floors**: every interactive control is ≥44px — `.range` 4.4rem body, `.seg button`/`.stepbtn`/
  `.hp-card`/`.sp-row`/`.share-*`/`.method summary`/`.leadclose` all min 4.4rem (reinforced at ≤991px,
  L644-646).

---

## 6. Global-scope rules that will bleed into WordPress — [BLEED → doc 06]

These rules are written for a standalone page. Inside a WordPress/Bricks theme they will reach beyond the
calculator. **They are documented as-is; the isolation work (wrapper-scoping, `@container`, rem→px,
namespacing) is doc 06's job — do not solve it here.** Each entry names the offender and why it bleeds.

| Line | Rule | Why it bleeds |
|---|---|---|
| L20 | `html{font-size:62.5%;scroll-behavior:smooth}` | **The big one.** Resets the document root to `1rem=10px`. Every other theme/plugin that sizes in `rem` will shrink to 62.5%. Must not touch `html` in WP — the tool's rems must be converted to px (or scoped to a container with its own font-size). |
| L21-22 | `body{margin:0;font-size:1.6rem;font-family:'Outfit'…;background:var(--pagebg);color:var(--ink)…}` | Styles the whole page body — margin reset, global font, page background, text color all leak site-wide. |
| L24-88 | `:root{ … }` | All ~90 custom properties are declared on `:root`, i.e. global. Generic names (`--teal`, `--line`, `--ink`, `--sp-4`, `--r-md`, `--ease`…) can collide with theme or other-plugin variables of the same name. |
| L90-92 | `:root{ --t-*:0ms … }` (reduced-motion) | Same global `:root` surface — re-declares tokens document-wide. |
| L96-99 | `@supports not clamp → :root{ --ty-* … }` | Same — global `:root` token override. |
| L109 | `*{box-sizing:border-box}` | Universal selector — resets box-sizing on **every element on the page**, not just the tool. |
| L110 | `button{font-family:inherit}` | Bare element selector — hits every `<button>` in the theme. |
| L116 | `html{-webkit-tap-highlight-color:transparent}` | Global — removes the tap flash for the whole document, including theme links/buttons. |
| L726-728 | `@media (prefers-reduced-motion){ *{animation-duration:0s!important;transition-duration:0s!important;scroll-behavior:auto!important} }` | Universal selector **with `!important`** — for reduced-motion users this kills every animation/transition on the entire page, theme included. The most aggressive bleed in the file. |
| — | Generic class names | Many classes are theme-collision-prone and must be namespaced: `.page`, `.tool`, `.panes`, `.input`, `.result`, `.trust`, `.method`, `.eyebrow`, `.range`, `.seg`, `.stepper`, `.cta`, `.share-btn`, `.jump-pill`, plus bare element selectors `button`/`.method summary`. Any of these can already exist in a Bricks build. |

**Summary for the porter:** the calculator currently assumes it owns the document. For FluentSnippets it
must be wrapped in a scoping container, the `html`/`body`/`*`/`:root` global rules relocated or
neutralised, the 62.5% rem base converted, and the generic tokens/classes namespaced. That conversion is
specified in **doc 06** — this reference only inventories the current state.
