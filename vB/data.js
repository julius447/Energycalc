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

  /* --- meta ------------------------------------------------------------- */
  meta: {
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
   *   luft-luft ~2,5–3,0 · luft-vatten ~2,5–3,0 (V8: Energimyndighetens test,
   *   årsvärmefaktor "2,5 upp mot 3") · bergvärme fältgenomsnitt 2,7, spann ~2,7–3,2.
   *   Bergvärme field test anchored 2,7 at the low end (R1 §2); spec §6 lists the
   *   3,0–3,5 band — we ship the conservative POINT and build the ± from the range.
   * src: energimyndigheten.se, polarpumpen.se test pages (R1 §1–§2).
   * [GAP-R1-1] expert signs the single conservative point per system. */
  pumps: {
    luftluft: {
      id: 'luftluft', label: 'Luft-luft',
      spf: 2.5, spfRange: [2.5, 3.0],       // point AT band floor = deliberately max-conservative for the komplement device; [GAP-R1-1] expert may symmetrise (e.g. point 2.6 or floor 2.3) — no field source found in the V8 pass
      isGround: false,
      isComplement: true,                    // candour invariant 6: komplement, not whole-house
      servedShare: 0.7,                      // [MODEL] caps modelled saving to served area; [GAP] expert signs
      gross: 30000,                          // [FACT] R2 §1a luft-luft total installerat ~25 000–55 000; conservative ~30 000. V8 corroborated: varmekalkyl.se 2026 ~25 000–55 000 brutto. [GAP-R2-1]
      laborShare: 0.30,                      // [FACT] R2 §2 schablon arbetskostnad luftpump 30 %
      requiresWaterborne: false
    },
    luftvatten: {
      id: 'luftvatten', label: 'Luft-vatten',
      /* V8 CHANGED (V8-payback-research §3): was [2,7, 3,2] — the point sat AT the
       * band floor (worst case carried zero SPF downside) and the 3,2 top has no
       * field support. [FACT] Energimyndighetens luft-vatten-test: årsvärmefaktor
       * 2,5 upp mot 3,0; varmekalkyl.se 2026 räknar konservativt på SCOP 2,5.
       * Point 2,7 now sits mid-band. src: energimyndigheten.se via web 2026-07-10.
       * [GAP-E7-8 → energiexpert signs the symmetrised band] */
      spf: 2.7, spfRange: [2.5, 3.0],
      isGround: false,
      isComplement: false,
      servedShare: 1.0,
      gross: 130000,                         // [FACT] R2 §1b ~90 000–180 000 (befintligt vattenburet); conservative ~130 000. V8 corroborated: varmekalkyl.se 2026 90 000–180 000 installerat. [GAP-R2-1]
      grossNoWaterborne: 220000,             // [FACT] R2 §1b direktel must add 60 000–120 000 → 150 000–300 000; mid ~220 000. V8 corroborated: varmekalkyl.se 2026 vattenburet tillägg 60 000–120 000. [GAP-R2-1]
      laborShare: 0.30,                      // [FACT] R2 §2 schablon 30 %
      requiresWaterborne: true
    },
    bergvarme: {
      id: 'bergvarme', label: 'Bergvärme',
      spf: 2.9, spfRange: [2.7, 3.2],        // [GAP-R1-1] field anchor 2,7 (Energimyndigheten/SP real-home avg) sets the low end; conservative point 2,9. V8 verified KEEP: Energimyndighetens fältmätning genomsnitt 2,7; marknadens "5-10 år" räknar på SPEC-COP 3,5 (ej fält) — vi ligger rätt.
      isGround: true,                        // SPF flat across the year (ground temp stable, R1 §1c/§2)
      isComplement: false,
      servedShare: 1.0,
      gross: 200000,                         // [FACT] R2 §1c ~150 000–280 000 (befintligt vattenburet); conservative ~200 000. V8 corroborated: varmekalkyl.se 2026 150 000–250 000 brutto. [GAP-R2-1]
      grossNoWaterborne: 290000,             // [FACT] R2 §1c direktel adds ~60 000–120 000. V8 corroborated (adder): varmekalkyl.se 2026. [GAP-R2-1]
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
   * V8 corroborated: varmekalkyl.se 2026 uses exactly 1,80 kr/kWh in its bergvärme,
   * luft-vatten AND luft-luft payback examples ("rimligt antagande 2026 inkl nät,
   * energiskatt, moms"). KEEP. src: varmekalkyl.se via web 2026-07-10.
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
    direktel:     { id: 'direktel',     label: 'Direktverkande el', isElectric: true,  efficiency: 1.00, canComplement: true }, // [FACT]
    vattenburenEl:{ id: 'vattenburenEl',label: 'Vattenburen el',    isElectric: true,  efficiency: 0.95, canComplement: true }, // [GAP-R1-3] ~0,95–1,0
    olja:         { id: 'olja',         label: 'Oljepanna',         isElectric: false, efficiency: 0.85, canComplement: true }, // [GAP-R1-3] ~0,75–0,90; non-electric → fuelPrice path
    vedpellets:   { id: 'vedpellets',   label: 'Ved / pellets',     isElectric: false, efficiency: 0.75, canComplement: true }, // [GAP-R1-3] ~0,60–0,85; not electricity
    franluft:     { id: 'franluft',     label: 'Äldre frånluftspump',isElectric: true, efficiency: 1.5,  canComplement: false },  // [GAP-E7-4] äldre F-pump verklig SPF (was 2,0; band ~1,5–2,5, conservative point); energiexpert signs
    fjarrvarme:   { id: 'fjarrvarme',   label: 'Fjärrvärme',        isElectric: false, efficiency: 1.00, isPrice: true, canComplement: false }, // [FACT] price comparison, NOT efficiency (R1 §3b)

    /* --- COMPLEMENT-CAPABLE CURRENT SYSTEMS (MASTER-SPEC-V3 §1.4) -------------
     * A customer may run a primary heat source PLUS one or more existing
     * complements (e.g. bergvärme + luft-luft, or direktel + kamin). These records
     * let a complement be priced on the BLENDED current cost. The pump-as-current
     * efficiencies REUSE the field-SPF points from the pump table (befintlig, ie
     * already installed), NOT the energimärkning SCOP. Every coefficient [GAP]-tagged. */
    luftluftCur:  { id: 'luftluftCur',  label: 'Luft-luft (befintlig)',   isElectric: true,  efficiency: 2.5, canComplement: true, isComplementClass: true }, // [GAP-R1-1] reuse pump field-SPF point (luftluft 2,5)
    luftvattenCur:{ id: 'luftvattenCur',label: 'Luft-vatten (befintlig)', isElectric: true,  efficiency: 2.7, canComplement: true, isComplementClass: true }, // [GAP-R1-1] reuse pump field-SPF point (luftvatten 2,7)
    bergvarmeCur: { id: 'bergvarmeCur', label: 'Bergvärme (befintlig)',   isElectric: true,  efficiency: 2.9, canComplement: true, isComplementClass: true }, // [GAP-R1-1] reuse pump field-SPF point (bergvärme 2,9)
    kamin:        { id: 'kamin',        label: 'Braskamin / vedspis',     isElectric: false, efficiency: 0.70, canComplement: true, isComplementClass: true } // [GAP-R1-3] conservative ved-burning efficiency; non-electric → fuelPrice path
  },
  defaultCurrentSystem: 'direktel', // [MODEL] paid-first segment; the biggest honest delta

  /* --- FUEL PRICE for non-electric current systems (kr/kWh delivered heat) ---
   * [GAP-R1-3]/[GAP-R1-6] olja/ved/pellets/fjärrvärme price points need owner sign.
   * Placeholder bands (kr/kWh of delivered heat) so the non-electric path computes;
   * flagged so the renderer can footnote "depends on your fjärrvärmepris". */
  /* V7 CHANGED (V7-economics §2 / V7-SPEC §1.1): corrected 2026 per-fuel prices,
   * kr/kWh DELIVERED heat, inkl moms. Relative ordering the homeowner sees (SE3,
   * effective on heating): olja ~2,40 > el ~2,05 eff > vattenburen el ~2,15 eff >
   * köpt ved ~1,35 > fjärrvärme ~1,20 ≈ pellets ~1,15 > frånluft ~1,35 eff >
   * luft-luft ~0,85 > bergvärme ~0,70 — matches folk intuition (the L1 fix). */
  fuelPrice: {
    olja:       2.40, // [GAP-E7-3] was 1.50 — villaolja ~20 900 kr/m³ ÷ (9 950 kWh/m³ × 0,85); energiexpert + Julius sign
    vedpellets: 1.20, // [GAP-E7-3] was 0.80 — pellets ~1,15 / köpt ved ~1,35, blended
    fjarrvarme: 1.20, // [GAP-E7-3] was 1.10 — Nils Holgersson 2025 riksgenomsnitt 1,23; PRICE comparison framing unchanged
    kamin:      1.45  // [GAP-E7-3] was 0.55 — KÖPT ved ÷ stove eff; egen ved = copy, not math
  },

  /* --- V7 SOLAR self-consumption model (V7-SPEC §1.1 / V7-economics §3) -------
   * Feeds the L6 production slider + the engine's current-cost offset (engine §1.3).
   * The offset applies to the ELECTRIC members of the current stack only, is capped
   * per month at that month's electric cost, and NEVER folds in surplus/export
   * (60-öre abolished 2026, [FACT] foretagsdata §6.4). */
  solar: {
    prodMin: 2000, prodMax: 12000, prodStep: 500, prodDefault: 8000, // [GAP-E7-5] slider band; 5–12 kWp × ~950 kWh/kWp; foretagsdata §3.3 anchor 10 kWp ≈ 9 000–11 000; energiexpert + Julius sign
    selfUseShare: 0.30,          // [GAP-E7-6] no-battery self-consumption, conservative low end of 30–40 %; energiexpert signs
    /* Otovo monthly production, Stockholm 15 kWp — the SHAPE source, transcribed
     * VERBATIM from dossier R4 §1.1 (kWh per month, J..D); normalised in engine.
     * ~90 % Mar–Nov, Dec ≈ 1,3 %. [FACT R4 §1.1 src: otovo.se] */
    monthShape: [264, 580, 1337, 1845, 2100, 2131, 2110, 1785, 1360, 807, 334, 186]
  },

  /* --- V7 OWN-FIGURE kWh slider bounds (V7-left §2 / V7-SPEC §2.2) -----------
   * Replaces the dead free-text override. Bounds [FACT]-anchored
   * (energimarknadsbyran/klimatime via R3 §1b; top ≈350 m² pre-1940 direktel
   * [DERIVED]); edges [GAP-L4 → energiexpert + Julius]. The kr path is DEAD. */
  own: { min: 5000, max: 45000, step: 500, defaultKwh: 20000 },      // [GAP-L4]

  /* --- V7 RECOMMENDATION CONSTITUTION (V7-rec-engine §2.1/§5) ----------------
   * Policy constants, not physics — a signature is a one-file edit here. */
  rec: {
    pbLeadMax:          10,    // år — lead ceiling (H1)                    [GAP-V7-1] Julius
    pbMentionMax:       15,    // år — "för den som vill" band (H2)         [GAP-V7-1] Julius
    leadSavingFloor:    3000,  // kr/år — a lead needs a real saving (H4)   [GAP-V7-3] Julius
    partialShareMin:    0.20,  // pump-complement coverage → delvisLost (H6) [GAP-V7-2] energiexpert
    merLuftluftEnabled: false, // addOn gate — OFF until signed             [GAP-V7-8] energiexpert flips WITH the two below
    merLuftluftMaxCov:  0.60,  //                                            [GAP-V7-8]
    merLuftluftMinM2:   140    //                                            [GAP-V7-8]
  },

  /* --- V7 BATTERY catalogue anchors (rec-text slots only, never a sum) -------
   * från-pris [FACT foretagsdata §3.2 via R4 §3.2]; grön teknik 50 % on battery
   * is LOCKED 2026 canon (owner-confirmed). Display is gross → avdrag → net,
   * never net-as-sticker. */
  battery: {
    grossFrom: 33000,   // [FACT foretagsdata §3.2] cheapest catalogue från-pris
    greenTechRate: 0.50 // [FACT] grön teknik 50 % (battery), 2026 owner-confirmed canon
  },

  /* --- V7 waterborne retrofit adder (copy slot {vbLo}-{vbHi}) -----------------
   * The +60 000-120 000 kr a direktel house adds for a waterborne system. Already
   * baked into grossNoWaterborne above (mid ~90k); this RANGE feeds the rec-text
   * sentence only (V7-COPY §0.2). [FACT R2 §1b] */
  waterborneAdder: [60000, 120000],

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
  demandSpread: 0.15,

  /* --- MULTI-SYSTEM model (MASTER-SPEC-V3 §1.4) ------------------------------
   * The real current state can be a PRIMARY system (single) + optional COMPLEMENTS
   * (multi, each with a coverage share of the annual heat it carries). The engine
   * blends the current cost across the stack; the primary holds the residual share.
   * Every coefficient below is a modelling placeholder pending expert sign-off.
   *
   * [GAP-MULTI-1] defaultCoverage — every complement defaults to the segmented
   *   middle stop "En del ~40 %" (0.40) so the engine default and the UI control are
   *   ONE visible number. The per-system research refinement is owed by the expert.
   * [GAP-MULTI-2] primaryFloor — the primary keeps at least 30 % of the heat;
   *   complements together cap at 1 − floor = 70 %. Guards a zero-weight primary.
   * [GAP-MULTI-3] smallSavingThreshold — kr/yr below which the verdict becomes
   *   "liten besparing" and the CTA softens. Owner signs the voice + commercial line.
   * [MODEL] shareStops — the three segmented stops the UI exposes (Lite/En del/
   *   Mycket). UX choice (Baymard: no false-precision free %), not a research figure. */
  multi: {
    defaultCoverage: {            // [GAP-MULTI-1] all map to the "En del ~40 %" middle stop
      kamin:         0.40,
      luftluftCur:   0.40,
      luftvattenCur: 0.40,
      bergvarmeCur:  0.40,
      direktel:      0.40,
      vattenburenEl: 0.40,
      olja:          0.40,
      vedpellets:    0.40
    },
    defaultCoverageFallback: 0.40, // [GAP-MULTI-1] any complement not listed above
    primaryFloor:         0.30,    // [GAP-MULTI-2] primary keeps ≥30 % of heat; complements ≤70 % total
    smallSavingThreshold: 1500,    // [GAP-MULTI-3] kr/yr below which → "liten besparing" + softened CTA
    shareStops:           [0.20, 0.40, 0.60] // [MODEL] the 3 segmented stops (Lite / En del / Mycket); UX, not a research figure
  },

  /* --- PRIMARY heat-pump current systems (already-efficient trigger) ---------
   * If the user's PRIMARY current system is already a heat pump, the honest verdict
   * is "liten besparing" regardless of the kr delta. These ids trip efficientFlag.
   * [MODEL] derived from currentSystems.isComplementClass + franluft. */
  heatPumpCurrentIds: ['luftluftCur', 'luftvattenCur', 'bergvarmeCur', 'franluft'], // [MODEL] primary-is-a-pump ⇒ already-efficient branch

  /* ==========================================================================
   * V4 DELTA (V4-engine-delta.md §3) — the neutral ranked-options registry.
   * Read ONLY by rankOptions (rank.js). Every new coefficient [GAP]-tagged with
   * its signer; unsigned ⇒ conservative end, or qualitative.
   * ======================================================================== */

  /* --- 3.1 D.measures — the option registry ---------------------------------- */
  measures: {
    /* S1 — smart styrning. Ships a NUMBER only when signed:false flips (V4 §5.2 rule 6).
     * Until then rankOptions emits the row with numeric:false and NO kr fields at all. */
    styrning: {
      id: 'styrning', label: 'Smart styrning',
      signed: false,                 // [GAP-V4-2] energy expert flips this WITH the numbers below
      invest: [3000, 15000],         // [GAP-V4-1] kr, owner+electrician sign package + what Ampy installs
      heatingCostCut: [0.05, 0.10],  // [GAP-V4-2] conservative share of space-HEATING COST (supplier 20–45 % claims rejected; spot-shifting moves kWh in time, it does not remove them)
      laborShare: null,              // [GAP-V4-1] null ⇒ NO ROT applied (conservative until signed)
      needsControllable: true        // gate: see rank.controllablePrimaries
    }
    /* S2–S4 need no registry rows: they ARE D.pumps (luftluft/luftvatten/bergvarme).
     * S0 behåll is generated unconditionally. S5 kamin-spets: see D.combi. */
  },

  /* --- 3.2 D.rank — the deterministic ranking constants ---------------------- */
  rank: {
    /* Investment rungs (V4 §5.2 rule 3; the neutrality device). Assign by netInvest MIDPOINT. */
    rungs: [                                   // [GAP-V4-5] owner signs the stops
      { id: 'r0', max: 15000,   label: '0-15 tkr'  },
      { id: 'r1', max: 60000,   label: '20-55 tkr' },
      { id: 'r2', max: Infinity, label: '90+ tkr'  }
    ],
    /* Primaries on which styrning has a controllable load (pump, vattenburet, or smart
     * thermostats on direktel). direktel included WITH caveat (thermostat retrofit). */
    controllablePrimaries: ['direktel', 'vattenburenEl', 'olja', 'fjarrvarme', 'franluft',
                            'luftluftCur', 'luftvattenCur', 'bergvarmeCur'], // [MODEL] everything but ved/pellets-primary; [GAP-V4-2] expert confirms
    /* Q1 primaries that IMPLY a waterborne system (Q3b skipped, hasWaterborne inferred true). */
    waterborneImplies: ['olja', 'fjarrvarme', 'vattenburenEl', 'luftvattenCur', 'bergvarmeCur'], // [MODEL] app-layer inference, engine untouched
    /* An existing luft-luft complement at/above this coverage removes S2 headroom (greyed, never hidden). */
    complementHeadroomMax: 0.20,  // [GAP-V4-9] expert signs; conservative (any real existing luft-luft ⇒ greyed at the 0.40 default stop)
    /* V7: row cap for the comparison visual (I dag + maxRows option rows + chip). */
    maxRows: 6                    // [MODEL] V7-SPEC A7; more than 6 bars breaks 10-second legibility
  },

  /* --- 3.3 D.combi — future-stack combinations (S5 machinery) ---------------- */
  combi: {
    enabled: false,            // v1 ships FALSE: kamin-spets = verdict sentence (V4-systems §1 S5); flip for v1.1 computed combos
    keepable: ['kamin'],       // [MODEL] complements that may stay on the FUTURE side (vedpellets excluded v1: labour/comfort framing, R1 §3b)
    maxKeptShare: 0.20,        // [GAP-V4-7] cap on the kept complement's FUTURE coverage — spets, not workhorse. CONSERVATIVE direction verified: kamin heat (fuelPrice 0.55 kr/kWh) is CHEAPER than modelled pump heat, so a LOWER cap yields a SMALLER claimed saving. Flat across months (winter-weighting would only ENLARGE the modelled benefit; a signed winter-weight profile is [GAP-V4-8])
    spetsSentenceKey: 'kaminSpets' // [GAP-V4-6] the qualitative sentence, rost finalises; attached as a caveat when enabled:false and kamin is in the current stack
  }
  /* Rename note (delta §3.4): D.marginalPriceSE3 is used with pa.factor for ALL areas.
   * Decision: KEEP marginalPriceSE3, no rename. Written here so nobody "cleans it up". */
};
