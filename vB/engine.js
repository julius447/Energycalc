/* =============================================================================
 * engine.js — Ampy energikalkylatorn (SHARED multi-system engine for vB + vC)
 * PURE CALCULATION. No DOM. No hardcoded numbers (everything comes from D = AMPY_DATA).
 * Same inputs + same D  ->  same outputs. Rounding happens ONLY in the renderer.
 *
 * The single guarantee this file exists to make:
 *   hero kr/år  ===  currentAnnual − pumpAnnual  ===  (sum of the curve gaps).
 * The chart in app.js plots monthly COST (kr); its endpoint math is THIS file's math.
 *
 * V3 (MASTER-SPEC-V3 §1.2) — models the REAL current state:
 *   - a PRIMARY current system (single) + optional COMPLEMENTS (multi, coverage share);
 *   - the primary holds the RESIDUAL share (1 − Σ complements), floored at primaryFloor;
 *   - a typed actual-annual kWh/cost OVERRIDE that supersedes all estimates;
 *   - the honest current cost is the BLENDED total across the stack;
 *   - saving = blended current cost − each pump option;
 *   - an honest already-efficient / no-saving branch (efficientFlag / noSaving).
 *
 * REGRESSION SAFETY (MASTER-SPEC-V3 §1.2): empty complements + legacy annualKwh ⇒
 *   stack = [{primary, cov:1}] ⇒ byte-identical output to the root single-system engine.
 *
 * CANDOUR (encoded, not decorative):
 *   - heroSaving is computed with NO stödtjänster and NO effektavgift line added.
 *   - net invest uses ROT 30 % on labour schablon (D.rotRate), never grön teknik.
 *   - solar/battery/EV upside is returned in `results.upside`, kept OUT of heroSaving.
 *   - luft-luft saving is capped to its served share (pump.servedShare).
 *   - complement coverage NEVER changes how much heat exists; it only splits who pays.
 *   - a typed real bill is NEVER silently changed (pinSumTo to the typed annual).
 * ========================================================================== */

(function (global) {
  'use strict';

  /* ---- small helpers (pure) ---- */
  function sum(arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i]; return s; }
  function normalise(arr) {                 // returns a copy that SUMS to 1 (a distribution)
    var t = sum(arr); if (t === 0) return arr.map(function () { return 0; });
    return arr.map(function (v) { return v / t; });
  }
  function meanNormalise(arr) {              // returns a copy whose MEAN is 1 (a multiplier)
    var m = sum(arr) / arr.length; if (m === 0) return arr.map(function () { return 0; });
    return arr.map(function (v) { return v / m; });
  }
  function clamp0(x) { return x < 0 ? 0 : x; }
  function isFinitePos(x) { return typeof x === 'number' && isFinite(x) && x > 0; }

  /* clampSum: cap the complement coverage array so its TOTAL ≤ maxTotal.
   * Scales the whole vector down proportionally when it would exceed the cap, so the
   * relative weights between complements are preserved. Guarantees the primary keeps
   * its floor share (no zero-weight primary → no division by zero). */
  function clampSum(covs, maxTotal) {
    var total = sum(covs);
    if (total <= maxTotal || total === 0) return covs.slice();
    var k = maxTotal / total;
    return covs.map(function (v) { return v * k; });
  }

  /* pinSumTo: scale a positive array so it sums EXACTLY to target, then put any
   * rounding residual on the largest element, clamped ≥0. Used by the cost-override
   * so the user's real annual bill is honoured to the krona (never silently changed). */
  function pinSumTo(arr, target) {
    var t = sum(arr);
    if (t <= 0) {
      // degenerate: distribute the target evenly so the curve is at least plausible
      var n = arr.length, even = target / n;
      return arr.map(function () { return clamp0(even); });
    }
    var k = target / t;
    var out = arr.map(function (v) { return clamp0(v * k); });
    // correct the residual on the largest month
    var residual = target - sum(out);
    if (residual !== 0) {
      var maxIdx = 0; for (var i = 1; i < out.length; i++) if (out[i] > out[maxIdx]) maxIdx = i;
      out[maxIdx] = clamp0(out[maxIdx] + residual);
    }
    return out;
  }

  /* =========================================================================
   * calculate(inputs, D) -> results
   *
   * inputs (all optional except the N1 inputs, which default in app.js):
   *   V3 current-state model:
   *     current: {
   *       primary:     '<currentSystem id>',          // single, defaulted
   *       complements: [ { system:'<id≠primary>', coverage:0..1 }, ... ],  // 0..N
   *       actual:      { mode:'kwh'|'cost'|null, kwh:Number|null, cost:Number|null }
   *     }
   *   Legacy (still accepted; shimmed): currentSystem (string), annualKwh (Number).
   *   Shared: area, priceArea, occupants, era, indoorTemp, distribution, pump,
   *           hasWaterborne, dso, hasSolar.
   * D = window.AMPY_DATA
   * ========================================================================= */
  function calculate(inputs, D) {
    inputs = inputs || {};

    /* =====================================================================
     * (0) BACK-COMPAT SHIM (regression safety) — build inputs.current from the
     *     legacy flat fields when the new model is absent. Empty complements +
     *     legacy annualKwh ⇒ byte-identical to the root single-system engine.
     * ===================================================================== */
    var current = inputs.current;
    var legacyShim = false; // true when current was reconstructed from the flat legacy fields
    if (!current || typeof current !== 'object') {
      legacyShim = true;
      current = {
        primary: (typeof inputs.currentSystem === 'string') ? inputs.currentSystem : null,
        complements: [],
        actual: {
          mode: (inputs.annualKwh != null && inputs.annualKwh > 0) ? 'kwh' : null,
          kwh:  (inputs.annualKwh != null && inputs.annualKwh > 0) ? inputs.annualKwh : null,
          cost: null
        }
      };
    }
    var actual = current.actual || { mode: null, kwh: null, cost: null };

    /* ---- resolve inputs to data records (with defaults) ---- */
    var primaryId = current.primary || D.defaultCurrentSystem;
    var cur  = D.currentSystems[primaryId] || D.currentSystems[D.defaultCurrentSystem];
    primaryId = cur.id; // canonical (in case of an unknown id falling back to default)
    var pump = D.pumps[inputs.pump] || D.pumps[D.defaultPump];
    var pa   = D.priceAreas[inputs.priceArea] || D.priceAreas[D.defaultPriceArea];
    var zone = D.zoneFactor[pa.id] || D.zoneFactor.SE3;
    var fram = D.framledning[inputs.distribution] != null
             ? D.framledning[inputs.distribution]
             : D.framledning[D.defaultDistribution];

    var area      = inputs.area      != null ? inputs.area      : 150;
    var occupants = inputs.occupants != null ? inputs.occupants : D.defaultOccupants;
    var era       = inputs.era       || D.defaultEra;
    var indoorT   = inputs.indoorTemp!= null ? inputs.indoorTemp : D.defaultIndoorTemp;

    /* ---- resolve the OVERRIDE (most-accurate path) ---- */
    var multi   = D.multi || {};
    var ovrKwh  = (actual.mode === 'kwh'  && isFinitePos(actual.kwh))  ? actual.kwh  : null;
    var ovrCost = (actual.mode === 'cost' && isFinitePos(actual.cost)) ? actual.cost : null;
    // legacy single-system kWh path stays exactly as before (electric-stack only).
    var annualKwh = (ovrKwh != null) ? ovrKwh : null;

    /* =====================================================================
     * (1) BUILD THE SYSTEM STACK (primary residual + complements).
     *     Coverage splits WHO pays for each month's heat; it never changes how
     *     much heat exists. The primary holds 1 − Σ(complements), floored.
     * ===================================================================== */
    var rawComps = Array.isArray(current.complements) ? current.complements : [];
    var comps = [];
    for (var ci = 0; ci < rawComps.length; ci++) {
      var rc = rawComps[ci]; if (!rc || !rc.system) continue;
      if (rc.system === primaryId) continue;                 // a complement can't equal the primary
      if (!D.currentSystems[rc.system]) continue;            // unknown id → drop
      var cov = (rc.coverage != null) ? rc.coverage
              : (multi.defaultCoverage && multi.defaultCoverage[rc.system] != null
                   ? multi.defaultCoverage[rc.system]
                   : (multi.defaultCoverageFallback != null ? multi.defaultCoverageFallback : 0.40));
      var wasAssumed = (rc.coverage == null);                // default vs user-set
      comps.push({ system: rc.system, coverage: clamp0(cov), assumed: wasAssumed });
    }
    var primaryFloor = (multi.primaryFloor != null) ? multi.primaryFloor : 0.30;
    var maxCompTotal = 1 - primaryFloor;
    var compSumRaw   = sum(comps.map(function (c) { return c.coverage; }));
    var clamped      = clampSum(comps.map(function (c) { return c.coverage; }), maxCompTotal);
    var compClamped  = compSumRaw > maxCompTotal;
    var primaryCov   = clamp0(1 - sum(clamped));
    if (primaryCov < primaryFloor) primaryCov = primaryFloor; // belt-and-braces floor

    var stack = [{ sys: primaryId, cov: primaryCov, assumed: false, isPrimary: true }];
    for (var si = 0; si < comps.length; si++) {
      stack.push({ sys: comps[si].system, cov: clamped[si], assumed: comps[si].assumed, isPrimary: false });
    }
    var isMultiSystem = comps.length > 0;

    /* whole-stack electric? (governs the household-strip on the kWh override) */
    var stackAllElectric = true;
    for (var se = 0; se < stack.length; se++) {
      if (!D.currentSystems[stack[se].sys].isElectric) { stackAllElectric = false; break; }
    }

    /* =====================================================================
     * (2) normalised monthly shapes (sum-to-1) — UNCHANGED.
     * ===================================================================== */
    var ddShape   = normalise(D.ddShape[pa.id] || D.ddShape.SE3); // SE1/2/4 fall back to SE3 [GAP-R3-4]
    var ddSE3     = normalise(D.ddShape.SE3);                      // used for the air-source winter sag
    var vvShape   = normalise(D.vvShape);
    var priceNorm = meanNormalise(D.priceShape);                  // MEAN = 1 (price multiplier; annual avg = marginalPrice)

    /* =====================================================================
     * (3) HEAT-DEMAND ENGINE — house to underlying kWh of heat (space + VV).
     *     UNCHANGED schablon spine; the kWh-override strips household exactly as root.
     * ===================================================================== */
    var vv = D.vvPerPerson * occupants;                 // occupant-driven hot water

    // estimate (schablon) combined demand — also the cost-override back-solve baseline
    var intensity = D.intensityByEra[era] != null ? D.intensityByEra[era] : D.intensityByEra[D.defaultEra];
    var tempAdj   = 1 + D.tempSensitivity * (indoorT - D.defaultIndoorTemp);
    var schablonCombined = intensity * area * zone.demand * tempAdj
                         + D.vvPerPerson * (occupants - D.defaultOccupants);

    var combined; // combined heating+VV demand the pump must deliver
    var demandMeasured = false; // true once the heat energy is MEASURED via the typed override
    // collapseBand: the NEW "watch the ± band collapse when you type real data" feature.
    // Gated to the explicit new override model only, so the LEGACY annualKwh path stays
    // byte-identical to the root engine (which keeps the demand spread on a typed kWh).
    var collapseBand = false;

    if (annualKwh != null && stackAllElectric) {
      // whole-house electric bill typed: strip household electricity, keep heat+VV.
      // (Legacy single-system electric path — preserved verbatim.)
      combined = clamp0(annualKwh - D.household);
      demandMeasured = true;
      collapseBand = !legacyShim; // only the new model collapses; legacy keeps root behaviour
    } else if (ovrKwh != null) {
      // mixed/non-electric stack typed kWh: treat as delivered heat energy (no household strip).
      combined = clamp0(ovrKwh);
      demandMeasured = true;
      collapseBand = !legacyShim;
    } else {
      combined = schablonCombined;
    }

    var vvEff = Math.min(vv, combined);       // M1: hot water can never exceed the (typed) total
    var spaceHeat = clamp0(combined - vvEff); // heat ex hot water

    /* =====================================================================
     * (4) MONTHLY HEAT to deliver (kWh) — space heat follows degree-days,
     *     hot water near-flat. This shape draws the februari-stapeln. UNCHANGED.
     * ===================================================================== */
    /* V4 E1 (V4-engine-delta §2): retain the two terms so the rank wrapper can split
     * the blended current COST exactly (story bar + styrning). Additive; no caller breaks. */
    var monthHeat = new Array(12);
    var spaceHeatMonthly = new Array(12), vvMonthly = new Array(12);
    for (var m = 0; m < 12; m++) {
      spaceHeatMonthly[m] = spaceHeat * ddShape[m];
      vvMonthly[m]        = vvEff * vvShape[m];
      monthHeat[m]        = spaceHeatMonthly[m] + vvMonthly[m];
    }

    /* =====================================================================
     * (5) FIELD SPF per month (pump) — bergvärme flat; air-source sags in cold.
     *
     * V7 CHANGE ONE (Defect A, V7-SPEC §1.2): the sag vector is renormalised to
     * SHAPE-ONLY. The old airWinter = 1 − S·dd[m] had a heat-weighted mean of
     * ~0,827, so every air pump ran ~17–21 % worse than its signed field SPF —
     * a double count (field SPF is already an ANNUAL average) that stretched
     * every payback (a direct cause of both R7 absurdities). Now the
     * heat-weighted annual mean of the sag vector is EXACTLY 1,0: the
     * februari-sag stays visible, the annual SPF equals the signed field value.
     * [GAP-E7-1 → energiexpert signs that field-SPF is treated as annual.]
     * ===================================================================== */
    var airSagMean = 0;
    for (var msag = 0; msag < 12; msag++) {
      airSagMean += ddSE3[msag] * (1 - D.airSagStrength * ddSE3[msag]); // heat-weighted mean = 1 − S·Σdd²
    }
    if (!(airSagMean > 0)) airSagMean = 1; // degenerate guard (never binds on the SE3 vector)
    function airWinterAt(i) {
      var aw = (1 - D.airSagStrength * ddSE3[i]) / airSagMean; // heat-weighted annual mean EXACTLY 1,0
      if (aw < 0.2) aw = 0.2; // existing floor kept (post-normalisation; QA asserts it never binds at S=1,4/SE3)
      return aw;
    }
    function spfSeries(spfBase) {
      var s = new Array(12);
      for (var i = 0; i < 12; i++) {
        if (pump.isGround) {
          s[i] = spfBase * fram;                              // flat across the year
        } else {
          s[i] = spfBase * fram * zone.airSpf * airWinterAt(i);
        }
      }
      return s;
    }
    var SPFeff = spfSeries(pump.spf);

    /* =====================================================================
     * (6) MONTHLY PRICE (kr/kWh) — winter costs more. Mean across the year
     *     equals marginalPriceSE3 × area-factor (priceNorm has mean 1). UNCHANGED.
     * ===================================================================== */
    var price = new Array(12);
    for (var p = 0; p < 12; p++) {
      price[p] = D.marginalPriceSE3 * pa.factor * priceNorm[p];
    }

    /* helper: fuel price for a non-electric current system (kr/kWh delivered heat).
     * Falls back to marginal el price × area factor (the root behaviour) when absent. */
    function fuelPriceFor(rec) {
      var fp = D.fuelPrice[rec.id];
      return (fp != null) ? fp : D.marginalPriceSE3 * pa.factor;
    }

    /* blended current cost for a given monthHeat array, with optional demand
     * multiplier (the ± band scales demand uniformly). Returns cost[12] + breakdown.
     * The single-system stack [{primary,cov:1}] reduces EXACTLY to the root math. */
    function blendCurrentCost(mh, demandMult) {
      var dm = (demandMult == null) ? 1 : demandMult;
      var cc = new Array(12); for (var z = 0; z < 12; z++) cc[z] = 0;
      var breakdown = [];
      for (var s = 0; s < stack.length; s++) {
        var st = stack[s];
        var rec = D.currentSystems[st.sys];
        var sysMonthly = new Array(12);
        for (var mm = 0; mm < 12; mm++) {
          var heatShare = mh[mm] * st.cov * dm;
          if (rec.isElectric) sysMonthly[mm] = (heatShare / rec.efficiency) * price[mm];
          else                sysMonthly[mm] = heatShare * fuelPriceFor(rec);
          cc[mm] += sysMonthly[mm];
        }
        breakdown.push({
          id: rec.id, label: rec.label, share: st.cov,
          monthly: sysMonthly, annual: sum(sysMonthly),
          isPrimary: st.isPrimary, isElectric: rec.isElectric, isAssumed: st.assumed
        });
      }
      return { cost: cc, breakdown: breakdown };
    }

    /* V7 CHANGE TWO (L6, V7-SPEC §1.3) — solar self-consumption offset helper.
     * Lowers the CURRENT side's ELECTRIC cost by the self-consumed share of the
     * user's stated production, month-shaped (R4 §1.1 Otovo, normalised), capped
     * per month at that month's electric cost (winter barely moves, December ≈ 0).
     * Fuel members untouched. Surplus/export is NEVER folded in (60-öre abolished
     * 2026, [FACT] foretagsdata §6.4). Uses the engine's own price[m] (one price
     * truth). selfUseShare 0,30 [GAP-E7-6]. Gated OFF when demand is MEASURED —
     * a typed kWh/bill already nets self-consumed solar (double-deduction guard).
     * `solarActive` is resolved AFTER the override step; every call site below it. */
    var solarActive = false, solShapeN = null;
    function applySolarOffsetTo(costArr, breakdownArr) {
      if (!solarActive) return 0;
      var selfUseKwh = inputs.solarKwh * D.solar.selfUseShare;
      var applied = 0;
      for (var sm2 = 0; sm2 < 12; sm2++) {
        var elCostM = 0, bi2;
        for (bi2 = 0; bi2 < breakdownArr.length; bi2++) {
          if (breakdownArr[bi2].isElectric) elCostM += breakdownArr[bi2].monthly[sm2];
        }
        var offset = selfUseKwh * solShapeN[sm2] * price[sm2];
        if (offset > elCostM) offset = elCostM;            // capped: never below zero, fuel untouched
        if (offset <= 0) continue;
        costArr[sm2] = clamp0(costArr[sm2] - offset);
        if (elCostM > 0) {
          // subtract proportionally from the electric members so the story-bar
          // member lines stay consistent with the total
          for (bi2 = 0; bi2 < breakdownArr.length; bi2++) {
            var bm = breakdownArr[bi2];
            if (bm.isElectric) bm.monthly[sm2] = clamp0(bm.monthly[sm2] - offset * (bm.monthly[sm2] / elCostM));
          }
        }
        applied += offset;
      }
      if (applied > 0) {
        for (var ba = 0; ba < breakdownArr.length; ba++) breakdownArr[ba].annual = sum(breakdownArr[ba].monthly);
      }
      return applied;
    }

    /* =====================================================================
     * (7) BLENDED CURRENT MONTHLY COST (the NEW heart).
     * ===================================================================== */
    var blended = blendCurrentCost(monthHeat, 1);
    var currentCost = blended.cost;
    var currentBreakdown = blended.breakdown;

    /* =====================================================================
     * (8) COST OVERRIDE (universal — the honest path for fjärrvärme/olja/ved who
     *     know kr not kWh). Scale the demand spine so the schablon-priced blend
     *     matches the typed bill, re-blend (so a kamin-heavy winter still looks
     *     different across months), then PIN the annual to the typed number so the
     *     real bill is never silently changed.
     * ===================================================================== */
    /* V4 E2 (V4-engine-delta §2, OPTIONAL, flag-gated [GAP-V4-11]): when the typed kr
     * is the WHOLE electric bill (actual.includesHousehold === true) on an all-electric
     * stack, strip the household schablon before the back-solve. Flag absent (all existing
     * callers) ⇒ byte-identical to vB. The strip is surfaced in ctx (shown, never silent).
     * Mixed/fuel stacks: never strip (different invoices; app-layer copy owns the framing). */
    var householdCostStripped = null;
    if (ovrCost != null && actual.includesHousehold === true && stackAllElectric) {
      var householdCostE2 = D.household * D.marginalPriceSE3 * pa.factor;
      ovrCost = clamp0(ovrCost - householdCostE2);
      householdCostStripped = householdCostE2;
    }

    if (ovrCost != null) {
      var schVvEff = Math.min(vv, schablonCombined);
      var schSpace = clamp0(schablonCombined - schVvEff);
      var schMonthHeat = new Array(12);
      for (var sm = 0; sm < 12; sm++) schMonthHeat[sm] = schSpace * ddShape[sm] + schVvEff * vvShape[sm];
      var estCost = sum(blendCurrentCost(schMonthHeat, 1).cost);
      var demandScale = (estCost > 0) ? (ovrCost / estCost) : 1;

      combined = clamp0(schablonCombined * demandScale);
      vvEff = Math.min(vv, combined);
      spaceHeat = clamp0(combined - vvEff);
      /* V4 E1: keep the two terms in sync where monthHeat is REBUILT (delta §2 E1). */
      for (var rm = 0; rm < 12; rm++) {
        spaceHeatMonthly[rm] = spaceHeat * ddShape[rm];
        vvMonthly[rm]        = vvEff * vvShape[rm];
        monthHeat[rm]        = spaceHeatMonthly[rm] + vvMonthly[rm];
      }

      blended = blendCurrentCost(monthHeat, 1);
      currentCost = pinSumTo(blended.cost, ovrCost); // curve SHAPE from the blend, SUM from the user
      currentBreakdown = blended.breakdown;
      demandMeasured = true;
      collapseBand = true; // cost override exists only in the new model
      SPFeff = spfSeries(pump.spf); // re-affirm against the rebuilt monthHeat (no-op, kept explicit)
    }

    /* V7 CHANGE TWO — apply the solar offset to the CURRENT side (post-override,
     * pre-annuals). demandMeasured is final here, so the double-deduction guard holds. */
    solarActive = isFinitePos(inputs.solarKwh) && !demandMeasured;
    if (solarActive) solShapeN = normalise(D.solar.monthShape);
    var solarOffsetAnnual = applySolarOffsetTo(currentCost, currentBreakdown);

    /* =====================================================================
     * (9) PUMP MONTHLY COST — field SPF, winter sag. luft-luft served-share cap
     *     blends BACK toward the BLENDED currentCost (automatically correct). UNCHANGED logic.
     * ===================================================================== */
    var pumpCost = new Array(12);
    for (var c = 0; c < 12; c++) {
      pumpCost[c] = (monthHeat[c] / SPFeff[c]) * price[c];
    }
    var servedShare = pump.servedShare != null ? pump.servedShare : 1.0;
    if (pump.isComplement && servedShare < 1.0) {
      for (var k = 0; k < 12; k++) {
        pumpCost[k] = pumpCost[k] * servedShare + currentCost[k] * (1 - servedShare);
      }
    }

    /* =====================================================================
     * (10) ANNUALS + the hero (at stödtjänster=0 AND effektavgift=0 — none added)
     * ===================================================================== */
    var currentAnnual = sum(currentCost);
    var pumpAnnual    = sum(pumpCost);
    var heroSaving    = currentAnnual - pumpAnnual;

    /* =====================================================================
     * (11) INVESTMENT — ROT 30 % on labour schablon, NEVER grön teknik. UNCHANGED.
     * ===================================================================== */
    var hasWaterborne = inputs.hasWaterborne;
    var gross = pump.gross;
    if (pump.requiresWaterborne && hasWaterborne === false && pump.grossNoWaterborne != null) {
      gross = pump.grossNoWaterborne; // direktel house must add the waterborne system
    }
    var rotRaw = gross * pump.laborShare * D.rotRate;
    var rot    = Math.min(rotRaw, D.rotCapPerPerson);
    var net    = gross - rot;

    function payback(saving) { return saving > 0 ? net / saving : null; }
    var paybackMid = payback(heroSaving);

    /* =====================================================================
     * (12) ± BAND — recompute the hero at the SPF range ends AND demand ±spread.
     *      Reads the BLENDED baseline. When demand is MEASURED (kWh or cost
     *      override), the current-side demand spread collapses to 0.
     * ===================================================================== */
    var sp = collapseBand ? 0 : D.demandSpread;

    function annualCurrentCostFor(demandMult) {
      // when the cost was pinned, the current annual is fixed regardless of the band
      if (ovrCost != null) return currentAnnual;
      var bl = blendCurrentCost(monthHeat, demandMult);
      applySolarOffsetTo(bl.cost, bl.breakdown);   // V7: one offset truth across the ± band
      return sum(bl.cost);
    }
    function annualPumpCostFor(spfBase, demandMult) {
      var s = spfSeries(spfBase);
      var blendC = null;
      if (pump.isComplement && servedShare < 1.0) {
        var blc = blendCurrentCost(monthHeat, demandMult);
        applySolarOffsetTo(blc.cost, blc.breakdown); // V7: complement blends back toward the post-solar cost
        blendC = blc.cost;
      }
      var tot = 0;
      for (var i = 0; i < 12; i++) {
        var pc = (monthHeat[i] * demandMult / s[i]) * price[i];
        if (blendC) pc = pc * servedShare + blendC[i] * (1 - servedShare);
        tot += pc;
      }
      return tot;
    }
    // Low band: low SPF + low demand → smallest saving; High band: high SPF + high demand.
    var heroLow  = annualCurrentCostFor(1 - sp) - annualPumpCostFor(pump.spfRange[0], 1 - sp);
    var heroHigh = annualCurrentCostFor(1 + sp) - annualPumpCostFor(pump.spfRange[1], 1 + sp);
    if (heroLow > heroHigh) { var tmp = heroLow; heroLow = heroHigh; heroHigh = tmp; } // guarantee order
    var paybackLow  = payback(heroHigh); // shortest payback at the largest saving
    var paybackHigh = payback(heroLow);  // longest payback at the smallest saving

    /* ---- per-month confidence ribbon (widens Nov–Feb where air SPF sags) ---- */
    var pumpCostLow = new Array(12), pumpCostHigh = new Array(12);
    var sLow = spfSeries(pump.spfRange[0]), sHigh = spfSeries(pump.spfRange[1]);
    for (var b = 0; b < 12; b++) {
      var lo = (monthHeat[b] * (1 + sp) / sLow[b]) * price[b];  // worst case month cost
      var hi = (monthHeat[b] * (1 - sp) / sHigh[b]) * price[b]; // best case month cost
      if (pump.isComplement && servedShare < 1.0) {
        lo = lo * servedShare + currentCost[b] * (1 - servedShare);
        hi = hi * servedShare + currentCost[b] * (1 - servedShare);
      }
      pumpCostHigh[b] = lo; // higher cost = upper edge of the ribbon
      pumpCostLow[b]  = hi; // lower cost = lower edge
    }

    /* =====================================================================
     * (13) SYSTEM COMPARISON — annual cost for each pump + current (blended).
     *      Current row uses the BLENDED currentAnnual; the chosen pump's
     *      comparison annual === pumpAnnual.
     * ===================================================================== */
    function currentLabel() { return isMultiSystem ? (cur.label + ' (blandat)') : cur.label; }

    var comparison = [];
    comparison.push({ id: 'current', label: currentLabel(), annual: currentAnnual, isCurrent: true, isBlended: isMultiSystem });
    Object.keys(D.pumps).forEach(function (pid) {
      var puRec = D.pumps[pid];
      var tot = 0;
      var localServed = puRec.servedShare != null ? puRec.servedShare : 1.0;
      for (var i = 0; i < 12; i++) {
        var localSpf;
        if (puRec.isGround) {
          localSpf = puRec.spf * fram;
        } else {
          // V7: same renormalised sag as spfSeries — keeps the stated invariant
          // (the chosen pump's comparison annual === pumpAnnual) intact post-Defect-A.
          localSpf = puRec.spf * fram * zone.airSpf * airWinterAt(i);
        }
        var pc = (monthHeat[i] / localSpf) * price[i];
        if (puRec.isComplement && localServed < 1.0) {
          pc = pc * localServed + currentCost[i] * (1 - localServed);
        }
        tot += pc;
      }
      comparison.push({ id: pid, label: puRec.label, annual: tot, isCurrent: false, isChosen: pid === pump.id });
    });

    /* =====================================================================
     * (14) UPSIDE — solar/battery/EV labelled rows. NEVER folded into the hero. UNCHANGED.
     * ===================================================================== */
    var U = D.upsideRates;
    var effCap = U.effectiveCapacityKwh;
    var regionF = (U.regionFactor[pa.id] != null) ? U.regionFactor[pa.id] : 1.0;
    var consumptionForUpside = (annualKwh != null && stackAllElectric) ? annualKwh : combined; // M2
    var dsoBillsEffekt = !!D.dsoEffektavgift[inputs.dso];

    var upside = { hasSolar: !!inputs.hasSolar, dso: inputs.dso || 'vetej', rows: [] };
    if (inputs.hasSolar) {
      upside.rows.push({
        key: 'egenanvandning', tier: 'durable', label: 'Ökad egenanvändning',
        value: effCap * U.egenanvandning * Math.min(1, consumptionForUpside / U.egenanvandningConsumptionRef)
      });
      upside.rows.push({
        key: 'arbitrage', tier: 'durable', label: 'Spotpris-arbitrage',
        value: effCap * U.arbitrage * regionF
      });
    }
    if (dsoBillsEffekt) {
      upside.rows.push({
        key: 'effekttopp', tier: 'effektavgift', label: 'Effekttoppskapning',
        value: effCap * U.effekttopp
      });
    }
    upside.rows.push({
      key: 'stodtjanster', tier: 'atrisk', label: 'Stödtjänster',
      value: effCap * U.stodtjanster, note: 'osäker intäkt, ej i siffran ovan'
    });

    /* =====================================================================
     * (15) CO₂ — placeholder [GAP-CO2]. Sums avoided kWh across the BLENDED stack
     *      (electric members avoid kWh; fuel members do not).
     * ===================================================================== */
    var savedKwh = 0;
    for (var e = 0; e < 12; e++) {
      var curElec = 0;
      for (var s2 = 0; s2 < stack.length; s2++) {
        var rec2 = D.currentSystems[stack[s2].sys];
        if (rec2.isElectric) curElec += (monthHeat[e] * stack[s2].cov) / rec2.efficiency;
      }
      var pumpElec = monthHeat[e] / SPFeff[e];
      savedKwh += clamp0(curElec - pumpElec);
    }
    var co2Tons = (savedKwh * D.co2PerKwhSaved) / 1000;

    /* =====================================================================
     * (16) EFFICIENT / NO-SAVING BRANCH (NEW).
     *      efficientFlag: tiny saving OR the primary is already a heat pump.
     *      noSaving: the pump does not beat the blended current cost at all.
     * ===================================================================== */
    var smallThreshold = (multi.smallSavingThreshold != null) ? multi.smallSavingThreshold : 1500;
    var primaryIsPump = (D.heatPumpCurrentIds || []).indexOf(primaryId) !== -1;
    var noSaving      = heroSaving <= 0;
    var efficientFlag = noSaving || (heroSaving <= smallThreshold) || primaryIsPump;

    /* =====================================================================
     * RESULTS — raw numbers; the renderer rounds + formats.
     * ===================================================================== */
    return {
      // resolved context (for the renderer's labels/footnotes)
      ctx: {
        currentLabel: cur.label, currentDisplayLabel: currentLabel(),
        currentIsPrice: !!cur.isPrice, currentIsElectric: cur.isElectric,
        primaryId: primaryId, primaryShare: primaryCov,
        isMultiSystem: isMultiSystem, complementClamped: compClamped, primaryFloor: primaryFloor,
        pumpLabel: pump.label, pumpId: pump.id, pumpIsComplement: !!pump.isComplement,
        servedShare: servedShare, priceArea: pa.id, era: era,
        gross: gross, rot: rot, net: net, rotRate: D.rotRate, laborShare: pump.laborShare,
        spfBase: pump.spf, spfRange: pump.spfRange.slice(), isGround: !!pump.isGround,
        usedTypedKwh: !!(annualKwh != null && stackAllElectric),
        overrideMode: ovrCost != null ? 'cost' : (ovrKwh != null ? 'kwh' : null),
        demandMeasured: demandMeasured,
        solarApplied: solarActive,                     // V7: offset live on this run
        solarKwh: solarActive ? inputs.solarKwh : null, // V7: the production the offset used
        footprintFlag: pump.footprintFlag || null,
        householdCostStripped: householdCostStripped   // V4 E2: shown by the renderer, never silent
      },
      // demand
      combined: combined, spaceHeat: spaceHeat, vv: vv,
      // monthly series (kr) — the chart
      monthHeat: monthHeat, currentCost: currentCost, pumpCost: pumpCost,
      // V4 E1 (additive): the two terms of monthHeat, for the exact cost split
      spaceHeatMonthly: spaceHeatMonthly, vvMonthly: vvMonthly,
      pumpCostLow: pumpCostLow, pumpCostHigh: pumpCostHigh, SPFeff: SPFeff, price: price,
      // the blended current-state split (WOW-1 stacked area + the readout)
      currentBreakdown: currentBreakdown,
      // annuals + hero
      currentAnnual: currentAnnual, pumpAnnual: pumpAnnual,
      heroSaving: heroSaving, heroLow: heroLow, heroHigh: heroHigh,
      // payback (range)
      payback: paybackMid, paybackLow: paybackLow, paybackHigh: paybackHigh,
      // verdict branches
      efficientFlag: efficientFlag, noSaving: noSaving,
      // V7: the applied annual solar offset (kr) — the sbMix line + method bullet read this
      solarOffsetAnnual: solarOffsetAnnual,
      // support
      comparison: comparison, upside: upside, co2Tons: co2Tons, savedKwh: savedKwh
    };
  }

  /* expose */
  global.AmpyEngine = { calculate: calculate };

})(typeof window !== 'undefined' ? window : this);
