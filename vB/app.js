/* =============================================================================
 * app.js — Ampy energikalkylatorn — vB · v9 "Sparstaplarna" (V9-SPEC.md)
 * Renderer + interactions. The two-pane single-canvas calculator, live recompute.
 *   LEFT:  ONE merged heat list (8 systems + Vet inte, multi-select) → boyta → byggår →
 *          boende → elområde → own-figure kWh SLIDER (all-electric stacks only)
 *          → solceller Nej/Finns/Planeras (+ production slider).
 *          7 controls, flat, zero keyboards, zero free-text numerics.
 *   RIGHT: energy-TOTAL anchor (uppvärmning + varmvatten + hushållsel) → story bar
 *          (3-post legend) → SPARSTAPLARNA (#spark: horizontal SAVING bars, one per
 *          option, shared scale, ★ ring on the lead, tap a bar → dropdown with the
 *          verdict + investering/payback) → CTA block (dominant primary + quiet share)
 *          → method (bullets + legal, NO curve).
 *   Candour invariant: the anchor TOTAL is display-only; every bar reads o.saving[]
 *   verbatim (heat+VV base, frozen), so household never touches a saving.
 * engine.js calculate() carries exactly the two spec'd v7 deltas. rank.js
 * (AmpyRank.rankOptions + recommend, AmpyCodec) is the pure additive layer.
 * data.js owns every number. Rounding + Swedish formatting HERE.
 * ========================================================================== */

(function () {
  'use strict';
  var D = window.AMPY_DATA;
  var ENGINE = window.AmpyEngine;
  var RANK = window.AmpyRank;
  var CODEC = window.AmpyCodec;
  if (!D || !ENGINE || !RANK) { return; }

  /* ---------- tiny DOM + format helpers (KEEP) ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var REDUCED = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var EMPTY = '—'; /* the ONE sanctioned em-dash: the empty payback readout */

  function nf(n) { return Math.round(n).toLocaleString('sv-SE').replace(/[\u0020\u00A0\u202F]/g, '\u00A0'); } /* d-p1: sv-SE emits NBSP or NNBSP depending on engine — normalize to NBSP so figures never break (comment dash sanctioned: code comment, not copy) */
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
  /* saving/payback fragments for the comparison micro-line */
  function savRange(lo, hi, step) {
    var a = Math.max(0, roundTo(lo, step)), b = Math.max(0, roundTo(hi, step));
    return (a === b) ? nf(a) + ' kr' : nf(a) + '-' + nf(b) + ' kr';
  }
  function pbRange(lo, hi) {
    var a = roundTo(lo, ROUND.payback), b = roundTo(hi, ROUND.payback);
    return (a === b) ? '~' + yrStr(a) + ' år' : '~' + yrStr(a) + '-' + yrStr(b) + ' år';
  }
  /* Sparstaplarna saving value: '~lo-hi kr/år' (bulletproof unit), collapses to '~mid kr/år' */
  function savRangeYr(lo, hi, step) {
    var a = Math.max(0, roundTo(lo, step)), b = Math.max(0, roundTo(hi, step));
    return (a === b) ? '~' + nf(a) + ' kr/år' : nf(a) + '-' + nf(b) + ' kr/år';   /* range: no ~ */
  }
  var ROUND = (D.meta && D.meta.rounding) ? D.meta.rounding : { hero: 1000, stat: 500, payback: 0.5 };

  /* ---------- instrumentation (consent-gated, bucketed, experiment_id) ---------- */
  function hasConsent() { return window.ampyConsent === true || window.AMPY_CONSENT === true; }
  function track(ev, params) {
    if (!hasConsent()) return; /* no event fires without consent state */
    try {
      var p = { event: 'ek_' + ev, experiment_id: 'energikalkylatorn-v10' };
      if (params) for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
      (window.dataLayer = window.dataLayer || []).push(p);
    } catch (e) {}
  }
  function bucketKr(v) { /* savings are BUCKETED, never raw */
    if (v == null || !(v > 0)) return '0';
    var lo = Math.floor(v / 5000) * 5000;
    return lo + '-' + (lo + 5000);
  }
  function bucketKwh(v) { /* own-slider kWh, bucketed 5 000 (playbook: never raw sliders) */
    if (v == null || !(v > 0)) return '0';
    var lo = Math.floor(v / 5000) * 5000;
    return lo + '-' + (lo + 5000);
  }

  /* ---------- the copy deck (V7-COPY.md; rost-final, grep-clean) ---------- */
  /* Slot convention: {slot} filled at render via fill(); {b}..{/b} = bold span.
   * The copy NEVER hard-codes a kr/år or payback figure — every number is a slot. */
  function fill(tpl, map) {
    return tpl.replace(/\{(\/?b|[a-zA-Z]+)\}/g, function (m, key) {
      if (key === 'b') return '<b>';
      if (key === '/b') return '</b>';
      return (map && map[key] != null) ? esc(String(map[key])) : m;
    });
  }
  var S = {
    hintVetinte: 'Vi räknar försiktigt på direktverkande el tills du vet mer. Det går att ändra sen.',
    hintFjarr: 'Fjärrvärme jämförs på pris. Kamin och luft-luft går bra att lägga till.',
    cardName: {
      behall: 'Behåll det du har',
      styrning: 'Smart styrning av värmen',
      luftvatten: 'Luft-vatten värmepump',
      bergvarme: 'Bergvärme'
    },
    leadName: { /* the plate's inline lead label (lower case, worked pattern) */
      luftluft: 'luft-luft som komplement',
      luftvatten: 'luft-vatten',
      bergvarme: 'bergvärme'
    },
    reason: {
      redanVarmepump: 'Huset värms redan av en värmepump. Vi visar siffran som jämförelse, inte som råd.',
      luftluftFinnsRedan: 'Luft-luft finns redan i huset, så en till ger litet utrymme till mer.',
      styrningEjStyrbar: 'Kräver värme som går att styra elektroniskt. Ved och pellets eldas för hand.'
    },
    rec: {
      /* V10 m-p2: the dead plate/body/sec/disclose decks are DELETED — the
       * Sparstaplarna dropdowns (S.spark) carry ALL advice copy now. */
      addOn: {
        styrning: 'Kombinera med smart styrning: värmen styrs efter pris och behov. Vi sätter en siffra på det först när källan är granskad.',
        kaminSpets: 'Kaminen tar topparna de kallaste dagarna. Det håller nere elräkningen när den annars är som högst.',
        merLuftluft: 'I ett hus i din storlek kan ytterligare en luft-luft ta en större del av värmen. En elektriker ser var den gör nytta.',
        endOfLifeOlja: 'När pannan ändå närmar sig sitt slut ändras kalkylen: då jämför du nypriser, inte mot en fungerande panna. Boverkets nya stöd för vattenburen värme kan vara värt att bevaka, vi räknar inte med det.',
        endOfLifeFranluft: 'Närmar sig pumpen bytesålder ändras kalkylen: då jämför du nypriser, inte mot en fungerande pump. Det är rätt läge att räkna om här.',
        vattenburetAdder: 'Kräver vattenburet system. Det finns inte i huset idag, så vi har räknat med {vbRange} kr extra för att lägga till det. Det ingår i investeringssiffran.',
        batteri: 'Med solceller på taket är ett solcellsbatteri ett rimligt nästa steg: ungefär {battRange} per år i ökat värde av din egen el. Pris från {battGross} kr, efter grön teknik 50 procent cirka {battNet} kr.',
        batteriPlaneras: 'När solcellerna är på plats blir ett batteri nästa fråga. Vi räknar på det när anläggningen finns.',
        vetinteHedge: 'Vi räknar försiktigt på direktverkande el tills du vet mer.'
      },
      announce: 'Vald väg: {namn}. Rekommendationen visas nedan.'
    },
    spark: {
      recLabel: 'Vår rekommendation',
      /* V10 (owner P1-P5): the LEAD row's dropdown = branchIntro[branch] (when defined)
       * + the option sentence + longPbLine (when rec.longPb) + the figure rows.
       * Non-lead rows keep their plain option sentence; disclose = NON-lead rows only. */
      branchIntro: {
        uppgradering:  'En äldre frånluftspump tar bara en del av värmen ur ventilationsluften, resten kommer från el. Ett hus som ditt är byggt för att uppgraderas.',
        heltackning:   'Din luft-luft värmer där luften når. Det här alternativet tar hela huset.',
        fjarrvarmePris:'Det här är en prisjämförelse mot fjärrvärmens pris, cirka 1,20 kr per kWh som riksgenomsnitt, inte en verkningsgradssiffra. Din taxa avgör, kontrollera den på fakturan.',
        delvisLost:    'Din värmepump gör redan en del av jobbet. Kvar att jobba med är {residualLabel}, ungefär {residualShare} procent av värmen, cirka {residualKr} kr per år. Det här alternativet tar hela huset.',
        komfortKrona:  'Vedvärme ger billig värme men kostar arbete: bära, elda och passa. Det här alternativet ger värme utan vedbärandet. Vi räknar på köpt ved, cirka 1,45 kr per kWh. Eldar du egen ved är vinsten främst komfort, inte kronor.',
        litenBesparing:'Besparingen är liten för ditt hus, ungefär {savingRange} kr per år. Vi rekommenderar den ändå som det rimligaste steget, utan brådska.'
      },
      /* OWNER POLICY V10 (P2): a long payback never mutes the ★ — it is stated PLAINLY.
       * ("mest med dina siffror" = a computed in-list fact, not a market superlative.) */
      longPbLine: 'Ärligt räknat är den återbetald först på ungefär {pbRange} år. Det är ändå den åtgärd som sänker din driftkostnad mest med dina siffror.',
      verdict: {
        luftluft:        'En luft-luftvärmepump tar en stor del av värmen till en bråkdel av kostnaden. Det du värmer med idag sitter kvar som reserv i rummen den inte når.',
        luftvattenWb:    'En luft-vatten värmepump kopplas på dina vattenburna element och hämtar större delen av värmen ur luften. Tappet i kyla är inräknat.',
        luftvattenNoWb:  'En luft-vatten värmepump värmer hela huset via vattenburna element. Huset saknar det systemet idag, så {vbRange} kr för att lägga till det ingår i investeringen.',
        bergvarme:       'Bergvärme hämtar värmen ur berget och ligger stabilt året om, även i sträng kyla. Den kräver borrhål på tomten, via partner.',
        styrning:        'Styr värmen efter pris och behov, utan ingrepp i huset. Vi sätter en siffra först när källan är granskad.',
        behall:          'Så här ligger du idag. Siffrorna ovan är räknade mot den här kostnaden. Noll kronor i investering, och du kan räkna om här när något ändras.',
        batteri:         'Ett solcellsbatteri ökar värdet av elen du redan producerar. Mer används i huset, och det kan köpa el när den är billig och använda den när den är dyr.',
        batteriLead:     'Din värmepump gör redan jobbet. Det som är kvar att hämta ligger i din solel: ett batteri ökar värdet av elen du producerar, ungefär {battRange} per år. Stödtjänster räknar vi aldrig in i summan.',
        styrningLead:    'Din uppvärmning är redan effektiv. Det rimliga nästa steget är smart styrning: värmen styrs efter pris och behov, utan ingrepp i huset. Kräver timprisavtal. Vi sätter en siffra först när källan är granskad, därför visas den utan pris.',
        service:         'Din uppvärmning gör redan jobbet. Det som skyddar den är service: rena filter och rätt inställningar håller verkningsgraden uppe. Vi sätter ingen siffra på det här, men en genomgång av pumpens drift och styrning är ett rimligt nästa steg.',
        solplan:         'Du planerar solceller, och det är rätt ordning att ta dem först. När anläggningen är på plats blir ett batteri nästa fråga. Vi räknar gärna på hela paketet.',
        /* P2 reworded: disclose applies to NON-lead rows only — we now recommend long paybacks when they lead */
        discloseLuftvatten: 'Med dina siffror är luft-vatten återbetald först på {pbRange} år. Siffran står här som jämförelse.',
        discloseBergvarme:  'Med dina siffror är bergvärme återbetald först på {pbRange} år, och den kräver borrhål via partner. Siffran står här som jämförelse.',
        dyrare:          'Det här bytet ökar kostnaden i ditt hus. Vi visar det för ärlighetens skull.'
      },
      /* V10 (P4/AR-3): quiet action rows — "utan pris", no bar, NO invented numbers */
      actionName: { service: 'Service och trimning av värmepumpen', solplan: 'Solceller med batteri' },
      /* v30 (owner-exact): the dropdown stat-row labels */
      figInvest: 'Investering efter ROT', figPayback: 'Återbetalningstid', figSaving: 'Besparing per år',
      figEfter: 'Ny kostnad per år',
      figBattGross: 'Pris från', figBattNet: 'Efter grön teknik',
      figBehall: 'Noll kronor i investering',
      utanPris: 'utan pris', tagBehall: 'Så ligger du idag'
    },
    sbMix: {
      line: '{label} ~{share} % av värmen · ca {kr} kr per år',
      arbete: ' + ditt arbete',
      solar: 'Solel drar av ca {kr} kr av elkostnaden.'
    },
    cta: {
      /* MM7 + P1-P4: ONE main-CTA label for every branch (the soft/ghost CTA is retired);
       * sent = the m-m2 post-submit state, cleared by the next input change */
      plan: 'Få kostnadsfri rådgivning', sent: 'Skickat, vi hör av oss'
    },
    share: 'Dela din kalkyl',
    shareCopy: 'Kopiera länk',
    shareCopied: 'Länk kopierad',
    shareMailSubject: 'Kolla vad vårt hus kan spara',
    shareText: 'Räkna på ditt hus och se vad som är värt att göra.',
    shareTitle: 'Energikalkylatorn från Ampy',
    leadErr: 'Det gick inte att skicka just nu. Försök igen om en stund.',
    err: {
      name: 'Skriv ditt namn.',
      phone: 'Skriv ett nummer vi kan nå dig på.',
      zip: 'Postnumret ska vara fem siffror.',
      emailReq: 'Skriv din e-postadress.',
      email: 'Kolla e-postadressen, den ser inte komplett ut.'
    },
    methodLegal: 'Det här är en uppskattning byggd på schabloner och försiktiga antaganden. Den är inte ett erbjudande, inte ett bindande pris och inte ekonomisk rådgivning. Verklig kostnad och besparing beror på huset, avtalet och vädret, och kan bli både högre och lägre.'
  };

  /* ---------- labels for the data-driven inputs ---------- */
  var ERA_ITEMS = [
    { v: 'pre1940',    label: 'Före 1940' },
    { v: 'midcentury', label: '1940-1990' },
    { v: 'modern2010', label: '1990-2020' },
    { v: 'new2021',    label: 'Efter 2020' },
    { v: 'x',          label: 'Vet inte' }
  ];
  var SHARE_STOPS = (D.multi && D.multi.shareStops) ? D.multi.shareStops : [0.20, 0.40, 0.60];
  var SHARE_LABELS = ['Lite', 'En del', 'Mycket'];
  var DEFAULT_STOP = 1; // "En del" — maps to multi.defaultCoverage 0.40
  var MAX_ROWS = (D.rank && D.rank.maxRows) ? D.rank.maxRows : 6;

  /* ---------- inline SVG icon set (24×24, stroke 1.75; no CDN) ---------- */
  function icsvg(paths, sw) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.75) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var ICONS = {
    /* v30 heat-icon set (designer-delivered, render-verified 96/48/22px on midnight):
     * ac/hearth/building/mountain REPLACED; bolt/droplet/dropbolt/wind kept per owner verdict
     * v31: mountain redrawn as true bergvärme — a house silhouette sitting ON a full-width
     *      ground line, with a narrow vertical borehole U-loop plunging below the surface
     *      (reads ground-source, not a volcano/keyhole); hearth refined to a wood stove —
     *      flue up, rounded body, a firebox line (the door read), a flame inside, short legs.
     *      Both render-verified at real 19-22px card size + white-on-teal pressed state,
     *      weight-matched to the kept bolt across the heat-card family. */
    bolt:     icsvg('<path d="M13 3v7h6l-8 11v-7H5l8-11z"/>'),
    dropbolt: icsvg('<path d="M7.5 19.42c2.6 2.11 6.4 2.11 9 0c2.6-2.1 3.26-5.71 1.57-8.55l-4.89-7.26c-.42-.62-1.29-.8-1.94-.4a1.38 1.38 0 0 0-.41.4l-4.89 7.26c-1.7 2.84-1.04 6.44 1.56 8.55z"/><path d="M13 10l-2.5 3h3L11 16"/>'),
    flame:    icsvg('<path d="M12 12c2-2.96 0-7-1-8c0 3.04-1.77 4.74-3 6c-1.23 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.53-1.06-3.94-2-5c-1.79 3-2.79 3-4 2z"/>'),
    pellets:  icsvg('<circle cx="7" cy="16" r="3"/><circle cx="15" cy="16" r="3"/><circle cx="11" cy="8.5" r="3"/>'),
    wind:     icsvg('<path d="M5 8h8.5a2.5 2.5 0 1 0-2.34-3.24"/><path d="M3 12h15.5a2.5 2.5 0 1 1-2.34 3.24"/><path d="M4 16h5.5a2.5 2.5 0 1 1-2.34 3.24"/>'),
    building: icsvg('<path d="M2.5 18H7"/><path d="M17 18h4.5"/><path d="M7 18v-7l5-4.5 5 4.5v7"/><path d="M2.5 21.5h9.5V17"/><path d="M10 19l2-2 2 2"/>'),
    ac:       icsvg('<rect x="3.5" y="3" width="17" height="9" rx="2"/><path d="M7 8.75h10"/><path d="M8 14.75c-1 1.5-1 3.25 0 4.75"/><path d="M12 15.25c-.7 1.6-.7 3.6 0 5.25"/><path d="M16 14.75c1 1.5 1 3.25 0 4.75"/>'),
    droplet:  icsvg('<path d="M7.5 19.42c2.6 2.11 6.4 2.11 9 0c2.6-2.1 3.26-5.71 1.57-8.55l-4.89-7.26c-.42-.62-1.29-.8-1.94-.4a1.38 1.38 0 0 0-.41.4l-4.89 7.26c-1.7 2.84-1.04 6.44 1.56 8.55z"/>'),
    mountain: icsvg('<path d="M2.5 11.5h19"/><path d="M4.5 11.5V6.5L12 1.5l7.5 5v5"/><path d="M8 11.5v5a4 4 0 0 0 8 0v-5"/>'),  /* bergvärme: wide house on the ground line + a clear deep U-loop (borehole) below — reads at 22px */
    hearth:   icsvg('<path d="M12 2v3"/><rect x="6" y="5" width="12" height="12" rx="2.5"/><path d="M6 14h12"/><path d="M12 7.6c-1.3 1.4-2.1 2.4-2.1 3.6a2.1 2.1 0 0 0 4.2 0c0-1.2-.8-2.2-2.1-3.6z"/><path d="M8.5 17v2.5M15.5 17v2.5"/>'),
    sun:      icsvg('<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1"/><path d="M12 3v1"/><path d="M20 12h1"/><path d="M12 20v1"/><path d="M5.6 5.6l.7 .7"/><path d="M18.4 5.6l-.7 .7"/><path d="M17.7 17.7l.7 .7"/><path d="M6.3 17.7l-.7 .7"/>'),
    check:    icsvg('<path d="M5 12l5 5l10-10"/>', 2.2),
    chevUp:   icsvg('<path d="M6 15l6-6l6 6"/>')
  };

  /* the ONE merged heat list (L2): nine cards (8 common systems + Vet inte),
   * prevalence grid order (2-col reading order = rows). Labels DISPLAY-ONLY;
   * engine ids untouched. olja/vedpellets stay in data.js/engine (back-compat)
   * but are UI-HIDDEN: no card, and share-link decode maps them to Vet inte.
   * [MODEL prevalence order — owner may reorder at zero code risk] */
  var HEAT_CARDS = [
    { id: 'direktel',      icon: 'bolt',     label: 'Direktel' },
    { id: 'luftluftCur',   icon: 'ac',       label: 'Luft-luft' },
    { id: 'kamin',         icon: 'hearth',   label: 'Braskamin' },
    { id: 'fjarrvarme',    icon: 'building', label: 'Fjärrvärme' },
    { id: 'bergvarmeCur',  icon: 'mountain', label: 'Bergvärme' },
    { id: 'luftvattenCur', icon: 'droplet',  label: 'Luft-vatten' },
    { id: 'vattenburenEl', icon: 'dropbolt', label: 'Vattenburen el' },
    { id: 'franluft',      icon: 'wind',     label: 'Frånluftspump' },
    { id: 'vetinte',       icon: null,       label: 'Vet inte', quiet: true }
  ];
  /* systems kept in the engine but hidden from the UI card set */
  var UI_HIDDEN_SYSTEMS = { olja: true, vedpellets: true };
  function shortLabel(id) {
    for (var i = 0; i < HEAT_CARDS.length; i++) if (HEAT_CARDS[i].id === id) return HEAT_CARDS[i].label;
    return (D.currentSystems[id] && D.currentSystems[id].label) || id;
  }
  /* fjärrvärme partial-exclusive whitelist (V7-left §1.4 ruling) */
  var FJARR_COMPAT = ['kamin', 'luftluftCur'];

  /* ---------- selection state for the custom controls ---------- */
  var state = {
    priceArea: D.defaultPriceArea,
    era: 'x',                     // 'x' = Vet inte (default active) → midcentury, assumed
    eraTouched: false,
    seTouched: false,
    heat: {},                     // { systemId: { on:bool, stop:int (index), assumed:bool } }
    vetinte: false,               // the "Vet inte" heat card is active
    ownMode: 'vetinte',           // 'vetinte' | 'ja' — the own-figure seg
    ownKwh: (D.own && D.own.defaultKwh) || 20000,
    solarMode: 'nej',             // 'nej' | 'finns' | 'planeras'
    solarKwh: (D.solar && D.solar.prodDefault) || 8000,
    selectedOption: null,         // the Sparstaplarna open/selected row id (null = all collapsed)
    selectedByUser: false         // a default selection re-defaults on recalc; a tap survives
  };
  // seed the single default primary so the tool renders a real answer on first paint
  // MB1: seeded:true — an ASSUMED seed is evicted by the first real card tap
  state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true, seeded: true };

  var userTouched = false, booted = false;
  var lastRank = null, lastRec = null, lastResult = null;
  var leadSent = false;   // m-m2: post-submit sent-state, cleared by the next input change

  /* ---------- waterborne INFERENCE (L5 kill — the question is dead) ----------
   * VB_IMPLIES: any stack member ⇒ true; direktel-only + EVERY ambiguous case ⇒
   * conservative false (REVERSES v6 vedpellets:'ja'; [GAP-L1v7 → elektriker]).
   * The +60-120 tkr invest effect lives in the rec TEXT (V7-COPY riders). */
  /* V10 AR-1: + franluft — frånluftsvärmepumpar are by construction waterborne
   * (they heat radiators/VV); the omission mispriced luft-vatten/bergvärme by
   * 90-110 tkr gross on frånluft houses. [GAP-V10-1: elektriker counter-signs] */
  var VB_IMPLIES = ['fjarrvarme', 'olja', 'vattenburenEl', 'luftvattenCur', 'bergvarmeCur', 'franluft'];
  function inferWaterborne(sel) {
    var ids = [sel.primary];
    sel.complements.forEach(function (c) { ids.push(c.system); });
    for (var i = 0; i < ids.length; i++) if (VB_IMPLIES.indexOf(ids[i]) !== -1) return true;
    return false;
  }

  /* ---------- own-row visibility gate (honesty): all-electric stacks only ---------- */
  function ownRowAllowed() {
    var on = Object.keys(state.heat).filter(function (id) { return state.heat[id].on; });
    if (!on.length) on = [D.defaultCurrentSystem];
    for (var i = 0; i < on.length; i++) {
      var rec = D.currentSystems[on[i]];
      if (!rec || !rec.isElectric) return false;
    }
    return true;
  }

  /* ---------- populate the dynamic inputs once ---------- */
  function buildInputs() {
    // elområde segmented (PROMOTED; (antagande) until touched)
    buildSeg('#priceAreaSeg', Object.keys(D.priceAreas).map(function (id) {
      return { v: id, label: D.priceAreas[id].label };
    }), 'priceArea', function (v) {
      state.seTouched = true;
      track('se_area_set', { area: v });
      recompute();
    });

    // byggår segmented — 5 gap-free bands incl "Vet inte" (default active)
    buildSeg('#eraSeg', ERA_ITEMS, 'era', function (v) {
      state.eraTouched = (v !== 'x');
      var a = $('#eraAsm'); if (a) a.hidden = (v !== 'x');
      recompute();
    });

    // own-figure seg — activation IS assertion (the mid-typing defect class is impossible)
    buildSeg('#ownSeg', [
      { v: 'vetinte', label: 'Vet inte' },
      { v: 'ja', label: 'Ja, ungefär' }
    ], 'ownMode', function () {
      syncOwnUI();
      recompute();
    });

    // solceller seg — Nej / Finns / Planeras (A3 ruling; Planeras never touches dagens kostnad)
    buildSeg('#solarSeg', [
      { v: 'nej', label: 'Nej' },
      { v: 'finns', label: 'Finns' },
      { v: 'planeras', label: 'Planeras' }
    ], 'solarMode', function (v) {
      syncSolarUI();
      track('solar_mode', { mode: v });
      recompute();
    });

    buildHeatCards();
    syncCards();
    renderShareRows();
    syncOwnUI();
    syncSolarUI();
  }

  /* ========================================================================
   * LEFT — the merged icon multi-select heat picker (+ the Vet inte quiet card)
   * ====================================================================== */
  function buildHeatCards() {
    var grid = $('#hpGrid'); if (!grid) return;
    grid.innerHTML = '';
    HEAT_CARDS.forEach(function (card) {
      // only render cards for systems that exist in the data layer (vetinte is UI-only)
      if (!card.quiet && !D.currentSystems[card.id]) return;
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

  function isOn(id) { return !!(state.heat[id] && state.heat[id].on); }

  var _prevHeat = null;   // m-m7: session-local undo for the Vet inte wipe

  function toggleCard(id) {
    if (id === 'vetinte') {
      if (state.vetinte) {
        // m-m7: tapping Vet inte again restores the selection it wiped
        state.vetinte = false;
        state.heat = _prevHeat ? JSON.parse(JSON.stringify(_prevHeat)) : {};
        var anyBack = Object.keys(state.heat).some(function (k) { return state.heat[k].on; });
        if (!anyBack) state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true, seeded: true };
        setHint('');
        afterHeatChange();
        return;
      }
      _prevHeat = JSON.parse(JSON.stringify(state.heat));   // m-m7: snapshot before the wipe
      // clear everything, count conservatively on direktel until the visitor knows more
      Object.keys(state.heat).forEach(function (k) { if (state.heat[k]) state.heat[k].on = false; });
      state.heat.direktel = { on: true, stop: DEFAULT_STOP, assumed: true };
      state.vetinte = true;
      setHint(S.hintVetinte);
      track('vetinte_used');
      afterHeatChange();
      return;
    }

    // any real card tap clears the vet-inte state (and its conservative default)
    if (state.vetinte) {
      state.vetinte = false;
      setHint('');
      Object.keys(state.heat).forEach(function (k) { if (state.heat[k]) state.heat[k].on = false; });
    }

    var wasOn = isOn(id);
    var fjarrOn = isOn('fjarrvarme');

    // MB1: tapping the SEEDED card claims it as a real selection (no toggle-off)
    if (wasOn && state.heat[id].seeded) {
      delete state.heat[id].seeded;
      track('heat_select', { sys: id });
      afterHeatChange();
      return;
    }

    if (!wasOn) {
      /* MB1: an ASSUMED direktel seed must never silently join the first real
       * selection — evict every seeded row before this tap lands. A genuine
       * direktel+X house re-taps Direktel (one extra tap for the rare case,
       * correct math for the common one). */
      Object.keys(state.heat).forEach(function (k) {
        if (state.heat[k] && state.heat[k].seeded) { state.heat[k].on = false; delete state.heat[k].seeded; }
      });
      if (id === 'fjarrvarme') {
        // fjärrvärme ON: partial exclusivity — clear every selected non-compat card
        Object.keys(state.heat).forEach(function (k) {
          if (state.heat[k] && state.heat[k].on && FJARR_COMPAT.indexOf(k) === -1) state.heat[k].on = false;
        });
        setHint(S.hintFjarr);
      } else if (fjarrOn && FJARR_COMPAT.indexOf(id) === -1) {
        // a non-compat card ON while fjärrvärme is on → fjärrvärme OFF, hint cleared
        state.heat.fjarrvarme.on = false;
        setHint('');
      } else if (!fjarrOn) {
        setHint('');
      }
      state.heat[id] = { on: true, stop: DEFAULT_STOP, assumed: true };
      track('heat_select', { sys: id });
    } else {
      state.heat[id].on = false;
      if (id === 'fjarrvarme') setHint('');
      // never allow an empty selection: fall back to the default primary (seeded, MB1)
      var anyOn = Object.keys(state.heat).some(function (k) { return state.heat[k].on; });
      if (!anyOn) {
        state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true, seeded: true };
        setHint('');
      }
    }
    afterHeatChange();
  }

  function afterHeatChange() {
    syncCards();
    renderShareRows();
    syncOwnUI();      // the own row's all-electric gate re-evaluates on every heat change
    recompute();
  }

  function setHint(msg) {
    var h = $('#hpHint'); if (!h) return;
    if (msg) { h.textContent = msg; h.hidden = false; } else { h.textContent = ''; h.hidden = true; }
  }

  /* reflect selection + the derived primary marker onto the cards */
  function syncCards() {
    var sel = heatSelection();
    // m-m5: when 2+ ON cards share the max share stop the primary is ambiguous — no ring
    var onIds = Object.keys(state.heat).filter(function (k) { return state.heat[k].on; });
    var maxStop = -1, maxCount = 0;
    onIds.forEach(function (k) {
      var s = state.heat[k].stop;
      if (s > maxStop) { maxStop = s; maxCount = 1; } else if (s === maxStop) maxCount++;
    });
    var stopTie = maxCount >= 2;
    el('.hp-card').forEach(function (c) {
      var id = c.dataset.sys;
      var on = (id === 'vetinte')
        ? state.vetinte
        : (!state.vetinte && isOn(id));
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      c.classList.toggle('is-primary', on && id === sel.primary && sel.multi && !stopTie);
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

  /* per-complement share rows: one seg per SELECTED card, only when 2+ are on. */
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
      var isOnB = (idx === c.stop);
      if (isOnB) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); } else b.setAttribute('aria-checked', 'false');
      b.tabIndex = isOnB ? 0 : -1;
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
    recompute();
  }

  var segBoxes = [];   // registry for the resize re-place of every sliding pill

  function buildSeg(sel, items, key, onPick) {
    var box = $(sel); if (!box) return;
    var activeBtn = null;
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = it.label; b.dataset.value = it.v;
      b.setAttribute('role', 'radio');
      var isOnB = (it.v === state[key]);
      if (isOnB) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); activeBtn = b; }
      else b.setAttribute('aria-checked', 'false');
      b.tabIndex = isOnB ? 0 : -1;
      b.addEventListener('click', function () {
        state[key] = it.v;
        el('button', box).forEach(function (x) {
          var sel2 = x === b;
          x.classList.toggle('on', sel2); x.setAttribute('aria-checked', sel2 ? 'true' : 'false'); x.tabIndex = sel2 ? 0 : -1;
        });
        movePill(box, b);
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

  /* set a seg's value programmatically (share-link restore, own-row reset) */
  function setSegValue(sel, key, value) {
    var box = $(sel); if (!box) return;
    state[key] = value;
    var target = null;
    el('button', box).forEach(function (b) {
      var on = b.dataset.value === value;
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      if (on) target = b;
    });
    if (target) movePill(box, target);
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

  /* ---------- own-figure + solar UI sync ---------- */
  function syncOwnUI() {
    var row = $('#ownRow'); if (!row) return;
    var allowed = ownRowAllowed();
    row.hidden = !allowed;
    if (!allowed && state.ownMode !== 'vetinte') {
      // fuel/fjärrvärme member entered the stack: hide AND reset (those homes
      // have no single heat-kWh bill). Slider value resets to the default.
      state.ownKwh = (D.own && D.own.defaultKwh) || 20000;
      var sl = $('#ownSlider'); if (sl) sl.value = state.ownKwh;
      var out = $('#ownOut'); if (out) out.textContent = nf(state.ownKwh) + ' kWh per år';
      setSegValue('#ownSeg', 'ownMode', 'vetinte');
    }
    var gear = $('#gearOwn');
    if (gear) {
      gear.removeAttribute('hidden');
      toggleEl(gear, allowed && state.ownMode === 'ja');
    }
    // accordion changes the card height — re-anchor the sticky-bottom fallback
    setTimeout(checkStickyIntegrity, REDUCED ? 0 : 320);
  }
  function syncSolarUI() {
    var gear = $('#gearSol');
    if (gear) {
      gear.removeAttribute('hidden');
      toggleEl(gear, state.solarMode === 'finns');
    }
    setTimeout(checkStickyIntegrity, REDUCED ? 0 : 320);
  }

  /* ---------- read the live inputs → the multi-system model (§1.5 contract) ---------- */
  function getInputs() {
    var sel = heatSelection();
    var ownActive = state.ownMode === 'ja' && ownRowAllowed();
    var actual = ownActive
      ? { mode: 'kwh', kwh: state.ownKwh, cost: null }
      : { mode: null, kwh: null, cost: null };

    return {
      current: { primary: sel.primary, complements: sel.complements, actual: actual },
      area: +$('#areaSlider').value,
      priceArea: state.priceArea,
      occupants: +$('#occupantsField').value,
      era: state.era === 'x' ? 'midcentury' : state.era,     // Vet inte → conservative middle
      indoorTemp: 21,                                        // CONSTANT (input killed, disclosed in method)
      distribution: 'radiator',                              // CONSTANT (input killed, disclosed in method)
      hasWaterborne: inferWaterborne(sel),                   // INFERRED (question killed)
      dso: 'vetej',                                          // CONSTANT (input killed ⇒ effekttopp gate OFF)
      hasSolar: state.solarMode === 'finns',
      solarKwh: state.solarMode === 'finns' ? state.solarKwh : null,
      solarPlanned: state.solarMode === 'planeras',
      vetinte: state.vetinte
    };
  }

  /* ========================================================================
   * RENDER — rank + recommend once, render the beats
   * ====================================================================== */
  function firstTouch(silent) {
    if (userTouched) return;
    userTouched = true;
    if (!silent) track('calc_first_touch');
  }

  /* rAF-throttled recompute for slider drags: the slider's own output label
   * updates immediately in its input handler; the heavy recompute runs at most
   * once per frame, and any input landing while a frame is pending is absorbed
   * (recompute reads live state at execution, so the trailing value always
   * renders). No layout-affecting work in the drag path itself. */
  var recomputeRaf = 0;
  function scheduleRecompute() {
    if (recomputeRaf) return;
    recomputeRaf = requestAnimationFrame(function () {
      recomputeRaf = 0;
      recompute();
    });
  }
  /* drag end ('change'): settle immediately — cancels any pending frame so the
   * final value always renders, even if the tab was backgrounded mid-drag */
  function settleRecompute() {
    if (recomputeRaf) { cancelAnimationFrame(recomputeRaf); recomputeRaf = 0; }
    recompute();
  }

  function recompute() {
    var inp = getInputs();
    var R = RANK.rankOptions(inp, D);
    var rec = RANK.recommend(R, inp, D);
    lastRank = R;
    lastRec = rec;
    lastResult = R.baseline.results;

    // selection reconcile: a USER pick survives while its id exists; a default
    // selection re-defaults to the lead so rail and expander always agree.
    // V10: the composite lead type is DELETED — rec.lead is always a real row.
    var rowIds = compareRowIds(R, rec);
    var defaultSel = rec.lead.id;
    // P3: a deliberate collapse (selectedByUser && null) must SURVIVE a recompute — else
    // the ★ springs back open every time the user nudges a slider.
    var surviving = state.selectedByUser &&
      (state.selectedOption === null ||
       rowIds.indexOf(state.selectedOption) !== -1 ||
       (state.selectedOption === 'batteri' && inp.hasSolar) ||
       (rec.lead.type === 'action' && state.selectedOption === rec.lead.id));
    if (!surviving) { state.selectedOption = defaultSel; state.selectedByUser = false; }

    // m-m2: any input change clears the post-submit sent-state
    if (leadSent && booted) {
      leadSent = false;
      var ctaEl = $('#ctaBtn');
      if (ctaEl && !ctaEl.classList.contains('is-close')) restoreCta();
    }

    if (booted && !userTouched) firstTouch(false);
    render(R, rec);
  }

  function render(R, rec) {
    renderAnchor(R);
    renderStorybar(R);
    renderSpark(R, rec);
    renderCtaBlock(rec);
    renderHpSummary(R);

    // complement cap note (engine clamp surfaced, never silent)
    var capNote = $('#complementCapNote');
    if (capNote) capNote.hidden = !R.baseline.results.ctx.complementClamped;

    // methodology
    $('#methodBody').innerHTML = methodHtml(R, rec);

    announceResult(R, rec);
    checkStickyIntegrity();
  }

  /* ---------- option lookup + display names ---------- */
  function optById(R, id) {
    for (var i = 0; i < R.options.length; i++) if (R.options[i].id === id) return R.options[i];
    return null;
  }
  function cardName(o) {
    if (o.id === 'luftluft') {
      var prim = shortLabel(heatSelection().primary).toLowerCase();
      return 'Behåll ' + prim + ' och komplettera med luft‑luft';   // U+2011: never break "luft-/luft" at 390px
    }
    return S.cardName[o.id] || o.label;
  }
  function leadDisplayName(id) { return S.leadName[id] || (S.cardName[id] || id).toLowerCase(); }

  /* ---------- B. the anchor = DAGENS kostnad ---------- */
  function anchorVals(R) {
    var measured = !!R.baseline.demandMeasured;
    var sp = measured ? 0 : D.demandSpread;
    // household-inclusive TOTAL: the ±15 % demand spread is heat-demand uncertainty,
    // so it applies to heat+VV only; household is a flat schablon OUTSIDE the band.
    var hv = R.baseline.spaceCost + R.baseline.vvCost;   // heat+VV (band applies here)
    var hh = R.baseline.householdCost;                   // flat schablon — NO band on it
    return {
      single: sp === 0,
      lo: Math.max(0, roundTo(hv * (1 - sp) + hh, ROUND.hero)),
      hi: Math.max(0, roundTo(hv * (1 + sp) + hh, ROUND.hero)),
      mid: Math.max(0, roundTo(hv + hh,           ROUND.hero))
    };
  }
  function anchorText(av) { return av.single ? '~' + nf(av.mid) : nf(av.lo) + '-' + nf(av.hi); }   /* range: no ~ (the span implies approx); single: keep ~ */

  function renderAnchor(R) {
    var av = anchorVals(R);
    var num = $('#anchorNum');
    // d-m3: the numeric range never wraps mid-figure
    num.innerHTML = '<span class="nowrap">' + anchorText(av) + '</span> <span class="anchor-per">kr per år</span>';
    if (!REDUCED) {
      // m-p1/d-p6: retrigger the keyframe for real (remove → reflow → add)
      num.classList.remove('flash'); void num.offsetWidth; num.classList.add('flash');
    }
  }

  /* ---------- C. the story bar + the V7 member cost lines (§3.2) ---------- */
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

    // V7: per-member COST lines (engine currentBreakdown — never re-derived).
    // This makes a cost DROP visible and explained the moment a cheap fuel joins.
    var mix = $('#sbMix');
    var bd = R.baseline.breakdown || [];
    var lines = [];
    if (bd.length > 1) {
      bd.forEach(function (b) {
        var line = fill(S.sbMix.line, {
          label: shortLabel(b.id),
          share: Math.round(b.share * 100),
          kr: nf(roundTo(b.annual, ROUND.stat))
        });
        if (b.id === 'vedpellets' || b.id === 'kamin') line += S.sbMix.arbete;
        if (b.isAssumed) line += ' (antagande)';
        lines.push(esc(line));
      });
    }
    var solOffset = R.baseline.results.solarOffsetAnnual || 0;
    if (solOffset > 0) {
      lines.push(esc(fill(S.sbMix.solar, { kr: nf(roundTo(solOffset, ROUND.stat)) })));
    }
    if (lines.length) { mix.innerHTML = lines.join('<br>'); mix.hidden = false; }
    else { mix.textContent = ''; mix.hidden = true; }
  }

  /* ========================================================================
   * D+E. SPARSTAPLARNA (#spark) — savings bars + tap-to-expand rec
   *      (replaces the old #compare cost visual and the #recs plate/wall)
   * ====================================================================== */
  function visibleOptions(R) { return R.options.slice(0, MAX_ROWS); }

  /* V10 row set (owner P1/P5 + m-m1): SELF_EQ drops the own-system mirror (never
   * compare a system to itself); behåll renders as a CONTEXT row on the optimera*
   * action branches ONLY and is filtered out on option-lead branches. */
  function sparkRowSet(R, rec) {
    var primaryId = R.baseline.results.ctx.primaryId;
    var selfEq = { bergvarmeCur: 'bergvarme', luftvattenCur: 'luftvatten' }[primaryId] || null;
    return visibleOptions(R).filter(function (o) {
      if (selfEq && o.id === selfEq) return false;
      if (o.id === 'behall' && rec.lead.type === 'option') return false;
      return true;
    });
  }

  function compareRowIds(R, rec) {
    return sparkRowSet(R, rec).map(function (o) { return o.id; });
  }

  /* battery presentation band: durable engine rows summed, shown as an honest
   * ±10 % range rounded to 500 ([MODEL presentation band]; rates [GAP-R4-4]) */
  function battRange(R) {
    var rows = (R.baseline.results.upside.rows || []).filter(function (r) { return r.tier === 'durable'; });
    if (!rows.length) return null;
    var sum = 0; rows.forEach(function (r) { sum += r.value; });
    if (!(sum > 0)) return null;
    var lo = Math.max(0, roundTo(sum * 0.9, 500)), hi = roundTo(sum * 1.1, 500);
    return { lo: lo, hi: hi, text: (lo === hi) ? '+' + nf(lo) + ' kr' : '+' + nf(lo) + '-' + nf(hi) + ' kr' };
  }

  function sparStar() {
    return '<svg class="sp-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.8 6 21l1.2-6.6L2.4 9.7l6.6-.9z"/></svg>';
  }
  function sparCaret() {
    return '<svg class="sp-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6"/></svg>';
  }

  /* per-row model on the SAVING scale (money coming back, never cost remaining) */
  function sparRowProps(o, R, rec, scaleMax, wb) {
    var p = {
      id: o.id, name: cardName(o), kind: 'numeric', off: false, isRec: false,
      showFlag: false, batt: false, val: '', valClass: '', tag: null, reason: '', offReason: null,
      hasBar: false, fillPct: 0, bandLeft: 0, bandW: 0, pay: null, payWeak: false, aria: ''
    };

    // behall: a CONTEXT row — never the ★, never first [owner P1]
    if (o.id === 'behall') {
      p.kind = 'behall'; p.tag = S.spark.tagBehall;
      p.aria = p.name + '. ' + S.spark.tagBehall + '. ' + S.spark.verdict.behall + ' Visa mer.';
      return p;
    }
    // ineligible: greyed WITH reason AND the comparison number it promises (MM3)
    if (!o.eligible) {
      p.kind = 'off'; p.off = true;
      p.reason = S.reason[o.ineligibleReason] || '';
      p.offReason = o.ineligibleReason;
      if (o.numeric !== false && o.saving) {
        p.val = (o.saving[2] > 0)
          ? savRangeYr(o.saving[0], o.saving[2], ROUND.stat)
          : '~' + savRange(-o.saving[2], -o.saving[0], ROUND.stat) + ' dyrare per år';
      }
      p.aria = p.name + '. ' + (p.val ? p.val + '. ' : '') + p.reason;
      return p;
    }
    // styrning (qualitative — utan pris, no bar, no figures); carries the ★ when it IS the lead
    if (o.numeric === false) {
      p.kind = 'styrning'; p.val = S.spark.utanPris; p.valClass = 'soft';
      p.isRec = (rec.lead.id === o.id); p.showFlag = p.isRec;
      p.aria = p.name + '. Utan pris. ' + (p.isRec ? S.spark.verdict.styrningLead : S.spark.verdict.styrning) + ' Visa rekommendationen.';
      return p;
    }
    // dyrare: eligible but the change costs more — no bar, amber value, never rec
    if (o.saving[1] <= 0) {
      p.kind = 'dyrare';
      p.val = '~' + savRange(-o.saving[2], -o.saving[0], ROUND.stat) + ' dyrare per år';
      p.valClass = 'amber';
      p.aria = p.name + '. Ungefär ' + savRange(-o.saving[2], -o.saving[0], ROUND.stat) + ' dyrare per år. ' + S.spark.verdict.dyrare + ' Visa mer.';
      return p;
    }
    // numeric option with a real saving: full bar + payback chip + dropdown
    p.hasBar = true;
    var lo = Math.max(0, o.saving[0]), hi = Math.max(0, o.saving[2]);
    p.val = savRangeYr(o.saving[0], o.saving[2], ROUND.stat);
    p.fillPct = clamp(100 * lo / scaleMax, 2, 100);
    var bandEnd = clamp(100 * hi / scaleMax, 0, 100);
    p.bandLeft = p.fillPct; p.bandW = Math.max(0, bandEnd - p.fillPct);
    if (o.paybackLow != null && o.paybackHigh != null) p.pay = pbRange(o.paybackLow, o.paybackHigh);
    p.payWeak = (o.paybackMid != null && o.paybackMid > D.rec.pbComfort);   // amber chip = visual honesty
    /* OWNER POLICY V10 (P2, root defect D4 fixed): the ★ follows the lead
     * UNCONDITIONALLY — a long payback is disclosed in the chip + verdict,
     * never used to suppress the recommendation. */
    p.isRec = (rec.lead.type === 'option' && rec.lead.id === o.id);
    p.showFlag = p.isRec;
    var sLo = nf(Math.max(0, roundTo(o.saving[0], ROUND.stat)));
    var sHi = nf(Math.max(0, roundTo(o.saving[2], ROUND.stat)));
    var iLo = o.netInvest ? nf(roundTo(o.netInvest[0], ROUND.stat)) : null;
    var iHi = o.netInvest ? nf(roundTo(o.netInvest[1], ROUND.stat)) : null;
    p.aria = p.name + '. Kan spara cirka ' + sLo + ' till ' + sHi +
      ' kronor per år på värme och varmvatten, räknat lågt ' + sLo + '. ' +
      (iLo != null ? 'Investering efter ROT cirka ' + (iLo === iHi ? iLo : iLo + ' till ' + iHi) + ' kronor. ' : '') +
      (o.paybackLow != null && o.paybackHigh != null
        ? 'Återbetald på ungefär ' + yrStr(roundTo(o.paybackLow, ROUND.payback)) + ' till ' + yrStr(roundTo(o.paybackHigh, ROUND.payback)) + ' år. '
        : '') +
      'Visa rekommendationen.';
    return p;
  }

  /* the battery pseudo-row (not a rank.js option) — mint bar on the saving scale.
   * V10: carries the ★ when the action lane leads with it (optimeraBatteri). */
  function battRowProps(R, scaleMax, rec) {
    var br = battRange(R); if (!br) return null;
    var isLead = rec.lead.type === 'action' && rec.lead.id === 'batteri';
    var p = {
      id: 'batteri', name: 'Solcellsbatteri', kind: 'batt', batt: true, off: false,
      isRec: isLead, showFlag: isLead, tag: '', valClass: '',   /* the row only renders when solar=Finns — a "kräver solel" tag would be noise */
      hasBar: true, pay: null, payWeak: false
    };
    p.val = (br.lo === br.hi) ? '+' + nf(br.lo) + ' kr/år' : '+' + nf(br.lo) + '-' + nf(br.hi) + ' kr/år';
    p.fillPct = clamp(100 * br.lo / scaleMax, 2, 100);
    var bandEnd = clamp(100 * br.hi / scaleMax, 0, 100);
    p.bandLeft = p.fillPct; p.bandW = Math.max(0, bandEnd - p.fillPct);
    p.aria = 'Solcellsbatteri. Ungefär ' + (br.lo === br.hi ? nf(br.lo) : nf(br.lo) + ' till ' + nf(br.hi)) +
      ' kronor mer per år i värde av din solel. Kräver solel. Visa rekommendationen.';
    return p;
  }

  /* V10 NEW (owner P4 / AR-3): quiet action pseudo-rows for the service/solplan
   * leads — label + "utan pris", no bar, NO figures, NO invented numbers. */
  function actionRowProps(id) {
    var name = S.spark.actionName[id] || id;
    return {
      id: id, name: name, kind: 'action', off: false, batt: false,
      isRec: true, showFlag: true, val: S.spark.utanPris, valClass: 'soft', tag: null,
      reason: '', offReason: null, hasBar: false, fillPct: 0, bandLeft: 0, bandW: 0,
      pay: null, payWeak: false,
      aria: name + '. Utan pris. ' + (S.spark.verdict[id] || '') + ' Visa rekommendationen.'
    };
  }
  function renderActionDrop(id) {
    return '<p class="sp-verdict">' + esc(S.spark.verdict[id] || '') + '</p>';
  }

  function sparRowInner(p) {
    var flag = '<span class="sp-flag"' + (p.showFlag ? '' : ' hidden') + '>' + sparStar() + esc(S.spark.recLabel) + '</span>';
    var valClass = 'sp-val' + (p.valClass === 'soft' ? ' sp-val--soft' : (p.valClass === 'amber' ? ' sp-val--amber' : ''));
    var head = '<span class="sp-head"><span class="sp-name">' + esc(p.name) + '</span>' +
      (p.tag ? '<span class="sp-tag">' + esc(p.tag) + '</span>' : '') +
      (p.val ? '<span class="' + valClass + '">' + esc(p.val) + '</span>' : '') +
      sparCaret() + '</span>';
    var barline = '';
    if (p.hasBar) {
      // the payback chip lived here; it is now shown once, in the expanded
      // "Återbetald på" column (owner: the chip duplicated that number)
      barline = '<span class="sp-barline"><span class="sp-track" aria-hidden="true">' +
        '<span class="sp-fill" style="width:' + p.fillPct.toFixed(2) + '%"></span>' +
        (p.bandW > 0 ? '<span class="sp-band" style="left:' + p.bandLeft.toFixed(2) + '%;width:' + p.bandW.toFixed(2) + '%"></span>' : '') +
        '</span></span>';
    }
    return flag + head + barline;
  }

  /* (the dead figRow helper is deleted — the stat renderer is figCols below) */

  /* slot map for the lead row's branch intro (V10 §1.5) — every number is a
   * computed engine/rank output or a signed constant, never invented */
  function branchIntroSlots(o, rec) {
    var m = {};
    if (rec.residual) {
      m.residualLabel = shortLabel(rec.residual.id).toLowerCase();
      m.residualShare = Math.round(rec.residual.share * 100);
      m.residualKr = nf(roundTo(rec.residual.annualKr, ROUND.stat));
    }
    if (o && o.saving) {
      var lo = Math.max(0, roundTo(o.saving[0], ROUND.stat)), hi = Math.max(0, roundTo(o.saving[2], ROUND.stat));
      m.savingRange = (lo === hi) ? nf(lo) : nf(lo) + '-' + nf(hi);
    }
    return m;
  }

  /* dropdown body: verdict + (numeric/battery) two figure lines.
   * V10 (owner P1-P5): the LEAD row = branchIntro + option sentence + longPbLine
   * (payback stated PLAINLY, ★ stays). Disclose strings = NON-lead rows only.
   * Reuses recNumbers/battSlots for every number; NEVER a fabricated figure. */
  /* vertical stat ROWS (owner v30) — the dropdown for any row that HAS numbers:
     one stacked row per stat, label left / value right, bigger readable type.
     Same markup desktop+mobile; accepts 2 or 3 rows. */
  function figCols(items) {
    return '<dl class="sp-rows">' +
      items.map(function (c) {
        return '<div class="sp-statrow"><dt class="sp-statrow-k">' + esc(c.k) +
               '</dt><dd class="sp-statrow-v' + (c.cls ? ' ' + c.cls : '') + '">' + esc(c.v) + '</dd></div>';
      }).join('') + '</dl>';
  }

  function renderSparDrop(o, R, rec, wb) {
    var isLead = (rec.lead.id === o.id);
    // qualitative row (no numbers): the ONLY place a text description remains
    if (o.numeric === false) {
      return '<p class="sp-verdict">' + esc(isLead ? S.spark.verdict.styrningLead : S.spark.verdict.styrning) + '</p>';
    }
    // greyed / ineligible: keep the reason (candour: greyed WITH reason)
    if (!o.eligible) {
      return '<p class="sp-verdict">' + esc(S.reason[o.ineligibleReason] || '') + '</p>';
    }
    // behåll context row: a short line, no columns (it is context, not a purchase)
    if (o.id === 'behall') {
      return '<p class="sp-verdict">' + esc(S.spark.verdict.behall) + '</p>';
    }
    // an option that raises cost: short honest note, no positive figures to column
    if (o.saving[1] <= 0) {
      return '<p class="sp-verdict">' + esc(S.spark.verdict.dyrare) + '</p>';
    }
    // THE numeric pump rows: three columns, NO paragraph (owner directive).
    // Investering efter ROT is DELIBERATELY not shown — the customer gets that number
    // by booking the advisory (sales finesse). The three that reconcile against the
    // anchor: Årskostnad efter · Årsbesparing · Återbetald på.
    // efter is computed from the DISPLAYED anchor and DISPLAYED saving (matched ends) so
    // a customer who does idag − årsbesparing lands EXACTLY on årskostnad efter.
    var n = recNumbers(o);
    var av = anchorVals(R);
    var sLo = Math.max(0, roundTo(o.saving[0], ROUND.stat));
    var sHi = Math.max(0, roundTo(o.saving[2], ROUND.stat));
    var eA = Math.max(0, av.lo - sLo), eB = Math.max(0, av.hi - sHi);
    var efterLo = Math.min(eA, eB), efterHi = Math.max(eA, eB);
    // ranges drop the "~" (the span already means "ungefär, någonstans här" — owner: the ~ made
    // the wrapped columns hard to read); a lone single value keeps the ~ as its only approx-marker
    var efter  = (efterLo === efterHi) ? '~' + nf(efterLo) + ' kr' : nf(efterLo) + '-' + nf(efterHi) + ' kr';
    var bespar = (sLo === sHi)         ? '~' + nf(sLo)     + ' kr' : nf(sLo)     + '-' + nf(sHi)     + ' kr';
    var pb = (n.pbRange && n.pbRange !== EMPTY) ? ((n.pbRange.indexOf('-') >= 0 ? n.pbRange : '~' + n.pbRange) + ' år') : EMPTY;
    var pbWeak = (o.paybackMid != null && o.paybackMid > D.rec.pbComfort);
    return figCols([
      { k: S.spark.figEfter,   v: efter },
      { k: S.spark.figSaving,  v: bespar },
      { k: S.spark.figPayback, v: pb, cls: pbWeak ? 'sp-statrow-v--weak' : '' }
    ]);
  }

  function renderBattDrop(R, rec) {
    // battery is an ADD-ON, not a heating swap (no efter-total, no payback trio):
    // verdict text + its two PRICE rows in the same vertical stat style (v30).
    // Both figures come from data.js battery (signed constants, already used in copy).
    var bs = battSlots(R);
    var isLead = rec.lead.type === 'action' && rec.lead.id === 'batteri';
    var txt = isLead ? fill(S.spark.verdict.batteriLead, { battRange: bs.battRange }) : S.spark.verdict.batteri;
    return '<p class="sp-verdict">' + txt + '</p>' + figCols([
      { k: S.spark.figBattGross, v: nf((D.battery && D.battery.grossFrom) || 33000) + ' kr' },
      { k: S.spark.figBattNet,   v: '~' + bs.battNet + ' kr' }
    ]);
  }

  var sparkDrawn = false;
  function renderSpark(R, rec) {
    var list = $('#sparkList'); if (!list) return;
    var wb = inferWaterborne(heatSelection());

    var rows = sparkRowSet(R, rec);

    // scaleMax over shown numeric rows incl the battery hi
    var hasSolar = state.solarMode === 'finns';
    var br = hasSolar ? battRange(R) : null;
    var maxSav = 0;
    rows.forEach(function (o) {
      if (o.numeric !== false && o.eligible && o.saving && o.saving[2] > 0) maxSav = Math.max(maxSav, o.saving[2]);
    });
    if (br) maxSav = Math.max(maxSav, br.hi);
    var scaleMax = maxSav > 0 ? 1.02 * maxSav : 1;

    /* V10 (the policy render): build ALL row models — options + batteri +
     * service/solplan pseudo-rows — BEFORE the priority sort, so the ★ lead
     * (option OR action) ALWAYS floats to the top. behåll pinning is DELETED. */
    var models = [];
    rows.forEach(function (o, i2) {
      var p = sparRowProps(o, R, rec, scaleMax, wb);
      models.push({ id: o.id, p: p, drop: p.kind === 'off' ? '' : renderSparDrop(o, R, rec, wb), i: i2 });
    });
    if (br) {
      var pbatt = battRowProps(R, scaleMax, rec);
      if (pbatt) models.push({ id: 'batteri', p: pbatt, drop: renderBattDrop(R, rec), i: rows.length });
    }
    if (rec.lead.type === 'action' && (rec.lead.id === 'service' || rec.lead.id === 'solplan')) {
      models.push({ id: rec.lead.id, p: actionRowProps(rec.lead.id), drop: renderActionDrop(rec.lead.id), i: rows.length + 1 });
    }
    /* priority: lead 0 · eligible pumps + behåll context 1 · non-lead qualitative
     * (styrning/service/solplan/batteri) 2 · greyed-with-reason 3 */
    function sparPri(m) {
      if (m.id === rec.lead.id) return 0;
      if (m.p.off) return 3;
      if (m.p.kind === 'styrning' || m.p.kind === 'action' || m.p.batt) return 2;
      return 1;
    }
    models.forEach(function (m) { m.pri = sparPri(m); });
    models.sort(function (a, b) { return a.pri !== b.pri ? a.pri - b.pri : a.i - b.i; });

    /* MM3: same-reason clustering — the reason sentence renders on the FIRST
     * off row of a consecutive same-reason group only (group note) */
    var lastReason = null;
    models.forEach(function (m) {
      if (m.p.off) {
        if (m.p.offReason && m.p.offReason === lastReason) m.p.reason = '';
        else lastReason = m.p.offReason;
      } else { lastReason = null; }
    });

    // build (full rebuild — <=7 rows, cheap; inline widths render final, no re-anim on recalc)
    list.innerHTML = '';
    function appendRow(id, p, dropHtml) {
      var item = document.createElement('div');
      item.className = 'sp-item' + (p.isRec ? ' is-rec' : '') + (p.off ? ' is-off' : '') + (p.batt ? ' sp-item--batt' : '');
      item.dataset.id = id;
      if (p.kind === 'off') {
        // ineligible: informational, not a button; grey number + reason (MM3), never hidden
        item.innerHTML = '<div class="sp-row sp-row--static">' +
          '<span class="sp-head"><span class="sp-name">' + esc(p.name) + '</span>' +
          (p.val ? '<span class="sp-val">' + esc(p.val) + '</span>' : '') + '</span>' +
          (p.reason ? '<span class="sp-note">' + esc(p.reason) + '</span>' : '') + '</div>';
        list.appendChild(item);
        return;
      }
      var open = (state.selectedOption === id);
      var dropId = 'drop-' + id;
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'sp-row';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-controls', dropId);
      btn.setAttribute('aria-label', p.aria);
      btn.innerHTML = sparRowInner(p);
      btn.addEventListener('click', function () { onSparkSelect(id, true); });
      var drop = document.createElement('div');
      drop.className = 'sp-drop gear-collapsed' + (open ? ' open' : '');
      drop.id = dropId;
      drop.innerHTML = '<div class="gear-inner"><div class="sp-drop-body">' + dropHtml + '</div></div>';
      item.appendChild(btn); item.appendChild(drop);
      list.appendChild(item);
    }
    models.forEach(function (m) { appendRow(m.id, m.p, m.drop); });

    // MM8: solar "Planeras" acknowledged when the solplan row is not the lead
    var section = $('#spark');
    var note = $('#sparkPlanNote');
    if (!note && section) {
      note = document.createElement('p');
      note.id = 'sparkPlanNote'; note.className = 'spark-foot'; note.hidden = true;
      section.appendChild(note);
    }
    if (note) {
      var showNote = state.solarMode === 'planeras' && rec.lead.id !== 'solplan';
      note.hidden = !showNote;
      note.textContent = showNote ? S.rec.addOn.batteriPlaneras : '';
    }

    // entrance stagger (first structural paint only, reduced-motion safe)
    if (!REDUCED && !sparkDrawn) {
      list.classList.add('is-drawing');
      var fills = el('.sp-fill', list);
      fills.forEach(function (f, i2) { f.style.transitionDelay = (i2 * 45) + 'ms'; });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          list.classList.remove('is-drawing');
          list.classList.add('is-drawn');
          setTimeout(function () {
            list.classList.remove('is-drawn');
            fills.forEach(function (f) { f.style.transitionDelay = ''; });
          }, 700);
        });
      });
    }
    sparkDrawn = true;
  }

  /* accordion: one dropdown open at a time; tap the open row to collapse it */
  function updateSparkOpen() {
    var list = $('#sparkList'); if (!list) return;
    el('.sp-item', list).forEach(function (item) {
      var id = item.dataset.id;
      var open = (state.selectedOption === id);
      var btn = $('.sp-row', item), drop = $('.sp-drop', item);
      if (btn && btn.tagName === 'BUTTON') btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (drop) drop.classList.toggle('open', open);
    });
  }

  function onSparkSelect(id, userInitiated) {
    state.selectedOption = (state.selectedOption === id) ? null : id;  // toggle (one open at a time)
    if (userInitiated) state.selectedByUser = true;
    updateSparkOpen();
    if (userInitiated) {
      track('compare_select', { id: id });
      try { document.dispatchEvent(new CustomEvent('ampy:optionSelect', { detail: { id: id } })); } catch (e) {}
      if (state.selectedOption === id) {
        var name = optById(lastRank, id) ? cardName(optById(lastRank, id)).toLowerCase() : actionSpoken(id);
        var live = $('#resultLive');
        if (live) live.textContent = fill(S.rec.announce, { namn: name });
      }
    }
  }

  /* ---------- E. rec numbers (reused by the Sparstaplarna dropdowns) ---------- */
  function recNumbers(o) {
    if (!o || !o.saving) return {};
    var m = {
      savingRange: (function () {
        var lo = Math.max(0, roundTo(o.saving[0], ROUND.hero)), hi = Math.max(0, roundTo(o.saving[2], ROUND.hero));
        return (lo === hi) ? nf(hi) + ' kr' : nf(lo) + '-' + nf(hi) + ' kr';
      })(),
      investRange: (function () {
        if (!o.netInvest) return '';
        var lo = roundTo(o.netInvest[0], ROUND.stat), hi = roundTo(o.netInvest[1], ROUND.stat);
        return (lo === hi) ? nf(lo) : nf(lo) + '-' + nf(hi);
      })(),
      pbRange: (function () {
        if (o.paybackLow == null || o.paybackHigh == null) return EMPTY;
        var a = roundTo(o.paybackLow, ROUND.payback), b = roundTo(o.paybackHigh, ROUND.payback);
        return (a === b) ? yrStr(a) : yrStr(a) + '-' + yrStr(b);
      })()
    };
    return m;
  }
  function vbRangeStr() {
    var a = (D.waterborneAdder && D.waterborneAdder[0]) || 60000;
    var b = (D.waterborneAdder && D.waterborneAdder[1]) || 120000;
    return nf(a) + '-' + nf(b);
  }
  function battSlots(R) {
    var br = battRange(R);
    var gross = (D.battery && D.battery.grossFrom) || 33000;
    var rate = (D.battery && D.battery.greenTechRate) || 0.5;
    return {
      battRange: br ? br.text.replace('+', '') : '',   // br.text already ends in " kr"
      battGross: nf(gross),
      battNet: nf(roundTo(gross * (1 - rate), 500))
    };
  }

  /* ---------- F. the CTA block ---------- */
  /* MM7 + owner P1-P4: the CTA is ALWAYS the solid teal primary with the ONE
   * label — every branch now leads with a purchasable action, so the soft/ghost
   * CTA state is retired entirely. */
  function renderCtaBlock(rec) {
    var cta = $('#ctaBtn');
    if (!cta.classList.contains('is-close') && !leadSent) {
      cta.textContent = S.cta.plan;
    }
  }

  /* (the sticky mobile bar was removed on owner order — mobile flows inputs-first, result below) */

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
  var ACTION_SPOKEN = { batteri: 'solcellsbatteri', styrning: 'smart styrning', service: 'service och trimning av värmepumpen', solplan: 'solceller med batteri' };
  function actionSpoken(id) { return ACTION_SPOKEN[id] || id; }

  var liveT;
  function announceResult(R, rec) {
    clearTimeout(liveT);
    liveT = setTimeout(function () {
      var live = $('#resultLive'); if (!live) return;
      var av = anchorVals(R);
      var txt = av.single
        ? 'Idag kostar husets energi cirka ' + nf(av.mid) + ' kronor per år.'
        : 'Idag kostar husets energi cirka ' + nf(av.lo) + ' till ' + nf(av.hi) + ' kronor per år.';
      // V10: EVERY lead announces — option leads with their numbers, action leads by name
      if (rec.lead.type === 'option') {
        var o = optById(R, rec.lead.id);
        if (o && o.saving) {
          var slo = Math.max(0, roundTo(o.saving[0], ROUND.hero)), shi = Math.max(0, roundTo(o.saving[2], ROUND.hero));
          txt += ' Rimligaste vägen ser ut att vara ' + leadDisplayName(rec.lead.id) + ', ungefär ' + nf(slo) + ' till ' + nf(shi) + ' kronor lägre per år på värme och varmvatten.';
        }
      } else {
        txt += ' Vår rekommendation: ' + actionSpoken(rec.lead.id) + '.';
      }
      live.textContent = txt;
    }, 800);
  }

  /* ---------- G. methodology: bullets + legal, NO curve (R10) ----------
   * V10 §3.2 (owner point 11): every bullet verified against what the engine
   * ACTUALLY does (V10-copy B.1 executed audit) and rewritten in rost register. */
  function methodHtml(R, rec) {
    var b = R.baseline.results.ctx;
    var bd = R.baseline.breakdown || [];
    function inStack(id) { return bd.some(function (x) { return x.id === id; }); }
    var items = [];
    // 1. demand schablon (elområde named; "graddagar för ett normalår" — not "normalårskorrigerat")
    items.push('Husets värmebehov uppskattar vi från byggår, boyta, antal boende och var i landet huset ligger. Över året fördelar vi värmen efter graddagar för ett normalår.');
    // 2. household schablon — the typed-kWh path uses the flat 5 000 strip
    items.push(R.baseline.overrideMode === 'kwh'
      ? 'Hushållsel räknar vi som en fast schablon på 5 000 kWh. Den påverkas inte av valet av värme, så den står lika i alla vägar.'
      : 'Hushållsel, alltså belysning, vitvaror och elektronik, räknar vi som en försiktig schablon som växer med antalet boende. Den påverkas inte av valet av värme, så den står lika i alla vägar.');
    // 3. constants (esc-safe "grader", never the degree sign)
    items.push('Vi räknar på 21 grader inomhus och på radiatorer. Golvvärme ger värmepumpen något bättre verkningsgrad.');
    // 4. multi-system split
    if (b.isMultiSystem) {
      items.push('Värmer flera system delar vi kostnaden efter dina andelar. Komplementen täcker tillsammans högst 70 procent av värmen.');
    }
    // 5. measured demand — states the 5 000 kWh strip openly
    if (b.demandMeasured) {
      items.push('Du har angett husets årsförbrukning, så vi räknar på den i stället för schablonen. Vi drar av 5 000 kWh hushållsel och räknar resten som värme och varmvatten. Då smalnar spannet.');
    }
    // 6. field SPF
    items.push('Värmepumpars verkningsgrad räknar vi som fältmätt årsvärde, inte laboratorievärde. Att luftvärmepumpar tappar i sträng kyla ligger i siffran.');
    // 7. marginal price — SE3 anchor + the elområde adjustment stated
    items.push('Elpriset räknar vi som marginalpris: cirka 1,80 kr per kWh i SE3 med nät, skatt och moms, justerat efter ditt elområde och viktat mot vintern när värmen behövs.');
    // 8. fjärrvärme price — only when fjärrvärme is in the stack (dead olja/pellets/ved prices deleted)
    if (inStack('fjarrvarme')) {
      items.push('Fjärrvärme jämför vi på pris, inte verkningsgrad: cirka 1,20 kr per kWh, ett riksgenomsnitt. Din taxa kan ligga både över och under, kontrollera den på fakturan.');
    }
    // 9. kamin köpt-ved price + egen-ved candour — only when kamin is in the stack
    if (inStack('kamin')) {
      items.push('Braskaminen räknar vi på köpt ved, cirka 1,45 kr per kWh värme. Eldar du med egen ved blir kostnaden i kronor lägre, men ditt arbete räknar vi inte i pengar.');
    }
    // 10. waterborne inference — franluft now true in code (AR-1)
    items.push('Vattenburna element läser vi av från ditt värmesystem: fjärrvärme, vattenburen el, frånluftspumpar och vattenburna värmepumpar brukar ha det. Annars räknar vi utan, vilket ger en försiktigare kalkyl.');
    // 11. ROT + worked example for the lead option
    var rot = 'Investeringar visas efter ROT, 30 procent på arbetskostnaden. Grön teknik gäller inte värmepumpar.';
    if (rec && rec.lead.type === 'option') {
      var lo2 = optById(R, rec.lead.id);
      if (lo2 && lo2.results && lo2.results.ctx) {
        var c2 = lo2.results.ctx;
        rot += ' För ' + c2.pumpLabel.toLowerCase() + ': brutto ' + krStr(c2.gross, 500) + ', ROT ' + krStr(c2.rot, 100) + ', netto ' + krStr(c2.net, 500) + '. Förutsatt outnyttjat ROT-utrymme.';
      }
    }
    items.push(rot);
    // 12. the sort + the lead rule, described as the code actually decides (incl. the T7
    //     whole-house preference — the reviewer measured it deciding 23 % of option leads)
    items.push('Alternativen sorteras efter investeringsnivå och därefter kortast återbetalningstid, allt räknat efter ROT. Rekommendationen väljer vi på återbetalningstid. Har huset vattenburna element föredrar vi en lösning som värmer hela huset, om den är återbetald inom tio år. Inga poäng, inga vikter.');
    // 13. solar — branch on whether the offset actually applied (typed kWh ⇒ it did NOT)
    if (b.solarApplied) {
      items.push('Din solel sänker dagens kostnad med det du använder själv, försiktigt räknat. Såld överskottsel räknar vi inte in.');
    } else if (state.solarMode === 'finns' && b.demandMeasured) {
      items.push('Du har angett husets förbrukning, så din solel ligger redan i den siffran. Vi drar inte av den en gång till.');
    }
    // 14. battery — value-of-selfuse vs price-after-grön-teknik kept separate
    if (state.solarMode === 'finns') {
      items.push('Batterisiffran är värdet av ökad egenanvändning och prisstyrd laddning för ett vanligt villabatteri. Priset visas efter grön teknik, 50 procent. Stödtjänster räknar vi aldrig in i summan.');
    }
    // 15-17. effektavgift, borrhål, RSS spann
    items.push('Eventuell effektavgift från elnätsbolaget räknar vi inte med.');
    items.push('Bergvärme kräver borrhål och sker via partner.');
    items.push('Spannet i siffrorna kombinerar två osäkerheter: husets verkliga värmebehov och pumpens verkliga årsvärmefaktor. Vi räknar dem som oberoende, inte som staplade värstafall.');

    return '<ul class="method-list">' +
      items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') +
      '</ul>' +
      '<p class="method-legal">' + esc(S.methodLegal) + '</p>';
  }

  /* ========================================================================
   * INTERACTIONS — sliders, stepper, expander, share, lead form
   * ====================================================================== */
  function wireControls() {
    // sliders: label-first, recompute rides the rAF throttle (iOS drag perf)
    el('[data-input]').forEach(function (n) {
      var isRange = (n.type === 'range');
      n.addEventListener(isRange ? 'input' : 'change', function () {
        if (isRange) scheduleRecompute(); else recompute();
      });
      if (isRange) n.addEventListener('change', settleRecompute);
    });
    var area = $('#areaSlider'); area.addEventListener('input', function () { $('#areaOut').textContent = area.value + ' m²'; });

    // the own-figure slider (activation = assertion; bounds impossible to escape)
    var own = $('#ownSlider');
    if (own) {
      own.addEventListener('input', function () {
        state.ownKwh = +own.value;
        $('#ownOut').textContent = nf(state.ownKwh) + ' kWh per år';
        scheduleRecompute();
      });
      own.addEventListener('change', function () {
        settleRecompute();
        track('own_slider_set', { kwh_bucket: bucketKwh(state.ownKwh) });
      });
    }

    // the solar production slider
    var sol = $('#solarSlider');
    if (sol) {
      sol.addEventListener('input', function () {
        state.solarKwh = +sol.value;
        $('#solarOut').textContent = nf(state.solarKwh) + ' kWh per år';
        scheduleRecompute();
      });
      sol.addEventListener('change', settleRecompute);
    }

    // stepper (occupants) — m-m3: disabled at the 1/8 bounds; m-p1: real bump keyframe
    el('.stepbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = $('#occupantsField'); var v = Math.max(1, Math.min(8, (+f.value) + (+b.dataset.dir)));
        f.value = v;
        syncStepBtns(v);
        var out = $('#occOut');
        out.textContent = v;
        if (!REDUCED) { out.classList.remove('bump'); void out.offsetWidth; out.classList.add('bump'); }
        recompute();
      });
    });
    syncStepBtns(+$('#occupantsField').value);

    // (Sparstaplarna rows wire their own tap-to-expand in renderSpark; no separate toggle)

    // share (AmpyCodec: house state only, NO identity, ever) — v30:
    // native sheet where navigator.share exists (THE premium mobile pattern);
    // otherwise a small anchored popover with Kopiera länk / mejl / Facebook.
    // The legacy button-label clipboard toast is DELETED.
    wireShare();

    // lead form (inline)
    $('#ctaBtn').addEventListener('click', openLead);
    $('#leadClose').addEventListener('click', closeLead);
    $('#leadForm').addEventListener('submit', submitLead);
    // validate-on-blur per field
    [['#leadName', validateName], ['#leadPhone', validatePhone], ['#leadZip', validateZip], ['#leadEmail', validateEmail]].forEach(function (pair) {
      var f = $(pair[0]); if (f) f.addEventListener('blur', function () { pair[1](true); });
    });
  }

  /* ---------- v30 share UX: native sheet OR anchored popover ---------- */
  function legacyCopy(url, done) {
    try {
      var tmp = document.createElement('textarea');
      tmp.value = url; document.body.appendChild(tmp); tmp.select();
      document.execCommand('copy'); document.body.removeChild(tmp);
      done();
    } catch (e) {}
  }
  function wireShare() {
    var shareBtn = $('#shareBtn');
    if (!shareBtn || !CODEC) return;
    var pop = $('#sharePop');
    var popCloser = null;
    // the popup ARIA only holds where the popover path actually runs;
    // with navigator.share the button opens the native sheet instead
    if (navigator.share) {
      shareBtn.removeAttribute('aria-haspopup');
      shareBtn.removeAttribute('aria-expanded');
      shareBtn.removeAttribute('aria-controls');
    }
    function shareUrl() {
      var url = location.origin + location.pathname;
      var q = CODEC.encode(shareState());
      if (q) url += '?' + q;
      return url;
    }
    function closePop(refocus) {
      if (!pop || pop.hidden) return;
      pop.hidden = true;
      shareBtn.setAttribute('aria-expanded', 'false');
      if (popCloser) { document.removeEventListener('pointerdown', popCloser, true); popCloser = null; }
      if (refocus) { try { shareBtn.focus(); } catch (e) {} }
    }
    function openPop() {
      var url = shareUrl();
      var mail = $('#shareMail');
      if (mail) mail.href = 'mailto:?subject=' + encodeURIComponent(S.shareMailSubject) + '&body=' + encodeURIComponent(url);
      var fb = $('#shareFb');
      if (fb) fb.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
      pop.hidden = false;
      // flip below when the viewport space above the button is tight
      // (measure with the pop visible so offsetHeight is real)
      pop.classList.remove('share-pop--below');
      var btnRect = shareBtn.getBoundingClientRect();
      if (btnRect.top < pop.offsetHeight + 12) pop.classList.add('share-pop--below');
      shareBtn.setAttribute('aria-expanded', 'true');
      popCloser = function (ev) {
        if (!pop.contains(ev.target) && !shareBtn.contains(ev.target)) closePop(false);
      };
      document.addEventListener('pointerdown', popCloser, true);
      var first = $('.share-act', pop);
      if (first) { try { first.focus(); } catch (e) {} }
    }
    shareBtn.addEventListener('click', function () {
      track('share_click');
      if (navigator.share) {
        navigator.share({ title: S.shareTitle, text: S.shareText, url: shareUrl() }).catch(function () {});
        return;
      }
      if (!pop) return;
      if (pop.hidden) openPop(); else closePop(true);
    });
    if (!pop) return;
    // Escape closes; ArrowUp/Down walk the menu (role="menu" contract);
    // Home/End jump; Tab wraps lightly over the three rows
    pop.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closePop(true); return; }
      var items = el('.share-act', pop);
      if (!items.length) return;
      var i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); return; }
      if (e.key === 'Home') { e.preventDefault(); items[0].focus(); return; }
      if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); return; }
      if (e.key === 'Tab') {
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
    var copyBtn = $('#shareCopy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = shareUrl();
        var done = function () {
          // inline confirmation swap ON THE ROW — no floating toast
          var lbl = $('.share-act-lbl', copyBtn);
          if (lbl) {
            lbl.textContent = S.shareCopied;
            copyBtn.classList.add('is-done');
            setTimeout(function () { lbl.textContent = S.shareCopy; copyBtn.classList.remove('is-done'); }, 2000);
          }
          $('#shareLive').textContent = S.shareCopied;
          setTimeout(function () { $('#shareLive').textContent = ''; }, 2000);
          track('share_channel', { ch: 'copy' });
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done).catch(function () { legacyCopy(url, done); });
        } else {
          legacyCopy(url, done);
        }
      });
    }
    var mailA = $('#shareMail');
    if (mailA) mailA.addEventListener('click', function () { track('share_channel', { ch: 'mail' }); closePop(false); });
    var fbA = $('#shareFb');
    if (fbA) fbA.addEventListener('click', function () { track('share_channel', { ch: 'fb' }); closePop(false); });
  }

  /* ---------- v30 mobile jump-pill (fresh minimal build — the old #msum machinery
   * is long deleted; this shares nothing with it). Appears after the FIRST input
   * interaction, smooth-scrolls to #result, hides while #result is in view (IO)
   * and while the lead form is open (= the only keyboard surface). ---------- */
  var pillArmed = false, pillResultVisible = false;
  function pillUpdate() {
    var pill = $('#jumpPill'); if (!pill) return;
    var lead = $('#leadInline');
    var leadOpen = !!(lead && lead.classList.contains('open'));
    var mobile = window.matchMedia('(max-width:991px)').matches;
    var show = pillArmed && mobile && !pillResultVisible && !leadOpen;
    pill.classList.toggle('show', show);
    pill.tabIndex = show ? 0 : -1;
    pill.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  function wireJumpPill() {
    var pill = $('#jumpPill'), res = $('#result');
    if (!pill || !res) return;
    if (!('IntersectionObserver' in window)) { pill.remove(); return; }   // no IO → no pill, never a stuck one
    new IntersectionObserver(function (entries) {
      pillResultVisible = entries[0].isIntersecting;
      pillUpdate();
    }, { threshold: 0.12 }).observe(res);
    var form = $('#inputForm');
    var arm = function () { if (!pillArmed) { pillArmed = true; pillUpdate(); } };
    if (form) {
      ['pointerdown', 'input', 'change'].forEach(function (evt) {
        form.addEventListener(evt, arm, { once: true, passive: true });
      });
    }
    pill.addEventListener('click', function () {
      track('jump_result');
      try { res.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); }
      catch (e) { res.scrollIntoView(); }
    });
  }

  function toggleEl(n, willOpen) { if (!n) return; n.classList.toggle('open', willOpen); }

  function syncStepBtns(v) {   // m-m3: 44px hit box kept; bound state disabled + dimmed
    el('.stepbtn').forEach(function (b) {
      b.disabled = (+b.dataset.dir === -1) ? v <= 1 : v >= 8;
    });
  }

  /* DM1b sticky-BOTTOM fallback: when the input card outgrows the viewport, keep
   * position:sticky but pin its bottom edge via a negative inline top (the old
   * .static kill-switch silently killed sticky for the WHOLE session) */
  function checkStickyIntegrity() {
    var card = $('#inputForm');
    if (!card) return;
    if (window.matchMedia('(max-width:991px)').matches) { card.style.top = ''; return; }
    var tooTall = card.scrollHeight > (window.innerHeight - 48);
    card.style.top = tooTall ? (window.innerHeight - card.offsetHeight - 24) + 'px' : '';
  }

  /* ---------- the URL codec: share state out, prefill in (house state ONLY) ---------- */
  var ERA_TOKEN = { pre1940: 'e1', midcentury: 'e2', modern2010: 'e3', new2021: 'e4' };
  var TOKEN_ERA = { e1: 'pre1940', e2: 'midcentury', e3: 'modern2010', e4: 'new2021', x: 'x' };
  var M2_MID = { b1: 80, b2: 130, b3: 180, b4: 250 };

  function areaBand(a) { return a < 100 ? 'b1' : a <= 150 ? 'b2' : a <= 200 ? 'b3' : 'b4'; }

  function shareState() {
    var sel = heatSelection();
    var ownActive = state.ownMode === 'ja' && ownRowAllowed();
    return {
      sys: sel.primary,
      comps: sel.complements.map(function (c) {
        return { system: c.system, stop: (state.heat[c.system] && state.heat[c.system].stop != null) ? state.heat[c.system].stop : DEFAULT_STOP };
      }),
      m2: areaBand(+$('#areaSlider').value),
      era: state.era === 'x' ? 'x' : (ERA_TOKEN[state.era] || null),
      kwh: ownActive ? state.ownKwh : null,
      se: state.priceArea,
      sol: state.solarMode === 'planeras' ? { mode: 'p' }
         : state.solarMode === 'finns' ? { mode: 'f', kwh: state.solarKwh }
         : null
    };
  }

  function applyDecoded() {
    if (!CODEC) return false;
    var dec = CODEC.decode(location.search);
    var any = false;
    if (dec.sys && D.currentSystems[dec.sys]) {
      if (UI_HIDDEN_SYSTEMS[dec.sys]) {
        // UI-hidden system (olja/vedpellets) in an old share link: map to the
        // Vet inte state so no card-less selection can ever render (seeded, MB1)
        state.heat = {};
        state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true, seeded: true };
        state.vetinte = true;
        setHint(S.hintVetinte);
        any = true;
      } else {
        state.heat = {};
        state.heat[dec.sys] = { on: true, stop: DEFAULT_STOP, assumed: true };
        any = true;
      }
    }
    dec.comps.forEach(function (c) {
      // hidden systems are skipped; the Vet inte state stays pure (no complements)
      if (state.vetinte || UI_HIDDEN_SYSTEMS[c.system]) return;
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
    // v7: ?kwh honoured ONLY when the decoded stack is all-electric; clamped to the
    // slider band + rounded to step. Legacy ?kr / ?vb: decoded and DROPPED silently
    // (schablon + inference take over).
    if (dec.kwh && ownRowAllowed()) {
      var mn = (D.own && D.own.min) || 5000, mx = (D.own && D.own.max) || 60000, st = (D.own && D.own.step) || 500;
      state.ownMode = 'ja';
      state.ownKwh = clamp(roundTo(dec.kwh, st), mn, mx);
      var sl = $('#ownSlider');
      if (sl) { sl.value = state.ownKwh; }
      var out = $('#ownOut'); if (out) out.textContent = nf(state.ownKwh) + ' kWh per år';
      any = true;
    }
    if (dec.sol) {
      if (dec.sol.mode === 'p') { state.solarMode = 'planeras'; any = true; }
      else if (dec.sol.mode === 'f') {
        state.solarMode = 'finns';
        var smn = (D.solar && D.solar.prodMin) || 2000, smx = (D.solar && D.solar.prodMax) || 12000, sst = (D.solar && D.solar.prodStep) || 500;
        if (dec.sol.kwh) state.solarKwh = clamp(roundTo(dec.sol.kwh, sst), smn, smx);
        var ss = $('#solarSlider'); if (ss) ss.value = state.solarKwh;
        var so = $('#solarOut'); if (so) so.textContent = nf(state.solarKwh) + ' kWh per år';
        any = true;
      }
    }
    if (dec.se && D.priceAreas[dec.se]) { state.priceArea = dec.se; state.seTouched = true; any = true; }
    return any;
  }

  function syncAsmTags() {
    var e = $('#eraAsm'); if (e) e.hidden = state.era !== 'x';
  }

  /* ---------- lead validation (required: namn + telefon + postnr + e-post; consent via submit) ---------- */
  function setErr(fieldSel, errSel, msg) {
    var f = $(fieldSel), e = $(errSel);
    if (msg) { f.setAttribute('aria-invalid', 'true'); e.textContent = msg; e.hidden = false; return false; }
    f.removeAttribute('aria-invalid'); e.hidden = true; return true;
  }
  function validateName(live) {
    var v = $('#leadName').value.trim();
    if (!v && live !== 'silent') return setErr('#leadName', '#errName', S.err.name);
    if (!v) return false; return setErr('#leadName', '#errName', null);
  }
  function validatePhone(live) {
    var v = $('#leadPhone').value.trim();
    var ok = v.replace(/\D/g, '').length >= 7;   // m-m8: at least 7 DIGITS, punctuation-agnostic
    if (!ok) return setErr('#leadPhone', '#errPhone', S.err.phone);
    return setErr('#leadPhone', '#errPhone', null);
  }
  function validateZip(live) {
    var v = $('#leadZip').value.replace(/\s/g, '');
    if (!/^\d{5}$/.test(v)) return setErr('#leadZip', '#errZip', S.err.zip);
    return setErr('#leadZip', '#errZip', null);
  }
  function validateEmail(live) {
    var v = $('#leadEmail').value.trim();
    if (!v) return setErr('#leadEmail', '#errEmail', S.err.emailReq);   // now REQUIRED (owner)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return setErr('#leadEmail', '#errEmail', S.err.email);
    return setErr('#leadEmail', '#errEmail', null);
  }

  function openLead() {
    var w = $('#leadInline'); w.removeAttribute('hidden');
    // m-m2: after a sent lead, reopening shows the success state, never a blank re-submittable form
    $('#leadForm').hidden = leadSent;
    $('#leadSuccess').hidden = !leadSent;
    var cta = $('#ctaBtn'); var open = !w.classList.contains('open');
    toggleEl(w, open); cta.setAttribute('aria-expanded', open ? 'true' : 'false');
    pillUpdate();   // the jump-pill hides while the lead form is open
    if (open) {
      track('lead_open');
      cta.classList.add('is-close');
      cta.disabled = false;
      cta.innerHTML = 'Stäng ' + ICONS.chevUp;
      /* MB2: the form opens BELOW the fold — scroll it into view; auto-focus only
       * on pointer devices (on touch the iOS keyboard would cover the form) */
      setTimeout(function () {
        try { w.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'nearest' }); } catch (e) {}
        if (!window.matchMedia('(hover:none)').matches) {
          // focus AFTER the smooth scroll settles — focusing mid-scroll cancels it in some Chromium versions
          setTimeout(function () {
            try { $('#leadName').focus({ preventScroll: true }); } catch (e2) {}
          }, REDUCED ? 0 : 420);
        }
      }, REDUCED ? 0 : 240);
    } else {
      restoreCta();
    }
  }

  function closeLead() {
    var w = $('#leadInline');
    toggleEl(w, false);
    var cta = $('#ctaBtn'); cta.setAttribute('aria-expanded', 'false');
    restoreCta();
    pillUpdate();
    try { cta.focus(); } catch (e) {}
  }

  function restoreCta() {
    var cta = $('#ctaBtn');
    cta.classList.remove('is-close');
    if (leadSent) {
      // m-m2 sent-state: label + disabled until any input changes (recompute clears it)
      cta.textContent = S.cta.sent;
      cta.disabled = true;
    } else {
      cta.textContent = S.cta.plan;   // MM7: the ONE label, always solid
      cta.disabled = false;
    }
  }

  function submitLead(e) {
    e.preventDefault();
    if ($('#leadCompany').value) { return; } // honeypot tripped: silently drop
    var okName = validateName(true), okPhone = validatePhone(true), okZip = validateZip(true), okEmail = validateEmail(true);
    if (!(okName && okPhone && okZip && okEmail)) {
      var firstBad = $('[aria-invalid="true"]'); if (firstBad) firstBad.focus();
      return;
    }
    $('#leadErr').hidden = true;
    try {
      var R = lastRank, rec = lastRec;
      var sel = heatSelection();
      var ownActive = state.ownMode === 'ja' && ownRowAllowed();
      // the lead row's DISPLAYED numbers, so the advisor calls prepared (null-safe when action-lead)
      var leadOpt = (R && rec && rec.lead.type === 'option') ? optById(R, rec.lead.id) : null;
      // attribution: campaign params survive to the CRM (utm_*, fbclid, gclid) + referrer
      var attr = {};
      try {
        var q = new URLSearchParams(location.search);
        q.forEach(function (v, k) { if (/^(utm_|fbclid|gclid)/.test(k)) attr[k] = v; });
      } catch (eq) {}
      // webhook stays the console-logged owner-gated stub — but the payload is CRM-complete
      // pressing the submit button IS the consent (text under the button) — timestamp it
      console.log('[ampy lead]', {
        leadId: 'lm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
        consentTs: new Date().toISOString(),
        name: $('#leadName').value.trim(),
        phone: $('#leadPhone').value.trim(),
        email: $('#leadEmail').value.trim(),
        zip: $('#leadZip').value.trim(),
        primary: sel.primary,
        complements: sel.complements.map(function (c) { return c.system; }),
        override: (R && R.baseline.overrideMode) || null,
        area: $('#areaSlider').value,
        era: state.era,                              // byggår band ('x' = vet inte)
        occupants: +$('#occupantsField').value,
        priceArea: state.priceArea,
        seAssumed: !state.seTouched,
        solarMode: state.solarMode,
        solarKwh: state.solarMode === 'finns' ? state.solarKwh : null,
        branch: R ? R.verdict.branch : null,
        recBranch: rec ? rec.branch : null,
        recLead: rec ? rec.lead.id : null,
        recLeadType: rec ? rec.lead.type : null,     // V10: option | action
        recLongPb: rec ? !!rec.longPb : null,        // V10: honest-payback flag
        recSavingLo: leadOpt ? Math.max(0, roundTo(leadOpt.saving[0], ROUND.stat)) : null,
        recSavingHi: leadOpt ? Math.max(0, roundTo(leadOpt.saving[2], ROUND.stat)) : null,
        recPaybackMid: (leadOpt && leadOpt.paybackMid != null) ? roundTo(leadOpt.paybackMid, ROUND.payback) : null,
        best: R ? R.verdict.bestOptionId : null,
        savingBucket: R ? bucketKr(R.verdict.bestSavingMid) : '0',
        kwhBucket: ownActive ? bucketKwh(state.ownKwh) : null,
        attribution: attr,
        referrer: document.referrer || null,
        page: location.href.split('?')[0]
      });
      track('lead_submit', { branch: rec ? rec.branch : null });
      leadSent = true;   // m-m2: sent-state until the next input change
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

  /* ---------- resize: re-place the sliding pills (bars are % width, no re-measure) ---------- */
  window.addEventListener('resize', function () {
    replaceAllPills();
    checkStickyIntegrity();
    pillUpdate();   // crossing the 991 breakpoint re-gates the jump-pill
  });

  /* ---------- boot ---------- */
  function boot() {
    var decodedAny = applyDecoded();      // ?-param prefill (house state only, no identity)
    buildInputs();
    syncAsmTags();
    wireControls();
    wireJumpPill();
    if (decodedAny) firstTouch(true);   // a shared link counts as touched (no assumed-state notes)
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
