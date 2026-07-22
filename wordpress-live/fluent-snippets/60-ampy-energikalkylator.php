<?php
// <Internal Doc Start>
/*
*
* @description:
* @tags:
* @group:
* @name: Ampy - Energikalkylator - CSS
* @type: css
* @status: published
* @created_by: 13
* @created_at: 2026-07-22 12:00:00
* @updated_at: 2026-07-22 12:00:00
* @is_valid: 1
* @updated_by: 13
* @priority: 10
* @run_at: wp_head
* @load_as_file: yes
* @load_in_block_editor:
* @condition: {"status":"no","run_if":"assertive","items":[[]]}
*/
?>
<?php if (!defined("ABSPATH")) { return;} // <Internal Doc End> ?>
/* ==== Energikalkylatorn — scoped, self-hosted, px, @container. FORMAT clone. ==== */
.ampy-ek-outer{container-type:inline-size;container-name:ampyek}
/* optional hardening (§4 end): wipe theme bleed, keep own cascade at specificity 0 */
.ampy-ek{all:initial}
.ampy-ek :where(*:not(svg,svg *),use){all:revert}

/* =============================================================================
 * tool.css — Ampy energikalkylatorn — vB · v7 (V7-SPEC.md)
 * Two-pane single-canvas calculator. LEFT white input card (7 flat controls) /
 * RIGHT midnight result card: energy-TOTAL anchor → story bar → SPARSTAPLARNA
 * (#spark: savings bars + tap-to-expand rec) → CTA block → method
 * (bullets + legal, NO curve). No sticky bar — mobile flows inputs-first.
 * Single font (Outfit) canonical; hierarchy by weight (300/500/900).
 * All spacing on --sp-* (4px grid, rem on 10px base); all type on --ty-*.
 * Motion is opacity / transform / grid-fraction, <=300ms, reduced-motion safe.
 * Breakpoints (V10 DB1): <=991 stacked / >=992 two-pane / 480 mobile tune.
 * No em-dashes in copy. Fonts at ../fonts/.
 * v7 components reuse the EXISTING token set — zero new colors, zero new type sizes.
 * ========================================================================== */

/* ---- self-host Outfit (woff2 in ../fonts/; system-ui fallback holds until present) ---- */
@font-face{font-family:'Outfit';src:url('/wp-content/uploads/fonts/Outfit-VariableFont_wght.woff2') format('woff2-variations'),url('/wp-content/uploads/fonts/Outfit-VariableFont_wght.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap;}

.ampy-ek{scroll-behavior:smooth}   /* 10px = 10px — matches production ap* framework */
.ampy-ek{display:block;margin:0;font-size:16px;font-family:'Outfit',system-ui,-apple-system,sans-serif;
  background:var(--pagebg);color:var(--ink);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}

.ampy-ek{
  /* ---- brand ---- */
  --teal:#00a991; --teal-bright:#19c39e; --teal-on-dark:#00c4a7;   /* teal stroke on midnight (WCAG) */
  --midnight:#090b32; --mist:#f5f9ff; --ink:#1e1e1e; --muted:#51607a;
  --line:#e1e8f4; --line2:#d7deeb; --mint:#9fe1cb; --neon:#55ff9a; --slate:#7c86b0;
  --inset:#0c1040; --chip:#11163f; --eyebrow:#5dcaa5; --subtext:#aeb8d4;
  --footnote:#8a93b5; --pagebg:#e9eff8; --amber:#f0b429;
  --bar-house:rgba(124,134,176,.38);            /* the ONE new token: story-bar grey segment */
  /* stacked-fan source colours (scoped to the plot only) */
  --fan-primary:#8b95bd; --fan-kamin:rgba(240,180,41,.16); --fan-air:#6f7bb0;

  /* ---- SPACING (4px grid, rem on 10px base) ---- */
  --sp-0:0; --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px;
  --sp-5:20px; --sp-6:24px; --sp-7:32px; --sp-8:40px; --sp-9:56px;
  --sp-1h:6px;          /* capped half-step: segmented gap only */
  --sp-2h:10px;          /* card-grid half-step (between --sp-2 and --sp-3) */
  --cta-y:16px;          /* capped half-step: CTA vertical pad only */

  /* ---- SHELL ---- */
  --shell-max:1360px;      /* 1360px wide premium shell */
  --shell-gutter:var(--sp-6);

  /* ---- TYPE (Outfit, weight hierarchy 300/500/900 canonical) ---- */
  --ty-display:clamp(32px, 24px + 3vw, 52px);  /* the anchor number */
  --ty-h:20px;           /* lead-title, section heads */
  --ty-lead:clamp(18px, 15px + 0.8vw, 22px);
  --ty-sub:15.5px;        /* lead-sub */
  --ty-body:16px;        /* fields, toggles, body */
  --ty-label:13.5px;      /* lbl, gearcopy, hints, caption */
  --ty-eyebrow:12px;     /* eyebrows, gearhead, tag */
  --ty-micro:10.5px;      /* foot, placeholder-note, chart tip */

  --w-body:300; --w-mid:500; --w-black:900;
  --lh-display:1.0; --lh-tight:1.15; --lh-snug:1.35; --lh-body:1.55;
  --tr-display:-0.02em; --tr-eyebrow:0.14em;

  /* ---- RADIUS ---- */
  --r-xs:6px; --r-sm:9px; --r-md:12px; --r-lg:16px; --r-xl:20px; --r-pill:9990px;

  /* ---- BORDERS / HAIRLINES ---- */
  --bd-light:1px solid #dbe4f2;
  --bd-light-2:1px solid var(--line2);
  --bd-dark:1px solid rgba(255,255,255,.12);
  --bd-teal-dark:1px solid rgba(85,255,154,.30);

  /* ---- ELEVATION (navy-tinted) ---- */
  --shadow-1:0 1px 2px rgba(9,11,50,.06),0 1px 1px rgba(9,11,50,.04);
  --shadow-2:0 6px 16px -4px rgba(9,11,50,.12),0 2px 6px rgba(9,11,50,.07);
  --shadow-3:0 24px 50px -10px rgba(9,11,50,.20),0 8px 16px -6px rgba(9,11,50,.10);
  --shadow-teal:0 12px 30px -8px rgba(0,169,145,.42);
  --ring-light:0 0 0 3px rgba(0,169,145,.28);
  --ring-dark:0 0 0 3px rgba(85,255,154,.30);

  /* ---- MOTION (durations <=300ms) ---- */
  --ease:cubic-bezier(0.2,0.6,0.2,1);
  --ease-out:cubic-bezier(0.16,1,0.3,1);
  --t-fast:140ms; --t-mid:220ms; --t-slow:300ms;
  --t-stagger:45ms;

  /* ---- AURORA surface for the midnight card ---- */
  --aurora:
    radial-gradient(120% 90% at 78% -8%, rgba(0,196,167,.22), transparent 56%),
    radial-gradient(90% 70% at 8% 4%, rgba(85,255,154,.10), transparent 60%),
    radial-gradient(100% 120% at 60% 110%, rgba(9,11,50,.40), transparent 60%);
}

@media (prefers-reduced-motion:reduce){
  .ampy-ek{ --t-fast:0ms; --t-mid:0ms; --t-slow:0ms; --t-stagger:0ms; }
}

/* iOS <=13.3: clamp() unsupported — var() substitution goes invalid-at-computed-value
 * (a cascade fallback line does NOT save it), so re-declare static sizes there */
@supports not (font-size: clamp(10px, 2vw, 30px)){
  .ampy-ek{ --ty-display:40px; --ty-lead:19px; }
  .ampy-ek__cta{ font-size:17px; }
}

/* print: backgrounds are OFF by default in every browser — without this the midnight
 * result card prints white-on-white. exact-adjust keeps the card; the pill never prints. */
@media print{
  .ampy-ek__jump-pill,#sharePop{display:none !important}
  .ampy-ek__result,.ampy-ek__trust{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .ampy-ek__input{position:static}
}

.ampy-ek,.ampy-ek *,.ampy-ek *::before,.ampy-ek *::after{box-sizing:border-box}
.ampy-ek button{font-family:inherit}

/* ---- touch polish: no grey/blue tap flash, no accidental text selection on controls ----
 * The blue "bubble" the owner saw = iOS tap-highlight + drag-selection. Buttons, sliders
 * and their label rows are interaction surfaces, not text — selection off, highlight off.
 * The lead form fields and all body copy stay fully selectable. */
.ampy-ek{-webkit-tap-highlight-color:transparent}
.ampy-ek button,.ampy-ek__range,.ampy-ek__seg,.ampy-ek__stepper,.ampy-ek__hp-card,.ampy-ek__sp-row,.ampy-ek__method summary{
  -webkit-user-select:none;-moz-user-select:none;user-select:none}
.ampy-ek__input .ampy-ek__lbl,.ampy-ek__sb-legend{-webkit-user-select:none;user-select:none}

/* JS off / script-fetch failed: say so instead of a silent dead skeleton */
.ampy-ek__noscript-note{background:#fff;border:var(--bd-light);border-radius:var(--r-md);
  padding:var(--sp-4) var(--sp-5);margin:0 0 var(--sp-6);color:var(--ink);font-size:var(--ty-sub)}

/* screen-reader-only (result live region) */
.ampy-ek__sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* ---- tabular numerals: SINGLE owner ---- */
.ampy-ek__result,.ampy-ek__input{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1,"lnum" 1}
.ampy-ek__lead-sub,.ampy-ek__gearcopy,.ampy-ek__method-body p{font-variant-numeric:normal}

/* ============================ LAYOUT — the wide, de-boxed shell ============================ */
.ampy-ek-outer{max-width:var(--shell-max);margin:0 auto;
  padding:var(--sp-8) max(var(--shell-gutter),env(safe-area-inset-right)) var(--sp-9) max(var(--shell-gutter),env(safe-area-inset-left))}   /* P2: keep the card clear of the notch in landscape */
.ampy-ek{background:none;border:0;border-radius:0;padding:0}

/* (the .toolhead/.tag block is DELETED — the headline lives in the site-built hero;
 * the standalone page keeps an sr-only h1) */

.ampy-ek__panes{display:flex;gap:var(--sp-7);align-items:flex-start}
@container ampyek (min-width:1200px){ .ampy-ek__panes{gap:var(--sp-8)} }
.ampy-ek__input{flex:0 0 420px;max-width:420px;background:#fff;border:var(--bd-light);border-radius:var(--r-xl);
  padding:var(--sp-7);margin:0;position:sticky;top:var(--sp-6);align-self:flex-start;box-shadow:var(--shadow-2)}
/* DM1b: the .static kill-switch is retired — a too-tall card gets a sticky-BOTTOM
 * fallback via an inline negative top set by checkStickyIntegrity() */
/* the right column: result card + trust block stacked (the trust fills the gap the
 * taller left column leaves on desktop); it takes over the old .ampy-ek__result flex sizing
 * so the two-pane widths are byte-identical */
.ampy-ek__rightcol{flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--sp-6)}
.ampy-ek__result{background:var(--midnight);border-radius:var(--r-xl);padding:var(--sp-7);
  color:#fff;position:relative;overflow:hidden;box-shadow:var(--shadow-3);scroll-margin-top:var(--sp-4)}
@container ampyek (min-width:1200px){ .ampy-ek__result{padding:var(--sp-8)} }
.ampy-ek__result::before{content:'';position:absolute;top:0;right:0;bottom:0;left:0;inset:0;background:var(--aurora);pointer-events:none}
.ampy-ek__result::after{content:'';position:absolute;top:0;right:0;bottom:0;left:0;inset:0;border-radius:inherit;pointer-events:none;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.ampy-ek__result>*{position:relative;z-index:1}

/* ============================ INPUT: gears + labels ============================
 * The left-card rhythm (one scale, no drift):
 *   label → its control        --sp-2  (8px)
 *   gearhead → its content     --sp-4  (16px)
 *   control → next group       --sp-6  (24px)
 *   hairline section (n2)      --sp-6 above AND below the line               */
.ampy-ek__gear{padding-top:2px}
.ampy-ek__gear > * + *{margin-top:var(--sp-5)}
.ampy-ek__gear .ampy-ek__range{margin-top:var(--sp-2)}
.ampy-ek__gear .ampy-ek__seg{margin-top:var(--sp-2)}
/* every new question group opens with --sp-6 of air */
.ampy-ek__gear > .ampy-ek__lbl,.ampy-ek__gear > #ownRow{margin-top:var(--sp-6)}
/* the collapsed sub-gears couple to their seg like a control (phantom-gap safe) */
.ampy-ek__gear > .ampy-ek__gear-collapsed{margin-top:var(--sp-2)}
/* the group head owns its gap (its --sp-4 margin-bottom, nothing stacked on top) */
.ampy-ek__gear > .ampy-ek__gearhead + *,.ampy-ek__gear > .ampy-ek__gearhead + .ampy-ek__lbl,.ampy-ek__gear > .ampy-ek__gearhead + #ownRow{margin-top:0}
/* the two v7 gear groups (Ditt hus / Din el) separate with a quiet hairline */
.ampy-ek__gear[data-gear="n2"]{margin-top:var(--sp-6);border-top:1px solid #eef2f9;padding-top:var(--sp-6)}
#ownRow > * + *{margin-top:var(--sp-2)}
.ampy-ek__gear-inner > .ampy-ek__gearcopy{margin-top:var(--sp-2)}
.ampy-ek__gearhead{display:flex;align-items:center;gap:var(--sp-2);font-size:var(--ty-eyebrow);letter-spacing:var(--tr-eyebrow);
  text-transform:uppercase;color:var(--muted);font-weight:500;margin-bottom:var(--sp-4)}
.ampy-ek__gearcopy{font-size:var(--ty-label);font-weight:300;line-height:var(--lh-body);color:var(--muted);margin:0}
/* the field label follows the SAME methodology as the heat legend (.ampy-ek__hp-legend):
   the question is bold ink (ty-body/500), its helper is soft slate (ty-label/300) */
.ampy-ek__lbl{font-size:var(--ty-body);font-weight:500;line-height:var(--lh-snug);color:var(--ink);margin-bottom:var(--sp-2);
  display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.ampy-ek__lbl > svg,.ampy-ek__lbl span > svg{width:15px;height:15px;color:var(--slate);flex:0 0 auto}
.ampy-ek__lbl-row{display:flex;align-items:center;justify-content:space-between}
.ampy-ek__lbl-row > span:first-child{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap}
.ampy-ek__lbl-val{font-size:var(--ty-body);color:var(--ink);font-weight:500;transition:transform var(--t-fast) var(--ease-out)}
.ampy-ek__lbl-soft{font-size:var(--ty-label);color:var(--slate);font-weight:300}
/* the reusable assumption tag — real text, never colour-only */
.ampy-ek__antag{font-size:var(--ty-micro);color:var(--footnote);font-weight:300}
.ampy-ek__antag[hidden]{display:none}
.ampy-ek__gearcopy[hidden]{display:none}

/* native range — 44px touch body, visible track drawn inside it.
 * touch-action:pan-y — horizontal drags go straight to the slider (no iOS
 * gesture arbitration lag); vertical swipes still scroll the page. */
.ampy-ek__range{-webkit-appearance:none;appearance:none;display:block;width:100%;height:44px;background:transparent;cursor:pointer;touch-action:pan-y}
.ampy-ek__range::-webkit-slider-runnable-track{height:8px;border-radius:4px;background:#e3e9f5}
.ampy-ek__range::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;margin-top:-10px;border-radius:50%;
  background:#fff;border:2px solid var(--teal);cursor:pointer;box-shadow:0 1px 3px rgba(9,11,50,.18);
  transition:transform var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease)}
.ampy-ek__range:active::-webkit-slider-thumb{transform:scale(1.12);box-shadow:0 2px 8px rgba(9,11,50,.28)}
.ampy-ek__range:focus-visible::-webkit-slider-thumb{box-shadow:var(--ring-light)}
.ampy-ek__range::-moz-range-track{height:8px;border-radius:4px;background:#e3e9f5}
.ampy-ek__range::-moz-range-thumb{width:28px;height:28px;border-radius:50%;background:#fff;border:2px solid var(--teal);cursor:pointer;
  transition:transform var(--t-fast) var(--ease)}
.ampy-ek__range:active::-moz-range-thumb{transform:scale(1.12)}
.ampy-ek__range:focus-visible{outline:2px solid var(--teal);outline-offset:3px}
@media (hover:hover) and (pointer:fine){   /* d-p2: quiet affordance, gated to real pointers */
  .ampy-ek__range:hover::-webkit-slider-thumb{transform:scale(1.06)}
  .ampy-ek__range:hover::-moz-range-thumb{transform:scale(1.06)}
}

/* ============================ HEAT PICKER — icon multi-select card set ============================ */
.ampy-ek__heatpicker{border:0;margin:0;padding:0;min-width:0}
.ampy-ek__hp-legend{padding:0;font-size:var(--ty-body);font-weight:500;color:var(--ink);line-height:var(--lh-snug);
  display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--sp-2)}
.ampy-ek__hp-legend-soft{font-size:var(--ty-label);font-weight:300;color:var(--slate)}
.ampy-ek__hp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--sp-2h);margin-top:var(--sp-3)}
.ampy-ek__hp-subhead{grid-column:1/-1;font-size:var(--ty-eyebrow);letter-spacing:var(--tr-eyebrow);text-transform:uppercase;
  color:var(--slate);font-weight:500;margin-top:var(--sp-2)}
.ampy-ek__hp-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:var(--sp-2);
  min-height:88px;padding:var(--sp-3);text-align:left;cursor:pointer;border:1.5px solid var(--line2);
  border-radius:var(--r-md);background:#fff;color:var(--ink);font-family:inherit;
  transition:border-color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease),
             background var(--t-fast) var(--ease),transform var(--t-fast) var(--ease)}
/* DM4: decorative hovers gated to real pointers (no sticky-hover on touch iPads) */
@media (hover:hover) and (pointer:fine){
  .ampy-ek__hp-card:hover{border-color:var(--teal);transform:translateY(-1px);box-shadow:var(--shadow-1)}
}
.ampy-ek__hp-card:active{transform:translateY(0) scale(.995)}
.ampy-ek__hp-card:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
.ampy-ek__hp-ic{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:var(--r-sm);
  background:var(--mist);color:var(--teal);
  transition:background var(--t-fast) var(--ease),color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease)}
.ampy-ek__hp-ic svg{width:22px;height:22px}
.ampy-ek__hp-lbl{font-size:var(--ty-body);font-weight:500;line-height:var(--lh-tight);color:var(--ink)}
.ampy-ek__hp-card[aria-pressed="true"]{border-color:var(--teal);background:#f2fbf8;box-shadow:var(--ring-light)}
.ampy-ek__hp-card[aria-pressed="true"] .ampy-ek__hp-ic{background:var(--teal);color:#fff}
.ampy-ek__hp-check{position:absolute;top:var(--sp-2);right:var(--sp-2);width:20px;height:20px;display:inline-flex;
  align-items:center;justify-content:center;border-radius:50%;background:var(--teal);color:#fff;
  opacity:0;transform:scale(.6);transition:opacity var(--t-fast) var(--ease-out),transform var(--t-fast) var(--ease-out)}
.ampy-ek__hp-check svg{width:12px;height:12px}
.ampy-ek__hp-card[aria-pressed="true"] .ampy-ek__hp-check{opacity:1;transform:scale(1)}
/* the quiet "Vet inte" card — a COMPACT single-line control, clearly smaller than
 * the system cards. Spans the full last row (odd count) but sizes to its content
 * (no grid-auto-rows:1fr stretch, no floaty gap). >=44px touch, dashed, centered.
 * Specificity .ampy-ek__hp-grid .ampy-ek__hp-card--quiet (0,2,0) BEATS the media-query .ampy-ek__hp-card
 * min-height (0,1,0), so no per-breakpoint override is needed. */
.ampy-ek__hp-grid .ampy-ek__hp-card--quiet{
  grid-column:1 / -1; min-height:44px; align-self:start;
  flex-direction:row; align-items:center; justify-content:center; gap:var(--sp-2);
  padding:var(--sp-2) var(--sp-3); border-style:dashed; color:var(--muted); text-align:center;
}
.ampy-ek__hp-grid .ampy-ek__hp-card--quiet .ampy-ek__hp-lbl{color:inherit;font-weight:300;font-size:var(--ty-label)}
.ampy-ek__hp-grid .ampy-ek__hp-card--quiet[aria-pressed="true"]{border-color:var(--teal);background:#f2fbf8}
.ampy-ek__hp-grid .ampy-ek__hp-card--quiet[aria-pressed="true"] .ampy-ek__hp-lbl{color:var(--ink);font-weight:500}
/* primary marker = a teal ring on the icon tile (NO word — avoids superlative) */
.ampy-ek__hp-card.is-primary .ampy-ek__hp-ic{box-shadow:0 0 0 2px var(--teal)}
.ampy-ek__hp-hint{font-size:var(--ty-label);color:var(--muted);margin:var(--sp-2) 0 0;line-height:var(--lh-body)}
.ampy-ek__hp-hint[hidden]{display:none}
/* share rows (static head + summary; rows inserted between) */
.ampy-ek__hp-shares:not([hidden]){margin-top:var(--sp-4)}
.ampy-ek__hp-shares[hidden]{display:none}
.ampy-ek__hp-shares-head{font-size:var(--ty-label);font-weight:500;color:var(--ink)}
.ampy-ek__hp-summary{font-size:var(--ty-label);font-weight:300;color:var(--muted);margin:var(--sp-3) 0 0;line-height:var(--lh-body)}
.ampy-ek__hp-summary:empty{display:none}
.ampy-ek__hp-share-row{display:grid;grid-template-rows:0fr;opacity:0;
  transition:grid-template-rows var(--t-mid) var(--ease-out),opacity var(--t-mid) var(--ease-out)}
.ampy-ek__hp-share-row.in{grid-template-rows:1fr;opacity:1}
.ampy-ek__hp-share-row>.ampy-ek__hp-share-inner{overflow:hidden;min-height:0;padding-top:var(--sp-3)}
.ampy-ek__hp-share-name{display:flex;align-items:baseline;justify-content:space-between;gap:var(--sp-2);
  font-size:var(--ty-label);color:var(--muted);margin-bottom:var(--sp-2)}
.ampy-ek__hp-share-name svg{width:15px;height:15px;color:var(--slate);margin-right:4px;vertical-align:-3px}
.ampy-ek__hp-share-name .ampy-ek__antag{font-size:var(--ty-micro);color:var(--footnote)}
.ampy-ek__capnote{font-size:var(--ty-label);color:var(--muted);margin:var(--sp-2) 0 0;line-height:var(--lh-body)}
.ampy-ek__capnote[hidden]{display:none}

/* ============================ segmented — sliding selection pill ============================ */
.ampy-ek__seg{position:relative;display:flex;gap:var(--sp-1h)}
.ampy-ek__seg-wrap{flex-wrap:wrap}
/* MM5: pill surface = a11y-DERIVED shade of brand teal (white text 4.6:1); NOT a new
 * token — borders/CTA keep #00a991. Owned by the designsystem-konsolidering program. */
.ampy-ek__seg-pill{position:absolute;top:0;left:0;z-index:0;border-radius:var(--r-xs);background:#00806e;
  transform:translate(0,0);
  transition:transform var(--t-fast) var(--ease),width var(--t-fast) var(--ease),height var(--t-fast) var(--ease)}
.ampy-ek__seg button{position:relative;z-index:1;flex:1 1 auto;min-width:0;text-align:center;font-size:var(--ty-label);
  padding:8px 6px;border:var(--bd-light-2);border-radius:var(--r-xs);color:var(--muted);background:transparent;cursor:pointer;
  white-space:nowrap;min-height:44px;
  transition:color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
@media (hover:hover) and (pointer:fine){ .ampy-ek__seg button:not(.on):hover{border-color:var(--teal)} }   /* DM4 */
.ampy-ek__seg button.on{background:transparent;color:#fff;border-color:var(--teal)}
.ampy-ek__seg button:focus-visible{outline:2px solid var(--teal);outline-offset:1px}
.ampy-ek__seg-wrap button{flex:1 1 30%}

/* (the .reveal accordion block was dead code — deleted, m-p4) */
.ampy-ek__gear[data-gear="own"],.ampy-ek__gear[data-gear="sol"]{padding-top:2px}
#ownRow[hidden]{display:none}

/* stepper */
.ampy-ek__stepper{display:inline-flex;align-items:center;gap:2px;border:var(--bd-light-2);border-radius:var(--r-xs);overflow:hidden}
.ampy-ek__stepbtn{width:44px;height:44px;border:0;background:#fff;color:var(--ink);font-size:18px;cursor:pointer;line-height:1;
  transition:background var(--t-fast) var(--ease),transform var(--t-fast) var(--ease)}
@media (hover:hover) and (pointer:fine){ .ampy-ek__stepbtn:hover{background:#f0f4fb} }   /* DM4 */
.ampy-ek__stepbtn:active{transform:scale(.92)}
.ampy-ek__stepbtn:focus-visible{outline:2px solid var(--teal);outline-offset:-2px}
.ampy-ek__stepbtn[disabled]{opacity:.35;cursor:default}   /* m-m3: bound state (44px hit box kept) */
.ampy-ek__stepbtn[disabled]:active{transform:none}
.ampy-ek__stepval{min-width:26px;text-align:center;font-size:var(--ty-h);font-weight:500}
/* m-p1: a real keyframe (retriggered in JS via reflow) — the old transition never painted */
@keyframes ampyBump{0%{transform:translateY(-2px);opacity:.55}100%{transform:none;opacity:1}}
.ampy-ek__stepval.bump{animation:ampyBump var(--t-fast) var(--ease-out)}

/* ============================ RESULT ============================ */
.ampy-ek__eyebrow-row{display:flex;align-items:center;gap:var(--sp-3);flex-wrap:wrap}
.ampy-ek__eyebrow{font-size:var(--ty-eyebrow);letter-spacing:var(--tr-eyebrow);color:var(--eyebrow);text-transform:uppercase;font-weight:500;line-height:1.2}
.ampy-ek__eyebrow::before{content:'';display:inline-block;width:24px;height:2px;background:var(--teal-bright);
  vertical-align:middle;margin-right:var(--sp-2)}
/* B. anchor — DAGENS kostnad */
.ampy-ek__anchor-num{font-size:var(--ty-display);font-weight:900;line-height:1.08;   /* m-p3 */
  letter-spacing:var(--tr-display);color:#fff;margin:var(--sp-3) 0 var(--sp-4);font-variant-numeric:tabular-nums}
/* m-p1/d-p6: a real keyframe (retriggered in JS via reflow) — the old add/remove never painted */
@keyframes ampyFlash{0%{opacity:.4}100%{opacity:1}}
.ampy-ek__anchor-num.flash{animation:ampyFlash var(--t-mid) var(--ease)}
.ampy-ek .nowrap{white-space:nowrap}   /* d-m3: the anchor range never wraps mid-figure */
/* the unit is quiet and NEVER wraps mid-phrase: inline-block + nowrap drops it as one piece */
.ampy-ek__anchor-per{display:inline-block;font-size:var(--ty-body);font-weight:300;color:var(--subtext);
  letter-spacing:0;white-space:nowrap}

/* C. story bar */
.ampy-ek__storybar{display:flex;height:36px;border-radius:var(--r-sm);overflow:hidden;width:100%}
.ampy-ek__sb-seg{display:block;height:100%;transform-origin:left center;transition:width var(--t-slow) var(--ease)}
.ampy-ek__sb-seg+.ampy-ek__sb-seg{border-left:1px solid rgba(9,11,50,.5)}
.ampy-ek__sb-heat{background:var(--teal-on-dark)} .ampy-ek__sb-vv{background:var(--mint)} .ampy-ek__sb-house{background:var(--bar-house)}
/* entrance: scaleX stagger, once, reduced-motion-safe */
.ampy-ek__storybar.is-drawing .ampy-ek__sb-seg{transform:scaleX(0)}
.ampy-ek__storybar.is-drawn .ampy-ek__sb-seg{transform:scaleX(1);transition:transform var(--t-slow) var(--ease-out),width var(--t-slow) var(--ease)}
.ampy-ek__storybar .ampy-ek__sb-heat{transition-delay:0ms}
.ampy-ek__storybar .ampy-ek__sb-vv{transition-delay:var(--t-stagger)}
.ampy-ek__storybar .ampy-ek__sb-house{transition-delay:calc(var(--t-stagger)*2)}
.ampy-ek__sb-legend{list-style:none;margin:var(--sp-3) 0 0;padding:0;display:flex;flex-direction:column;gap:var(--sp-1)}
/* d-p3: width-robust row layout from 481px up (wrap absorbs narrow panes) */
@container ampyek (min-width:481px){.ampy-ek__sb-legend{flex-direction:row;gap:var(--sp-4);flex-wrap:wrap}}
.ampy-ek__sb-legend li{display:flex;align-items:baseline;gap:var(--sp-2);font-size:var(--ty-label);font-weight:300;color:var(--subtext)}
.ampy-ek__sb-legend b{font-weight:500;color:#fff;font-variant-numeric:tabular-nums}
.ampy-ek__sb-dot{flex:0 0 auto;width:10px;height:10px;border-radius:3px;align-self:center}
.ampy-ek__sb-dot-heat{background:var(--teal-on-dark)} .ampy-ek__sb-dot-vv{background:var(--mint)} .ampy-ek__sb-dot-house{background:var(--bar-house)}
.ampy-ek__sb-mix{font-size:var(--ty-micro);color:var(--footnote);margin:var(--sp-2) 0 0}
.ampy-ek__sb-mix[hidden],.ampy-ek__anchor-note[hidden],.ampy-ek__sb-mix:empty{display:none}
.ampy-ek__anchor-note{font-size:var(--ty-micro);font-weight:300;color:var(--footnote);margin:var(--sp-3) 0 0;line-height:var(--lh-body)}

/* ============================ SPARSTAPLARNA (#spark) ============================
 * Horizontal SAVING bars (money coming back). Solid teal fill = "räknat lågt" (LOW),
 * mint band = "upp till" (HIGH). ★ ring on the lead. Tap a row → dropdown (verdict +
 * two figure lines). Replaces the old #compare cost visual AND the #recs plate/wall. */
.ampy-ek__spark{display:block;margin-top:var(--sp-6);border:0;padding:0}
.ampy-ek__spark-h{font-size:var(--ty-h);font-weight:500;color:#fff;margin:0;line-height:var(--lh-tight)}

.ampy-ek__spark-list{margin-top:var(--sp-4);min-height:200px}   /* reserve height → no CLS on first paint */
/* MM8: the solar "Planeras" acknowledgement under the list */
.ampy-ek__spark-foot{font-size:var(--ty-label);font-weight:300;color:var(--footnote);margin:var(--sp-3) 0 0;line-height:var(--lh-body)}
.ampy-ek__spark-foot[hidden]{display:none}

.ampy-ek__sp-item{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:var(--r-md);
  overflow:hidden;transition:border-color var(--t-fast) var(--ease),background var(--t-fast) var(--ease)}
.ampy-ek__sp-item + .ampy-ek__sp-item{margin-top:var(--sp-2h)}
.ampy-ek__sp-item.is-rec{border-color:rgba(85,255,154,.55);background:rgba(0,196,167,.06);
  box-shadow:0 0 0 3px rgba(85,255,154,.10)}
.ampy-ek__sp-item.is-off{opacity:.65}                                   /* MM4: was .4 — ~2:1 contrast */
.ampy-ek__sp-item.is-off .ampy-ek__sp-note{opacity:1;color:var(--subtext)}       /* MM4: the reason stays readable */
.ampy-ek__sp-item.is-off .ampy-ek__sp-val{color:var(--subtext)}                  /* MM3: the grey comparison number */
.ampy-ek__sp-item--batt .ampy-ek__sp-fill{background:var(--mint)} .ampy-ek__sp-item--batt .ampy-ek__sp-band{background:rgba(159,225,203,.20)}
.ampy-ek__sp-item--batt .ampy-ek__sp-val{color:var(--mint)}

.ampy-ek__sp-row{display:block;width:100%;text-align:left;border:0;background:none;color:inherit;font-family:inherit;
  cursor:pointer;padding:var(--sp-3);margin:0;min-height:44px;transition:background var(--t-fast) var(--ease)}
.ampy-ek__sp-row--static{cursor:default}
@media (hover:hover) and (pointer:fine){ .ampy-ek__sp-row:not(.ampy-ek__sp-row--static):hover{background:rgba(255,255,255,.03)} }
.ampy-ek__sp-row:focus-visible{outline:2px solid var(--neon);outline-offset:-2px;border-radius:var(--r-md)}   /* DM2: inset — never clipped by the item's overflow:hidden */

.ampy-ek__sp-flag{display:inline-flex;align-items:center;gap:var(--sp-1);margin-bottom:var(--sp-2);
  padding:2px var(--sp-2);border-radius:var(--r-pill);background:var(--mint);color:var(--midnight);
  font-size:var(--ty-micro);font-weight:500;line-height:1.2}
.ampy-ek__sp-flag[hidden]{display:none}
.ampy-ek__sp-star{width:12px;height:12px;fill:var(--midnight);flex:0 0 auto;margin-right:2px}

.ampy-ek__sp-head{display:flex;align-items:baseline;gap:var(--sp-2)}
.ampy-ek__sp-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:var(--ty-body);font-weight:300;color:var(--subtext);line-height:var(--lh-snug);
  transition:color var(--t-fast) var(--ease)}
.ampy-ek__sp-item.is-rec .ampy-ek__sp-name{color:#fff;font-weight:500}
.ampy-ek__sp-val{font-size:var(--ty-body);font-weight:500;color:var(--teal-on-dark);white-space:nowrap;
  font-variant-numeric:tabular-nums;flex:0 0 auto}
.ampy-ek__sp-val--soft{color:var(--footnote);font-weight:300;font-size:var(--ty-label)}   /* utan pris */
.ampy-ek__sp-val--amber{color:var(--amber);white-space:normal}                            /* dyrare */
.ampy-ek__sp-tag{display:inline-block;font-size:var(--ty-micro);font-weight:500;color:var(--midnight);background:var(--mint);
  border-radius:var(--r-pill);padding:1.5px var(--sp-2);vertical-align:1px;white-space:nowrap;flex:0 0 auto}
.ampy-ek__sp-note{display:block;font-size:var(--ty-label);font-weight:300;color:var(--footnote);
  margin-top:var(--sp-1h);line-height:var(--lh-body)}
.ampy-ek__sp-caret{flex:0 0 auto;align-self:center;width:16px;height:16px;color:var(--slate);
  transition:transform var(--t-fast) var(--ease)}
.ampy-ek__sp-row[aria-expanded="true"] .ampy-ek__sp-caret{transform:rotate(180deg)}

.ampy-ek__sp-barline{display:flex;align-items:center;gap:var(--sp-2);margin-top:var(--sp-2)}
.ampy-ek__sp-track{position:relative;display:block;flex:1 1 auto;height:12px;border-radius:var(--r-pill);
  background:var(--inset);overflow:hidden}
.ampy-ek__sp-fill{position:absolute;left:0;top:1px;bottom:1px;border-radius:var(--r-pill);background:var(--teal-on-dark);
  transform-origin:left center;transition:width var(--t-mid) var(--ease-out)}
.ampy-ek__sp-band{position:absolute;top:1px;bottom:1px;background:rgba(159,225,203,.34);
  border-radius:0 var(--r-pill) var(--r-pill) 0;transition:width var(--t-mid) var(--ease-out),left var(--t-mid) var(--ease-out)}
.ampy-ek__sp-pay{flex:0 0 auto;font-size:var(--ty-micro);font-weight:500;color:var(--subtext);background:var(--chip);
  border-radius:var(--r-pill);padding:2px var(--sp-2);white-space:nowrap;font-variant-numeric:tabular-nums}
.ampy-ek__sp-pay--weak{opacity:.75;font-weight:300;color:var(--footnote)}

/* dropdown — reuses the existing .ampy-ek__gear-collapsed grid mechanic (0fr→1fr) */
.ampy-ek__sp-drop-body{padding:var(--sp-3) var(--sp-3) var(--sp-4);border-top:var(--bd-dark);margin-top:var(--sp-3)}
.ampy-ek__sp-verdict{font-size:var(--ty-sub);font-weight:300;color:var(--subtext);line-height:var(--lh-body);margin:0 0 var(--sp-3);
  max-width:62ch}   /* d-m4: measure cap */
.ampy-ek__sp-verdict b{font-weight:500;color:#fff;font-variant-numeric:tabular-nums}
/* the vertical stat ROWS (owner v30): one stacked row per stat, label left / value
   right, bigger readable type — Ny kostnad per år · Besparing per år · Återbetalningstid.
   Same treatment desktop+mobile; hairline separation between rows. */
.ampy-ek__sp-rows{margin:0;display:block}
.ampy-ek__sp-statrow{display:flex;align-items:baseline;justify-content:space-between;gap:var(--sp-3);
  padding:var(--sp-2h) 0;min-width:0}
.ampy-ek__sp-statrow:first-child{padding-top:0}
.ampy-ek__sp-statrow:last-child{padding-bottom:0}
.ampy-ek__sp-statrow + .ampy-ek__sp-statrow{border-top:1px solid rgba(255,255,255,.08)}
.ampy-ek__sp-statrow-k{font-size:var(--ty-label);font-weight:300;color:var(--footnote);line-height:1.3}
.ampy-ek__sp-statrow-v{margin:0;font-size:15.5px;font-weight:500;color:#fff;line-height:1.3;
  font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;flex:0 0 auto}
.ampy-ek__sp-statrow-v--weak{color:var(--amber)}   /* long payback: honest visual flag, on the value */


/* entrance: bars scaleX, band fades, chip pops last (JS toggles is-drawing/is-drawn) */
.ampy-ek__spark-list.is-drawing .ampy-ek__sp-fill{transform:scaleX(0)}
.ampy-ek__spark-list.is-drawing .ampy-ek__sp-band{opacity:0}
.ampy-ek__spark-list.is-drawing .ampy-ek__sp-pay{opacity:0}
.ampy-ek__spark-list.is-drawn  .ampy-ek__sp-fill{transform:scaleX(1);transition:transform var(--t-mid) var(--ease-out)}
.ampy-ek__spark-list.is-drawn  .ampy-ek__sp-band{opacity:1;transition:opacity var(--t-fast) var(--ease) 140ms}
.ampy-ek__spark-list.is-drawn  .ampy-ek__sp-pay{opacity:1;transition:opacity var(--t-fast) var(--ease) 200ms}

/* ============================ F. THE CTA BLOCK ============================ */
.ampy-ek__ctablock{margin-top:var(--sp-7)}

/* cta — the ONE loud element on the card */
.ampy-ek__cta{display:block;width:100%;background:var(--teal);color:#fff;text-align:center;font-weight:500;
  font-size:clamp(16px, 15px + 0.3vw, 18px);font-family:inherit;padding:var(--cta-y) var(--sp-4);border:1px solid transparent;
  border-radius:var(--r-md);cursor:pointer;margin-top:var(--sp-7);
  transition:background var(--t-fast) var(--ease),transform var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease),color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
.ampy-ek__ctablock .ampy-ek__cta{margin-top:0}
.ampy-ek__cta--primary{min-height:52px}
@media (hover:hover) and (pointer:fine){   /* DM4 */
  .ampy-ek__cta:hover{transform:translateY(-2px);background:#00b89e;box-shadow:var(--shadow-teal)}
  .ampy-ek__cta.is-close:hover{background:rgba(255,255,255,.05);box-shadow:none;transform:none;color:#fff}
}
.ampy-ek__cta:active{transform:scale(.99)}
.ampy-ek__cta:focus-visible{outline:2px solid var(--neon);outline-offset:2px}
.ampy-ek__cta[disabled]{opacity:.6;cursor:default;transform:none;box-shadow:none}   /* m-m2 sent-state */
.ampy-ek__cta svg{width:16px;height:16px;vertical-align:-3px;margin-left:4px}
/* the CTA morphs to a quiet ghost "Stäng" once the inline form is open */
.ampy-ek__cta.is-close{background:transparent;border:1px solid rgba(255,255,255,.18);color:var(--subtext)}
/* MM7 + owner P1-P4: the soft-branch .cta--ghost is RETIRED — every branch leads
 * with a purchasable action, so the main CTA is always the solid teal primary */

/* share — DEMOTED to a quiet text-level action (R9); still a full ≥44px target */
.ampy-ek__share-wrap{position:relative;margin-top:var(--sp-1)}
.ampy-ek__share-btn{display:block;width:100%;min-height:44px;margin-top:0;border-radius:var(--r-md);
  background:transparent;border:1px solid transparent;color:var(--subtext);font-family:inherit;
  font-size:var(--ty-label);font-weight:300;cursor:pointer;
  transition:color var(--t-fast) var(--ease)}
@media (hover:hover) and (pointer:fine){ .ampy-ek__share-btn--quiet:hover{color:#fff;text-decoration:underline;text-underline-offset:.3em} }   /* DM4 */
.ampy-ek__share-btn:focus-visible{outline:2px solid var(--neon);outline-offset:2px}

/* the desktop/no-native-share popover: three 44px icon+label rows on the chip surface,
 * anchored above the button (stays inside the card's overflow) */
.ampy-ek__share-pop{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);z-index:6;
  min-width:240px;background:var(--chip);border:1px solid rgba(255,255,255,.12);border-radius:var(--r-md);
  padding:var(--sp-1);box-shadow:var(--shadow-3)}
.ampy-ek__share-pop[hidden]{display:none}
/* flip fallback: when the viewport space above the button is tight, open below instead */
.ampy-ek__share-pop--below{bottom:auto;top:calc(100% + 6px)}
.ampy-ek__share-act{display:flex;align-items:center;gap:var(--sp-3);width:100%;min-height:44px;
  padding:0 var(--sp-3);border:0;border-radius:var(--r-sm);background:transparent;color:#fff;
  font-family:inherit;font-size:var(--ty-label);font-weight:300;text-align:left;text-decoration:none;
  cursor:pointer;transition:background var(--t-fast) var(--ease)}
.ampy-ek__share-act svg{width:18px;height:18px;color:var(--mint);flex:0 0 auto}
@media (hover:hover) and (pointer:fine){ .ampy-ek__share-act:hover{background:rgba(255,255,255,.06)} }
.ampy-ek__share-act:focus-visible{outline:2px solid var(--neon);outline-offset:-2px}
.ampy-ek__share-act.is-done .ampy-ek__share-act-lbl{color:var(--mint)}

/* methodology */
.ampy-ek__method{margin-top:var(--sp-4);border-top:1px solid rgba(255,255,255,.08);padding-top:var(--sp-2)}
.ampy-ek__method summary{list-style:none;cursor:pointer;font-size:var(--ty-label);color:var(--subtext);display:flex;align-items:center;gap:var(--sp-1h);min-height:44px}   /* d-m6: ≥44px target at every width */
.ampy-ek__method summary::-webkit-details-marker{display:none}
@media (hover:hover) and (pointer:fine){ .ampy-ek__method summary:hover{color:#fff} }   /* d-m6 + DM4 */
.ampy-ek__method summary:focus-visible{outline:2px solid var(--neon);outline-offset:2px;border-radius:var(--r-xs)}   /* d-m6 */
.ampy-ek__method summary svg{width:16px;height:16px;color:var(--mint);flex:0 0 auto;transition:transform var(--t-fast) var(--ease)}
.ampy-ek__method[open] summary svg{transform:rotate(90deg)}
.ampy-ek__method-body{font-size:var(--ty-label);font-weight:300;color:var(--footnote);line-height:var(--lh-body);margin-top:var(--sp-3);max-width:70ch}   /* d-m4: measure cap */
.ampy-ek__method-body b{font-weight:500;color:var(--subtext)}
/* V7: the technical bullet list + the legal fritext (the curve is GONE) */
.ampy-ek__method-list{list-style:disc;margin:0;padding-left:18px}
.ampy-ek__method-list li{margin:0 0 var(--sp-2)}
.ampy-ek__method-legal{margin:var(--sp-4) 0 0;padding-top:var(--sp-3);border-top:1px solid rgba(255,255,255,.08);
  font-size:var(--ty-micro);color:var(--footnote);line-height:var(--lh-body)}

/* ============================ INLINE LEAD FORM (inside the midnight card) ============================ */
/* the gap belongs to the OPEN state: a closed form leaves no orphan margin
 * between the share button and the method hairline */
.ampy-ek__lead-inline{margin-top:0;
  transition:grid-template-rows var(--t-mid) var(--ease-out),opacity var(--t-mid) var(--ease-out),
             margin-top var(--t-mid) var(--ease-out)}
.ampy-ek__lead-inline.open{margin-top:var(--sp-5)}
.ampy-ek__lead-inline[hidden]{display:none}
.ampy-ek__lead-inline-body{position:relative;background:var(--chip);border:1px solid rgba(255,255,255,.06);
  border-radius:var(--r-lg);padding:var(--sp-5);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
/* .lead-eyebrow removed (the form now opens on the heading); title is the first child,
 * so margin-top:0 and padding-right clears the absolute close button (30px + 11px inset) */
.ampy-ek__lead-title{font-size:var(--ty-h);font-weight:500;line-height:var(--lh-tight);color:#fff;margin:0 0 4px;padding-right:36px}
.ampy-ek__lead-sub{font-size:var(--ty-sub);font-weight:300;color:var(--subtext);margin:0 0 var(--sp-3);line-height:var(--lh-body)}
.ampy-ek__lead-lbl{display:block;font-size:var(--ty-eyebrow);color:var(--subtext);margin:var(--sp-2) 0 4px}
.ampy-ek__lead-req{color:#ff8a8a;font-weight:500}   /* required marker — Evify convention */
.ampy-ek__lead-field{width:100%;min-height:44px;padding:10px 11px;border:1px solid rgba(255,255,255,.12);border-radius:var(--r-sm);
  font-size:var(--ty-body);font-weight:300;font-family:inherit;color:#fff;background:rgba(255,255,255,.04);
  transition:border-color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease)}
.ampy-ek__lead-field:focus-visible{outline:none;border-color:var(--neon);box-shadow:var(--ring-dark)}
/* invalid = RED BORDER ONLY (the messages live in sr-only elements, aria-described) —
 * a slightly stronger 1.5px border carries the state without any layout shift */
.ampy-ek__lead-field[aria-invalid="true"]{border-color:#ff8a8a;box-shadow:inset 0 0 0 .5px #ff8a8a}
.ampy-ek__lead-err{font-size:var(--ty-label);color:#ff8a8a;margin:4px 0 0}
.ampy-ek__lead-err[hidden]{display:none}
.ampy-ek__leadclose{position:absolute;top:11px;right:11px;width:30px;height:30px;border:0;background:none;
  color:var(--subtext);cursor:pointer;border-radius:8px;transition:background var(--t-fast) var(--ease)}
.ampy-ek__leadclose svg{width:18px;height:18px}
@media (hover:hover) and (pointer:fine){ .ampy-ek__leadclose:hover{background:rgba(255,255,255,.06)} }   /* DM4 */
.ampy-ek__leadclose:focus-visible{outline:2px solid var(--neon);outline-offset:1px}
.ampy-ek__hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.ampy-ek__lead-submit{margin-top:var(--sp-4)}
/* the consent line under the submit button — pressing the button IS the consent */
.ampy-ek__lead-consent{font-size:var(--ty-label);font-weight:300;color:var(--footnote);margin:var(--sp-2) 0 0;line-height:var(--lh-body)}   /* m-m4: 13.5px — legally load-bearing text is never micro */
.ampy-ek__lead-consent a{color:var(--subtext);text-decoration:underline;text-underline-offset:.2em;
  padding:5px 0;transition:color var(--t-fast) var(--ease)}   /* P1: taller tap target for the only legal link */
@media (hover:hover) and (pointer:fine){ .ampy-ek__lead-consent a:hover{color:#fff} }   /* DM4 */
.ampy-ek__lead-consent a:focus-visible{outline:2px solid var(--neon);outline-offset:2px;border-radius:2px}
.ampy-ek__lead-success{text-align:center;padding:var(--sp-4) var(--sp-1);color:var(--subtext)}
.ampy-ek__lead-success[hidden]{display:none}
.ampy-ek__lead-success svg{width:30px;height:30px;color:var(--teal)}
.ampy-ek__lead-success p{font-size:var(--ty-sub);margin:var(--sp-2) 0 0;color:#fff}
.ampy-ek__lead-success:focus-visible{outline:2px solid var(--neon);outline-offset:2px;border-radius:var(--r-sm)}

/* ============================ TRUST BLOCK (right column, below the result card) ============================
 * A real Ampy dusk photo (trust-elinstallation.webp — white gabled villa, warm-glowing
 * gable notch) is the surface, under a LEFT-weighted midnight veil that guarantees AA white
 * text on the left while the house breathes on the right, and a bottom veil that seats the
 * stat line. Same radius/shadow family as the result card (both midnight) so the seam reads
 * seamless. Owner-sanctioned content only (verbatim Google review + real public reviewer +
 * 5/5 + 3 000+/year). Render-verified premium at 852 / 560 / 343 px, AA throughout. */
.ampy-ek__trust{position:relative;border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--shadow-3);
  background:var(--midnight);isolation:isolate}
.ampy-ek__trust-photo{position:absolute;top:0;right:0;bottom:0;left:0;inset:0;z-index:0;display:block;width:100%;height:100%;
  object-fit:cover;object-position:64% 50%}
.ampy-ek__trust-veil{position:absolute;top:0;right:0;bottom:0;left:0;inset:0;z-index:1;background:
  linear-gradient(103deg, rgba(9,11,50,.94) 0%, rgba(9,11,50,.82) 38%, rgba(9,11,50,.50) 68%, rgba(9,11,50,.28) 100%),
  linear-gradient(to top, rgba(9,11,50,.66) 0%, rgba(9,11,50,0) 52%)}
.ampy-ek__trust::after{content:'';position:absolute;top:0;right:0;bottom:0;left:0;inset:0;border-radius:inherit;pointer-events:none;z-index:3;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.10),inset 0 0 0 1px rgba(255,255,255,.05)}
.ampy-ek__trust-inner{position:relative;z-index:2;padding:30px 32px}
.ampy-ek__trust-quote{margin:0;position:relative;max-width:30ch;padding-top:34px}   /* 30ch wraps to 2-3 short lines; padding-top reserves the mark's air */
.ampy-ek__trust-mark{position:absolute;left:-2px;top:0;font-weight:500;font-size:72px;line-height:.62;
  color:var(--teal-on-dark);opacity:.55;pointer-events:none;letter-spacing:-.02em}   /* oversized decorative ” — Outfit 500 keeps the single-font discipline */
.ampy-ek__trust-quote p{margin:0;color:#fff;font-size:var(--ty-lead);font-weight:500;line-height:1.36;letter-spacing:-.008em}
.ampy-ek__trust-cite{display:block;margin-top:var(--sp-3);font-size:var(--ty-label);font-weight:300;font-style:normal;
  color:var(--subtext);letter-spacing:.01em}
.ampy-ek__trust-rating{display:flex;align-items:center;gap:var(--sp-2h);margin-top:var(--sp-5);flex-wrap:wrap}
.ampy-ek__trust-stars{display:inline-flex;gap:3.5px}
.ampy-ek__trust-stars svg{width:18px;height:18px;fill:var(--amber);filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}   /* the shadow lifts the gold off any brighter patch of sky */
.ampy-ek__trust-rating-txt{font-size:var(--ty-label);font-weight:300;color:var(--subtext)}
.ampy-ek__trust-divider{height:1px;width:44%;min-width:220px;background:rgba(255,255,255,.16);margin:var(--sp-5) 0}   /* lives in the text column, never slashes the house */
.ampy-ek__trust-stat{margin:0;font-size:var(--ty-sub);font-weight:500;color:#fff;font-variant-numeric:tabular-nums}

/* ============================ MOBILE JUMP-PILL (≤991) ============================
 * A quiet fixed pill: appears after the first input interaction, smooth-scrolls to
 * #result, hides while the result is in view or the lead form is open. */
.ampy-ek__jump-pill{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:60;
  display:none;align-items:center;gap:var(--sp-2);min-height:46px;padding:0 6px 0 20px;
  color:#fff;border-radius:var(--r-pill);
  /* solid midnight (owner: no gradient) — the teal chip alone carries the accent */
  background:var(--midnight);
  border:1px solid rgba(255,255,255,.16);
  font-family:inherit;font-size:15px;font-weight:500;cursor:pointer;white-space:nowrap;
  box-shadow:0 12px 30px -10px rgba(9,11,50,.55);
  opacity:0;transform:translate(-50%,10px) scale(.97);pointer-events:none;
  transition:opacity var(--t-mid) var(--ease),transform var(--t-mid) var(--ease)}
.ampy-ek__jp-chip{width:34px;height:34px;border-radius:50%;background:var(--teal);flex:0 0 auto;
  display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.ampy-ek__jump-pill svg{width:17px;height:17px;color:#fff;flex:0 0 auto}
@media (max-width:991px){ .ampy-ek__jump-pill{display:inline-flex} }
.ampy-ek__jump-pill.show{opacity:1;transform:translate(-50%,0) scale(1);pointer-events:auto}
.ampy-ek__jump-pill.show .ampy-ek__jp-chip svg{animation:jpNudge 2.6s var(--ease) infinite}
.ampy-ek__jump-pill:active{transform:translate(-50%,0) scale(.97)}
.ampy-ek__jump-pill:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
@keyframes jpNudge{0%,100%{transform:translateY(0)} 12%{transform:translateY(2px)} 24%{transform:translateY(0)}}
@media (prefers-reduced-motion:reduce){ .ampy-ek__jump-pill.show .ampy-ek__jp-chip svg{animation:none} }

/* ============================ MOTION ============================ */
/* reveals — grid-template-rows:0fr->1fr (replaces the hidden swap) */
.ampy-ek__gear-collapsed{display:grid;grid-template-rows:0fr;opacity:0;
  transition:grid-template-rows var(--t-mid) var(--ease-out),opacity var(--t-mid) var(--ease-out)}
.ampy-ek__gear-collapsed.open{grid-template-rows:1fr;opacity:1}
.ampy-ek__gear-collapsed > .ampy-ek__gear-inner{overflow:hidden;min-height:0}
/* a COLLAPSED disclosure panel must occupy zero vertical space — no phantom margin/padding
   leaking into the group rhythm (the own/sol panels sat 10px proud when shut).
   The #ownRow id-scoped margin needs an id-scoped override to actually win. */
.ampy-ek__gear-collapsed:not(.open){margin-top:0;padding-top:0}
#ownRow > .ampy-ek__gear-collapsed:not(.open){margin-top:0}

/* entrance choreography (first paint, staggered, once) */
@keyframes ampyRise{from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none}}
.ampy-ek__result.enter > *{animation:ampyRise var(--t-slow) var(--ease-out) both}
.ampy-ek__result.enter > .ampy-ek__anchor-num{animation-delay:calc(var(--t-stagger)*1)}
.ampy-ek__result.enter > .ampy-ek__storybar{animation-delay:calc(var(--t-stagger)*2)}
.ampy-ek__result.enter > .ampy-ek__sb-legend{animation-delay:calc(var(--t-stagger)*3)}
.ampy-ek__result.enter > .ampy-ek__spark{animation-delay:calc(var(--t-stagger)*4)}
.ampy-ek__result.enter > .ampy-ek__ctablock{animation-delay:calc(var(--t-stagger)*6)}
.ampy-ek__input{animation:ampyRise var(--t-mid) var(--ease-out) both}
/* (Sparstaplarna per-bar entrance lives in the #spark block: .ampy-ek__spark-list.is-drawing/.is-drawn) */

/* ============================ RESPONSIVE ============================ */
/* DB1: the 769-991 two-pane band starved the result column (~430px broke .ampy-ek__sp-head);
 * iPad portrait now STACKS with the phones. Bands are contiguous: ≤991 stacked,
 * ≥992 the true desktop two-pane. The old 769-991 tune block is deleted. */
@container ampyek (max-width:991px){
  .ampy-ek__panes{flex-direction:column}
  /* inputs-first on mobile: the visitor builds the number, the bar mirrors it */
  .ampy-ek__input{flex:auto;order:1;width:100%;max-width:none;position:static;top:auto}
  /* explicit width: .ampy-ek__panes has align-items:flex-start (no stretch), and the
   * comparison rows carry nowrap min-content — the card must never grow past
   * the pane (the no-h-scroll floor at 375px). The trust block rides inside
   * .ampy-ek__rightcol → renders LAST, after the result card. */
  .ampy-ek__rightcol{order:2;width:100%}
  /* touch-target floor (>=44px) on every tappable control */
  .ampy-ek__seg button{min-height:44px}
  .ampy-ek__stepbtn{width:44px;height:44px}
  .ampy-ek__leadclose{width:44px;height:44px}
  /* Sparstaplarna: 12px track on mobile; value never truncates */
  .ampy-ek__sp-track{height:12px}
  /* MM1+MM2: the ★ row head wraps instead of crushing the name — the value
   * drops to its own line, the name breaks by word, never mid-word ellipsis */
  .ampy-ek__sp-head{flex-wrap:wrap;row-gap:2px}
  .ampy-ek__sp-name{flex:1 1 calc(100% - 24px);white-space:normal}
  /* the hint renders only when it has something to say — no phantom reserved slot */
}
@container ampyek (max-width:480px){
  .ampy-ek-outer{padding:var(--sp-4) var(--sp-3) var(--sp-8)}
  .ampy-ek__result{padding:var(--sp-4)}
  .ampy-ek__input{padding:var(--sp-5)}
  /* trust: tighter inner, mobile-tuned crop, a touch smaller mark, full-width divider,
     and a stronger bottom veil so the stat stays AA over the glowing windows */
  .ampy-ek__trust-inner{padding:26px 24px}
  .ampy-ek__trust-photo{object-position:58% 42%}
  .ampy-ek__trust-mark{font-size:64px}
  .ampy-ek__trust-divider{width:100%;min-width:0}
  .ampy-ek__trust-veil{background:
    linear-gradient(103deg, rgba(9,11,50,.92) 0%, rgba(9,11,50,.80) 42%, rgba(9,11,50,.55) 100%),
    linear-gradient(to top, rgba(9,11,50,.74) 0%, rgba(9,11,50,0) 58%)}
  .ampy-ek__hp-ic{width:34px;height:34px}
  .ampy-ek__hp-ic svg{width:19px;height:19px}
  .ampy-ek__storybar{height:32px}
  /* ---- item 9: the left-column breathing pass (owner: perfect down TO Boyta;
   * from Byggår down it was chunky/tight). Group rhythm steps UP one notch,
   * label→control opens to --sp-3, the seg buttons grow taller with more gap. ---- */
  .ampy-ek__gear > .ampy-ek__lbl,.ampy-ek__gear > #ownRow{margin-top:var(--sp-7)}       /* every group from Byggår down */
  .ampy-ek__gear > .ampy-ek__heatpicker + .ampy-ek__lbl{margin-top:var(--sp-6)}          /* Boyta keeps its tuned gap */
  .ampy-ek__gear .ampy-ek__seg,.ampy-ek__gear .ampy-ek__range{margin-top:var(--sp-3)}             /* consistent label→control air */
  #ownRow > * + *{margin-top:var(--sp-3)}
  .ampy-ek__seg{gap:var(--sp-2)}                                       /* the wrapped byggår rows breathe */
  .ampy-ek__seg button{min-height:48px}                              /* taller segs (the 5 byggår segs were cramped) */
  .ampy-ek__gear[data-gear="n2"]{margin-top:var(--sp-7);padding-top:var(--sp-7)}  /* DIN EL header clearly separated */
  /* the stat rows: the value never breaks mid-number (nowrap lives on .ampy-ek__sp-statrow-v);
     drop-body keeps a touch tighter horizontal padding at 375 */
  .ampy-ek__sp-drop-body{padding:var(--sp-3) var(--sp-2) var(--sp-4)}
  /* "Så har vi räknat" gets a touch larger tap surface for 55+ thumbs (owner ask) */
  .ampy-ek__method summary{font-size:15px}
  .ampy-ek__method summary svg{width:18px;height:18px}
}
@container ampyek (min-width:992px){
  /* desktop: calmer 10px track, rows tighten */
  .ampy-ek__sp-track{height:10px}
  .ampy-ek__sp-item + .ampy-ek__sp-item{margin-top:var(--sp-2)}
  .ampy-ek__spark-list{min-height:120px}   /* d-p5: the v2 list is shorter — less reserved void */
  /* owner: keep the heat cards 2-up on desktop (the 3-col grid read cramped) */
  /* d-m5 (partial): the lead form breathes at desktop — capped fields,
   * Namn + Telefon side by side (pure CSS placement, zero DOM changes) */
  .ampy-ek__lead-field{max-width:480px}
  #leadForm{display:grid;grid-template-columns:1fr 1fr;column-gap:var(--sp-3)}
  #leadForm > *{grid-column:1 / -1}
  #leadForm label[for="leadName"]{grid-column:1;grid-row:1}
  #leadForm #leadName{grid-column:1;grid-row:2}
  #leadForm #errName{grid-column:1;grid-row:3}
  #leadForm label[for="leadPhone"]{grid-column:2;grid-row:1}
  #leadForm #leadPhone{grid-column:2;grid-row:2}
  #leadForm #errPhone{grid-column:2;grid-row:3}
  /* row 2 of the grid: Postnummer (col 1) + E-post (col 2), same shape as Namn/Telefon */
  #leadForm label[for="leadZip"]{grid-column:1;grid-row:4}
  #leadForm #leadZip{grid-column:1;grid-row:5}
  #leadForm #errZip{grid-column:1;grid-row:6}
  #leadForm label[for="leadEmail"]{grid-column:2;grid-row:4}
  #leadForm #leadEmail{grid-column:2;grid-row:5}
  #leadForm #errEmail{grid-column:2;grid-row:6}
  /* M1 fix: the full-width items must sit AFTER the field rows. The error rows (3,6) are
     display:none when hidden, so without an explicit row grid auto-placement dropped the
     submit into empty row 3 (mid-form). Pin them past row 6. */
  #leadForm .ampy-ek__lead-submit{grid-row:7}
  #leadForm .ampy-ek__lead-consent{grid-row:8}
  #leadForm #leadErr{grid-row:9}
}
/* N2: at the narrow two-pane band (incl. iPad landscape 1024) the result column is narrower
   than the wrapped stacked layout, so the ★ row title clipped. Let it wrap here too. */
@container ampyek (min-width:992px) and (max-width:1200px){
  .ampy-ek__sp-name{white-space:normal}
}

/* reduced motion — belt and braces on top of the zeroed tokens */
@media (prefers-reduced-motion:reduce){
  .ampy-ek *{animation-duration:0s!important;transition-duration:0s!important}
  .ampy-ek{scroll-behavior:auto!important}
}
