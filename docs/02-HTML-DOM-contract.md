# Energikalkylatorn — HTML / DOM Contract

> **Audience:** Chris (WordPress / Bricks / FluentSnippets) + any maintainer. Document 2 of 6.
> **Source of truth:** `vB/index.html` (287 lines) and the selectors in `vB/app.js` (2048 lines).
> **Rule this doc exists to enforce:** `app.js` finds every element by a hard-coded `id`. **If you rename
> an id, the tool silently half-renders.** This is the list of ids you must keep, verbatim.
> Swedish UI strings below are quoted **verbatim** — do not translate or "improve" them; voice is owner-locked.

---

## 1. Page structure, top-down

### 1.1 `<head>` (index.html lines 3–32)

| Line(s) | What | Note |
|---|---|---|
| 4 | `<meta charset="utf-8">` | Keep first. |
| 5 | `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` | `viewport-fit=cover` = notch-safe; the layout uses it. |
| 6 | `<title>` — `Energikalkylatorn: vad kostar det att värma ditt hus?` | |
| 7 | `<meta name="description">` — `Räkna på ditt hus och se vad som är värt att göra. Ärliga siffror, räknat försiktigt.` | |
| 10–19 | **Open Graph** block — `og:type/site_name/locale(sv_SE)/url/title/description/image/image:width(1200)/height(630)/image:alt`. `og:title` = `Betalar du för mycket för elen?` | `og:image` = `og.png?v=2` (versioned **separately** from `?v=36`). |
| 20–23 | **Twitter** block — `twitter:card=summary_large_image`, title, description, image (`og.png?v=2`). | |
| 25 | **Favicon** — inline `data:image/svg+xml` (midnight rounded square + teal bolt). **No file, no request.** | Do not replace with a `.ico` link on the port unless you want an extra request. |
| 28–30 | **Font preloads** — `Outfit-Light.woff2`, `Outfit-Medium.woff2`, `Outfit-Black.woff2`, each `as="font" type="font/woff2" crossorigin`, path `../fonts/`. | See §6. Paths are **relative to `vB/`** — they change on the port. |
| 31 | `<link rel="stylesheet" href="tool.css?v=36">` | Cache-bust query; see doc 01 §Versioning. |

### 1.2 `<body>` DOM tree (indented overview)

```
body
└─ div.page
   └─ div.tool#ampyTool
      ├─ h1.sr-only                     "Energikalkylatorn"  (headline lives in the site hero; this is a11y/SEO only)
      ├─ noscript > p.noscript-note     JS-off fallback message
      └─ div.panes
         ├─ form.input#inputForm  (autocomplete="off" novalidate)   ← LEFT input card, position:sticky on desktop
         │  ├─ div.gear[data-gear="n1"]  "Ditt hus"
         │  │  ├─ fieldset.heatpicker#heatPicker
         │  │  │  ├─ legend.hp-legend        "Vad värmer huset idag?" + soft "Välj en eller flera"
         │  │  │  ├─ div.hp-grid#hpGrid        ← EMPTY; app.js builds the cards
         │  │  │  ├─ p.hp-hint#hpHint (hidden, role=status aria-live=polite)
         │  │  │  ├─ div.hp-shares#hpShares (hidden)
         │  │  │  │  ├─ div.hp-shares-head    "Hur mycket värmer var och en?"
         │  │  │  │  └─ p.hp-summary#hpSummary (role=status aria-live=polite)   ← app.js writes; share-rows insert before it
         │  │  │  └─ p.capnote#complementCapNote (hidden, aria-live)   "Komplementen täcker tillsammans högst 70 % av värmen."
         │  │  ├─ div.lbl.lbl-row  "Boyta" + output#areaOut ("150 m²")
         │  │  ├─ input[type=range]#areaSlider  (data-input="area", 40–400 step 10, value 150)
         │  │  ├─ div.lbl  "Byggår" + span.antag#eraAsm ("(antagande)")
         │  │  ├─ div.seg.seg-wrap#eraSeg (role=radiogroup)   ← EMPTY; app.js builds
         │  │  ├─ div.lbl.lbl-row  "Boende" + span.stepper (2× button.stepbtn[data-step=occupants] + output#occOut)
         │  │  ├─ input[type=hidden]#occupantsField (data-input="occupants", value 2)
         │  │  ├─ div.lbl  "Var ligger huset?"
         │  │  └─ div.seg#priceAreaSeg (role=radiogroup)   ← EMPTY; app.js builds
         │  └─ div.gear[data-gear="n2"]  "Din el"
         │     ├─ div#ownRow
         │     │  ├─ div.lbl  "Vet du vad huset drar per år?"
         │     │  ├─ div.seg#ownSeg (role=radiogroup)   ← EMPTY; app.js builds (Vet inte / Ja, ungefär)
         │     │  └─ div.gear.gear-collapsed[data-gear="own"]#gearOwn (hidden)
         │     │     └─ div.gear-inner: label + output#ownOut + input[type=range]#ownSlider (5000–60000 step 500) + p.gearcopy
         │     ├─ div.lbl  "Solceller"
         │     ├─ div.seg#solarSeg (role=radiogroup)   ← EMPTY; app.js builds (Nej / Finns / Planeras)
         │     └─ div.gear.gear-collapsed[data-gear="sol"]#gearSol (hidden)
         │        └─ div.gear-inner: label + output#solarOut + input[type=range]#solarSlider (2000–12000 step 500) + p.gearcopy
         └─ div.rightcol
            ├─ div.result#result                       ← RIGHT result card
            │  ├─ div.eyebrow-row > span.eyebrow#eyebrow  "Så förbrukar ditt hus energi idag"  (STATIC — see §3)
            │  ├─ p.anchor-num#anchorNum                 "—"  ← app.js writes the yearly-cost total
            │  ├─ div.storybar#storyBar (aria-hidden)     3× span.sb-seg (.sb-heat/.sb-vv/.sb-house)  ← app.js sets widths
            │  ├─ ul.sb-legend                            3× li with b#sbHeatKr / #sbVvKr / #sbHouseKr
            │  ├─ p.sb-mix#sbMix (hidden)                 ← app.js writes the multi-system split line
            │  ├─ section.spark#spark (aria-labelledby=sparkH)
            │  │  ├─ h2.spark-h#sparkH                    "Så mycket kan du spara per år"
            │  │  └─ div.spark-list#sparkList (role=list) ← EMPTY; app.js builds the saving bars (Sparstaplarna)
            │  ├─ div.sr-only#resultLive (aria-live=polite aria-atomic)   ← the ONE result announcer
            │  ├─ div.ctablock
            │  │  ├─ button.cta.cta--primary#ctaBtn        "Få kostnadsfri rådgivning"
            │  │  └─ div.share-wrap
            │  │     ├─ button.share-btn#shareBtn (aria-haspopup=menu aria-controls=sharePop)  "Dela din kalkyl"
            │  │     └─ div.share-pop#sharePop (role=menu, hidden)
            │  │        ├─ button#shareCopy (role=menuitem)  "Kopiera länk"
            │  │        ├─ a#shareMail (role=menuitem)        "Dela via mejl"
            │  │        └─ a#shareFb (role=menuitem, target=_blank rel=noopener)  "Dela på Facebook"
            │  ├─ p.sr-only#shareLive (role=status)          ← copy-confirmation announcer
            │  ├─ div.lead-inline.gear-collapsed#leadInline (hidden)   ← the inline lead form (see §4)
            │  └─ details.method > summary "Så har vi räknat" + div.method-body > div#methodBody  ← app.js writes bullets+legal
            └─ aside.trust (aria-label="Omdöme och erfarenhet")   ← static trust block (see §6)
               img.trust-photo (trust-elinstallation.webp) + div.trust-veil + div.trust-inner
               (blockquote + 5× star svg + "5 av 5 · Betyg på Google" + divider + "3 000+ genomförda installationer om året")
```

**Outside `.page`** (index.html lines 278–285):
- `button.jump-pill#jumpPill` (tabindex=-1, aria-hidden) — mobile "Se resultatet" pill (see doc 05 §7).
- Four scripts, **strict order**, each `?v=36`: `data.js` → `engine.js` → `rank.js` → `app.js`.

---

## 2. The element-ID contract (DO NOT RENAME)

Every id below is read or written by `app.js`. Renaming any one breaks that feature **silently** (no console
error — the guarded `$()` just returns `null` and the branch no-ops). Keep the id spelling exactly.
`app.js` line refs are indicative anchors.

### 2.1 Left input card

| id | Element | app.js does | Ref |
|---|---|---|---|
| `inputForm` | `form.input` | Sticky-integrity re-anchor sets inline `top` when the card outgrows the viewport. | 1755 |
| `heatPicker` | `fieldset` | Container (no direct lookup); holds `hpGrid`. | — |
| `hpGrid` | `div.hp-grid` | **Filled by JS**: builds one `button.hp-card` per heat system + the quiet "Vet inte" card. Click → `toggleCard`. | 378 |
| `hpHint` | `p.hp-hint` | `setHint()` writes/clears the hint (e.g. the Vet inte / Fjärrvärme note); toggles `hidden`. | 487 |
| `hpShares` | `div.hp-shares` | Shown only when 2+ systems are on; JS inserts one `.hp-share-row` per system before `hpSummary`. | 534 |
| `hpSummary` | `p.hp-summary` | Writes `"Vi räknar: <system> ~<share> %, …"` split line. | 1407 |
| `complementCapNote` | `p.capnote` | `hidden` toggled by the engine's `complementClamped` flag. | 833 |
| `areaSlider` | `input[type=range]` | Read for `area`; `input` updates `#areaOut`, throttled recompute; share-decode sets `.value`. | 739, 1529 |
| `areaOut` | `output` | Written with `"<n> m²"`. | 1529 |
| `eraAsm` | `span.antag` | `hidden` toggled — shows "(antagande)" only while byggår = Vet inte (`'x'`). | 344, 1851 |
| `eraSeg` | `div.seg` | **Filled by JS**: 5 byggår buttons (`Före 1940 / 1940-1990 / 1990-2020 / Efter 2020 / Vet inte`). | 341 |
| `occupantsField` | `input[type=hidden]` | Holds the occupants count; read into `inputs.occupants`; stepper writes `.value`. | 739, 1559 |
| `occOut` | `output.stepval` | Written with the count; `bump` keyframe on change. | 1562 |
| `priceAreaSeg` | `div.seg` | **Filled by JS**: one button per elområde from `D.priceAreas`. Sets `state.priceArea`, `seTouched`. | 332 |
| `ownRow` | `div` | Whole own-figure block; `hidden` toggled by the all-electric gate (`ownRowAllowed`). | 710 |
| `ownSeg` | `div.seg` | **Filled by JS**: `Vet inte / Ja, ungefär`. Activation = assertion. | 348 |
| `gearOwn` | `div.gear` | Collapsible; `open` class toggled when own-mode = "ja" and allowed. | 721 |
| `ownSlider` | `input[type=range]` | `input` → `state.ownKwh` + `#ownOut`; `change` → settle + `own_slider_set` (bucketed). | 1532 |
| `ownOut` | `output` | Written with `"<n> kWh per år"`. | 1536 |
| `solarSeg` | `div.seg` | **Filled by JS**: `Nej / Finns / Planeras`. | 357 |
| `gearSol` | `div.gear` | Collapsible; `open` toggled when solar = "finns". | 730 |
| `solarSlider` | `input[type=range]` | `input` → `state.solarKwh` + `#solarOut`. | 1546 |
| `solarOut` | `output` | Written with `"<n> kWh per år"`. | 1550 |

Stepper buttons use `.stepbtn[data-step="occupants"][data-dir="±1"]` (class + data-attrs, not ids) — keep those.

### 2.2 Right result card

| id | Element | app.js does | Ref |
|---|---|---|---|
| `result` | `div.result` | Observed by the jump-pill IntersectionObserver; entrance animation target. | 1724, 2025 |
| `eyebrow` | `span.eyebrow` | **STATIC** — `app.js` never touches it (see §3). Keep the id/text as-is. | — |
| `anchorNum` | `p.anchor-num` | Written with the yearly-cost total: `<span class="nowrap">…</span> <span class="anchor-per">kr per år</span>`. Also the **hard-fail message** target if a script fails to load. | 877, 29 |
| `storyBar` | `div.storybar` | JS sets the width of its 3 children `.sb-heat/.sb-vv/.sb-house`. | 900 |
| `sbHeatKr` / `sbVvKr` / `sbHouseKr` | `b` in `.sb-legend` | Written with `"~<n> kr"` for Uppvärmning / Varmvatten / Hushållsel. | 905–907 |
| `sbMix` | `p.sb-mix` | Multi-system per-member cost lines + solar offset line; `hidden` when single-system. | 911 |
| `spark` | `section.spark` | JS appends `#sparkPlanNote` here when solar = Planeras. | 1296 |
| `sparkH` | `h2` | Static label (referenced only as `aria-labelledby`). | — |
| `sparkList` | `div.spark-list` | **Filled by JS**: the Sparstaplarna rows (one `.sp-item` per option/action). Full rebuild each recompute. | 1197 |
| `sparkPlanNote` | `p.spark-foot` | **Created by JS** if absent; the Planeras acknowledgement. Do not pre-add it. | 1298 |
| `resultLive` | `div.sr-only` | The **one** result announcer; debounced text of the current cost + recommendation. | 1350, 1426 |
| `ctaBtn` | `button.cta--primary` | Opens/closes the lead form; label swaps (`Få kostnadsfri rådgivning` / `Stäng` / `Skickat, vi hör av oss`). | 1579 |
| `shareBtn` | `button.share-btn` | Opens native share sheet (if `navigator.share`) else the popover. | 1600 |
| `sharePop` | `div.share-pop` | The popover menu; `hidden` toggled; positioned (flips `--below` when tight). | 1602 |
| `shareCopy` | `button` | Copies the share URL; row label swaps to "Länk kopierad" for 2 s. | 1678 |
| `shareMail` | `a` | `href` set to a `mailto:` with the encoded share URL. | 1631 |
| `shareFb` | `a` | `href` set to the Facebook sharer URL. | 1633 |
| `shareLive` | `p.sr-only` | Announces "Länk kopierad". | 1690 |
| `methodBody` | `div` | **Filled by JS**: the "Så har vi räknat" bullet list + legal paragraph, rebuilt each recompute. | 837 |

### 2.3 Lead form — see §4 for the field detail

| id | Element | app.js does | Ref |
|---|---|---|---|
| `leadInline` | `div.lead-inline` | The collapsible form container; `open` class + `hidden` toggled. | 1885 |
| `leadForm` | `form` | `submit` → `submitLead`; `hidden` after a sent lead. | 1581 |
| `leadName` / `leadPhone` / `leadZip` / `leadEmail` | `input` | Read + validated (blur + submit); values go into the lead payload. | 1583+ |
| `leadCompany` | `input[name=hp_extra]` | **Honeypot** — if non-empty, `submitLead` silently drops the submission. | 1937 |
| `errName` / `errPhone` / `errZip` / `errEmail` | `p.field-err` | Per-field error text + `hidden` toggled by `setErr`. | 1856 |
| `leadErr` | `p.lead-err` | Form-level failure message (role=alert). | 1943 |
| `leadSuccess` | `div.lead-success` | Shown after a successful submit; focus moved here. | 1888 |
| `leadClose` | `button.leadclose` | Closes the form. | 1580 |

### 2.4 Global / mobile

| id | Element | app.js does | Ref |
|---|---|---|---|
| `jumpPill` | `button.jump-pill` | Mobile "Se resultatet" pill; IO-driven show/hide; smooth-scrolls to `#result`. | 1714 |
| `ampyTool` | `div.tool` | Outer wrapper (styling/scoping anchor). On the port this is the wrapper you scope everything under. | — |

---

## 3. Built-by-JS vs. static markup

**Empty shells `app.js` fills** (ship them empty — never hand-author their children; JS calls `innerHTML = ''`
first and would wipe anything you add):

| Shell | Filled by | What appears |
|---|---|---|
| `#hpGrid` | `buildHeatCards()` | The heat-system cards + Vet inte. |
| `#eraSeg` | `buildSeg()` | 5 byggår buttons + sliding pill. |
| `#priceAreaSeg` | `buildSeg()` | Elområde buttons + pill. |
| `#ownSeg` | `buildSeg()` | Vet inte / Ja, ungefär. |
| `#solarSeg` | `buildSeg()` | Nej / Finns / Planeras. |
| `#sparkList` | `renderSpark()` | The saving bars (rebuilt every recompute). |
| `#methodBody` | `methodHtml()` | Methodology bullets + legal. |
| `#hpShares` rows | `renderShareRows()` | Per-system share segments (inserted before `#hpSummary`). |

**Static markup** (author it in HTML; JS reads or animates but does not generate it): the two `.gear` headers,
all `.lbl` rows, both slider `.gear` collapsibles (`#gearOwn` / `#gearSol` inner markup), the `.storybar`
segments + `.sb-legend`, the whole `.ctablock` + `.share-pop`, the whole `.lead-inline` form, the `.method`
`<details>`, and the entire `aside.trust` block.

**One trap:** `#eyebrow` ("Så förbrukar ditt hus energi idag") reads like a dynamic label but `app.js` **never
writes it** (verified — zero references). It is static copy. Keep the string; don't wire it to anything.

---

## 4. The lead form (index.html lines 187–231)

Inside `#leadInline > .gear-inner > .lead-inline-body`:

- `button.leadclose#leadClose` — the ✕ close.
- `h3.lead-title` — `En elektriker räknar på ditt hus`.
- `p.lead-sub` — `Vi hör av oss inom en arbetsdag och ger dig en kostnadsfri rådgivning.`
- `form#leadForm` (novalidate — validation is JS, not native):

| Field | id | name | type / attrs | Required | Error id |
|---|---|---|---|---|---|
| Ditt namn | `leadName` | `name` | text, autocomplete=name | ✔ | `errName` |
| Telefonnummer | `leadPhone` | `phone` | tel, autocomplete=tel | ✔ | `errPhone` |
| Postnummer | `leadZip` | `zip` | text, inputmode=numeric, maxlength=6, autocomplete=postal-code | ✔ | `errZip` |
| E-postadress | `leadEmail` | `email` | email, autocomplete=email | ✔ | `errEmail` |

All four are `required` and validated in JS (forgiving phone/zip, mandatory email — doc 05 §5).

**Honeypot** (lines 211–216) — `div.hp[aria-hidden]` holding `input#leadCompany`:
```
name="hp_extra"   tabindex="-1"   autocomplete="off"
```
The name is deliberately **`hp_extra`, NOT `company`** (or any autofill token like `organization`/`website`):
browser autofill fills off-screen fields by token and would populate a real value into a honeypot named
`company`, silently dropping genuine leads. **Keep the name `hp_extra`.** `submitLead` drops the submission if
this field is non-empty (app.js line 1937).

**Submit + consent** (lines 221–222):
- `button[type=submit].cta.lead-submit` — label **`Boka kostnadsfri rådgivning`**.
- `p.lead-consent` — the consent line quotes that button label **verbatim**:
  `Genom att trycka på "Boka kostnadsfri rådgivning" samtycker jag till att Ampy behandlar mina
  personuppgifter enligt vår integritetspolicy.` (link → `https://ampy.se/integritetspolicy/`).
  Pressing the button **is** the consent act (timestamped `consentTs` in the payload). If you ever A/B the
  button label, the consent line MUST be updated to quote the new label word-for-word — the HTML comment at
  lines 218–220 documents the sanctioned alternative (`Ja, räkna på mitt hus`).
- `p.lead-err#leadErr` (role=alert, hidden) — shown only on an unexpected send failure.

**Success panel** — `div.lead-success#leadSuccess` (role=status, tabindex=-1, hidden): a check icon + `Tack. En
elektriker hör av sig …`. Shown after submit; focus moves here.

---

## 5. ARIA / a11y contract

Keep these — they are wired, not decorative:

- **`h1.sr-only`** "Energikalkylatorn" — the page's only `<h1>` (the visible headline lives in the site hero
  above the tool). Preserve one `<h1>` on the port.
- **Radiogroups:** every `.seg` (`#eraSeg`, `#priceAreaSeg`, `#ownSeg`, `#solarSeg`) and each per-system share
  seg carries `role="radiogroup"`; JS builds children as `role="radio"` with `aria-checked` + roving
  `tabindex` (arrow/Home/End nav via `wireRovingKeys`). The heat cards use `aria-pressed` (toggle buttons).
- **Live regions (three, each with a distinct job):**
  - `#resultLive` (`aria-live=polite aria-atomic`) — **the one** result announcer (debounced 800 ms): current
    cost + the recommended path. This is the single source; do not add competing live regions in the result.
  - `#shareLive` (role=status) — "Länk kopierad".
  - `#hpHint` (role=status aria-live) and `#hpSummary` (role=status aria-live) — heat-picker hints/summary.
- **`aria-describedby`:** heat grid → `#hpHint`; each lead field → its `err*` node.
- **`aria-controls` / `aria-expanded`:** `#shareBtn` → `#sharePop`; `#ctaBtn` and the spark rows manage
  `aria-expanded`. Spark row buttons carry a full spoken `aria-label` (the numbers, read as a sentence).
- **Focus management:** `submitLead` moves focus to `#leadSuccess`; `renderSpark` restores focus to the same
  row after a recompute rebuild; `#jumpPill` toggles `tabindex`/`aria-hidden` with visibility.
- **`noscript`** (line 41): the JS-off message. **Keep it** — the tool cannot compute without JS, and a blank
  skeleton would be a dead end.

---

## 6. Assets (all local — no CDN, ever)

| Asset | Path (from `vB/`) | Used where | Notes |
|---|---|---|---|
| `trust-elinstallation.webp` | `vB/` | `aside.trust` bg (line 249) | The **wired** trust photo (gable house at dusk), `1000×827`, `loading=lazy decoding=async`, `alt=""` (decorative). |
| `trust-modernt.webp` | `vB/` | — (alternative) | Owner-provided **swap alternative** — a one-line `src` change. Not referenced by default. |
| `trust-framtidssakrat.webp` | `vB/` | — (alternative) | Second swap alternative. Not referenced by default. |
| `og.png` | `vB/og.png` | OG + Twitter tags (`?v=2`) | `1200×630` social unfurl card (rendered from `og.html`). Versioned separately from `?v=36`. |
| `Outfit-Light.woff2` | `../fonts/` | preload + CSS `@font-face` | weight **300**. |
| `Outfit-Medium.woff2` | `../fonts/` | preload + CSS | weight **500**. |
| `Outfit-Black.woff2` | `../fonts/` | preload + CSS | weight **900**. |
| Favicon | inline `data:` SVG (line 25) | `<link rel=icon>` | No file. |
| All UI icons | **inline SVG** | heat cards, seg glyphs, share/close/method, stars | Built in `app.js` (`icsvg`/`ICONS`, doc 05 §4) or hand-written in HTML. **No icon font, no sprite, no external request.** |

**Port note:** the two path families that change when this moves into WordPress are the **font `../fonts/`
paths** (→ your enqueued/self-hosted font URLs) and the **`trust-*.webp` / `og.png`** paths (→ your media
library or theme asset dir). The favicon and every UI icon are inline and travel unchanged. See doc 06.
