# Energikalkylatorn — Architecture Overview

> **Audience:** Chris (WordPress / Bricks developer) implementing this as FluentSnippets, plus any
> engineer maintaining the tool. This is document 1 of 6. Start here, then read the doc your task needs.
> **Live reference build:** https://julius447.github.io/Energycalc/vB/ (cache `?v=36`)
> **Repo:** `github.com/julius447/Energycalc` — the canonical build is in `vB/`.

---

## What this is

A Swedish heating-cost calculator (lead magnet). A homeowner taps their current heating system, house
size, build year, occupants, and price area; the tool instantly shows their yearly energy cost and an
honest range of what each upgrade (air-air / air-water / ground-source heat pump, etc.) would save per
year — then invites them to book a free advisory. It is built to be the #1 destination for paid
Facebook/Meta traffic (~100+ visits/day, ~90% mobile, cold 40–65-year-old villaägare).

It is a **static, dependency-free, vanilla-JS** application. No framework, no build step, no npm, no
runtime network calls. It runs as flat files on GitHub Pages today and is designed to be reproduced
1-to-1 inside WordPress (Bricks theme, FluentSnippets plugin) — see **doc 06**.

---

## The 5-layer chassis

Load order is strict and load-bearing (see `vB/index.html` lines 282–285):

```
data.js   →  engine.js  →  rank.js  →  app.js         + index.html (skeleton) + tool.css (tokens+styles)
(numbers)    (pure math)   (ranking,   (renderer +
                            recommend,   interaction +
                            share codec) formatting)
```

| Layer | File | Lines | Role | Editable? |
|---|---|--:|---|---|
| Data | `data.js` | 427 | Every coefficient, each `[FACT]`/`[DERIVED]`/`[MODEL]`/`[GAP]`-tagged. **No number lives anywhere else.** | **Numbers signed separately** — edit only here |
| Engine | `engine.js` | 648 | Pure `calculate(inputs, D)`. Zero hardcoded numbers; reads only from `data.js`. | **Frozen** (audited) |
| Rank | `rank.js` | 525 | `rankOptions` (truth table of every measure), `recommend` (owner rules P1–P5), `AmpyCodec` (share-URL encode/decode). | **Frozen** (audited) |
| Renderer | `app.js` | 2048 | Reads DOM → builds `inputs` → calls engine/rank → writes result. **All rounding + Swedish formatting happens here.** Interaction, lead form, share, jump-pill. | Yes — UI/copy/wiring |
| Skeleton | `index.html` | 287 | DOM shell. Many elements are empty containers `app.js` fills. | Yes — structure |
| Styles | `tool.css` | 728 | Ampy design tokens + all component CSS. | Yes — styling |

**The frozen boundary matters for the port:** `data.js`, `engine.js`, `rank.js` are audited and their
numbers await owner/electrician sign-off. To change a number, edit **`data.js` alone**. Chris does not
touch these three — he wires them in unchanged. Details in **doc 04**.

**The public API** the renderer consumes (all on `window`):
- `window.AMPY_DATA` — the data object.
- `window.AmpyEngine.calculate(inputs, D)` and `.rankOptions(inputs, D)`.
- `window.AmpyRank.{rankOptions, recommend, costSplit, netInvestRange}`.
- `window.AmpyCodec.{encode, decode}` — the share-link house-state codec.

---

## Candour, encoded in the code (not decoration)

These are contractual and must survive the port unchanged:

- The hero saving is computed at **stödtjänster = 0 AND effektavgift = 0** — no such line is ever added
  to the pump cost. Solar/battery/grid-service upside is shown as separate, labelled rows, never folded
  into the hero number.
- Heat pumps deduct **ROT 30 % on labour, never grön teknik**.
- **Field SPF, never the energy-label SCOP.** Payback is always a **range**, never a single point.
- When the current system is already efficient, the tool says so honestly and softens the CTA instead of
  inventing a saving.
- No "1000+ kunder" / "5.0" / "hela Sverige". Today's footprint is the Stockholm region; national rollout
  is future. The only external-credibility facts on the page are owner-sanctioned (a verbatim Google
  review + 5/5 + "3 000+ genomförda installationer om året").

---

## Document map

| # | Document | For |
|---|---|---|
| 01 | **OVERVIEW** (this file) | Architecture, file map, candour rules, versioning |
| 02 | `02-HTML-DOM-contract.md` | DOM structure + the element-ID contract JS depends on |
| 03 | `03-CSS-reference.md` | Tokens, component vocabulary, responsive, motion |
| 04 | `04-JS-calculation-core.md` | data.js + engine.js + rank.js (the frozen core + public API) |
| 05 | `05-JS-app-renderer.md` | app.js — render cycle, state, lead pipe, share, instrumentation |
| 06 | `06-FLUENTSNIPPETS-implementation.md` | **The Chris deliverable** — WordPress/Bricks/FluentSnippets port |

---

## Versioning & cache-busting (operational discipline)

Every release bumps the `?v=N` query on all five CSS/JS references in `index.html` (currently `v=36`).
This is not cosmetic: GitHub Pages caches assets ~10 minutes, so a bump is the only way to guarantee a
visitor fetches the new CSS against the new HTML rather than a stale mix. **Bump `?v=` AFTER all edits,
never before** (bumping first re-caches the stale file). `og.png?v=` is versioned separately. When this
moves into WordPress, the equivalent discipline is a version query on the enqueued snippet assets.

---

## Current status (2026-07-16, v36)

The **tool** is production-grade: verified across 320–1440px, pure ES5 (no modern-syntax cliffs down to
old Safari), all risky APIs guarded, a 3-reviewer 365/24 reliability sweep passed (the one live-reproduced
P0 — a malformed `%` in any query param killing boot — is fixed and fuzz-proven).

The **lead engine** is not yet wired for paid traffic. Two owner-parked gates remain before spend:
1. **Lead delivery** — `submitLead()` is a `console.log` stub; every lead is dropped today. The payload is
   already CRM-complete, so wiring it is one `fetch` line (doc 05 §5, doc 06 §8).
2. **Measurement** — no Meta Pixel / GTM / consent flag is set; the `dataLayer` events fire into nothing
   until a container reads them (doc 05 §6, doc 06 §12).

Plus open `[GAP]` number sign-offs in `data.js` (doc 04) and the destination move from `github.io` to
`ampy.se` (where the Pixel and domain verification belong).
