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

  function buildSeg(sel, items, key) {
    var box = $(sel); if (!box) return;
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = it.label; b.dataset.value = it.v;
      b.setAttribute('role', 'radio');
      if (it.v === state[key]) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); }
      else b.setAttribute('aria-checked', 'false');
      b.addEventListener('click', function () {
        state[key] = it.v;
        el('button', box).forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
        b.classList.add('on'); b.setAttribute('aria-checked', 'true');
        recompute();
      });
      box.appendChild(b);
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
    var heroEl = $('#heroValue'), wordEl = $('.hero-word');
    if (noSaving) {
      heroEl.textContent = 'Liten eller ingen besparing';
      wordEl.style.display = 'none';
    } else {
      wordEl.style.display = '';
      heroEl.textContent = '~ ' + (lo === hi ? nf(hi) : nf(lo) + '–' + nf(hi)) + ' kr/år';
    }

    // hero sub
    var sub = 'Med ' + cur.pumpLabel.toLowerCase() + ', efter ROT-avdraget på arbetet. Vi räknar bara på lägre uppvärmning, inte på solel eller stödtjänster.';
    if (cur.currentIsPrice) sub += ' Fjärrvärme jämför vi på pris, eftersom du köper färdig värme, inte el.';
    if (cur.pumpIsComplement) sub += ' Luft-luft värmer bara där luften når, så vi räknar på ' + Math.round(cur.servedShare * 100) + ' % av huset.';
    $('#heroSub').textContent = sub;

    // stat trio
    $('#statCurrent').textContent = krStr(r.currentAnnual, 500) + '/år';
    $('#statPump').textContent = krStr(r.pumpAnnual, 500) + '/år';
    if (r.paybackLow == null || noSaving) {
      $('#statPayback').textContent = '—';
    } else {
      var pa = roundTo(r.paybackLow, 0.5), pb = roundTo(r.paybackHigh, 0.5);
      $('#statPayback').textContent = (pa === pb ? yrStr(pa) : yrStr(pa) + '–' + yrStr(pb)) + ' år';
    }

    // mobile verdict text (carries the insight where the chart is smaller)
    var peak = peakMonth(r.currentCost);
    $('#verdict').textContent = noSaving
      ? 'Din nuvarande uppvärmning är redan effektiv. Då gör en värmepump liten skillnad på räkningen.'
      : ucfirst(monthLong(peak)) + ' är dyrast i dag. Det är då en värmepump sänker din räkning mest.';

    // chart
    drawChart(r);

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
    r.comparison.forEach(function (c) {
      var row = document.createElement('div'); row.className = 'cbar';
      var isPump = !c.isCurrent;
      var chosen = c.isChosen;
      var label = document.createElement('span'); label.className = 'cl' + (chosen ? ' on' : ''); label.textContent = c.label;
      var track = document.createElement('span'); track.className = 'ctrack';
      var fill = document.createElement('span'); fill.className = 'cfill';
      fill.style.background = c.isCurrent ? 'var(--slate)' : (chosen ? 'var(--teal)' : 'rgba(0,169,145,.45)');
      track.appendChild(fill);
      if (c.id === 'luftluft') { var t1 = document.createElement('span'); t1.className = 'ctag'; t1.textContent = 'komplement'; track.appendChild(t1); }
      else if (chosen) { var t2 = document.createElement('span'); t2.className = 'ctag'; t2.textContent = 'vald'; t2.style.color = '#fff'; track.appendChild(t2); }
      var val = document.createElement('span'); val.className = 'cval'; val.textContent = nf(roundTo(c.annual, 500));
      row.appendChild(label); row.appendChild(track); row.appendChild(val);
      if (isPump) {
        row.style.cursor = 'pointer'; row.setAttribute('role', 'button'); row.tabIndex = 0;
        row.setAttribute('aria-label', 'Välj ' + c.label);
        var pick = function () { state.pump = c.id; recompute(); };
        row.addEventListener('click', pick);
        row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      }
      box.appendChild(row);
      // animate fill via transform (best-practice; labels sit outside the bar)
      var frac = maxA > 0 ? c.annual / maxA : 0;
      requestAnimationFrame(function () { fill.style.transform = 'scaleX(' + frac.toFixed(4) + ')'; });
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
      var hint = document.createElement('div'); hint.className = 'upside-soft'; hint.style.fontSize = '11px'; hint.style.marginTop = '6px';
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
  var CHART = { x0: 30, x1: 356, yTop: 22, yBase: 140, lblY: 158, vbW: 372, vbH: 168 };

  function drawChart(r) {
    var svg = $('#chart'); if (!svg) return;
    var mobile = window.matchMedia('(max-width:768px)').matches;
    var c = Object.assign({}, CHART);
    if (mobile) { c.yBase = 158; c.lblY = 176; c.vbH = 190; }
    svg.setAttribute('viewBox', '0 0 ' + c.vbW + ' ' + c.vbH);

    var cur = r.currentCost, pump = r.pumpCost, loB = r.pumpCostLow, hiB = r.pumpCostHigh;
    var maxV = 0;
    for (var i = 0; i < 12; i++) { maxV = Math.max(maxV, cur[i], hiB[i]); }
    if (maxV <= 0) maxV = 1;

    function X(m) { return c.x0 + m * (c.x1 - c.x0) / 11; }
    function Y(v) { return c.yBase - (v / maxV) * (c.yBase - c.yTop); }

    function line(arr) { var p = ''; for (var m = 0; m < 12; m++) p += (m ? ' L' : 'M') + X(m).toFixed(1) + ',' + Y(arr[m]).toFixed(1); return p; }
    function ribbon() {
      var p = '';
      for (var m = 0; m < 12; m++) p += (m ? ' L' : 'M') + X(m).toFixed(1) + ',' + Y(hiB[m]).toFixed(1);
      for (var n = 11; n >= 0; n--) p += ' L' + X(n).toFixed(1) + ',' + Y(loB[n]).toFixed(1);
      return p + ' Z';
    }
    function areaUnder(arr) {
      var p = 'M' + X(0).toFixed(1) + ',' + c.yBase;
      for (var m = 0; m < 12; m++) p += ' L' + X(m).toFixed(1) + ',' + Y(arr[m]).toFixed(1);
      return p + ' L' + X(11).toFixed(1) + ',' + c.yBase + ' Z';
    }

    var pk = peakMonth(cur);
    var title = '<title id="chartTitle">Månadskurva för kostnad</title>' +
      '<desc id="chartDesc">Nuvarande uppvärmning toppar i ' + monthLong(pk) +
      '. Värmepumpen ligger lägre hela året, med ett osäkerhetsband som vidgas under vintern.</desc>';

    var g = '';
    g += '<path d="' + areaUnder(cur) + '" fill="rgba(139,149,189,.12)"/>';
    g += '<path d="' + ribbon() + '" fill="rgba(0,169,145,.17)"/>';
    g += '<line x1="' + X(pk).toFixed(1) + '" y1="' + (c.yTop - 6) + '" x2="' + X(pk).toFixed(1) + '" y2="' + c.yBase + '" stroke="rgba(255,255,255,.22)" stroke-width="1" stroke-dasharray="3 3"/>';
    g += '<path d="' + line(cur) + '" fill="none" stroke="#8b95bd" stroke-width="2" stroke-linejoin="round" class="ln-cur"/>';
    g += '<path d="' + line(pump) + '" fill="none" stroke="#00a991" stroke-width="2.6" stroke-linejoin="round" class="ln-pump"/>';
    g += '<circle cx="' + X(pk).toFixed(1) + '" cy="' + Y(cur[pk]).toFixed(1) + '" r="3.6" fill="#8b95bd"/>';
    g += '<circle cx="' + X(pk).toFixed(1) + '" cy="' + Y(pump[pk]).toFixed(1) + '" r="4.4" fill="#00a991" stroke="#55ff9a" stroke-width="2"/>';
    g += '<text x="' + X(pk).toFixed(1) + '" y="' + (c.yTop - 9) + '" text-anchor="middle" font-size="10" fill="#55ff9a" font-family="Outfit">' + D.monthsLong[pk].slice(0, 3) + '-toppen</text>';
    // month labels (margin strip; peak highlighted)
    for (var lm = 0; lm < 12; lm++) {
      g += '<text x="' + X(lm).toFixed(1) + '" y="' + c.lblY + '" text-anchor="middle" font-size="9" fill="' + (lm === pk ? '#cfe9e0' : '#7c86b0') + '" font-family="Outfit">' + D.months[lm] + '</text>';
    }
    // invisible hit targets
    for (var hm = 0; hm < 12; hm++) {
      var hx = X(hm) - (c.x1 - c.x0) / 22;
      g += '<rect x="' + hx.toFixed(1) + '" y="' + c.yTop + '" width="' + ((c.x1 - c.x0) / 11).toFixed(1) + '" height="' + (c.yBase - c.yTop) + '" fill="transparent" data-m="' + hm + '"/>';
    }

    // NOTE: setting .innerHTML on an SVG element drops namespaced children in several
    // engines. Parse the markup in the SVG namespace and import the nodes instead.
    var parsed = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg">' + title + g + '</svg>', 'image/svg+xml');
    if (parsed.querySelector('parsererror')) { return; }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    Array.prototype.slice.call(parsed.documentElement.childNodes).forEach(function (n) {
      svg.appendChild(document.importNode(n, true));
    });

    // entrance animation (path draw via dash) unless reduced motion
    if (!REDUCED) {
      el('.ln-cur,.ln-pump', svg).forEach(function (p) {
        var len = p.getTotalLength ? p.getTotalLength() : 0;
        if (!len) return;
        p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
        p.getBoundingClientRect();
        p.style.transition = 'stroke-dashoffset .3s ease';
        requestAnimationFrame(function () { p.style.strokeDashoffset = 0; });
      });
    }

    wireChartHover(svg, r, X, Y);
  }

  function wireChartHover(svg, r, X, Y) {
    var tip = $('#chartTip'); var device = svg.parentNode;
    function show(m) {
      var dRect = device.getBoundingClientRect();
      var sRect = svg.getBoundingClientRect();
      var sx = sRect.width / parseFloat(svg.viewBox.baseVal.width || 372);
      var sy = sRect.height / parseFloat(svg.viewBox.baseVal.height || 168);
      var left = (sRect.left - dRect.left) + X(m) * sx;
      var top = (sRect.top - dRect.top) + Math.min(Y(r.currentCost[m]), Y(r.pumpCost[m])) * sy;
      tip.innerHTML = '<div class="tip-m">' + ucfirst(monthLong(m)) + '</div>' +
        '<div class="tip-r"><span>Nuvarande</span><span>' + krStr(r.currentCost[m], 50) + '</span></div>' +
        '<div class="tip-r"><span>Värmepump</span><span>' + krStr(r.pumpCost[m], 50) + '</span></div>';
      tip.hidden = false;
      // B2: clamp inside the device box. Centre-clamp horizontally; flip below the point if no room above.
      var w = tip.offsetWidth, h = tip.offsetHeight, dW = device.clientWidth;
      tip.style.left = Math.max(w / 2 + 4, Math.min(dW - w / 2 - 4, left)) + 'px';
      if (top - h - 8 < 0) { tip.style.top = (top + 16) + 'px'; tip.style.transform = 'translate(-50%,0)'; }
      else { tip.style.top = top + 'px'; tip.style.transform = 'translate(-50%,-115%)'; }
    }
    function hide() { tip.hidden = true; }
    el('rect[data-m]', svg).forEach(function (rect) {
      var m = +rect.dataset.m;
      rect.addEventListener('mouseenter', function (e) { show(m, e); });
      rect.addEventListener('mousemove', function (e) { show(m, e); });
      rect.addEventListener('mouseleave', hide);
      rect.style.cursor = 'crosshair';
    });
    svg.addEventListener('touchstart', function (e) {
      var t = e.target; if (t && t.dataset && t.dataset.m != null) { show(+t.dataset.m); }
    }, { passive: true });
    svg.addEventListener('mouseleave', hide);
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
        f.value = v; $('#occOut').textContent = v; recompute();
      });
    });

    // reveals (accordion via hidden attr — no layout animation jank)
    el('.reveal').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.reveal;
        var gear = $('#gear' + key.toUpperCase());
        var open = gear.hasAttribute('hidden');
        if (open) gear.removeAttribute('hidden'); else gear.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (key === 'n2') toggle('#compare', open);
        if (key === 'n3') toggle('#upside', open);
      });
    });

    // lead form
    $('#ctaBtn').addEventListener('click', openLead);
    $('#leadClose').addEventListener('click', function () { $('#leadwrap').setAttribute('hidden', ''); });
    $('#leadForm').addEventListener('submit', submitLead);
  }

  function toggle(sel, show) { var n = $(sel); if (!n) return; if (show) n.removeAttribute('hidden'); else n.setAttribute('hidden', ''); }

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

  /* ---------- resize: re-tune the chart (re-laid-out, not scaled) ---------- */
  var rT;
  window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(function () { if (lastResult) drawChart(lastResult); }, 160); });

  /* ---------- boot ---------- */
  function boot() { buildInputs(); wireControls(); recompute(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

})();
