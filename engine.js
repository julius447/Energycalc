/* =============================================================================
 * engine.js — Ampy energikalkylatorn, variant B (RÄKNINGSCHOCKEN)
 * PURE CALCULATION. No DOM. No hardcoded numbers (everything comes from D = AMPY_DATA).
 * Same inputs + same D  ->  same outputs. Rounding happens ONLY in the renderer.
 *
 * The single guarantee this file exists to make:
 *   hero kr/år  ===  currentAnnual − pumpAnnual  ===  (sum of the curve gaps).
 * The chart in app.js plots monthly COST (kr); its endpoint math is THIS file's math.
 *
 * CANDOUR (encoded, not decorative):
 *   - heroSaving is computed with NO stödtjänster and NO effektavgift line added.
 *   - net invest uses ROT 30 % on labour schablon (D.rotRate), never grön teknik.
 *   - solar/battery/EV upside is returned in `results.upside`, kept OUT of heroSaving.
 *   - luft-luft saving is capped to its served share (pump.servedShare).
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

  /* =========================================================================
   * calculate(inputs, D) -> results
   * inputs (all optional except the 3 N1 inputs, which default in app.js):
   *   currentSystem, area, priceArea, annualKwh, occupants, era, indoorTemp,
   *   distribution, pump, hasWaterborne, dso, hasSolar
   * D = window.AMPY_DATA
   * ========================================================================= */
  function calculate(inputs, D) {
    inputs = inputs || {};

    /* ---- resolve inputs to data records (with defaults) ---- */
    var cur  = D.currentSystems[inputs.currentSystem] || D.currentSystems[D.defaultCurrentSystem];
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
    var annualKwh = (inputs.annualKwh != null && inputs.annualKwh > 0) ? inputs.annualKwh : null;

    /* ---- normalised monthly shapes (sum-to-1) ---- */
    var ddShape   = normalise(D.ddShape[pa.id] || D.ddShape.SE3); // SE1/2/4 fall back to SE3 [GAP-R3-4]
    var ddSE3     = normalise(D.ddShape.SE3);                      // used for the air-source winter sag
    var vvShape   = normalise(D.vvShape);
    var priceNorm = meanNormalise(D.priceShape);                  // MEAN = 1 (a price multiplier; annual avg = marginalPrice)

    /* =====================================================================
     * (1) HEAT-DEMAND ENGINE — from house to underlying kWh of heat the pump
     *     must deliver (space heating + hot water).
     * ===================================================================== */
    var vv = D.vvPerPerson * occupants;                 // occupant-driven hot water

    var combined; // combined heating+VV demand the pump must deliver
    if (annualKwh && cur.isElectric) {
      // user typed a whole-house electric bill: strip household electricity, keep heat+VV
      combined = clamp0(annualKwh - D.household);
    } else {
      // schablon: intensity already includes VV for a baseline-2 home; correct around 2 occupants
      var intensity = D.intensityByEra[era] != null ? D.intensityByEra[era] : D.intensityByEra[D.defaultEra];
      var tempAdj   = 1 + D.tempSensitivity * (indoorT - D.defaultIndoorTemp);
      combined = intensity * area * zone.demand * tempAdj;
      // refine the hot-water term around the baseline-2 the intensity assumed
      var occAdj = D.vvPerPerson * (occupants - D.defaultOccupants);
      combined = combined + occAdj;
    }

    var vvEff = Math.min(vv, combined);      // M1: hot water can never exceed the (typed) total
    var spaceHeat = clamp0(combined - vvEff); // heat ex hot water

    /* =====================================================================
     * (2) MONTHLY HEAT to deliver (kWh) — space heat follows degree-days,
     *     hot water is near-flat. This shape draws the februari-stapeln.
     * ===================================================================== */
    var monthHeat = new Array(12);
    for (var m = 0; m < 12; m++) {
      monthHeat[m] = spaceHeat * ddShape[m] + vvEff * vvShape[m];
    }

    /* =====================================================================
     * (3) FIELD SPF per month — bergvärme flat; air-source sags in deep cold.
     *     SPFeff[m] = base × framledning × (ground? 1 : zoneAirSpf × airWinter[m])
     * ===================================================================== */
    function spfSeries(spfBase) {
      var s = new Array(12);
      for (var i = 0; i < 12; i++) {
        if (pump.isGround) {
          s[i] = spfBase * fram;                              // flat across the year
        } else {
          var airWinter = 1 - D.airSagStrength * ddSE3[i];    // sags where degree-days peak
          if (airWinter < 0.2) airWinter = 0.2;               // floor: COP never below ~ground in model
          s[i] = spfBase * fram * zone.airSpf * airWinter;
        }
      }
      return s;
    }
    var SPFeff = spfSeries(pump.spf);

    /* =====================================================================
     * (4) MONTHLY PRICE (kr/kWh) — winter costs more. Mean across the year
     *     equals marginalPriceSE3 × area-factor (priceNorm has mean 1).
     * ===================================================================== */
    var price = new Array(12);
    for (var p = 0; p < 12; p++) {
      price[p] = D.marginalPriceSE3 * pa.factor * priceNorm[p];
    }

    /* =====================================================================
     * (5) MONTHLY COST — current system vs the chosen pump.
     *     Electric current: heat / efficiency × price. Non-electric: heat × fuelPrice.
     *     Pump: heat / SPFeff × price. (luft-luft served-share cap applied after.)
     * ===================================================================== */
    var currentCost = new Array(12);
    var pumpCost    = new Array(12);
    var fuelP = D.fuelPrice[cur.id];

    for (var c = 0; c < 12; c++) {
      if (cur.isElectric) {
        currentCost[c] = (monthHeat[c] / cur.efficiency) * price[c];
      } else {
        // non-electric path: price by delivered-heat fuel price [GAP-R1-3/R1-6]
        currentCost[c] = monthHeat[c] * (fuelP != null ? fuelP : D.marginalPriceSE3 * pa.factor);
      }
      pumpCost[c] = (monthHeat[c] / SPFeff[c]) * price[c];
    }

    /* ---- luft-luft: cap saving to served area (candour invariant 6) ---------
     * The pump only heats where the air reaches; the unserved share keeps paying
     * the CURRENT system's cost. So blend pumpCost toward currentCost by (1-share). */
    var servedShare = pump.servedShare != null ? pump.servedShare : 1.0;
    if (pump.isComplement && servedShare < 1.0) {
      for (var k = 0; k < 12; k++) {
        pumpCost[k] = pumpCost[k] * servedShare + currentCost[k] * (1 - servedShare);
      }
    }

    /* =====================================================================
     * (6) ANNUALS + the hero (at stödtjänster=0 AND effektavgift=0 — none added)
     * ===================================================================== */
    var currentAnnual = sum(currentCost);
    var pumpAnnual    = sum(pumpCost);
    var heroSaving    = currentAnnual - pumpAnnual;

    /* =====================================================================
     * (7) INVESTMENT — ROT 30 % on labour schablon, NEVER grön teknik.
     *     gross -> ROT (capped per person) -> net. Three lines for the UI.
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
     * (8) ± BAND — recompute the hero at the SPF range ends AND demand ±spread.
     *     Low saving = worst pump (low SPF) + low demand; High = best + high demand.
     * ===================================================================== */
    function annualPumpCostFor(spfBase, demandMult) {
      var s = spfSeries(spfBase);
      var tot = 0;
      for (var i = 0; i < 12; i++) {
        var pc = (monthHeat[i] * demandMult / s[i]) * price[i];
        if (pump.isComplement && servedShare < 1.0) {
          var cc = cur.isElectric
                 ? (monthHeat[i] * demandMult / cur.efficiency) * price[i]
                 : (monthHeat[i] * demandMult) * (fuelP != null ? fuelP : D.marginalPriceSE3 * pa.factor);
          pc = pc * servedShare + cc * (1 - servedShare);
        }
        tot += pc;
      }
      return tot;
    }
    function annualCurrentCostFor(demandMult) {
      var tot = 0;
      for (var i = 0; i < 12; i++) {
        tot += cur.isElectric
          ? (monthHeat[i] * demandMult / cur.efficiency) * price[i]
          : (monthHeat[i] * demandMult) * (fuelP != null ? fuelP : D.marginalPriceSE3 * pa.factor);
      }
      return tot;
    }
    var sp = D.demandSpread;
    // Low band: low SPF (range[0]) + low demand (1-spread) -> smallest saving
    var heroLow  = annualCurrentCostFor(1 - sp) - annualPumpCostFor(pump.spfRange[0], 1 - sp);
    // High band: high SPF (range[1]) + high demand (1+spread) -> largest saving
    var heroHigh = annualCurrentCostFor(1 + sp) - annualPumpCostFor(pump.spfRange[1], 1 + sp);
    if (heroLow > heroHigh) { var t = heroLow; heroLow = heroHigh; heroHigh = t; } // guarantee order
    var paybackLow  = payback(heroHigh); // shortest payback at the largest saving
    var paybackHigh = payback(heroLow);  // longest payback at the smallest saving

    /* ---- per-month confidence ribbon (widens Nov–Feb where air SPF sags) ----
     * For each month, the pump cost at the SPF range ends gives a band; the air
     * winter sag widens it naturally in deep winter. Bergvärme stays tight. */
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
     * (9) 4-SYSTEM COMPARISON — annual cost for each pump + current (N2 support).
     * ===================================================================== */
    var comparison = [];
    comparison.push({ id: 'current', label: cur.label, annual: currentAnnual, isCurrent: true });
    Object.keys(D.pumps).forEach(function (pid) {
      var puRec = D.pumps[pid];
      // recompute annual for this pump using the same month heat + price + zone
      var tot = 0;
      var localServed = puRec.servedShare != null ? puRec.servedShare : 1.0;
      for (var i = 0; i < 12; i++) {
        var localSpf;
        if (puRec.isGround) {
          localSpf = puRec.spf * fram;
        } else {
          var aw = 1 - D.airSagStrength * ddSE3[i]; if (aw < 0.2) aw = 0.2;
          localSpf = puRec.spf * fram * zone.airSpf * aw;
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
     * (10) UPSIDE — solar/battery/EV labelled rows. NEVER folded into the hero.
     *      Gated: solar rows need hasSolar; effekttopp needs a DSO that bills it.
     * ===================================================================== */
    var U = D.upsideRates;
    var effCap = U.effectiveCapacityKwh;
    var regionF = (U.regionFactor[pa.id] != null) ? U.regionFactor[pa.id] : 1.0;
    var consumptionForUpside = (annualKwh && cur.isElectric) ? annualKwh : combined; // M2: only the typed kWh that was actually used
    var dsoBillsEffekt = !!D.dsoEffektavgift[inputs.dso];

    var upside = {
      hasSolar: !!inputs.hasSolar,
      dso: inputs.dso || 'vetej',
      rows: []
    };
    if (inputs.hasSolar) {
      // [durable] ökad egenanvändning (solar-gated)
      upside.rows.push({
        key: 'egenanvandning', tier: 'durable', label: 'Ökad egenanvändning',
        value: effCap * U.egenanvandning * Math.min(1, consumptionForUpside / U.egenanvandningConsumptionRef)
      });
      // [durable] spot-arbitrage (year-round, region-weighted)
      upside.rows.push({
        key: 'arbitrage', tier: 'durable', label: 'Spotpris-arbitrage',
        value: effCap * U.arbitrage * regionF
      });
    }
    if (dsoBillsEffekt) {
      // [om effektavgift] effekttoppskapning — DSO-gated, needs a battery+solar context
      upside.rows.push({
        key: 'effekttopp', tier: 'effektavgift', label: 'Effekttoppskapning',
        value: effCap * U.effekttopp
      });
    }
    // [tillval, osäker] stödtjänster — ALWAYS off the hero; shown as a separate, at-risk row
    upside.rows.push({
      key: 'stodtjanster', tier: 'atrisk', label: 'Stödtjänster',
      value: effCap * U.stodtjanster,
      note: 'osäker intäkt, ej i siffran ovan'
    });

    /* =====================================================================
     * (11) CO₂ — placeholder [GAP-CO2]
     * ===================================================================== */
    var savedKwh = 0;
    for (var e = 0; e < 12; e++) {
      var curElec = cur.isElectric ? monthHeat[e] / cur.efficiency : 0; // only electric current systems avoid kWh
      var pumpElec = monthHeat[e] / SPFeff[e];
      savedKwh += clamp0(curElec - pumpElec);
    }
    var co2Tons = (savedKwh * D.co2PerKwhSaved) / 1000;

    /* =====================================================================
     * RESULTS — raw numbers; the renderer rounds + formats.
     * ===================================================================== */
    return {
      // resolved context (for the renderer's labels/footnotes)
      ctx: {
        currentLabel: cur.label, currentIsPrice: !!cur.isPrice, currentIsElectric: cur.isElectric,
        pumpLabel: pump.label, pumpId: pump.id, pumpIsComplement: !!pump.isComplement,
        servedShare: servedShare, priceArea: pa.id, era: era,
        gross: gross, rot: rot, net: net, rotRate: D.rotRate, laborShare: pump.laborShare,
        spfBase: pump.spf, spfRange: pump.spfRange.slice(), isGround: !!pump.isGround,
        usedTypedKwh: !!(annualKwh && cur.isElectric),
        footprintFlag: pump.footprintFlag || null
      },
      // demand
      combined: combined, spaceHeat: spaceHeat, vv: vv,
      // monthly series (kr) — the chart
      monthHeat: monthHeat, currentCost: currentCost, pumpCost: pumpCost,
      pumpCostLow: pumpCostLow, pumpCostHigh: pumpCostHigh, SPFeff: SPFeff, price: price,
      // annuals + hero
      currentAnnual: currentAnnual, pumpAnnual: pumpAnnual,
      heroSaving: heroSaving, heroLow: heroLow, heroHigh: heroHigh,
      // payback (range)
      payback: paybackMid, paybackLow: paybackLow, paybackHigh: paybackHigh,
      // support
      comparison: comparison, upside: upside, co2Tons: co2Tons, savedKwh: savedKwh
    };
  }

  /* expose */
  global.AmpyEngine = { calculate: calculate };

})(typeof window !== 'undefined' ? window : this);
