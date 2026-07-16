# Energikalkylatorn — Developer Handover

> **For:** Chris (WordPress / Bricks). This is the entry point. It tells you what you're getting, what to
> read, and exactly what stands between this tool and going live on paid traffic.
> **Live reference build:** https://julius447.github.io/Energycalc/vB/ (cache `?v=36`)
> **Canonical source:** the `vB/` directory in this repo. Ignore the older root-level `app.js`/`data.js`/etc.
> — those are a superseded draft; **`vB/` is the tool.**

---

## What this is, in one paragraph

A static, dependency-free, vanilla-JS heating-cost calculator (a lead magnet for Ampy). No framework, no
build step, no npm, no runtime network calls — six flat files that run anywhere. It is production-grade and
verified 320–1440px across a 3-reviewer reliability sweep. Your job is to reproduce it **1-to-1 inside
WordPress** (Bricks theme, FluentSnippets plugin) without losing a pixel, and to wire the two things that
are deliberately not yet connected: **lead delivery** and **measurement**.

---

## Read in this order

| # | Doc | Read it when |
|---|---|---|
| 01 | [`docs/01-OVERVIEW.md`](docs/01-OVERVIEW.md) | First. Architecture, the 5-layer chassis, the candour rules baked into the code, versioning. |
| 02 | [`docs/02-HTML-DOM-contract.md`](docs/02-HTML-DOM-contract.md) | The DOM skeleton and **the element-ID contract** — the IDs the JS depends on and you must not rename. |
| 03 | [`docs/03-CSS-reference.md`](docs/03-CSS-reference.md) | The design tokens, every component's classes, the responsive/motion system. |
| 04 | [`docs/04-JS-calculation-core.md`](docs/04-JS-calculation-core.md) | `data.js` + `engine.js` + `rank.js` — the frozen math core, the public API, every `[GAP]` number. |
| 05 | [`docs/05-JS-app-renderer.md`](docs/05-JS-app-renderer.md) | `app.js` — the render cycle, state, the lead pipe, share codec, instrumentation. |
| 06 | [`docs/06-FLUENTSNIPPETS-implementation.md`](docs/06-FLUENTSNIPPETS-implementation.md) | **Your build guide.** The full WordPress/Bricks/FluentSnippets port, step by step, with real PHP/JS/CSS. |

The binding format standard behind doc 06 is the Ampy delivery contract
(`.claude/skills/ampy-webb-playbook/fluentsnippets-delivery.md` in the Ampy workspace) — doc 06 already
applies it to this tool, so you don't need to read the contract separately unless you want the rationale.

---

## Three constraints you cannot break

1. **The math core is frozen.** `data.js`, `engine.js`, `rank.js` are audited; their numbers await
   owner/electrician sign-off. To change any number you edit **`data.js` alone** — engine and rank hold
   zero hardcoded values. You wire these three in unchanged. (Doc 04.)
2. **The element-ID contract.** `app.js` finds everything by `id`. Rename a class freely (you must, for
   WordPress — doc 06 §3), but **never rename an ID** (`#result`, `#leadForm`, `#areaSlider`, …). (Doc 02.)
3. **Cache-bust every release.** Bump the version query on the assets *after* all edits, never before
   (bumping first re-caches the stale file). GitHub Pages / WP both cache; a stale CSS against new HTML is
   the classic "it looks broken for 10 minutes" bug. (Doc 01.)

---

## The port in six moves (doc 06 is the detail)

The tool is the delivery contract's **"Hard"** retrofit — mostly mechanical, but it must be scripted, not
hand-typed, and proven pixel-identical before it ships:

1. **Namespace everything** under `.ampy-ek` / `.ampy-ek-outer` (avoids collision with the EV calculator's
   `.ampy-calc`). Scripted class-rename across `tool.css` + markup — full map in doc 06 §3.
2. **Scope the global rules** (`html{62.5%}`, `body{}`, `:root{}`, `*{}`) under the wrapper so the tool
   can't restyle the WP page and the theme can't restyle the tool — doc 06 §4.
3. **rem → px** at 1rem = 10px (deterministic, changes no pixel) — doc 06 §5.
4. **8 viewport breakpoints → `@container`** (the other 15 `@media` are feature queries and stay) — doc 06 §6.
5. **Write `backend.php`** — the `[ampy_ek]` shortcode + inline data + nonce-gated REST lead route. Full
   skeleton in doc 06 §7. (This file does not exist yet; it's new code.)
6. **Wire the lead pipe** — replace the `console.log` stub with one `fetch()` to the REST route — doc 06 §8.

Verify with `preview/index.html` rendered at desktop 1280 + mobile 390 against the live reference, then
byte-diff the snippet payloads. The Chris-ready checklist is doc 06 §13.

---

## Go-live gates (nothing below is done yet — these block paid spend)

| Gate | State today | Where |
|---|---|---|
| **Lead delivery** | `submitLead()` is a `console.log` stub at `app.js:1958` — **every lead is dropped.** Payload is already CRM-complete; wiring is one `fetch` line. | Doc 05 §5, doc 06 §8 |
| **Measurement** | No Meta Pixel / GTM / consent flag. `dataLayer` events fire into nothing until a container reads them. Owner-parked to the site push. | Doc 05 §6, doc 06 §12 |
| **`[GAP]` number sign-offs** | Several `data.js` coefficients are conservative placeholders awaiting owner/electrician signature. Swapping is a one-file edit. | Doc 04 §3 |
| **Destination** | Live on `github.io`; must move to `ampy.se` (where the Pixel and domain verification belong). | Doc 01 |
| **OG share image** | Done — `og.png` 1200×630 present and referenced. | — |

---

## Scope note (honest)

These six documents are the **complete technical reference + the conversion playbook** — everything needed
to implement the tool as FluentSnippets. They are documentation, not the pre-packaged `dist/` bundle. Per
the delivery contract the ideal end-state is a *born-ready* three-file bundle (`dist/styles.css` +
`dist/backend.php` + `dist/engine.js` + `preview/index.html`) that you paste verbatim — producing that
bundle is the recommended next build step (the "Hard" retrofit doc 06 describes) and can be done for you on
request. Either way, doc 06 gives you the exact target.
