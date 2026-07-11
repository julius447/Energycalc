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

  /* ---------- exact space/VV cost split + household DISPLAY post (§4.0) ----------
   * heatingKr + vvKr === base.currentAnnual === the SAVINGS BASE (frozen, engine-owned).
   * householdKr is DISPLAY-ONLY: it grows the anchor TOTAL, never any saving/payback.
   * Read only by anchorVals + renderStorybar (grep proof: V9-SPEC §8.1).
   * Regime branch keeps the anchor reconciling to a user's typed whole-house bill:
   * when kWh is typed the engine stripped a flat D.household, so the DISPLAY must show
   * that same flat 5000, or heatVv + household would not equal the typed total. */
  function costSplit(base, inputs, D) {
    var spaceCost = 0;
    for (var m = 0; m < 12; m++) {
      spaceCost += base.currentCost[m] * safeDiv(base.spaceHeatMonthly[m], base.monthHeat[m]);
    }
    var vvCost = base.currentAnnual - spaceCost;                 // heat+VV — the SAVINGS BASE, untouched
    // household = a REAL post in the anchor TOTAL, NEVER in any saving.
    var pf = paFactor(inputs, D);
    var typedKwh = !!(inputs.current && inputs.current.actual && inputs.current.actual.mode === 'kwh');
    var householdKwh;
    if (typedKwh) {
      householdKwh = D.household;                                // flat 5000 — matches the engine strip
    } else {
      var hm  = D.householdModel || { baseKwh: D.household, perOccupantKwh: 0 };
      var occ = (inputs.occupants != null) ? inputs.occupants : D.defaultOccupants;
      householdKwh = hm.baseKwh + hm.perOccupantKwh * occ;       // dynamic occupant schablon (2 occ == 5000)
    }
    var householdCost = householdKwh * D.marginalPriceSE3 * pf;
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
      // OWNER POLICY V10: 'redanVarmepump' applies ONLY to true whole-house pump
      // primaries. franluft (eff ~1,5) and luftluftCur (partial coverage) are UPGRADE
      // cases — their options stay eligible; the numbers tell the story. [owner P3]
      if (base.ctx.primaryId === 'bergvarmeCur' || base.ctx.primaryId === 'luftvattenCur') {
        opt.eligible = false; opt.ineligibleReason = 'redanVarmepump';
      }
      if (pu.isComplement && hasExistingLuftluft) { opt.eligible = false; opt.ineligibleReason = 'luftluftFinnsRedan'; }
      if (pu.isComplement) opt.caveats.push('servedShare');            // "värmer där luften når"
      if (!pu.isGround && !pu.isComplement) opt.caveats.push('vinterSagMedISiffran'); // air-source sentence
      if (pu.footprintFlag) opt.caveats.push('viaPartner');            // [GAP-R2-4]
      if (base.ctx.primaryId === 'fjarrvarme') { opt.caveats.push('prisjamforelse'); opt.flags.priceComparison = true; } // [GAP-R1-6] never an efficiency claim
      if (pu.requiresWaterborne && wb !== true) { opt.caveats.push('vattenburetTillagg'); opt.flags.waterborneAdder = true; }

      candidates.push(opt);

      // --- combo variant: replacement pump + kept spets complement (D.combi) ---
      // V10: same two-id test as the gate above — combos unlock for franluft/luftluftCur [owner P3]
      if (!pu.isComplement && keptComps.length &&
          base.ctx.primaryId !== 'bergvarmeCur' && base.ctx.primaryId !== 'luftvattenCur') {
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
    // OWNER POLICY V10 (P1): behåll never pins first. behallFirst is emitted as a
    // CONSTANT false — the field stays for payload back-compat only.
    var behallFirst = false;
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

    // behåll placement: ALWAYS end of rung r0 (a context card, never the lead) [owner P1]
    var behallIdx = -1;
    for (var ci = 0; ci < candidates.length; ci++) if (candidates[ci].id === 'behall') { behallIdx = ci; break; }
    var behall = candidates.splice(behallIdx, 1)[0];
    var insertAt = candidates.length;
    for (var cj = 0; cj < candidates.length; cj++) {
      if (candidates[cj].rungIndex > 0) { insertAt = cj; break; }
    }
    candidates.splice(insertAt, 0, behall);

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
   * recommend(R, inputs, D) — V10 the additive ADVICE layer (V10-SPEC §1.3).
   *
   * rankOptions stays the TRUTH TABLE (every option, deterministic sort — feeds
   * the comparison visual). recommend() decides WHAT IS ADVICE.
   * Pure + deterministic: no DOM, no Date, no rounding, does NOT mutate R.
   *
   * OWNER POLICY V10 (P1-P5, 2026-07-10): the ★ lead is ALWAYS a real, purchasable
   * action. 'Behåll det du har' may exist as a context row but NEVER carries the ★
   * and never leads the list. Payback never suppresses advice; it is DISCLOSED
   * plainly in the verdict. The old pbLeadMax-as-suppressor + behåll-first branch
   * design is retired on owner instruction. Honesty lives in the visible numbers.
   * ========================================================================= */
  function recommend(R, inputs, D) {
    var base = R.baseline.results, primaryId = base.ctx.primaryId;
    var TRUE_OPTIMAL = ['bergvarmeCur', 'luftvattenCur'];       // whole-house pumps ONLY [owner P3]
    var trueOptimal = TRUE_OPTIMAL.indexOf(primaryId) !== -1;
    var hp = D.heatPumpCurrentIds || [];
    var smallThreshold = (D.multi && D.multi.smallSavingThreshold != null) ? D.multi.smallSavingThreshold : 1500;

    var pumpShare = 0, kaminShare = 0;
    base.currentBreakdown.forEach(function (b) {
      if (b.isPrimary) return;
      if (hp.indexOf(b.id) !== -1) pumpShare += b.share;
      if (b.id === 'kamin') kaminShare += b.share;
    });

    /* candidate pool: eligible numeric full options with a real kr story and an
     * honest ceiling. pbActionMax does NOT hide numbers — only reroutes the ★. */
    var full = R.options.filter(function (o) {
      return o.eligible && o.numeric !== false &&
             (o.kind === 'replace' || o.kind === 'complement' || o.kind === 'combo');
    });
    var candidates = full.filter(function (o) {
      return o.saving[1] > smallThreshold &&
             o.paybackMid != null && o.paybackMid <= D.rec.pbActionMax;
    });

    /* mention band (unchanged semantics) + excluded */
    var mention = [], excluded = [];
    full.forEach(function (o) {
      if (o.paybackMid != null && o.paybackMid <= D.rec.pbMentionMax) mention.push(o);
      else excluded.push(o);
    });

    var ctrl = (D.rank.controllablePrimaries || []).indexOf(primaryId) !== -1;
    var branch, lead, longPb = false;

    if (trueOptimal || candidates.length === 0) {
      /* -- ACTION LANE [owner P4]: a real, purchasable next step. NEVER behåll. -- */
      if (inputs.hasSolar)          { branch = 'optimeraBatteri';  lead = { type: 'action', id: 'batteri'  }; }
      else if (inputs.solarPlanned) { branch = 'optimeraSolplan';  lead = { type: 'action', id: 'solplan'  }; }
      else if (ctrl)                { branch = 'optimeraStyrning'; lead = { type: 'action', id: 'styrning' }; }
      else                          { branch = 'optimeraService';  lead = { type: 'action', id: 'service'  }; }
    } else {
      /* -- PUMP LANE: honest best tradeoff -- */
      var pool = candidates.slice();
      if (inputs.hasWaterborne === true) {          // T7 kept, comfort-gated: a whole-house
        var whole = pool.filter(function (o) {      // pump outranks a complement ONLY when
          return o.kind !== 'complement' && o.paybackMid <= D.rec.pbComfort;   // it clears
        });                                         // the comfort bar
        if (whole.length) pool = whole;
      }
      pool.sort(function (a, b) {
        if (a.paybackMid !== b.paybackMid) return a.paybackMid - b.paybackMid;
        if (a.saving[1] !== b.saving[1])   return b.saving[1] - a.saving[1];
        return a.rangeWidth - b.rangeWidth;
      });
      var L = pool[0];
      lead = { type: 'option', id: L.id };
      longPb = L.paybackMid > D.rec.pbComfort;      // ⇒ verdict states the payback PLAINLY, ★ stays

      branch =
          primaryId === 'franluft'                ? 'uppgradering'   // frånluft = prime upgrade case
        : primaryId === 'luftluftCur'             ? 'heltackning'    // partial coverage → whole house
        : primaryId === 'fjarrvarme'              ? 'fjarrvarmePris' // numbers-carried PRICE framing
        : (primaryId === 'vedpellets' ||
           primaryId === 'kamin')                 ? 'komfortKrona'   // komfort frame + honest kr
        : pumpShare >= D.rec.partialShareMin      ? 'delvisLost'     // residual honesty kept, real lead
        : L.saving[1] < D.rec.leadSavingFloor     ? 'litenBesparing' // wording boundary, not a gate
        : longPb                                  ? 'standardLang'
        :                                           'standard';
    }

    /* add-ons (unchanged logic; no duplicate when the add-on IS the lead) */
    var addOns = [];
    var isWholeHousePump = lead.type === 'option' && D.pumps[lead.id] && !D.pumps[lead.id].isComplement;
    if (inputs.hasSolar && lead.id !== 'batteri') addOns.push('batteri');
    else if (inputs.solarPlanned && lead.id !== 'solplan') addOns.push('batteriPlaneras');
    if (kaminShare > 0 && isWholeHousePump) addOns.push('kaminSpets');
    if (D.rec.merLuftluftEnabled && branch === 'delvisLost') { /* gate unchanged, still OFF [GAP-V7-8] */ }
    if (primaryId === 'olja' || primaryId === 'franluft') addOns.push('endOfLife');
    if (inputs.vetinte) addOns.push('vetinteHedge');
    if (lead.type === 'option' && ctrl) addOns.push('styrning');

    var residual = null;
    if (branch === 'delvisLost') {
      var prim = base.currentBreakdown.filter(function (b) { return b.isPrimary; })[0];
      if (prim) residual = { share: prim.share, annualKr: prim.annual, label: prim.label, id: prim.id };
    }

    mention.sort(function (a, b) { return a.paybackMid - b.paybackMid; });
    return {
      branch: branch, lead: lead, longPb: longPb,
      secondary: mention.filter(function (o) { return o.id !== lead.id; }).slice(0, 2)
                        .map(function (o) { return o.id; }),
      excluded: excluded.map(function (o) { return o.id; }),
      addOns: addOns, residual: residual
    };
  }

  /* =========================================================================
   * AmpyCodec — URL codec (§13.3). One codec, two jobs: share link + ad deep-link.
   *   ?sys=direktel&kmp=kamin.2,luftluft.2&m2=b3&era=e2&vb=0&kwh=18000 (or kr=32000)&se=SE3
   * Params present → answers pre-filled (NOT assumed). NO identity, NO tracking. Ever.
   * ========================================================================= */
  var SYS_TOKEN = {  // token → engine currentSystem id
    direktel: 'direktel', fjarrvarme: 'fjarrvarme', olja: 'olja', vedpellets: 'vedpellets',
    vattenburen: 'vattenburenEl', franluft: 'franluft', kamin: 'kamin',   // M2: kamin can be the PRIMARY too; without a sys-token a kamin-primary share link round-tripped to direktel
    luftluft: 'luftluftCur', luftvatten: 'luftvattenCur', bergvarme: 'bergvarmeCur'
  };
  var SYS_ID = {};   // reverse
  Object.keys(SYS_TOKEN).forEach(function (t) { SYS_ID[SYS_TOKEN[t]] = t; });
  /* V7 (A8): KMP tokens extended to EVERY complement-capable system id.
   * franluft + fjarrvarme stay out (canComplement:false in data.js). */
  var KMP_TOKEN = {
    kamin: 'kamin', luftluft: 'luftluftCur', luftvatten: 'luftvattenCur',
    bergvarme: 'bergvarmeCur', direktel: 'direktel', vattenburen: 'vattenburenEl',
    olja: 'olja', vedpellets: 'vedpellets'
  };
  var KMP_ID = {};
  Object.keys(KMP_TOKEN).forEach(function (t) { KMP_ID[KMP_TOKEN[t]] = t; });

  /* state shape (plain answers, app-agnostic):
   * { sys, comps:[{system, stop}], m2:'b1'..'b4', era:'e1'..'e4'|'x',
   *   kwh:N|null, se:'SE1'..'SE4', sol:null|{mode:'p'}|{mode:'f',kwh:N} }
   * — all nullable. stop = 1..3 in the URL. V7: vb/kr are DECODE-ONLY legacy
   * params (never emitted; the app drops them silently — inference + schablon
   * take over). sol=p (planeras) | sol=f.<kwh> (finns + production). */
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
    if (s.kwh != null) p.push('kwh=' + Math.round(s.kwh));
    if (s.se) p.push('se=' + s.se);
    if (s.sol && s.sol.mode === 'p') p.push('sol=p');
    else if (s.sol && s.sol.mode === 'f') p.push('sol=f.' + Math.round(s.sol.kwh != null ? s.sol.kwh : 0));
    return p.join('&');
  }

  function decodeState(search) {
    var out = { sys: null, comps: [], m2: null, era: null, vb: null, kwh: null, kr: null, se: null, sol: null };
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
      else if (k === 'sol') {
        if (v === 'p') out.sol = { mode: 'p' };
        else if (/^f\.\d+$/.test(v)) out.sol = { mode: 'f', kwh: parseInt(v.slice(2), 10) };
      }
    });
    return out;
  }

  /* expose (rankOptions rides on AmpyEngine per the delta; codec on its own handle) */
  if (global.AmpyEngine) global.AmpyEngine.rankOptions = rankOptions;
  global.AmpyRank = { rankOptions: rankOptions, recommend: recommend, costSplit: costSplit, netInvestRange: netInvestRange };
  global.AmpyCodec = { encode: encodeState, decode: decodeState };

})(typeof window !== 'undefined' ? window : this);
