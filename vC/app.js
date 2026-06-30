/* =============================================================================
 * app.js — Ampy energikalkylatorn — vC "SAMTALET"
 * Single-column scroll-narrative renderer. Reads window.AMPY_DATA, calls
 * window.AmpyEngine.calculate (the SHARED multi-system engine), writes into the
 * slot skeleton in index.html. Rounding + Swedish formatting happen HERE.
 *
 * Signature device = the before→after SEGMENTED cost bar (drawn into #barSvg).
 * Secondary reveal = the 12-month curve, ported verbatim from root drawChart.
 * The composer builds inputs.current = {primary, complements[], actual}.
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
  function pct(x) { return Math.round(x * 100) + ' %'; }
  function ucfirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ---------- labels for the data-driven inputs ---------- */
  var ERA_LABELS  = { pre1940: 'Före 1940', midcentury: '1970–1990', modern2010: '2010-tal', new2021: '2021+' };
  var DIST_LABELS = { golvvarme: 'Golvvärme', radiator: 'Radiator', hogtemp: 'Högtemp' };
  var DSO_LABELS  = { vetej: 'Vet ej', ellevio: 'Ellevio', vattenfall: 'Vattenfall', eon: 'E.ON' };
  var TIER_LABEL  = { durable: 'räknar vi med', effektavgift: 'kräver effektavgift', atrisk: 'kräver avtal, osäker' };
  var SHARE_LABELS = ['Lite', 'En del', 'Mycket'];  // maps to D.multi.shareStops [0.20,0.40,0.60]

  /* ---------- selection state ---------- */
  var state = {
    primary: D.defaultCurrentSystem,
    complements: {},            // { sysId: {stop:0|1|2, touched:bool} } — touched=false → engine fills default + tags "(antagande)"
    priceArea: D.defaultPriceArea,
    era: D.defaultEra,
    distribution: D.defaultDistribution,
    pump: D.defaultPump,
    overrideMode: 'kwh',        // current unit toggle
    overrideValue: null         // numeric, null = estimate
  };

  /* ========================================================================
   * BUILD the dynamic inputs
   * ====================================================================== */
  var segBoxes = [];   // registry for resize re-place of every sliding pill

  function buildInputs() {
    // primary system select (sentence)
    var sysSel = $('#systemFieldC');
    Object.keys(D.currentSystems).forEach(function (id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = D.currentSystems[id].label;
      if (id === D.defaultCurrentSystem) o.selected = true;
      sysSel.appendChild(o);
    });
    sysSel.addEventListener('change', function () {
      state.primary = sysSel.value;
      // a system chosen as primary can't also be a complement
      if (state.complements[state.primary] != null) delete state.complements[state.primary];
      rebuildChips();
      rebuildComplementRows();
      forceBarDraw = true; forceChartDraw = true;
      recompute();
    });

    // override unit segmented (kWh · kr)
    buildSeg('#overrideUnitSeg', [
      { v: 'kwh', label: 'kWh' }, { v: 'cost', label: 'kr' }
    ], 'overrideMode', function () {
      $('#overrideSuffix').textContent = state.overrideMode === 'kwh' ? 'kWh/år' : 'kr/år';
      applyOverride();
    });

    // elområde segmented
    buildSeg('#priceAreaSegC', Object.keys(D.priceAreas).map(function (id) {
      return { v: id, label: D.priceAreas[id].label };
    }), 'priceArea', function () { forceBarDraw = true; forceChartDraw = true; recompute(); });

    // byggår segmented
    buildSeg('#eraSegC', Object.keys(D.intensityByEra).map(function (id) {
      return { v: id, label: ERA_LABELS[id] || id };
    }), 'era', function () { forceBarDraw = true; forceChartDraw = true; recompute(); });

    // distribution segmented
    buildSeg('#distSegC', Object.keys(D.framledning).map(function (id) {
      return { v: id, label: DIST_LABELS[id] || id };
    }), 'distribution', function () { forceBarDraw = true; forceChartDraw = true; recompute(); });

    // DSO select
    var dsoSel = $('#dsoFieldC');
    Object.keys(D.dsoEffektavgift).forEach(function (id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = DSO_LABELS[id] || id;
      dsoSel.appendChild(o);
    });

    rebuildChips();
  }

  /* ---------- complement chips (systems with canComplement, ≠ primary) ---------- */
  function complementCandidates() {
    return Object.keys(D.currentSystems).filter(function (id) {
      var rec = D.currentSystems[id];
      return rec.canComplement && id !== state.primary;
    });
  }

  function rebuildChips() {
    var box = $('#complementChips'); if (!box) return;
    box.innerHTML = '';
    complementCandidates().forEach(function (id) {
      var rec = D.currentSystems[id];
      var on = state.complements[id] != null;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.sys = id;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.innerHTML = '<i class="ti ' + (on ? 'ti-check' : 'ti-plus') + '" aria-hidden="true"></i>' + rec.label;
      b.addEventListener('click', function () { toggleComplement(id); });
      box.appendChild(b);
    });
  }

  function toggleComplement(id) {
    if (state.complements[id] != null) {
      delete state.complements[id];
    } else {
      // stop 1 = "En del" (0.40) visually preselected; touched=false so the engine
      // fills the default coverage AND tags the row "(antagande)" until the user picks.
      state.complements[id] = { stop: 1, touched: false };
    }
    rebuildChips();
    rebuildComplementRows();
    forceBarDraw = true; forceChartDraw = true;
    recompute();
  }

  /* ---------- complement rows (system + 3-stop share segmented + remove) ---------- */
  function rebuildComplementRows() {
    var box = $('#complementRows'); if (!box) return;
    box.innerHTML = '';
    Object.keys(state.complements).forEach(function (id) {
      var rec = D.currentSystems[id];
      var row = document.createElement('div'); row.className = 'crow';
      // name
      var name = document.createElement('div'); name.className = 'crow-name';
      name.innerHTML = rec.label + '<span class="crow-sub">hur mycket av värmen?</span>';
      // share segmented
      var shareWrap = document.createElement('div'); shareWrap.className = 'crow-share';
      var shareSeg = document.createElement('div');
      shareSeg.className = 'seg seg-share'; shareSeg.setAttribute('role', 'radiogroup');
      shareSeg.setAttribute('aria-label', 'Hur mycket ' + rec.label + ' bidrar');
      shareSeg.id = 'shareSeg-' + id;
      shareWrap.appendChild(shareSeg);
      // remove
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'crow-remove';
      rm.setAttribute('aria-label', 'Ta bort ' + rec.label);
      rm.innerHTML = '<i class="ti ti-x" aria-hidden="true"></i>';
      rm.addEventListener('click', function () { toggleComplement(id); });

      row.appendChild(name); row.appendChild(shareWrap); row.appendChild(rm);
      box.appendChild(row);

      // build the share segmented with the current stop selected
      var stop = state.complements[id].stop;
      buildSegInline(shareSeg, D.multi.shareStops.map(function (s, i) {
        return { v: String(i), label: SHARE_LABELS[i] + ' ~' + pct(s) };
      }), String(stop), function (val) {
        state.complements[id] = { stop: +val, touched: true };  // user picked → explicit coverage, no longer "(antagande)"
        forceBarDraw = true; forceChartDraw = true;
        recompute();
      });
    });
  }

  /* ---------- segmented control builder (state-key driven) ---------- */
  function buildSeg(sel, items, key, onChange) {
    var box = $(sel); if (!box) return;
    buildSegInline(box, items, state[key], function (val) {
      state[key] = val;
      if (onChange) onChange(val);
    });
  }

  /* core seg builder — roving tabindex + arrow-key nav (ARIA APG) */
  function buildSegInline(box, items, activeVal, onSet) {
    box.innerHTML = '';
    var buttons = [];
    var activeBtn = null;
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = it.label; b.dataset.value = it.v;
      b.setAttribute('role', 'radio');
      var isOn = String(it.v) === String(activeVal);
      if (isOn) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); b.tabIndex = 0; activeBtn = b; }
      else { b.setAttribute('aria-checked', 'false'); b.tabIndex = -1; }
      b.addEventListener('click', function () { selectBtn(b); });
      b.addEventListener('keydown', function (e) {
        var idx = buttons.indexOf(b), n = buttons.length, ni = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ni = (idx + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ni = (idx - 1 + n) % n;
        else if (e.key === 'Home') ni = 0;
        else if (e.key === 'End') ni = n - 1;
        if (ni >= 0) { e.preventDefault(); selectBtn(buttons[ni]); buttons[ni].focus(); }
      });
      buttons.push(b);
      box.appendChild(b);
    });

    var pill = document.createElement('span');
    pill.className = 'seg-pill'; pill.setAttribute('aria-hidden', 'true');
    box.appendChild(pill);
    if (segBoxes.indexOf(box) < 0) segBoxes.push(box);

    function selectBtn(b) {
      buttons.forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); x.tabIndex = -1; });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true'); b.tabIndex = 0;
      movePill(box, b);
      onSet(b.dataset.value);
    }

    // place the pill already-positioned (no slide from 0,0)
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
      if (!box.isConnected) return;
      var on = $('button.on', box); if (!on) return;
      var pill = $('.seg-pill', box); if (!pill) return;
      var prev = pill.style.transition; pill.style.transition = 'none';
      movePill(box, on);
      pill.getBoundingClientRect();
      pill.style.transition = prev;
    });
  }

  /* ---------- the override (kWh / kr typed value) ---------- */
  function applyOverride() {
    var raw = $('#overrideValC').value.replace(/[\s ]/g, '').replace(',', '.');
    var v = raw === '' ? null : parseFloat(raw);
    state.overrideValue = (v != null && isFinite(v) && v > 0) ? v : null;
    forceBarDraw = true; forceChartDraw = true;
    recompute();
  }

  /* ---------- assemble the engine inputs ---------- */
  function getInputs() {
    var comps = Object.keys(state.complements).map(function (id) {
      var cm = state.complements[id];
      // touched → send explicit coverage; untouched → omit so the engine fills the
      // default AND flags the row isAssumed → "(antagande)" in the readout/bar.
      return cm.touched ? { system: id, coverage: D.multi.shareStops[cm.stop] } : { system: id };
    });
    var actual = { mode: null, kwh: null, cost: null };
    if (state.overrideValue != null) {
      actual.mode = state.overrideMode;
      if (state.overrideMode === 'kwh') actual.kwh = state.overrideValue;
      else actual.cost = state.overrideValue;
    }
    return {
      current: { primary: state.primary, complements: comps, actual: actual },
      area: +$('#areaSliderC').value,
      priceArea: state.priceArea,
      occupants: +$('#occupantsFieldC').value,
      era: state.era,
      indoorTemp: +$('#tempSliderC').value,
      distribution: state.distribution,
      pump: state.pump,
      hasWaterborne: $('#waterborneFieldC').checked,
      dso: $('#dsoFieldC').value,
      hasSolar: $('#solarFieldC').checked
    };
  }

  /* ========================================================================
   * RENDER
   * ====================================================================== */
  var lastResult = null;
  var forceBarDraw = false;     // bar entrance choreography gate
  var forceChartDraw = false;   // curve entrance choreography gate

  function recompute() {
    var inp = getInputs();
    var r = ENGINE.calculate(inp, D);
    lastResult = r;
    render(r, inp);
  }

  function render(r, inp) {
    var c = r.ctx;
    var noSaving = !(r.heroSaving > 0);
    var efficient = r.efficientFlag && !noSaving;

    // eyebrow
    $('#eyebrowC').textContent = 'Jämfört med ' + (c.currentIsElectric && !c.isMultiSystem ? 'din ' : '') + c.currentDisplayLabel.toLowerCase();
    $('#legendCurrentC').textContent = c.currentDisplayLabel.toLowerCase();

    // hero (range, rounded to 1000)
    var lo = Math.max(0, roundTo(r.heroLow, 1000));
    var hi = Math.max(0, roundTo(r.heroHigh, 1000));
    var heroEl = $('#heroValueC'), wordEl = $('#heroWordC'), heroBox = $('.hero'), heroParent = $('.beat-hero');
    if (noSaving) {
      heroEl.textContent = 'Liten eller ingen besparing';
      wordEl.style.display = 'none';
      heroBox.classList.add('hero--flat');
    } else {
      wordEl.style.display = '';
      wordEl.textContent = 'kr/år lägre';
      heroBox.classList.remove('hero--flat');
      heroEl.textContent = '~ ' + (lo === hi ? nf(hi) : nf(lo) + '–' + nf(hi));
    }
    if (!REDUCED) {
      heroEl.classList.add('flash');
      requestAnimationFrame(function () { heroEl.classList.remove('flash'); });
    }

    // hero sub (caveat: stödtjänster=0 / effektavgift=0, ROT på arbetet)
    var sub = 'Med ' + c.pumpLabel.toLowerCase() + ', efter ROT-avdraget på arbetet. Vi räknar bara på lägre uppvärmning, inte på solel eller stödtjänster.';
    if (c.currentIsPrice) sub += ' Fjärrvärme jämför vi på pris, eftersom du köper färdig värme, inte el.';
    if (c.pumpIsComplement) sub += ' Luft-luft värmer bara där luften når, så vi räknar på ' + Math.round(c.servedShare * 100) + ' % av huset.';
    $('#heroSubC').textContent = sub;

    // verdict (one sentence; serious where the saving is small/absent)
    var verdictEl = $('#verdictC');
    var peak = peakMonth(r.currentCost);
    if (noSaving) {
      verdictEl.textContent = 'Din nuvarande uppvärmning är redan effektiv. Då gör en värmepump liten skillnad på räkningen, och vi säger hellre det rakt ut.';
      verdictEl.classList.add('is-flat');
    } else if (efficient) {
      verdictEl.textContent = 'Din uppvärmning är redan ganska effektiv, så besparingen blir blygsam. Vi visar den ärligt så att du kan väga den mot kostnaden.';
      verdictEl.classList.add('is-flat');
    } else {
      verdictEl.textContent = ucfirst(monthLong(peak)) + ' är dyrast i dag. Det är då en värmepump sänker din räkning mest.';
      verdictEl.classList.remove('is-flat');
    }

    // the signature bar
    drawBar(r, forceBarDraw);
    forceBarDraw = false;

    // curve (in the reveal)
    drawChart(r, forceChartDraw);
    forceChartDraw = false;

    // blended readout
    renderBlendedReadout(r);

    // override note / grey-out schablon inputs
    renderOverrideState(r);

    // stat trio
    var trio = [$('#statCurrentC'), $('#statPumpC'), $('#statPaybackC')];
    if (!REDUCED) trio.forEach(function (v) { if (v) v.classList.add('settle'); });
    $('#statCurrentC').textContent = krStr(r.currentAnnual, 500) + '/år';
    $('#statPumpC').textContent = krStr(r.pumpAnnual, 500) + '/år';
    if (r.paybackLow == null || noSaving) {
      $('#statPaybackC').textContent = '—';
    } else {
      var pa = roundTo(r.paybackLow, 0.5), pb = roundTo(r.paybackHigh, 0.5);
      $('#statPaybackC').textContent = (pa === pb ? yrStr(pa) : yrStr(pa) + '–' + yrStr(pb)) + ' år';
    }
    if (!REDUCED) requestAnimationFrame(function () { trio.forEach(function (v) { if (v) v.classList.remove('settle'); }); });

    // upside
    renderUpside(r);

    // method + foot + placeholder
    $('#methodBodyC').innerHTML = methodHtml(r);
    $('#placeholderNoteC').textContent = D.meta.placeholderNote;
    $('#footC').innerHTML = 'Energikalkylatorn ger en uppskattning, inte ett bindande pris och inte ekonomisk rådgivning. '
      + 'Siffrorna är försiktiga schabloner som väntar slutlig signering av elektriker och ägare. '
      + 'Footprint i dag: Stockholmsregionen.';

    // CTA branch
    var cta = $('#ctaBtnC');
    cta.textContent = noSaving ? 'Få en kostnadsfri bedömning' : 'Få en skräddarsydd offert';
  }

  function peakMonth(arr) { var mi = 0, mv = -1; for (var i = 0; i < 12; i++) if (arr[i] > mv) { mv = arr[i]; mi = i; } return mi; }
  function monthLong(i) { return D.monthsLong[i]; }

  /* ---------- blended readout line ---------- */
  function renderBlendedReadout(r) {
    var box = $('#blendedReadout'); if (!box) return;
    var parts = r.currentBreakdown.map(function (b) {
      var s = b.label + ' ' + pct(b.share);
      if (b.isAssumed) s += ' <span class="assumed">(antagande)</span>';
      return s;
    });
    var html = 'I dag: <b>' + parts.join('</b> + <b>') + '</b>.';
    if (r.ctx.overrideMode) {
      html = 'Räknat på <b>din egen siffra</b>. ' + (r.ctx.isMultiSystem ? 'Fördelat på ' + parts.join(' + ') + '.' : '');
    } else if (r.ctx.complementClamped) {
      html += ' Komplementen kan inte täcka mer än ' + pct(1 - r.ctx.primaryFloor) + ' av värmen, så vi har skalat ner dem.';
    }
    box.innerHTML = html;
  }

  /* ---------- override state (note + grey schablon inputs) ---------- */
  function renderOverrideState(r) {
    var note = $('#overrideNote');
    var greyTargets = [$('#areaSliderC'), $('#eraSegC')];
    if (r.ctx.overrideMode) {
      var inBand = true;
      if (r.ctx.overrideMode === 'kwh' && state.overrideValue != null) {
        inBand = state.overrideValue >= 2000 && state.overrideValue <= 60000;
      } else if (r.ctx.overrideMode === 'cost' && state.overrideValue != null) {
        inBand = state.overrideValue >= 3000 && state.overrideValue <= 120000;
      }
      note.textContent = inBand
        ? 'Räknat på din egen siffra. Bandet runt nuvarande kostnad är borta, för nu vet vi siffran.'
        : 'Utanför ett typiskt villaspann, men vi räknar ändå på din siffra.';
      note.classList.toggle('warn', !inBand);
      greyTargets.forEach(function (n) { if (n) n.classList.add('field-grey'); });
    } else {
      note.textContent = '';
      note.classList.remove('warn');
      greyTargets.forEach(function (n) { if (n) n.classList.remove('field-grey'); });
    }
  }

  /* ---------- upside rows ---------- */
  function renderUpside(r) {
    var box = $('#upsideRowsC'); box.innerHTML = '';
    if (!r.upside.hasSolar) {
      var hint = document.createElement('div'); hint.className = 'upside-empty';
      hint.textContent = 'Slå på solel under Fler detaljer för att se solel- och batteriraderna. De räknas aldrig in i besparingen ovan.';
      box.appendChild(hint);
    }
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
  }

  /* ---------- methodology ---------- */
  function methodHtml(r) {
    var c = r.ctx;
    var blendNote = c.isMultiSystem
      ? '<h4>Blandad uppvärmning</h4>Vi delar upp din nuvarande kostnad per värmekälla och lägger ihop dem till en ärlig totalsiffra. ' +
        'Det som värmer mest håller minst ' + pct(c.primaryFloor) + ' av värmen. Besparingen är den blandade totalen minus pumpen.'
      : '';
    return '' +
      '<h4>Värmebehov</h4>Vi uppskattar husets energi från byggår, boyta, boende och innetemperatur, ' +
      'normalårskorrigerat. Skriv in din årsförbrukning eller årskostnad så räknar vi på din verkliga siffra.' +
      blendNote +
      '<h4>Verkningsgrad</h4>Vi räknar på <b>verklig årsvärmefaktor (fält-SPF)</b>, inte energimärkningens SCOP. ' +
      'Luftpumpens SPF sjunker i kyla, bergvärme ligger stabilt. Vald pump: <code>' + c.pumpLabel + '</code>, ' +
      'fält-SPF ~' + c.spfRange[0].toString().replace('.', ',') + '–' + c.spfRange[1].toString().replace('.', ',') + '.' +
      '<h4>Månadskurvan</h4>Årsbehovet fördelas över månaderna efter hur kallt det normalt är ' +
      '(graddagar). Vi använder SMHI:s normalår. Därför toppar räkningen på vintern.' +
      '<h4>Avdrag</h4>Värmepump ger <b>ROT 30 % på arbetskostnaden</b>, inte grön teknik. ' +
      'Brutto ' + krStr(c.gross, 500) + ', ROT ' + krStr(c.rot, 100) + ', netto <b>' + krStr(c.net, 500) + '</b>. ' +
      'Förutsatt outnyttjat ROT-utrymme.' +
      '<h4>Osäkerhet</h4>Vi visar ett spann, inte en exakt siffra. Bandet är vidast på vintern där fält-SPF är minst säker. ' +
      'Skriver du in din egen siffra försvinner bandet runt nuvarande kostnad.' +
      (c.footprintFlag ? '<h4>Obs</h4>Bergvärme erbjuds i dag <b>' + c.footprintFlag + '</b> och bekräftas i offerten.' : '') +
      '<h4>Solel och batteri</h4>Eventuell solel- och batteriintäkt visas som separata rader, aldrig inräknat i besparingen ovan. ' +
      'Sommarsol kan inte täcka vinterns värme, ett batteri flyttar el över dygnet, inte över året.';
  }

  /* ========================================================================
   * THE SIGNATURE DEVICE — the before→after SEGMENTED cost bar
   *   Current (blended, segmented by source) on top; the pump bars beneath;
   *   saving brace across the gap between current and the chosen pump.
   *   Bars double as the pump selector (keyboard + click).
   * ====================================================================== */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var barDrawn = false;

  // muted-teal palette for non-chosen pumps (root compare palette); slate alphas for current segments
  var SEG_ALPHA = [1, 0.72, 0.56, 0.44, 0.36];

  function svgEl(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function drawBar(r, force) {
    var svg = $('#barSvg'); if (!svg) return;
    var mobile = window.matchMedia('(max-width:768px)').matches;

    // layout geometry (viewBox units)
    var vbW = 520;
    var labelW = mobile ? 0 : 96;        // left label gutter (desktop); mobile stacks labels above
    var x0 = labelW + 8;
    var valW = 96;                       // right value gutter
    var x1 = vbW - valW - 6;
    var trackW = x1 - x0;

    // rows: current + each pump
    var rows = [];
    rows.push({ kind: 'current', label: r.ctx.currentDisplayLabel, annual: r.currentAnnual,
                breakdown: r.currentBreakdown, demandMeasured: r.ctx.demandMeasured });
    r.comparison.forEach(function (cmp) {
      if (cmp.isCurrent) return;
      rows.push({ kind: 'pump', id: cmp.id, label: cmp.label, annual: cmp.annual,
                  isChosen: cmp.isChosen });
    });

    var rowH = mobile ? 26 : 30;
    var labelH = mobile ? 18 : 0;        // mobile: label sits above each bar
    var segLabelH = 16;                  // current-bar segment labels below it
    var gap = mobile ? 22 : 16;
    var topPad = mobile ? 8 : 6;
    var braceH = 34;                     // room for the brace above the first pump

    // compute y positions
    var y = topPad;
    var curBlockH = labelH + rowH + segLabelH;
    var pumpBlockH = labelH + rowH;
    var rowsY = [];
    rows.forEach(function (row, i) {
      if (i === 0) { rowsY.push(y); y += curBlockH + braceH; }
      else { rowsY.push(y); y += pumpBlockH + gap; }
    });
    var vbH = y + 4;
    svg.setAttribute('viewBox', '0 0 ' + vbW + ' ' + vbH);

    var maxA = 0; rows.forEach(function (row) { if (row.annual > maxA) maxA = row.annual; });
    if (maxA <= 0) maxA = 1;
    function W(annual) { return trackW * Math.min(1, annual / maxA); }

    // clear (this also removes the inline <title>/<desc>; we re-create them below)
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // re-add accessible title + desc (referenced by aria-labelledby="barTitle barDesc")
    var titleEl = svgEl('title', { id: 'barTitle' });
    titleEl.textContent = 'Jämförelse av årlig uppvärmningskostnad';
    svg.appendChild(titleEl);
    var descEl = svgEl('desc', { id: 'barDesc' });
    svg.appendChild(descEl);

    // defs: diagonal hatch for the ± tail (built via createElementNS so the patterns
    // render as real SVG — innerHTML on a namespaced <defs> creates inert HTML children).
    var defs = svgEl('defs');
    function hatchPattern(id, fillCol, lineCol) {
      var pat = svgEl('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: 5, height: 5, patternTransform: 'rotate(45)' });
      pat.appendChild(svgEl('rect', { width: 5, height: 5, fill: fillCol }));
      pat.appendChild(svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: lineCol, 'stroke-width': 1.2 }));
      return pat;
    }
    defs.appendChild(hatchPattern('hatchPump', 'rgba(85,255,154,.05)', 'rgba(85,255,154,.22)'));
    defs.appendChild(hatchPattern('hatchCur', 'rgba(124,134,176,.05)', 'rgba(124,134,176,.30)'));
    svg.appendChild(defs);

    // accessible description
    var chosen = rows.filter(function (rw) { return rw.kind === 'pump' && rw.isChosen; })[0];
    var noSaving = !(r.heroSaving > 0);
    var descTxt = 'Din nuvarande uppvärmning kostar ungefär ' + nf(roundTo(r.currentAnnual, 500)) + ' kronor om året'
      + (r.ctx.isMultiSystem ? ', fördelat på ' + r.currentBreakdown.map(function (b) { return b.label + ' ' + pct(b.share); }).join(' och ') : '') + '. ';
    if (chosen) {
      descTxt += 'Med ' + chosen.label.toLowerCase() + ' blir den ungefär ' + nf(roundTo(chosen.annual, 500)) + ' kronor om året'
        + (noSaving ? '. Det ger liten eller ingen besparing.' : ', ungefär ' + nf(roundTo(r.heroLow, 1000)) + ' till ' + nf(roundTo(r.heroHigh, 1000)) + ' kronor lägre om året.');
    }
    descEl.textContent = descTxt;

    var rowEls = [];   // for entrance stagger

    rows.forEach(function (row, ri) {
      var yTop = rowsY[ri] + labelH;
      var g = svgEl('g');

      // label
      if (mobile) {
        var lblM = svgEl('text', { x: x0, y: rowsY[ri] + 12, 'font-size': '11', 'font-family': 'Outfit',
          'font-weight': row.kind === 'current' || row.isChosen ? '500' : '400',
          fill: row.kind === 'current' ? '#aeb8d4' : (row.isChosen ? '#fff' : '#8a93b5') });
        lblM.textContent = row.label;
        g.appendChild(lblM);
      } else {
        var lbl = svgEl('text', { x: labelW, y: yTop + rowH / 2 + 4, 'text-anchor': 'end',
          'font-size': '11.5', 'font-family': 'Outfit',
          'font-weight': row.kind === 'current' || row.isChosen ? '500' : '400',
          fill: row.kind === 'current' ? '#cfe9e0' : (row.isChosen ? '#fff' : '#8a93b5') });
        lbl.textContent = row.label;
        g.appendChild(lbl);
      }

      // track background
      g.appendChild(svgEl('rect', { x: x0, y: yTop, width: trackW, height: rowH, rx: 6,
        fill: 'rgba(255,255,255,.05)' }));

      var fullW = W(row.annual);

      // ± hatch tail (collapses on override for current; always shown on air-source pumps)
      var bandFrac = 0;
      if (row.kind === 'current') {
        bandFrac = row.demandMeasured ? 0 : D.demandSpread;   // WOW-3: collapse on override
      } else {
        // pump band width derived from the engine's low/high annual spread
        bandFrac = 0.10;  // visual hint; the real per-month ribbon lives in the curve reveal
      }

      // the fill group (clipped to the track radius via overflow hidden rect path)
      var clip = svgEl('clipPath', { id: 'clip-' + ri });
      clip.appendChild(svgEl('rect', { x: x0, y: yTop, width: trackW, height: rowH, rx: 6 }));
      g.appendChild(clip);
      var fillG = svgEl('g', { 'clip-path': 'url(#clip-' + ri + ')' });

      if (row.kind === 'current') {
        // SEGMENTED by source
        var cx = x0;
        var totalAnnual = row.annual || 1;
        row.breakdown.forEach(function (seg, si) {
          var segW = fullW * (seg.annual / totalAnnual);
          var alpha = SEG_ALPHA[Math.min(si, SEG_ALPHA.length - 1)];
          var rect = svgEl('rect', {
            x: cx, y: yTop, width: Math.max(0, segW), height: rowH,
            fill: 'rgba(124,134,176,' + alpha.toFixed(2) + ')',
            'data-seg': si, class: 'seg-block'
          });
          fillG.appendChild(rect);
          // thin divider between segments
          if (si > 0) fillG.appendChild(svgEl('rect', { x: cx, y: yTop, width: 1.2, height: rowH, fill: 'rgba(9,11,50,.5)' }));
          cx += segW;
        });
        // ± hatch tail past the solid end
        if (bandFrac > 0) {
          var tailW = fullW * bandFrac;
          fillG.appendChild(svgEl('rect', { x: fullW + x0 - 0.5, y: yTop, width: tailW, height: rowH, fill: 'url(#hatchCur)' }));
        }
      } else {
        // pump bar: teal if chosen, muted teal otherwise
        var col = row.isChosen ? '#00a991' : 'rgba(0,169,145,.45)';
        fillG.appendChild(svgEl('rect', { x: x0, y: yTop, width: Math.max(0, fullW), height: rowH, fill: col, class: 'pump-fill' }));
        // ± hatch tail
        if (bandFrac > 0) {
          fillG.appendChild(svgEl('rect', { x: fullW + x0 - 0.5, y: yTop, width: fullW * bandFrac, height: rowH, fill: 'url(#hatchPump)' }));
        }
      }
      g.appendChild(fillG);

      // value at the bar end
      var valEl = svgEl('text', { x: vbW - 4, y: yTop + rowH / 2 + 4, 'text-anchor': 'end',
        'font-size': '12', 'font-family': 'Outfit', 'font-weight': '500',
        fill: row.kind === 'current' ? '#fff' : (row.isChosen ? '#dffbe9' : '#aeb8d4') });
      valEl.textContent = nf(roundTo(row.annual, 500)) + ' kr';
      g.appendChild(valEl);

      // current-bar segment labels below it (drop tiny ones to tooltip-only)
      if (row.kind === 'current' && !mobile) {
        var lx = x0;
        var tot2 = row.annual || 1;
        row.breakdown.forEach(function (seg) {
          var segW = fullW * (seg.annual / tot2);
          if (segW / trackW >= 0.12) {  // only label segments ≥ ~12% wide
            var t = svgEl('text', { x: lx + segW / 2, y: yTop + rowH + 12, 'text-anchor': 'middle',
              'font-size': '9.5', 'font-family': 'Outfit', fill: '#8a93b5' });
            t.textContent = seg.label.replace(' (befintlig)', '') + ' ' + pct(seg.share);
            g.appendChild(t);
          }
          lx += segW;
        });
      }

      // pump rows: keyboard-focusable selector
      if (row.kind === 'pump') {
        var hit = svgEl('rect', { x: 0, y: rowsY[ri], width: vbW, height: pumpBlockH, fill: 'transparent',
          class: 'barrow-hit', tabindex: '0', role: 'button' });
        hit.setAttribute('aria-label', 'Välj ' + row.label);
        var pick = function () { state.pump = row.id; forceBarDraw = true; forceChartDraw = true; recompute(); };
        hit.addEventListener('click', pick);
        hit.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        // tooltip on hover
        hit.addEventListener('mouseenter', function () { showBarTip(row, rowsY[ri] + labelH, svg); });
        hit.addEventListener('mousemove', function () { showBarTip(row, rowsY[ri] + labelH, svg); });
        hit.addEventListener('mouseleave', hideBarTip);
        hit.addEventListener('focus', function () { showBarTip(row, rowsY[ri] + labelH, svg); announce(row); });
        hit.addEventListener('blur', hideBarTip);
        g.appendChild(hit);
      } else {
        // current bar: segment tooltips
        var hitC = svgEl('rect', { x: 0, y: rowsY[ri], width: vbW, height: curBlockH, fill: 'transparent' });
        hitC.addEventListener('mouseenter', function () { showCurTip(row, rowsY[ri] + labelH, svg); });
        hitC.addEventListener('mousemove', function () { showCurTip(row, rowsY[ri] + labelH, svg); });
        hitC.addEventListener('mouseleave', hideBarTip);
        g.appendChild(hitC);
      }

      svg.appendChild(g);
      rowEls.push({ g: g, fillG: fillG });
    });

    // the saving brace between current bar end and the chosen pump bar end
    if (chosen && !noSaving) {
      var curEndX = x0 + W(r.currentAnnual);
      var pumpEndX = x0 + W(chosen.annual);
      var braceY = rowsY[0] + labelH + curBlockH + 10;
      var bx0 = Math.min(curEndX, pumpEndX), bx1 = Math.max(curEndX, pumpEndX);
      var brace = svgEl('g', { class: 'saving-brace' });
      // bracket
      var path = 'M' + bx0.toFixed(1) + ',' + (braceY - 5) + ' L' + bx0.toFixed(1) + ',' + braceY +
                 ' L' + bx1.toFixed(1) + ',' + braceY + ' L' + bx1.toFixed(1) + ',' + (braceY - 5);
      var p = svgEl('path', { d: path, fill: 'none', stroke: '#55ff9a', 'stroke-width': '1.6',
        'stroke-opacity': '.85', 'stroke-linecap': 'round', class: 'brace-path' });
      brace.appendChild(p);
      var bt = svgEl('text', { x: ((bx0 + bx1) / 2).toFixed(1), y: braceY + 16, 'text-anchor': 'middle',
        'font-size': '11', 'font-family': 'Outfit', 'font-weight': '500', fill: '#55ff9a' });
      bt.textContent = '~ ' + nf(roundTo(r.heroLow, 1000)) + '–' + nf(roundTo(r.heroHigh, 1000)) + ' kr/år lägre';
      brace.appendChild(bt);
      svg.appendChild(brace);
    } else if (chosen && noSaving) {
      // calm mint note instead of a neon brace
      var note = svgEl('text', { x: x0, y: rowsY[0] + labelH + curBlockH + 18, 'text-anchor': 'start',
        'font-size': '11', 'font-family': 'Outfit', 'font-weight': '500', fill: '#9fe1cb' });
      note.textContent = 'Liten eller ingen skillnad mot din nuvarande uppvärmning.';
      svg.appendChild(note);
    }

    // entrance: scaleX bars from the left, staggered
    if (!REDUCED && (force || !barDrawn)) {
      rowEls.forEach(function (re, i) {
        re.fillG.style.transformBox = 'fill-box';
        re.fillG.style.transformOrigin = 'left center';
        re.fillG.style.transform = 'scaleX(0)';
        re.fillG.getBoundingClientRect();
        re.fillG.style.transition = 'transform var(--t-mid) var(--ease-out)';
        setTimeout(function () { re.fillG.style.transform = 'scaleX(1)'; }, Math.min(i * 40, 160));
      });
      var bp = svg.querySelector('.brace-path');
      if (bp && bp.getTotalLength) {
        var len = bp.getTotalLength();
        bp.style.strokeDasharray = len; bp.style.strokeDashoffset = len; bp.getBoundingClientRect();
        bp.style.transition = 'stroke-dashoffset var(--t-mid) var(--ease-out)';
        setTimeout(function () { bp.style.strokeDashoffset = 0; }, 200);
      }
    }
    barDrawn = true;
  }

  /* ---------- bar tooltips ---------- */
  function tipXY(svg, vbX, vbY) {
    var plate = svg.parentNode;
    var pRect = plate.getBoundingClientRect();
    var sRect = svg.getBoundingClientRect();
    var vb = svg.viewBox.baseVal;
    var sx = sRect.width / (vb.width || 520);
    var sy = sRect.height / (vb.height || 300);
    return { left: (sRect.left - pRect.left) + vbX * sx, top: (sRect.top - pRect.top) + vbY * sy, plateW: plate.clientWidth };
  }
  function placeTip(tip, left, top) {
    var w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(w / 2 + 4, Math.min(left)) + 'px';
    tip.classList.remove('below');
    if (top - h - 8 < 0) { tip.style.top = (top + 26) + 'px'; tip.classList.add('below'); }
    else { tip.style.top = top + 'px'; }
    requestAnimationFrame(function () { tip.classList.add('show'); });
  }
  function showBarTip(row, vbY, svg) {
    var tip = $('#barTip');
    var r = lastResult; if (!r) return;
    var deltaLo = roundTo(r.heroLow, 500), deltaHi = roundTo(r.heroHigh, 500);
    var isChosen = row.isChosen;
    tip.innerHTML = '<div class="tip-m">' + row.label + '</div>' +
      '<div class="tip-r"><span>Kostnad</span><span>' + krStr(row.annual, 500) + '/år</span></div>' +
      (isChosen && r.heroSaving > 0 ? '<div class="tip-r"><span>Lägre</span><span>~ ' + nf(deltaLo) + '–' + nf(deltaHi) + ' kr</span></div>' : '');
    tip.hidden = false;
    var pos = tipXY(svg, 260, vbY);
    placeTip(tip, Math.min(pos.plateW - tip.offsetWidth / 2 - 4, pos.left), pos.top);
  }
  function showCurTip(row, vbY, svg) {
    var tip = $('#barTip');
    var rows = row.breakdown.map(function (b) {
      return '<div class="tip-r"><span>' + b.label.replace(' (befintlig)', '') + ' ' + pct(b.share) + (b.isAssumed ? ' (antagande)' : '') + '</span><span>' + krStr(b.annual, 500) + '</span></div>';
    }).join('');
    tip.innerHTML = '<div class="tip-m">' + row.label + ' · ' + krStr(row.annual, 500) + '/år</div>' + rows;
    tip.hidden = false;
    var pos = tipXY(svg, 260, vbY);
    placeTip(tip, Math.min(pos.plateW - tip.offsetWidth / 2 - 4, pos.left), pos.top);
  }
  function hideBarTip() { var tip = $('#barTip'); tip.classList.remove('show'); setTimeout(function () { tip.hidden = true; }, 160); }
  function announce(row) {
    var live = $('#barLive'); if (!live) return;
    live.textContent = row.label + ', ' + nf(roundTo(row.annual, 500)) + ' kronor om året. Tryck för att jämföra med den.';
  }

  /* ========================================================================
   * THE CURVE (secondary reveal) — ported verbatim from root drawChart.
   * ====================================================================== */
  var CHART = { x0: 34, x1: 352, yTop: 30, yBase: 138, lblY: 156, vbW: 372, vbH: 168, padR: 20 };
  var chartDrawn = false;

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
    var svg = $('#chartC'); if (!svg) return;
    // skip work while the curve reveal is collapsed (no measurable box); will draw on open
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
      return smoothPath(ptsOf(arr)) +
        ' L' + X(11).toFixed(2) + ',' + c.yBase.toFixed(2) +
        ' L' + X(0).toFixed(2) + ',' + c.yBase.toFixed(2) + ' Z';
    }
    function smoothRibbon() {
      var top = smoothPath(ptsOf(hiB));
      var loRev = ptsOf(loB).slice().reverse();
      var bot = smoothPath(loRev).replace(/^M([\d.\-]+),([\d.\-]+)/, 'L$1,$2');
      return top + ' ' + bot + ' Z';
    }

    var pk = peakMonth(cur);
    var title = '<title id="chartTitleC">Månadskurva för kostnad</title>' +
      '<desc id="chartDescC">Nuvarande uppvärmning toppar i ' + monthLong(pk) +
      '. Värmepumpen ligger lägre hela året, med ett osäkerhetsband som vidgas under vintern.</desc>';

    var defs = '<defs>' +
      '<linearGradient id="gCurC" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#8b95bd" stop-opacity=".22"/><stop offset="1" stop-color="#8b95bd" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="gPumpC" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#00c4a7" stop-opacity=".26"/><stop offset="1" stop-color="#00c4a7" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="gBandC" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#19c39e" stop-opacity=".20"/><stop offset="1" stop-color="#19c39e" stop-opacity=".08"/></linearGradient>' +
      '<filter id="glowPumpC" x="-20%" y="-40%" width="140%" height="180%">' +
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

    g += '<g class="ch-fills"' + (!REDUCED && (force || !chartDrawn) ? ' opacity="0"' : '') + '>';
    g += '<path d="' + smoothArea(cur) + '" fill="url(#gCurC)"/>';
    g += '<path d="' + smoothRibbon() + '" fill="url(#gBandC)"/>';
    g += '<path d="' + smoothArea(pump) + '" fill="url(#gPumpC)"/>';
    g += '</g>';

    g += '<line x1="' + X(pk).toFixed(1) + '" y1="' + c.yTop + '" x2="' + X(pk).toFixed(1) + '" y2="' + Y(cur[pk]).toFixed(1) + '" stroke="rgba(255,255,255,.18)" stroke-width="1" stroke-dasharray="2 3"/>';
    g += '<line x1="' + X(pk).toFixed(1) + '" y1="' + Y(cur[pk]).toFixed(1) + '" x2="' + X(pk).toFixed(1) + '" y2="' + Y(pump[pk]).toFixed(1) + '" stroke="#55ff9a" stroke-width="2" stroke-opacity=".5" stroke-linecap="round"/>';

    g += '<path d="' + smoothPath(ptsOf(cur)) + '" fill="none" stroke="#8b95bd" stroke-width="1.6" stroke-dasharray="1 5" stroke-linecap="round" stroke-linejoin="round" class="ln-cur"/>';
    g += '<path d="' + smoothPath(ptsOf(pump)) + '" fill="none" stroke="#00c4a7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowPumpC)" class="ln-pump"/>';

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
    ind.setAttribute('id', '_indC'); ind.setAttribute('opacity', '0'); ind.style.pointerEvents = 'none';
    var gl = document.createElementNS(SVGNS, 'line');
    gl.setAttribute('y1', c.yTop); gl.setAttribute('y2', c.yBase);
    gl.setAttribute('stroke', 'rgba(255,255,255,.28)'); gl.setAttribute('stroke-width', '1');
    var dC = document.createElementNS(SVGNS, 'circle');
    dC.setAttribute('r', '3.2'); dC.setAttribute('fill', 'none'); dC.setAttribute('stroke', '#8b95bd'); dC.setAttribute('stroke-width', '1.6');
    var dP = document.createElementNS(SVGNS, 'circle');
    dP.setAttribute('r', '4'); dP.setAttribute('fill', '#00c4a7'); dP.setAttribute('stroke', '#55ff9a'); dP.setAttribute('stroke-width', '2'); dP.setAttribute('filter', 'url(#glowPumpC)');
    ind.appendChild(gl); ind.appendChild(dC); ind.appendChild(dP);
    svg.appendChild(ind);

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
    var tip = $('#chartTipC'); var device = svg.parentNode;
    var ind = svg.querySelector('#_indC');
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
      var delta = Math.max(0, r.currentCost[m] - r.pumpCost[m]);
      tip.innerHTML = '<div class="tip-m">' + ucfirst(monthLong(m)) + '</div>' +
        '<div class="tip-r"><span>Nuvarande</span><span>' + krStr(r.currentCost[m], 50) + '</span></div>' +
        '<div class="tip-r"><span>Värmepump</span><span>' + krStr(r.pumpCost[m], 50) + '</span></div>' +
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
    svg.setAttribute('aria-describedby', 'chartDescC');
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
   * INTERACTIONS — sliders, stepper, reveals, override, lead form
   * ====================================================================== */
  function wireControls() {
    // live recompute on native inputs (area, temp, dso, waterborne, solar)
    el('[data-input-c]').forEach(function (n) {
      if (n.id === 'systemFieldC') return; // handled in buildInputs
      var ev = (n.type === 'range') ? 'input' : 'change';
      n.addEventListener(ev, function () {
        if (n.type === 'range') { recompute(); }
        else { forceBarDraw = true; forceChartDraw = true; recompute(); }
      });
    });

    // slider output mirrors
    var area = $('#areaSliderC'); area.addEventListener('input', function () { $('#areaOutC').textContent = area.value + ' m²'; });
    var temp = $('#tempSliderC'); temp.addEventListener('input', function () { $('#tempOutC').textContent = temp.value + ' °C'; });

    // stepper (occupants)
    el('.stepbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = $('#occupantsFieldC'); var v = Math.max(1, Math.min(8, (+f.value) + (+b.dataset.dir)));
        f.value = v;
        var out = $('#occOutC');
        if (!REDUCED) { out.classList.add('bump'); requestAnimationFrame(function () { out.classList.remove('bump'); }); }
        out.textContent = v;
        recompute();
      });
    });

    // override typed value (soft-clamp on blur, recompute on input)
    var ov = $('#overrideValC');
    ov.addEventListener('input', applyOverride);
    ov.addEventListener('blur', function () {
      // pretty-print thousands on blur
      if (state.overrideValue != null) ov.value = nf(state.overrideValue);
    });

    // reveals (accordion)
    el('.reveal').forEach(function (btn) {
      var targetId = btn.getAttribute('aria-controls');
      var target = document.getElementById(targetId);
      btn.addEventListener('click', function () {
        var willOpen = !target.classList.contains('open');
        target.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) {
          setTimeout(function () {
            replaceAllPills();
            // draw the curve once its container has a measurable box
            if (targetId === 'curveWrap' && lastResult) { forceChartDraw = true; drawChart(lastResult, true); }
            if (targetId === 'overrideWrap') { try { $('#overrideValC').focus(); } catch (e) {} }
          }, REDUCED ? 0 : 240);
        }
      });
    });

    // lead form
    $('#ctaBtnC').addEventListener('click', openLead);
    $('#leadCloseC').addEventListener('click', function () { $('#leadwrapC').setAttribute('hidden', ''); });
    $('#leadFormC').addEventListener('submit', submitLead);
    // clear per-field error styling on input
    ['leadNameC', 'leadPhoneC', 'leadZipC'].forEach(function (id) {
      var f = $('#' + id);
      f.addEventListener('input', function () { f.removeAttribute('aria-invalid'); });
    });
  }

  function openLead() {
    var w = $('#leadwrapC'); w.removeAttribute('hidden');
    $('#leadFormC').hidden = false; $('#leadSuccessC').hidden = true;
    setTimeout(function () { try { $('#leadNameC').focus(); } catch (e) {} }, 30);
    try { w.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' }); } catch (e) {}
  }

  function submitLead(e) {
    e.preventDefault();
    var err = $('#leadErrC');
    if ($('#leadCompanyC').value) { return; } // honeypot
    var fields = {
      name: $('#leadNameC'), phone: $('#leadPhoneC'), zip: $('#leadZipC')
    };
    var gdpr = $('#leadGdprC').checked;
    var missing = [];
    Object.keys(fields).forEach(function (k) {
      var f = fields[k];
      if (!f.value.trim()) { f.setAttribute('aria-invalid', 'true'); missing.push(k); }
      else { f.removeAttribute('aria-invalid'); }
    });
    if (missing.length || !gdpr) {
      err.textContent = 'Fyll i namn, telefon, postnummer och godkänn villkoren. E-post är valfritt.';
      err.hidden = false;
      if (missing.length) { try { fields[missing[0]].focus(); } catch (e2) {} }
      return;
    }
    err.hidden = true;
    var r = lastResult || {};
    var band = r.heroSaving > 0 ? (roundTo(r.heroLow, 1000) + '-' + roundTo(r.heroHigh, 1000)) : 'na';
    var comps = Object.keys(state.complements).join('+') || 'none';
    try {
      console.log('[ampy lead vC]', { zip: $('#leadZipC').value.trim(), primary: state.primary, complements: comps,
        pump: state.pump, area: $('#areaSliderC').value, priceArea: state.priceArea,
        override: state.overrideValue != null ? state.overrideMode : 'no', savingBand: band });
    } catch (e3) {}
    $('#leadFormC').hidden = true; $('#leadSuccessC').hidden = false;
  }

  /* ---------- resize: re-place pills + re-tune both figures ---------- */
  var rT;
  window.addEventListener('resize', function () {
    replaceAllPills();
    clearTimeout(rT); rT = setTimeout(function () {
      if (lastResult) { drawBar(lastResult, false); if ($('#curveWrap').classList.contains('open')) drawChart(lastResult, false); }
    }, 160);
  });

  /* ---------- boot ---------- */
  function boot() {
    buildInputs(); wireControls(); recompute();
    if (!REDUCED) {
      var sheet = $('#resultC');
      requestAnimationFrame(function () {
        sheet.classList.add('enter');
        setTimeout(function () { sheet.classList.remove('enter'); }, 700);
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

})();
