/* =============================================================================
 * rank.js — Energikollen V4 · the PURE additive layer above engine.js
 * (V4-engine-delta.md §4 implemented exactly. No DOM. No rounding. No Date.)
 *
 *   rankOptions(inputs, D) — one calculate() per candidate measure, feasibility
 *   gates (grey WITH reason, never hide), deterministic rung/payback sort, the
 *   exact space/VV/household cost split for the story bar, and the verdict branch.
 *
 *   AmpyCodec — the URL codec (§13.3): share links + ad deep-links, one codec
 *   two jobs. House state ONLY; NO identity, NO tracking fields, ever.
 *
 * engine.js math is FROZEN; this file only calls it. data.js owns every number.
 * Invariant (tested): option.saving[1] === option.results.heroSaving
 *                     === baseline.currentAnnual − option.futureAnnual.
 * ========================================================================== */

(function (global) {
  'use strict';

  function sum(arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i]; return s; }
  function safeDiv(a, b) { return b === 0 ? 0 : a / b; }
  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; if (!s) continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k];
    }
    return t;
  }

  function paFactor(inputs, D) {
    var pa = D.priceAreas[inputs.priceArea] || D.priceAreas[D.defaultPriceArea];
    return pa.factor;
  }

  /* ---------- exact space/VV cost split (E1 fields; §4.0) ---------- */
  function costSplit(base, inputs, D) {
    var spaceCost = 0;
    for (var m = 0; m < 12; m++) {
      spaceCost += base.currentCost[m] * safeDiv(base.spaceHeatMonthly[m], base.monthHeat[m]);
    }
    var vvCost = base.currentAnnual - spaceCost;
    // [MODEL] story-bar grey segment only ("den rör vi inte"); NEVER in any saving.
    var householdCost = D.household * D.marginalPriceSE3 * paFactor(inputs, D);
    return { heatingKr: spaceCost, vvKr: vvCost, householdKr: householdCost };
  }

  /* ---------- §4.3 netInvestRange — resolves the waterborne tri-state HONESTLY ----------
   * gross paths reuse the engine's own rule (engine step 11); this never disagrees with
   * r.ctx.net, it only widens to a range when wb is unknown. */
  function netInvestRange(pu, wb, D) {
    var g;
    if (!pu.requiresWaterborne) {
      g = [pu.gross, pu.gross];
    } else if (wb === true) {
      g = [pu.gross, pu.gross];
    } else if (wb === false) {
      var gn = (pu.grossNoWaterborne != null) ? pu.grossNoWaterborne : pu.gross;
      g = [gn, gn];
    } else { // wb === null | undefined ("vet ej") → honest range
      g = [pu.gross, (pu.grossNoWaterborne != null) ? pu.grossNoWaterborne : pu.gross];
    }
    function net(x) {
      var rot = Math.min(x * pu.laborShare * D.rotRate, D.rotCapPerPerson);
      return x - rot;
    }
    return [net(g[0]), net(g[1])];
  }

  /* ---------- §4.4 comboOption — the future-stack recombination (exact, linear) ----------
   * Valid ONLY for whole-house pumps (servedShare === 1). Kept complement keeps the cost
   * it has today; the pump serves the rest. Zero new physics; Σgaps === saving holds. */
  function comboOption(opt, r, base, keptComps, currentAnnual, D) {
    var keptRows = [];
    for (var i = 0; i < base.currentBreakdown.length; i++) {
      var row = base.currentBreakdown[i];
      if (keptComps.indexOf(row.id) !== -1 && !row.isPrimary) keptRows.push(row);
    }
    var covRaw = 0;
    keptRows.forEach(function (kr) { covRaw += kr.share; });
    var covKept = Math.min(covRaw, D.combi.maxKeptShare);   // [GAP-V4-7]
    var k = covRaw > 0 ? covKept / covRaw : 0;              // proportional scale-down

    var comboAnnual = 0, futHigh = 0, futLow = 0;
    for (var m = 0; m < 12; m++) {
      var kept = 0;
      keptRows.forEach(function (kr) { kept += kr.monthly[m] * k; });
      comboAnnual += r.pumpCost[m]     * (1 - covKept) + kept;
      futHigh     += r.pumpCostHigh[m] * (1 - covKept) + kept;  // worst-case cost
      futLow      += r.pumpCostLow[m]  * (1 - covKept) + kept;  // best-case cost
    }
    // kept-complement term held at mid — conservative: its uncertainty never widens the claim.
    var savingLow  = currentAnnual - futHigh;
    var savingHigh = currentAnnual - futLow;
    var savingMid  = currentAnnual - comboAnnual;

    return {
      id: opt.id + '+spets', kind: 'combo',
      label: 'Byt till ' + r.ctx.pumpLabel + ' + behåll kaminen som spets',
      results: r, baseId: opt.id,
      saving: [savingLow, savingMid, savingHigh],
      netInvest: opt.netInvest.slice(),        // the kept complement costs 0 kr — it exists
      futureAnnual: comboAnnual,
      futureAnnualLow: currentAnnual - savingHigh,
      futureAnnualHigh: currentAnnual - savingLow,
      covKept: covKept,
      eligible: opt.eligible, ineligibleReason: opt.ineligibleReason,
      caveats: opt.caveats.concat(['spetsAntagande']),   // covKept shown as "(antagande)"
      flags: assign({}, opt.flags)
    };
  }

  /* =========================================================================
   * rankOptions(inputs, D) — §4 in full
   * ========================================================================= */
  function rankOptions(inputs, D) {
    var ENGINE = global.AmpyEngine;

    /* ---------- 4.0 BASELINE (current side is pump-independent) ---------- */
    var base = ENGINE.calculate(assign({}, inputs, { pump: D.defaultPump }), D);
    var currentAnnual = base.currentAnnual;
    var primaryIsPump = (D.heatPumpCurrentIds || []).indexOf(base.ctx.primaryId) !== -1;
    var smallThreshold = (D.multi && D.multi.smallSavingThreshold != null) ? D.multi.smallSavingThreshold : 1500; // [GAP-MULTI-3]

    var split = costSplit(base, inputs, D);

    /* ---------- 4.1 WATERBORNE tri-state (app resolves Q1 inference; wrapper consumes) ---------- */
    var wb = (inputs.hasWaterborne === true) ? true
           : (inputs.hasWaterborne === false) ? false
           : null;

    /* ---------- 4.2 CANDIDATE GENERATION ---------- */
    var candidates = [];

    // S0 — behåll (always; identity on the baseline)
    candidates.push({
      id: 'behall', kind: 'behall', label: 'Behåll det du har',
      futureAnnual: currentAnnual, futureAnnualLow: currentAnnual, futureAnnualHigh: currentAnnual,
      saving: [0, 0, 0], netInvest: [0, 0], results: base,
      eligible: true, ineligibleReason: null, caveats: [], flags: {}, numeric: true
    });

    // S1 — styrning (derived row, NO extra calculate() call)
    var ctrl = (D.rank.controllablePrimaries || []).indexOf(base.ctx.primaryId) !== -1;
    if (D.measures && D.measures.styrning) {
      var st = D.measures.styrning;
      var row = {
        id: 'styrning', kind: 'styrning', label: st.label,
        eligible: ctrl, ineligibleReason: ctrl ? null : 'styrningEjStyrbar',
        numeric: !!st.signed,
        caveats: ['styrningTimpris'],           // "kräver timprisavtal" caveat always on
        flags: {}, results: null
      };
      if (st.signed) {
        // cut applies to the SPACE-HEATING cost share only (conservative: excludes VV + household).
        // The °C lever (tempSensitivity) is a SEPARATE live input — no double counting.
        var sLow = split.heatingKr * st.heatingCostCut[0];
        var sHigh = split.heatingKr * st.heatingCostCut[1];
        row.saving = [sLow, (sLow + sHigh) / 2, sHigh];
        row.netInvest = [st.invest[0], st.invest[1]];   // laborShare null ⇒ no ROT
        row.futureAnnual = currentAnnual - row.saving[1];
        row.futureAnnualLow = currentAnnual - sHigh;
        row.futureAnnualHigh = currentAnnual - sLow;
      }
      candidates.push(row);
    }

    /* pump options — S2 (complement) + S3/S4 (replace) + combo variants */
    var hasExistingLuftluft = false;
    for (var bi = 0; bi < base.currentBreakdown.length; bi++) {
      var br = base.currentBreakdown[bi];
      if (br.id === 'luftluftCur' && br.share >= D.rank.complementHeadroomMax) hasExistingLuftluft = true;
    }
    var keptComps = [];
    var comps = (inputs.current && Array.isArray(inputs.current.complements)) ? inputs.current.complements : [];
    comps.forEach(function (c) {
      if (c && c.system && (D.combi.keepable || []).indexOf(c.system) !== -1) keptComps.push(c.system);
    });

    Object.keys(D.pumps).forEach(function (pumpId) {
      var pu = D.pumps[pumpId];
      var r = ENGINE.calculate(assign({}, inputs, { pump: pumpId }), D);   // one call per pump

      var opt = {
        id: pumpId,
        kind: pu.isComplement ? 'complement' : 'replace',
        label: pu.isComplement
          ? 'Behåll ' + base.ctx.currentLabel + ' + lägg till ' + pu.label  // reframe, engine math unchanged
          : 'Byt till ' + pu.label,
        results: r, numeric: true,
        saving: [r.heroLow, r.heroSaving, r.heroHigh],
        netInvest: netInvestRange(pu, wb, D),
        futureAnnual: r.pumpAnnual,
        futureAnnualLow: currentAnnual - r.heroHigh,
        futureAnnualHigh: currentAnnual - r.heroLow,
        eligible: true, ineligibleReason: null, caveats: [], flags: {}
      };

      // --- eligibility gates (V4-systems §3.1) — grey WITH reason, never hide ---
      if (primaryIsPump) { opt.eligible = false; opt.ineligibleReason = 'redanVarmepump'; }
      if (pu.isComplement && hasExistingLuftluft) { opt.eligible = false; opt.ineligibleReason = 'luftluftFinnsRedan'; }
      if (pu.isComplement) opt.caveats.push('servedShare');            // "värmer där luften når"
      if (!pu.isGround && !pu.isComplement) opt.caveats.push('vinterSagMedISiffran'); // air-source sentence
      if (pu.footprintFlag) opt.caveats.push('viaPartner');            // [GAP-R2-4]
      if (base.ctx.primaryId === 'fjarrvarme') { opt.caveats.push('prisjamforelse'); opt.flags.priceComparison = true; } // [GAP-R1-6] never an efficiency claim
      if (pu.requiresWaterborne && wb !== true) { opt.caveats.push('vattenburetTillagg'); opt.flags.waterborneAdder = true; }

      candidates.push(opt);

      // --- combo variant: replacement pump + kept spets complement (D.combi) ---
      if (!pu.isComplement && keptComps.length && !primaryIsPump) {
        if (D.combi.enabled) {
          candidates.push(comboOption(opt, r, base, keptComps, currentAnnual, D));
        } else {
          opt.caveats.push(D.combi.spetsSentenceKey);  // v1: the [GAP-V4-6] sentence on the plain card
        }
      }
    });

    /* ---------- 4.5 VERDICT BRANCH ---------- */
    var fullOpts = candidates.filter(function (c) {
      return (c.kind === 'replace' || c.kind === 'complement' || c.kind === 'combo') && c.eligible;
    });
    var bestSavingMid = -Infinity;
    fullOpts.forEach(function (c) { if (c.saving[1] > bestSavingMid) bestSavingMid = c.saving[1]; });
    var branch = primaryIsPump ? 'redanEffektiv'
               : bestSavingMid <= 0 ? 'ingenBesparing'
               : bestSavingMid <= smallThreshold ? 'litenBesparing'
               : 'standard';
    var behallFirst = (branch !== 'standard');
    // Reuses the engine's efficientFlag semantics but against the BEST option;
    // the per-run r.efficientFlag stays untouched for back-compat.

    /* ---------- 4.6 RUNG ASSIGNMENT + SORT (deterministic, printable) ---------- */
    var rungs = D.rank.rungs;
    candidates.forEach(function (c) {
      if (c.numeric === false || !c.saving) {
        // qualitative row (styrning unsigned): NO kr fields at all; sits in r0.
        c.rungIndex = 0; c.rung = rungs[0];
        c.paybackLow = null; c.paybackMid = null; c.paybackHigh = null;
        c.rangeWidth = 0; c.netInvestMid = null;
        return;
      }
      c.netInvestMid = (c.netInvest[0] + c.netInvest[1]) / 2;
      for (var ri = 0; ri < rungs.length; ri++) {
        if (c.netInvestMid <= rungs[ri].max) { c.rungIndex = ri; c.rung = rungs[ri]; break; }
      }
      c.paybackLow  = c.saving[2] > 0 ? c.netInvest[0] / c.saving[2] : null;   // best case
      c.paybackMid  = c.saving[1] > 0 ? c.netInvestMid / c.saving[1] : null;
      c.paybackHigh = c.saving[0] > 0 ? c.netInvest[1] / c.saving[0] : null;   // worst case
      c.rangeWidth  = c.saving[2] - c.saving[0];
    });

    candidates.sort(function (a, b) {
      if (a.rungIndex !== b.rungIndex) return a.rungIndex - b.rungIndex;
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;          // greyed last within rung
      var pa = (a.paybackMid == null) ? Infinity : a.paybackMid;          // null last — this ALSO
      var pb = (b.paybackMid == null) ? Infinity : b.paybackMid;          // implements berg-vs-LV live [GAP-V4-4]
      if (pa !== pb) return pa - pb;
      return a.rangeWidth - b.rangeWidth;                                 // narrower honest range wins
    });

    // behåll placement: pinned first on the honest branches; else end of rung r0 (a real card).
    var behallIdx = -1;
    for (var ci = 0; ci < candidates.length; ci++) if (candidates[ci].id === 'behall') { behallIdx = ci; break; }
    var behall = candidates.splice(behallIdx, 1)[0];
    if (behallFirst) {
      candidates.unshift(behall);
    } else {
      var insertAt = candidates.length;
      for (var cj = 0; cj < candidates.length; cj++) {
        if (candidates[cj].rungIndex > 0) { insertAt = cj; break; }
      }
      candidates.splice(insertAt, 0, behall);
    }

    // best option id: eligible full option with the shortest mid payback
    var bestOptionId = null, bestPb = Infinity;
    fullOpts.forEach(function (c) {
      var pb = (c.paybackMid == null) ? Infinity : c.paybackMid;
      if (pb < bestPb) { bestPb = pb; bestOptionId = c.id; }
    });
    if (bestOptionId == null && fullOpts.length) {
      // all paybacks null (e.g. no positive saving): fall back to the largest mid saving
      var bs = -Infinity;
      fullOpts.forEach(function (c) { if (c.saving[1] > bs) { bs = c.saving[1]; bestOptionId = c.id; } });
    }

    /* ---------- 4.7 RETURN (raw floats; renderer rounds) ---------- */
    return {
      baseline: {
        currentAnnual: currentAnnual,
        spaceCost: split.heatingKr, vvCost: split.vvKr, householdCost: split.householdKr,
        breakdown: base.currentBreakdown,
        demandMeasured: base.ctx.demandMeasured,
        overrideMode: base.ctx.overrideMode,
        combined: base.combined,
        results: base
      },
      verdict: { branch: branch, behallFirst: behallFirst, bestOptionId: bestOptionId, bestSavingMid: bestSavingMid },
      options: candidates,
      rungs: rungs
    };
  }

  /* =========================================================================
   * AmpyCodec — URL codec (§13.3). One codec, two jobs: share link + ad deep-link.
   *   ?sys=direktel&kmp=kamin.2,luftluft.2&m2=b3&era=e2&vb=0&kwh=18000 (or kr=32000)&se=SE3
   * Params present → answers pre-filled (NOT assumed). NO identity, NO tracking. Ever.
   * ========================================================================= */
  var SYS_TOKEN = {  // token → engine currentSystem id
    direktel: 'direktel', fjarrvarme: 'fjarrvarme', olja: 'olja', vedpellets: 'vedpellets',
    vattenburen: 'vattenburenEl', franluft: 'franluft',
    luftluft: 'luftluftCur', luftvatten: 'luftvattenCur', bergvarme: 'bergvarmeCur'
  };
  var SYS_ID = {};   // reverse
  Object.keys(SYS_TOKEN).forEach(function (t) { SYS_ID[SYS_TOKEN[t]] = t; });
  var KMP_TOKEN = { kamin: 'kamin', luftluft: 'luftluftCur' };
  var KMP_ID = {};
  Object.keys(KMP_TOKEN).forEach(function (t) { KMP_ID[KMP_TOKEN[t]] = t; });

  /* state shape (plain answers, app-agnostic):
   * { sys, comps:[{system, stop}], m2:'b1'..'b4', era:'e1'..'e4'|'x', vb:true|false|'x',
   *   kwh:N|null, kr:N|null, se:'SE1'..'SE4' } — all nullable. stop = 1..3 in the URL. */
  function encodeState(s) {
    var p = [];
    if (s.sys && SYS_ID[s.sys]) p.push('sys=' + SYS_ID[s.sys]);
    if (s.comps && s.comps.length) {
      var toks = [];
      s.comps.forEach(function (c) {
        if (c && c.system && KMP_ID[c.system]) {
          toks.push(KMP_ID[c.system] + '.' + ((c.stop != null ? c.stop : 1) + 1));
        }
      });
      if (toks.length) p.push('kmp=' + toks.join(','));
    }
    if (s.m2) p.push('m2=' + s.m2);
    if (s.era) p.push('era=' + s.era);
    if (s.vb === true) p.push('vb=1');
    else if (s.vb === false) p.push('vb=0');
    else if (s.vb === 'x') p.push('vb=x');
    if (s.kwh != null) p.push('kwh=' + Math.round(s.kwh));
    else if (s.kr != null) p.push('kr=' + Math.round(s.kr));
    if (s.se) p.push('se=' + s.se);
    return p.join('&');
  }

  function decodeState(search) {
    var out = { sys: null, comps: [], m2: null, era: null, vb: null, kwh: null, kr: null, se: null };
    var q = (search || '').replace(/^\?/, '');
    if (!q) return out;
    q.split('&').forEach(function (pair) {
      var kv = pair.split('='); if (kv.length !== 2) return;
      var k = kv[0], v = decodeURIComponent(kv[1]);
      if (k === 'sys' && SYS_TOKEN[v]) out.sys = SYS_TOKEN[v];
      else if (k === 'kmp') {
        v.split(',').forEach(function (tok) {
          var parts = tok.split('.');
          var sysId = KMP_TOKEN[parts[0]];
          if (!sysId) return;
          var stop = parseInt(parts[1], 10);
          out.comps.push({ system: sysId, stop: (stop >= 1 && stop <= 3) ? stop - 1 : 1 });
        });
      }
      else if (k === 'm2' && /^b[1-4]$/.test(v)) out.m2 = v;
      else if (k === 'era' && /^(e[1-4]|x)$/.test(v)) out.era = v;
      else if (k === 'vb') out.vb = (v === '1') ? true : (v === '0') ? false : (v === 'x') ? 'x' : null;
      else if (k === 'kwh') { var n1 = parseInt(v, 10); if (n1 > 0) out.kwh = n1; }
      else if (k === 'kr')  { var n2 = parseInt(v, 10); if (n2 > 0) out.kr = n2; }
      else if (k === 'se' && /^SE[1-4]$/.test(v)) out.se = v;
    });
    return out;
  }

  /* expose (rankOptions rides on AmpyEngine per the delta; codec on its own handle) */
  if (global.AmpyEngine) global.AmpyEngine.rankOptions = rankOptions;
  global.AmpyRank = { rankOptions: rankOptions, costSplit: costSplit, netInvestRange: netInvestRange };
  global.AmpyCodec = { encode: encodeState, decode: decodeState };

})(typeof window !== 'undefined' ? window : this);
