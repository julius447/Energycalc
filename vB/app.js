/* =============================================================================
 * app.js — Ampy energikalkylatorn — vB · B2R refinement (B2R-SPEC.md)
 * Renderer + interactions. The two-pane single-canvas calculator, live recompute.
 *   LEFT:  icon multi-select heat picker (+ Vet inte) → boyta → byggår → override
 *          → ONE reveal (Huset / El). Inline SVG icons, no icon CDN.
 *   RIGHT: DAGENS KOSTNAD anchor → story bar → verdict → åtgärdsstegen (mcards,
 *          rung-grouped, greyed WITH reason) → upside → CTA + share → method
 *          (prose + the 12-month curve, lazy-drawn).
 * engine.js calculate() is FROZEN. rank.js (AmpyRank/AmpyCodec) is the pure
 * additive layer. data.js owns every number. Rounding + Swedish formatting HERE.
 * ========================================================================== */

(function () {
  'use strict';
  var D = window.AMPY_DATA;
  var ENGINE = window.AmpyEngine;
  var RANK = window.AmpyRank;
  var CODEC = window.AmpyCodec;
  if (!D || !ENGINE || !RANK) { return; }

  /* ---------- tiny DOM + format helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var REDUCED = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var EMPTY = '—'; /* the ONE sanctioned em-dash: the empty payback readout */

  function nf(n) { return Math.round(n).toLocaleString('sv-SE').replace(/ /g, ' '); }
  function roundTo(n, step) { return Math.round(n / step) * step; }
  function krStr(n, step) { return nf(roundTo(n, step)) + ' kr'; }
  function yrStr(y) { return (Math.round(y * 2) / 2).toString().replace('.', ','); }
  function pct(x) { return Math.round(x * 100) + ' %'; }
  function ucfirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  /* honest range string: '~lo-hi kr' (plain hyphen), collapses to '~mid kr' */
  function krRange(lo, hi, step) {
    var a = Math.max(0, roundTo(lo, step)), b = Math.max(0, roundTo(hi, step));
    return (a === b) ? '~' + nf(a) + ' kr' : '~' + nf(a) + '-' + nf(b) + ' kr';
  }
  var ROUND = (D.meta && D.meta.rounding) ? D.meta.rounding : { hero: 1000, stat: 500, payback: 0.5 };

  /* ---------- instrumentation (consent-gated, bucketed, experiment_id) ---------- */
  function hasConsent() { return window.ampyConsent === true || window.AMPY_CONSENT === true; }
  function track(ev, params) {
    if (!hasConsent()) return; /* no event fires without consent state */
    try {
      var p = { event: 'ek_' + ev, experiment_id: 'energikalkylatorn-b2r' };
      if (params) for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
      (window.dataLayer = window.dataLayer || []).push(p);
    } catch (e) {}
  }
  function bucketKr(v) { /* savings are BUCKETED, never raw */
    if (v == null || !(v > 0)) return '0';
    var lo = Math.floor(v / 5000) * 5000;
    return lo + '-' + (lo + 5000);
  }

  /* ---------- the copy deck (B2R-SPEC §4; rost-final, grep-clean) ---------- */
  var S = {
    hintVetinte: 'Vi räknar försiktigt på direktverkande el tills du vet mer. Det går att ändra sen.',
    hintFjarr: 'Fjärrvärme jämförs på pris, så vi räknar den ensam.',
    ownOk: 'Din siffra används. Spannet smalnar.',
    ownHigh: 'Det är en ovanligt hög siffra för ett småhus. Vi räknar på den, men dubbelkolla gärna.',
    primer: 'Räknat på ett typhus: direktel, 150 m², SE3. Ändra uppgifterna så blir siffran din.',
    bandNote: 'Spannet är brett eftersom vi räknar försiktigt. Vet du din årssiffra? Fyll i den under Byggår så smalnar det.',
    verdict: {
      redanEffektiv: 'Bra nyheter: din uppvärmning är redan effektiv. Det ärliga svaret är att en stor investering knappast lönar sig.',
      ingenBesparing: 'Med dina siffror räknar vi inte hem det. Det ärliga svaret är att behålla det du har. Har du din riktiga årskostnad blir kalkylen skarpare.',
      litenBesparing: 'Med dina siffror blir besparingen liten. En stor investering är svår att räkna hem, men de små åtgärderna kan vara värda att göra.'
    },
    cardName: {
      behall: 'Behåll det du har',
      styrning: 'Smart styrning av värmen',
      luftvatten: 'Luft-vatten värmepump',
      bergvarme: 'Bergvärme'
    },
    caveat: {
      behall: 'Ingen åtgärd är också ett svar. Ditt system gör redan jobbet.',
      styrning: 'Styr värmen efter pris och behov. Vi sätter en siffra först när källan är granskad.',
      servedShare: 'Värmer där luften når. Vi räknar bara på den del av huset den täcker.',
      vinterSag: 'Luftvärmepumpen tappar i kyla. Det är med i siffran.',
      viaPartner: 'Kräver borrhål och sker via partner. Vi berättar om tomten räcker.',
      vattenburet: 'Kräver vattenburet system. Det finns inte i huset, så vi räknar med 60 000-120 000 kr extra för att lägga till det.',
      pris: 'Fjärrvärme jämför vi på pris, eftersom du köper färdig värme, inte el.'
    },
    styrningBody: 'Sänkt kostnad utan att röra själva värmen. Din innetemperatur är en egen hävstång, testa reglaget till vänster.',
    kaminSpets: 'Kaminen tar topparna de kallaste dagarna. Det håller nere elräkningen när den annars är som högst.',
    reason: {
      redanVarmepump: 'Huset värms redan av en värmepump. Vi visar siffran som jämförelse, inte som råd.',
      luftluftFinnsRedan: 'Luft-luft finns redan i huset, så en till ger litet utrymme till mer.',
      styrningEjStyrbar: 'Kräver värme som går att styra elektroniskt. Ved och pellets eldas för hand.'
    },
    facts: { save: 'Lägre kostnad', invest: 'Investering', payback: 'Återbetald' },
    investRot: ' efter ROT 30 % på arbetet',
    cta: { plan: 'Få en plan för ditt hus', soft: 'Få en kostnadsfri bedömning' },
    share: 'Dela din kalkyl',
    shareCopied: 'Länk kopierad',
    shareText: 'Se vad värmen kostar i ditt hus. Gratis, utan mejl.',
    leadErr: 'Det gick inte att skicka just nu. Försök igen om en stund.',
    solarHint: 'Slå på solel för att se solel- och batteriraderna.',
    curveCapAir: 'Luftvärmepumpens tapp i kyla, månad för månad. Det är beviset för raden på korten ovan.',
    curveCapGround: 'Bergvärme ligger stabilt över året. Kurvan visar varför.',
    foot: 'Försiktiga schabloner, inte ett erbjudande. Vi jobbar i Stockholmsområdet i dag.'
  };

  /* ---------- labels for the data-driven inputs (data.js holds the model, not copy) ---------- */
  var ERA_ITEMS = [                                  /* display map only; engine era keys untouched */
    { v: 'pre1940',    label: 'Före 1940' },
    { v: 'midcentury', label: '1940-1990' },         /* absorbs the 1940-1970 hole [GAP-ERA] */
    { v: 'modern2010', label: '1990-2020' },         /* absorbs the 1990-2010 hole [GAP-ERA] */
    { v: 'new2021',    label: 'Efter 2020' },
    { v: 'x',          label: 'Vet inte' }           /* → midcentury, assumed:true */
  ];
  var DIST_LABELS = { golvvarme: 'Golvvärme', radiator: 'Radiatorer', hogtemp: 'Äldre högtemp' };
  var DSO_LABELS  = { vetej: 'Vet ej', ellevio: 'Ellevio', vattenfall: 'Vattenfall', eon: 'E.ON' };
  var TIER_LABEL  = { durable: 'räknar vi med', effektavgift: 'kräver effektavgift', atrisk: 'kräver avtal, osäker' };
  var UPSIDE_LABEL = { arbitrage: 'Ladda billigt, använd dyrt', effekttopp: 'Kapade effekttoppar' }; /* display map; engine labels untouched */
  var SHARE_STOPS = (D.multi && D.multi.shareStops) ? D.multi.shareStops : [0.20, 0.40, 0.60];
  var SHARE_LABELS = ['Lite', 'En del', 'Mycket'];
  var DEFAULT_STOP = 1; // "En del" — maps to multi.defaultCoverage 0.40

  /* ---------- inline SVG icon set (24×24, stroke 1.75; no CDN) ---------- */
  function icsvg(paths, sw) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.75) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var ICONS = {
    bolt:     icsvg('<path d="M13 3v7h6l-8 11v-7H5l8-11z"/>'),
    dropbolt: icsvg('<path d="M7.5 19.42c2.6 2.11 6.4 2.11 9 0c2.6-2.1 3.26-5.71 1.57-8.55l-4.89-7.26c-.42-.62-1.29-.8-1.94-.4a1.38 1.38 0 0 0-.41.4l-4.89 7.26c-1.7 2.84-1.04 6.44 1.56 8.55z"/><path d="M13 10l-2.5 3h3L11 16"/>'),
    flame:    icsvg('<path d="M12 12c2-2.96 0-7-1-8c0 3.04-1.77 4.74-3 6c-1.23 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.53-1.06-3.94-2-5c-1.79 3-2.79 3-4 2z"/>'),
    pellets:  icsvg('<circle cx="7" cy="16" r="3"/><circle cx="15" cy="16" r="3"/><circle cx="11" cy="8.5" r="3"/>'),
    wind:     icsvg('<path d="M5 8h8.5a2.5 2.5 0 1 0-2.34-3.24"/><path d="M3 12h15.5a2.5 2.5 0 1 1-2.34 3.24"/><path d="M4 16h5.5a2.5 2.5 0 1 1-2.34 3.24"/>'),
    building: icsvg('<path d="M3 21h18"/><path d="M5 21V7l4-4 4 4v14"/><path d="M13 21v-8l6 3v5"/><path d="M9 9h.01"/><path d="M9 13h.01"/>'),
    ac:       icsvg('<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M17.5 10h.01"/><path d="M17.5 14h.01"/>'),
    droplet:  icsvg('<path d="M7.5 19.42c2.6 2.11 6.4 2.11 9 0c2.6-2.1 3.26-5.71 1.57-8.55l-4.89-7.26c-.42-.62-1.29-.8-1.94-.4a1.38 1.38 0 0 0-.41.4l-4.89 7.26c-1.7 2.84-1.04 6.44 1.56 8.55z"/>'),
    mountain: icsvg('<path d="M3 20h18L14.08 5.39a2.3 2.3 0 0 0-4.16 0L3 20z"/><path d="M7.5 12.5l2 2.5l2.5-2.5l2 3l2.5-2"/>'),
    hearth:   icsvg('<path d="M4 4h16"/><path d="M5 4v16"/><path d="M19 4v16"/><path d="M4 20h4"/><path d="M16 20h4"/><path d="M12 9c-1.8 1.8-3 3.2-3 4.9a3 3 0 0 0 6 0c0-1.7-1.2-3.1-3-4.9z"/>'),
    check:    icsvg('<path d="M5 12l5 5l10-10"/>', 2.2),
    chevUp:   icsvg('<path d="M6 15l6-6l6 6"/>')
  };
  var CARET_SVG = '<svg class="mcard-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6"/></svg>';

  /* the heat-picker card set. Labels are DISPLAY-ONLY; the engine keeps D.currentSystems[id].label.
   * No two cards share a glyph. 'vetinte' is a UI-only quiet card (not in D.currentSystems). */
  var HEAT_CARDS = [
    { id: 'direktel',      icon: 'bolt',     label: 'Direktel',        group: 'primary' },
    { id: 'vattenburenEl', icon: 'dropbolt', label: 'Vattenburen el',  group: 'primary' },
    { id: 'olja',          icon: 'flame',    label: 'Oljepanna',       group: 'primary' },
    { id: 'vedpellets',    icon: 'pellets',  label: 'Ved / pellets',   group: 'primary' },
    { id: 'franluft',      icon: 'wind',     label: 'Frånluftspump',   group: 'primary' },
    { id: 'fjarrvarme',    icon: 'building', label: 'Fjärrvärme',      group: 'primary' },
    { id: 'vetinte',       icon: null,       label: 'Vet inte',        group: 'primary', quiet: true },
    { id: 'luftluftCur',   icon: 'ac',       label: 'Luft-luft',       group: 'complement' },
    { id: 'luftvattenCur', icon: 'droplet',  label: 'Luft-vatten',     group: 'complement' },
    { id: 'bergvarmeCur',  icon: 'mountain', label: 'Bergvärme',       group: 'complement' },
    { id: 'kamin',         icon: 'hearth',   label: 'Braskamin',       group: 'complement' }
  ];
  function shortLabel(id) {
    for (var i = 0; i < HEAT_CARDS.length; i++) if (HEAT_CARDS[i].id === id) return HEAT_CARDS[i].label;
    return (D.currentSystems[id] && D.currentSystems[id].label) || id;
  }

  /* warm (kamin) tones get the amber-scoped fan fill; everything else is a cool slate
   * (dead-but-referenced by the frozen drawChart — do not delete) */
  function fanFill(id, isPrimary) {
    if (id === 'kamin') return 'var(--fan-kamin)';
    if (isPrimary) return 'var(--fan-primary)';
    return 'rgba(111,123,176,.20)';
  }
  function fanStroke(id, isPrimary) {
    if (id === 'kamin') return 'rgba(240,180,41,.55)';
    if (isPrimary) return '#8b95bd';
    return '#6f7bb0';
  }

  /* ---------- selection state for the custom controls (B2R §5.2) ---------- */
  var state = {
    priceArea: D.defaultPriceArea,
    era: 'x',                     // 'x' = Vet inte (default active) → midcentury, assumed
    eraTouched: false,
    distribution: D.defaultDistribution,
    overrideUnit: 'cost',         // 'cost' | 'kwh' — kr/år is the default unit
    heat: {},                     // { systemId: { on:bool, stop:int (index), assumed:bool } }
    vetinte: false,               // the "Vet inte" heat card is active
    vb: 'auto',                   // 'auto' | 'ja' | 'nej' | 'vetinte' (waterborne seg)
    seTouched: false,
    open: [],                     // expanded mcard ids (preserved across recomputes)
    fanOpen: false                // stays false forever (frozen drawChart branch)
  };
  // seed the single default primary so the tool renders a real answer on first paint
  state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true };

  var userTouched = false, booted = false;
  var lastRank = null, lastResult = null, bestResults = null;
  var overrideTypedFired = false;

  /* ---------- waterborne auto-inference (frozen once touched) ---------- */
  var VB_INFER = {
    vattenburenEl: 'ja', olja: 'ja', fjarrvarme: 'ja', luftvattenCur: 'ja', bergvarmeCur: 'ja',
    vedpellets: 'ja',   /* [GAP-L1] electrician signs */
    direktel: 'nej', franluft: 'nej', luftluftCur: 'nej', kamin: 'nej'
  };
  function inferredVb() {
    var sel = heatSelection();
    return VB_INFER[sel.primary] || 'nej';
  }
  function effectiveVb() { return state.vb === 'auto' ? inferredVb() : state.vb; }
  function syncVbSeg() {
    var box = $('#vbSeg'); if (!box) return;
    var eff = effectiveVb();
    el('button', box).forEach(function (b) {
      var on = b.dataset.value === eff;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    var onBtn = $('button.on', box);
    if (onBtn) movePill(box, onBtn);
    var asm = $('#vbAsm'); if (asm) asm.hidden = state.vb !== 'auto';
  }

  /* ---------- populate the dynamic inputs once ---------- */
  function buildInputs() {
    // elområde segmented (demoted into the reveal; (antagande) until touched)
    buildSeg('#priceAreaSeg', Object.keys(D.priceAreas).map(function (id) {
      return { v: id, label: D.priceAreas[id].label };
    }), 'priceArea', function () {
      state.seTouched = true;
      var a = $('#seAsm'); if (a) a.hidden = true;
      recompute();
    });

    // byggår segmented — 5 gap-free bands incl "Vet inte" (default active)
    buildSeg('#eraSeg', ERA_ITEMS, 'era', function (v) {
      state.eraTouched = (v !== 'x');
      var a = $('#eraAsm'); if (a) a.hidden = (v !== 'x');
      recompute();
    });

    // värmedistribution segmented (display labels only)
    buildSeg('#distSeg', Object.keys(D.framledning).map(function (id) {
      return { v: id, label: DIST_LABELS[id] || id };
    }), 'distribution');

    // override unit switch — kr/år FIRST and default
    buildSeg('#overrideUnitSeg', [
      { v: 'cost', label: 'kr/år' },
      { v: 'kwh',  label: 'kWh' }
    ], 'overrideUnit', onUnitChange);

    // vattenburet seg — Ja / Nej / Vet inte with auto-inference while untouched
    buildSeg('#vbSeg', [
      { v: 'ja', label: 'Ja' }, { v: 'nej', label: 'Nej' }, { v: 'vetinte', label: 'Vet inte' }
    ], 'vb', function () {
      var a = $('#vbAsm'); if (a) a.hidden = true;
      recompute();
    });

    // DSO select
    var dsoSel = $('#dsoField');
    Object.keys(D.dsoEffektavgift).forEach(function (id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = DSO_LABELS[id] || id;
      dsoSel.appendChild(o);
    });

    buildHeatCards();
    syncCards();
    renderShareRows();
    requestAnimationFrame(syncVbSeg);
  }

  /* ========================================================================
   * LEFT — the icon multi-select heat picker (+ the Vet inte quiet card)
   * ====================================================================== */
  function buildHeatCards() {
    var grid = $('#hpGrid'); if (!grid) return;
    grid.innerHTML = '';
    var complementDividerDone = false;
    HEAT_CARDS.forEach(function (card) {
      // only render cards for systems that exist in the data layer (vetinte is UI-only)
      if (!card.quiet && !D.currentSystems[card.id]) return;
      if (card.group === 'complement' && !complementDividerDone) {
        var sub = document.createElement('div');
        sub.className = 'hp-subhead'; sub.textContent = 'Värmer något mer?';
        grid.appendChild(sub);
        complementDividerDone = true;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hp-card' + (card.quiet ? ' hp-card--quiet' : '');
      b.dataset.sys = card.id;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = card.quiet
        ? '<span class="hp-lbl">' + card.label + '</span>'
        : '<span class="hp-ic" aria-hidden="true">' + ICONS[card.icon] + '</span>' +
          '<span class="hp-lbl">' + card.label + '</span>' +
          '<span class="hp-check" aria-hidden="true">' + ICONS.check + '</span>';
      b.addEventListener('click', function () { toggleCard(card.id); });
      grid.appendChild(b);
    });
  }

  function toggleCard(id) {
    if (id === 'vetinte') {
      // clear everything, count conservatively on direktel until the visitor knows more
      Object.keys(state.heat).forEach(function (k) { if (state.heat[k]) state.heat[k].on = false; });
      state.heat.direktel = { on: true, stop: DEFAULT_STOP, assumed: true };
      state.vetinte = true;
      setHint(S.hintVetinte);
      track('vetinte_used');
      syncCards(); renderShareRows(); syncVbSeg();
      forceChartDraw = true;
      recompute();
      return;
    }

    // any real card tap clears the vet-inte state (and its conservative default)
    if (state.vetinte) {
      state.vetinte = false;
      setHint('');
      Object.keys(state.heat).forEach(function (k) { if (state.heat[k]) state.heat[k].on = false; });
    }

    var isPrice = !!(D.currentSystems[id] && D.currentSystems[id].isPrice); // fjärrvärme
    var wasOn = !!(state.heat[id] && state.heat[id].on);

    if (!wasOn) {
      // fjärrvärme is single-select: turning it on clears everything else
      if (isPrice) {
        Object.keys(state.heat).forEach(function (k) { if (state.heat[k]) state.heat[k].on = false; });
        setHint(S.hintFjarr);
      } else {
        // turning any other system on clears an active fjärrvärme
        Object.keys(state.heat).forEach(function (k) {
          if (state.heat[k] && state.heat[k].on && D.currentSystems[k] && D.currentSystems[k].isPrice) {
            state.heat[k].on = false;
          }
        });
        setHint('');
      }
      state.heat[id] = { on: true, stop: DEFAULT_STOP, assumed: true };
      track('heat_select', { sys: id });
    } else {
      state.heat[id].on = false;
      // never allow an empty selection: fall back to the default primary
      var anyOn = Object.keys(state.heat).some(function (k) { return state.heat[k].on; });
      if (!anyOn) {
        state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true };
        setHint('');
      }
    }
    syncCards();
    renderShareRows();
    syncVbSeg();               // vb re-inference while state.vb === 'auto'
    forceChartDraw = true;
    recompute();
  }

  function setHint(msg) {
    var h = $('#hpHint'); if (!h) return;
    if (msg) { h.textContent = msg; h.hidden = false; } else { h.textContent = ''; h.hidden = true; }
  }

  /* reflect selection + the derived primary marker onto the cards */
  function syncCards() {
    var sel = heatSelection();
    el('.hp-card').forEach(function (c) {
      var id = c.dataset.sys;
      var on = (id === 'vetinte')
        ? state.vetinte
        : (!state.vetinte && !!(state.heat[id] && state.heat[id].on));
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      c.classList.toggle('is-primary', on && id === sel.primary && sel.multi);
    });
  }

  /* THE derivation — produces the identical engine contract as before.
   * primary = the selected card with the largest share stop (ties broken by data order). */
  function heatSelection() {
    var on = Object.keys(state.heat).filter(function (id) { return state.heat[id].on; });
    if (!on.length) return { primary: D.defaultCurrentSystem, complements: [], multi: false };
    if (on.length === 1) return { primary: on[0], complements: [], multi: false };
    var order = Object.keys(D.currentSystems);
    var sorted = on.slice().sort(function (a, b) {
      var d = state.heat[b].stop - state.heat[a].stop;      // higher stop first
      return d !== 0 ? d : order.indexOf(a) - order.indexOf(b); // stable by data order
    });
    var primary = sorted[0];
    var complements = sorted.slice(1).map(function (id) {
      var h = state.heat[id]; var row = { system: id };
      if (!h.assumed) row.coverage = SHARE_STOPS[h.stop];    // assumed → omit → engine fills + tags isAssumed
      return row;
    });
    return { primary: primary, complements: complements, multi: true };
  }

  /* per-complement share rows: one seg per SELECTED card, only when 2+ are on.
   * Rows are inserted BEFORE the #hpSummary line (static head + summary stay). */
  function renderShareRows() {
    var box = $('#hpShares'); if (!box) return;
    var summary = $('#hpSummary');
    var sel = heatSelection();
    if (!sel.multi || state.vetinte) {
      el('.hp-share-row', box).forEach(function (row) { row.remove(); });
      box.hidden = true;
      return;
    }
    box.hidden = false;

    var active = Object.keys(state.heat).filter(function (id) { return state.heat[id].on; });
    var order = Object.keys(D.currentSystems);
    active.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });

    // remove rows for cards no longer on
    el('.hp-share-row', box).forEach(function (row) {
      if (active.indexOf(row.dataset.sys) === -1) row.remove();
    });
    active.forEach(function (id) {
      if ($('.hp-share-row[data-sys="' + id + '"]', box)) { updateShareRowTag(id); return; }
      var rec = D.currentSystems[id];
      var c = state.heat[id];
      var card = HEAT_CARDS.filter(function (x) { return x.id === id; })[0];
      var row = document.createElement('div');
      row.className = 'hp-share-row'; row.dataset.sys = id;
      var inner = document.createElement('div'); inner.className = 'hp-share-inner';
      var name = document.createElement('div'); name.className = 'hp-share-name';
      name.innerHTML = '<span>' + (card && card.icon ? ICONS[card.icon] : '') +
        (card ? card.label : rec.label) + '</span><span class="antag"' + (c.assumed ? '' : ' hidden') + '>(antagande)</span>';
      var seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'radiogroup');
      seg.setAttribute('aria-label', 'Hur mycket ' + (card ? card.label : rec.label).toLowerCase() + ' värmer');
      inner.appendChild(name); inner.appendChild(seg);
      row.appendChild(inner);
      box.insertBefore(row, summary);
      buildShareSeg(seg, id);
      requestAnimationFrame(function () { row.classList.add('in'); setTimeout(replaceAllPills, REDUCED ? 0 : 60); });
    });
    // the primary card can flip when a share changes → refresh markers each pass
    syncCards();
  }

  function updateShareRowTag(id) {
    var row = $('.hp-share-row[data-sys="' + id + '"]'); if (!row) return;
    var antag = $('.antag', row); if (antag) antag.hidden = !state.heat[id].assumed;
  }

  function buildShareSeg(seg, id) {
    var c = state.heat[id];
    SHARE_LABELS.forEach(function (lbl, idx) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = lbl; b.dataset.stop = idx;
      b.setAttribute('role', 'radio');
      var isOn = (idx === c.stop);
      if (isOn) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); } else b.setAttribute('aria-checked', 'false');
      b.tabIndex = isOn ? 0 : -1;
      b.addEventListener('click', function () { pickShare(seg, id, idx); });
      seg.appendChild(b);
    });
    var pill = document.createElement('span'); pill.className = 'seg-pill'; pill.setAttribute('aria-hidden', 'true');
    seg.appendChild(pill);
    segBoxes.push(seg);
    wireRovingKeys(seg);
    requestAnimationFrame(function () {
      var prev = pill.style.transition; pill.style.transition = 'none';
      movePill(seg, $('button.on', seg) || $('button', seg));
      pill.getBoundingClientRect();
      requestAnimationFrame(function () { pill.style.transition = prev; });
    });
  }

  function pickShare(seg, id, idx) {
    var c = state.heat[id]; c.stop = idx; c.assumed = false;  // user touched it
    el('button', seg).forEach(function (x) {
      var on = +x.dataset.stop === idx;
      x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
    });
    movePill(seg, $('button.on', seg));
    updateShareRowTag(id);
    syncCards();   // a share change can move which card is primary
    syncVbSeg();   // the primary flip can change the vb inference
    forceChartDraw = true;
    recompute();
  }

  /* ---------- override unit switch ---------- */
  function onUnitChange(v) {
    state.overrideUnit = v;
    var f = $('#annualKwhField');
    f.placeholder = (v === 'kwh') ? 't.ex. 20 000' : 't.ex. 28 000';
    f.max = (v === 'kwh') ? 120000 : 200000;
    forceChartDraw = true;
    recompute();
  }

  /* override note — three states + cleared ([GAP-L3] thresholds 60 000 kWh / 120 000 kr) */
  function updateOverrideNote() {
    var note = $('#overrideNote'); if (!note) return;
    var raw = $('#annualKwhField').value;
    if (!raw) { note.hidden = true; note.textContent = ''; return; }
    var num = +raw;
    var isKwh = state.overrideUnit === 'kwh';
    if (!isFinite(num) || num <= 0) {
      note.textContent = 'Skriv siffran i ' + (isKwh ? 'kWh' : 'kr') + ' per år.';
    } else if ((isKwh && num > 60000) || (!isKwh && num > 120000)) {
      note.textContent = S.ownHigh;
    } else {
      note.textContent = S.ownOk;
    }
    note.hidden = false;
  }

  var segBoxes = [];   // registry for the resize re-place of every sliding pill

  function buildSeg(sel, items, key, onPick) {
    var box = $(sel); if (!box) return;
    var activeBtn = null;
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = it.label; b.dataset.value = it.v;
      b.setAttribute('role', 'radio');
      var isOn = (it.v === state[key]);
      if (isOn) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); activeBtn = b; }
      else b.setAttribute('aria-checked', 'false');
      b.tabIndex = isOn ? 0 : -1;
      b.addEventListener('click', function () {
        state[key] = it.v;
        el('button', box).forEach(function (x) {
          var sel2 = x === b;
          x.classList.toggle('on', sel2); x.setAttribute('aria-checked', sel2 ? 'true' : 'false'); x.tabIndex = sel2 ? 0 : -1;
        });
        movePill(box, b);
        forceChartDraw = true;
        if (onPick) onPick(it.v); else recompute();
      });
      box.appendChild(b);
    });
    // the single teal surface: a pill that translates under the active option
    var pill = document.createElement('span');
    pill.className = 'seg-pill'; pill.setAttribute('aria-hidden', 'true');
    box.appendChild(pill);
    segBoxes.push(box);
    wireRovingKeys(box);
    requestAnimationFrame(function () {
      var prev = pill.style.transition; pill.style.transition = 'none';
      movePill(box, activeBtn || $('button.on', box) || $('button', box));
      pill.getBoundingClientRect();
      requestAnimationFrame(function () { pill.style.transition = prev; });
    });
  }

  /* roving-tabindex arrow-key nav (ARIA APG) for every segmented radiogroup */
  function wireRovingKeys(box) {
    box.addEventListener('keydown', function (e) {
      var btns = el('button', box); if (!btns.length) return;
      var cur = btns.indexOf(document.activeElement);
      if (cur < 0) cur = btns.findIndex ? btns.findIndex(function (b) { return b.classList.contains('on'); }) : 0;
      var next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(btns.length - 1, cur + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, cur - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = btns.length - 1;
      if (next < 0) return;
      e.preventDefault();
      btns[next].focus();
      btns[next].click();
    });
  }

  function movePill(box, btn) {
    if (!box || !btn) return;
    var pill = $('.seg-pill', box); if (!pill) return;
    pill.style.width = btn.offsetWidth + 'px';
    pill.style.height = btn.offsetHeight + 'px';
    pill.style.transform = 'translate(' + btn.offsetLeft + 'px,' + btn.offsetTop + 'px)';
  }

  function replaceAllPills() {
    segBoxes.forEach(function (box) {
      if (!box.isConnected) return;
      var on = $('button.on', box); if (!on) return;
      var pill = $('.seg-pill', box); if (!pill) return;
      var prev = pill.style.transition; pill.style.transition = 'none';
      movePill(box, on);
      pill.getBoundingClientRect();
      pill.style.transition = prev;
    });
  }

  /* ---------- read the live inputs → the multi-system model ---------- */
  function getInputs() {
    var sel = heatSelection();

    // the override: one typed field, interpreted by the unit switch
    var raw = $('#annualKwhField').value;
    var num = raw ? +raw : null;
    var actual = { mode: null, kwh: null, cost: null };
    if (num != null && isFinite(num) && num > 0) {
      if (state.overrideUnit === 'kwh') { actual.mode = 'kwh'; actual.kwh = num; }
      else { actual.mode = 'cost'; actual.cost = num; }
    }

    return {
      current: { primary: sel.primary, complements: sel.complements, actual: actual },
      area: +$('#areaSlider').value,
      priceArea: state.priceArea,
      occupants: +$('#occupantsField').value,
      era: state.era === 'x' ? 'midcentury' : state.era,     // Vet inte → conservative middle
      indoorTemp: +$('#tempSlider').value,
      distribution: state.distribution,
      hasWaterborne: effectiveVb() === 'ja',                 // Nej AND Vet inte → false (conservative)
      dso: $('#dsoField').value,
      hasSolar: $('#solarField').checked
    };
  }

  /* ========================================================================
   * RENDER — rank once, render the four beats
   * ====================================================================== */
  var forceChartDraw = false;   // curve entrance choreography gate (method lazy-draw)
  var forceBarDraw = false;     // dead flag kept for parity (bar block deleted)

  function firstTouch(silent) {
    if (userTouched) return;
    userTouched = true;
    document.body.classList.add('has-msum');
    var m = $('#msum'); if (m) m.classList.add('on');
    msumSync();
    var tb = $('#typBadge');
    if (tb) {
      if (REDUCED || silent) { tb.hidden = true; }
      else { tb.classList.add('out'); setTimeout(function () { tb.hidden = true; }, 200); }
    }
    if (!silent) track('calc_first_touch');
  }

  function recompute() {
    var inp = getInputs();
    var R = RANK.rankOptions(inp, D);
    lastRank = R;
    lastResult = R.baseline.results;
    var best = bestOption(R);
    bestResults = (best && best.results) ? best.results : R.baseline.results;
    if (booted && !userTouched) firstTouch(false);
    render(R);
  }

  function render(R) {
    renderAnchor(R);
    renderStorybar(R);
    renderNotes(R);
    renderVerdict(R);
    renderLadder(R);
    renderUpside(R.baseline.results);
    renderCta(R);
    renderMsum(R);
    renderHpSummary(R);
    updateOverrideNote();

    // complement cap note (engine clamp surfaced, never silent)
    var capNote = $('#complementCapNote');
    if (capNote) capNote.hidden = !R.baseline.results.ctx.complementClamped;

    // methodology + foot + placeholder
    $('#methodBody').innerHTML = methodHtml(R);
    $('#placeholderNote').textContent = D.meta.placeholderNote;
    $('#foot').textContent = S.foot;

    // the curve lives in the method now — redraw only while open
    var method = $('.method');
    if (method && method.open) {
      drawChart(bestResults, forceChartDraw);
      forceChartDraw = false;
      setChartCap();
    }

    announceResult(R);
    checkStickyIntegrity();
  }

  function peakMonth(arr) { var mi = 0, mv = -1; for (var i = 0; i < 12; i++) if (arr[i] > mv) { mv = arr[i]; mi = i; } return mi; }
  function monthLong(i) { return D.monthsLong[i]; }

  /* ---------- best option + display names ---------- */
  function bestOption(R) {
    if (!R.verdict.bestOptionId) return null;
    for (var i = 0; i < R.options.length; i++) if (R.options[i].id === R.verdict.bestOptionId) return R.options[i];
    return null;
  }
  function verdictName(o) {
    if (!o) return '';
    if (o.id === 'luftvatten') return 'luft-vatten';
    if (o.id === 'bergvarme') return 'bergvärme';
    if (o.id === 'luftluft') return 'luft-luft som komplement';
    if (o.id === 'styrning') return 'smart styrning';
    if (o.kind === 'combo') return o.label.toLowerCase();
    return (o.label || o.id).toLowerCase();
  }
  function cardName(o) {
    if (o.id === 'luftluft') {
      var prim = shortLabel(heatSelection().primary).toLowerCase();
      return 'Behåll ' + prim + ' och komplettera med luft-luft';
    }
    return S.cardName[o.id] || o.label;
  }

  /* ---------- B. the anchor = DAGENS kostnad (heat + vv; household is bar-only) ---------- */
  function anchorVals(R) {
    var measured = !!R.baseline.demandMeasured;
    var sp = measured ? 0 : D.demandSpread;
    var base = R.baseline.spaceCost + R.baseline.vvCost;   // ≡ the heat+vv legend sum
    return {
      single: sp === 0,
      lo: Math.max(0, roundTo(base * (1 - sp), ROUND.hero)),
      hi: Math.max(0, roundTo(base * (1 + sp), ROUND.hero)),
      mid: Math.max(0, roundTo(base, ROUND.hero))
    };
  }
  function anchorText(av) { return '~' + (av.single ? nf(av.mid) : nf(av.lo) + '-' + nf(av.hi)); }

  function renderAnchor(R) {
    var av = anchorVals(R);
    var num = $('#anchorNum');
    num.innerHTML = anchorText(av) + ' <span class="anchor-per">kr per år</span>';
    // a 1-frame opacity touch only (never translate, never count up)
    if (!REDUCED) {
      num.classList.add('flash');
      requestAnimationFrame(function () { num.classList.remove('flash'); });
    }
    $('#ownBadge').hidden = !R.baseline.overrideMode;
  }

  /* ---------- C. the story bar (min rendered segment 6 %; the LEGEND is the accessible truth) ---------- */
  function segWidths(vals, minPct) {
    var tot = 0; vals.forEach(function (v) { tot += Math.max(0, v); });
    if (tot <= 0) return vals.map(function () { return (100 / vals.length).toFixed(2); });
    var raw = vals.map(function (v) { return 100 * Math.max(0, v) / tot; });
    var deficit = 0, flexSum = 0;
    raw.forEach(function (p) { if (p < minPct) deficit += (minPct - p); else flexSum += (p - minPct); });
    return raw.map(function (p) {
      var out = (p < minPct) ? minPct : (p - (flexSum > 0 ? deficit * (p - minPct) / flexSum : 0));
      return out.toFixed(2);
    });
  }

  function renderStorybar(R) {
    var heat = R.baseline.spaceCost, vv = R.baseline.vvCost, house = R.baseline.householdCost;
    var w = segWidths([heat, vv, house], 6);
    var bar = $('#storyBar');
    $('.sb-heat', bar).style.width = w[0] + '%';
    $('.sb-vv', bar).style.width = w[1] + '%';
    $('.sb-house', bar).style.width = w[2] + '%';
    $('#sbHeatKr').textContent = '~' + krStr(heat, ROUND.stat);
    $('#sbVvKr').textContent = '~' + krStr(vv, ROUND.stat);
    $('#sbHouseKr').textContent = '~' + krStr(house, ROUND.stat);

    // multi-system split line (from the ENGINE's own breakdown, never re-derived)
    var mix = $('#sbMix');
    var bd = R.baseline.breakdown || [];
    if (bd.length > 1) {
      mix.textContent = bd.map(function (b) {
        return shortLabel(b.id) + ' ' + pct(b.share) + (b.isAssumed ? ' (antagande)' : '');
      }).join(' · ');
      mix.hidden = false;
    } else {
      mix.textContent = ''; mix.hidden = true;
    }
  }

  /* ---------- pre-touch primer / spann-note / badges (mutually exclusive) ---------- */
  function anyAssumed() {
    if (state.vetinte || state.era === 'x' || state.vb === 'auto' || !state.seTouched) return true;
    var sel = heatSelection();
    if (sel.multi) {
      var ids = Object.keys(state.heat);
      for (var i = 0; i < ids.length; i++) {
        if (state.heat[ids[i]].on && state.heat[ids[i]].assumed) return true;
      }
    }
    return false;
  }

  function renderNotes(R) {
    var bn = $('#bandNote');
    if (!userTouched) {
      $('#typBadge').hidden = false;
      bn.textContent = S.primer; bn.hidden = false;
      return;
    }
    $('#typBadge').hidden = true;
    if (anyAssumed() && !R.baseline.demandMeasured) {
      bn.textContent = S.bandNote; bn.hidden = false;
    } else {
      bn.hidden = true;
    }
  }

  /* ---------- D. the verdict sentence (plate) ---------- */
  function renderVerdict(R) {
    var v = $('#verdict'), br = R.verdict.branch;
    if (br !== 'standard') { v.textContent = S.verdict[br] || ''; return; }
    var o = bestOption(R);
    if (!o) { v.textContent = S.verdict.litenBesparing; return; }
    var lo = Math.max(0, roundTo(o.saving[0], ROUND.hero));
    var hi = Math.max(0, roundTo(o.saving[2], ROUND.hero));
    var range = (lo === hi) ? nf(hi) + ' kr' : nf(lo) + '-' + nf(hi) + ' kr';
    var html = 'För ett hus som ditt ser <b>' + esc(verdictName(o)) + '</b> ut som den rimligaste vägen. ' +
               'Ungefär <b>' + range + '</b> lägre per år';
    if (o.paybackLow != null && o.paybackHigh != null) {
      var pa = roundTo(o.paybackLow, ROUND.payback), pb = roundTo(o.paybackHigh, ROUND.payback);
      html += ', återbetalt på ' + (pa === pb ? yrStr(pa) : yrStr(pa) + '-' + yrStr(pb)) + ' år.';
    } else {
      html += '.';
    }
    v.innerHTML = html;
  }

  /* ========================================================================
   * E. ÅTGÄRDSSTEGEN — rung-grouped, ranked, greyed WITH reason, never hidden
   * ====================================================================== */
  function safeId(id) { return String(id).replace(/[^\w-]/g, ''); }

  /* branch-scoped visibility; max 5 cards */
  function visibleOptions(R) {
    var br = R.verdict.branch, out = [];
    R.options.forEach(function (o) {
      // M3: every option renders on every branch — ineligible/zero-saving pumps show
      // greyed WITH their reason ("Vi visar siffran som jämförelse, inte som råd"),
      // never hidden. br kept for future branch-scoped ordering.
      void br;
      out.push(o);
    });
    return out.slice(0, 5);
  }

  /* rank numbers: payback order across eligible numeric options; pinned behåll = 1 */
  function rankNumbers(R, visible) {
    var map = {};
    var pinned = R.verdict.behallFirst;
    var ranked = visible.filter(function (o) {
      return o.eligible && o.numeric !== false && (o.kind === 'replace' || o.kind === 'complement' || o.kind === 'combo');
    }).sort(function (a, b) {
      var pa = (a.paybackMid == null) ? Infinity : a.paybackMid;
      var pb = (b.paybackMid == null) ? Infinity : b.paybackMid;
      return pa - pb;
    });
    var n = pinned ? 1 : 0;
    if (pinned) map.behall = 1;
    ranked.forEach(function (o) { n += 1; map[o.id] = n; });
    return map;
  }

  function pickCaveat(o) {
    if (!o.eligible && o.ineligibleReason) return S.reason[o.ineligibleReason] || null;
    if (o.id === 'behall') return S.caveat.behall;
    if (o.kind === 'styrning') return S.caveat.styrning;
    if (o.flags && o.flags.waterborneAdder) return S.caveat.vattenburet;
    if (o.flags && o.flags.priceComparison) return S.caveat.pris;   /* QA gate c: fjärrvärme → pris on pump rows */
    if (o.kind === 'complement') return S.caveat.servedShare;
    if (o.results && o.results.ctx && o.results.ctx.isGround) return S.caveat.viaPartner;
    if (o.caveats && o.caveats.indexOf('vinterSagMedISiffran') !== -1) return S.caveat.vinterSag;
    return null;
  }

  function pairHtml(o, R) {
    var today = R.baseline.currentAnnual;
    if (!(today > 0) || o.futureAnnualLow == null) return '';
    var loCost = o.futureAnnualLow, hiCost = o.futureAnnualHigh;
    var wAfter = clamp(100 * loCost / today, 0, 100);
    var wBand = clamp(100 * (Math.min(hiCost, today) - loCost) / today, 0, 100 - wAfter);
    var name = cardName(o);
    var aria = 'I dag cirka ' + nf(roundTo(today, ROUND.stat)) + ' kronor per år, med ' +
               name.toLowerCase() + ' cirka ' + nf(Math.max(0, roundTo(loCost, ROUND.stat))) +
               ' till ' + nf(Math.max(0, roundTo(hiCost, ROUND.stat))) + ' kronor per år';
    return '' +
      '<div class="pair" role="img" aria-label="' + esc(aria) + '">' +
        '<div class="pair-row">' +
          '<span class="pair-lbl">i dag</span>' +
          '<span class="pair-track"><span class="pair-fill pair-today" style="width:100%"></span></span>' +
          '<span class="pair-val">~' + krStr(today, ROUND.stat) + '</span>' +
        '</div>' +
        '<div class="pair-row">' +
          '<span class="pair-lbl">efter</span>' +
          '<span class="pair-track">' +
            '<span class="pair-fill pair-after" style="width:' + wAfter.toFixed(1) + '%"></span>' +
            '<span class="pair-band" style="left:' + wAfter.toFixed(1) + '%;width:' + wBand.toFixed(1) + '%"></span>' +
          '</span>' +
          '<span class="pair-val">' + krRange(loCost, hiCost, ROUND.stat) + '</span>' +
        '</div>' +
      '</div>';
  }

  function factsHtml(o) {
    if (o.id === 'behall' || o.numeric === false || !o.saving) return '';
    var rows = '';
    rows += '<div><dt>' + esc(S.facts.save) + '</dt><dd>' +
            esc(krRange(o.saving[0], o.saving[2], ROUND.stat) + ' per år') + '</dd></div>';
    if (o.netInvest && (o.netInvest[0] > 0 || o.netInvest[1] > 0)) {
      var iLo = roundTo(o.netInvest[0], ROUND.stat), iHi = roundTo(o.netInvest[1], ROUND.stat);
      var iTxt = (iLo === iHi) ? 'ca ' + nf(iLo) + ' kr' : 'ca ' + nf(iLo) + '-' + nf(iHi) + ' kr';
      if (o.kind !== 'styrning') iTxt += S.investRot;   /* styrning: laborShare null ⇒ no ROT claimed */
      rows += '<div><dt>' + esc(S.facts.invest) + '</dt><dd>' + esc(iTxt) + '</dd></div>';
    }
    var pTxt;
    if (o.paybackLow != null && o.paybackHigh != null) {
      var pa = roundTo(o.paybackLow, ROUND.payback), pb = roundTo(o.paybackHigh, ROUND.payback);
      pTxt = 'på ungefär ' + (pa === pb ? yrStr(pa) : yrStr(pa) + '-' + yrStr(pb)) + ' år';
    } else if (o.paybackMid != null) {
      pTxt = 'på ungefär ' + yrStr(roundTo(o.paybackMid, ROUND.payback)) + ' år';
    } else {
      pTxt = EMPTY;                                     /* the ONE sanctioned em-dash: null payback */
    }
    rows += '<div><dt>' + esc(S.facts.payback) + '</dt><dd>' + esc(pTxt) + '</dd></div>';
    return '<dl class="mcard-facts">' + rows + '</dl>';
  }

  function cardBodyHtml(o, R) {
    var html = '';
    if (o.id === 'behall') {
      html += '<p class="mcard-caveat">' + esc(S.caveat.behall) + '</p>';
      return html;
    }
    if (o.kind === 'styrning' && o.numeric === false) {
      /* QUALITATIVE until [GAP-V4-2] signs: no pair, no kr, ever */
      html += '<p class="mcard-note">' + esc(S.styrningBody) + '</p>';
      html += '<p class="mcard-caveat">' + esc(pickCaveat(o) || S.caveat.styrning) + '</p>';
      return html;
    }
    html += pairHtml(o, R);
    html += factsHtml(o);
    var cav = pickCaveat(o);
    if (cav) html += '<p class="mcard-caveat">' + esc(cav) + '</p>';
    if (o.caveats && D.combi && o.caveats.indexOf(D.combi.spetsSentenceKey) !== -1) {
      html += '<p class="mcard-note">' + esc(S.kaminSpets) + '</p>';   /* [GAP-V4-6] the spets sentence */
    }
    return html;
  }

  function headSaveText(o) {
    if (o.id === 'behall' || o.numeric === false || !o.saving) return '';
    if (!(o.saving[2] > 0)) return '0 kr';
    return krRange(o.saving[0], o.saving[2], ROUND.hero);
  }

  function buildCard(o, R, rankNo, expanded) {
    var art = document.createElement('article');
    art.className = 'mcard' + (o.eligible ? '' : ' mcard--off');
    art.dataset.measure = o.id;
    var bodyId = 'mcard-' + safeId(o.id);
    var pinnedKeep = (o.id === 'behall' && R.verdict.behallFirst);
    var saveTxt = headSaveText(o);
    var rankHtml = (rankNo != null)
      ? '<span class="mcard-rank' + (pinnedKeep ? ' mcard-rank--keep' : '') + '">' + rankNo + '</span>'
      : '<span class="mcard-rank' + (pinnedKeep ? ' mcard-rank--keep' : '') + '" aria-hidden="true">·</span>';
    art.innerHTML =
      '<button type="button" class="mcard-head" aria-expanded="' + (expanded ? 'true' : 'false') + '" aria-controls="' + bodyId + '">' +
        rankHtml +
        '<span class="mcard-name">' + esc(cardName(o)) + '</span>' +
        '<span class="mcard-save' + (saveTxt && saveTxt !== '0 kr' ? '' : ' mcard-save--none') + '">' +
          esc(saveTxt ? saveTxt + ' lägre' : '') + '</span>' +
        CARET_SVG +
      '</button>' +
      '<div class="mcard-bwrap' + (expanded ? ' open' : '') + '">' +
        '<div class="mcard-body" id="' + bodyId + '">' + cardBodyHtml(o, R) + '</div>' +
      '</div>';
    var head = $('.mcard-head', art), bwrap = $('.mcard-bwrap', art);
    head.addEventListener('click', function () {
      var open = head.getAttribute('aria-expanded') !== 'true';
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      bwrap.classList.toggle('open', open);
      var i = state.open.indexOf(o.id);
      if (open && i === -1) { state.open.push(o.id); track('option_expand', { id: o.id }); }
      if (!open && i !== -1) state.open.splice(i, 1);
    });
    return art;
  }

  function renderLadder(R) {
    var box = $('#ladder');
    box.innerHTML = '';
    var visible = visibleOptions(R);
    var ranks = rankNumbers(R, visible);

    /* default expanded card, ONCE: pinned behåll on the honest branches, else the ranked #1 */
    if (!state.open.length && !renderLadder.__openInit) {
      renderLadder.__openInit = true;
      state.open = [R.verdict.behallFirst ? 'behall' : (R.verdict.bestOptionId || (visible[0] && visible[0].id))].filter(Boolean);
    }

    /* group by rung, preserving rank.js order (behåll pinning included) */
    var groups = [];
    visible.forEach(function (o) {
      var ri = (o.rungIndex != null) ? o.rungIndex : 0;
      var g = groups.length && groups[groups.length - 1].ri === ri ? groups[groups.length - 1] : null;
      if (!g) { g = { ri: ri, rung: o.rung || R.rungs[ri], cards: [] }; groups.push(g); }
      g.cards.push(o);
    });

    groups.forEach(function (g) {
      var h = document.createElement('h3');
      h.className = 'rung';
      h.textContent = (g.rung && g.rung.label) || '';
      box.appendChild(h);

      var wrap = document.createElement('div');
      wrap.className = 'rung-group';
      wrap.dataset.rung = g.ri;
      g.cards.forEach(function (o) {
        wrap.appendChild(buildCard(o, R, ranks[o.id] != null ? ranks[o.id] : null,
          state.open.indexOf(o.id) !== -1));
      });
      box.appendChild(wrap);
    });
  }

  /* ---------- F. upside rows (labelled; block always renders, rows conditional) ---------- */
  function renderUpside(r) {
    var box = $('#upsideRows'); box.innerHTML = '';
    r.upside.rows.forEach(function (row) {
      var d = document.createElement('div'); d.className = 'urow';
      var left = document.createElement('div'); left.className = 'ut';
      var tier = document.createElement('span'); tier.className = 'utier ' + row.tier; tier.textContent = TIER_LABEL[row.tier] || '';
      var name = document.createElement('span'); name.textContent = UPSIDE_LABEL[row.key] || row.label;
      left.appendChild(tier); left.appendChild(name);
      var v = document.createElement('span'); v.className = 'uv' + (row.tier === 'atrisk' ? ' soft' : '');
      v.textContent = '+ ' + krStr(row.value, 100) + '/år';
      d.appendChild(left); d.appendChild(v);
      box.appendChild(d);
    });
    if (!r.upside.hasSolar) {
      var hint = document.createElement('div'); hint.className = 'upside-soft';
      hint.textContent = S.solarHint;
      box.appendChild(hint);
    }
  }

  /* ---------- G. CTA (honest branch: soft label + ghost surface) ---------- */
  function renderCta(R) {
    var cta = $('#ctaBtn');
    var soft = R.verdict.branch !== 'standard';
    if (!cta.classList.contains('is-close')) {
      cta.textContent = soft ? S.cta.soft : S.cta.plan;
    }
    cta.classList.toggle('cta--ghost', soft && !cta.classList.contains('is-close'));
  }

  /* ---------- the sticky mobile bar (state machine S0-S6) ---------- */
  var msumState = { txt: '' };
  function renderMsum(R) {
    var v = $('#msumVal'); if (!v) return;
    var av = anchorVals(R);
    var txt = anchorText(av) + ' kr per år';
    if (txt !== msumState.txt) {
      msumState.txt = txt;
      if (!REDUCED) {
        v.classList.add('flash');
        setTimeout(function () { v.classList.remove('flash'); }, 140);
      }
      v.textContent = txt;
    }
  }

  var msumSup = { result: false, kb: false, lead: false };
  function msumSync() {
    var m = $('#msum'); if (!m) return;
    var show = userTouched && !msumSup.result && !msumSup.kb && !msumSup.lead;
    m.classList.toggle('in', show);
  }
  function wireMsum() {
    var m = $('#msum'); if (!m) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        msumSup.result = entries[0].isIntersecting;
        msumSync();
      }, { threshold: 0.12, rootMargin: '0px 0px -64px 0px' });
      io.observe($('#result'));
    }
    var kbT;
    function isKb(t) {
      return t && t.matches && t.matches('input[type="number"],input[type="text"],input[type="tel"],input[type="email"],select,textarea');
    }
    document.addEventListener('focusin', function (e) {
      if (!isKb(e.target)) return;
      // guard: only treat as keyboard when the visual viewport actually shrinks (where supported)
      if (window.visualViewport && window.visualViewport.height >= 0.75 * window.innerHeight) {
        setTimeout(function () {
          msumSup.kb = !!(document.activeElement && isKb(document.activeElement) &&
            window.visualViewport.height < 0.75 * window.innerHeight);
          msumSync();
        }, 300);
      }
      msumSup.kb = true;
      msumSync();
    });
    document.addEventListener('focusout', function (e) {
      if (!isKb(e.target)) return;
      clearTimeout(kbT);
      kbT = setTimeout(function () { msumSup.kb = false; msumSync(); }, 150);
    });
    $('#msumGo').addEventListener('click', function () {
      track('msum_tap');
      $('#result').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    });
    msumSync();
  }

  /* ---------- the multi-system split line under the share rows ---------- */
  function renderHpSummary(R) {
    var s = $('#hpSummary'); if (!s) return;
    var bd = R.baseline.breakdown || [];
    if (bd.length > 1) {
      s.textContent = 'Vi räknar: ' + bd.map(function (b) {
        return shortLabel(b.id).toLowerCase() + ' ~' + pct(b.share);
      }).join(', ') + '.';
    } else {
      s.textContent = '';
    }
  }

  /* ---------- the ONE sr-only result announcer (debounced 800 ms) ---------- */
  var liveT;
  function announceResult(R) {
    clearTimeout(liveT);
    liveT = setTimeout(function () {
      var live = $('#resultLive'); if (!live) return;
      var av = anchorVals(R);
      var txt = av.single
        ? 'I dag kostar värmen cirka ' + nf(av.mid) + ' kronor per år.'
        : 'I dag kostar värmen cirka ' + nf(av.lo) + ' till ' + nf(av.hi) + ' kronor per år.';
      if (R.verdict.branch === 'standard') {
        var o = bestOption(R);
        if (o && o.saving) {
          var slo = Math.max(0, roundTo(o.saving[0], ROUND.hero)), shi = Math.max(0, roundTo(o.saving[2], ROUND.hero));
          txt += ' Rimligaste vägen ser ut att vara ' + verdictName(o) + ', ungefär ' + nf(slo) + ' till ' + nf(shi) + ' kronor lägre per år.';
        }
      }
      live.textContent = txt;
    }, 800);
  }

  /* ---------- H. methodology (prose; the curve + cap live after it) ---------- */
  function methodHtml(R) {
    var b = R.baseline.results.ctx;   // the current side (pump-independent)
    var c = bestResults.ctx;          // the best eligible option's pump ctx
    var blendNote = b.isMultiSystem
      ? '<h4>Blandad uppvärmning</h4>Du har mer än en värmekälla. Vi delar årets värme mellan dem efter andelarna du satt och räknar din nuvarande kostnad som summan. ' +
        (b.complementClamped ? 'Komplementen kan tillsammans täcka högst ' + Math.round((1 - b.primaryFloor) * 100) + ' % av värmen. ' : '') +
        'Besparingen är den blandade kostnaden minus den nya lösningen.'
      : '';
    var ovrNote = b.overrideMode
      ? '<h4>Din egen siffra</h4>Du har skrivit in din ' + (b.overrideMode === 'cost' ? 'årskostnad' : 'årsförbrukning') + ', så vi räknar på den i stället för schablonen. Då blir spannet smalare, eftersom mindre är gissat.'
      : '';
    return '' +
      '<h4>Värmebehov</h4>Vi uppskattar husets energi från byggår, boyta, boende och innetemperatur, ' +
      'normalårskorrigerat. Skriv in din årsförbrukning så räknar vi på din verkliga siffra.' +
      blendNote +
      '<h4>Verkningsgrad</h4>Vi räknar på <b>verklig årsvärmefaktor (fält-SPF)</b>, inte energimärkningens SCOP. ' +
      'Luftpumpens SPF sjunker i kyla, bergvärme ligger stabilt. Kurvan nedan visar <code>' + c.pumpLabel + '</code>, ' +
      'fält-SPF ~' + c.spfRange[0].toString().replace('.', ',') + '-' + c.spfRange[1].toString().replace('.', ',') + '.' +
      '<h4>Månadskurvan</h4>Årsbehovet fördelas över årets månader efter hur kallt det normalt är ' +
      '(graddagar: ju kallare månad, desto större andel av värmen). Vi använder SMHI:s normalår. Därför toppar räkningen på vintern.' +
      '<h4>Avdrag</h4>Värmepump ger <b>ROT 30 % på arbetskostnaden</b>, inte grön teknik. ' +
      'För ' + c.pumpLabel.toLowerCase() + ': brutto ' + krStr(c.gross, 500) + ', ROT ' + krStr(c.rot, 100) + ', netto <b>' + krStr(c.net, 500) + '</b>. ' +
      'Förutsatt outnyttjat ROT-utrymme.' +
      '<h4>Så rangordnar vi</h4>Vi grupperar åtgärderna efter investering (0-15, 20-55, 90+ tkr) och sorterar dem ' +
      'på återbetalningstid: netto efter ROT delat med årlig besparing. Går en åtgärd inte att räkna på i ditt hus ' +
      'visar vi den ändå, med skälet. Inga poäng, inga viktningar.' +
      ovrNote +
      '<h4>Osäkerhet</h4>Vi visar ett spann, inte en exakt siffra. Spannet är vidast på vintern där fält-SPF är minst säker.' +
      (c.footprintFlag ? '<h4>Obs</h4>Bergvärme erbjuds i dag <b>' + c.footprintFlag + '</b> och bekräftas i offerten.' : '') +
      '<h4>Solel och batteri</h4>Eventuell solel- och batteriintäkt visas som separata rader, aldrig inräknat i besparingen ovan. ' +
      'Sommarsol kan inte täcka vinterns värme, ett batteri flyttar el över dygnet, inte över året.' +
      '<h4>Vad det här är</h4>En uppskattning, inte ett bindande pris och inte ekonomisk rådgivning. Din offert räknas på ditt hus.';
  }

  function setChartCap() {
    var cap = $('#chartCap'); if (!cap) return;
    cap.textContent = (bestResults && bestResults.ctx && bestResults.ctx.isGround) ? S.curveCapGround : S.curveCapAir;
  }

  /* ========================================================================
   * THE 12-MONTH CURVE — monthly cost, current vs pump, ± ribbon, winter peak
   * (byte-untouched internals, R21; lives inside the method, lazy-drawn)
   * ====================================================================== */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var CHART = { x0: 34, x1: 352, yTop: 30, yBase: 166, lblY: 184, vbW: 372, vbH: 196, padR: 20 };
  var chartDrawn = false;   // gate the entrance choreography to explicit (non-drag) draws
  var lastChartCtx = null;  // {X,Y,c,r} kept for parity

  function svgEl(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  /* ---- monotone cubic Hermite (Fritsch-Carlson) — never overshoots the data ---- */
  function smoothPath(pts) {
    var n = pts.length; if (n < 2) return '';
    if (n === 2) return 'M' + pts[0].x.toFixed(2) + ',' + pts[0].y.toFixed(2) + ' L' + pts[1].x.toFixed(2) + ',' + pts[1].y.toFixed(2);
    var i, dx = [], dy = [], m = [], t = [];
    for (i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; dy[i] = pts[i + 1].y - pts[i].y; m[i] = dy[i] / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) {
      if (m[i - 1] * m[i] <= 0) { t[i] = 0; }
      else { t[i] = (m[i - 1] + m[i]) / 2; }
    }
    var p = 'M' + pts[0].x.toFixed(2) + ',' + pts[0].y.toFixed(2);
    for (i = 0; i < n - 1; i++) {
      var x1 = pts[i].x + dx[i] / 3, y1 = pts[i].y + t[i] * dx[i] / 3;
      var x2 = pts[i + 1].x - dx[i] / 3, y2 = pts[i + 1].y - t[i + 1] * dx[i] / 3;
      p += ' C' + x1.toFixed(2) + ',' + y1.toFixed(2) + ' ' + x2.toFixed(2) + ',' + y2.toFixed(2) +
           ' ' + pts[i + 1].x.toFixed(2) + ',' + pts[i + 1].y.toFixed(2);
    }
    return p;
  }

  function drawChart(r, force) {
    var svg = $('#chart'); if (!svg) return;
    var mobile = window.matchMedia('(max-width:768px)').matches;
    var c = Object.assign({}, CHART);
    if (mobile) { c.yTop = 34; c.yBase = 176; c.lblY = 196; c.vbH = 212; }
    svg.setAttribute('viewBox', '0 0 ' + c.vbW + ' ' + c.vbH);

    var cur = r.currentCost, pump = r.pumpCost, loB = r.pumpCostLow, hiB = r.pumpCostHigh;
    var maxV = 0, i;
    for (i = 0; i < 12; i++) { maxV = Math.max(maxV, cur[i], hiB[i]); }
    if (maxV <= 0) maxV = 1;

    function X(m) { return c.x0 + m * (c.x1 - c.x0) / 11; }
    function Y(v) { return c.yBase - (v / maxV) * (c.yBase - c.yTop); }
    function ptsOf(arr) { var a = []; for (var m = 0; m < 12; m++) a.push({ x: X(m), y: Y(arr[m]) }); return a; }

    function smoothArea(arr) {
      return smoothPath(ptsOf(arr)) +
        ' L' + X(11).toFixed(2) + ',' + c.yBase.toFixed(2) +
        ' L' + X(0).toFixed(2) + ',' + c.yBase.toFixed(2) + ' Z';
    }
    function stackedBand(upperArr, lowerArr) {
      var top = smoothPath(ptsOf(upperArr));
      var loRev = ptsOf(lowerArr).slice().reverse();
      var bot = smoothPath(loRev).replace(/^M([\d.\-]+),([\d.\-]+)/, 'L$1,$2');
      return top + ' ' + bot + ' Z';
    }
    function smoothRibbon() {
      var top = smoothPath(ptsOf(hiB));
      var loRev = ptsOf(loB).slice().reverse();
      var bot = smoothPath(loRev).replace(/^M([\d.\-]+),([\d.\-]+)/, 'L$1,$2');
      return top + ' ' + bot + ' Z';
    }

    var pk = peakMonth(cur);
    var title = '<title id="chartTitle">Kostnad månad för månad</title>' +
      '<desc id="chartDesc">Nuvarande uppvärmning toppar i ' + monthLong(pk) +
      '. Värmepumpen ligger lägre hela året, med ett osäkerhetsband som vidgas under vintern.</desc>';

    var defs = '<defs>' +
      '<linearGradient id="gCur" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#8b95bd" stop-opacity=".22"/><stop offset="1" stop-color="#8b95bd" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="gPump" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#00c4a7" stop-opacity=".26"/><stop offset="1" stop-color="#00c4a7" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#19c39e" stop-opacity=".22"/><stop offset="1" stop-color="#19c39e" stop-opacity=".09"/></linearGradient>' +
      '<filter id="glowPump" x="-20%" y="-40%" width="140%" height="180%">' +
        '<feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '</defs>';

    var g = '';
    function washRect(m0, m1) {
      var xa = X(m0) - (c.x1 - c.x0) / 22, xb = X(m1) + (c.x1 - c.x0) / 22;
      return '<rect x="' + xa.toFixed(1) + '" y="' + c.yTop + '" width="' + (xb - xa).toFixed(1) +
        '" height="' + (c.yBase - c.yTop) + '" fill="rgba(85,255,154,.035)"/>';
    }
    g += washRect(0, 1) + washRect(10, 11);
    g += '<line x1="' + c.x0 + '" y1="' + c.yBase + '" x2="' + c.x1 + '" y2="' + c.yBase + '" stroke="rgba(255,255,255,.12)" stroke-width="1"/>';
    var g1 = c.yTop + (c.yBase - c.yTop) / 3, g2 = c.yTop + 2 * (c.yBase - c.yTop) / 3;
    g += '<line x1="' + c.x0 + '" y1="' + g1.toFixed(1) + '" x2="' + c.x1 + '" y2="' + g1.toFixed(1) + '" stroke="rgba(255,255,255,.05)" stroke-width="1"/>';
    g += '<line x1="' + c.x0 + '" y1="' + g2.toFixed(1) + '" x2="' + c.x1 + '" y2="' + g2.toFixed(1) + '" stroke="rgba(255,255,255,.05)" stroke-width="1"/>';

    var entranceFade = !REDUCED && (force || !chartDrawn);
    g += '<g class="ch-fills"' + (entranceFade ? ' opacity="0"' : '') + '>';

    var isMulti = r.ctx.isMultiSystem && r.currentBreakdown.length > 1;
    var showSplit = isMulti && state.fanOpen;
    g += '<g class="fan-merged" opacity="' + (showSplit ? '0' : '1') + '">';
    g += '<path d="' + smoothArea(cur) + '" fill="url(#gCur)"/>';
    g += '</g>';
    if (isMulti) {
      g += '<g class="fan-split" opacity="' + (showSplit ? '1' : '0') + '">';
      var cumLower = new Array(12); for (var z = 0; z < 12; z++) cumLower[z] = 0;
      var ordered = r.currentBreakdown.slice().sort(function (a, b) { return (a.isPrimary === b.isPrimary) ? 0 : (a.isPrimary ? -1 : 1); });
      ordered.forEach(function (s) {
        var cumUpper = new Array(12);
        for (var mm = 0; mm < 12; mm++) cumUpper[mm] = cumLower[mm] + s.monthly[mm];
        g += '<path d="' + stackedBand(cumUpper, cumLower) + '" fill="' + fanFill(s.id, s.isPrimary) + '" stroke="' + fanStroke(s.id, s.isPrimary) + '" stroke-width="1" stroke-opacity=".5"/>';
        var lblYpos = Y((cumUpper[11] + cumLower[11]) / 2);
        g += '<text x="' + (c.x1 + 2).toFixed(1) + '" y="' + (lblYpos + 3).toFixed(1) + '" text-anchor="end" font-size="8.5" fill="' + fanStroke(s.id, s.isPrimary) + '" font-family="Outfit" opacity=".9">' + s.label.split(' ')[0] + '</text>';
        for (var m2 = 0; m2 < 12; m2++) cumLower[m2] = cumUpper[m2];
      });
      g += '</g>';
    }

    g += '<path d="' + smoothRibbon() + '" fill="url(#gBand)"/>';
    g += '<path d="' + smoothArea(pump) + '" fill="url(#gPump)"/>';
    g += '</g>';

    g += '<line x1="' + X(pk).toFixed(1) + '" y1="' + c.yTop + '" x2="' + X(pk).toFixed(1) + '" y2="' + Y(cur[pk]).toFixed(1) + '" stroke="rgba(255,255,255,.18)" stroke-width="1" stroke-dasharray="2 3"/>';
    g += '<line x1="' + X(pk).toFixed(1) + '" y1="' + Y(cur[pk]).toFixed(1) + '" x2="' + X(pk).toFixed(1) + '" y2="' + Y(pump[pk]).toFixed(1) + '" stroke="#55ff9a" stroke-width="2" stroke-opacity=".5" stroke-linecap="round"/>';

    g += '<path d="' + smoothPath(ptsOf(cur)) + '" fill="none" stroke="#8b95bd" stroke-width="1.6" stroke-dasharray="1 5" stroke-linecap="round" stroke-linejoin="round" class="ln-cur"/>';
    g += '<path d="' + smoothPath(ptsOf(pump)) + '" fill="none" stroke="#00c4a7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowPump)" class="ln-pump"/>';

    g += '<circle cx="' + X(pk).toFixed(1) + '" cy="' + Y(cur[pk]).toFixed(1) + '" r="3.4" fill="none" stroke="#8b95bd" stroke-width="1.6"/>';
    g += '<circle class="peak-dot" cx="' + X(pk).toFixed(1) + '" cy="' + Y(pump[pk]).toFixed(1) + '" r="4.4" fill="#00c4a7" stroke="#55ff9a" stroke-width="2"/>';

    var anchor = 'middle', px = X(pk);
    if (px < c.x0 + 24) anchor = 'start'; else if (px > c.x1 - 24) anchor = 'end';
    g += '<text x="' + px.toFixed(1) + '" y="' + (c.yTop - 9) + '" text-anchor="' + anchor + '" font-size="10" fill="#55ff9a" font-family="Outfit" font-weight="500">' + D.monthsLong[pk].slice(0, 3) + '-toppen</text>';

    for (var lm = 0; lm < 12; lm++) {
      if (mobile && (lm % 2) && lm !== pk) continue;
      g += '<text x="' + X(lm).toFixed(1) + '" y="' + c.lblY + '" text-anchor="middle" font-size="9" fill="' + (lm === pk ? '#cfe9e0' : '#7c86b0') + '" font-family="Outfit">' + D.months[lm] + '</text>';
    }

    for (var hm = 0; hm < 12; hm++) {
      var hx = X(hm) - (c.x1 - c.x0) / 22;
      g += '<rect x="' + hx.toFixed(1) + '" y="' + c.yTop + '" width="' + ((c.x1 - c.x0) / 11).toFixed(1) + '" height="' + (c.yBase - c.yTop) + '" fill="transparent" data-m="' + hm + '"/>';
    }

    var parsed = new DOMParser().parseFromString(
      '<svg xmlns="' + SVGNS + '">' + title + defs + g + '</svg>', 'image/svg+xml');
    if (parsed.querySelector('parsererror')) { return; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    Array.prototype.slice.call(parsed.documentElement.childNodes).forEach(function (n) {
      svg.appendChild(document.importNode(n, true));
    });

    var ind = document.createElementNS(SVGNS, 'g');
    ind.setAttribute('id', '_ind'); ind.setAttribute('opacity', '0'); ind.style.pointerEvents = 'none';
    var gl = document.createElementNS(SVGNS, 'line');
    gl.setAttribute('y1', c.yTop); gl.setAttribute('y2', c.yBase);
    gl.setAttribute('stroke', 'rgba(255,255,255,.28)'); gl.setAttribute('stroke-width', '1');
    var dC = document.createElementNS(SVGNS, 'circle');
    dC.setAttribute('r', '3.2'); dC.setAttribute('fill', 'none'); dC.setAttribute('stroke', '#8b95bd'); dC.setAttribute('stroke-width', '1.6');
    var dP = document.createElementNS(SVGNS, 'circle');
    dP.setAttribute('r', '4'); dP.setAttribute('fill', '#00c4a7'); dP.setAttribute('stroke', '#55ff9a'); dP.setAttribute('stroke-width', '2'); dP.setAttribute('filter', 'url(#glowPump)');
    ind.appendChild(gl); ind.appendChild(dC); ind.appendChild(dP);
    svg.appendChild(ind);

    if (entranceFade) {
      var fills = svg.querySelector('.ch-fills');
      if (fills) {
        fills.style.opacity = '0';
        fills.style.transition = 'opacity var(--t-mid) var(--ease-out)';
        fills.getBoundingClientRect();
        setTimeout(function () { fills.style.opacity = '1'; }, 120);
      }
      var curLn = svg.querySelector('.ln-cur'), pumpLn = svg.querySelector('.ln-pump');
      [[curLn, 0], [pumpLn, 60]].forEach(function (pair) {
        var p = pair[0]; if (!p || !p.getTotalLength) return;
        var len = p.getTotalLength(); if (!len) return;
        p.style.strokeDasharray = (p.classList.contains('ln-cur') ? len + ' ' + len : len);
        p.style.strokeDashoffset = len; p.getBoundingClientRect();
        p.style.transition = 'stroke-dashoffset .3s var(--ease-out)';
        setTimeout(function () { p.style.strokeDashoffset = 0; }, pair[1]);
        if (p.classList.contains('ln-cur')) {
          setTimeout(function () { p.style.transition = 'none'; p.style.strokeDasharray = '1 5'; p.style.strokeDashoffset = '0'; }, 360 + pair[1]);
        }
      });
      var pd = svg.querySelector('.peak-dot');
      if (pd) {
        pd.style.transformBox = 'fill-box'; pd.style.transformOrigin = 'center';
        pd.style.transform = 'scale(0)'; pd.getBoundingClientRect();
        pd.style.transition = 'transform var(--t-mid) var(--ease-out)';
        setTimeout(function () { pd.style.transform = 'scale(1)'; }, 120);
      }
    }
    chartDrawn = true;
    lastChartCtx = { X: X, Y: Y, c: c, r: r, isMulti: isMulti };

    wireChartHover(svg, r, X, Y, c);
  }

  function wireChartHover(svg, r, X, Y, c) {
    var tip = $('#chartTip'); var device = svg.parentNode;
    var ind = svg.querySelector('#_ind');
    var cursorM = -1;
    var isMulti = r.ctx.isMultiSystem && r.currentBreakdown.length > 1;

    function moveIndicator(m) {
      if (!ind) return;
      var x = X(m);
      var line = ind.querySelector('line'), dots = ind.querySelectorAll('circle');
      line.setAttribute('x1', x.toFixed(1)); line.setAttribute('x2', x.toFixed(1));
      dots[0].setAttribute('cx', x.toFixed(1)); dots[0].setAttribute('cy', Y(r.currentCost[m]).toFixed(1));
      dots[1].setAttribute('cx', x.toFixed(1)); dots[1].setAttribute('cy', Y(r.pumpCost[m]).toFixed(1));
      ind.setAttribute('opacity', '1');
    }

    function show(m) {
      cursorM = m;
      moveIndicator(m);
      var dRect = device.getBoundingClientRect();
      var sRect = svg.getBoundingClientRect();
      var sx = sRect.width / parseFloat(svg.viewBox.baseVal.width || 372);
      var sy = sRect.height / parseFloat(svg.viewBox.baseVal.height || 196);
      var left = (sRect.left - dRect.left) + X(m) * sx;
      var top = (sRect.top - dRect.top) + Math.min(Y(r.currentCost[m]), Y(r.pumpCost[m])) * sy;
      var delta = Math.max(0, r.currentCost[m] - r.pumpCost[m]);
      var splitHtml = '';
      if (isMulti && state.fanOpen) {
        var parts = r.currentBreakdown.map(function (s) {
          return '<span>' + s.label.split(' ')[0] + ' ' + krStr(s.monthly[m], 50) + '</span>';
        }).join('');
        splitHtml = '<div class="tip-split">' + parts + '</div>';
      }
      tip.innerHTML = '<div class="tip-m">' + ucfirst(monthLong(m)) + '</div>' +
        '<div class="tip-r"><span>Nuvarande</span><span>' + krStr(r.currentCost[m], 50) + '</span></div>' +
        '<div class="tip-r"><span>Värmepump</span><span>' + krStr(r.pumpCost[m], 50) + '</span></div>' +
        splitHtml +
        '<div class="tip-d">~ ' + krStr(delta, 50) + ' lägre</div>';
      tip.hidden = false;
      var w = tip.offsetWidth, h = tip.offsetHeight, dW = device.clientWidth;
      tip.style.left = Math.max(w / 2 + 4, Math.min(dW - w / 2 - 4, left)) + 'px';
      tip.classList.remove('below');
      if (top - h - 8 < 0) { tip.style.top = (top + 16) + 'px'; tip.classList.add('below'); }
      else { tip.style.top = top + 'px'; }
      requestAnimationFrame(function () { tip.classList.add('show'); });
    }
    function hide() { tip.classList.remove('show'); cursorM = -1; if (ind) ind.setAttribute('opacity', '0'); setTimeout(function () { if (cursorM < 0) tip.hidden = true; }, 160); }

    el('rect[data-m]', svg).forEach(function (rect) {
      var m = +rect.dataset.m;
      rect.addEventListener('mouseenter', function () { show(m); });
      rect.addEventListener('mousemove', function () { show(m); });
      rect.addEventListener('mouseleave', hide);
      rect.style.cursor = 'crosshair';
    });

    function monthFromTouch(e) {
      var t = e.touches && e.touches[0]; if (!t) return -1;
      var sRect = svg.getBoundingClientRect();
      var sx = sRect.width / parseFloat(svg.viewBox.baseVal.width || 372);
      var vx = (t.clientX - sRect.left) / sx;
      var m = Math.round((vx - c.x0) / ((c.x1 - c.x0) / 11));
      return Math.max(0, Math.min(11, m));
    }
    svg.addEventListener('touchstart', function (e) { var m = monthFromTouch(e); if (m >= 0) show(m); }, { passive: true });
    svg.addEventListener('touchmove', function (e) { var m = monthFromTouch(e); if (m >= 0) show(m); }, { passive: true });
    svg.addEventListener('touchend', hide, { passive: true });
    svg.addEventListener('mouseleave', hide);

    svg.setAttribute('tabindex', '0');
    svg.setAttribute('aria-describedby', 'chartDesc');
    svg.onkeydown = function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var m = cursorM < 0 ? peakMonth(r.currentCost) : cursorM;
        m = e.key === 'ArrowRight' ? Math.min(11, m + 1) : Math.max(0, m - 1);
        show(m);
      } else if (e.key === 'Escape') { hide(); }
    };
    svg.onblur = hide;
  }

  /* ========================================================================
   * INTERACTIONS — sliders, stepper, reveals, share, lead form
   * ====================================================================== */
  function wireControls() {
    el('[data-input]').forEach(function (n) {
      var ev = (n.type === 'range') ? 'input' : 'change';
      n.addEventListener(ev, function () { forceChartDraw = true; recompute(); });
    });
    var area = $('#areaSlider'); area.addEventListener('input', function () { $('#areaOut').textContent = area.value + ' m²'; });
    var temp = $('#tempSlider'); temp.addEventListener('input', function () { $('#tempOut').textContent = temp.value + ' °C'; });

    // override field: re-evaluate on input; the note + badge update in render()
    $('#annualKwhField').addEventListener('input', function () {
      if (!overrideTypedFired && this.value) { overrideTypedFired = true; track('override_typed'); }
      forceChartDraw = true; recompute();
    });

    // stepper (occupants)
    el('.stepbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = $('#occupantsField'); var v = Math.max(1, Math.min(8, (+f.value) + (+b.dataset.dir)));
        f.value = v;
        var out = $('#occOut');
        if (!REDUCED) { out.classList.add('bump'); requestAnimationFrame(function () { out.classList.remove('bump'); }); }
        out.textContent = v;
        forceChartDraw = true;
        recompute();
      });
    });

    // reveals (gear keys: own / all)
    ['#gearOwn', '#gearAll'].forEach(function (sel) { var n = $(sel); if (n) n.removeAttribute('hidden'); });
    el('.reveal').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.reveal;
        var gear = $('.gear[data-gear="' + key + '"]');
        if (!gear) return;
        var willOpen = !gear.classList.contains('open');
        toggleEl(gear, willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) {
          track('reveal_open', { key: key });
          setTimeout(function () { replaceAllPills(); checkStickyIntegrity(); }, REDUCED ? 0 : 240);
        }
      });
    });

    // share (AmpyCodec: house state only, NO identity, ever)
    var shareBtn = $('#shareBtn');
    if (shareBtn && CODEC) {
      shareBtn.addEventListener('click', function () {
        track('share_click');
        var url = location.origin + location.pathname;
        var q = CODEC.encode(shareState());
        if (q) url += '?' + q;
        var confirm = function () {
          shareBtn.textContent = S.shareCopied;
          $('#shareLive').textContent = S.shareCopied;
          setTimeout(function () { shareBtn.textContent = S.share; $('#shareLive').textContent = ''; }, 2000);
        };
        if (navigator.share) {
          navigator.share({ title: document.title, text: S.shareText, url: url }).catch(function () {});
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(confirm).catch(function () {});
        } else {
          try {
            var tmp = document.createElement('textarea');
            tmp.value = url; document.body.appendChild(tmp); tmp.select();
            document.execCommand('copy'); document.body.removeChild(tmp);
            confirm();
          } catch (e) {}
        }
      });
    }

    // lead form (inline)
    $('#ctaBtn').addEventListener('click', openLead);
    $('#leadClose').addEventListener('click', closeLead);
    $('#leadForm').addEventListener('submit', submitLead);
    // validate-on-blur per field
    [['#leadName', validateName], ['#leadPhone', validatePhone], ['#leadZip', validateZip], ['#leadEmail', validateEmail]].forEach(function (pair) {
      var f = $(pair[0]); if (f) f.addEventListener('blur', function () { pair[1](true); });
    });

    // the method holds the curve: lazy-draw on first open, redraw on later opens
    var method = $('.method');
    if (method) {
      method.addEventListener('toggle', function () {
        if (this.open && lastRank) {
          drawChart(bestResults, true);
          setChartCap();
        }
      });
    }
  }

  function toggleEl(n, willOpen) { if (!n) return; n.classList.toggle('open', willOpen); }

  /* sticky integrity: drop sticky if the left card would outgrow the viewport */
  function checkStickyIntegrity() {
    var card = $('#inputForm');
    if (!card) return;
    if (window.matchMedia('(max-width:992px)').matches) { card.classList.remove('static'); return; }
    var tooTall = card.scrollHeight > (window.innerHeight - 48);
    card.classList.toggle('static', tooTall);
  }

  /* ---------- the URL codec: share state out, prefill in (house state ONLY) ---------- */
  var ERA_TOKEN = { pre1940: 'e1', midcentury: 'e2', modern2010: 'e3', new2021: 'e4' };
  var TOKEN_ERA = { e1: 'pre1940', e2: 'midcentury', e3: 'modern2010', e4: 'new2021', x: 'x' };
  var M2_MID = { b1: 80, b2: 130, b3: 180, b4: 250 };

  function areaBand(a) { return a < 100 ? 'b1' : a <= 150 ? 'b2' : a <= 200 ? 'b3' : 'b4'; }

  function shareState() {
    var sel = heatSelection();
    var s = {
      sys: sel.primary,
      comps: sel.complements.map(function (c) {
        return { system: c.system, stop: (state.heat[c.system] && state.heat[c.system].stop != null) ? state.heat[c.system].stop : DEFAULT_STOP };
      }),
      m2: areaBand(+$('#areaSlider').value),
      era: state.era === 'x' ? 'x' : (ERA_TOKEN[state.era] || null),
      vb: state.vb === 'auto' ? null : state.vb === 'ja' ? true : state.vb === 'nej' ? false : 'x',  // M1: never launder auto-inference into vetinte; recipient re-infers from sys
      kwh: null, kr: null,
      se: state.priceArea
    };
    var raw = $('#annualKwhField').value;
    var num = raw ? +raw : null;
    if (num != null && isFinite(num) && num > 0) {
      if (state.overrideUnit === 'kwh') s.kwh = num; else s.kr = num;
    }
    return s;
  }

  function applyDecoded() {
    if (!CODEC) return false;
    var dec = CODEC.decode(location.search);
    var any = false;
    if (dec.sys && D.currentSystems[dec.sys]) {
      state.heat = {};
      state.heat[dec.sys] = { on: true, stop: DEFAULT_STOP, assumed: true };
      any = true;
    }
    dec.comps.forEach(function (c) {
      if (D.currentSystems[c.system] && c.system !== dec.sys) {
        state.heat[c.system] = { on: true, stop: c.stop, assumed: false };
        any = true;
      }
    });
    if (dec.m2 && M2_MID[dec.m2]) {
      $('#areaSlider').value = M2_MID[dec.m2];
      $('#areaOut').textContent = M2_MID[dec.m2] + ' m²';
      any = true;
    }
    if (dec.era && TOKEN_ERA[dec.era]) {
      state.era = TOKEN_ERA[dec.era] === 'x' ? 'x' : TOKEN_ERA[dec.era];
      state.eraTouched = dec.era !== 'x';
      any = true;
    }
    if (dec.vb === true) { state.vb = 'ja'; any = true; }
    else if (dec.vb === false) { state.vb = 'nej'; any = true; }
    else if (dec.vb === 'x') { state.vb = 'vetinte'; any = true; }
    if (dec.kwh) { state.overrideUnit = 'kwh'; $('#annualKwhField').value = dec.kwh; any = true; }
    else if (dec.kr) { state.overrideUnit = 'cost'; $('#annualKwhField').value = dec.kr; any = true; }
    if (dec.se && D.priceAreas[dec.se]) { state.priceArea = dec.se; state.seTouched = true; any = true; }
    return any;
  }

  function syncAsmTags() {
    var e = $('#eraAsm'); if (e) e.hidden = state.era !== 'x';
    var s = $('#seAsm'); if (s) s.hidden = state.seTouched;
    var v = $('#vbAsm'); if (v) v.hidden = state.vb !== 'auto';
  }

  /* ---------- lead validation (min = namn + telefon + postnr + GDPR; e-post optional) ---------- */
  function setErr(fieldSel, errSel, msg) {
    var f = $(fieldSel), e = $(errSel);
    if (msg) { f.setAttribute('aria-invalid', 'true'); e.textContent = msg; e.hidden = false; return false; }
    f.removeAttribute('aria-invalid'); e.hidden = true; return true;
  }
  function validateName(live) {
    var v = $('#leadName').value.trim();
    if (!v && live !== 'silent') return setErr('#leadName', '#errName', 'Skriv ditt namn.');
    if (!v) return false; return setErr('#leadName', '#errName', null);
  }
  function validatePhone(live) {
    var v = $('#leadPhone').value.trim();
    var ok = v.replace(/[\s\-()+]/g, '').length >= 7 && /[\d]/.test(v);
    if (!ok) return setErr('#leadPhone', '#errPhone', 'Skriv ett nummer vi kan nå dig på.');
    return setErr('#leadPhone', '#errPhone', null);
  }
  function validateZip(live) {
    var v = $('#leadZip').value.replace(/\s/g, '');
    if (!/^\d{5}$/.test(v)) return setErr('#leadZip', '#errZip', 'Postnumret ska vara fem siffror.');
    return setErr('#leadZip', '#errZip', null);
  }
  function validateEmail(live) {
    var v = $('#leadEmail').value.trim();
    if (!v) return setErr('#leadEmail', '#errEmail', null);  // optional
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return setErr('#leadEmail', '#errEmail', 'Kontrollera adressen eller lämna fältet tomt.');
    return setErr('#leadEmail', '#errEmail', null);
  }

  function openLead() {
    var w = $('#leadInline'); w.removeAttribute('hidden');
    $('#leadForm').hidden = false; $('#leadSuccess').hidden = true;
    var cta = $('#ctaBtn'); var open = !w.classList.contains('open');
    toggleEl(w, open); cta.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      track('lead_open');
      cta.classList.add('is-close');
      cta.classList.remove('cta--ghost');
      cta.innerHTML = 'Stäng ' + ICONS.chevUp;
      msumSup.lead = true; msumSync();
      setTimeout(function () { try { $('#leadName').focus(); } catch (e) {} }, REDUCED ? 0 : 220);
    } else {
      msumSup.lead = false; msumSync();
      restoreCta();
    }
    // NO scrollIntoView.
  }

  function closeLead() {
    var w = $('#leadInline');
    toggleEl(w, false);
    var cta = $('#ctaBtn'); cta.setAttribute('aria-expanded', 'false');
    msumSup.lead = false; msumSync();
    restoreCta();
    try { cta.focus(); } catch (e) {}
  }

  function restoreCta() {
    var cta = $('#ctaBtn');
    cta.classList.remove('is-close');
    var soft = lastRank ? (lastRank.verdict.branch !== 'standard') : false;
    cta.textContent = soft ? S.cta.soft : S.cta.plan;
    cta.classList.toggle('cta--ghost', soft);
  }

  function submitLead(e) {
    e.preventDefault();
    if ($('#leadCompany').value) { return; } // honeypot tripped: silently drop
    var okName = validateName(true), okPhone = validatePhone(true), okZip = validateZip(true), okEmail = validateEmail(true);
    var gdpr = $('#leadGdpr').checked;
    var okGdpr = setErr('#leadGdpr', '#errGdpr', gdpr ? null : 'Du behöver godkänna att vi hör av oss.');
    if (!(okName && okPhone && okZip && okEmail && okGdpr)) {
      var firstBad = $('[aria-invalid="true"]'); if (firstBad) firstBad.focus();
      return;
    }
    $('#leadErr').hidden = true;
    try {
      var R = lastRank;
      var sel = heatSelection();
      console.log('[ampy lead]', {
        zip: $('#leadZip').value.trim(),
        primary: sel.primary,
        complements: sel.complements.map(function (c) { return c.system; }),
        override: (R && R.baseline.overrideMode) || null,
        area: $('#areaSlider').value, priceArea: state.priceArea,
        branch: R ? R.verdict.branch : null,
        best: R ? R.verdict.bestOptionId : null,
        savingBucket: R ? bucketKr(R.verdict.bestSavingMid) : '0'
      });
      track('lead_submit', { branch: R ? R.verdict.branch : null });
      $('#leadForm').hidden = true;
      var ok = $('#leadSuccess');
      ok.hidden = false;
      try { ok.focus(); } catch (e3) {}
    } catch (e2) {
      var err = $('#leadErr');
      err.textContent = S.leadErr;
      err.hidden = false;
    }
  }

  /* ---------- resize: re-place the sliding pills + re-tune the curve ---------- */
  var rT;
  window.addEventListener('resize', function () {
    replaceAllPills();
    checkStickyIntegrity();
    clearTimeout(rT); rT = setTimeout(function () {
      var method = $('.method');
      if (lastRank && method && method.open) drawChart(bestResults, false);
    }, 160);
  });

  /* ---------- boot ---------- */
  function boot() {
    var decodedAny = applyDecoded();      // ?-param prefill (house state only, no identity)
    buildInputs();
    syncAsmTags();
    wireControls();
    wireMsum();
    if (decodedAny) firstTouch(true);   // M2: mark touched BEFORE the first render so a shared link never shows the typhus primer over someone else's house
    // m6: a decoded override must arrive visible — open the "Vet du vad huset drar?" reveal
    if (decodedAny && $('#annualKwhField').value) {
      var ownBtn = $('.reveal[data-reveal="own"]');
      if (ownBtn && ownBtn.getAttribute('aria-expanded') !== 'true') ownBtn.click();
    }
    recompute();
    booted = true;

    if (!REDUCED) {
      var res = $('#result');
      var bar = $('#storyBar');
      bar.classList.add('is-drawing');
      requestAnimationFrame(function () {
        res.classList.add('enter');
        requestAnimationFrame(function () {
          bar.classList.add('is-drawn');
          bar.classList.remove('is-drawing');
        });
        setTimeout(function () {
          res.classList.remove('enter');
          bar.classList.remove('is-drawn');
        }, 700);
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  /* font swap changes button widths: re-place every sliding pill once Outfit lands */
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(function () { replaceAllPills(); });
  }

})();
