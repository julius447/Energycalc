/* =============================================================================
 * app.js — Energikollen V4 · the renderer / state machine (V4-design.md)
 * Layer 6 of the chassis: data.js -> engine.js -> rank.js -> THIS FILE.
 * All math lives in AmpyEngine/AmpyRank (pure); this file only routes taps,
 * renders, rounds per D.meta.rounding and speaks the shipped Swedish strings.
 * Candour invariants held here: honest ranges, "—" only as the empty readout,
 * greyed-with-reason (never hidden), savings BUCKETED in every payload,
 * consent-gated events, no network call except the lead webhook.
 * ========================================================================== */

(function () {
  'use strict';
  var D = window.AMPY_DATA;
  var ENGINE = window.AmpyEngine;
  var CODEC = window.AmpyCodec;
  if (!D || !ENGINE || !ENGINE.rankOptions || !CODEC) { return; }

  /* ---------- tiny DOM + format helpers (vB, proven) ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var REDUCED = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var NBSP = '\u00A0';
  var EMPTY = '—'; /* the ONE sanctioned em-dash: the empty readout */

  function nf(n) { return Math.round(n).toLocaleString('sv-SE').replace(/[\s  ]/g, NBSP); }
  function roundTo(n, step) { return Math.round(n / step) * step; }
  function krStr(n, step) { return nf(roundTo(n, step)) + ' kr'; }
  function yrStr(y) { return (Math.round(y * 2) / 2).toString().replace('.', ','); }
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

  /* ---------- instrumentation (consent-gated, bucketed, experiment_id) ---------- */
  function hasConsent() { return window.ampyConsent === true || window.AMPY_CONSENT === true; }
  function track(ev, params) {
    if (!hasConsent()) return; /* no event fires without consent state */
    try {
      var p = { event: 'ek_' + ev, experiment_id: 'energikollen-v4' };
      if (params) for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
      (window.dataLayer = window.dataLayer || []).push(p);
    } catch (e) {}
  }
  function bucketKr(v) { /* savings are BUCKETED, never raw */
    if (v == null || !(v > 0)) return '0';
    var lo = Math.floor(v / 5000) * 5000;
    return lo + '-' + (lo + 5000);
  }

  /* ---------- the copy deck (V4-design §10; final strings, grep-clean) ---------- */
  var S = {
    ack: {
      direktel:      'Direktel. Varje kWh värme kostar en kWh el. Därför finns det mycket att räkna på.',
      vattenburenEl: 'Vattenburen el. Elpanna i botten, men vattnet i elementen öppnar fler vägar.',
      olja:          'Oljepanna. Dyr värme per kWh, men vattenburet system finns redan på plats.',
      vedpellets:    'Ved eller pellets. Billig värme när du eldar själv, men den kräver sitt arbete.',
      franluft:      'Frånluftspump. Den återvinner en del av värmen, men klarar sällan hela huset.',
      fjarrvarme:    'Fjärrvärme. Här handlar det om pris, inte verkningsgrad. Vi jämför kostnaden rakt av.',
      pump:          'Bra utgångsläge. Vi kollar om något mer är värt att göra.',
      vetinte:       'Vi räknar försiktigt på direktverkande el tills du vet mer. Det går att ändra sen.'
    },
    q3VetInte: 'Vi räknar försiktigt tills du vet mer.',
    q4High: 'Det är en ovanligt hög siffra för ett småhus. Vi räknar på den, men dubbelkolla gärna.',
    next: 'Nej, bara det',
    nextDone: 'Klar',
    progress: { q1: '1 av 3', q2: '2 av 3', q3: '3 av 3', q3b: 'Följdfråga', q4: 'Valfri' },
    verdict: {
      redanEffektiv: 'Bra nyheter: din uppvärmning är redan effektiv. Det ärliga svaret är att en stor investering knappast lönar sig.',
      ingenBesparing: 'Med dina siffror räknar vi inte hem det. Det ärliga svaret är att behålla det du har. Har du din riktiga årskostnad blir kalkylen skarpare.',
      litenBesparing: 'Med dina siffror blir besparingen liten. En stor investering är svår att räkna hem, men de små åtgärderna kan vara värda att göra.'
    },
    bandNote: 'Spannet är brett eftersom vi räknar försiktigt på det du inte visste. Fyll i mer under Finjustera så smalnar det.',
    ownDone: 'Din siffra är på plats. Spannet smalnar.',
    chipsHint: 'tryck för att ändra',
    asm: '(antagande)',
    overBudget: ['åtgärd över vald budget', 'åtgärder över vald budget'],
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
    styrningBody: 'Sänkt kostnad utan att röra själva värmen. Din innetemperatur är en egen hävstång, testa den under Finjustera.',
    kaminSpets: 'Kaminen tar topparna de kallaste dagarna. Det håller nere elräkningen när den annars är som högst.',
    reason: {
      redanVarmepump: 'Huset värms redan av en värmepump. Vi visar siffran som jämförelse, inte som råd.',
      luftluftFinnsRedan: 'Luft-luft finns redan i huset, så en till ger litet utrymme till mer.',
      styrningEjStyrbar: 'Kräver värme som går att styra elektroniskt. Ved och pellets eldas för hand.'
    },
    facts: { save: 'Lägre kostnad', invest: 'Investering', payback: 'Återbetald' },
    investRot: ' efter ROT 30 % på arbetet',
    fine: {
      own: 'Vet du din siffra? Den slår våra schabloner.',
      area: 'Boyta, exakt',
      occupants: 'Boende',
      temp: 'Innetemperatur',
      tempMicro: 'varje grad märks, testa',
      dist: 'Hur värmen sprids',
      distOpts: ['Golvvärme', 'Radiatorer', 'Äldre högtemp'],
      se: 'Elområde',
      dso: 'Elnätsbolag',
      dsoMicro: 'styr effektavgift-raden',
      solar: 'Solel finns eller planeras',
      shareStops: ['Lite', 'En del', 'Mycket'],
      upside: 'Kan komma ovanpå',
      upsideMicro: '(ej i siffran ovan)',
      atRisk: 'osäker intäkt'
    },
    cta: { plan: 'Få en plan för ditt hus', soft: 'Få en kostnadsfri bedömning' },
    err: {
      name: 'Skriv ditt namn.',
      phone: 'Skriv ett telefonnummer vi kan nå dig på.',
      zip: 'Skriv ditt postnummer, fem siffror.',
      email: 'Kolla e-postadressen.',
      gdpr: 'Bocka i rutan så får vi kontakta dig.',
      submit: 'Det gick inte att skicka just nu. Ring oss eller försök igen om en stund.'
    },
    shareText: 'Se vad värmen kostar i ditt hus. Tre frågor, gratis, utan mejl.',
    shareCopied: 'Länk kopierad',
    curveCapAir: 'Luftpumpens tapp i kyla, månad för månad. Det är beviset för raden på korten ovan.',
    curveCapGround: 'Bergvärme ligger stabilt över året. Kurvan visar varför.',
    curveDescAir: 'Nuvarande uppvärmning toppar i februari. En luftvärmepump tappar i kyla, därför vidgas bandet på vintern. Bergvärme ligger stabilt.',
    curveDescGround: 'Nuvarande uppvärmning toppar i februari. Bergvärme ligger stabilt över året eftersom marken håller jämn temperatur.'
  };

  /* ---------- answer mappings (UX bands -> engine model; V4-design §3) ---------- */
  var M2_MID   = { b1: 80, b2: 125, b3: 175, b4: 250 };  /* [MODEL] band midpoints */
  var M2_LABEL = { b1: 'Under 100 m²', b2: '100-150 m²', b3: '150-200 m²', b4: 'Över 200 m²' };
  var ERA_MAP  = { e1: 'pre1940', e2: 'midcentury', e3: 'modern2010', e4: 'new2021', x: 'midcentury' };
  var ERA_LABEL = { e1: 'Före 1940', e2: '1940-1990', e3: '1990-2010', e4: 'Efter 2010', x: 'Vet inte' };
  var SYS_SHORT = {
    direktel: 'Direktel', fjarrvarme: 'Fjärrvärme', olja: 'Oljepanna', vedpellets: 'Ved / pellets',
    vattenburenEl: 'Vattenburen el', franluft: 'Frånluftspump',
    luftluftCur: 'Luft-luft', luftvattenCur: 'Luft-vatten', bergvarmeCur: 'Bergvärme'
  };
  var KOMP_SHORT = { kamin: 'Braskamin', luftluftCur: 'Luft-luft' };
  var DSO_LABELS = { vetej: 'Vet ej', ellevio: 'Ellevio', vattenfall: 'Vattenfall', eon: 'E.ON' };
  var SHARE_STOPS = (D.multi && D.multi.shareStops) ? D.multi.shareStops : [0.20, 0.40, 0.60];
  var WEBHOOK = (D.meta && (D.meta.leadWebhookUrl || D.meta.lead_webhook_url)) || null;

  /* ---------- state ---------- */
  var state = {
    step: 'q1',
    q1Card: null,          /* which Q1 card was tapped: value incl 'pump'/'vetinte' */
    sys: null,             /* engine currentSystems id (primary) */
    sysAssumed: false,
    comps: [],             /* [{system, stop:0..2, assumed:bool}] */
    m2: null, m2Assumed: false,
    era: null, eraAssumed: false,   /* 'e1'..'e4'|'x' */
    vb: null,              /* true | false | 'x' | null(=not asked) */
    q4: null,              /* {mode:'kwh'|'cost', value:N} | 'skip' | null */
    fineOverride: null,    /* {mode, value} typed in Finjustera (only when q4 skipped) */
    areaExact: null,
    occupants: D.defaultOccupants,
    indoorTemp: D.defaultIndoorTemp,
    distribution: D.defaultDistribution,
    priceArea: D.defaultPriceArea, seTouched: false,
    dso: 'vetej',
    hasSolar: false,
    lever: 'all',
    open: [],              /* expanded measure card ids */
    revealShown: false
  };
  var lastRank = null;
  var fineBuilt = false;
  var refineOpenFired = false;
  var overrideTypedFired = false;
  var rungOpenOverride = {};   /* rung index -> true when user re-expanded past the lever cap */

  function needsQ3b() { return state.sys === 'direktel' || state.sys === 'franluft'; }
  function resolvedVb() {
    if (state.vb === true) return true;
    if (state.vb === false) return false;
    if (state.vb === 'x') return false;              /* conservative, assumed (V4 §3.5) */
    return needsQ3b() ? false : true;                /* unasked: infer yes; hatch on direktel/franluft -> conservative */
  }
  function vbAssumed() { return state.vb === 'x' || (state.vb == null && needsQ3b()); }
  function anyAssumed() {
    if (state.sysAssumed || state.m2Assumed || state.eraAssumed || vbAssumed()) return true;
    for (var i = 0; i < state.comps.length; i++) if (state.comps[i].assumed) return true;
    return false;
  }
  function currentArea() {
    if (state.areaExact != null) return state.areaExact;
    return M2_MID[state.m2] != null ? M2_MID[state.m2] : 150;
  }
  function activeOverride() {
    if (state.q4 && state.q4 !== 'skip') return state.q4;
    if (state.fineOverride) return state.fineOverride;
    return null;
  }

  /* ---------- the engine inputs contract (rank.js §4) ---------- */
  function engineInputs() {
    var ovr = activeOverride();
    var actual = { mode: null, kwh: null, cost: null };
    if (ovr) {
      if (ovr.mode === 'kwh') { actual.mode = 'kwh'; actual.kwh = ovr.value; }
      else { actual.mode = 'cost'; actual.cost = ovr.value; }
    }
    var comps = [];
    state.comps.forEach(function (c) {
      if (!c || !c.system || c.system === state.sys) return;
      var row = { system: c.system };
      if (!c.assumed && c.stop != null) row.coverage = SHARE_STOPS[c.stop];
      comps.push(row);   /* assumed -> omit coverage; engine fills the default + tags isAssumed */
    });
    return {
      current: { primary: state.sys || D.defaultCurrentSystem, complements: comps, actual: actual },
      area: currentArea(),
      priceArea: state.priceArea,
      occupants: state.occupants,
      era: ERA_MAP[state.era] || D.defaultEra,
      indoorTemp: state.indoorTemp,
      distribution: state.distribution,
      hasWaterborne: resolvedVb(),
      dso: state.dso,
      hasSolar: state.hasSolar
    };
  }

  /* ---------- session persistence (resume; §2.1) ---------- */
  var SS_KEY = 'ampy-ek-v4';
  function saveSession() {
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({
        v: 1, step: state.step,
        a: {
          q1Card: state.q1Card, sys: state.sys, sysAssumed: state.sysAssumed, comps: state.comps,
          m2: state.m2, m2Assumed: state.m2Assumed, era: state.era, eraAssumed: state.eraAssumed,
          vb: state.vb, q4: state.q4, fineOverride: state.fineOverride,
          areaExact: state.areaExact, occupants: state.occupants, indoorTemp: state.indoorTemp,
          distribution: state.distribution, priceArea: state.priceArea, seTouched: state.seTouched,
          dso: state.dso, hasSolar: state.hasSolar, lever: state.lever, open: state.open
        }
      }));
    } catch (e) {}
  }
  function loadSession() {
    try {
      var raw = sessionStorage.getItem(SS_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || s.v !== 1 || !s.a) return null;
      return s;
    } catch (e) { return null; }
  }

  /* =========================================================================
   * THE VIEW MACHINE (V4-design §2)
   * ====================================================================== */
  var VIEWS = { q1: 'view-q1', q2: 'view-q2', q3: 'view-q3', q3b: 'view-q3b', q4: 'view-q4', reveal: 'view-reveal' };
  var STEP_N = { q1: 1, q2: 2, q3: 3, q3b: '3b', q4: 4 };
  var swapping = false;

  function flow() {
    var f = ['q1', 'q2', 'q3'];
    if (needsQ3b()) f.push('q3b');
    f.push('q4', 'reveal');
    return f;
  }
  function nextStep(from) {
    var f = flow(), i = f.indexOf(from);
    return (i === -1 || i === f.length - 1) ? 'reveal' : f[i + 1];
  }

  function updateChrome() {
    var prog = $('#ekProgress'), back = $('#ekBack');
    if (state.step === 'reveal') {
      prog.hidden = true; back.hidden = true;
    } else {
      prog.hidden = false;
      prog.textContent = S.progress[state.step] || '';
      back.hidden = (state.step === 'q1');
    }
  }

  function traceText() {
    var parts = [];
    if (state.sys) parts.push(SYS_SHORT[state.sys] + (state.sysAssumed ? ' ' + S.asm : ''));
    state.comps.forEach(function (c) { parts.push('+ ' + KOMP_SHORT[c.system]); });
    if (state.m2) parts.push(M2_LABEL[state.m2]);
    if (state.era) parts.push(ERA_LABEL[state.era]);
    if (state.vb === true) parts.push('Vattenburet');
    else if (state.vb === false) parts.push('Ej vattenburet');
    return parts.join(' · ');
  }
  function updateTraces() {
    var t = traceText();
    el('.ek-trace').forEach(function (n) { n.textContent = t; });
  }

  function focusHeading(viewEl) {
    var h = (state.step === 'reveal') ? $('#verdict') : $('.q-title', viewEl);
    if (h) { try { h.focus({ preventScroll: true }); } catch (e) { try { h.focus(); } catch (e2) {} } }
  }

  function goToView(stepId, opts) {
    opts = opts || {};
    var fromEl = $('.view.is-active');
    var toEl = document.getElementById(VIEWS[stepId]);
    if (!toEl || swapping) return;
    state.step = stepId;
    if (fromEl === toEl) { updateChrome(); updateTraces(); return; }

    function finish() {
      swapping = false;
      updateChrome(); updateTraces(); syncIntakeUI();
      window.scrollTo(0, 0);
      focusHeading(toEl);
      if (stepId !== 'reveal') track('step_view', { step: STEP_N[stepId] });
      saveSession();
    }

    if (REDUCED || !fromEl || opts.instant) {
      if (fromEl) { fromEl.classList.remove('is-active', 'is-leaving', 'is-entering'); fromEl.hidden = true; }
      toEl.hidden = false; toEl.classList.add('is-active');
      finish();
      return;
    }
    swapping = true;
    fromEl.classList.add('is-leaving');
    setTimeout(function () {
      fromEl.classList.remove('is-active', 'is-leaving'); fromEl.hidden = true;
      toEl.classList.add('is-entering');
      toEl.hidden = false; toEl.classList.add('is-active');
      toEl.getBoundingClientRect();               /* commit the entering state (forced reflow) */
      toEl.classList.remove('is-entering');       /* -> transitions in over --t-mid; no rAF (throttles in background tabs) */
      finish();
    }, 180);
  }

  function advance(from) {
    var to = nextStep(from);
    try { history.pushState({ step: to }, '', location.href); } catch (e) {}
    if (to === 'reveal') enterReveal(false);
    else goToView(to);
  }

  window.addEventListener('popstate', function (e) {
    var to = (e.state && e.state.step) || 'q1';
    if (to === 'reveal') enterReveal(true);
    else goToView(to);
  });

  /* re-apply state to the intake controls (back nav / resume / deep link) */
  function syncIntakeUI() {
    /* Q1 */
    var grid = $('#q1Grid');
    el('.opt-card', grid).forEach(function (c) {
      c.setAttribute('aria-checked', c.dataset.value === state.q1Card ? 'true' : 'false');
    });
    grid.classList.toggle('is-collapsed', !!state.sys);
    var pumpKind = $('#q1PumpKind');
    var showKind = (state.q1Card === 'pump');
    pumpKind.hidden = !(showKind && !state.sys) && !(showKind && state.sys);
    if (showKind) {
      el('.chip', pumpKind).forEach(function (ch) {
        ch.setAttribute('aria-pressed', ch.dataset.pumpkind === state.sys ? 'true' : 'false');
      });
    } else { pumpKind.hidden = true; }
    var ack = $('#q1Ack');
    if (state.sys && ackFor(state.q1Card)) { ack.textContent = ackFor(state.q1Card); ack.hidden = false; }
    else { ack.hidden = true; }
    var follow = $('#q1Follow');
    follow.hidden = !state.sys;
    if (state.sys) {
      el('.chip', follow).forEach(function (ch) {
        var sysId = ch.dataset.comp;
        ch.hidden = (sysId === state.sys);
        var on = state.comps.some(function (c) { return c.system === sysId; });
        ch.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      $('#q1Next').textContent = state.comps.length ? S.nextDone : S.next;
    }
    /* Q2/Q3/Q3b radiogroups */
    syncRadio('m2', state.m2);
    syncRadio('era', state.era);
    syncRadio('vb', state.vb === true ? '1' : state.vb === false ? '0' : state.vb === 'x' ? 'x' : null);
    /* Q4 */
    var q4v = state.q4 === 'skip' ? 'skip' : (state.q4 ? (state.q4.mode === 'kwh' ? 'kwh' : 'kr') : null);
    syncRadio('q4', q4v);
    $('#q4FieldKr').hidden = (q4v !== 'kr');
    $('#q4FieldKwh').hidden = (q4v !== 'kwh');
    if (state.q4 && state.q4 !== 'skip') {
      var f = (state.q4.mode === 'kwh') ? $('#q4InputKwh') : $('#q4InputKr');
      if (f && !f.value) f.value = state.q4.value;
    }
  }
  function syncRadio(q, value) {
    var group = $('[data-q="' + q + '"]');
    if (!group) return;
    el('.opt-card', group).forEach(function (c) {
      c.setAttribute('aria-checked', (value != null && c.dataset.value === String(value)) ? 'true' : 'false');
    });
  }
  function ackFor(card) {
    if (!card) return null;
    if (card === 'pump') return S.ack.pump;
    if (card === 'vetinte') return S.ack.vetinte;
    return S.ack[card] || null;
  }

  /* roving focus for every radiogroup (arrows move focus; Enter/Space activates) */
  function wireRoving(container) {
    if (!container || container.__roving) return;
    container.__roving = true;
    container.addEventListener('keydown', function (e) {
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].indexOf(e.key) === -1) return;
      var btns = el('button:not([hidden])', container);
      if (!btns.length) return;
      var cur = btns.indexOf(document.activeElement);
      if (cur < 0) cur = 0;
      var next = cur;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(btns.length - 1, cur + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, cur - 1);
      else if (e.key === 'Home') next = 0;
      else next = btns.length - 1;
      e.preventDefault();
      btns.forEach(function (b, i) { b.tabIndex = (i === next) ? 0 : -1; });
      btns[next].focus();
    });
    var btns = el('button', container);
    btns.forEach(function (b, i) { b.tabIndex = i === 0 ? 0 : -1; });
  }

  /* =========================================================================
   * INTAKE WIRING (V4-design §3)
   * ====================================================================== */
  function wireIntake() {
    var grid = $('#q1Grid');
    wireRoving(grid);
    el('.opt-card', grid).forEach(function (card) {
      card.addEventListener('click', function () { onQ1Card(card.dataset.value); });
    });
    el('.chip', $('#q1PumpKind')).forEach(function (ch) {
      ch.addEventListener('click', function () { onQ1PumpKind(ch.dataset.pumpkind); });
    });
    el('.chip', $('#q1Follow')).forEach(function (ch) {
      ch.addEventListener('click', function () { onQ1Comp(ch); });
    });
    $('#q1Next').addEventListener('click', function () {
      track('step_answer', { q: 'q1', value: state.sys });
      advance('q1');
    });

    /* Q2 / Q3 / Q3b band groups: tap -> auto-advance */
    wireBandGroup('m2', 'q2', function (v) {
      state.m2 = v; state.m2Assumed = false;
      if (state.areaExact != null) state.areaExact = null;   /* band answer resets the fine slider seed */
    });
    wireBandGroup('era', 'q3', function (v) {
      state.era = v; state.eraAssumed = (v === 'x');
    });
    wireBandGroup('vb', 'q3b', function (v) {
      state.vb = (v === '1') ? true : (v === '0') ? false : 'x';
    });

    /* Q4 */
    var q4group = $('[data-q="q4"]');
    wireRoving(q4group);
    el('.opt-card', q4group).forEach(function (card) {
      card.addEventListener('click', function () { onQ4Card(card.dataset.value); });
    });
    $('#q4InputKr').addEventListener('input', function () { q4Sanity('kr'); });
    $('#q4InputKwh').addEventListener('input', function () { q4Sanity('kwh'); });
    $('#q4UseKr').addEventListener('click', function () { useQ4('kr'); });
    $('#q4UseKwh').addEventListener('click', function () { useQ4('kwh'); });

    /* back + escape hatches */
    $('#ekBack').addEventListener('click', function () { history.back(); });
    el('.ek-skip').forEach(function (b) {
      b.addEventListener('click', function () { escapeHatch(b.dataset.skipfrom); });
    });
  }

  function onQ1Card(value) {
    var grid = $('#q1Grid');
    /* re-tap on the chosen card while collapsed -> reopen the grid for edit */
    if (state.sys && value === state.q1Card && grid.classList.contains('is-collapsed') && value !== 'pump') {
      state.sys = null; state.sysAssumed = false; state.q1Card = null; state.comps = [];
      syncIntakeUI(); return;
    }
    if (value === 'pump') {
      state.q1Card = 'pump'; state.sys = null; state.sysAssumed = false; state.comps = [];
      el('.opt-card', grid).forEach(function (c) {
        c.setAttribute('aria-checked', c.dataset.value === 'pump' ? 'true' : 'false');
      });
      grid.classList.remove('is-collapsed');
      $('#q1PumpKind').hidden = false;
      $('#q1Ack').hidden = true; $('#q1Follow').hidden = true;
      return;
    }
    state.q1Card = value;
    state.comps = [];
    if (value === 'vetinte') { state.sys = 'direktel'; state.sysAssumed = true; }
    else { state.sys = value; state.sysAssumed = false; }
    $('#q1PumpKind').hidden = true;
    syncIntakeUI();
  }

  function onQ1PumpKind(curId) {
    state.sys = curId; state.sysAssumed = false; state.comps = [];
    syncIntakeUI();
  }

  function onQ1Comp(chip) {
    var sysId = chip.dataset.comp;
    var i = -1;
    state.comps.forEach(function (c, idx) { if (c.system === sysId) i = idx; });
    if (i >= 0) state.comps.splice(i, 1);
    else state.comps.push({ system: sysId, stop: 1, assumed: true });  /* "En del" default, adjustable in Finjustera */
    syncIntakeUI();
  }

  function wireBandGroup(q, step, apply) {
    var group = $('[data-q="' + q + '"]');
    if (!group) return;
    wireRoving(group);
    el('.opt-card', group).forEach(function (card) {
      card.addEventListener('click', function () {
        apply(card.dataset.value);
        syncRadio(q, card.dataset.value);
        track('step_answer', { q: q, value: card.dataset.value });
        var delay = REDUCED ? 0 : 180;
        /* Q3 "Vet inte": the only banded micro-ack; shows 600 ms, never delays under reduced motion */
        if (q === 'era' && card.dataset.value === 'x' && !REDUCED) {
          var ack = $('#q3Ack'); ack.textContent = S.q3VetInte; ack.hidden = false;
          delay = 600;
        }
        setTimeout(function () { $('#q3Ack').hidden = true; advance(step); }, delay);
      });
    });
  }

  function onQ4Card(value) {
    syncRadio('q4', value);
    if (value === 'skip') {
      state.q4 = 'skip';
      $('#q4FieldKr').hidden = true; $('#q4FieldKwh').hidden = true;
      track('intake_skip', { q: 'q4' });
      setTimeout(function () { advance('q4'); }, REDUCED ? 0 : 180);
      return;
    }
    $('#q4FieldKr').hidden = (value !== 'kr');
    $('#q4FieldKwh').hidden = (value !== 'kwh');
    var f = (value === 'kr') ? $('#q4InputKr') : $('#q4InputKwh');
    try { f.focus({ preventScroll: true }); } catch (e) {}
  }

  function q4Sanity(unit) {
    var f = (unit === 'kr') ? $('#q4InputKr') : $('#q4InputKwh');
    var note = (unit === 'kr') ? $('#q4Note') : $('#q4NoteKwh');
    var v = parseFloat(f.value);
    var high = (unit === 'kr') ? (v > 100000) : (v > 60000);  /* [MODEL] UX thresholds, soft, never a block */
    if (isFinite(v) && high) { note.textContent = S.q4High; note.hidden = false; }
    else { note.hidden = true; }
  }

  function useQ4(unit) {
    var f = (unit === 'kr') ? $('#q4InputKr') : $('#q4InputKwh');
    var v = parseFloat(f.value);
    if (!isFinite(v) || v <= 0) {
      state.q4 = 'skip';                       /* empty + use -> treated as "Vet inte", no error */
      track('intake_skip', { q: 'q4' });
    } else {
      v = Math.min(v, 120000);                 /* field max; engine caps, no scold */
      state.q4 = { mode: (unit === 'kwh') ? 'kwh' : 'cost', value: v };
      state.fineOverride = null;
      track('step_answer', { q: 'q4', value: unit });
      track('override_typed', { from: 'intake' });
    }
    advance('q4');
  }

  /* escape hatch: remaining answers -> conservative defaults tagged assumed (Q1 is ALWAYS the user's) */
  function escapeHatch(fromQ) {
    if (!state.sys) return;                    /* no phantom result without Q1 */
    if (!state.m2) { state.m2 = 'b2'; state.m2Assumed = true; }
    if (!state.era) { state.era = 'x'; state.eraAssumed = true; }
    if (needsQ3b() && state.vb == null) state.vb = 'x';
    if (!state.q4) state.q4 = 'skip';
    track('escape_hatch_used', { from_q: fromQ });
    try { history.pushState({ step: 'reveal' }, '', location.href); } catch (e) {}
    enterReveal(false);
  }

  /* =========================================================================
   * THE REVEAL (V4-design §4-§6)
   * ====================================================================== */
  function enterReveal(resume) {
    var first = !state.revealShown;
    var animateIn = first && !resume;
    if (!fineBuilt) buildFine();
    recompute(animateIn);                       /* render into the (still hidden) view first */
    goToView('reveal', { instant: resume });
    updateUrl();                                /* state.step is 'reveal' now: serialise the house to the URL */
    if (animateIn) setTimeout(choreograph, REDUCED ? 0 : 220);   /* start after the view swap */
    else revealFinalState();
    state.revealShown = true;
    if ($('#fine') && window.matchMedia('(min-width:992px)').matches) $('#fine').open = true;
    saveSession();
  }

  function recompute(firstPaint) {
    var R = ENGINE.rankOptions(engineInputs(), D);
    lastRank = R;
    renderVerdict(R);
    renderAnchor(R, firstPaint);
    renderChips();
    renderLadder(R, firstPaint);
    updateUpside(R);
    renderCta(R);
    if (firstPaint && !REDUCED) {
      /* stage the choreography start states (opacity only — no layout shift) */
      $('#verdict').classList.add('rv');
      var cw = $('.chips-wrap');
      if (cw) cw.classList.add('rv');
      $('#storyBar').classList.add('is-drawing');
    }
    var method = $('#method');
    if (method && method.open) drawCurve(R);
    updateUrl();
    saveSession();
  }

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
    if (o.kind === 'combo') return o.label.toLowerCase();
    return (o.label || o.id).toLowerCase();
  }
  function cardName(o) {
    if (o.id === 'luftluft') {
      var prim = (SYS_SHORT[state.sys] || 'det du har').toLowerCase();
      return 'Behåll ' + prim + ' och komplettera med luft-luft';
    }
    return S.cardName[o.id] || o.label;
  }

  /* ---------- R1 verdict ---------- */
  function renderVerdict(R) {
    var v = $('#verdict'), br = R.verdict.branch;
    if (br !== 'standard') { v.textContent = S.verdict[br] || ''; return; }
    var o = bestOption(R);
    if (!o) { v.textContent = S.verdict.litenBesparing; return; }
    var lo = Math.max(0, roundTo(o.saving[0], D.meta.rounding.hero));
    var hi = Math.max(0, roundTo(o.saving[2], D.meta.rounding.hero));
    var range = (lo === hi) ? nf(hi) + ' kr' : nf(lo) + '-' + nf(hi) + ' kr';
    var html = 'För ett hus som ditt ser <b>' + esc(verdictName(o)) + '</b> ut som den rimligaste vägen. ' +
               'Ungefär <b>' + range + '</b> lägre per år';
    if (o.paybackLow != null && o.paybackHigh != null) {
      var pa = roundTo(o.paybackLow, D.meta.rounding.payback), pb = roundTo(o.paybackHigh, D.meta.rounding.payback);
      html += ', återbetalt på ' + (pa === pb ? yrStr(pa) : yrStr(pa) + '-' + yrStr(pb)) + ' år.';
    } else {
      html += '.';
    }
    v.innerHTML = html;
  }

  /* ---------- R2 anchor: number band + THE STORY BAR ---------- */
  var anchorState = { lo: 0, hi: 0, single: false, lead: 0 };

  function anchorValues(R) {
    var measured = !!R.baseline.demandMeasured;
    var sp = measured ? 0 : D.demandSpread;
    var mid = R.baseline.currentAnnual;
    return {
      single: sp === 0,
      lo: Math.max(0, roundTo(mid * (1 - sp), D.meta.rounding.hero)),
      hi: Math.max(0, roundTo(mid * (1 + sp), D.meta.rounding.hero)),
      mid: Math.max(0, roundTo(mid, D.meta.rounding.hero))
    };
  }
  function anchorMarkup(av, countFrom) {
    var lead = av.single ? nf(av.mid) : nf(av.lo);
    var rest = av.single ? '' : '-' + nf(av.hi);
    return '~<span class="a-cnt">' + (countFrom != null ? nf(countFrom) : lead) + '</span>' +
           '<span class="a-rest">' + rest + ' kr</span> <span class="anchor-per">per år</span>';
  }

  function renderAnchor(R, firstPaint) {
    var av = anchorValues(R);
    var num = $('#anchorNum');
    if (firstPaint || !$('.a-cnt', num)) {
      /* first paint (or virgin resume): render the FINAL string; count-up zeroes it later */
      num.innerHTML = anchorMarkup(av);
    } else if (av.lo !== anchorState.lo || av.hi !== anchorState.hi || av.single !== anchorState.single) {
      /* live recompute: 180 ms cross-fade, no re-count-up */
      if (REDUCED) { num.innerHTML = anchorMarkup(av); }
      else {
        num.classList.add('is-fading');
        setTimeout(function () {
          num.innerHTML = anchorMarkup(av);
          num.classList.remove('is-fading');
        }, 90);
      }
    }
    anchorState = { lo: av.lo, hi: av.hi, single: av.single, lead: av.single ? av.mid : av.lo };

    /* badge + band note */
    $('#ownBadge').hidden = !R.baseline.overrideMode;
    var note = $('#bandNote');
    if (anyAssumed() && !R.baseline.demandMeasured) { note.textContent = S.bandNote; note.hidden = false; }
    else { note.hidden = true; }

    /* story bar + legend (min rendered segment 6 %; the LEGEND is the accessible truth) */
    var heat = R.baseline.spaceCost, vv = R.baseline.vvCost, house = R.baseline.householdCost;
    var w = segWidths([heat, vv, house], 6);
    var bar = $('#storyBar');
    $('.sb-heat', bar).style.width = w[0] + '%';
    $('.sb-vv', bar).style.width = w[1] + '%';
    $('.sb-house', bar).style.width = w[2] + '%';
    $('#sbHeatKr').textContent = '~' + krStr(heat, D.meta.rounding.stat);
    $('#sbVvKr').textContent = '~' + krStr(vv, D.meta.rounding.stat);
    $('#sbHouseKr').textContent = '~' + krStr(house, D.meta.rounding.stat);
  }

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

  function countUpAnchor() {
    var num = $('#anchorNum');
    var cnt = $('.a-cnt', num), rest = $('.a-rest', num);
    if (!cnt) return;
    var target = anchorState.lead;
    if (REDUCED) { cnt.textContent = nf(target); if (rest) rest.style.visibility = ''; return; }
    /* pre-size against the final string NOW (the view is visible) — zero layout shift */
    cnt.textContent = nf(target);
    cnt.style.display = 'inline-block';
    cnt.style.minWidth = cnt.offsetWidth + 'px';
    if (rest) rest.style.visibility = 'hidden';
    cnt.textContent = nf(0);
    var t0 = performance.now(), dur = 300;
    function settle() { cnt.textContent = nf(target); if (rest) rest.style.visibility = ''; }
    function frame(t) {
      var p = clamp((t - t0) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      cnt.textContent = nf(roundTo(target * eased, D.meta.rounding.hero));
      if (p < 1) requestAnimationFrame(frame);
      else settle();                              /* the range completes in the same paint */
    }
    requestAnimationFrame(frame);
    setTimeout(settle, dur + 200);                /* safety: rAF throttles in background tabs */
  }

  /* ---------- R3 house chips (the editable trace) ---------- */
  var chipPopKey = null;

  function chipDefs() {
    return [
      { key: 'sys', label: SYS_SHORT[state.sys] || '', asm: state.sysAssumed },
      { key: 'm2', label: state.areaExact != null ? nf(state.areaExact) + ' m²' : (M2_LABEL[state.m2] || ''), asm: state.m2Assumed },
      { key: 'era', label: ERA_LABEL[state.era] === 'Vet inte' ? ERA_LABEL.e2 : (ERA_LABEL[state.era] || ''), asm: state.eraAssumed || state.era === 'x' },
      { key: 'se', label: state.priceArea, asm: !state.seTouched }
    ];
  }

  function renderChips() {
    var box = $('#chips');
    box.innerHTML = '';
    chipDefs().forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip chip-edit';
      b.dataset.edit = c.key;
      b.setAttribute('aria-expanded', chipPopKey === c.key ? 'true' : 'false');
      b.innerHTML = '<span class="chip-lbl">' + esc(c.label) + '</span>' +
                    (c.asm ? ' <span class="chip-asm">' + esc(S.asm) + '</span>' : '');
      b.addEventListener('click', function () { toggleChipPop(c.key); });
      box.appendChild(b);
    });
    var hint = document.createElement('span');
    hint.className = 'chips-hint';
    hint.textContent = S.chipsHint;
    box.appendChild(hint);
  }

  function toggleChipPop(key) {
    var pop = $('#chipPop');
    if (chipPopKey === key) { closeChipPop(); return; }
    chipPopKey = key;
    pop.innerHTML = '';
    pop.setAttribute('role', 'group');
    pop.setAttribute('aria-label', 'Ändra svar');
    chipPopOptions(key).forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt-card opt-card--band';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', opt.on ? 'true' : 'false');
      b.innerHTML = '<span class="opt-lbl">' + esc(opt.label) + '</span>';
      b.addEventListener('click', function () {
        opt.apply();
        closeChipPop();
        recompute(false);
        var chip = $('.chip-edit[data-edit="' + key + '"]');
        if (chip) { try { chip.focus({ preventScroll: true }); } catch (e) {} }
      });
      pop.appendChild(b);
    });
    pop.hidden = false;
    renderChips();
    var firstBtn = $('button', pop);
    if (firstBtn) { try { firstBtn.focus({ preventScroll: true }); } catch (e) {} }
  }
  function closeChipPop() {
    chipPopKey = null;
    var pop = $('#chipPop');
    pop.hidden = true; pop.innerHTML = '';
    renderChips();
  }

  function chipPopOptions(key) {
    var out = [];
    if (key === 'sys') {
      Object.keys(SYS_SHORT).forEach(function (id) {
        out.push({
          label: SYS_SHORT[id], on: state.sys === id,
          apply: function () {
            state.sys = id; state.sysAssumed = false;
            state.q1Card = (id === 'luftluftCur' || id === 'luftvattenCur' || id === 'bergvarmeCur') ? 'pump' : id;
            state.comps = state.comps.filter(function (c) { return c.system !== id; });
            if (needsQ3b() && state.vb == null) state.vb = 'x';   /* conservative until told */
            if (!needsQ3b()) state.vb = state.vb === true || state.vb === false ? state.vb : null;
          }
        });
      });
    } else if (key === 'm2') {
      Object.keys(M2_LABEL).forEach(function (b) {
        out.push({
          label: M2_LABEL[b], on: state.m2 === b && state.areaExact == null,
          apply: function () {
            state.m2 = b; state.m2Assumed = false; state.areaExact = null;
            syncFineArea();
          }
        });
      });
    } else if (key === 'era') {
      ['e1', 'e2', 'e3', 'e4', 'x'].forEach(function (e2) {
        out.push({
          label: ERA_LABEL[e2], on: state.era === e2,
          apply: function () { state.era = e2; state.eraAssumed = (e2 === 'x'); }
        });
      });
    } else if (key === 'se') {
      Object.keys(D.priceAreas).forEach(function (se) {
        out.push({
          label: se, on: state.priceArea === se,
          apply: function () { state.priceArea = se; state.seTouched = true; syncFineSe(); }
        });
      });
    }
    return out;
  }

  /* =========================================================================
   * R4 — ÅTGÄRDSSTEGEN (rung-grouped, ranked, greyed WITH reason, never hidden)
   * ====================================================================== */
  var CARET_SVG = '<svg class="mcard-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6"/></svg>';

  function safeId(id) { return String(id).replace(/[^\w-]/g, ''); }

  /* branch-scoped visibility (V4-design §7 states matrix); max 5 cards */
  function visibleOptions(R) {
    var br = R.verdict.branch, out = [];
    R.options.forEach(function (o) {
      if (br === 'redanEffektiv' || br === 'ingenBesparing') {
        if (o.id === 'behall' || o.id === 'styrning') out.push(o);
        else if (o.eligible && o.saving && o.saving[1] > 0) out.push(o);
      } else {
        out.push(o);
      }
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
    if (o.kind === 'complement') return S.caveat.servedShare;
    if (o.results && o.results.ctx && o.results.ctx.isGround) return S.caveat.viaPartner;
    if (o.caveats && o.caveats.indexOf('vinterSagMedISiffran') !== -1) return S.caveat.vinterSag;
    if (o.flags && o.flags.priceComparison) return S.caveat.pris;
    return null;
  }

  function pairHtml(o, R) {
    var today = R.baseline.currentAnnual;
    if (!(today > 0) || o.futureAnnualLow == null) return '';
    var loCost = o.futureAnnualLow, hiCost = o.futureAnnualHigh;
    var wAfter = clamp(100 * loCost / today, 0, 100);
    var wBand = clamp(100 * (Math.min(hiCost, today) - loCost) / today, 0, 100 - wAfter);
    var name = cardName(o);
    var aria = 'I dag cirka ' + nf(roundTo(today, D.meta.rounding.stat)) + ' kronor per år, med ' +
               name.toLowerCase() + ' cirka ' + nf(Math.max(0, roundTo(loCost, D.meta.rounding.stat))) +
               ' till ' + nf(Math.max(0, roundTo(hiCost, D.meta.rounding.stat))) + ' kronor per år';
    return '' +
      '<div class="pair" role="img" aria-label="' + esc(aria) + '">' +
        '<div class="pair-row">' +
          '<span class="pair-lbl">i dag</span>' +
          '<span class="pair-track"><span class="pair-fill pair-today" style="width:100%"></span></span>' +
          '<span class="pair-val">~' + krStr(today, D.meta.rounding.stat) + '</span>' +
        '</div>' +
        '<div class="pair-row">' +
          '<span class="pair-lbl">efter</span>' +
          '<span class="pair-track">' +
            '<span class="pair-fill pair-after" style="width:' + wAfter.toFixed(1) + '%"></span>' +
            '<span class="pair-band" style="left:' + wAfter.toFixed(1) + '%;width:' + wBand.toFixed(1) + '%"></span>' +
          '</span>' +
          '<span class="pair-val">' + krRange(loCost, hiCost, D.meta.rounding.stat) + '</span>' +
        '</div>' +
      '</div>';
  }

  function factsHtml(o) {
    if (o.id === 'behall' || o.numeric === false || !o.saving) return '';
    var rows = '';
    rows += '<div><dt>' + esc(S.facts.save) + '</dt><dd>' +
            esc(krRange(o.saving[0], o.saving[2], D.meta.rounding.stat) + ' per år') + '</dd></div>';
    if (o.netInvest && (o.netInvest[0] > 0 || o.netInvest[1] > 0)) {
      var iLo = roundTo(o.netInvest[0], D.meta.rounding.stat), iHi = roundTo(o.netInvest[1], D.meta.rounding.stat);
      var iTxt = (iLo === iHi) ? 'ca ' + nf(iLo) + ' kr' : 'ca ' + nf(iLo) + '-' + nf(iHi) + ' kr';
      if (o.kind !== 'styrning') iTxt += S.investRot;   /* styrning: laborShare null => no ROT claimed */
      rows += '<div><dt>' + esc(S.facts.invest) + '</dt><dd>' + esc(iTxt) + '</dd></div>';
    }
    var pTxt;
    if (o.paybackLow != null && o.paybackHigh != null) {
      var pa = roundTo(o.paybackLow, D.meta.rounding.payback), pb = roundTo(o.paybackHigh, D.meta.rounding.payback);
      pTxt = 'på ungefär ' + (pa === pb ? yrStr(pa) : yrStr(pa) + '-' + yrStr(pb)) + ' år';
    } else if (o.paybackMid != null) {
      pTxt = 'på ungefär ' + yrStr(roundTo(o.paybackMid, D.meta.rounding.payback)) + ' år';
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
    return krRange(o.saving[0], o.saving[2], D.meta.rounding.hero);
  }

  function buildCard(o, R, rankNo, expanded, animate) {
    var art = document.createElement('article');
    art.className = 'mcard' + (o.eligible ? '' : ' mcard--off') + (animate ? ' rv' : '');
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
      saveSession();
    });
    return art;
  }

  function renderLadder(R, firstPaint) {
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
          state.open.indexOf(o.id) !== -1, firstPaint && !REDUCED));
      });
      box.appendChild(wrap);

      var over = document.createElement('button');
      over.type = 'button';
      over.className = 'rung-over';
      over.textContent = g.cards.length + ' ' + S.overBudget[g.cards.length === 1 ? 0 : 1];
      over.style.display = 'none';
      over.addEventListener('click', function () {
        rungOpenOverride[g.ri] = true;
        applyLever();
      });
      box.appendChild(over);
    });
    applyLever();
  }

  /* budget lever: presentation ONLY — collapses rungs above the cap, never hides, never recomputes */
  function applyLever() {
    var capIndex = { all: Infinity, r0: 0, r1: 1 }[state.lever];
    if (capIndex == null) capIndex = Infinity;
    el('#ladder .rung-group').forEach(function (wrap) {
      var ri = parseInt(wrap.dataset.rung, 10);
      var over = wrap.nextElementSibling;
      var collapsed = ri > capIndex && !rungOpenOverride[ri];
      wrap.style.display = collapsed ? 'none' : '';
      if (over && over.classList.contains('rung-over')) over.style.display = collapsed ? '' : 'none';
    });
  }

  function wireLever() {
    var lever = $('#lever');
    wireRoving(lever);
    el('button', lever).forEach(function (b) {
      b.addEventListener('click', function () {
        state.lever = b.dataset.lever || 'all';
        rungOpenOverride = {};
        el('button', lever).forEach(function (x) {
          x.setAttribute('aria-checked', x === b ? 'true' : 'false');
        });
        applyLever();
        track('budget_lever', { stop: state.lever });
        saveSession();
      });
    });
  }

  /* =========================================================================
   * R5 — FINJUSTERA (built once; controls are the state, upside re-renders)
   * ====================================================================== */
  var fineRefs = { areaRange: null, areaOut: null, seSeg: null, ownStatus: null, ownInput: null, ownUnit: 'cost' };

  function fineRow(labelHtml, controlEl, microText) {
    var row = document.createElement('div');
    row.className = 'fine-row';
    var lbl = document.createElement('div');
    lbl.className = 'fine-lbl';
    lbl.innerHTML = labelHtml;
    row.appendChild(lbl);
    row.appendChild(controlEl);
    if (microText) {
      var m = document.createElement('p');
      m.className = 'fine-micro';
      m.textContent = microText;
      row.appendChild(m);
    }
    return row;
  }

  function buildSeg(items, currentValue, onPick) {
    var seg = document.createElement('div');
    seg.className = 'seg';
    seg.setAttribute('role', 'radiogroup');
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      b.dataset.value = it.v;
      b.setAttribute('role', 'radio');
      var on = (it.v === currentValue);
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.addEventListener('click', function () {
        el('button', seg).forEach(function (x) {
          var sel = x === b;
          x.classList.toggle('on', sel);
          x.setAttribute('aria-checked', sel ? 'true' : 'false');
        });
        onPick(it.v);
      });
      seg.appendChild(b);
    });
    wireRoving(seg);
    return seg;
  }

  function buildFine() {
    fineBuilt = true;
    var body = $('#fineBody');
    body.innerHTML = '';

    /* 1. Din årsförbrukning — ONLY when Q4 was skipped (the featured trust moment, FIRST) */
    if (!(state.q4 && state.q4 !== 'skip')) {
      var ownWrap = document.createElement('div');
      var unitSeg = buildSeg([{ v: 'cost', label: 'kr/år' }, { v: 'kwh', label: 'kWh' }], fineRefs.ownUnit, function (v) {
        fineRefs.ownUnit = v;
        fineRefs.ownInput.placeholder = (v === 'kwh') ? 't.ex. 20 000' : 't.ex. 25 000';
        unit.textContent = (v === 'kwh') ? 'kWh per år' : 'kr per år';
        onOwnInput();
      });
      var rowEl = document.createElement('div');
      rowEl.className = 'q4-fieldrow';
      rowEl.style.marginTop = 'var(--sp-2)';
      var inp = document.createElement('input');
      inp.className = 'field';
      inp.type = 'number'; inp.inputMode = 'numeric';
      inp.min = 0; inp.max = 120000; inp.step = 100;
      inp.placeholder = 't.ex. 25 000';
      inp.setAttribute('aria-label', 'Din årsförbrukning');
      var unit = document.createElement('span');
      unit.className = 'q4-unit';
      unit.textContent = 'kr per år';
      rowEl.appendChild(inp); rowEl.appendChild(unit);
      var status = document.createElement('p');
      status.className = 'fine-status';
      status.setAttribute('role', 'status');
      status.hidden = true;
      fineRefs.ownInput = inp;
      fineRefs.ownStatus = status;
      function onOwnInput() {
        var v = parseFloat(inp.value);
        var had = !!state.fineOverride;
        if (isFinite(v) && v > 0) {
          state.fineOverride = { mode: (fineRefs.ownUnit === 'kwh') ? 'kwh' : 'cost', value: Math.min(v, 120000) };
          if (!had) {
            status.textContent = S.ownDone;   /* S-92, removed on next change */
            status.hidden = false;
            if (!overrideTypedFired) { track('override_typed', { from: 'fine' }); overrideTypedFired = true; }
          } else { status.hidden = true; }
        } else {
          state.fineOverride = null;
          status.hidden = true;
        }
        recompute(false);
      }
      inp.addEventListener('input', onOwnInput);
      ownWrap.appendChild(unitSeg);
      ownWrap.appendChild(rowEl);
      ownWrap.appendChild(status);
      body.appendChild(fineRow('<span>' + esc(S.fine.own) + '</span>', ownWrap));
    }

    /* 2. Boyta, exakt */
    var areaWrap = document.createElement('div');
    var area = document.createElement('input');
    area.type = 'range'; area.className = 'range';
    area.min = 40; area.max = 400; area.step = 5;
    area.value = currentArea();
    area.setAttribute('aria-label', S.fine.area);
    areaWrap.appendChild(area);
    var areaRow = fineRow('<span>' + esc(S.fine.area) + '</span><output>' + nf(currentArea()) + ' m²</output>', areaWrap);
    fineRefs.areaRange = area;
    fineRefs.areaOut = $('output', areaRow);
    area.addEventListener('input', function () {
      state.areaExact = +area.value;
      fineRefs.areaOut.textContent = nf(state.areaExact) + ' m²';
      recompute(false);
    });
    body.appendChild(areaRow);

    /* 3. Boende */
    var step = document.createElement('div');
    step.className = 'stepper';
    step.innerHTML = '<button type="button" class="stepbtn" data-dir="-1" aria-label="Färre boende">−</button>' +
                     '<span class="stepval">' + state.occupants + '</span>' +
                     '<button type="button" class="stepbtn" data-dir="1" aria-label="Fler boende">+</button>';
    el('.stepbtn', step).forEach(function (b) {
      b.addEventListener('click', function () {
        state.occupants = clamp(state.occupants + (+b.dataset.dir), 1, 8);
        $('.stepval', step).textContent = state.occupants;
        recompute(false);
      });
    });
    body.appendChild(fineRow('<span>' + esc(S.fine.occupants) + '</span>', step));

    /* 4. Innetemperatur */
    var tempWrap = document.createElement('div');
    var temp = document.createElement('input');
    temp.type = 'range'; temp.className = 'range';
    temp.min = 17; temp.max = 24; temp.step = 1;
    temp.value = state.indoorTemp;
    temp.setAttribute('aria-label', S.fine.temp);
    tempWrap.appendChild(temp);
    var tempRow = fineRow('<span>' + esc(S.fine.temp) + '</span><output>' + state.indoorTemp + ' °C</output>', tempWrap, S.fine.tempMicro);
    temp.addEventListener('input', function () {
      state.indoorTemp = +temp.value;
      $('output', tempRow).textContent = state.indoorTemp + ' °C';
      recompute(false);
    });
    body.appendChild(tempRow);

    /* 5. Hur värmen sprids */
    var distSeg = buildSeg([
      { v: 'golvvarme', label: S.fine.distOpts[0] },
      { v: 'radiator', label: S.fine.distOpts[1] },
      { v: 'hogtemp', label: S.fine.distOpts[2] }
    ], state.distribution, function (v) { state.distribution = v; recompute(false); });
    body.appendChild(fineRow('<span>' + esc(S.fine.dist) + '</span>', distSeg));

    /* 6. Elområde (synced with the SE chip) */
    var seSeg = buildSeg(Object.keys(D.priceAreas).map(function (se) { return { v: se, label: se }; }),
      state.priceArea, function (v) { state.priceArea = v; state.seTouched = true; recompute(false); });
    fineRefs.seSeg = seSeg;
    body.appendChild(fineRow('<span>' + esc(S.fine.se) + '</span>', seSeg));

    /* 7. Elnätsbolag (gates the effekttopp UPSIDE row only) */
    var selWrap = document.createElement('div');
    selWrap.className = 'selectwrap';
    var sel = document.createElement('select');
    sel.className = 'field';
    sel.setAttribute('aria-label', S.fine.dso);
    Object.keys(D.dsoEffektavgift).forEach(function (id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = DSO_LABELS[id] || id;
      sel.appendChild(o);
    });
    sel.value = state.dso;
    sel.addEventListener('change', function () { state.dso = sel.value; recompute(false); });
    selWrap.appendChild(sel);
    body.appendChild(fineRow('<span>' + esc(S.fine.dso) + '</span>', selWrap, S.fine.dsoMicro));

    /* 8. Solel (unlocks labelled upside rows; NEVER the hero) */
    var tog = document.createElement('label');
    tog.className = 'toggle';
    tog.innerHTML = '<input type="checkbox"><span class="toggle-track"><span class="toggle-dot"></span></span><span>' + esc(S.fine.solar) + '</span>';
    $('input', tog).addEventListener('change', function (e) {
      state.hasSolar = !!e.target.checked;
      recompute(false);
    });
    var togRow = document.createElement('div');
    togRow.className = 'fine-row';
    togRow.appendChild(tog);
    body.appendChild(togRow);

    /* 9. Komplement-andel per selected complement */
    state.comps.forEach(function (c) {
      var lblHtml = '<span>' + esc(KOMP_SHORT[c.system] || c.system) +
        (c.assumed ? ' <span class="chip-asm">' + esc(S.asm) + '</span>' : '') + '</span>';
      var seg = buildSeg(S.fine.shareStops.map(function (lbl, i) { return { v: String(i), label: lbl }; }),
        String(c.stop != null ? c.stop : 1),
        function (v) {
          c.stop = +v; c.assumed = false;
          var asm = $('.chip-asm', row2);
          if (asm) asm.remove();
          recompute(false);
        });
      var row2 = fineRow(lblHtml, seg);
      body.appendChild(row2);
    });

    /* upside container (rendered per recompute) */
    var up = document.createElement('div');
    up.id = 'ekUpside';
    body.appendChild(up);

    $('#fine').addEventListener('toggle', function () {
      if ($('#fine').open && !refineOpenFired) { track('refine_open'); refineOpenFired = true; }
    });
  }

  function syncFineArea() {
    if (fineRefs.areaRange) {
      fineRefs.areaRange.value = currentArea();
      if (fineRefs.areaOut) fineRefs.areaOut.textContent = nf(currentArea()) + ' m²';
    }
  }
  function syncFineSe() {
    if (fineRefs.seSeg) {
      el('button', fineRefs.seSeg).forEach(function (b) {
        var on = b.dataset.value === state.priceArea;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }
  }

  /* upside block: ONLY inside Finjustera, only when rows unlock (frozen law) */
  function updateUpside(R) {
    var box = $('#ekUpside');
    if (!box) return;
    box.innerHTML = '';
    var upside = R.baseline.results && R.baseline.results.upside;
    if (!upside) return;
    var unlocked = upside.rows.some(function (r) { return r.key !== 'stodtjanster'; });
    if (!unlocked) return;
    var head = document.createElement('div');
    head.className = 'upside-head';
    head.innerHTML = esc(S.fine.upside) + ' <span>' + esc(S.fine.upsideMicro) + '</span>';
    box.appendChild(head);
    upside.rows.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'urow';
      var noteHtml = (r.key === 'stodtjanster') ? ' <i>' + esc(S.fine.atRisk) + '</i>' : '';
      d.innerHTML = '<span class="un">' + esc(r.label) + noteHtml + '</span>' +
                    '<span class="uv">+ ~' + esc(krStr(r.value, 100)) + ' per år</span>';
      box.appendChild(d);
    });
  }

  /* =========================================================================
   * R6 — CTA + inline lead form (the earned ask)
   * ====================================================================== */
  function renderCta(R) {
    var cta = $('#ctaBtn');
    if (!cta) return;
    var soft = R.verdict.branch !== 'standard';
    cta.classList.toggle('cta--soft', soft);
    cta.textContent = soft ? S.cta.soft : S.cta.plan;
  }

  function wireLead() {
    var cta = $('#ctaBtn');
    if (!WEBHOOK) {
      /* webhook null config: form hidden entirely, CTA links to /kontakt/ — never a dead submit */
      var a = document.createElement('a');
      a.className = cta.className;
      a.id = 'ctaBtn';
      a.href = 'https://ampy.se/kontakt/';
      a.textContent = cta.textContent;
      cta.parentNode.replaceChild(a, cta);
      a.addEventListener('click', function () { track('cta_click', { mode: 'kontakt' }); });
      $('#lead').hidden = true;
      return;
    }
    cta.addEventListener('click', function () {
      var open = cta.getAttribute('aria-expanded') !== 'true';
      track('cta_click');
      setLeadOpen(open);
    });
    $('#leadClose').addEventListener('click', function () { setLeadOpen(false); });
    $('#lead').addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { setLeadOpen(false); }
    });
    $('#leadForm').addEventListener('submit', submitLead);
    [['#leadName', validateName], ['#leadPhone', validatePhone], ['#leadZip', validateZip], ['#leadEmail', validateEmail]]
      .forEach(function (pair) {
        var f = $(pair[0]);
        if (f) f.addEventListener('blur', function () { if (f.value) pair[1](); });
      });
  }

  function setLeadOpen(open) {
    var cta = $('#ctaBtn'), lead = $('#lead');
    cta.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      $('#leadForm').hidden = false;
      $('#leadSuccess').hidden = true;
      lead.hidden = false;
      lead.getBoundingClientRect();
      lead.classList.add('open');
      track('lead_form_open');
      setTimeout(function () {
        try { $('#leadName').focus({ preventScroll: true }); } catch (e) {}
      }, REDUCED ? 0 : 300);
    } else {
      lead.classList.remove('open');
      setTimeout(function () { lead.hidden = true; }, REDUCED ? 0 : 300);
      try { cta.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  /* per-field validation (vB pattern, V4 strings) */
  function setErr(fieldSel, errSel, msg) {
    var f = $(fieldSel), e = $(errSel);
    if (msg) { f.setAttribute('aria-invalid', 'true'); e.textContent = msg; e.hidden = false; return false; }
    f.removeAttribute('aria-invalid'); e.hidden = true; return true;
  }
  function validateName() {
    var v = $('#leadName').value.trim();
    return setErr('#leadName', '#errName', v ? null : S.err.name);
  }
  function validatePhone() {
    var v = $('#leadPhone').value.trim();
    var ok = v.replace(/[\s\-()+.]/g, '').length >= 7 && /\d/.test(v);
    return setErr('#leadPhone', '#errPhone', ok ? null : S.err.phone);
  }
  function validateZip() {
    var v = $('#leadZip').value.replace(/\s/g, '');
    return setErr('#leadZip', '#errZip', /^\d{5}$/.test(v) ? null : S.err.zip);
  }
  function validateEmail() {
    var v = $('#leadEmail').value.trim();
    if (!v) return setErr('#leadEmail', '#errEmail', null);   /* e-post valfri */
    return setErr('#leadEmail', '#errEmail', /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : S.err.email);
  }

  function leadPayload() {
    var R = lastRank;
    return {
      tool: 'energikollen-v4',
      name: $('#leadName').value.trim(),
      phone: $('#leadPhone').value.trim(),
      zip: $('#leadZip').value.replace(/\s/g, ''),
      email: $('#leadEmail').value.trim() || null,
      config: {
        sys: state.sys, sysAssumed: state.sysAssumed,
        comps: state.comps.map(function (c) { return { system: c.system, stop: c.stop, assumed: c.assumed }; }),
        m2: state.m2, m2Assumed: state.m2Assumed,
        era: state.era, eraAssumed: state.eraAssumed,
        vb: state.vb, se: state.priceArea,
        area: currentArea(), occupants: state.occupants, indoorTemp: state.indoorTemp,
        distribution: state.distribution, dso: state.dso, hasSolar: state.hasSolar,
        override: (R && R.baseline.overrideMode) || null,
        branch: R ? R.verdict.branch : null,
        savingBucket: R ? bucketKr(R.verdict.bestSavingMid) : '0',   /* BUCKETED, never raw */
        openedCards: state.open.slice()
      }
    };
  }

  var leadPending = false;
  function submitLead(e) {
    e.preventDefault();
    if ($('#leadCompany').value) return;    /* honeypot tripped: silently drop */
    if (leadPending) return;
    var okName = validateName(), okPhone = validatePhone(), okZip = validateZip(), okEmail = validateEmail();
    var okGdpr = setErr('#leadGdpr', '#errGdpr', $('#leadGdpr').checked ? null : S.err.gdpr);
    if (!(okName && okPhone && okZip && okEmail && okGdpr)) {
      var firstBad = $('[aria-invalid="true"]');
      if (firstBad) { try { firstBad.focus({ preventScroll: true }); } catch (e2) {} }
      return;
    }
    $('#leadErr').hidden = true;
    leadPending = true;
    var btn = $('#leadForm .cta--submit');
    if (btn) btn.disabled = true;
    fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadPayload())
    }).then(function (res) {
      leadPending = false;
      if (btn) btn.disabled = false;
      if (res.ok) {
        $('#leadForm').hidden = true;
        $('#leadSuccess').hidden = false;
        track('lead_submitted');
      } else {
        $('#leadErr').textContent = S.err.submit;
        $('#leadErr').hidden = false;
      }
    }).catch(function () {
      leadPending = false;
      if (btn) btn.disabled = false;
      $('#leadErr').textContent = S.err.submit;
      $('#leadErr').hidden = false;
    });
  }

  /* =========================================================================
   * R7 — the demoted 12-month curve (vB smoothPath, namespace-safe DOMParser)
   * ====================================================================== */
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* monotone cubic Hermite (Fritsch-Carlson) — never overshoots the data (vB, proven) */
  function smoothPath(pts) {
    var n = pts.length;
    if (n < 2) return '';
    if (n === 2) return 'M' + pts[0].x.toFixed(2) + ',' + pts[0].y.toFixed(2) + ' L' + pts[1].x.toFixed(2) + ',' + pts[1].y.toFixed(2);
    var i, dx = [], dy = [], m = [], t = [];
    for (i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; dy[i] = pts[i + 1].y - pts[i].y; m[i] = dy[i] / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) {
      if (m[i - 1] * m[i] <= 0) t[i] = 0;
      else t[i] = (m[i - 1] + m[i]) / 2;
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

  function curveOption(R) {
    var best = bestOption(R);
    if (best && best.results && best.eligible && best.kind !== 'behall') return best;
    for (var i = 0; i < R.options.length; i++) {
      var o = R.options[i];
      if (o.results && o.id !== 'behall' && (o.kind === 'replace' || o.kind === 'complement')) return o;
    }
    return null;
  }

  function drawCurve(R) {
    var svg = $('#curve');
    if (!svg || !R) return;
    var opt = curveOption(R);
    if (!opt) return;
    var r = opt.results;
    var isGround = !!(r.ctx && r.ctx.isGround);
    $('#curveCap').textContent = isGround ? S.curveCapGround : S.curveCapAir;

    var cur = R.baseline.results.currentCost;
    var pump = r.pumpCost, loB = r.pumpCostLow, hiB = r.pumpCostHigh;
    var c = { x0: 30, x1: 352, yTop: 26, yBase: 166, lblY: 184, vbW: 372, vbH: 196 };
    var maxV = 0, i;
    for (i = 0; i < 12; i++) maxV = Math.max(maxV, cur[i], hiB[i]);
    if (maxV <= 0) maxV = 1;
    function X(m) { return c.x0 + m * (c.x1 - c.x0) / 11; }
    function Y(v) { return c.yBase - (v / maxV) * (c.yBase - c.yTop); }
    function ptsOf(arr) { var a = []; for (var m = 0; m < 12; m++) a.push({ x: X(m), y: Y(arr[m]) }); return a; }
    function ribbon() {
      var top = smoothPath(ptsOf(hiB));
      var loRev = ptsOf(loB).slice().reverse();
      var bot = smoothPath(loRev).replace(/^M([\d.\-]+),([\d.\-]+)/, 'L$1,$2');
      return top + ' ' + bot + ' Z';
    }
    var pk = 0, mv = -1;
    for (i = 0; i < 12; i++) if (cur[i] > mv) { mv = cur[i]; pk = i; }

    var title = '<title id="curveT">Kostnad månad för månad</title>' +
      '<desc id="curveD">' + esc(isGround ? S.curveDescGround : S.curveDescAir) + '</desc>';
    var g = '';
    g += '<line x1="' + c.x0 + '" y1="' + c.yBase + '" x2="' + c.x1 + '" y2="' + c.yBase + '" stroke="rgba(9,11,50,.14)" stroke-width="1"/>';
    var g1 = c.yTop + (c.yBase - c.yTop) / 3, g2 = c.yTop + 2 * (c.yBase - c.yTop) / 3;
    g += '<line x1="' + c.x0 + '" y1="' + g1.toFixed(1) + '" x2="' + c.x1 + '" y2="' + g1.toFixed(1) + '" stroke="rgba(9,11,50,.06)" stroke-width="1"/>';
    g += '<line x1="' + c.x0 + '" y1="' + g2.toFixed(1) + '" x2="' + c.x1 + '" y2="' + g2.toFixed(1) + '" stroke="rgba(9,11,50,.06)" stroke-width="1"/>';
    g += '<path d="' + ribbon() + '" fill="rgba(0,169,145,.12)"/>';
    g += '<path d="' + smoothPath(ptsOf(cur)) + '" fill="none" stroke="#8b95bd" stroke-width="1.6" stroke-dasharray="2 4" stroke-linecap="round" stroke-linejoin="round"/>';
    g += '<path d="' + smoothPath(ptsOf(pump)) + '" fill="none" stroke="#00a991" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
    for (var lm = 0; lm < 12; lm++) {
      g += '<text x="' + X(lm).toFixed(1) + '" y="' + c.lblY + '" text-anchor="middle" font-size="9" font-family="Outfit" fill="' + (lm === pk ? '#1e1e1e' : '#8a93b5') + '">' + D.months[lm] + '</text>';
    }
    var anchor = (X(pk) < c.x0 + 24) ? 'start' : (X(pk) > c.x1 - 24) ? 'end' : 'middle';
    g += '<text x="' + X(pk).toFixed(1) + '" y="' + (c.yTop - 8) + '" text-anchor="' + anchor + '" font-size="10" font-weight="500" font-family="Outfit" fill="#00a991">' + esc(D.monthsLong[pk].slice(0, 3)) + '-toppen</text>';
    g += '<text x="' + c.x1 + '" y="' + (Y(cur[11]) - 6).toFixed(1) + '" text-anchor="end" font-size="9" font-family="Outfit" fill="#51607a">i dag</text>';
    g += '<text x="' + c.x1 + '" y="' + (Y(pump[11]) + 12).toFixed(1) + '" text-anchor="end" font-size="9" font-family="Outfit" fill="#00a991">' + esc(r.ctx.pumpLabel.toLowerCase()) + '</text>';

    var parsed = new DOMParser().parseFromString('<svg xmlns="' + SVGNS + '">' + title + g + '</svg>', 'image/svg+xml');
    if (parsed.querySelector('parsererror')) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    Array.prototype.slice.call(parsed.documentElement.childNodes).forEach(function (n) {
      svg.appendChild(document.importNode(n, true));
    });
  }

  function wireMethod() {
    var method = $('#method');
    method.addEventListener('toggle', function () {
      if (method.open && lastRank) drawCurve(lastRank);
    });
  }

  /* =========================================================================
   * R8 — share (URL codec; house state ONLY, no identity, no tracking)
   * ====================================================================== */
  function codecState() {
    var ovr = activeOverride();
    return {
      sys: state.sys,
      comps: state.comps.map(function (c) { return { system: c.system, stop: c.stop != null ? c.stop : 1 }; }),
      m2: state.m2,
      era: state.era,
      vb: state.vb === true ? true : state.vb === false ? false : (state.vb === 'x' ? 'x' : (state.sys ? resolvedVb() : null)),
      kwh: ovr && ovr.mode === 'kwh' ? ovr.value : null,
      kr: ovr && (ovr.mode === 'cost' || ovr.mode === 'kr') ? ovr.value : null,
      se: state.priceArea
    };
  }
  function shareUrl() {
    var q = CODEC.encode(codecState());
    return location.origin + location.pathname + (q ? '?' + q : '');
  }
  function updateUrl() {
    if (state.step !== 'reveal') return;
    try { history.replaceState({ step: 'reveal' }, '', shareUrl()); } catch (e) {}
  }

  function wireShare() {
    var btn = $('#shareBtn');
    btn.addEventListener('click', function () {
      track('share_tap');
      var url = shareUrl();
      if (navigator.share) {
        navigator.share({ title: 'Energikollen', text: S.shareText, url: url })['catch'](function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          var lbl = $('#shareLbl');
          var prev = lbl.textContent;
          lbl.textContent = S.shareCopied;
          setTimeout(function () { lbl.textContent = prev; }, 2000);
        })['catch'](function () {});
      }
    });
  }

  /* =========================================================================
   * THE REVEAL CHOREOGRAPHY (one 900 ms entrance; every element <=300 ms)
   * ====================================================================== */
  function revealFinalState() {
    /* resume / recompute path: everything renders final, instantly */
    var v = $('#verdict');
    v.classList.add('rv', 'rv-in');
    var cw = $('.chips-wrap');
    if (cw) cw.classList.add('rv', 'rv-in');
    el('#ladder .mcard').forEach(function (c2) { c2.classList.add('rv-in'); });
    var bar = $('#storyBar');
    bar.classList.remove('is-drawing');
    bar.classList.add('is-drawn');
    var cnt = $('.a-cnt', $('#anchorNum'));
    if (cnt) {
      cnt.textContent = nf(anchorState.lead);
      var rest = $('.a-rest', $('#anchorNum'));
      if (rest) rest.style.visibility = '';
    }
    try { v.focus({ preventScroll: true }); } catch (e) {}
    track('reveal_view');
  }

  function choreograph() {
    if (REDUCED) { revealFinalState(); return; }
    var v = $('#verdict');
    var cw = $('.chips-wrap');
    var bar = $('#storyBar');
    track('reveal_view');

    /* t=0 — verdict fades in; focus lands on it (start states staged by recompute) */
    v.getBoundingClientRect();
    v.classList.add('rv-in');
    try { v.focus({ preventScroll: true }); } catch (e) {}
    /* t=150 — the anchor count-up (pre-sized; the range completes in the same paint) */
    setTimeout(countUpAnchor, 150);
    /* t=300 — the story bar draws left-to-right, 45 ms stagger (CSS delays) */
    setTimeout(function () {
      bar.getBoundingClientRect();
      bar.classList.remove('is-drawing');
      bar.classList.add('is-drawn');
    }, 300);
    /* t=450 — house chips fade in */
    setTimeout(function () { cw.classList.add('rv-in'); }, 450);
    /* t=600 — ladder cards, 45 ms stagger */
    setTimeout(function () {
      el('#ladder .mcard').forEach(function (card, i) {
        setTimeout(function () { card.classList.add('rv-in'); }, i * 45);
      });
    }, 600);
  }

  /* =========================================================================
   * BOOT — URL params (ad deep-link + share link) > session resume > Q1
   * ====================================================================== */
  function applyDecoded(dec) {
    if (dec.sys) {
      state.sys = dec.sys;
      state.sysAssumed = false;
      state.q1Card = (dec.sys === 'luftluftCur' || dec.sys === 'luftvattenCur' || dec.sys === 'bergvarmeCur') ? 'pump' : dec.sys;
    }
    if (dec.comps && dec.comps.length) {
      state.comps = dec.comps.filter(function (c) { return c.system !== state.sys; })
        .map(function (c) { return { system: c.system, stop: c.stop, assumed: false }; });
    }
    if (dec.m2) { state.m2 = dec.m2; state.m2Assumed = false; }
    if (dec.era) { state.era = dec.era; state.eraAssumed = (dec.era === 'x'); }
    if (dec.vb === true || dec.vb === false || dec.vb === 'x') state.vb = dec.vb;
    if (dec.kwh) state.q4 = { mode: 'kwh', value: dec.kwh };
    else if (dec.kr) state.q4 = { mode: 'cost', value: dec.kr };
    if (dec.se) { state.priceArea = dec.se; state.seTouched = true; }
  }

  function restoreSession(saved) {
    var a = saved.a;
    ['q1Card', 'sys', 'sysAssumed', 'm2', 'm2Assumed', 'era', 'eraAssumed', 'vb', 'q4', 'fineOverride',
     'areaExact', 'occupants', 'indoorTemp', 'distribution', 'priceArea', 'seTouched', 'dso', 'hasSolar', 'lever']
      .forEach(function (k) { if (a[k] !== undefined) state[k] = a[k]; });
    state.comps = Array.isArray(a.comps) ? a.comps : [];
    state.open = Array.isArray(a.open) ? a.open : [];
  }

  function firstUnansweredStep() {
    if (!state.sys) return 'q1';
    if (!state.m2) return 'q2';
    if (!state.era) return 'q3';
    if (needsQ3b() && state.vb == null) return 'q3b';
    return 'reveal';   /* fully-specified link lands DIRECTLY on the reveal (their editable copy) */
  }

  function boot() {
    wireIntake();
    wireLever();
    wireLead();
    wireMethod();
    wireShare();
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && chipPopKey) closeChipPop();
    });

    var entry = 'q1';
    var search = location.search || '';
    var dec = CODEC.decode(search);
    var hasParams = !!(dec.sys || dec.m2 || dec.era || dec.vb != null || dec.kwh || dec.kr || dec.se);
    var flowOff = /[?&]flow=off(&|$)/.test(search);

    if (flowOff) {
      /* the canvas-with-defaults fallback: same build minus the on-ramp, everything assumed */
      if (!state.sys) { state.sys = D.defaultCurrentSystem; state.sysAssumed = true; state.q1Card = 'vetinte'; }
      if (!state.m2) { state.m2 = 'b2'; state.m2Assumed = true; }
      if (!state.era) { state.era = 'x'; state.eraAssumed = true; }
      if (needsQ3b() && state.vb == null) state.vb = 'x';
      if (!state.q4) state.q4 = 'skip';
      entry = 'reveal';
    } else if (hasParams) {
      applyDecoded(dec);
      entry = firstUnansweredStep();
      if (entry === 'reveal' && !state.q4) state.q4 = 'skip';   /* silent; no intake_skip event */
    } else {
      var saved = loadSession();
      if (saved) {
        restoreSession(saved);
        entry = (saved.step === 'reveal') ? 'reveal' : saved.step;
        if (entry !== 'reveal') {
          var must = firstUnansweredStep();
          var f = flow();
          if (f.indexOf(entry) === -1 || f.indexOf(entry) > f.indexOf(must)) entry = must;   /* never past an unanswered gate */
        }
      }
    }

    try { history.replaceState({ step: entry }, '', location.href); } catch (e) {}
    if (entry === 'reveal') enterReveal(hasParams ? false : true);
    else goToView(entry, { instant: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
