/* =============================================================================
 * data.js — Ampy energikalkylatorn, variant B (RÄKNINGSCHOCKEN)
 * THE DATA LAYER. Every coefficient below is sourced from the dossier
 * (B2-research-consolidated.md + R1–R4) or carries a [GAP] tag naming its signer.
 * NO number is invented here. The engine (engine.js) reads ONLY from this object;
 * to swap a research-grade placeholder for a signed number, edit this file alone.
 *
 * CANDOUR CONTRACT encoded in these numbers:
 *  - Hero saving is derived at stödtjänster=0 AND effektavgift=0 (no such line is
 *    ever added to the pump cost). See engine.js heroSaving.
 *  - The pump deduction is ROT 30 % on the labour schablon, NEVER grön teknik.
 *  - SPF values are conservative FIELD SPF, never the energimärkning SCOP.
 *  - Solar/battery rates live in `upsideRates` and feed labelled UPSIDE rows only,
 *    never the hero.
 * Provenance: [FACT]=sourced, [DERIVED]=computed from a sourced method,
 *   [MODEL]=modelling assumption, [GAP-x]=needs owner/expert sign-off.
 * ========================================================================== */

window.AMPY_DATA = {

  /* --- meta / honesty -------------------------------------------------------
   * Surfaced verbatim in the UI so every figure reads as a careful placeholder. */
  meta: {
    // [FACT] candour invariant 7: research-grade placeholders pending sign-off.
    placeholderNote: 'Siffrorna är försiktiga schabloner som väntar på slutlig signering.',
    rounding: { hero: 1000, stat: 500, payback: 0.5 } // round only in the renderer
  },

  /* --- 1. HEAT-DEMAND INTENSITY (kWh/m²·yr), heating + VV combined -----------
   * [FACT] Swedish småhus, stock average 2024 = 90,5 kWh/m². By era below.
   * src: Energimyndigheten energistatistik för småhus (2016 + 2024/2025).
   * NOTE: these are heating+VV combined for a baseline ~2-person home; the engine
   * subtracts VV back out (vvPerPerson*occupants) so occupant hot water is explicit.
   * [GAP-R3-1] firm the era×fuel split from Energimyndigheten PxWeb before printing exact. */
  intensityByEra: {
    pre1940:  125, // [FACT] byggt ≤1940 ≈ 110–125 → conservative high end 125
    midcentury: 110, // [FACT] 1970–1990-tal el-villa ≈ 110
    modern2010: 50,  // [FACT] 2010-tal ≈ 50
    new2021:   39    // [FACT] 2021+ ≈ 39
  },
  // Default era when the user has not chosen one (N2 input, optional).
  defaultEra: 'midcentury', // [MODEL] mid el-villa ~110, conservative middle of the stock

  /* --- 2. FIELD SPF per pump system (verklig årsvärmefaktor) -----------------
   * [FACT] Conservative shippable FIELD SPF (NOT energimärkning SCOP):
   *   luft-luft ~2,5–3,0 · luft-vatten ~2,7–3,2 · bergvärme ~3,0–3,5.
   *   Bergvärme field test anchored 2,7 at the low end (R1 §2); spec §6 lists the
   *   3,0–3,5 band — we ship the conservative POINT and build the ± from the range.
   * src: energimyndigheten.se, polarpumpen.se test pages (R1 §1–§2).
   * [GAP-R1-1] expert signs the single conservative point per system. */
  pumps: {
    luftluft: {
      id: 'luftluft', label: 'Luft-luft',
      spf: 2.5, spfRange: [2.5, 3.0],       // conservative point + ± band
      isGround: false,
      isComplement: true,                    // candour invariant 6: komplement, not whole-house
      servedShare: 0.7,                      // [MODEL] caps modelled saving to served area; [GAP] expert signs
      gross: 30000,                          // [FACT] R2 §1a luft-luft total installerat ~25 000–55 000; conservative ~30 000. [GAP-R2-1]
      laborShare: 0.30,                      // [FACT] R2 §2 schablon arbetskostnad luftpump 30 %
      requiresWaterborne: false
    },
    luftvatten: {
      id: 'luftvatten', label: 'Luft-vatten',
      spf: 2.7, spfRange: [2.7, 3.2],
      isGround: false,
      isComplement: false,
      servedShare: 1.0,
      gross: 130000,                         // [FACT] R2 §1b ~90 000–180 000 (befintligt vattenburet); conservative ~130 000. [GAP-R2-1]
      grossNoWaterborne: 220000,             // [FACT] R2 §1b direktel must add 60 000–120 000 → 150 000–300 000; mid ~220 000. [GAP-R2-1]
      laborShare: 0.30,                      // [FACT] R2 §2 schablon 30 %
      requiresWaterborne: true
    },
    bergvarme: {
      id: 'bergvarme', label: 'Bergvärme',
      spf: 2.9, spfRange: [2.7, 3.2],        // [GAP-R1-1] field anchor 2,7 (Energimyndigheten/SP real-home avg) sets the low end; conservative point 2,9
      isGround: true,                        // SPF flat across the year (ground temp stable, R1 §1c/§2)
      isComplement: false,
      servedShare: 1.0,
      gross: 200000,                         // [FACT] R2 §1c ~150 000–280 000 (befintligt vattenburet); conservative ~200 000. [GAP-R2-1]
      grossNoWaterborne: 290000,             // [FACT] R2 §1c direktel adds ~60 000–120 000. [GAP-R2-1]
      laborShare: 0.35,                      // [FACT] R2 §2 schablon vätska/vatten 35 % (bergvärme ROT-favourable)
      requiresWaterborne: true,
      // [GAP-R2-4] does Ampy install/quote bergvärme in the live footprint? Owner confirm.
      footprintFlag: 'via partner'
    }
  },
  defaultPump: 'luftvatten', // [MODEL] whole-home waterborne comparison is the default vertical

  /* --- 3. FRAMLEDNINGSTEMPERATUR factor (distribution) -----------------------
   * [FACT] Lower supply temp → higher SPF. golvvärme 30–40 °C, radiator 45–50 °C,
   * old högtemp 55–60 °C. → golvvärme ×1,10, radiator ×1,00 (baseline), högtemp ×0,90.
   * src: polarpumpen.se, smarto.se, edenbergsvvs.se (R1 §3).
   * [GAP-R1-5] expert signs the factors. */
  framledning: {
    golvvarme: 1.10,
    radiator:  1.00, // baseline / default
    hogtemp:   0.90
  },
  defaultDistribution: 'radiator', // [MODEL] conservative (lower SPF)

  /* --- 4. MARGINAL ELECTRICITY PRICE (2026) ---------------------------------
   * [FACT] All-in conservative MARGINAL price SE3 ≈ 1,80 kr/kWh (annual), built from
   * spot ~79,6 öre medel + nät överföring, × moms + energiskatt 45,0 öre incl moms.
   * src: elbruk.se, elen.nu, energimarknadsbyran.se (R4 §4 / B2 §4).
   * [GAP-R-price] owner signs the all-in marginal figure + whether to vary by month. */
  marginalPriceSE3: 1.80, // kr/kWh, all-in marginal, annual baseline

  /* --- ELOMRÅDE: price region factor + curve-shape selector -----------------
   * [FACT] Price region factors on the marginal price: SE1 0,80 / SE2 0,90 /
   *   SE3 1,00 / SE4 1,10 (B2 §4). NOTE these differ from the BATTERY arbitrage
   *   region factors (see upsideRates.regionFactor): SE1 0,55 / SE2 0,70 /
   *   SE3 1,00 / SE4 1,55 — two different physical quantities, kept separate. */
  priceAreas: {
    SE1: { id: 'SE1', label: 'SE1', factor: 0.80 },
    SE2: { id: 'SE2', label: 'SE2', factor: 0.90 },
    SE3: { id: 'SE3', label: 'SE3', factor: 1.00 },
    SE4: { id: 'SE4', label: 'SE4', factor: 1.10 }
  },
  defaultPriceArea: 'SE3', // [FACT] live footprint = Stockholm-region = SE3

  /* --- ZONE FACTOR: air-source SPF haircut + demand-per-m² north/south -------
   * [FACT] Air-source SPF haircuts 15–25 % medel→kallt; bergvärme ≈ flat (R1 §2).
   * demand: north runs colder → slightly higher demand-per-m². SE3 = no haircut (1.0).
   * [GAP-R1-2] expert signs the postnr/zon→multiplier mapping. Conservative defaults: */
  zoneFactor: {
    SE1: { demand: 1.15, airSpf: 0.80 }, // coldest: +15 % demand, −20 % air SPF
    SE2: { demand: 1.08, airSpf: 0.88 },
    SE3: { demand: 1.00, airSpf: 1.00 }, // baseline
    SE4: { demand: 0.95, airSpf: 1.05 }  // mildest south: slightly less demand, marginally better air SPF
  },

  /* --- 5. SE3 DEGREE-DAY MONTHLY SHAPE vector (the februari-stapeln) ---------
   * [DERIVED] HDD base 17 °C on Stockholm SMHI 1991–2020 normals; Σ shape = 1,000.
   * Dec–Jan–Feb carry ~46 % of the year's heating → the towering winter.
   * src: smhi.se Energi-Index, sv.wikipedia.org/wiki/Graddagar (B2 §5).
   * [GAP-R3-4] owner signs/replaces the per-elområde vector (one SE3 vector launches).
   * Order: J F M A M J J A S O N D. */
  ddShape: {
    SE3: [0.163, 0.148, 0.140, 0.097, 0.053, 0.013, 0.000, 0.002, 0.039, 0.082, 0.116, 0.147]
    // SE1/SE2/SE4 fast-follow [GAP-R3-4]; engine falls back to SE3 for any missing area.
  },

  /* --- HOT-WATER monthly factor (near-flat, mild summer dip) -----------------
   * [MODEL] incoming water warmer + occupants away in summer. Normalised in engine.
   * src: B2 §5. Order J..D. [GAP] minor; conservative. */
  vvShape: [0.090, 0.090, 0.088, 0.085, 0.080, 0.072, 0.068, 0.070, 0.080, 0.085, 0.090, 0.092],

  /* --- MONTH LABELS (used by the renderer for the curve + verdict copy) ------ */
  months:     ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
  monthsLong: ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'],

  /* --- PRICE monthly SHAPE (winter costs more) ------------------------------
   * [MODEL] spot is higher in winter; this compounds the februari-toppen honestly.
   * Tracks the degree-day pattern but flatter (price never goes to zero in summer).
   * Normalised in engine so the annual mean equals marginalPriceSE3. Order J..D.
   * [GAP-R-price] owner signs whether to vary price by month at all. */
  priceShape: [1.35, 1.35, 1.20, 1.05, 0.85, 0.70, 0.65, 0.68, 0.82, 0.98, 1.15, 1.30],

  /* --- AIR-SOURCE WINTER SAG --------------------------------------------------
   * [INFERENCE] air-source COP collapses in deep cold (luft-vatten COP ≈ 2,73 at
   * −15 °C; approaches 1 in extreme cold — R1 §1b). Modelled as a per-month
   * multiplier on the air SPF, driven by the degree-day shape: airWinter[m] =
   * 1 − sagStrength*ddShape[m]. Bergvärme is exempt (ground temp flat).
   * [GAP-R4-1] expert signs the month-by-month HP draw / HDD weighting. */
  airSagStrength: 1.4, // tuned so deep-winter air SPF sags ~20 % at the Feb peak

  /* --- 6. HOUSEHOLD ELECTRICITY (excluded from the heating comparison) -------
   * [FACT] R3: when the user types a whole-house annual kWh for an ELECTRIC system,
   * subtract a household-electricity baseline so we compare heating, not appliances. */
  household: 5000, // [MODEL] schablon hushållsel kWh/yr; [GAP-R3] owner may refine

  /* --- HOT-WATER per occupant -----------------------------------------------
   * [FACT] occupant-driven hot water ~1 000 kWh/person (R3 §1c). Conservative-high.
   * The intensity tables assume a baseline 2-person home; the engine refines around 2.
   * [GAP-R3-2] owner picks one coefficient (~1 000 vs ~720 measured). */
  vvPerPerson: 1000,
  defaultOccupants: 2,

  /* --- INNETEMP sensitivity --------------------------------------------------
   * [FACT] each +1 °C lifts heat demand a few % (degree-day balance point, R3 §2a).
   * Engine applies (1 + tempSensitivity*(indoorTemp-21)). Default 21 °C. */
  tempSensitivity: 0.04,
  defaultIndoorTemp: 21,

  /* --- CURRENT (replaced) SYSTEM efficiencies --------------------------------
   * [GAP-R1-3] olja/ved/vattenburen el/F-pump need expert-signed points; ranges below.
   * direktel exactly 1,0 (resistive). fjärrvärme is a PRICE comparison, NOT a 3×
   * efficiency claim (candour invariant 8) — flagged isPrice, fuelPrice path.
   * src: R1 §3b. */
  currentSystems: {
    direktel:     { id: 'direktel',     label: 'Direktverkande el', isElectric: true,  efficiency: 1.00 }, // [FACT]
    vattenburenEl:{ id: 'vattenburenEl',label: 'Vattenburen el',    isElectric: true,  efficiency: 0.95 }, // [GAP-R1-3] ~0,95–1,0
    olja:         { id: 'olja',         label: 'Oljepanna',         isElectric: false, efficiency: 0.85 }, // [GAP-R1-3] ~0,75–0,90; non-electric → fuelPrice path
    vedpellets:   { id: 'vedpellets',   label: 'Ved / pellets',     isElectric: false, efficiency: 0.75 }, // [GAP-R1-3] ~0,60–0,85; not electricity
    franluft:     { id: 'franluft',     label: 'Äldre frånluftspump',isElectric: true, efficiency: 2.0 },  // [GAP-R1-3] SPF ~1,5–2,5; treated as electric COP 2,0
    fjarrvarme:   { id: 'fjarrvarme',   label: 'Fjärrvärme',        isElectric: false, efficiency: 1.00, isPrice: true } // [FACT] price comparison, NOT efficiency (R1 §3b)
  },
  defaultCurrentSystem: 'direktel', // [MODEL] paid-first segment; the biggest honest delta

  /* --- FUEL PRICE for non-electric current systems (kr/kWh delivered heat) ---
   * [GAP-R1-3]/[GAP-R1-6] olja/ved/pellets/fjärrvärme price points need owner sign.
   * Placeholder bands (kr/kWh of delivered heat) so the non-electric path computes;
   * flagged so the renderer can footnote "depends on your fjärrvärmepris". */
  fuelPrice: {
    olja:       1.50, // [GAP-R1-3] kr/kWh delivered (oil price / boiler eff)
    vedpellets: 0.80, // [GAP-R1-3] kr/kWh delivered (pellets cheaper, ved variable)
    fjarrvarme: 1.10  // [GAP-R1-6] kr/kWh fjärrvärmepris — PRICE comparison, owner signs framing
  },

  /* --- ROT mechanics ---------------------------------------------------------
   * [FACT] ROT = 30 % of the arbetskostnad-schablon only, cap 50 000 kr/person/yr.
   * Material is never ROT-eligible. Worked: luft-vatten 130 000 → labour 30 % =
   * 39 000 → ROT 11 700 → net 118 300 kr (R2 §2). NEVER grön teknik. */
  rotRate: 0.30,
  rotCapPerPerson: 50000,

  /* --- 7. SOLAR / BATTERY / EV UPSIDE rates (labelled rows, NEVER the hero) --
   * [GAP-R4-4] owner confirms the four per-kWh rates are current + the effective-
   * capacity factor (DoD × round-trip efficiency). src: ampy-foretagsdata §4.2/§6.2.
   * Each row is tagged with its honesty tier so the UI can label it. */
  upsideRates: {
    effectiveCapacityKwh: 7.5,     // [MODEL] ~10 kWh nominal → ~7,5 kWh effective (DoD × round-trip). [GAP-R4-4]
    egenanvandning: 320,           // [durable] kr/kWh/yr, solar-gated, ×min(1,consumption/18000)
    egenanvandningConsumptionRef: 18000,
    arbitrage: 230,                // [durable] kr/kWh/yr × regionFactor
    effekttopp: 150,               // [om effektavgift] kr/kWh/yr, DSO-gated
    stodtjanster: 480,             // [tillval, osäker] kr/kWh/yr — OFF the hero by law (candour invariant 1)
    avoidedRetailPerKwh: 2.00,     // [durable] 1,50–2,50 kr/kWh self-consumed (midpoint)
    // BATTERY arbitrage region factor (distinct from the price region factor above):
    regionFactor: { SE1: 0.55, SE2: 0.70, SE3: 1.00, SE4: 1.55 } // [FACT] R4 §1.3 / foretagsdata §6.2
  },

  /* --- DSO / effektavgift gate -----------------------------------------------
   * [FACT] effektavgift gates the effekttopp upside row ONLY; never the hero.
   * Ellevio removes effektavgift 1 Jun 2026. "vet ej" → effektavgift OFF.
   * [GAP-R4-7] confirm Vattenfall/E.ON effektavgift status. */
  dsoEffektavgift: {
    vetej:      false, // default OFF
    ellevio:    false, // [FACT] removed 1 Jun 2026
    vattenfall: true,  // [GAP-R4-7] confirm
    eon:        true   // [GAP-R4-7] confirm
  },

  /* --- CO2 -------------------------------------------------------------------
   * [GAP] CO₂ figure is a placeholder pending an emissions-factor sign-off.
   * The bildspec shows ≈ −2 ton/år; carried as a placeholder, kgCO2 per saved kWh.
   * [GAP-CO2] owner signs the Swedish marginal-electricity emissions factor. */
  co2PerKwhSaved: 0.10, // [GAP-CO2] kg CO₂ per kWh of electricity avoided (placeholder)

  /* --- DEMAND uncertainty spread (for the ± band) ---------------------------
   * [MODEL] R3 §1d plain-language ±15 % schablon spread (engine recomputes the hero
   * at demand ×0,85 / ×1,15 AND at the SPF range ends). Not a sourced CI ([GAP-R3-3]). */
  demandSpread: 0.15
};
