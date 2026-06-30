/* =============================================================================
 * app.js — Ampy energikalkylatorn — V3 VERSION B · "THE INSTRUMENT / LEDGER"
 * Renderer + interactions + the SVG cost-curve. Evolves the root V2 renderer:
 *   - the multi-system composer (primary <select> + complement chips + 3-stop share)
 *   - the kWh/kr override unit-switch
 *   - the stacked-split current band (WOW-1) + tip mini-readout
 *   - the band-collapse-on-override (WOW-3)
 *   - the blended "Nuvarande (blandat)" comparison row that expands to the breakdown
 *   - the already-efficient hero branch (.hero--small)
 *   - roving-tabindex arrow-key nav on every segmented (ARIA APG)
 *   - lead form: min = namn+telefon+postnr+GDPR; e-post optional; per-field errors
 * Reads window.AMPY_DATA, calls window.AmpyEngine.calculate, writes into the slots.
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

  function nf(n) { return Math.round(n).toLocaleString('sv-SE').replace(/ /g, ' '); }
  function roundTo(n, step) { return Math.round(n / step) * step; }
  function krStr(n, step) { return nf(roundTo(n, step)) + ' kr'; }
  function yrStr(y) { return (Math.round(y * 10) / 10).toString().replace('.', ','); }

  /* ---------- labels for the data-driven inputs (data.js holds the model, not copy) ---------- */
  var ERA_LABELS  = { pre1940: 'Före 1940', midcentury: '1970–1990', modern2010: '2010-tal', new2021: '2021+' };
  var DIST_LABELS = { golvvarme: 'Golvvärme', radiator: 'Radiator', hogtemp: 'Högtemp' };
  var DSO_LABELS  = { vetej: 'Vet ej', ellevio: 'Ellevio', vattenfall: 'Vattenfall', eon: 'E.ON' };
  var TIER_LABEL  = { durable: 'räknar vi med', effektavgift: 'kräver effektavgift', atrisk: 'kräver avtal, osäker' };
  // the 3 share stops from data.js, paired with copy
  var SHARE_STOPS = (D.multi && D.multi.shareStops) ? D.multi.shareStops : [0.20, 0.40, 0.60];
  var SHARE_LABELS = ['Lite ~20 %', 'En del ~40 %', 'Mycket ~60 %'];
  var DEFAULT_STOP = 1; // "En del" — maps to multi.defaultCoverage 0.40

  /* warm (kamin) tones get the amber-scoped fan fill; everything else is a cool slate */
  function fanFill(id, isPrimary) {
    if (id === 'kamin') return 'var(--fan-kamin)';
    if (isPrimary) return 'var(--fan-primary)';
    return 'rgba(111,123,176,.20)';   // cooler slate for electric complements
  }
  function fanStroke(id, isPrimary) {
    if (id === 'kamin') return 'rgba(240,180,41,.55)';
    if (isPrimary) return '#8b95bd';
    return '#6f7bb0';
  }

  /* ---------- selection state for the custom controls ---------- */
  var state = {
    priceArea: D.defaultPriceArea,
    era: D.defaultEra,
    distribution: D.defaultDistribution,
    pump: D.defaultPump,
    overrideUnit: 'kwh',          // 'kwh' | 'cost'
    complements: {},              // { systemId: { on:bool, stop:int (index), assumed:bool } }
    fanOpen: false,               // legend "nu" swatch / chip toggles the stacked-fan
    breakdownOpen: false          // the comparison blended row expanded
  };

  /* ---------- populate the dynamic inputs once ---------- */
  function buildInputs() {
    // current-system select (primary): only systems that are NOT exclusively complement-class
    var sysSel = $('#systemField');
    Object.keys(D.currentSystems).forEach(function (id) {
      var rec = D.currentSystems[id];
      if (rec.isComplementClass) return;   // (befintlig) pump-as-complement + kamin live in the chips, not the primary select
      var o = document.createElement('option');
      o.value = id; o.textContent = rec.label;
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

    // override unit switch (kWh / kr) — segmented, no value change, just unit
    buildSeg('#overrideUnitSeg', [
      { v: 'kwh', label: 'kWh' },
      { v: 'kr',  label: 'kr/år' }
    ], 'overrideUnit', onUnitChange);

    // DSO select
    var dsoSel = $('#dsoField');
    Object.keys(D.dsoEffektavgift).forEach(function (id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = DSO_LABELS[id] || id;
      dsoSel.appendChild(o);
    });

    buildComplementChips();
  }

  /* ---------- complement chip multi-select ---------- */
  function buildComplementChips() {
    var box = $('#complementChips'); if (!box) return;
    var primary = $('#systemField').value;
    box.innerHTML = '';
    Object.keys(D.currentSystems).forEach(function (id) {
      var rec = D.currentSystems[id];
      if (!rec.canComplement) return;          // only complement-capable systems
      if (id === primary) return;              // a complement can't equal the primary
      if (rec.isPrice) return;                 // fjärrvärme is a price comparison, never a complement
      var on = !!(state.complements[id] && state.complements[id].on);
      var chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'chip'; chip.dataset.sys = id;
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      chip.innerHTML = '<span class="chip-check" aria-hidden="true">' +
        '<svg width="12" height="9" viewBox="0 0 12 9"><path d="M1 4.5L4.3 8 11 1" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</span><span>' + rec.label + '</span>';
      chip.addEventListener('click', function () { toggleComplement(id); });
      box.appendChild(chip);
    });
  }

  function toggleComplement(id) {
    var c = state.complements[id] || { on: false, stop: DEFAULT_STOP, assumed: true };
    c.on = !c.on;
    if (c.on && c.stop == null) { c.stop = DEFAULT_STOP; c.assumed = true; }
    state.complements[id] = c;
    var chip = $('.chip[data-sys="' + id + '"]');
    if (chip) chip.setAttribute('aria-pressed', c.on ? 'true' : 'false');
    renderShareRows();
    forceChartDraw = true;
    recompute();
  }

  /* ---------- per-complement share rows (3-stop segmented) ---------- */
  function renderShareRows() {
    var box = $('#complementShares'); if (!box) return;
    var active = Object.keys(state.complements).filter(function (id) { return state.complements[id].on; });
    // remove rows for chips no longer on
    el('.share-row', box).forEach(function (row) {
      if (active.indexOf(row.dataset.sys) === -1) row.remove();
    });
    active.forEach(function (id) {
      if ($('.share-row[data-sys="' + id + '"]', box)) { updateShareRowTag(id); return; }
      var rec = D.currentSystems[id];
      var c = state.complements[id];
      var row = document.createElement('div');
      row.className = 'share-row'; row.dataset.sys = id;
      var inner = document.createElement('div'); inner.className = 'share-inner';
      var name = document.createElement('div'); name.className = 'share-name';
      name.innerHTML = '<span>' + rec.label + '</span><span class="antag"' + (c.assumed ? '' : ' hidden') + '>(antagande)</span>';
      var seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'radiogroup');
      seg.setAttribute('aria-label', 'Hur stor del värmer ' + rec.label.toLowerCase());
      inner.appendChild(name); inner.appendChild(seg);
      row.appendChild(inner); box.appendChild(row);
      // build the 3-stop segmented inside this row
      buildShareSeg(seg, id);
      // slide in
      requestAnimationFrame(function () { row.classList.add('in'); setTimeout(replaceAllPills, REDUCED ? 0 : 60); });
    });
  }

  function updateShareRowTag(id) {
    var row = $('.share-row[data-sys="' + id + '"]'); if (!row) return;
    var antag = $('.antag', row); if (antag) antag.hidden = !state.complements[id].assumed;
  }

  function buildShareSeg(seg, id) {
    var c = state.complements[id];
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
    var c = state.complements[id]; c.stop = idx; c.assumed = false;  // user touched it
    el('button', seg).forEach(function (x) {
      var on = +x.dataset.stop === idx;
      x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
    });
    movePill(seg, $('button.on', seg));
    updateShareRowTag(id);
    forceChartDraw = true;
    recompute();
  }

  /* ---------- override unit switch ---------- */
  function onUnitChange(v) {
    state.overrideUnit = v;
    var f = $('#annualKwhField');
    f.placeholder = (v === 'kwh') ? 't.ex. 20 000' : 't.ex. 28 000';
    f.max = (v === 'kwh') ? 120000 : 200000;
    // re-evaluate the typed value under the new unit
    forceChartDraw = true;
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
    // place it already-positioned (no slide from 0,0 on first paint)
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
    var primary = $('#systemField').value;
    var complements = [];
    Object.keys(state.complements).forEach(function (id) {
      var c = state.complements[id];
      if (!c.on) return;
      if (id === primary) return;             // guard: a complement can't equal the primary
      // assumed (untouched default) → omit coverage so the engine fills + tags it isAssumed;
      // touched → send the explicit float from the stop.
      var row = { system: id };
      if (!c.assumed) row.coverage = SHARE_STOPS[c.stop];
      complements.push(row);
    });

    // the override: one typed field, interpreted by the unit switch
    var raw = $('#annualKwhField').value;
    var num = raw ? +raw : null;
    var actual = { mode: null, kwh: null, cost: null };
    if (num != null && isFinite(num) && num > 0) {
      if (state.overrideUnit === 'kwh') { actual.mode = 'kwh'; actual.kwh = num; }
      else { actual.mode = 'cost'; actual.cost = num; }
    }

    return {
      current: { primary: primary, complements: complements, actual: actual },
      area: +$('#areaSlider').value,
      priceArea: state.priceArea,
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
    var noSaving = r.noSaving;          // engine gates on the MID saving
    var efficient = r.efficientFlag && !noSaving;  // positive-but-small / primary-is-a-pump

    // eyebrow + the override badge
    $('#eyebrow').textContent = 'Jämfört med ' + (cur.currentIsElectric ? 'din ' : '') + cur.currentDisplayLabel.toLowerCase();
    $('#ownBadge').hidden = !cur.overrideMode;
    $('#legendCurrent').textContent = cur.currentDisplayLabel.toLowerCase();

    // legend "nu" swatch becomes interactive only when multi (it fans the stacked band)
    var sw = $('#legendCurrentSw');
    sw.classList.toggle('is-multi', cur.isMultiSystem);
    if (!cur.isMultiSystem) { state.fanOpen = false; sw.setAttribute('aria-pressed', 'false'); }

    // primary-share chip (read-only remainder)
    var chip = $('#primaryShareChip');
    if (cur.isMultiSystem) {
      chip.hidden = false;
      chip.innerHTML = '<b>' + cur.currentLabel + '</b> bär ~' + Math.round(cur.primaryShare * 100) + ' % av värmen';
    } else { chip.hidden = true; }

    // hero (range, rounded to 1000) — three honest states
    var lo = Math.max(0, roundTo(r.heroLow, 1000));
    var hi = Math.max(0, roundTo(r.heroHigh, 1000));
    var heroEl = $('#heroValue'), wordEl = $('.hero-word'), heroBox = $('.hero');
    heroBox.classList.remove('hero--flat', 'hero--small');
    if (noSaving) {
      heroEl.textContent = 'Liten eller ingen besparing';
      wordEl.style.display = 'none';
      heroBox.classList.add('hero--flat');
    } else {
      wordEl.style.display = '';
      wordEl.textContent = 'kr/år lägre';
      heroEl.textContent = '~ ' + (lo === hi ? nf(hi) : nf(lo) + '–' + nf(hi));
      if (efficient) heroBox.classList.add('hero--small');
    }
    // hero: a 1-frame opacity touch only (Instant-Value rule: never translate, never count up)
    if (!REDUCED) {
      heroEl.classList.add('flash');
      requestAnimationFrame(function () { heroEl.classList.remove('flash'); });
    }

    // hero sub
    var sub;
    if (efficient) {
      sub = 'Din nuvarande uppvärmning är redan effektiv, så besparingen blir liten. ';
      sub += 'Med ' + cur.pumpLabel.toLowerCase() + ', efter ROT-avdraget på arbetet.';
    } else {
      sub = 'Med ' + cur.pumpLabel.toLowerCase() + ', efter ROT-avdraget på arbetet. Vi räknar bara på lägre uppvärmning, inte på solel eller stödtjänster.';
    }
    if (cur.currentIsPrice) sub += ' Fjärrvärme jämför vi på pris, eftersom du köper färdig värme, inte el.';
    if (cur.pumpIsComplement) sub += ' Luft-luft värmer bara där luften når, så vi räknar på ' + Math.round(cur.servedShare * 100) + ' % av huset.';
    if (cur.overrideMode === 'cost') sub += ' Vi har räknat på den årskostnad du skrev in.';
    else if (cur.overrideMode === 'kwh') sub += ' Vi har räknat på den årsförbrukning du skrev in.';
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
    $('#verdict').textContent = (noSaving || efficient)
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

    // honest-CTA branch: soften on no-saving OR already-efficient
    var cta = $('#ctaBtn');
    cta.textContent = (noSaving || efficient) ? 'Få en kostnadsfri bedömning' : 'Få en skräddarsydd offert';

    // keep sticky integrity: drop sticky if the left card outgrows the viewport
    checkStickyIntegrity();
  }

  function peakMonth(arr) { var mi = 0, mv = -1; for (var i = 0; i < 12; i++) if (arr[i] > mv) { mv = arr[i]; mi = i; } return mi; }
  function monthLong(i) { return D.monthsLong[i]; }
  function ucfirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ---------- comparison bars (double as the pump selector) + blended breakdown ---------- */
  function renderCompare(r) {
    var box = $('#compareBars'); box.innerHTML = '';
    var maxA = 0; r.comparison.forEach(function (c) { if (c.annual > maxA) maxA = c.annual; });
    r.comparison.forEach(function (c, i) {
      var row = document.createElement('div'); row.className = 'cbar' + (c.isChosen ? ' is-chosen' : '');
      var isPump = !c.isCurrent;
      var chosen = c.isChosen;

      var label = document.createElement('span'); label.className = 'cl' + (chosen ? ' on' : '');
      // the blended current row gets an expand affordance to the breakdown
      if (c.isCurrent && c.isBlended) {
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'cl-expand';
        btn.setAttribute('aria-expanded', state.breakdownOpen ? 'true' : 'false');
        btn.innerHTML = c.label + ' <i class="ti ti-chevron-right cl-caret" aria-hidden="true"></i>';
        label.appendChild(btn);
      } else {
        label.textContent = c.label;
      }

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

      // the blended breakdown sub-rows, appended right under the current row
      if (c.isCurrent && c.isBlended) {
        var bk = document.createElement('div'); bk.className = 'cbreak' + (state.breakdownOpen ? ' open' : '');
        var bkin = document.createElement('div'); bkin.className = 'cbreak-inner';
        var maxAnnual = 0; r.currentBreakdown.forEach(function (s) { if (s.annual > maxAnnual) maxAnnual = s.annual; });
        r.currentBreakdown.forEach(function (s, si) {
          var sr = document.createElement('div'); sr.className = 'cbsub';
          var sl = document.createElement('span'); sl.className = 'cbl';
          sl.innerHTML = s.label + ' · ' + Math.round(s.share * 100) + ' %' + (s.isAssumed ? ' <span class="antag">(antagande)</span>' : '');
          var st = document.createElement('span'); st.className = 'cbt';
          var sf = document.createElement('span'); sf.className = 'cbf' + (s.id === 'kamin' ? ' warm' : '');
          st.appendChild(sf);
          var svv = document.createElement('span'); svv.className = 'cbv'; svv.textContent = nf(roundTo(s.annual, 500));
          sr.appendChild(sl); sr.appendChild(st); sr.appendChild(svv);
          bkin.appendChild(sr);
          var frac = maxAnnual > 0 ? s.annual / maxAnnual : 0;
          var d2 = REDUCED ? 0 : Math.min(si * 40, 160);
          setTimeout(function () { requestAnimationFrame(function () { sf.style.transform = 'scaleX(' + frac.toFixed(4) + ')'; }); }, d2);
        });
        bk.appendChild(bkin); box.appendChild(bk);
        // wire the expand toggle
        var exp = $('.cl-expand', row);
        if (exp) exp.addEventListener('click', function () {
          state.breakdownOpen = !state.breakdownOpen;
          exp.setAttribute('aria-expanded', state.breakdownOpen ? 'true' : 'false');
          bk.classList.toggle('open', state.breakdownOpen);
        });
      }

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
    var blendNote = c.isMultiSystem
      ? '<h4>Blandad uppvärmning</h4>Du har mer än en värmekälla. Vi delar årets värme mellan dem efter andelarna du satt och räknar din nuvarande kostnad som summan. ' +
        (c.complementClamped ? 'Komplementen kan tillsammans täcka högst ' + Math.round((1 - c.primaryFloor) * 100) + ' % av värmen. ' : '') +
        'Besparingen är den blandade kostnaden minus värmepumpen.'
      : '';
    var ovrNote = c.overrideMode
      ? '<h4>Din egen siffra</h4>Du har skrivit in din ' + (c.overrideMode === 'cost' ? 'årskostnad' : 'årsförbrukning') + ', så vi räknar på den i stället för schablonen. Då blir bandet smalare, eftersom mindre är gissat.'
      : '';
    return '' +
      '<h4>Värmebehov</h4>Vi uppskattar husets energi från byggår, boyta, boende och innetemperatur, ' +
      'normalårskorrigerat. Skriv in din årsförbrukning så räknar vi på din verkliga siffra.' +
      blendNote +
      '<h4>Verkningsgrad</h4>Vi räknar på <b>verklig årsvärmefaktor (fält-SPF)</b>, inte energimärkningens SCOP. ' +
      'Luftpumpens SPF sjunker i kyla, bergvärme ligger stabilt. Vald pump: <code>' + c.pumpLabel + '</code>, ' +
      'fält-SPF ~' + c.spfRange[0].toString().replace('.', ',') + '–' + c.spfRange[1].toString().replace('.', ',') + '.' +
      '<h4>Månadskurvan</h4>Årsbehovet fördelas över årets månader efter hur kallt det normalt är ' +
      '(graddagar: ju kallare månad, desto större andel av värmen). Vi använder SMHI:s normalår. Därför toppar räkningen på vintern.' +
      '<h4>Avdrag</h4>Värmepump ger <b>ROT 30 % på arbetskostnaden</b>, inte grön teknik. ' +
      'Brutto ' + krStr(c.gross, 500) + ', ROT ' + krStr(c.rot, 100) + ', netto <b>' + krStr(c.net, 500) + '</b>. ' +
      'Förutsatt outnyttjat ROT-utrymme.' +
      ovrNote +
      '<h4>Osäkerhet</h4>Vi visar ett spann, inte en exakt siffra. Bandet är vidast på vintern där fält-SPF är minst säker.' +
      (c.footprintFlag ? '<h4>Obs</h4>Bergvärme erbjuds i dag <b>' + c.footprintFlag + '</b> och bekräftas i offerten.' : '') +
      '<h4>Solel och batteri</h4>Eventuell solel- och batteriintäkt visas som separata rader, aldrig inräknat i besparingen ovan. ' +
      'Sommarsol kan inte täcka vinterns värme, ett batteri flyttar el över dygnet, inte över året.';
  }

  /* ========================================================================
   * THE SIGNATURE CHART — monthly cost, current vs pump, ± ribbon, winter peak
   * WOW-1: stacked-split current band fans on hover when complements exist.
   * ====================================================================== */
  var CHART = { x0: 34, x1: 352, yTop: 30, yBase: 166, lblY: 184, vbW: 372, vbH: 196, padR: 20 };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var chartDrawn = false;   // gate the entrance choreography to explicit (non-drag) draws
  var lastChartCtx = null;  // {X,Y,c,r} kept for the fan toggle without a redraw

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
    // a stacked area band BETWEEN two cumulative top edges (lower..upper), for the fan
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
    var title = '<title id="chartTitle">Månadskurva för kostnad</title>' +
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

    // ---- fills (wrapped for the entrance fade) ----
    var entranceFade = !REDUCED && (force || !chartDrawn);
    g += '<g class="ch-fills"' + (entranceFade ? ' opacity="0"' : '') + '>';

    // WOW-1: the stacked-split current band. Build BOTH the merged single area and the
    // split parts; CSS opacity cross-fades between them (state.fanOpen).
    var isMulti = r.ctx.isMultiSystem && r.currentBreakdown.length > 1;
    var showSplit = isMulti && state.fanOpen;
    // merged single area (the honest blended total — always the math)
    g += '<g class="fan-merged" opacity="' + (showSplit ? '0' : '1') + '">';
    g += '<path d="' + smoothArea(cur) + '" fill="url(#gCur)"/>';
    g += '</g>';
    // split parts (only meaningful when multi): cumulative stacked bands bottom→top
    if (isMulti) {
      g += '<g class="fan-split" opacity="' + (showSplit ? '1' : '0') + '">';
      var cumLower = new Array(12); for (var z = 0; z < 12; z++) cumLower[z] = 0;
      // order: primary first (bottom), then complements
      var ordered = r.currentBreakdown.slice().sort(function (a, b) { return (a.isPrimary === b.isPrimary) ? 0 : (a.isPrimary ? -1 : 1); });
      ordered.forEach(function (s) {
        var cumUpper = new Array(12);
        for (var mm = 0; mm < 12; mm++) cumUpper[mm] = cumLower[mm] + s.monthly[mm];
        g += '<path d="' + stackedBand(cumUpper, cumLower) + '" fill="' + fanFill(s.id, s.isPrimary) + '" stroke="' + fanStroke(s.id, s.isPrimary) + '" stroke-width="1" stroke-opacity=".5"/>';
        // a tiny in-plot label at the right edge (no numbers in the plot)
        var lblYpos = Y((cumUpper[11] + cumLower[11]) / 2);
        g += '<text x="' + (c.x1 + 2).toFixed(1) + '" y="' + (lblYpos + 3).toFixed(1) + '" text-anchor="end" font-size="8.5" fill="' + fanStroke(s.id, s.isPrimary) + '" font-family="Outfit" opacity=".9">' + s.label.split(' ')[0] + '</text>';
        for (var m2 = 0; m2 < 12; m2++) cumLower[m2] = cumUpper[m2];
      });
      g += '</g>';
    }

    g += '<path d="' + smoothRibbon() + '" fill="url(#gBand)"/>';
    g += '<path d="' + smoothArea(pump) + '" fill="url(#gPump)"/>';
    g += '</g>';

    // peak guide + saving brace (shows the WIN as a quantity)
    g += '<line x1="' + X(pk).toFixed(1) + '" y1="' + c.yTop + '" x2="' + X(pk).toFixed(1) + '" y2="' + Y(cur[pk]).toFixed(1) + '" stroke="rgba(255,255,255,.18)" stroke-width="1" stroke-dasharray="2 3"/>';
    g += '<line x1="' + X(pk).toFixed(1) + '" y1="' + Y(cur[pk]).toFixed(1) + '" x2="' + X(pk).toFixed(1) + '" y2="' + Y(pump[pk]).toFixed(1) + '" stroke="#55ff9a" stroke-width="2" stroke-opacity=".5" stroke-linecap="round"/>';

    // lines — colour-blind-safe: colour + dash + weight/glow (3 redundant channels)
    g += '<path d="' + smoothPath(ptsOf(cur)) + '" fill="none" stroke="#8b95bd" stroke-width="1.6" stroke-dasharray="1 5" stroke-linecap="round" stroke-linejoin="round" class="ln-cur"/>';
    g += '<path d="' + smoothPath(ptsOf(pump)) + '" fill="none" stroke="#00c4a7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowPump)" class="ln-pump"/>';

    // peak dots
    g += '<circle cx="' + X(pk).toFixed(1) + '" cy="' + Y(cur[pk]).toFixed(1) + '" r="3.4" fill="none" stroke="#8b95bd" stroke-width="1.6"/>';
    g += '<circle class="peak-dot" cx="' + X(pk).toFixed(1) + '" cy="' + Y(pump[pk]).toFixed(1) + '" r="4.4" fill="#00c4a7" stroke="#55ff9a" stroke-width="2"/>';

    // peak pill in the TOP MARGIN
    var anchor = 'middle', px = X(pk);
    if (px < c.x0 + 24) anchor = 'start'; else if (px > c.x1 - 24) anchor = 'end';
    g += '<text x="' + px.toFixed(1) + '" y="' + (c.yTop - 9) + '" text-anchor="' + anchor + '" font-size="10" fill="#55ff9a" font-family="Outfit" font-weight="500">' + D.monthsLong[pk].slice(0, 3) + '-toppen</text>';

    // month strip
    for (var lm = 0; lm < 12; lm++) {
      if (mobile && (lm % 2) && lm !== pk) continue;
      g += '<text x="' + X(lm).toFixed(1) + '" y="' + c.lblY + '" text-anchor="middle" font-size="9" fill="' + (lm === pk ? '#cfe9e0' : '#7c86b0') + '" font-family="Outfit">' + D.months[lm] + '</text>';
    }

    // invisible hit targets
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

    // the scrubber indicator
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

    // entrance choreography
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

  /* toggle the stacked-fan without a full redraw (its own ≤t-mid cross-fade) */
  function toggleFan(open) {
    if (!lastChartCtx || !lastChartCtx.isMulti) return;
    state.fanOpen = open;
    var svg = $('#chart'); if (!svg) return;
    var merged = svg.querySelector('.fan-merged'), split = svg.querySelector('.fan-split');
    if (merged) merged.setAttribute('opacity', open ? '0' : '1');
    if (split) split.setAttribute('opacity', open ? '1' : '0');
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
      // WOW-1 mini-readout: only when complements exist AND the fan is shown
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
   * INTERACTIONS — sliders, stepper, reveals, fan, lead form
   * ====================================================================== */
  function wireControls() {
    el('[data-input]').forEach(function (n) {
      var ev = (n.type === 'range') ? 'input' : 'change';
      n.addEventListener(ev, function () {
        // primary change rebuilds the chips (a selected chip may now equal the primary)
        if (n.id === 'systemField') buildComplementChips();
        recompute();
      });
    });
    var area = $('#areaSlider'); area.addEventListener('input', function () { $('#areaOut').textContent = area.value + ' m²'; });
    var temp = $('#tempSlider'); temp.addEventListener('input', function () { $('#tempOut').textContent = temp.value + ' °C'; });

    // override field: re-evaluate on input; toggle the badge handled in render()
    $('#annualKwhField').addEventListener('input', recompute);

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

    // reveals
    ['#gearN2', '#gearN3', '#compare', '#upside', '#complementWrap'].forEach(function (sel) { var n = $(sel); if (n) n.removeAttribute('hidden'); });
    el('.reveal').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.reveal;
        var gear = $('#gear' + key.toUpperCase());
        var willOpen = !gear.classList.contains('open');
        toggleEl(gear, willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (key === 'n2') toggleEl($('#compare'), willOpen);
        if (key === 'n3') toggleEl($('#upside'), willOpen);
        if (willOpen) setTimeout(function () { replaceAllPills(); checkStickyIntegrity(); }, REDUCED ? 0 : 240);
      });
    });

    // complement adder reveal
    var addBtn = $('#addSrcBtn');
    if (addBtn) addBtn.addEventListener('click', function () {
      var wrap = $('#complementWrap');
      var willOpen = !wrap.classList.contains('open');
      toggleEl(wrap, willOpen);
      addBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if (willOpen) setTimeout(function () { replaceAllPills(); checkStickyIntegrity(); }, REDUCED ? 0 : 240);
    });

    // the legend "nu" swatch fans the stacked-split band (multi only)
    var sw = $('#legendCurrentSw');
    if (sw) {
      var doFan = function () {
        if (!sw.classList.contains('is-multi')) return;
        var open = !state.fanOpen;
        sw.setAttribute('aria-pressed', open ? 'true' : 'false');
        toggleFan(open);
      };
      sw.addEventListener('click', doFan);
    }

    // lead form
    $('#ctaBtn').addEventListener('click', openLead);
    $('#leadClose').addEventListener('click', function () { $('#leadwrap').setAttribute('hidden', ''); });
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
    if (!ok) return setErr('#leadPhone', '#errPhone', 'Skriv ett telefonnummer vi kan nå dig på.');
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
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return setErr('#leadEmail', '#errEmail', 'Kontrollera e-postadressen, eller lämna fältet tomt.');
    return setErr('#leadEmail', '#errEmail', null);
  }

  function openLead() {
    var w = $('#leadwrap'); w.removeAttribute('hidden');
    $('#leadForm').hidden = false; $('#leadSuccess').hidden = true;
    setTimeout(function () { try { $('#leadName').focus(); } catch (e) {} }, 30);
    try { w.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' }); } catch (e) {}
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
    var r = lastResult || {};
    var band = r.heroSaving ? (roundTo(r.heroLow, 1000) + '-' + roundTo(r.heroHigh, 1000)) : 'na';
    try {
      console.log('[ampy lead]', {
        zip: $('#leadZip').value.trim(),
        primary: $('#systemField').value,
        complements: Object.keys(state.complements).filter(function (k) { return state.complements[k].on; }),
        override: (r.ctx && r.ctx.overrideMode) || null,
        pump: state.pump, area: $('#areaSlider').value, priceArea: state.priceArea, savingBand: band
      });
    } catch (e2) {}
    $('#leadForm').hidden = true; $('#leadSuccess').hidden = false;
  }

  /* ---------- resize: re-place the sliding pills + re-tune the chart ---------- */
  var rT;
  window.addEventListener('resize', function () {
    replaceAllPills();
    checkStickyIntegrity();
    clearTimeout(rT); rT = setTimeout(function () { if (lastResult) drawChart(lastResult, false); }, 160);
  });

  /* ---------- boot ---------- */
  function boot() {
    buildInputs(); wireControls(); recompute();
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
