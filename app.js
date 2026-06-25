/* =============================================================================
 * app.js — Ampy energikalkylatorn (variant B · RÄKNINGSCHOCKEN)
 * Renderer + interactions + the SVG cost-curve. Reads window.AMPY_DATA, calls
 * window.AmpyEngine.calculate, writes values into the slot skeleton in index.html.
 * Rounding + Swedish formatting happen HERE (never in the engine).
 * ========================================================================== */

(function () {
  'use strict';
  var D = window.AMPY_DATA;
  var ENGINE = window.AmpyEngine;
  if (!D || !ENGINE) { return; }

  /* ---------- tiny DOM + format helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var REDUCED = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  function nf(n) { return Math.round(n).toLocaleString('sv-SE').replace(/ /g, ' '); }
  function roundTo(n, step) { return Math.round(n / step) * step; }
  function krStr(n, step) { return nf(roundTo(n, step)) + ' kr'; }
  function yrStr(y) { return (Math.round(y * 10) / 10).toString().replace('.', ','); }

  /* ---------- labels for the data-driven inputs (data.js holds the model, not copy) ---------- */
  var ERA_LABELS  = { pre1940: 'Före 1940', midcentury: '1970–1990', modern2010: '2010-tal', new2021: '2021+' };
  var DIST_LABELS = { golvvarme: 'Golvvärme', radiator: 'Radiator', hogtemp: 'Högtemp' };
  var DSO_LABELS  = { vetej: 'Vet ej', ellevio: 'Ellevio', vattenfall: 'Vattenfall', eon: 'E.ON' };
  var TIER_LABEL  = { durable: 'räknar vi med', effektavgift: 'kräver effektavgift', atrisk: 'kräver avtal, osäker' };

  /* ---------- selection state for the custom controls ---------- */
  var state = {
    priceArea: D.defaultPriceArea,
    era: D.defaultEra,
    distribution: D.defaultDistribution,
    pump: D.defaultPump
  };

  /* ---------- populate the dynamic inputs once ---------- */
  function buildInputs() {
    // current-system select
    var sysSel = $('#systemField');
    Object.keys(D.currentSystems).forEach(function (id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = D.currentSystems[id].label;
      if (id === D.defaultCurrentSystem) o.selected = true;
      sysSel.appendChild(o);
    });

    // elområde segmented
    buildSeg('#priceAreaSeg', Object.keys(D.priceAreas).map(function (id) {
      return { v: id, label: D.priceAreas[id].label };
    }), 'priceArea');

    // byggår/energiklass segmented
    buildSeg('#eraSeg', Object.keys(D.intensityByEra).map(function (id) {
      return { v: id, label: ERA_LABELS[id] || id };
    }), 'era');

    // värmedistribution segmented
    buildSeg('#distSeg', Object.keys(D.framledning).map(function (id) {
      return { v: id, label: DIST_LABELS[id] || id };
    }), 'distribution');

    // DSO select
    var dsoSel = $('#dsoField');
    Object.keys(D.dsoEffektavgift).forEach(function (id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = DSO_LABELS[id] || id;
      dsoSel.appendChild(o);
    });
  }

  var segBoxes = [];   // registry for the resize re-place of every sliding pill

  function buildSeg(sel, items, key) {
    var box = $(sel); if (!box) return;
    var activeBtn = null;
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = it.label; b.dataset.value = it.v;
      b.setAttribute('role', 'radio');
      if (it.v === state[key]) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); activeBtn = b; }
      else b.setAttribute('aria-checked', 'false');
      b.addEventListener('click', function () {
        state[key] = it.v;
        el('button', box).forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
        b.classList.add('on'); b.setAttribute('aria-checked', 'true');
        movePill(box, b);
        forceChartDraw = true;
        recompute();
      });
      box.appendChild(b);
    });
    // the single teal surface: a pill that translates under the active option
    var pill = document.createElement('span');
    pill.className = 'seg-pill'; pill.setAttribute('aria-hidden', 'true');
    box.appendChild(pill);
    segBoxes.push(box);
    // place it already-positioned (no slide from 0,0 on first paint)
    requestAnimationFrame(function () {
      var prev = pill.style.transition; pill.style.transition = 'none';
      movePill(box, activeBtn || $('button.on', box) || $('button', box));
      pill.getBoundingClientRect();
      requestAnimationFrame(function () { pill.style.transition = prev; });
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
      var on = $('button.on', box); if (!on) return;
      var pill = $('.seg-pill', box); if (!pill) return;
      var prev = pill.style.transition; pill.style.transition = 'none';
      movePill(box, on);
      pill.getBoundingClientRect();
      pill.style.transition = prev;
    });
  }

  /* ---------- read the live inputs ---------- */
  function getInputs() {
    var kwh = $('#annualKwhField').value;
    return {
      currentSystem: $('#systemField').value,
      area: +$('#areaSlider').value,
      priceArea: state.priceArea,
      annualKwh: kwh ? +kwh : null,
      occupants: +$('#occupantsField').value,
      era: state.era,
      indoorTemp: +$('#tempSlider').value,
      distribution: state.distribution,
      pump: state.pump,
      hasWaterborne: $('#waterborneField').checked,
      dso: $('#dsoField').value,
      hasSolar: $('#solarField').checked
    };
  }

  /* ========================================================================
   * RENDER
   * ====================================================================== */
  var lastResult = null;
  var forceChartDraw = false;   // set by seg-change / pump-pick; consumed by drawChart

  function recompute() {
    var inp = getInputs();
    var r = ENGINE.calculate(inp, D);
    lastResult = r;
    render(r, inp);
  }

  function render(r, inp) {
    var cur = r.ctx;
    var noSaving = !(r.heroSaving > 0);   // B1: gate the honest branch on the MID saving, not the band top

    // eyebrow
    $('#eyebrow').textContent = 'Jämfört med ' + (cur.currentIsElectric ? 'din ' : '') + cur.currentLabel.toLowerCase();
    $('#legendCurrent').textContent = cur.currentLabel.toLowerCase();

    // hero (range, rounded to 1000)
    var lo = Math.max(0, roundTo(r.heroLow, 1000));
    var hi = Math.max(0, roundTo(r.heroHigh, 1000));
    var heroEl = $('#heroValue'), wordEl = $('.hero-word'), heroBox = $('.hero');
    if (noSaving) {
      heroEl.textContent = 'Liten eller ingen besparing';
      wordEl.style.display = 'none';
      if (heroBox) heroBox.classList.add('hero--flat');
    } else {
      wordEl.style.display = '';
      wordEl.textContent = 'kr/år lägre';   // unit + qualifier ride the small word, the giant number stays short (B1)
      if (heroBox) heroBox.classList.remove('hero--flat');
      heroEl.textContent = '~ ' + (lo === hi ? nf(hi) : nf(lo) + '–' + nf(hi));
    }
    // hero: a 1-frame opacity touch only (Instant-Value rule: never translate, never count up)
    if (!REDUCED) {
      heroEl.classList.add('flash');
      requestAnimationFrame(function () { heroEl.classList.remove('flash'); });
    }

    // hero sub
    var sub = 'Med ' + cur.pumpLabel.toLowerCase() + ', efter ROT-avdraget på arbetet. Vi räknar bara på lägre uppvärmning, inte på solel eller stödtjänster.';
    if (cur.currentIsPrice) sub += ' Fjärrvärme jämför vi på pris, eftersom du köper färdig värme, inte el.';
    if (cur.pumpIsComplement) sub += ' Luft-luft värmer bara där luften når, så vi räknar på ' + Math.round(cur.servedShare * 100) + ' % av huset.';
    $('#heroSub').textContent = sub;

    // stat trio (figures settle in place, never count up — tabular-nums keeps it CLS-free)
    var trioVals = [$('#statCurrent'), $('#statPump'), $('#statPayback')];
    if (!REDUCED) trioVals.forEach(function (v) { if (v) v.classList.add('settle'); });
    $('#statCurrent').textContent = krStr(r.currentAnnual, 500) + '/år';
    $('#statPump').textContent = krStr(r.pumpAnnual, 500) + '/år';
    if (r.paybackLow == null || noSaving) {
      $('#statPayback').textContent = '—';
    } else {
      var pa = roundTo(r.paybackLow, 0.5), pb = roundTo(r.paybackHigh, 0.5);
      $('#statPayback').textContent = (pa === pb ? yrStr(pa) : yrStr(pa) + '–' + yrStr(pb)) + ' år';
    }
    if (!REDUCED) requestAnimationFrame(function () { trioVals.forEach(function (v) { if (v) v.classList.remove('settle'); }); });

    // mobile verdict text (carries the insight where the chart is smaller)
    var peak = peakMonth(r.currentCost);
    $('#verdict').textContent = noSaving
      ? 'Din nuvarande uppvärmning är redan effektiv. Då gör en värmepump liten skillnad på räkningen.'
      : ucfirst(monthLong(peak)) + ' är dyrast i dag. Det är då en värmepump sänker din räkning mest.';

    // chart (force the entrance choreography on segment-change / pump-pick only)
    drawChart(r, forceChartDraw);
    forceChartDraw = false;

    // comparison + upside (shown when their gear is open)
    renderCompare(r);
    renderUpside(r);

    // methodology + foot + placeholder
    $('#methodBody').innerHTML = methodHtml(r);
    $('#placeholderNote').textContent = D.meta.placeholderNote;
    $('#foot').innerHTML = 'Energikalkylatorn ger en uppskattning, inte ett bindande pris och inte ekonomisk rådgivning. '
      + 'Siffrorna är försiktiga schabloner som väntar slutlig signering av elektriker och ägare. '
      + 'Footprint i dag: Stockholmsregionen.';

    // honest-CTA branch: soften on no-saving
    var cta = $('#ctaBtn');
    cta.textContent = noSaving ? 'Få en kostnadsfri bedömning' : 'Få en skräddarsydd offert';
  }

  function peakMonth(arr) { var mi = 0, mv = -1; for (var i = 0; i < 12; i++) if (arr[i] > mv) { mv = arr[i]; mi = i; } return mi; }
  function monthLong(i) { return D.monthsLong[i]; }
  function ucfirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ---------- comparison bars (double as the pump selector) ---------- */
  function renderCompare(r) {
    var box = $('#compareBars'); box.innerHTML = '';
    var maxA = 0; r.comparison.forEach(function (c) { if (c.annual > maxA) maxA = c.annual; });
    r.comparison.forEach(function (c, i) {
      var row = document.createElement('div'); row.className = 'cbar' + (c.isChosen ? ' is-chosen' : '');
      var isPump = !c.isCurrent;
      var chosen = c.isChosen;
      var label = document.createElement('span'); label.className = 'cl' + (chosen ? ' on' : ''); label.textContent = c.label;
      var track = document.createElement('span'); track.className = 'ctrack';
      var fill = document.createElement('span'); fill.className = 'cfill';
      fill.style.background = c.isCurrent ? 'var(--slate)' : (chosen ? 'var(--teal)' : 'rgba(0,169,145,.45)');
      track.appendChild(fill);
      if (c.id === 'luftluft') { var t1 = document.createElement('span'); t1.className = 'ctag'; t1.textContent = 'komplement'; track.appendChild(t1); }
      else if (chosen) { var t2 = document.createElement('span'); t2.className = 'ctag'; t2.textContent = 'vald'; t2.style.color = 'var(--mint)'; track.appendChild(t2); }
      var val = document.createElement('span'); val.className = 'cval'; val.textContent = nf(roundTo(c.annual, 500));
      row.appendChild(label); row.appendChild(track); row.appendChild(val);
      if (isPump) {
        row.style.cursor = 'pointer'; row.setAttribute('role', 'button'); row.tabIndex = 0;
        row.setAttribute('aria-label', 'Välj ' + c.label);
        var pick = function () { state.pump = c.id; forceChartDraw = true; recompute(); };
        row.addEventListener('click', pick);
        row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      }
      box.appendChild(row);
      // animate fill via transform; stagger by i*40ms (<=160ms total)
      var frac = maxA > 0 ? c.annual / maxA : 0;
      var delay = REDUCED ? 0 : Math.min(i * 40, 160);
      setTimeout(function () {
        requestAnimationFrame(function () { fill.style.transform = 'scaleX(' + frac.toFixed(4) + ')'; });
      }, delay);
    });
  }

  /* ---------- upside rows ---------- */
  function renderUpside(r) {
    var box = $('#upsideRows'); box.innerHTML = '';
    r.upside.rows.forEach(function (row) {
      var d = document.createElement('div'); d.className = 'urow';
      var left = document.createElement('div'); left.className = 'ut';
      var tier = document.createElement('span'); tier.className = 'utier ' + row.tier; tier.textContent = TIER_LABEL[row.tier] || '';
      var name = document.createElement('span'); name.textContent = row.label;
      left.appendChild(tier); left.appendChild(name);
      var v = document.createElement('span'); v.className = 'uv' + (row.tier === 'atrisk' ? ' soft' : '');
      v.textContent = '+ ' + krStr(row.value, 100) + '/år';
      d.appendChild(left); d.appendChild(v);
      box.appendChild(d);
    });
    if (!r.upside.hasSolar) {
      var hint = document.createElement('div'); hint.className = 'upside-soft';
      hint.textContent = 'Slå på solel för att se solel- och batteriraderna.';
      box.appendChild(hint);
    }
  }

  /* ---------- methodology ---------- */
  function methodHtml(r) {
    var c = r.ctx;
    return '' +
      '<h4>Värmebehov</h4>Vi uppskattar husets energi från byggår, boyta, boende och innetemperatur, ' +
      'normalårskorrigerat. Skriv in din årsförbrukning så räknar vi på din verkliga siffra.' +
      '<h4>Verkningsgrad</h4>Vi räknar på <b>verklig årsvärmefaktor (fält-SPF)</b>, inte energimärkningens SCOP. ' +
      'Luftpumpens SPF sjunker i kyla, bergvärme ligger stabilt. Vald pump: <code>' + c.pumpLabel + '</code>, ' +
      'fält-SPF ~' + c.spfRange[0].toString().replace('.', ',') + '–' + c.spfRange[1].toString().replace('.', ',') + '.' +
      '<h4>Månadskurvan</h4>Årsbehovet fördelas över årets månader efter hur kallt det normalt är ' +
      '(graddagar: ju kallare månad, desto större andel av värmen). Vi använder SMHI:s normalår. Därför toppar räkningen på vintern.' +
      '<h4>Avdrag</h4>Värmepump ger <b>ROT 30 % på arbetskostnaden</b>, inte grön teknik. ' +
      'Brutto ' + krStr(c.gross, 500) + ', ROT ' + krStr(c.rot, 100) + ', netto <b>' + krStr(c.net, 500) + '</b>. ' +
      'Förutsatt outnyttjat ROT-utrymme.' +
      '<h4>Osäkerhet</h4>Vi visar ett spann, inte en exakt siffra. Bandet är vidast på vintern där fält-SPF är minst säker.' +
      (c.footprintFlag ? '<h4>Obs</h4>Bergvärme erbjuds i dag <b>' + c.footprintFlag + '</b> och bekräftas i offerten.' : '') +
      '<h4>Solel och batteri</h4>Eventuell solel- och batteriintäkt visas som separata rader, aldrig inräknat i besparingen ovan. ' +
      'Sommarsol kan inte täcka vinterns värme, ett batteri flyttar el över dygnet, inte över året.';
  }

  /* ========================================================================
   * THE SIGNATURE CHART — monthly cost, current vs pump, ± ribbon, winter peak
   * ====================================================================== */
  var CHART = { x0: 34, x1: 352, yTop: 30, yBase: 138, lblY: 156, vbW: 372, vbH: 168, padR: 20 };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var chartDrawn = false;   // gate the entrance choreography to explicit (non-drag) draws

  /* ---- monotone cubic Hermite (Fritsch-Carlson) — never overshoots the data ----
     Flattens the tangent at every local extremum so the smooth curve cannot dip
     below the Jun-Aug ~0 trough and invent a fictional negative-cost month. ---- */
  function smoothPath(pts) {
    var n = pts.length; if (n < 2) return '';
    if (n === 2) return 'M' + pts[0].x.toFixed(2) + ',' + pts[0].y.toFixed(2) + ' L' + pts[1].x.toFixed(2) + ',' + pts[1].y.toFixed(2);
    var i, dx = [], dy = [], m = [], t = [];
    for (i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; dy[i] = pts[i + 1].y - pts[i].y; m[i] = dy[i] / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) {
      if (m[i - 1] * m[i] <= 0) { t[i] = 0; }              // local extremum -> flat tangent (no overshoot)
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
    if (mobile) { c.yTop = 34; c.yBase = 150; c.lblY = 170; c.vbH = 188; }
    svg.setAttribute('viewBox', '0 0 ' + c.vbW + ' ' + c.vbH);

    var cur = r.currentCost, pump = r.pumpCost, loB = r.pumpCostLow, hiB = r.pumpCostHigh;
    var maxV = 0, i;
    for (i = 0; i < 12; i++) { maxV = Math.max(maxV, cur[i], hiB[i]); }
    if (maxV <= 0) maxV = 1;

    function X(m) { return c.x0 + m * (c.x1 - c.x0) / 11; }
    function Y(v) { return c.yBase - (v / maxV) * (c.yBase - c.yTop); }
    function ptsOf(arr) { var a = []; for (var m = 0; m < 12; m++) a.push({ x: X(m), y: Y(arr[m]) }); return a; }

    function smoothArea(arr) {
      // smooth top edge, straight return along the baseline
      return smoothPath(ptsOf(arr)) +
        ' L' + X(11).toFixed(2) + ',' + c.yBase.toFixed(2) +
        ' L' + X(0).toFixed(2) + ',' + c.yBase.toFixed(2) + ' Z';
    }
    function smoothRibbon() {
      // smooth top edge (hi, left->right) + smooth bottom edge (lo, reversed);
      // the reversed curve's leading M becomes an L so the two edges join into one closed band.
      var top = smoothPath(ptsOf(hiB));
      var loRev = ptsOf(loB).slice().reverse();
      var bot = smoothPath(loRev).replace(/^M([\d.\-]+),([\d.\-]+)/, 'L$1,$2');
      return top + ' ' + bot + ' Z';
    }

    var pk = peakMonth(cur);
    var title = '<title id="chartTitle">Månadskurva för kostnad</title>' +
      '<desc id="chartDesc">Nuvarande uppvärmning toppar i ' + monthLong(pk) +
      '. Värmepumpen ligger lägre hela året, med ett osäkerhetsband som vidgas under vintern.</desc>';

    // <defs>: gradient fills, band fill, pump glow
    var defs = '<defs>' +
      '<linearGradient id="gCur" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#8b95bd" stop-opacity=".22"/><stop offset="1" stop-color="#8b95bd" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="gPump" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#00c4a7" stop-opacity=".26"/><stop offset="1" stop-color="#00c4a7" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#19c39e" stop-opacity=".20"/><stop offset="1" stop-color="#19c39e" stop-opacity=".08"/></linearGradient>' +
      '<filter id="glowPump" x="-20%" y="-40%" width="140%" height="180%">' +
        '<feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '</defs>';

    var g = '';
    // winter wash (Jan-Feb, Nov-Dec): makes "band widest Nov-Feb" legible
    function washRect(m0, m1) {
      var xa = X(m0) - (c.x1 - c.x0) / 22, xb = X(m1) + (c.x1 - c.x0) / 22;
      return '<rect x="' + xa.toFixed(1) + '" y="' + c.yTop + '" width="' + (xb - xa).toFixed(1) +
        '" height="' + (c.yBase - c.yTop) + '" fill="rgba(85,255,154,.035)"/>';
    }
    g += washRect(0, 1) + washRect(10, 11);
    // baseline + two thirds gridlines (no numeric y-axis)
    g += '<line x1="' + c.x0 + '" y1="' + c.yBase + '" x2="' + c.x1 + '" y2="' + c.yBase + '" stroke="rgba(255,255,255,.12)" stroke-width="1"/>';
    var g1 = c.yTop + (c.yBase - c.yTop) / 3, g2 = c.yTop + 2 * (c.yBase - c.yTop) / 3;
    g += '<line x1="' + c.x0 + '" y1="' + g1.toFixed(1) + '" x2="' + c.x1 + '" y2="' + g1.toFixed(1) + '" stroke="rgba(255,255,255,.05)" stroke-width="1"/>';
    g += '<line x1="' + c.x0 + '" y1="' + g2.toFixed(1) + '" x2="' + c.x1 + '" y2="' + g2.toFixed(1) + '" stroke="rgba(255,255,255,.05)" stroke-width="1"/>';

    // fills (wrapped for the entrance fade)
    g += '<g class="ch-fills"' + (!REDUCED && (force || !chartDrawn) ? ' opacity="0"' : '') + '>';
    g += '<path d="' + smoothArea(cur) + '" fill="url(#gCur)"/>';
    g += '<path d="' + smoothRibbon() + '" fill="url(#gBand)"/>';
    g += '<path d="' + smoothArea(pump) + '" fill="url(#gPump)"/>';
    g += '</g>';

    // peak guide + saving brace (shows the WIN as a quantity)
    g += '<line x1="' + X(pk).toFixed(1) + '" y1="' + c.yTop + '" x2="' + X(pk).toFixed(1) + '" y2="' + Y(cur[pk]).toFixed(1) + '" stroke="rgba(255,255,255,.18)" stroke-width="1" stroke-dasharray="2 3"/>';
    g += '<line x1="' + X(pk).toFixed(1) + '" y1="' + Y(cur[pk]).toFixed(1) + '" x2="' + X(pk).toFixed(1) + '" y2="' + Y(pump[pk]).toFixed(1) + '" stroke="#55ff9a" stroke-width="2" stroke-opacity=".5" stroke-linecap="round"/>';

    // lines — colour-blind-safe: colour + dash + weight/glow (3 redundant channels)
    g += '<path d="' + smoothPath(ptsOf(cur)) + '" fill="none" stroke="#8b95bd" stroke-width="1.6" stroke-dasharray="1 5" stroke-linecap="round" stroke-linejoin="round" class="ln-cur"/>';
    g += '<path d="' + smoothPath(ptsOf(pump)) + '" fill="none" stroke="#00c4a7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowPump)" class="ln-pump"/>';

    // peak dots: hollow ring on current (pain), filled glow on pump (relief)
    g += '<circle cx="' + X(pk).toFixed(1) + '" cy="' + Y(cur[pk]).toFixed(1) + '" r="3.4" fill="none" stroke="#8b95bd" stroke-width="1.6"/>';
    g += '<circle class="peak-dot" cx="' + X(pk).toFixed(1) + '" cy="' + Y(pump[pk]).toFixed(1) + '" r="4.4" fill="#00c4a7" stroke="#55ff9a" stroke-width="2"/>';

    // peak pill in the TOP MARGIN, anchor clamped so it never clips at 375px
    var anchor = 'middle', px = X(pk);
    if (px < c.x0 + 24) anchor = 'start'; else if (px > c.x1 - 24) anchor = 'end';
    g += '<text x="' + px.toFixed(1) + '" y="' + (c.yTop - 9) + '" text-anchor="' + anchor + '" font-size="10" fill="#55ff9a" font-family="Outfit" font-weight="500">' + D.monthsLong[pk].slice(0, 3) + '-toppen</text>';

    // month strip (thinned to every-other + peak on mobile)
    for (var lm = 0; lm < 12; lm++) {
      if (mobile && (lm % 2) && lm !== pk) continue;
      g += '<text x="' + X(lm).toFixed(1) + '" y="' + c.lblY + '" text-anchor="middle" font-size="9" fill="' + (lm === pk ? '#cfe9e0' : '#7c86b0') + '" font-family="Outfit">' + D.months[lm] + '</text>';
    }

    // invisible hit targets
    for (var hm = 0; hm < 12; hm++) {
      var hx = X(hm) - (c.x1 - c.x0) / 22;
      g += '<rect x="' + hx.toFixed(1) + '" y="' + c.yTop + '" width="' + ((c.x1 - c.x0) / 11).toFixed(1) + '" height="' + (c.yBase - c.yTop) + '" fill="transparent" data-m="' + hm + '"/>';
    }

    // Parse + import (innerHTML drops namespaced SVG children in several engines).
    var parsed = new DOMParser().parseFromString(
      '<svg xmlns="' + SVGNS + '">' + title + defs + g + '</svg>', 'image/svg+xml');
    if (parsed.querySelector('parsererror')) { return; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    Array.prototype.slice.call(parsed.documentElement.childNodes).forEach(function (n) {
      svg.appendChild(document.importNode(n, true));
    });

    // the scrubber indicator — appended AFTER the parse (a single persistent group on top)
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

    // entrance choreography: only on first paint / segment-change / pump-pick
    if (!REDUCED && (force || !chartDrawn)) {
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
        // restore the current line's real dash after the draw-on completes
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

    wireChartHover(svg, r, X, Y, c);
  }

  function wireChartHover(svg, r, X, Y, c) {
    var tip = $('#chartTip'); var device = svg.parentNode;
    var ind = svg.querySelector('#_ind');
    var cursorM = -1;

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
      var sy = sRect.height / parseFloat(svg.viewBox.baseVal.height || 168);
      var left = (sRect.left - dRect.left) + X(m) * sx;
      var top = (sRect.top - dRect.top) + Math.min(Y(r.currentCost[m]), Y(r.pumpCost[m])) * sy;
      var delta = Math.max(0, r.currentCost[m] - r.pumpCost[m]);   // candour-safe: from the two values already shown
      tip.innerHTML = '<div class="tip-m">' + ucfirst(monthLong(m)) + '</div>' +
        '<div class="tip-r"><span>Nuvarande</span><span>' + krStr(r.currentCost[m], 50) + '</span></div>' +
        '<div class="tip-r"><span>Värmepump</span><span>' + krStr(r.pumpCost[m], 50) + '</span></div>' +
        '<div class="tip-d">~ ' + krStr(delta, 50) + ' lägre</div>';
      tip.hidden = false;
      // clamp inside the device box; flip below the point if no room above
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

    // touch scrubbing
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

    // keyboard scrubbing
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
   * INTERACTIONS — sliders, stepper, reveals, lead form
   * ====================================================================== */
  function wireControls() {
    // live recompute on any native input change
    el('[data-input]').forEach(function (n) {
      var ev = (n.type === 'range') ? 'input' : 'change';
      n.addEventListener(ev, recompute);
    });
    // slider output mirrors
    var area = $('#areaSlider'); area.addEventListener('input', function () { $('#areaOut').textContent = area.value + ' m²'; });
    var temp = $('#tempSlider'); temp.addEventListener('input', function () { $('#tempOut').textContent = temp.value + ' °C'; });

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

    // reveals (accordion via grid-rows 0fr->1fr; .open is the source of truth, not [hidden])
    // drop [hidden] once so the collapsed grid can render at 0fr height (stays in the a11y tree).
    ['#gearN2', '#gearN3', '#compare', '#upside'].forEach(function (sel) { var n = $(sel); if (n) n.removeAttribute('hidden'); });
    el('.reveal').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.reveal;
        var gear = $('#gear' + key.toUpperCase());
        var willOpen = !gear.classList.contains('open');
        toggleEl(gear, willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (key === 'n2') toggleEl($('#compare'), willOpen);
        if (key === 'n3') toggleEl($('#upside'), willOpen);
        // a seg inside a just-opened gear had no measurable box while collapsed;
        // re-place its pill once the grid has expanded (after the reveal transition).
        if (willOpen) setTimeout(replaceAllPills, REDUCED ? 0 : 240);
      });
    });

    // lead form
    $('#ctaBtn').addEventListener('click', openLead);
    $('#leadClose').addEventListener('click', function () { $('#leadwrap').setAttribute('hidden', ''); });
    $('#leadForm').addEventListener('submit', submitLead);
  }

  function toggleEl(n, willOpen) { if (!n) return; n.classList.toggle('open', willOpen); }

  function openLead() {
    var w = $('#leadwrap'); w.removeAttribute('hidden');
    $('#leadForm').hidden = false; $('#leadSuccess').hidden = true;
    setTimeout(function () { try { $('#leadName').focus(); } catch (e) {} }, 30);
    try { w.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' }); } catch (e) {}
  }

  function submitLead(e) {
    e.preventDefault();
    var err = $('#leadErr');
    if ($('#leadCompany').value) { return; } // honeypot tripped: silently drop
    var name = $('#leadName').value.trim(), email = $('#leadEmail').value.trim(),
        phone = $('#leadPhone').value.trim(), zip = $('#leadZip').value.trim(), gdpr = $('#leadGdpr').checked;
    if (!name || !email || !phone || !zip || !gdpr) {
      err.textContent = 'Fyll i namn, e-post, telefon, postnummer och godkänn villkoren.'; err.hidden = false; return;
    }
    err.hidden = true;
    // No backend in this build: log a bucketed, privacy-safe payload (savings as a band, not exact).
    var r = lastResult || {};
    var band = r.heroSaving ? (roundTo(r.heroLow, 1000) + '-' + roundTo(r.heroHigh, 1000)) : 'na';
    try {
      console.log('[ampy lead]', { zip: zip, system: $('#systemField').value, pump: state.pump, area: $('#areaSlider').value, priceArea: state.priceArea, savingBand: band });
    } catch (e2) {}
    $('#leadForm').hidden = true; $('#leadSuccess').hidden = false;
  }

  /* ---------- resize: re-place the sliding pills + re-tune the chart ---------- */
  var rT;
  window.addEventListener('resize', function () {
    replaceAllPills();
    clearTimeout(rT); rT = setTimeout(function () { if (lastResult) drawChart(lastResult, false); }, 160);
  });

  /* ---------- boot ---------- */
  function boot() {
    buildInputs(); wireControls(); recompute();
    // first-paint entrance choreography (once); guard reduced-motion
    if (!REDUCED) {
      var res = $('#result');
      requestAnimationFrame(function () {
        res.classList.add('enter');
        setTimeout(function () { res.classList.remove('enter'); }, 600);
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

})();
