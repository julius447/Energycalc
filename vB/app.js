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
    return (a === b) ? '~' + nf(a) + ' kr/år' : '~' + nf(a) + '-' + nf(b) + ' kr/år';
  }
  var ROUND = (D.meta && D.meta.rounding) ? D.meta.rounding : { hero: 1000, stat: 500, payback: 0.5 };

  /* ---------- instrumentation (consent-gated, bucketed, experiment_id) ---------- */
  function hasConsent() { return window.ampyConsent === true || window.AMPY_CONSENT === true; }
  function track(ev, params) {
    if (!hasConsent()) return; /* no event fires without consent state */
    try {
      var p = { event: 'ek_' + ev, experiment_id: 'energikalkylatorn-v9' };
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
    caveat: {
      styrning: 'Styr värmen efter pris och behov. Vi sätter en siffra först när källan är granskad.'
    },
    reason: {
      redanVarmepump: 'Huset värms redan av en värmepump. Vi visar siffran som jämförelse, inte som råd.',
      luftluftFinnsRedan: 'Luft-luft finns redan i huset, så en till ger litet utrymme till mer.',
      styrningEjStyrbar: 'Kräver värme som går att styra elektroniskt. Ved och pellets eldas för hand.'
    },
    compare: {
      subExtraRedan: 'Du har redan ett effektivt system. Staplarna visar vad ett byte skulle göra, som jämförelse.',
      idag: 'Idag',
      behallMicro: 'din kostnad idag',
      behallTag: 'rimligast just nu',
      qualTag: 'utan pris',
      prisTag: 'Prisjämförelse: du köper färdig värme, inte el.',
      chip: 'Solcellsbatteri: ungefär {battRange} per år i ökat värde av din solel. Ej med i staplarna.',
      chipHint: 'Har du solceller? Ange det till vänster så räknar vi med din solel.',
      microSaving: '{sav} lägre per år',
      microDyr: '{sav} dyrare per år',
      microPb: 'återbetald på {pb}'
    },
    rec: {
      plate: {
        standard: 'För ett hus som ditt ser {b}{leadName}{/b} ut som den rimligaste vägen. Ungefär {b}{savingRange}{/b} lägre per år, återbetald på {pbRange} år.',
        delvisLost: 'Din värmepump gör redan en stor del av jobbet. Rimligast nu: behåll och styr smartare. Kvar att jobba med är {residualLabel}, ungefär {residualShare} procent av värmen, cirka {residualKr} kr per år.',
        redanEffektiv: 'Bra nyheter: din uppvärmning är redan effektiv. Det ärliga svaret är att en stor investering knappast lönar sig.',
        halvvags: 'Din frånluftspump gör redan halva jobbet. Med dina siffror är det rimligast att behålla den och styra värmen smartare.',
        fjarrvarmePris: 'Fjärrvärme är ofta en rimlig affär. Om ett byte lönar sig beror på din taxa, inte på verkningsgrad. Med dina siffror är det rimligast att behålla och styra det du kan.',
        komfortFraga: 'Vedvärme är billig per kilowattimme. Det en värmepump köper dig är tid och jämn värme. Det är en ärlig avvägning, inte en besparingskalkyl.',
        ingenBesparing: 'Med dina siffror räknar vi inte hem det. Det ärliga svaret är att behålla det du har. Har du din riktiga årskostnad blir kalkylen skarpare.',
        litenBesparing: 'Med dina siffror blir besparingen liten. En stor investering är svår att räkna hem, men de små åtgärderna kan vara värda att göra.',
        langsiktig: 'Det finns pengar att spara i huset, men ingen åtgärd betalar sig inom tio år med dina siffror. Rimligast nu: behåll det du har och styr värmen smartare.'
      },
      body: {
        luftluft: 'En luft-luftvärmepump ersätter inte hela uppvärmningen, men den tar en stor del av den till en bråkdel av kostnaden. Den värmer där luften når, och det du har idag sitter kvar som reserv i övriga rum. Investeringen landar runt {investRange} kr efter ROT 30 procent på arbetet. Med dina siffror sänker den kostnaden med ungefär {savingRange} kr per år och är återbetald på {pbRange} år. Sedan är besparingen din, år efter år. Nästa steg är enkelt: en elektriker tittar på planlösningen, hittar rätt placering för innedelen och ger dig ett fast pris.',
        luftvattenWb: 'Huset har redan vattenburna element, och det är halva jobbet gjort. En luft-vatten värmepump kopplas på systemet du har och hämtar större delen av värmen ur luften. Investeringen landar runt {investRange} kr efter ROT 30 procent på arbetet. Med dina siffror sänker den kostnaden med ungefär {savingRange} kr per år och är återbetald på {pbRange} år. Pumpen tappar i kyla, det är med i siffran. Nästa steg: en elektriker går igenom huset, kontrollerar att elcentralen klarar pumpen och ger dig ett fast pris.',
        luftvattenNoWb: 'En luft-vatten värmepump värmer hela huset via vattenburna element. Huset har inte det systemet idag, så vi har räknat med {vbRange} kr extra för att lägga till det, det ingår i investeringen på {investRange} kr efter ROT. Även med den posten sänker den kostnaden med ungefär {savingRange} kr per år, återbetald på {pbRange} år. Pumpen tappar i kyla, det är med i siffran. Nästa steg: en elektriker går igenom huset och ger dig ett fast pris där ingenting hänger på slumpen.',
        bergvarme: 'Bergvärme hämtar värmen ur berget och ligger stabilt året om, även i sträng kyla. I ett hus med din förbrukning är det ett starkt alternativ. Investeringen är den stora: runt {investRange} kr efter ROT 30 procent på arbetet, och den kräver borrhål på tomten. Med dina siffror sänker den kostnaden med ungefär {savingRange} kr per år och är återbetald på {pbRange} år. Borrningen sker via partner, vi berättar om tomten räcker. Nästa steg: en elektriker går igenom huset och ger dig ett fast pris.',
        delvisLost: 'När en värmepump redan tar en stor del av värmen finns det mindre kvar för en ny investering att spara på. En stor pump skulle till stor del ersätta värme som redan är billig, och då växer återbetalningstiden snabbt. Därför leder vi inte med den. Det ärliga draget är att rikta in sig på det som är kvar: {residualLabel} står för ungefär {residualShare} procent av värmen, cirka {residualKr} kr per år. Smart styrning flyttar den förbrukningen till timmar när elen är billig, utan ingrepp i huset. Vill du ändå se de stora alternativen finns de i jämförelsen ovan, med sina verkliga återbetalningstider.',
        /* redanEffektiv splits in two: bodyB is REPLACED by batteri.featured on solar-finns (V7-COPY §1.3) */
        redanEffektivA: 'Skönt besked: den stora investeringen är redan gjord, och den gör sitt jobb. Att byta upp sig från en fungerande värmepump går nästan aldrig att räkna hem, så det rekommenderar vi inte.',
        redanEffektivB: 'Det som återstår är finlir. Smart styrning kan flytta förbrukning till timmar när elen är billig, utan att röra värmen. Håll pumpen ren och servad, det kostar lite och skyddar verkningsgraden. Siffrorna i jämförelsen ovan visar vad ett byte skulle kosta, som jämförelse, inte som råd.',
        halvvags: 'En frånluftspump återvinner värme ur ventilationsluften, och det gör den varje dag. Men den är inte lika effektiv som en modern luft-vatten eller bergvärme, så en del av värmen kommer fortfarande från el. Att byta i förtid går sällan att räkna hem: besparingen är verklig men liten, och återbetalningstiden blir lång. Det som lönar sig nu är smart styrning och att hålla pumpen i trim med rena filter. Den dag pumpen ändå ska bytas ändras kalkylen, och då är det rätt läge att räkna om här.',
        fjarrvarmePris: 'Med fjärrvärme köper du färdig värme, inte el. Därför jämför vi på pris: det som avgör är vad din taxa kostar per kilowattimme, inte hur effektiv en värmepump är. Siffrorna i jämförelsen ovan bygger på ett riksgenomsnitt. Din taxa kan ligga både över och under, så kontrollera den på fakturan innan du drar slutsatser. Vill du sänka kostnaden utan att byta system: kontrollera vilken prismodell du har hos fjärrvärmebolaget, och styr hushållselen mot billiga timmar. En kamin eller en luft-luft kan komplettera, det räknar vi gärna på.',
        komfortFraga: 'Räknat i kronor per kilowattimme är ved och pellets svåra att slå, särskilt med egen ved. Därför lovar vi ingen besparing här, det vore inte ärligt. Frågan är i stället vad ditt arbete är värt: bära, elda, sota och passa pannan, vecka efter vecka. En värmepump köper dig tid och jämn värme, och priset för det syns i jämförelsen ovan, öppet redovisat med sin verkliga återbetalningstid. Vill du behålla vedvärmen är det ett fullt rimligt val, och kaminen gör fortsatt nytta de kallaste dagarna som spets.',
        ingenBesparing: 'Det här är också ett svar, och det är gratis: behåll det du har. Med de uppgifter du fyllt i räknar vi inte hem någon av de stora åtgärderna, och då säger vi det hellre rakt ut än säljer på dig något. Vill du ändå göra något: smart styrning flyttar förbrukning till billiga timmar utan att röra värmen. Och vet du husets riktiga årsförbrukning, fyll i den under Din el, då smalnar spannet och kalkylen blir skarpare. Ändras elpriset eller huset är det bara att räkna om.',
        litenBesparing: 'Besparingen finns, men den är liten, och en stor investering är svår att räkna hem på den. Det säger vi hellre rakt ut. Det som är värt att göra är de små stegen: smart styrning som flyttar förbrukning till billiga timmar, och enkla vanor som sänker varmvattnet. Jämförelsen ovan visar de stora alternativen med sina verkliga återbetalningstider, så kan du själv se varför vi inte leder med dem. Vet du husets årsförbrukning, fyll i den under Din el så blir kalkylen skarpare.',
        langsiktig: 'Vi har en regel: en åtgärd som tar mer än tio år på sig att betala sig leder vi aldrig med. Med dina siffror klarar ingen av de stora åtgärderna det, och då är det ärliga rådet att vänta. Det kostar ingenting. Under tiden gör smart styrning verklig nytta: värmen styrs efter pris och behov, utan ingrepp i huset. Alternativen finns kvar i jämförelsen ovan med sina verkliga återbetalningstider. Ändras elpriset, huset, eller kommer dagen då något ändå ska bytas, räkna om här. Då kan svaret bli ett annat.'
      },
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
      batteriFeatured: 'Det ärliga nästa steget för ditt hus är ett solcellsbatteri. Det ökar värdet av solel du redan producerar: mer av din egen el används i huset, och batteriet kan köpa el när den är billig och använda den när den är dyr. Med dina siffror handlar det om ungefär {battRange} per år. Pris från {battGross} kr, och med grön teknik 50 procent på arbete och material landar det runt {battNet} kr. Stödtjänster som FCR-D kan ge en intäkt ovanpå, men den är osäker och ingår aldrig i vår grundkalkyl. Tar ditt elnätsbolag effektavgift kan batteriet dessutom kapa topparna, också det ovanpå.',
      secHead: 'För den som vill se längre',
      sec: {
        luftvattenWb: 'Luft-vatten värmer hela huset via vattnet, återbetald på {pbRange} år.',
        luftvattenNoWb: 'Luft-vatten värmer hela huset, återbetald på {pbRange} år. Utan vattenburet system tillkommer {vbRange} kr, det är inräknat.',
        bergvarmeWb: 'Bergvärme ligger stabilt året om, återbetald på {pbRange} år. Kräver borrhål och sker via partner.',
        bergvarmeNoWb: 'Bergvärme, återbetald på {pbRange} år inklusive vattenburet system för {vbRange} kr extra. Borrhål via partner.',
        luftluft: 'En luft-luft som komplement, återbetald på {pbRange} år. Den värmer där luften når.'
      },
      disclose: {
        luftvatten: 'Vi visar siffran som jämförelse, inte som råd. Med dina siffror är luft-vatten återbetald först på {pbRange} år, längre än vi är bekväma att rekommendera. {adder}Ändras förutsättningarna kan kalkylen ändras, räkna gärna om då.',
        bergvarme: 'Vi visar siffran som jämförelse, inte som råd. Bergvärme är återbetald först på {pbRange} år med dina siffror, och kräver borrhål via partner. {adder}Den dag ditt nuvarande system ändå ska bytas ser kalkylen annorlunda ut.',
        styrning: 'Smart styrning styr värmen efter pris och behov. Vi sätter en siffra först när källan är granskad, därför visar vi den utan pris.',
        behall: 'Ingen åtgärd är också ett svar. Ditt system gör redan jobbet. Noll kronor i investering, och du kan räkna om här när något ändras.'
      },
      announce: 'Vald väg: {namn}. Rekommendationen visas nedan.'
    },
    spark: {
      recLabel: 'Vår rekommendation',
      verdict: {
        luftluft:        'En luft-luftvärmepump tar en stor del av värmen till en bråkdel av kostnaden. Det du värmer med idag sitter kvar som reserv i rummen den inte når.',
        luftvattenWb:    'En luft-vatten värmepump kopplas på dina vattenburna element och hämtar större delen av värmen ur luften. Tappet i kyla är inräknat.',
        luftvattenNoWb:  'En luft-vatten värmepump värmer hela huset via vattenburna element. Huset saknar det systemet idag, så {vbRange} kr för att lägga till det ingår i investeringen.',
        bergvarme:       'Bergvärme hämtar värmen ur berget och ligger stabilt året om, även i sträng kyla. Den kräver borrhål på tomten, via partner.',
        styrning:        'Styr värmen efter pris och behov, utan ingrepp i huset. Vi sätter en siffra först när källan är granskad.',
        behall:          'Ingen åtgärd är också ett svar. Ditt system gör redan jobbet, och du kan räkna om här när något ändras.',
        batteri:         'Ett solcellsbatteri ökar värdet av elen du redan producerar. Mer används i huset, och det kan köpa el när den är billig och använda den när den är dyr.',
        discloseLuftvatten: 'Vi visar siffran som jämförelse, inte som råd. Med dina siffror är luft-vatten återbetald först på {pbRange} år, längre än vi är bekväma att rekommendera.',
        discloseBergvarme:  'Vi visar siffran som jämförelse, inte som råd. Bergvärme är återbetald först på {pbRange} år, och kräver borrhål via partner.',
        dyrare:          'Det här bytet ökar kostnaden i ditt hus. Vi visar det för ärlighetens skull.'
      },
      figInvest: 'Investering efter ROT', figPayback: 'Återbetald på',
      figBattGross: 'Pris från', figBattNet: 'Efter grön teknik 50 %',
      figBehall: 'Noll kronor i investering',
      utanPris: 'utan pris', tagBehall: 'rimligast just nu'
    },
    sbMix: {
      line: '{label} ~{share} % av värmen · ca {kr} kr per år',
      arbete: ' + ditt arbete',
      solar: 'Solel drar av ca {kr} kr av elkostnaden.'
    },
    cta: {
      plan: 'Få en plan för ditt hus', soft: 'Få en kostnadsfri bedömning'
    },
    share: 'Dela din kalkyl',
    shareCopied: 'Länk kopierad',
    shareText: 'Se vad värmen kostar i ditt hus. Gratis, utan mejl.',
    shareTitle: 'Energikalkylatorn från Ampy',
    leadErr: 'Det gick inte att skicka just nu. Försök igen om en stund.',
    err: {
      name: 'Skriv ditt namn.',
      phone: 'Skriv ett nummer vi kan nå dig på.',
      zip: 'Postnumret ska vara fem siffror.',
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
  state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true };

  var userTouched = false, booted = false;
  var lastRank = null, lastRec = null, lastResult = null;

  /* ---------- waterborne INFERENCE (L5 kill — the question is dead) ----------
   * VB_IMPLIES: any stack member ⇒ true; direktel-only + EVERY ambiguous case ⇒
   * conservative false (REVERSES v6 vedpellets:'ja'; [GAP-L1v7 → elektriker]).
   * The +60-120 tkr invest effect lives in the rec TEXT (V7-COPY riders). */
  var VB_IMPLIES = ['fjarrvarme', 'olja', 'vattenburenEl', 'luftvattenCur', 'bergvarmeCur'];
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
      var a = $('#seAsm'); if (a) a.hidden = true;
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

  function toggleCard(id) {
    if (id === 'vetinte') {
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

    if (!wasOn) {
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
      // never allow an empty selection: fall back to the default primary
      var anyOn = Object.keys(state.heat).some(function (k) { return state.heat[k].on; });
      if (!anyOn) {
        state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true };
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
    el('.hp-card').forEach(function (c) {
      var id = c.dataset.sys;
      var on = (id === 'vetinte')
        ? state.vetinte
        : (!state.vetinte && isOn(id));
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
  }
  function syncSolarUI() {
    var gear = $('#gearSol');
    if (gear) {
      gear.removeAttribute('hidden');
      toggleEl(gear, state.solarMode === 'finns');
    }
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
    // selection re-defaults to the lead so plate, rail and expander always agree
    var rowIds = compareRowIds(R);
    var defaultSel = rec.lead.type === 'composite' ? 'behall' : rec.lead.id;
    var surviving = state.selectedByUser && state.selectedOption &&
      (rowIds.indexOf(state.selectedOption) !== -1 ||
       (state.selectedOption === 'batteri' && inp.hasSolar));
    if (!surviving) { state.selectedOption = defaultSel; state.selectedByUser = false; }

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
      return 'Behåll ' + prim + ' och komplettera med luft-luft';
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
  function anchorText(av) { return '~' + (av.single ? nf(av.mid) : nf(av.lo) + '-' + nf(av.hi)); }

  function renderAnchor(R) {
    var av = anchorVals(R);
    var num = $('#anchorNum');
    num.innerHTML = anchorText(av) + ' <span class="anchor-per">kr per år</span>';
    if (!REDUCED) {
      num.classList.add('flash');
      requestAnimationFrame(function () { num.classList.remove('flash'); });
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

  function compareRowIds(R) {
    return visibleOptions(R).map(function (o) { return o.id; });
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
      showFlag: false, batt: false, val: '', valClass: '', tag: null, reason: '',
      hasBar: false, fillPct: 0, bandLeft: 0, bandW: 0, pay: null, payWeak: false, aria: ''
    };
    var weakPb = (o.paybackMid != null && o.paybackMid >= 15);

    // behall (only reached on behållFirst branches — standard drops it upstream)
    if (o.id === 'behall') {
      p.kind = 'behall'; p.isRec = true; p.showFlag = true; p.tag = S.spark.tagBehall;
      p.aria = p.name + '. ' + S.spark.tagBehall + '. ' + S.spark.verdict.behall + ' Visa rekommendationen.';
      return p;
    }
    // ineligible: greyed WITH reason, never hidden (rendered as a static note row)
    if (!o.eligible) {
      p.kind = 'off'; p.off = true;
      p.reason = S.reason[o.ineligibleReason] || '';
      p.aria = p.name + '. ' + p.reason;
      return p;
    }
    // styrning (qualitative — utan pris, no bar, no figures)
    if (o.numeric === false) {
      p.kind = 'styrning'; p.val = S.spark.utanPris; p.valClass = 'soft';
      p.aria = p.name + '. Utan pris. ' + S.spark.verdict.styrning + ' Visa rekommendationen.';
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
    p.payWeak = weakPb;
    p.isRec = (rec.lead.type === 'option' && rec.lead.id === o.id && !weakPb);
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

  /* the battery pseudo-row (not a rank.js option) — mint bar on the saving scale */
  function battRowProps(R, scaleMax) {
    var br = battRange(R); if (!br) return null;
    var p = {
      id: 'batteri', name: 'Solcellsbatteri', kind: 'batt', batt: true, off: false,
      isRec: false, showFlag: false, tag: '', valClass: '',   /* the row only renders when solar=Finns — a "kräver solel" tag would be noise */
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

  function sparRowInner(p) {
    var flag = '<span class="sp-flag"' + (p.showFlag ? '' : ' hidden') + '>' + sparStar() + esc(S.spark.recLabel) + '</span>';
    var valClass = 'sp-val' + (p.valClass === 'soft' ? ' sp-val--soft' : (p.valClass === 'amber' ? ' sp-val--amber' : ''));
    var head = '<span class="sp-head"><span class="sp-name">' + esc(p.name) + '</span>' +
      (p.tag ? '<span class="sp-tag">' + esc(p.tag) + '</span>' : '') +
      (p.val ? '<span class="' + valClass + '">' + esc(p.val) + '</span>' : '') +
      sparCaret() + '</span>';
    var barline = '';
    if (p.hasBar) {
      barline = '<span class="sp-barline"><span class="sp-track" aria-hidden="true">' +
        '<span class="sp-fill" style="width:' + p.fillPct.toFixed(2) + '%"></span>' +
        (p.bandW > 0 ? '<span class="sp-band" style="left:' + p.bandLeft.toFixed(2) + '%;width:' + p.bandW.toFixed(2) + '%"></span>' : '') +
        '</span>' +
        (p.pay ? '<span class="sp-pay' + (p.payWeak ? ' sp-pay--weak' : '') + '">' + esc(p.pay) + '</span>' : '') +
        '</span>';
    }
    return flag + head + barline;
  }

  function figRow(dt, dd) {
    return '<div><dt>' + esc(dt) + '</dt><dd>' + esc(dd) + '</dd></div>';
  }

  /* dropdown body: tight verdict sentence + (numeric/battery) two figure lines.
   * Reuses recNumbers/battSlots for every number; NEVER a fabricated styrning figure. */
  function renderSparDrop(o, R, rec, wb) {
    var verdict = '', figs = '';
    var pbLeadMax = (D.rec && D.rec.pbLeadMax) || 10;
    if (o.id === 'behall') {
      verdict = S.spark.verdict.behall;
      figs = '<p class="sp-fignote">' + esc(S.spark.figBehall) + '</p>';
    } else if (!o.eligible) {
      verdict = esc(S.reason[o.ineligibleReason] || '');
    } else if (o.numeric === false) {
      verdict = S.spark.verdict.styrning;
    } else if (o.saving[1] <= 0) {
      verdict = S.spark.verdict.dyrare;
    } else {
      var n = recNumbers(o);
      var isLong = (o.paybackMid != null && o.paybackMid > pbLeadMax);
      if (o.id === 'luftluft') {
        verdict = S.spark.verdict.luftluft;
      } else if (o.id === 'luftvatten') {
        verdict = isLong ? fill(S.spark.verdict.discloseLuftvatten, { pbRange: n.pbRange })
                         : fill(wb ? S.spark.verdict.luftvattenWb : S.spark.verdict.luftvattenNoWb, { vbRange: vbRangeStr() });
      } else if (o.id === 'bergvarme') {
        verdict = isLong ? fill(S.spark.verdict.discloseBergvarme, { pbRange: n.pbRange })
                         : S.spark.verdict.bergvarme;
      } else {
        verdict = esc(o.label);
      }
      var invest = n.investRange ? '~' + n.investRange + ' kr' : EMPTY;
      var pb = (n.pbRange && n.pbRange !== EMPTY) ? '~' + n.pbRange + ' år' : EMPTY;
      figs = '<dl class="sp-figs">' + figRow(S.spark.figInvest, invest) + figRow(S.spark.figPayback, pb) + '</dl>';
    }
    return (verdict ? '<p class="sp-verdict">' + verdict + '</p>' : '') + figs;
  }

  function renderBattDrop(R) {
    var bs = battSlots(R);
    var figs = '<dl class="sp-figs">' +
      figRow(S.spark.figBattGross, bs.battGross + ' kr') +
      figRow(S.spark.figBattNet, '~' + bs.battNet + ' kr') + '</dl>';
    return '<p class="sp-verdict">' + S.spark.verdict.batteri + '</p>' + figs;
  }

  var sparkDrawn = false;
  function renderSpark(R, rec) {
    var list = $('#sparkList'); if (!list) return;
    var wb = inferWaterborne(heatSelection());

    // row set: rank.js order EXACTLY; behall pinned first on behållFirst, dropped on standard
    var visible = visibleOptions(R).slice();
    if (rec.lead.type === 'composite') {
      var bi = -1;
      for (var i = 0; i < visible.length; i++) if (visible[i].id === 'behall') { bi = i; break; }
      if (bi > 0) { var bmoved = visible.splice(bi, 1)[0]; visible.unshift(bmoved); }
    } else {
      visible = visible.filter(function (o) { return o.id !== 'behall'; }); // a zero prize is not a bar
    }

    /* ADVICE ORDER (owner: the ★ recommendation must lead, not sit under styrning).
     * Float the lead row to the top, keep the eligible pumps in rank order, sink the
     * qualitative "utan pris" styrning row toward the bottom, greyed/ineligible last.
     * The battery row is appended after this loop, so it stays truly last. */
    var leadId = rec.lead.type === 'option' ? rec.lead.id
               : (rec.lead.type === 'composite' ? 'behall' : null);
    function sparPri(o) {
      if (leadId && o.id === leadId) return 0;             // the recommendation leads
      if (!o.eligible) return 3;                            // greyed-with-reason sinks
      if (o.id === 'styrning' || o.numeric === false) return 2; // "utan pris" footnote row
      return 1;                                             // eligible pumps, rank order kept
    }
    visible = visible.map(function (o, i2) { return { o: o, i: i2 }; })
      .sort(function (a, b) { var d = sparPri(a.o) - sparPri(b.o); return d !== 0 ? d : a.i - b.i; })
      .map(function (x) { return x.o; });

    // scaleMax over shown numeric rows incl the battery hi
    var hasSolar = state.solarMode === 'finns';
    var br = hasSolar ? battRange(R) : null;
    var maxSav = 0;
    visible.forEach(function (o) {
      if (o.numeric !== false && o.eligible && o.saving && o.saving[2] > 0) maxSav = Math.max(maxSav, o.saving[2]);
    });
    if (br) maxSav = Math.max(maxSav, br.hi);
    var scaleMax = maxSav > 0 ? 1.02 * maxSav : 1;

    // build (full rebuild — <=7 rows, cheap; inline widths render final, no re-anim on recalc)
    list.innerHTML = '';
    function appendRow(id, o, p, dropHtml) {
      var item = document.createElement('div');
      item.className = 'sp-item' + (p.isRec ? ' is-rec' : '') + (p.off ? ' is-off' : '') + (p.batt ? ' sp-item--batt' : '');
      item.dataset.id = id;
      if (p.kind === 'off') {
        // ineligible: informational, not a button; reason wraps inline (never hidden)
        item.innerHTML = '<div class="sp-row sp-row--static">' +
          '<span class="sp-head"><span class="sp-name">' + esc(p.name) + '</span></span>' +
          '<span class="sp-note">' + esc(p.reason) + '</span></div>';
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
    visible.forEach(function (o) {
      var p = sparRowProps(o, R, rec, scaleMax, wb);
      appendRow(o.id, o, p, renderSparDrop(o, R, rec, wb));
    });
    if (br) {
      var pbatt = battRowProps(R, scaleMax);
      if (pbatt) appendRow('batteri', null, pbatt, renderBattDrop(R));
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
        var name = id === 'batteri' ? 'solcellsbatteri'
          : (optById(lastRank, id) ? cardName(optById(lastRank, id)).toLowerCase() : id);
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
      battRange: br ? br.text.replace('+', '') + ' kr' : '',
      battGross: nf(gross),
      battNet: nf(roundTo(gross * (1 - rate), 500))
    };
  }

  /* ---------- F. the CTA block ---------- */
  function renderCtaBlock(rec) {
    var soft = rec.branch !== 'standard';
    var cta = $('#ctaBtn');
    if (!cta.classList.contains('is-close')) {
      cta.textContent = soft ? S.cta.soft : S.cta.plan;
    }
    cta.classList.toggle('cta--ghost', soft && !cta.classList.contains('is-close'));
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
  var liveT;
  function announceResult(R, rec) {
    clearTimeout(liveT);
    liveT = setTimeout(function () {
      var live = $('#resultLive'); if (!live) return;
      var av = anchorVals(R);
      var txt = av.single
        ? 'Idag kostar husets energi cirka ' + nf(av.mid) + ' kronor per år.'
        : 'Idag kostar husets energi cirka ' + nf(av.lo) + ' till ' + nf(av.hi) + ' kronor per år.';
      if (rec.branch === 'standard' && rec.lead.type === 'option') {
        var o = optById(R, rec.lead.id);
        if (o && o.saving) {
          var slo = Math.max(0, roundTo(o.saving[0], ROUND.hero)), shi = Math.max(0, roundTo(o.saving[2], ROUND.hero));
          txt += ' Rimligaste vägen ser ut att vara ' + leadDisplayName(rec.lead.id) + ', ungefär ' + nf(slo) + ' till ' + nf(shi) + ' kronor lägre per år på värme och varmvatten.';
        }
      }
      live.textContent = txt;
    }, 800);
  }

  /* ---------- G. methodology: bullets + legal, NO curve (R10) ---------- */
  function methodHtml(R, rec) {
    var b = R.baseline.results.ctx;
    var items = [];
    items.push('Husets värmebehov uppskattar vi från byggår, boyta och antal boende, normalårskorrigerat.');
    items.push('Hushållsel, alltså belysning, vitvaror och elektronik, räknar vi som en försiktig schablon som växer med antalet boende. Den ligger utanför det värme och styrning påverkar, så den står lika i alla vägar.');
    items.push('Vi räknar på 21 °C inomhus och på radiatorer. Golvvärme ger värmepumpen något bättre verkningsgrad.');
    if (b.isMultiSystem) {
      items.push('Värmer flera system delar vi kostnaden efter dina andelar. Komplementen täcker tillsammans högst 70 procent.');
    }
    if (b.demandMeasured) {
      items.push('Du har angett husets årsförbrukning, så vi räknar på den i stället för schablonen. Då smalnar spannet.');
    }
    items.push('Värmepumpars verkningsgrad räknar vi som fältmätt årsvärde, inte laboratorievärde. Vinterns tapp är med i siffran.');
    items.push('Elpriset räknar vi som marginalpris, cirka 1,80 kr per kWh med allt inräknat, vinterviktat på värmen.');
    items.push('Bränslepriser 2026: fjärrvärme cirka 1,20 kr per kWh (Nils Holgersson 2025: 1,23), villaolja cirka 21 000 kr per m³, pellets cirka 4 400 kr per ton, björkved cirka 2 100 kr per m³.');
    items.push('Vattenburna element läser vi av från ditt värmesystem: fjärrvärme, olja, vattenburen el och vattenburna värmepumpar brukar ha det. Annars räknar vi utan, vilket ger en försiktigare kalkyl.');
    var rot = 'Investeringar visas efter ROT, 30 procent på arbetskostnaden. Grön teknik gäller inte värmepumpar.';
    if (rec && rec.lead.type === 'option') {
      var lo2 = optById(R, rec.lead.id);
      if (lo2 && lo2.results && lo2.results.ctx) {
        var c2 = lo2.results.ctx;
        rot += ' För ' + c2.pumpLabel.toLowerCase() + ': brutto ' + krStr(c2.gross, 500) + ', ROT ' + krStr(c2.rot, 100) + ', netto ' + krStr(c2.net, 500) + '. Förutsatt outnyttjat ROT-utrymme.';
      }
    }
    items.push(rot);
    items.push('Vi rangordnar efter återbetalningstid efter ROT. Inga poäng, inga vikter.');
    if (state.solarMode === 'finns') {
      items.push('Din solel sänker dagens kostnad med det du använder själv, försiktigt räknat. Såld överskottsel räknar vi inte in.');
      items.push('Batterikalkylen bygger på grön teknik 50 procent och batteriets effektiva kapacitet. Stödtjänster räknar vi aldrig in i summan.');
    }
    items.push('Eventuell effektavgift från elnätsbolaget räknar vi inte med.');
    // m7: the borrhål bullet only when bergvärme is actually shown in the comparison
    var showsBerg = (R.options || []).some(function (o) { return o.id === 'bergvarme'; });
    if (showsBerg) items.push('Bergvärme kräver borrhål och sker via partner.');
    items.push('Spannet kombinerar två osäkerheter, husets verkliga värmebehov och pumpens verkliga årsvärmefaktor, som oberoende osäkerheter i stället för staplade värstafall.');

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

    // stepper (occupants)
    el('.stepbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = $('#occupantsField'); var v = Math.max(1, Math.min(8, (+f.value) + (+b.dataset.dir)));
        f.value = v;
        var out = $('#occOut');
        if (!REDUCED) { out.classList.add('bump'); requestAnimationFrame(function () { out.classList.remove('bump'); }); }
        out.textContent = v;
        recompute();
      });
    });

    // (Sparstaplarna rows wire their own tap-to-expand in renderSpark; no separate toggle)

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
          navigator.share({ title: S.shareTitle, text: S.shareText, url: url }).catch(function () {});
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
        // Vet inte state so no card-less selection can ever render
        state.heat = {};
        state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true };
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
      var mn = (D.own && D.own.min) || 5000, mx = (D.own && D.own.max) || 45000, st = (D.own && D.own.step) || 500;
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
    var s = $('#seAsm'); if (s) s.hidden = state.seTouched;
  }

  /* ---------- lead validation (min = namn + telefon + postnr; consent via submit; e-post optional) ---------- */
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
    var ok = v.replace(/[\s\-()+]/g, '').length >= 7 && /[\d]/.test(v);
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
    if (!v) return setErr('#leadEmail', '#errEmail', null);  // optional
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return setErr('#leadEmail', '#errEmail', S.err.email);
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
      setTimeout(function () { try { $('#leadName').focus(); } catch (e) {} }, REDUCED ? 0 : 220);
    } else {
      restoreCta();
    }
    // NO scrollIntoView.
  }

  function closeLead() {
    var w = $('#leadInline');
    toggleEl(w, false);
    var cta = $('#ctaBtn'); cta.setAttribute('aria-expanded', 'false');
    restoreCta();
    try { cta.focus(); } catch (e) {}
  }

  function restoreCta() {
    var cta = $('#ctaBtn');
    cta.classList.remove('is-close');
    var soft = lastRec ? (lastRec.branch !== 'standard') : false;
    cta.textContent = soft ? S.cta.soft : S.cta.plan;
    cta.classList.toggle('cta--ghost', soft);
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
      // webhook stays the console-logged owner-gated stub; payload = bucketed/enum only
      // pressing the submit button IS the consent (text under the button) — timestamp it
      console.log('[ampy lead]', {
        consentTs: new Date().toISOString(),
        zip: $('#leadZip').value.trim(),
        primary: sel.primary,
        complements: sel.complements.map(function (c) { return c.system; }),
        override: (R && R.baseline.overrideMode) || null,
        area: $('#areaSlider').value,
        priceArea: state.priceArea,
        seAssumed: !state.seTouched,
        solarMode: state.solarMode,
        branch: R ? R.verdict.branch : null,
        recBranch: rec ? rec.branch : null,
        recLead: rec ? rec.lead.id : null,
        best: R ? R.verdict.bestOptionId : null,
        savingBucket: R ? bucketKr(R.verdict.bestSavingMid) : '0',
        kwhBucket: ownActive ? bucketKwh(state.ownKwh) : null
      });
      track('lead_submit', { branch: rec ? rec.branch : null });
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
  });

  /* ---------- boot ---------- */
  function boot() {
    var decodedAny = applyDecoded();      // ?-param prefill (house state only, no identity)
    buildInputs();
    syncAsmTags();
    wireControls();
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
