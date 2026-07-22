<?php
// <Internal Doc Start>
/*
*
* @description:
* @tags:
* @group:
* @name: Ampy - Energikalkylator - JS
* @type: js
* @status: published
* @created_by: 13
* @created_at: 2026-07-22 12:00:00
* @updated_at: 2026-07-22 12:00:00
* @is_valid: 1
* @updated_by: 13
* @priority: 10
* @run_at: wp_footer
* @load_as_file: yes
* @load_in_block_editor:
* @condition: {"status":"no","run_if":"assertive","items":[[]]}
*/
?>
<?php if (!defined("ABSPATH")) { return;} // <Internal Doc End> ?>
;(function () {
'use strict';
/* ===================== data.js ===================== */
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
      spf: 2.7, spfRange: [2.5, 3.0],       // V21 CHANGE (V21-spf §2.1): was 2.5 (point AT floor = double-conservative ~−7 %). Symmetrised to mid-band 2.7 to mirror luft-vatten; still ~40 % under rated SCOP 3,8–5,1 (field ~2,7–3,2, −7 °C rating floor). Range KEPT. src: luftvärmepump bäst-i-test 2026 / polarpumpen.se via web 2026-07-11. [GAP-R1-1 → energiexpert]
      isGround: false,
      isComplement: true,                    // candour invariant 6: komplement, not whole-house
      servedShare: 0.7,                      // [MODEL] caps modelled saving to served area; [GAP] expert signs
      gross: 28000,                          // V21 CHANGE (V21-invest §1): was 30000 (top of 2026 premium band). Trimmed to 28000 = top of the 2026 STANDARD band (bytautvärmepumpen/bygghemma: standard 18–28k, mid ~23k). Low payback impact (komplement, servedShare 0.7). src: bytautvarmepumpen.se/bygghemma.se via web 2026-07-11. [GAP-R2-1]
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
      spf: 3.0, spfRange: [2.7, 3.2],        // V21 NUDGE (V21-spf §2.3): was 2.9. The 2,7 floor is Energimyndighetens OLD-fleet field average; a 2026 NEW install on radiators field-performs ~3,0–3,3, so 2,9 anchored an old-fleet avg as a new-install central. Point → 3,0 (modern-install field reality); floor KEPT at 2,7 (citable), top NOT widened past 3,2 (spec-COP 3,5 is not field). src: energimyndigheten.se/klimatsmart.se via web 2026-07-11. [GAP-R1-1 → energiexpert signs the nudge]
      isGround: true,                        // SPF flat across the year (ground temp stable, R1 §1c/§2)
      isComplement: false,
      servedShare: 1.0,
      gross: 190000,                         // V21 CHANGE (V21-invest §1): was 200000 (band-mid, ~7–8 % above the specific 2026 150 m² examples = the one genuine invest pad). 190000 = avg of the two independent 2026 150 m² quotes (brabyggare 180k, varmekalkyl 192k); band 150–250k. src: brabyggare.se/varmekalkyl.se via web 2026-07-11. [GAP-R2-1]
      grossNoWaterborne: 280000,             // V21 CHANGE (V21-invest §1): was 290000. = 190000 + 90000 waterborne adder (adder UNCHANGED, market-confirmed 60–120k). [GAP-R2-1]
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
   * [FACT] Price region factors on the marginal price: SE1 0,82 / SE2 0,85 /
   *   SE3 1,00 / SE4 1,10 (V21-prices §2, computed from 2026 YTD elområde spot;
   *   only spot varies by elområde, nät/skatt/moms are national). NOTE these differ from the BATTERY arbitrage
   *   region factors (see upsideRates.regionFactor): SE1 0,55 / SE2 0,70 /
   *   SE3 1,00 / SE4 1,55 — two different physical quantities, kept separate. */
  priceAreas: {
    SE1: { id: 'SE1', label: 'SE1', factor: 0.82 }, // V21 (V21-prices §2): was 0.80; exact 2026 = 0,82 (SE1 spot 53,76 öre + 62 öre non-spot base). Minor. [GAP-price-region → energiexpert]
    SE2: { id: 'SE2', label: 'SE2', factor: 0.85 }, // V21 CHANGE (V21-prices §2): was 0.90 (legacy "smooth ramp" guess, OVERSTATED SE2 → optimistic). 2026 SE2 spot 54,06 öre ≈ SE1, far below SE3; exact factor 0,82 + 0,03 multi-year cushion = 0,85. [GAP-price-region → energiexpert]
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
  household: 5000, // STRIP CONSTANT — engine.js kWh-strip; do NOT change (re-signs savings) [GAP-R3]
  householdModel: {           // DISPLAY-ONLY — read by rank.js costSplit for the anchor decomposition;
    baseKwh:        3000,     //   NEVER by any saving/payback. [GAP-HH-1] signer: energiexpert + Julius.
    perOccupantKwh: 1000      //   2 occ -> 5000 (== strip constant, continuity); 4 occ -> 7000
  }, // Derivation: Energimyndigheten 2018 villa ~5 747 kWh excl värme+VV [FACT src: energimarknadsbyran.se / hemsol.se 2026-07-10]; ~2 000 kWh/person reconciled to fixed base + conservative-low 1 000 kWh/boende (2 occ == 5 000 schablon). Area-scaling deliberately EXCLUDED (no second unsigned coefficient).

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
    fjarrvarme: 1.25, // V21 CHANGE (V21-prices §3): was 1.20 (DOUBLE-CONSERVATIVE — below even the 2025 riks 1,23; understated the fjärrvärme customer's cost = anti-conversion). 2026 riks ~1,30; raised to conservative-exact 1,25. PRICE comparison framing unchanged. src: nilsholgersson.nu 2025 = 1 225 kr/MWh via web 2026-07-11. [GAP-E7-3]
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
  own: { min: 5000, max: 60000, step: 500, defaultKwh: 20000 },      // [GAP-L4] V10 m-m6: top raised 45000→60000 (350 m² pre-1940 direktel no longer pinned at max)

  /* --- V10 RECOMMENDATION CONSTITUTION (owner P1-P5, 2026-07-10) -------------
   * Policy constants, not physics — a signature is a one-file edit here. */
  rec: {
    /* OWNER POLICY V10: pbComfort no longer suppresses — above it the verdict MUST
     * state "återbetald först på ~X-Y år" plainly and the ★ stays ON. [owner P2] */
    pbComfort:          10,    // was pbLeadMax (renamed; same signed value) [GAP-V7-1]
    pbActionMax:        20,    // NEW ceiling: above it a pump stops being the LEAD (its
                               // numbers stay fully visible); action lane leads. [GAP-V10-2 Julius]
    pbMentionMax:       15,    // unchanged (mention band)
    leadSavingFloor:    3000,  // now a WORDING boundary (litenBesparing register), never a gate
    partialShareMin:    0.20,  // unchanged; delvisLost now yields a REAL lead
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
    /* Q1 primaries that IMPLY a waterborne system (Q3b skipped, hasWaterborne inferred true).
     * V10 AR-1: + franluft — a frånluftsvärmepump is by construction connected to a
     * waterborne system (it heats radiators/VV); the old omission mispriced luft-vatten/
     * bergvärme by 90-110 tkr gross on frånluft houses. [GAP-V10-1: elektriker counter-signs] */
    waterborneImplies: ['olja', 'fjarrvarme', 'vattenburenEl', 'luftvattenCur', 'bergvarmeCur', 'franluft'], // [MODEL] app-layer inference, engine untouched
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

/* ===================== engine.js ===================== */
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
    /* V8 (E-V8-1, V8-payback-research §3): the ± band combines the two INDEPENDENT
     * uncertainties (demand ±sp, SPF range) in quadrature (RSS) around the mid,
     * instead of stacking both worst cases. Corner-stacking quoted a ~2-4 % joint
     * tail as the band edge and produced the 9,5-14/4,1-6,0 over-wide bands.
     * Each component spread is computed NUMERICALLY (solar offset caps break pure
     * linearity), one factor at a time, at the other factor's point value.
     * demandMeasured ⇒ sp=0 ⇒ the band is SPF-only. [GAP-V8-1 expert countersign] */
    var savingSpfLo = annualCurrentCostFor(1) - annualPumpCostFor(pump.spfRange[0], 1);
    var savingSpfHi = annualCurrentCostFor(1) - annualPumpCostFor(pump.spfRange[1], 1);
    var savingDemLo = annualCurrentCostFor(1 - sp) - annualPumpCostFor(pump.spf, 1 - sp);
    var savingDemHi = annualCurrentCostFor(1 + sp) - annualPumpCostFor(pump.spf, 1 + sp);
    var relSpf = heroSaving > 0 ? Math.abs(savingSpfHi - savingSpfLo) / (2 * heroSaving) : 0;
    var relDem = heroSaving > 0 ? Math.abs(savingDemHi - savingDemLo) / (2 * heroSaving) : 0;
    var relTot = Math.sqrt(relSpf * relSpf + relDem * relDem);
    var heroLow  = heroSaving * (1 - relTot);
    var heroHigh = heroSaving * (1 + relTot);
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

/* ===================== rank.js ===================== */
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
      // robustness, not logic: a malformed %-sequence (truncated ad/share link) must
      // skip THAT param, never throw URIError and kill boot — ad traffic IS query strings
      var k = kv[0], v;
      try { v = decodeURIComponent(kv[1]); } catch (eDec) { return; }
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
      else if (k === 'kwh') { if (/^\d+$/.test(v)) { var n1 = parseInt(v, 10); if (n1 > 0) out.kwh = n1; } }   // '1.5e4' must not silently become 1
      else if (k === 'kr')  { if (/^\d+$/.test(v)) { var n2 = parseInt(v, 10); if (n2 > 0) out.kr = n2; } }
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

/* ===================== app.js (root-scoped, multi-instance, lead wired) ===================== */
/* =============================================================================
 * app.js — Ampy energikalkylatorn — vB · v9 "Sparstaplarna" (V9-SPEC.md)
 * Renderer + interactions. The two-pane single-canvas calculator, live recompute.
 *   LEFT:  ONE merged heat list (8 systems + Vet inte, multi-select) → boyta → byggår →
 *          boende → elområde → own-figure kWh SLIDER (all-electric stacks only)
 *          → solceller Nej/Finns/Planeras (+ production slider).
 *          7 controls, flat, zero keyboards, zero free-text numerics.
 *   RIGHT: energy-TOTAL anchor (uppvärmning + varmvatten + hushållsel) → story bar
 *          (3-post legend) → SPARSTAPLARNA (#spark: horizontal SAVING bars, one per
 *          option, shared scale, ★ ring on the lead, tap a bar → dropdown with the
 *          verdict + investering/payback) → CTA block (dominant primary + quiet share)
 *          → method (bullets + legal, NO curve).
 *   Candour invariant: the anchor TOTAL is display-only; every bar reads o.saving[]
 *   verbatim (heat+VV base, frozen), so household never touches a saving.
 * engine.js calculate() carries exactly the two spec'd v7 deltas. rank.js
 * (AmpyRank.rankOptions + recommend, AmpyCodec) is the pure additive layer.
 * data.js owns every number. Rounding + Swedish formatting HERE.
 * ========================================================================== */

(function () {
  'use strict';
  var D = window.AMPY_DATA;
  var ENGINE = window.AmpyEngine;
  var RANK = window.AmpyRank;
  var CODEC = window.AmpyCodec;
  if (!D || !ENGINE || !RANK) {
    // a script failed to load (aborted mobile fetch): SAY so — never a silent dead skeleton
    try {
      var deadAnchor = document.getElementById('anchorNum');
      if (deadAnchor) {
        deadAnchor.textContent = 'Kalkylatorn kunde inte laddas. Ladda om sidan.';
        deadAnchor.style.fontSize = '18px';   // not the 5rem hero scale for a sentence
        deadAnchor.style.fontWeight = '500';
      }
    } catch (eDead) {}
    return;
  }

  /* ---------- tiny DOM + format helpers (KEEP) ---------- */
  var ROOT = document;                       // becomes the widget root at init
  function $(s, r) { return (r || ROOT).querySelector(s); }
  function el(s, r) { return Array.prototype.slice.call((r || ROOT).querySelectorAll(s)); }
  var REDUCED = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var EMPTY = '—'; /* the ONE sanctioned em-dash: the empty payback readout */

  function nf(n) { return Math.round(n).toLocaleString('sv-SE').replace(/[\u0020\u00A0\u202F]/g, '\u00A0'); } /* d-p1: sv-SE emits NBSP or NNBSP depending on engine — normalize to NBSP so figures never break (comment dash sanctioned: code comment, not copy) */
  function roundTo(n, step) { return Math.round(n / step) * step; }
  function krStr(n, step) { return nf(roundTo(n, step)) + ' kr'; }
  function yrStr(y) { return (Math.round(y * 2) / 2).toString().replace('.', ','); }
  function pct(x) { return Math.round(x * 100) + ' %'; }
  function ucfirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  /* honest range string: '~lo-hi kr' (plain hyphen), collapses to '~mid kr' */
  function krRange(lo, hi, step) {
    var a = Math.max(0, roundTo(lo, step)), b = Math.max(0, roundTo(hi, step));
    return (a === b) ? '~' + nf(a) + ' kr' : '~' + nf(a) + '-' + nf(b) + ' kr';
  }
  /* saving/payback fragments for the comparison micro-line */
  function savRange(lo, hi, step) {
    var a = Math.max(0, roundTo(lo, step)), b = Math.max(0, roundTo(hi, step));
    return (a === b) ? nf(a) + ' kr' : nf(a) + '-' + nf(b) + ' kr';
  }
  function pbRange(lo, hi) {
    var a = roundTo(lo, ROUND.payback), b = roundTo(hi, ROUND.payback);
    return (a === b) ? '~' + yrStr(a) + ' år' : '~' + yrStr(a) + '-' + yrStr(b) + ' år';
  }
  /* Sparstaplarna saving value: '~lo-hi kr/år' (bulletproof unit), collapses to '~mid kr/år' */
  function savRangeYr(lo, hi, step) {
    var a = Math.max(0, roundTo(lo, step)), b = Math.max(0, roundTo(hi, step));
    return (a === b) ? '~' + nf(a) + ' kr/år' : nf(a) + '-' + nf(b) + ' kr/år';   /* range: no ~ */
  }
  var ROUND = (D.meta && D.meta.rounding) ? D.meta.rounding : { hero: 1000, stat: 500, payback: 0.5 };

  /* ---------- instrumentation (consent-gated, bucketed, experiment_id) ---------- */
  function hasConsent() { return window.ampyConsent === true || window.AMPY_CONSENT === true; }
  function track(ev, params) {
    if (!hasConsent()) return; /* no event fires without consent state */
    try {
      var p = { event: 'ek_' + ev, experiment_id: 'energikalkylatorn-v10' };
      if (params) for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
      (window.dataLayer = window.dataLayer || []).push(p);
    } catch (e) {}
  }

  /* §8: transmit the CRM-complete lead to the WP REST route (LED pattern: honeypot,
   * no nonce; POST /lead/{postId}). The honeypot (hp_extra) rides in the payload. */
  function postLead(payload) {
    var cfg = window.AmpyEK || {};
    if (!cfg.restUrl || !cfg.postId) { return; }   // standalone/preview: inert (dev only)
    fetch(cfg.restUrl + '/lead/' + cfg.postId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () { /* success UI shown; server email fallback catches it */ });
  }
  function bucketKr(v) { /* savings are BUCKETED, never raw */
    if (v == null || !(v > 0)) return '0';
    var lo = Math.floor(v / 5000) * 5000;
    return lo + '-' + (lo + 5000);
  }
  function bucketKwh(v) { /* own-slider kWh, bucketed 5 000 (playbook: never raw sliders) */
    if (v == null || !(v > 0)) return '0';
    var lo = Math.floor(v / 5000) * 5000;
    return lo + '-' + (lo + 5000);
  }

  /* ---------- the copy deck (V7-COPY.md; rost-final, grep-clean) ---------- */
  /* Slot convention: {slot} filled at render via fill(); {b}..{/b} = bold span.
   * The copy NEVER hard-codes a kr/år or payback figure — every number is a slot. */
  function fill(tpl, map) {
    return tpl.replace(/\{(\/?b|[a-zA-Z]+)\}/g, function (m, key) {
      if (key === 'b') return '<b>';
      if (key === '/b') return '</b>';
      return (map && map[key] != null) ? esc(String(map[key])) : m;
    });
  }
  var S = {
    hintVetinte: 'Vi räknar försiktigt på direktverkande el tills du vet mer. Det går att ändra sen.',
    hintFjarr: 'Fjärrvärme jämförs på pris. Kamin och luft-luft går bra att lägga till.',
    cardName: {
      behall: 'Behåll det du har',
      styrning: 'Smart styrning av värmen',
      luftvatten: 'Luft-vatten värmepump',
      bergvarme: 'Bergvärme'
    },
    leadName: { /* the plate's inline lead label (lower case, worked pattern) */
      luftluft: 'luft-luft som komplement',
      luftvatten: 'luft-vatten',
      bergvarme: 'bergvärme'
    },
    reason: {
      redanVarmepump: 'Huset värms redan av en värmepump. Vi visar siffran som jämförelse, inte som råd.',
      luftluftFinnsRedan: 'Luft-luft finns redan i huset, så en till ger litet utrymme till mer.',
      styrningEjStyrbar: 'Kräver värme som går att styra elektroniskt. Ved och pellets eldas för hand.'
    },
    rec: {
      /* V10 m-p2: the dead plate/body/sec/disclose decks are DELETED — the
       * Sparstaplarna dropdowns (S.spark) carry ALL advice copy now. */
      addOn: {
        styrning: 'Kombinera med smart styrning: värmen styrs efter pris och behov. Vi sätter en siffra på det först när källan är granskad.',
        kaminSpets: 'Kaminen tar topparna de kallaste dagarna. Det håller nere elräkningen när den annars är som högst.',
        merLuftluft: 'I ett hus i din storlek kan ytterligare en luft-luft ta en större del av värmen. En elektriker ser var den gör nytta.',
        endOfLifeOlja: 'När pannan ändå närmar sig sitt slut ändras kalkylen: då jämför du nypriser, inte mot en fungerande panna. Boverkets nya stöd för vattenburen värme kan vara värt att bevaka, vi räknar inte med det.',
        endOfLifeFranluft: 'Närmar sig pumpen bytesålder ändras kalkylen: då jämför du nypriser, inte mot en fungerande pump. Det är rätt läge att räkna om här.',
        vattenburetAdder: 'Kräver vattenburet system. Det finns inte i huset idag, så vi har räknat med {vbRange} kr extra för att lägga till det. Det ingår i investeringssiffran.',
        batteri: 'Med solceller på taket är ett solcellsbatteri ett rimligt nästa steg: ungefär {battRange} per år i ökat värde av din egen el. Pris från {battGross} kr, efter grön teknik 50 procent cirka {battNet} kr.',
        batteriPlaneras: 'När solcellerna är på plats blir ett batteri nästa fråga. Vi räknar på det när anläggningen finns.',
        vetinteHedge: 'Vi räknar försiktigt på direktverkande el tills du vet mer.'
      },
      announce: 'Vald väg: {namn}. Rekommendationen visas nedan.'
    },
    spark: {
      recLabel: 'Vår rekommendation',
      /* V10 (owner P1-P5): the LEAD row's dropdown = branchIntro[branch] (when defined)
       * + the option sentence + longPbLine (when rec.longPb) + the figure rows.
       * Non-lead rows keep their plain option sentence; disclose = NON-lead rows only. */
      branchIntro: {
        uppgradering:  'En äldre frånluftspump tar bara en del av värmen ur ventilationsluften, resten kommer från el. Ett hus som ditt är byggt för att uppgraderas.',
        heltackning:   'Din luft-luft värmer där luften når. Det här alternativet tar hela huset.',
        fjarrvarmePris:'Det här är en prisjämförelse mot fjärrvärmens pris, cirka 1,20 kr per kWh som riksgenomsnitt, inte en verkningsgradssiffra. Din taxa avgör, kontrollera den på fakturan.',
        delvisLost:    'Din värmepump gör redan en del av jobbet. Kvar att jobba med är {residualLabel}, ungefär {residualShare} procent av värmen, cirka {residualKr} kr per år. Det här alternativet tar hela huset.',
        komfortKrona:  'Vedvärme ger billig värme men kostar arbete: bära, elda och passa. Det här alternativet ger värme utan vedbärandet. Vi räknar på köpt ved, cirka 1,45 kr per kWh. Eldar du egen ved är vinsten främst komfort, inte kronor.',
        litenBesparing:'Besparingen är liten för ditt hus, ungefär {savingRange} kr per år. Vi rekommenderar den ändå som det rimligaste steget, utan brådska.'
      },
      /* OWNER POLICY V10 (P2): a long payback never mutes the ★ — it is stated PLAINLY.
       * ("mest med dina siffror" = a computed in-list fact, not a market superlative.) */
      longPbLine: 'Ärligt räknat är den återbetald först på ungefär {pbRange} år. Det är ändå den åtgärd som sänker din driftkostnad mest med dina siffror.',
      verdict: {
        luftluft:        'En luft-luftvärmepump tar en stor del av värmen till en bråkdel av kostnaden. Det du värmer med idag sitter kvar som reserv i rummen den inte når.',
        luftvattenWb:    'En luft-vatten värmepump kopplas på dina vattenburna element och hämtar större delen av värmen ur luften. Tappet i kyla är inräknat.',
        luftvattenNoWb:  'En luft-vatten värmepump värmer hela huset via vattenburna element. Huset saknar det systemet idag, så {vbRange} kr för att lägga till det ingår i investeringen.',
        bergvarme:       'Bergvärme hämtar värmen ur berget och ligger stabilt året om, även i sträng kyla. Den kräver borrhål på tomten, via partner.',
        styrning:        'Styr värmen efter pris och behov, utan ingrepp i huset. Vi sätter en siffra först när källan är granskad.',
        behall:          'Så här ligger du idag. Siffrorna ovan är räknade mot den här kostnaden. Noll kronor i investering, och du kan räkna om här när något ändras.',
        batteri:         'Ett solcellsbatteri ökar värdet av elen du redan producerar. Mer används i huset, och det kan köpa el när den är billig och använda den när den är dyr.',
        batteriLead:     'Din värmepump gör redan jobbet. Det som är kvar att hämta ligger i din solel: ett batteri ökar värdet av elen du producerar, ungefär {battRange} per år. Stödtjänster räknar vi aldrig in i summan.',
        styrningLead:    'Din uppvärmning är redan effektiv. Det rimliga nästa steget är smart styrning: värmen styrs efter pris och behov, utan ingrepp i huset. Kräver timprisavtal. Vi sätter en siffra först när källan är granskad, därför visas den utan pris.',
        service:         'Din uppvärmning gör redan jobbet. Det som skyddar den är service: rena filter och rätt inställningar håller verkningsgraden uppe. Vi sätter ingen siffra på det här, men en genomgång av pumpens drift och styrning är ett rimligt nästa steg.',
        solplan:         'Du planerar solceller, och det är rätt ordning att ta dem först. När anläggningen är på plats blir ett batteri nästa fråga. Vi räknar gärna på hela paketet.',
        /* P2 reworded: disclose applies to NON-lead rows only — we now recommend long paybacks when they lead */
        discloseLuftvatten: 'Med dina siffror är luft-vatten återbetald först på {pbRange} år. Siffran står här som jämförelse.',
        discloseBergvarme:  'Med dina siffror är bergvärme återbetald först på {pbRange} år, och den kräver borrhål via partner. Siffran står här som jämförelse.',
        dyrare:          'Det här bytet ökar kostnaden i ditt hus. Vi visar det för ärlighetens skull.'
      },
      /* V10 (P4/AR-3): quiet action rows — "utan pris", no bar, NO invented numbers */
      actionName: { service: 'Service och trimning av värmepumpen', solplan: 'Solceller med batteri' },
      /* v30 (owner-exact): the dropdown stat-row labels */
      figInvest: 'Investering efter ROT', figPayback: 'Återbetalningstid', figSaving: 'Besparing per år',
      figEfter: 'Ny kostnad per år',
      figBattGross: 'Pris från', figBattNet: 'Efter grön teknik',
      figBehall: 'Noll kronor i investering',
      utanPris: 'utan pris', tagBehall: 'Så ligger du idag'
    },
    sbMix: {
      line: '{label} ~{share} % av värmen · ca {kr} kr per år',
      arbete: ' + ditt arbete',
      solar: 'Solel drar av ca {kr} kr av elkostnaden.'
    },
    cta: {
      /* MM7 + P1-P4: ONE main-CTA label for every branch (the soft/ghost CTA is retired);
       * sent = the m-m2 post-submit state, cleared by the next input change */
      plan: 'Få kostnadsfri rådgivning', sent: 'Skickat, vi hör av oss'
    },
    share: 'Dela din kalkyl',
    shareCopy: 'Kopiera länk',
    shareCopied: 'Länk kopierad',
    shareMailSubject: 'Kolla vad vårt hus kan spara',
    shareText: 'Räkna på ditt hus och se vad som är värt att göra.',
    shareTitle: 'Energikalkylatorn från Ampy',
    leadErr: 'Det gick inte att skicka just nu. Försök igen om en stund.',
    err: {
      name: 'Skriv ditt namn.',
      phone: 'Skriv ett nummer vi kan nå dig på.',
      zip: 'Postnumret ska vara fem siffror.',
      emailReq: 'Skriv din e-postadress.',
      email: 'Kolla e-postadressen, den ser inte komplett ut.'
    },
    methodLegal: 'Det här är en uppskattning byggd på schabloner och försiktiga antaganden. Den är inte ett erbjudande, inte ett bindande pris och inte ekonomisk rådgivning. Verklig kostnad och besparing beror på huset, avtalet och vädret, och kan bli både högre och lägre.'
  };

  /* ---------- labels for the data-driven inputs ---------- */
  var ERA_ITEMS = [
    { v: 'pre1940',    label: 'Före 1940' },
    { v: 'midcentury', label: '1940-1990' },
    { v: 'modern2010', label: '1990-2020' },
    { v: 'new2021',    label: 'Efter 2020' },
    { v: 'x',          label: 'Vet inte' }
  ];
  var SHARE_STOPS = (D.multi && D.multi.shareStops) ? D.multi.shareStops : [0.20, 0.40, 0.60];
  var SHARE_LABELS = ['Lite', 'En del', 'Mycket'];
  var DEFAULT_STOP = 1; // "En del" — maps to multi.defaultCoverage 0.40
  var MAX_ROWS = (D.rank && D.rank.maxRows) ? D.rank.maxRows : 6;

  /* ---------- inline SVG icon set (24×24, stroke 1.75; no CDN) ---------- */
  function icsvg(paths, sw) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.75) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var ICONS = {
    /* v30 heat-icon set (designer-delivered, render-verified 96/48/22px on midnight):
     * ac/hearth/building/mountain REPLACED; bolt/droplet/dropbolt/wind kept per owner verdict
     * v31: mountain redrawn as true bergvärme — a house silhouette sitting ON a full-width
     *      ground line, with a narrow vertical borehole U-loop plunging below the surface
     *      (reads ground-source, not a volcano/keyhole); hearth refined to a wood stove —
     *      flue up, rounded body, a firebox line (the door read), a flame inside, short legs.
     *      Both render-verified at real 19-22px card size + white-on-teal pressed state,
     *      weight-matched to the kept bolt across the heat-card family. */
    bolt:     icsvg('<path d="M13 3v7h6l-8 11v-7H5l8-11z"/>'),
    dropbolt: icsvg('<path d="M7.5 19.42c2.6 2.11 6.4 2.11 9 0c2.6-2.1 3.26-5.71 1.57-8.55l-4.89-7.26c-.42-.62-1.29-.8-1.94-.4a1.38 1.38 0 0 0-.41.4l-4.89 7.26c-1.7 2.84-1.04 6.44 1.56 8.55z"/><path d="M13 10l-2.5 3h3L11 16"/>'),
    flame:    icsvg('<path d="M12 12c2-2.96 0-7-1-8c0 3.04-1.77 4.74-3 6c-1.23 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.53-1.06-3.94-2-5c-1.79 3-2.79 3-4 2z"/>'),
    pellets:  icsvg('<circle cx="7" cy="16" r="3"/><circle cx="15" cy="16" r="3"/><circle cx="11" cy="8.5" r="3"/>'),
    wind:     icsvg('<path d="M5 8h8.5a2.5 2.5 0 1 0-2.34-3.24"/><path d="M3 12h15.5a2.5 2.5 0 1 1-2.34 3.24"/><path d="M4 16h5.5a2.5 2.5 0 1 1-2.34 3.24"/>'),
    building: icsvg('<path d="M2.5 18H7"/><path d="M17 18h4.5"/><path d="M7 18v-7l5-4.5 5 4.5v7"/><path d="M2.5 21.5h9.5V17"/><path d="M10 19l2-2 2 2"/>'),
    ac:       icsvg('<rect x="3.5" y="3" width="17" height="9" rx="2"/><path d="M7 8.75h10"/><path d="M8 14.75c-1 1.5-1 3.25 0 4.75"/><path d="M12 15.25c-.7 1.6-.7 3.6 0 5.25"/><path d="M16 14.75c1 1.5 1 3.25 0 4.75"/>'),
    droplet:  icsvg('<path d="M7.5 19.42c2.6 2.11 6.4 2.11 9 0c2.6-2.1 3.26-5.71 1.57-8.55l-4.89-7.26c-.42-.62-1.29-.8-1.94-.4a1.38 1.38 0 0 0-.41.4l-4.89 7.26c-1.7 2.84-1.04 6.44 1.56 8.55z"/>'),
    mountain: icsvg('<path d="M2.5 11.5h19"/><path d="M4.5 11.5V6.5L12 1.5l7.5 5v5"/><path d="M8 11.5v5a4 4 0 0 0 8 0v-5"/>'),  /* bergvärme: wide house on the ground line + a clear deep U-loop (borehole) below — reads at 22px */
    hearth:   icsvg('<path d="M12 2v3"/><rect x="6" y="5" width="12" height="12" rx="2.5"/><path d="M6 14h12"/><path d="M12 7.6c-1.3 1.4-2.1 2.4-2.1 3.6a2.1 2.1 0 0 0 4.2 0c0-1.2-.8-2.2-2.1-3.6z"/><path d="M8.5 17v2.5M15.5 17v2.5"/>'),
    sun:      icsvg('<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1"/><path d="M12 3v1"/><path d="M20 12h1"/><path d="M12 20v1"/><path d="M5.6 5.6l.7 .7"/><path d="M18.4 5.6l-.7 .7"/><path d="M17.7 17.7l.7 .7"/><path d="M6.3 17.7l-.7 .7"/>'),
    check:    icsvg('<path d="M5 12l5 5l10-10"/>', 2.2),
    chevUp:   icsvg('<path d="M6 15l6-6l6 6"/>')
  };

  /* the ONE merged heat list (L2): nine cards (8 common systems + Vet inte),
   * prevalence grid order (2-col reading order = rows). Labels DISPLAY-ONLY;
   * engine ids untouched. olja/vedpellets stay in data.js/engine (back-compat)
   * but are UI-HIDDEN: no card, and share-link decode maps them to Vet inte.
   * [MODEL prevalence order — owner may reorder at zero code risk] */
  var HEAT_CARDS = [
    { id: 'direktel',      icon: 'bolt',     label: 'Direktel' },
    { id: 'luftluftCur',   icon: 'ac',       label: 'Luft-luft' },
    { id: 'kamin',         icon: 'hearth',   label: 'Braskamin' },
    { id: 'fjarrvarme',    icon: 'building', label: 'Fjärrvärme' },
    { id: 'bergvarmeCur',  icon: 'mountain', label: 'Bergvärme' },
    { id: 'luftvattenCur', icon: 'droplet',  label: 'Luft-vatten' },
    { id: 'vattenburenEl', icon: 'dropbolt', label: 'Vattenburen el' },
    { id: 'franluft',      icon: 'wind',     label: 'Frånluftspump' },
    { id: 'vetinte',       icon: null,       label: 'Vet inte', quiet: true }
  ];
  /* systems kept in the engine but hidden from the UI card set */
  var UI_HIDDEN_SYSTEMS = { olja: true, vedpellets: true };
  function shortLabel(id) {
    for (var i = 0; i < HEAT_CARDS.length; i++) if (HEAT_CARDS[i].id === id) return HEAT_CARDS[i].label;
    return (D.currentSystems[id] && D.currentSystems[id].label) || id;
  }
  /* fjärrvärme partial-exclusive whitelist (V7-left §1.4 ruling) */
  var FJARR_COMPAT = ['kamin', 'luftluftCur'];

  /* ---------- selection state for the custom controls ---------- */
  var state = {
    priceArea: D.defaultPriceArea,
    era: 'x',                     // 'x' = Vet inte (default active) → midcentury, assumed
    eraTouched: false,
    seTouched: false,
    heat: {},                     // { systemId: { on:bool, stop:int (index), assumed:bool } }
    vetinte: false,               // the "Vet inte" heat card is active
    ownMode: 'vetinte',           // 'vetinte' | 'ja' — the own-figure seg
    ownKwh: (D.own && D.own.defaultKwh) || 20000,
    solarMode: 'nej',             // 'nej' | 'finns' | 'planeras'
    solarKwh: (D.solar && D.solar.prodDefault) || 8000,
    selectedOption: null,         // the Sparstaplarna open/selected row id (null = all collapsed)
    selectedByUser: false         // a default selection re-defaults on recalc; a tap survives
  };
  // seed the single default primary so the tool renders a real answer on first paint
  // MB1: seeded:true — an ASSUMED seed is evicted by the first real card tap
  state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true, seeded: true };

  var userTouched = false, booted = false;
  var lastRank = null, lastRec = null, lastResult = null;
  var leadSent = false;   // m-m2: post-submit sent-state, cleared by the next input change

  /* ---------- waterborne INFERENCE (L5 kill — the question is dead) ----------
   * VB_IMPLIES: any stack member ⇒ true; direktel-only + EVERY ambiguous case ⇒
   * conservative false (REVERSES v6 vedpellets:'ja'; [GAP-L1v7 → elektriker]).
   * The +60-120 tkr invest effect lives in the rec TEXT (V7-COPY riders). */
  /* V10 AR-1: + franluft — frånluftsvärmepumpar are by construction waterborne
   * (they heat radiators/VV); the omission mispriced luft-vatten/bergvärme by
   * 90-110 tkr gross on frånluft houses. [GAP-V10-1: elektriker counter-signs] */
  var VB_IMPLIES = ['fjarrvarme', 'olja', 'vattenburenEl', 'luftvattenCur', 'bergvarmeCur', 'franluft'];
  function inferWaterborne(sel) {
    var ids = [sel.primary];
    sel.complements.forEach(function (c) { ids.push(c.system); });
    for (var i = 0; i < ids.length; i++) if (VB_IMPLIES.indexOf(ids[i]) !== -1) return true;
    return false;
  }

  /* ---------- own-row visibility gate (honesty): all-electric stacks only ---------- */
  function ownRowAllowed() {
    var on = Object.keys(state.heat).filter(function (id) { return state.heat[id].on; });
    if (!on.length) on = [D.defaultCurrentSystem];
    for (var i = 0; i < on.length; i++) {
      var rec = D.currentSystems[on[i]];
      if (!rec || !rec.isElectric) return false;
    }
    return true;
  }

  /* ---------- populate the dynamic inputs once ---------- */
  function buildInputs() {
    // elområde segmented (PROMOTED; (antagande) until touched)
    buildSeg('#priceAreaSeg', Object.keys(D.priceAreas).map(function (id) {
      return { v: id, label: D.priceAreas[id].label };
    }), 'priceArea', function (v) {
      state.seTouched = true;
      track('se_area_set', { area: v });
      recompute();
    });

    // byggår segmented — 5 gap-free bands incl "Vet inte" (default active)
    buildSeg('#eraSeg', ERA_ITEMS, 'era', function (v) {
      state.eraTouched = (v !== 'x');
      var a = $('#eraAsm'); if (a) a.hidden = (v !== 'x');
      recompute();
    });

    // own-figure seg — activation IS assertion (the mid-typing defect class is impossible)
    buildSeg('#ownSeg', [
      { v: 'vetinte', label: 'Vet inte' },
      { v: 'ja', label: 'Ja, ungefär' }
    ], 'ownMode', function () {
      syncOwnUI();
      recompute();
    });

    // solceller seg — Nej / Finns / Planeras (A3 ruling; Planeras never touches dagens kostnad)
    buildSeg('#solarSeg', [
      { v: 'nej', label: 'Nej' },
      { v: 'finns', label: 'Finns' },
      { v: 'planeras', label: 'Planeras' }
    ], 'solarMode', function (v) {
      syncSolarUI();
      track('solar_mode', { mode: v });
      recompute();
    });

    buildHeatCards();
    syncCards();
    renderShareRows();
    syncOwnUI();
    syncSolarUI();
  }

  /* ========================================================================
   * LEFT — the merged icon multi-select heat picker (+ the Vet inte quiet card)
   * ====================================================================== */
  function buildHeatCards() {
    var grid = $('#hpGrid'); if (!grid) return;
    grid.innerHTML = '';
    HEAT_CARDS.forEach(function (card) {
      // only render cards for systems that exist in the data layer (vetinte is UI-only)
      if (!card.quiet && !D.currentSystems[card.id]) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ampy-ek__hp-card' + (card.quiet ? ' ampy-ek__hp-card--quiet' : '');
      b.dataset.sys = card.id;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = card.quiet
        ? '<span class="ampy-ek__hp-lbl">' + card.label + '</span>'
        : '<span class="ampy-ek__hp-ic" aria-hidden="true">' + ICONS[card.icon] + '</span>' +
          '<span class="ampy-ek__hp-lbl">' + card.label + '</span>' +
          '<span class="ampy-ek__hp-check" aria-hidden="true">' + ICONS.check + '</span>';
      b.addEventListener('click', function () { toggleCard(card.id); });
      grid.appendChild(b);
    });
  }

  function isOn(id) { return !!(state.heat[id] && state.heat[id].on); }

  var _prevHeat = null;   // m-m7: session-local undo for the Vet inte wipe

  function toggleCard(id) {
    if (id === 'vetinte') {
      if (state.vetinte) {
        // m-m7: tapping Vet inte again restores the selection it wiped
        state.vetinte = false;
        state.heat = _prevHeat ? JSON.parse(JSON.stringify(_prevHeat)) : {};
        var anyBack = Object.keys(state.heat).some(function (k) { return state.heat[k].on; });
        if (!anyBack) state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true, seeded: true };
        setHint('');
        afterHeatChange();
        return;
      }
      _prevHeat = JSON.parse(JSON.stringify(state.heat));   // m-m7: snapshot before the wipe
      // clear everything, count conservatively on direktel until the visitor knows more
      Object.keys(state.heat).forEach(function (k) { if (state.heat[k]) state.heat[k].on = false; });
      state.heat.direktel = { on: true, stop: DEFAULT_STOP, assumed: true };
      state.vetinte = true;
      setHint(S.hintVetinte);
      track('vetinte_used');
      afterHeatChange();
      return;
    }

    // any real card tap clears the vet-inte state (and its conservative default)
    if (state.vetinte) {
      state.vetinte = false;
      setHint('');
      Object.keys(state.heat).forEach(function (k) { if (state.heat[k]) state.heat[k].on = false; });
    }

    var wasOn = isOn(id);
    var fjarrOn = isOn('fjarrvarme');

    // MB1: tapping the SEEDED card claims it as a real selection (no toggle-off)
    if (wasOn && state.heat[id].seeded) {
      delete state.heat[id].seeded;
      track('heat_select', { sys: id });
      afterHeatChange();
      return;
    }

    if (!wasOn) {
      /* MB1: an ASSUMED direktel seed must never silently join the first real
       * selection — evict every seeded row before this tap lands. A genuine
       * direktel+X house re-taps Direktel (one extra tap for the rare case,
       * correct math for the common one). */
      Object.keys(state.heat).forEach(function (k) {
        if (state.heat[k] && state.heat[k].seeded) { state.heat[k].on = false; delete state.heat[k].seeded; }
      });
      if (id === 'fjarrvarme') {
        // fjärrvärme ON: partial exclusivity — clear every selected non-compat card
        Object.keys(state.heat).forEach(function (k) {
          if (state.heat[k] && state.heat[k].on && FJARR_COMPAT.indexOf(k) === -1) state.heat[k].on = false;
        });
        setHint(S.hintFjarr);
      } else if (fjarrOn && FJARR_COMPAT.indexOf(id) === -1) {
        // a non-compat card ON while fjärrvärme is on → fjärrvärme OFF, hint cleared
        state.heat.fjarrvarme.on = false;
        setHint('');
      } else if (!fjarrOn) {
        setHint('');
      }
      state.heat[id] = { on: true, stop: DEFAULT_STOP, assumed: true };
      track('heat_select', { sys: id });
    } else {
      state.heat[id].on = false;
      if (id === 'fjarrvarme') setHint('');
      // never allow an empty selection: fall back to the default primary (seeded, MB1)
      var anyOn = Object.keys(state.heat).some(function (k) { return state.heat[k].on; });
      if (!anyOn) {
        state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true, seeded: true };
        setHint('');
      }
    }
    afterHeatChange();
  }

  function afterHeatChange() {
    syncCards();
    renderShareRows();
    syncOwnUI();      // the own row's all-electric gate re-evaluates on every heat change
    recompute();
  }

  function setHint(msg) {
    var h = $('#hpHint'); if (!h) return;
    if (msg) { h.textContent = msg; h.hidden = false; } else { h.textContent = ''; h.hidden = true; }
  }

  /* reflect selection + the derived primary marker onto the cards */
  function syncCards() {
    var sel = heatSelection();
    // m-m5: when 2+ ON cards share the max share stop the primary is ambiguous — no ring
    var onIds = Object.keys(state.heat).filter(function (k) { return state.heat[k].on; });
    var maxStop = -1, maxCount = 0;
    onIds.forEach(function (k) {
      var s = state.heat[k].stop;
      if (s > maxStop) { maxStop = s; maxCount = 1; } else if (s === maxStop) maxCount++;
    });
    var stopTie = maxCount >= 2;
    el('.ampy-ek__hp-card').forEach(function (c) {
      var id = c.dataset.sys;
      var on = (id === 'vetinte')
        ? state.vetinte
        : (!state.vetinte && isOn(id));
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      c.classList.toggle('is-primary', on && id === sel.primary && sel.multi && !stopTie);
    });
  }

  /* THE derivation — produces the identical engine contract as before.
   * primary = the selected card with the largest share stop (ties broken by data order). */
  function heatSelection() {
    var on = Object.keys(state.heat).filter(function (id) { return state.heat[id].on; });
    if (!on.length) return { primary: D.defaultCurrentSystem, complements: [], multi: false };
    if (on.length === 1) return { primary: on[0], complements: [], multi: false };
    var order = Object.keys(D.currentSystems);
    var sorted = on.slice().sort(function (a, b) {
      var d = state.heat[b].stop - state.heat[a].stop;      // higher stop first
      return d !== 0 ? d : order.indexOf(a) - order.indexOf(b); // stable by data order
    });
    var primary = sorted[0];
    var complements = sorted.slice(1).map(function (id) {
      var h = state.heat[id]; var row = { system: id };
      if (!h.assumed) row.coverage = SHARE_STOPS[h.stop];    // assumed → omit → engine fills + tags isAssumed
      return row;
    });
    return { primary: primary, complements: complements, multi: true };
  }

  /* per-complement share rows: one seg per SELECTED card, only when 2+ are on. */
  function renderShareRows() {
    var box = $('#hpShares'); if (!box) return;
    var summary = $('#hpSummary');
    var sel = heatSelection();
    if (!sel.multi || state.vetinte) {
      el('.ampy-ek__hp-share-row', box).forEach(function (row) { row.remove(); });
      box.hidden = true;
      return;
    }
    box.hidden = false;

    var active = Object.keys(state.heat).filter(function (id) { return state.heat[id].on; });
    var order = Object.keys(D.currentSystems);
    active.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });

    // remove rows for cards no longer on
    el('.ampy-ek__hp-share-row', box).forEach(function (row) {
      if (active.indexOf(row.dataset.sys) === -1) row.remove();
    });
    active.forEach(function (id) {
      if ($('.ampy-ek__hp-share-row[data-sys="' + id + '"]', box)) { updateShareRowTag(id); return; }
      var rec = D.currentSystems[id];
      var c = state.heat[id];
      var card = HEAT_CARDS.filter(function (x) { return x.id === id; })[0];
      var row = document.createElement('div');
      row.className = 'ampy-ek__hp-share-row'; row.dataset.sys = id;
      var inner = document.createElement('div'); inner.className = 'ampy-ek__hp-share-inner';
      var name = document.createElement('div'); name.className = 'ampy-ek__hp-share-name';
      name.innerHTML = '<span>' + (card && card.icon ? ICONS[card.icon] : '') +
        (card ? card.label : rec.label) + '</span><span class="ampy-ek__antag"' + (c.assumed ? '' : ' hidden') + '>(antagande)</span>';
      var seg = document.createElement('div'); seg.className = 'ampy-ek__seg'; seg.setAttribute('role', 'radiogroup');
      seg.setAttribute('aria-label', 'Hur mycket ' + (card ? card.label : rec.label).toLowerCase() + ' värmer');
      inner.appendChild(name); inner.appendChild(seg);
      row.appendChild(inner);
      box.insertBefore(row, summary);
      buildShareSeg(seg, id);
      requestAnimationFrame(function () { row.classList.add('in'); setTimeout(replaceAllPills, REDUCED ? 0 : 60); });
    });
    // the primary card can flip when a share changes → refresh markers each pass
    syncCards();
  }

  function updateShareRowTag(id) {
    var row = $('.ampy-ek__hp-share-row[data-sys="' + id + '"]'); if (!row) return;
    var antag = $('.ampy-ek__antag', row); if (antag) antag.hidden = !state.heat[id].assumed;
  }

  function buildShareSeg(seg, id) {
    var c = state.heat[id];
    SHARE_LABELS.forEach(function (lbl, idx) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = lbl; b.dataset.stop = idx;
      b.setAttribute('role', 'radio');
      var isOnB = (idx === c.stop);
      if (isOnB) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); } else b.setAttribute('aria-checked', 'false');
      b.tabIndex = isOnB ? 0 : -1;
      b.addEventListener('click', function () { pickShare(seg, id, idx); });
      seg.appendChild(b);
    });
    var pill = document.createElement('span'); pill.className = 'ampy-ek__seg-pill'; pill.setAttribute('aria-hidden', 'true');
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
    var c = state.heat[id]; c.stop = idx; c.assumed = false;  // user touched it
    el('button', seg).forEach(function (x) {
      var on = +x.dataset.stop === idx;
      x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
    });
    movePill(seg, $('button.on', seg));
    updateShareRowTag(id);
    syncCards();   // a share change can move which card is primary
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
      var isOnB = (it.v === state[key]);
      if (isOnB) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); activeBtn = b; }
      else b.setAttribute('aria-checked', 'false');
      b.tabIndex = isOnB ? 0 : -1;
      b.addEventListener('click', function () {
        state[key] = it.v;
        el('button', box).forEach(function (x) {
          var sel2 = x === b;
          x.classList.toggle('on', sel2); x.setAttribute('aria-checked', sel2 ? 'true' : 'false'); x.tabIndex = sel2 ? 0 : -1;
        });
        movePill(box, b);
        if (onPick) onPick(it.v); else recompute();
      });
      box.appendChild(b);
    });
    // the single teal surface: a pill that translates under the active option
    var pill = document.createElement('span');
    pill.className = 'ampy-ek__seg-pill'; pill.setAttribute('aria-hidden', 'true');
    box.appendChild(pill);
    segBoxes.push(box);
    wireRovingKeys(box);
    requestAnimationFrame(function () {
      var prev = pill.style.transition; pill.style.transition = 'none';
      movePill(box, activeBtn || $('button.on', box) || $('button', box));
      pill.getBoundingClientRect();
      requestAnimationFrame(function () { pill.style.transition = prev; });
    });
  }

  /* set a seg's value programmatically (share-link restore, own-row reset) */
  function setSegValue(sel, key, value) {
    var box = $(sel); if (!box) return;
    state[key] = value;
    var target = null;
    el('button', box).forEach(function (b) {
      var on = b.dataset.value === value;
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      if (on) target = b;
    });
    if (target) movePill(box, target);
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
    var pill = $('.ampy-ek__seg-pill', box); if (!pill) return;
    pill.style.width = btn.offsetWidth + 'px';
    pill.style.height = btn.offsetHeight + 'px';
    pill.style.transform = 'translate(' + btn.offsetLeft + 'px,' + btn.offsetTop + 'px)';
  }

  function replaceAllPills() {
    // drop references to segs whose rows were removed (share-rows rebuild) —
    // without this the array grows a detached-DOM tail for the whole session
    segBoxes = segBoxes.filter(function (b) { return b.isConnected; });
    segBoxes.forEach(function (box) {
      if (!box.isConnected) return;
      var on = $('button.on', box); if (!on) return;
      var pill = $('.ampy-ek__seg-pill', box); if (!pill) return;
      var prev = pill.style.transition; pill.style.transition = 'none';
      movePill(box, on);
      pill.getBoundingClientRect();
      pill.style.transition = prev;
    });
  }

  /* ---------- own-figure + solar UI sync ---------- */
  function syncOwnUI() {
    var row = $('#ownRow'); if (!row) return;
    var allowed = ownRowAllowed();
    row.hidden = !allowed;
    if (!allowed && state.ownMode !== 'vetinte') {
      // fuel/fjärrvärme member entered the stack: hide AND reset (those homes
      // have no single heat-kWh bill). Slider value resets to the default.
      state.ownKwh = (D.own && D.own.defaultKwh) || 20000;
      var sl = $('#ownSlider'); if (sl) sl.value = state.ownKwh;
      var out = $('#ownOut'); if (out) out.textContent = nf(state.ownKwh) + ' kWh per år';
      setSegValue('#ownSeg', 'ownMode', 'vetinte');
    }
    var gear = $('#gearOwn');
    if (gear) {
      gear.removeAttribute('hidden');
      toggleEl(gear, allowed && state.ownMode === 'ja');
    }
    // accordion changes the card height — re-anchor the sticky-bottom fallback
    setTimeout(checkStickyIntegrity, REDUCED ? 0 : 320);
  }
  function syncSolarUI() {
    var gear = $('#gearSol');
    if (gear) {
      gear.removeAttribute('hidden');
      toggleEl(gear, state.solarMode === 'finns');
    }
    setTimeout(checkStickyIntegrity, REDUCED ? 0 : 320);
  }

  /* ---------- read the live inputs → the multi-system model (§1.5 contract) ---------- */
  function getInputs() {
    var sel = heatSelection();
    var ownActive = state.ownMode === 'ja' && ownRowAllowed();
    var actual = ownActive
      ? { mode: 'kwh', kwh: state.ownKwh, cost: null }
      : { mode: null, kwh: null, cost: null };

    return {
      current: { primary: sel.primary, complements: sel.complements, actual: actual },
      area: +$('#areaSlider').value,
      priceArea: state.priceArea,
      occupants: +$('#occupantsField').value,
      era: state.era === 'x' ? 'midcentury' : state.era,     // Vet inte → conservative middle
      indoorTemp: 21,                                        // CONSTANT (input killed, disclosed in method)
      distribution: 'radiator',                              // CONSTANT (input killed, disclosed in method)
      hasWaterborne: inferWaterborne(sel),                   // INFERRED (question killed)
      dso: 'vetej',                                          // CONSTANT (input killed ⇒ effekttopp gate OFF)
      hasSolar: state.solarMode === 'finns',
      solarKwh: state.solarMode === 'finns' ? state.solarKwh : null,
      solarPlanned: state.solarMode === 'planeras',
      vetinte: state.vetinte
    };
  }

  /* ========================================================================
   * RENDER — rank + recommend once, render the beats
   * ====================================================================== */
  function firstTouch(silent) {
    if (userTouched) return;
    userTouched = true;
    if (!silent) track('calc_first_touch');
  }

  /* rAF-throttled recompute for slider drags: the slider's own output label
   * updates immediately in its input handler; the heavy recompute runs at most
   * once per frame, and any input landing while a frame is pending is absorbed
   * (recompute reads live state at execution, so the trailing value always
   * renders). No layout-affecting work in the drag path itself. */
  var recomputeRaf = 0;
  function scheduleRecompute() {
    if (recomputeRaf) return;
    recomputeRaf = requestAnimationFrame(function () {
      recomputeRaf = 0;
      recompute();
    });
  }
  /* drag end ('change'): settle immediately — cancels any pending frame so the
   * final value always renders, even if the tab was backgrounded mid-drag */
  function settleRecompute() {
    if (recomputeRaf) { cancelAnimationFrame(recomputeRaf); recomputeRaf = 0; }
    recompute();
  }

  function recompute() {
    var inp = getInputs();
    var R = RANK.rankOptions(inp, D);
    var rec = RANK.recommend(R, inp, D);
    lastRank = R;
    lastRec = rec;
    lastResult = R.baseline.results;

    // selection reconcile: a USER pick survives while its id exists; a default
    // selection re-defaults to the lead so rail and expander always agree.
    // V10: the composite lead type is DELETED — rec.lead is always a real row.
    var rowIds = compareRowIds(R, rec);
    var defaultSel = rec.lead.id;
    // P3: a deliberate collapse (selectedByUser && null) must SURVIVE a recompute — else
    // the ★ springs back open every time the user nudges a slider.
    var surviving = state.selectedByUser &&
      (state.selectedOption === null ||
       rowIds.indexOf(state.selectedOption) !== -1 ||
       (state.selectedOption === 'batteri' && inp.hasSolar) ||
       (rec.lead.type === 'action' && state.selectedOption === rec.lead.id));
    if (!surviving) { state.selectedOption = defaultSel; state.selectedByUser = false; }

    // m-m2: any input change clears the post-submit sent-state
    if (leadSent && booted) {
      leadSent = false;
      var ctaEl = $('#ctaBtn');
      if (ctaEl && !ctaEl.classList.contains('is-close')) restoreCta();
    }

    if (booted && !userTouched) firstTouch(false);
    render(R, rec);
  }

  function render(R, rec) {
    renderAnchor(R);
    renderStorybar(R);
    renderSpark(R, rec);
    renderCtaBlock(rec);
    renderHpSummary(R);

    // complement cap note (engine clamp surfaced, never silent)
    var capNote = $('#complementCapNote');
    if (capNote) capNote.hidden = !R.baseline.results.ctx.complementClamped;

    // methodology
    $('#methodBody').innerHTML = methodHtml(R, rec);

    announceResult(R, rec);
    checkStickyIntegrity();
  }

  /* ---------- option lookup + display names ---------- */
  function optById(R, id) {
    for (var i = 0; i < R.options.length; i++) if (R.options[i].id === id) return R.options[i];
    return null;
  }
  function cardName(o) {
    if (o.id === 'luftluft') {
      var prim = shortLabel(heatSelection().primary).toLowerCase();
      return 'Behåll ' + prim + ' och komplettera med luft‑luft';   // U+2011: never break "luft-/luft" at 390px
    }
    return S.cardName[o.id] || o.label;
  }
  function leadDisplayName(id) { return S.leadName[id] || (S.cardName[id] || id).toLowerCase(); }

  /* ---------- B. the anchor = DAGENS kostnad ---------- */
  function anchorVals(R) {
    var measured = !!R.baseline.demandMeasured;
    var sp = measured ? 0 : D.demandSpread;
    // household-inclusive TOTAL: the ±15 % demand spread is heat-demand uncertainty,
    // so it applies to heat+VV only; household is a flat schablon OUTSIDE the band.
    var hv = R.baseline.spaceCost + R.baseline.vvCost;   // heat+VV (band applies here)
    var hh = R.baseline.householdCost;                   // flat schablon — NO band on it
    return {
      single: sp === 0,
      lo: Math.max(0, roundTo(hv * (1 - sp) + hh, ROUND.hero)),
      hi: Math.max(0, roundTo(hv * (1 + sp) + hh, ROUND.hero)),
      mid: Math.max(0, roundTo(hv + hh,           ROUND.hero))
    };
  }
  function anchorText(av) { return av.single ? '~' + nf(av.mid) : nf(av.lo) + '-' + nf(av.hi); }   /* range: no ~ (the span implies approx); single: keep ~ */

  function renderAnchor(R) {
    var av = anchorVals(R);
    var num = $('#anchorNum');
    // d-m3: the numeric range never wraps mid-figure
    num.innerHTML = '<span class="nowrap">' + anchorText(av) + '</span> <span class="ampy-ek__anchor-per">kr per år</span>';
    if (!REDUCED) {
      // m-p1/d-p6: retrigger the keyframe for real (remove → reflow → add)
      num.classList.remove('flash'); void num.offsetWidth; num.classList.add('flash');
    }
  }

  /* ---------- C. the story bar + the V7 member cost lines (§3.2) ---------- */
  function segWidths(vals, minPct) {
    var tot = 0; vals.forEach(function (v) { tot += Math.max(0, v); });
    if (tot <= 0) return vals.map(function () { return (100 / vals.length).toFixed(2); });
    var raw = vals.map(function (v) { return 100 * Math.max(0, v) / tot; });
    var deficit = 0, flexSum = 0;
    raw.forEach(function (p) { if (p < minPct) deficit += (minPct - p); else flexSum += (p - minPct); });
    return raw.map(function (p) {
      var out = (p < minPct) ? minPct : (p - (flexSum > 0 ? deficit * (p - minPct) / flexSum : 0));
      return out.toFixed(2);
    });
  }

  function renderStorybar(R) {
    var heat = R.baseline.spaceCost, vv = R.baseline.vvCost, house = R.baseline.householdCost;
    var w = segWidths([heat, vv, house], 6);
    var bar = $('#storyBar');
    $('.ampy-ek__sb-heat', bar).style.width = w[0] + '%';
    $('.ampy-ek__sb-vv', bar).style.width = w[1] + '%';
    $('.ampy-ek__sb-house', bar).style.width = w[2] + '%';
    $('#sbHeatKr').textContent = '~' + krStr(heat, ROUND.stat);
    $('#sbVvKr').textContent = '~' + krStr(vv, ROUND.stat);
    $('#sbHouseKr').textContent = '~' + krStr(house, ROUND.stat);

    // V7: per-member COST lines (engine currentBreakdown — never re-derived).
    // This makes a cost DROP visible and explained the moment a cheap fuel joins.
    var mix = $('#sbMix');
    var bd = R.baseline.breakdown || [];
    var lines = [];
    if (bd.length > 1) {
      bd.forEach(function (b) {
        var line = fill(S.sbMix.line, {
          label: shortLabel(b.id),
          share: Math.round(b.share * 100),
          kr: nf(roundTo(b.annual, ROUND.stat))
        });
        if (b.id === 'vedpellets' || b.id === 'kamin') line += S.sbMix.arbete;
        if (b.isAssumed) line += ' (antagande)';
        lines.push(esc(line));
      });
    }
    var solOffset = R.baseline.results.solarOffsetAnnual || 0;
    if (solOffset > 0) {
      lines.push(esc(fill(S.sbMix.solar, { kr: nf(roundTo(solOffset, ROUND.stat)) })));
    }
    if (lines.length) { mix.innerHTML = lines.join('<br>'); mix.hidden = false; }
    else { mix.textContent = ''; mix.hidden = true; }
  }

  /* ========================================================================
   * D+E. SPARSTAPLARNA (#spark) — savings bars + tap-to-expand rec
   *      (replaces the old #compare cost visual and the #recs plate/wall)
   * ====================================================================== */
  function visibleOptions(R) { return R.options.slice(0, MAX_ROWS); }

  /* V10 row set (owner P1/P5 + m-m1): SELF_EQ drops the own-system mirror (never
   * compare a system to itself); behåll renders as a CONTEXT row on the optimera*
   * action branches ONLY and is filtered out on option-lead branches. */
  function sparkRowSet(R, rec) {
    var primaryId = R.baseline.results.ctx.primaryId;
    var selfEq = { bergvarmeCur: 'bergvarme', luftvattenCur: 'luftvatten' }[primaryId] || null;
    return visibleOptions(R).filter(function (o) {
      if (selfEq && o.id === selfEq) return false;
      if (o.id === 'behall' && rec.lead.type === 'option') return false;
      return true;
    });
  }

  function compareRowIds(R, rec) {
    return sparkRowSet(R, rec).map(function (o) { return o.id; });
  }

  /* battery presentation band: durable engine rows summed, shown as an honest
   * ±10 % range rounded to 500 ([MODEL presentation band]; rates [GAP-R4-4]) */
  function battRange(R) {
    var rows = (R.baseline.results.upside.rows || []).filter(function (r) { return r.tier === 'durable'; });
    if (!rows.length) return null;
    var sum = 0; rows.forEach(function (r) { sum += r.value; });
    if (!(sum > 0)) return null;
    var lo = Math.max(0, roundTo(sum * 0.9, 500)), hi = roundTo(sum * 1.1, 500);
    return { lo: lo, hi: hi, text: (lo === hi) ? '+' + nf(lo) + ' kr' : '+' + nf(lo) + '-' + nf(hi) + ' kr' };
  }

  function sparStar() {
    return '<svg class="ampy-ek__sp-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.8 6 21l1.2-6.6L2.4 9.7l6.6-.9z"/></svg>';
  }
  function sparCaret() {
    return '<svg class="ampy-ek__sp-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6"/></svg>';
  }

  /* per-row model on the SAVING scale (money coming back, never cost remaining) */
  function sparRowProps(o, R, rec, scaleMax, wb) {
    var p = {
      id: o.id, name: cardName(o), kind: 'numeric', off: false, isRec: false,
      showFlag: false, batt: false, val: '', valClass: '', tag: null, reason: '', offReason: null,
      hasBar: false, fillPct: 0, bandLeft: 0, bandW: 0, pay: null, payWeak: false, aria: ''
    };

    // behall: a CONTEXT row — never the ★, never first [owner P1]
    if (o.id === 'behall') {
      p.kind = 'behall'; p.tag = S.spark.tagBehall;
      p.aria = p.name + '. ' + S.spark.tagBehall + '. ' + S.spark.verdict.behall + ' Visa mer.';
      return p;
    }
    // ineligible: greyed WITH reason AND the comparison number it promises (MM3)
    if (!o.eligible) {
      p.kind = 'off'; p.off = true;
      p.reason = S.reason[o.ineligibleReason] || '';
      p.offReason = o.ineligibleReason;
      if (o.numeric !== false && o.saving) {
        p.val = (o.saving[2] > 0)
          ? savRangeYr(o.saving[0], o.saving[2], ROUND.stat)
          : '~' + savRange(-o.saving[2], -o.saving[0], ROUND.stat) + ' dyrare per år';
      }
      p.aria = p.name + '. ' + (p.val ? p.val + '. ' : '') + p.reason;
      return p;
    }
    // styrning (qualitative — utan pris, no bar, no figures); carries the ★ when it IS the lead
    if (o.numeric === false) {
      p.kind = 'styrning'; p.val = S.spark.utanPris; p.valClass = 'soft';
      p.isRec = (rec.lead.id === o.id); p.showFlag = p.isRec;
      p.aria = p.name + '. Utan pris. ' + (p.isRec ? S.spark.verdict.styrningLead : S.spark.verdict.styrning) + ' Visa rekommendationen.';
      return p;
    }
    // dyrare: eligible but the change costs more — no bar, amber value, never rec
    if (o.saving[1] <= 0) {
      p.kind = 'dyrare';
      if (o.saving[0] === 0 && o.saving[2] === 0) {
        // exactly zero (slider-min corner: no heat demand left) — zero is not "dyrare"
        p.val = 'ungefär samma kostnad per år';
        p.valClass = 'amber';
        p.aria = p.name + '. Ungefär samma kostnad per år. ' + S.spark.verdict.dyrare + ' Visa mer.';
        return p;
      }
      p.val = '~' + savRange(-o.saving[2], -o.saving[0], ROUND.stat) + ' dyrare per år';
      p.valClass = 'amber';
      p.aria = p.name + '. Ungefär ' + savRange(-o.saving[2], -o.saving[0], ROUND.stat) + ' dyrare per år. ' + S.spark.verdict.dyrare + ' Visa mer.';
      return p;
    }
    // numeric option with a real saving: full bar + payback chip + dropdown
    p.hasBar = true;
    var lo = Math.max(0, o.saving[0]), hi = Math.max(0, o.saving[2]);
    p.val = savRangeYr(o.saving[0], o.saving[2], ROUND.stat);
    p.fillPct = clamp(100 * lo / scaleMax, 2, 100);
    var bandEnd = clamp(100 * hi / scaleMax, 0, 100);
    p.bandLeft = p.fillPct; p.bandW = Math.max(0, bandEnd - p.fillPct);
    if (o.paybackLow != null && o.paybackHigh != null) p.pay = pbRange(o.paybackLow, o.paybackHigh);
    p.payWeak = (o.paybackMid != null && o.paybackMid > D.rec.pbComfort);   // amber chip = visual honesty
    /* OWNER POLICY V10 (P2, root defect D4 fixed): the ★ follows the lead
     * UNCONDITIONALLY — a long payback is disclosed in the chip + verdict,
     * never used to suppress the recommendation. */
    p.isRec = (rec.lead.type === 'option' && rec.lead.id === o.id);
    p.showFlag = p.isRec;
    var sLo = nf(Math.max(0, roundTo(o.saving[0], ROUND.stat)));
    var sHi = nf(Math.max(0, roundTo(o.saving[2], ROUND.stat)));
    var iLo = o.netInvest ? nf(roundTo(o.netInvest[0], ROUND.stat)) : null;
    var iHi = o.netInvest ? nf(roundTo(o.netInvest[1], ROUND.stat)) : null;
    p.aria = p.name + '. Kan spara cirka ' + sLo + ' till ' + sHi +
      ' kronor per år på värme och varmvatten, räknat lågt ' + sLo + '. ' +
      (iLo != null ? 'Investering efter ROT cirka ' + (iLo === iHi ? iLo : iLo + ' till ' + iHi) + ' kronor. ' : '') +
      (o.paybackLow != null && o.paybackHigh != null
        ? 'Återbetald på ungefär ' + yrStr(roundTo(o.paybackLow, ROUND.payback)) + ' till ' + yrStr(roundTo(o.paybackHigh, ROUND.payback)) + ' år. '
        : '') +
      'Visa rekommendationen.';
    return p;
  }

  /* the battery pseudo-row (not a rank.js option) — mint bar on the saving scale.
   * V10: carries the ★ when the action lane leads with it (optimeraBatteri). */
  function battRowProps(R, scaleMax, rec) {
    var br = battRange(R); if (!br) return null;
    var isLead = rec.lead.type === 'action' && rec.lead.id === 'batteri';
    var p = {
      id: 'batteri', name: 'Solcellsbatteri', kind: 'batt', batt: true, off: false,
      isRec: isLead, showFlag: isLead, tag: '', valClass: '',   /* the row only renders when solar=Finns — a "kräver solel" tag would be noise */
      hasBar: true, pay: null, payWeak: false
    };
    p.val = (br.lo === br.hi) ? '+' + nf(br.lo) + ' kr/år' : '+' + nf(br.lo) + '-' + nf(br.hi) + ' kr/år';
    p.fillPct = clamp(100 * br.lo / scaleMax, 2, 100);
    var bandEnd = clamp(100 * br.hi / scaleMax, 0, 100);
    p.bandLeft = p.fillPct; p.bandW = Math.max(0, bandEnd - p.fillPct);
    p.aria = 'Solcellsbatteri. Ungefär ' + (br.lo === br.hi ? nf(br.lo) : nf(br.lo) + ' till ' + nf(br.hi)) +
      ' kronor mer per år i värde av din solel. Kräver solel. Visa rekommendationen.';
    return p;
  }

  /* V10 NEW (owner P4 / AR-3): quiet action pseudo-rows for the service/solplan
   * leads — label + "utan pris", no bar, NO figures, NO invented numbers. */
  function actionRowProps(id) {
    var name = S.spark.actionName[id] || id;
    return {
      id: id, name: name, kind: 'action', off: false, batt: false,
      isRec: true, showFlag: true, val: S.spark.utanPris, valClass: 'soft', tag: null,
      reason: '', offReason: null, hasBar: false, fillPct: 0, bandLeft: 0, bandW: 0,
      pay: null, payWeak: false,
      aria: name + '. Utan pris. ' + (S.spark.verdict[id] || '') + ' Visa rekommendationen.'
    };
  }
  function renderActionDrop(id) {
    return '<p class="ampy-ek__sp-verdict">' + esc(S.spark.verdict[id] || '') + '</p>';
  }

  function sparRowInner(p) {
    var flag = '<span class="ampy-ek__sp-flag"' + (p.showFlag ? '' : ' hidden') + '>' + sparStar() + esc(S.spark.recLabel) + '</span>';
    var valClass = 'ampy-ek__sp-val' + (p.valClass === 'soft' ? ' ampy-ek__sp-val--soft' : (p.valClass === 'amber' ? ' ampy-ek__sp-val--amber' : ''));
    var head = '<span class="ampy-ek__sp-head"><span class="ampy-ek__sp-name">' + esc(p.name) + '</span>' +
      (p.tag ? '<span class="ampy-ek__sp-tag">' + esc(p.tag) + '</span>' : '') +
      (p.val ? '<span class="' + valClass + '">' + esc(p.val) + '</span>' : '') +
      sparCaret() + '</span>';
    var barline = '';
    if (p.hasBar) {
      // the payback chip lived here; it is now shown once, in the expanded
      // "Återbetald på" column (owner: the chip duplicated that number)
      barline = '<span class="ampy-ek__sp-barline"><span class="ampy-ek__sp-track" aria-hidden="true">' +
        '<span class="ampy-ek__sp-fill" style="width:' + p.fillPct.toFixed(2) + '%"></span>' +
        (p.bandW > 0 ? '<span class="ampy-ek__sp-band" style="left:' + p.bandLeft.toFixed(2) + '%;width:' + p.bandW.toFixed(2) + '%"></span>' : '') +
        '</span></span>';
    }
    return flag + head + barline;
  }

  /* (the dead figRow helper is deleted — the stat renderer is figCols below) */

  /* slot map for the lead row's branch intro (V10 §1.5) — every number is a
   * computed engine/rank output or a signed constant, never invented */
  function branchIntroSlots(o, rec) {
    var m = {};
    if (rec.residual) {
      m.residualLabel = shortLabel(rec.residual.id).toLowerCase();
      m.residualShare = Math.round(rec.residual.share * 100);
      m.residualKr = nf(roundTo(rec.residual.annualKr, ROUND.stat));
    }
    if (o && o.saving) {
      var lo = Math.max(0, roundTo(o.saving[0], ROUND.stat)), hi = Math.max(0, roundTo(o.saving[2], ROUND.stat));
      m.savingRange = (lo === hi) ? nf(lo) : nf(lo) + '-' + nf(hi);
    }
    return m;
  }

  /* dropdown body: verdict + (numeric/battery) two figure lines.
   * V10 (owner P1-P5): the LEAD row = branchIntro + option sentence + longPbLine
   * (payback stated PLAINLY, ★ stays). Disclose strings = NON-lead rows only.
   * Reuses recNumbers/battSlots for every number; NEVER a fabricated figure. */
  /* vertical stat ROWS (owner v30) — the dropdown for any row that HAS numbers:
     one stacked row per stat, label left / value right, bigger readable type.
     Same markup desktop+mobile; accepts 2 or 3 rows. */
  function figCols(items) {
    return '<dl class="ampy-ek__sp-rows">' +
      items.map(function (c) {
        return '<div class="ampy-ek__sp-statrow"><dt class="ampy-ek__sp-statrow-k">' + esc(c.k) +
               '</dt><dd class="ampy-ek__sp-statrow-v' + (c.cls ? ' ' + c.cls : '') + '">' + esc(c.v) + '</dd></div>';
      }).join('') + '</dl>';
  }

  function renderSparDrop(o, R, rec, wb) {
    var isLead = (rec.lead.id === o.id);
    // qualitative row (no numbers): the ONLY place a text description remains
    if (o.numeric === false) {
      return '<p class="ampy-ek__sp-verdict">' + esc(isLead ? S.spark.verdict.styrningLead : S.spark.verdict.styrning) + '</p>';
    }
    // greyed / ineligible: keep the reason (candour: greyed WITH reason)
    if (!o.eligible) {
      return '<p class="ampy-ek__sp-verdict">' + esc(S.reason[o.ineligibleReason] || '') + '</p>';
    }
    // behåll context row: a short line, no columns (it is context, not a purchase)
    if (o.id === 'behall') {
      return '<p class="ampy-ek__sp-verdict">' + esc(S.spark.verdict.behall) + '</p>';
    }
    // an option that raises cost: short honest note, no positive figures to column
    if (o.saving[1] <= 0) {
      return '<p class="ampy-ek__sp-verdict">' + esc(S.spark.verdict.dyrare) + '</p>';
    }
    // THE numeric pump rows: three columns, NO paragraph (owner directive).
    // Investering efter ROT is DELIBERATELY not shown — the customer gets that number
    // by booking the advisory (sales finesse). The three that reconcile against the
    // anchor: Årskostnad efter · Årsbesparing · Återbetald på.
    // efter is computed from the DISPLAYED anchor and DISPLAYED saving (matched ends) so
    // a customer who does idag − årsbesparing lands EXACTLY on årskostnad efter.
    var n = recNumbers(o);
    var av = anchorVals(R);
    var sLo = Math.max(0, roundTo(o.saving[0], ROUND.stat));
    var sHi = Math.max(0, roundTo(o.saving[2], ROUND.stat));
    var eA = Math.max(0, av.lo - sLo), eB = Math.max(0, av.hi - sHi);
    var efterLo = Math.min(eA, eB), efterHi = Math.max(eA, eB);
    // ranges drop the "~" (the span already means "ungefär, någonstans här" — owner: the ~ made
    // the wrapped columns hard to read); a lone single value keeps the ~ as its only approx-marker
    var efter  = (efterLo === efterHi) ? '~' + nf(efterLo) + ' kr' : nf(efterLo) + '-' + nf(efterHi) + ' kr';
    var bespar = (sLo === sHi)         ? '~' + nf(sLo)     + ' kr' : nf(sLo)     + '-' + nf(sHi)     + ' kr';
    var pb = (n.pbRange && n.pbRange !== EMPTY) ? ((n.pbRange.indexOf('-') >= 0 ? n.pbRange : '~' + n.pbRange) + ' år') : EMPTY;
    var pbWeak = (o.paybackMid != null && o.paybackMid > D.rec.pbComfort);
    return figCols([
      { k: S.spark.figEfter,   v: efter },
      { k: S.spark.figSaving,  v: bespar },
      { k: S.spark.figPayback, v: pb, cls: pbWeak ? 'ampy-ek__sp-statrow-v--weak' : '' }
    ]);
  }

  function renderBattDrop(R, rec) {
    // battery is an ADD-ON, not a heating swap (no efter-total, no payback trio):
    // verdict text + its two PRICE rows in the same vertical stat style (v30).
    // Both figures come from data.js battery (signed constants, already used in copy).
    var bs = battSlots(R);
    var isLead = rec.lead.type === 'action' && rec.lead.id === 'batteri';
    var txt = isLead ? fill(S.spark.verdict.batteriLead, { battRange: bs.battRange }) : S.spark.verdict.batteri;
    return '<p class="ampy-ek__sp-verdict">' + txt + '</p>' + figCols([
      { k: S.spark.figBattGross, v: nf((D.battery && D.battery.grossFrom) || 33000) + ' kr' },
      { k: S.spark.figBattNet,   v: '~' + bs.battNet + ' kr' }
    ]);
  }

  var sparkDrawn = false;
  function renderSpark(R, rec) {
    var list = $('#sparkList'); if (!list) return;
    var wb = inferWaterborne(heatSelection());

    var rows = sparkRowSet(R, rec);

    // scaleMax over shown numeric rows incl the battery hi
    var hasSolar = state.solarMode === 'finns';
    var br = hasSolar ? battRange(R) : null;
    var maxSav = 0;
    rows.forEach(function (o) {
      if (o.numeric !== false && o.eligible && o.saving && o.saving[2] > 0) maxSav = Math.max(maxSav, o.saving[2]);
    });
    if (br) maxSav = Math.max(maxSav, br.hi);
    var scaleMax = maxSav > 0 ? 1.02 * maxSav : 1;

    /* V10 (the policy render): build ALL row models — options + batteri +
     * service/solplan pseudo-rows — BEFORE the priority sort, so the ★ lead
     * (option OR action) ALWAYS floats to the top. behåll pinning is DELETED. */
    var models = [];
    rows.forEach(function (o, i2) {
      var p = sparRowProps(o, R, rec, scaleMax, wb);
      models.push({ id: o.id, p: p, drop: p.kind === 'off' ? '' : renderSparDrop(o, R, rec, wb), i: i2 });
    });
    if (br) {
      var pbatt = battRowProps(R, scaleMax, rec);
      if (pbatt) models.push({ id: 'batteri', p: pbatt, drop: renderBattDrop(R, rec), i: rows.length });
    }
    if (rec.lead.type === 'action' && (rec.lead.id === 'service' || rec.lead.id === 'solplan')) {
      models.push({ id: rec.lead.id, p: actionRowProps(rec.lead.id), drop: renderActionDrop(rec.lead.id), i: rows.length + 1 });
    }
    /* priority: lead 0 · eligible pumps + behåll context 1 · non-lead qualitative
     * (styrning/service/solplan/batteri) 2 · greyed-with-reason 3 */
    function sparPri(m) {
      if (m.id === rec.lead.id) return 0;
      if (m.p.off) return 3;
      if (m.p.kind === 'styrning' || m.p.kind === 'action' || m.p.batt) return 2;
      return 1;
    }
    models.forEach(function (m) { m.pri = sparPri(m); });
    models.sort(function (a, b) { return a.pri !== b.pri ? a.pri - b.pri : a.i - b.i; });

    /* MM3: same-reason clustering — the reason sentence renders on the FIRST
     * off row of a consecutive same-reason group only (group note) */
    var lastReason = null;
    models.forEach(function (m) {
      if (m.p.off) {
        if (m.p.offReason && m.p.offReason === lastReason) m.p.reason = '';
        else lastReason = m.p.offReason;
      } else { lastReason = null; }
    });

    // build (full rebuild — <=7 rows, cheap; inline widths render final, no re-anim on recalc)
    // a11y: a keyboard/VoiceOver user focused inside the list must not be dropped to
    // body when a slider recompute rebuilds it — remember the row, re-focus after
    var refocusId = null;
    if (document.activeElement && list.contains(document.activeElement)) {
      var focusedItem = document.activeElement.closest ? document.activeElement.closest('.ampy-ek__sp-item') : null;
      if (focusedItem) refocusId = focusedItem.dataset.id;
    }
    list.innerHTML = '';
    function appendRow(id, p, dropHtml) {
      var item = document.createElement('div');
      item.className = 'ampy-ek__sp-item' + (p.isRec ? ' is-rec' : '') + (p.off ? ' is-off' : '') + (p.batt ? ' ampy-ek__sp-item--batt' : '');
      item.dataset.id = id;
      if (p.kind === 'off') {
        // ineligible: informational, not a button; grey number + reason (MM3), never hidden
        item.innerHTML = '<div class="ampy-ek__sp-row ampy-ek__sp-row--static">' +
          '<span class="ampy-ek__sp-head"><span class="ampy-ek__sp-name">' + esc(p.name) + '</span>' +
          (p.val ? '<span class="ampy-ek__sp-val">' + esc(p.val) + '</span>' : '') + '</span>' +
          (p.reason ? '<span class="ampy-ek__sp-note">' + esc(p.reason) + '</span>' : '') + '</div>';
        list.appendChild(item);
        return;
      }
      var open = (state.selectedOption === id);
      var dropId = 'drop-' + id;
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ampy-ek__sp-row';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-controls', dropId);
      btn.setAttribute('aria-label', p.aria);
      btn.innerHTML = sparRowInner(p);
      btn.addEventListener('click', function () { onSparkSelect(id, true); });
      var drop = document.createElement('div');
      drop.className = 'ampy-ek__sp-drop ampy-ek__gear-collapsed' + (open ? ' open' : '');
      drop.id = dropId;
      drop.innerHTML = '<div class="ampy-ek__gear-inner"><div class="ampy-ek__sp-drop-body">' + dropHtml + '</div></div>';
      item.appendChild(btn); item.appendChild(drop);
      list.appendChild(item);
    }
    models.forEach(function (m) { appendRow(m.id, m.p, m.drop); });

    // a11y: restore focus to the same row's button after the rebuild (see above)
    if (refocusId) {
      var reItem = $('.ampy-ek__sp-item[data-id="' + refocusId + '"]', list);
      var reBtn = reItem ? $('button, [tabindex="0"]', reItem) : null;
      if (reBtn) { try { reBtn.focus({ preventScroll: true }); } catch (eRf) { try { reBtn.focus(); } catch (eRf2) {} } }
    }

    // MM8: solar "Planeras" acknowledged when the solplan row is not the lead
    var section = $('#spark');
    var note = $('#sparkPlanNote');
    if (!note && section) {
      note = document.createElement('p');
      note.id = 'sparkPlanNote'; note.className = 'ampy-ek__spark-foot'; note.hidden = true;
      section.appendChild(note);
    }
    if (note) {
      var showNote = state.solarMode === 'planeras' && rec.lead.id !== 'solplan';
      note.hidden = !showNote;
      note.textContent = showNote ? S.rec.addOn.batteriPlaneras : '';
    }

    // entrance stagger (first structural paint only, reduced-motion safe)
    if (!REDUCED && !sparkDrawn) {
      list.classList.add('is-drawing');
      var fills = el('.ampy-ek__sp-fill', list);
      fills.forEach(function (f, i2) { f.style.transitionDelay = (i2 * 45) + 'ms'; });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          list.classList.remove('is-drawing');
          list.classList.add('is-drawn');
          setTimeout(function () {
            list.classList.remove('is-drawn');
            fills.forEach(function (f) { f.style.transitionDelay = ''; });
          }, 700);
        });
      });
    }
    sparkDrawn = true;
  }

  /* accordion: one dropdown open at a time; tap the open row to collapse it */
  function updateSparkOpen() {
    var list = $('#sparkList'); if (!list) return;
    el('.ampy-ek__sp-item', list).forEach(function (item) {
      var id = item.dataset.id;
      var open = (state.selectedOption === id);
      var btn = $('.ampy-ek__sp-row', item), drop = $('.ampy-ek__sp-drop', item);
      if (btn && btn.tagName === 'BUTTON') btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (drop) drop.classList.toggle('open', open);
    });
  }

  function onSparkSelect(id, userInitiated) {
    state.selectedOption = (state.selectedOption === id) ? null : id;  // toggle (one open at a time)
    if (userInitiated) state.selectedByUser = true;
    updateSparkOpen();
    if (userInitiated) {
      track('compare_select', { id: id });
      try { document.dispatchEvent(new CustomEvent('ampy:optionSelect', { detail: { id: id } })); } catch (e) {}
      if (state.selectedOption === id) {
        var name = optById(lastRank, id) ? cardName(optById(lastRank, id)).toLowerCase() : actionSpoken(id);
        var live = $('#resultLive');
        if (live) live.textContent = fill(S.rec.announce, { namn: name });
      }
    }
  }

  /* ---------- E. rec numbers (reused by the Sparstaplarna dropdowns) ---------- */
  function recNumbers(o) {
    if (!o || !o.saving) return {};
    var m = {
      savingRange: (function () {
        var lo = Math.max(0, roundTo(o.saving[0], ROUND.hero)), hi = Math.max(0, roundTo(o.saving[2], ROUND.hero));
        return (lo === hi) ? nf(hi) + ' kr' : nf(lo) + '-' + nf(hi) + ' kr';
      })(),
      investRange: (function () {
        if (!o.netInvest) return '';
        var lo = roundTo(o.netInvest[0], ROUND.stat), hi = roundTo(o.netInvest[1], ROUND.stat);
        return (lo === hi) ? nf(lo) : nf(lo) + '-' + nf(hi);
      })(),
      pbRange: (function () {
        if (o.paybackLow == null || o.paybackHigh == null) return EMPTY;
        var a = roundTo(o.paybackLow, ROUND.payback), b = roundTo(o.paybackHigh, ROUND.payback);
        return (a === b) ? yrStr(a) : yrStr(a) + '-' + yrStr(b);
      })()
    };
    return m;
  }
  function vbRangeStr() {
    var a = (D.waterborneAdder && D.waterborneAdder[0]) || 60000;
    var b = (D.waterborneAdder && D.waterborneAdder[1]) || 120000;
    return nf(a) + '-' + nf(b);
  }
  function battSlots(R) {
    var br = battRange(R);
    var gross = (D.battery && D.battery.grossFrom) || 33000;
    var rate = (D.battery && D.battery.greenTechRate) || 0.5;
    return {
      battRange: br ? br.text.replace('+', '') : '',   // br.text already ends in " kr"
      battGross: nf(gross),
      battNet: nf(roundTo(gross * (1 - rate), 500))
    };
  }

  /* ---------- F. the CTA block ---------- */
  /* MM7 + owner P1-P4: the CTA is ALWAYS the solid teal primary with the ONE
   * label — every branch now leads with a purchasable action, so the soft/ghost
   * CTA state is retired entirely. */
  function renderCtaBlock(rec) {
    var cta = $('#ctaBtn');
    if (!cta.classList.contains('is-close') && !leadSent) {
      cta.textContent = S.cta.plan;
    }
  }

  /* (the sticky mobile bar was removed on owner order — mobile flows inputs-first, result below) */

  /* ---------- the multi-system split line under the share rows ---------- */
  function renderHpSummary(R) {
    var s = $('#hpSummary'); if (!s) return;
    var bd = R.baseline.breakdown || [];
    if (bd.length > 1) {
      s.textContent = 'Vi räknar: ' + bd.map(function (b) {
        return shortLabel(b.id).toLowerCase() + ' ~' + pct(b.share);
      }).join(', ') + '.';
    } else {
      s.textContent = '';
    }
  }

  /* ---------- the ONE sr-only result announcer (debounced 800 ms) ---------- */
  var ACTION_SPOKEN = { batteri: 'solcellsbatteri', styrning: 'smart styrning', service: 'service och trimning av värmepumpen', solplan: 'solceller med batteri' };
  function actionSpoken(id) { return ACTION_SPOKEN[id] || id; }

  var liveT;
  function announceResult(R, rec) {
    clearTimeout(liveT);
    liveT = setTimeout(function () {
      var live = $('#resultLive'); if (!live) return;
      var av = anchorVals(R);
      var txt = av.single
        ? 'Idag kostar husets energi cirka ' + nf(av.mid) + ' kronor per år.'
        : 'Idag kostar husets energi cirka ' + nf(av.lo) + ' till ' + nf(av.hi) + ' kronor per år.';
      // V10: EVERY lead announces — option leads with their numbers, action leads by name
      if (rec.lead.type === 'option') {
        var o = optById(R, rec.lead.id);
        if (o && o.saving) {
          var slo = Math.max(0, roundTo(o.saving[0], ROUND.hero)), shi = Math.max(0, roundTo(o.saving[2], ROUND.hero));
          txt += ' Rimligaste vägen ser ut att vara ' + leadDisplayName(rec.lead.id) + ', ungefär ' + nf(slo) + ' till ' + nf(shi) + ' kronor lägre per år på värme och varmvatten.';
        }
      } else {
        txt += ' Vår rekommendation: ' + actionSpoken(rec.lead.id) + '.';
      }
      live.textContent = txt;
    }, 800);
  }

  /* ---------- G. methodology: bullets + legal, NO curve (R10) ----------
   * V10 §3.2 (owner point 11): every bullet verified against what the engine
   * ACTUALLY does (V10-copy B.1 executed audit) and rewritten in rost register. */
  function methodHtml(R, rec) {
    var b = R.baseline.results.ctx;
    var bd = R.baseline.breakdown || [];
    function inStack(id) { return bd.some(function (x) { return x.id === id; }); }
    var items = [];
    // 1. demand schablon (elområde named; "graddagar för ett normalår" — not "normalårskorrigerat")
    items.push('Husets värmebehov uppskattar vi från byggår, boyta, antal boende och var i landet huset ligger. Över året fördelar vi värmen efter graddagar för ett normalår.');
    // 2. household schablon — the typed-kWh path uses the flat 5 000 strip
    items.push(R.baseline.overrideMode === 'kwh'
      ? 'Hushållsel räknar vi som en fast schablon på 5 000 kWh. Den påverkas inte av valet av värme, så den står lika i alla vägar.'
      : 'Hushållsel, alltså belysning, vitvaror och elektronik, räknar vi som en försiktig schablon som växer med antalet boende. Den påverkas inte av valet av värme, så den står lika i alla vägar.');
    // 3. constants (esc-safe "grader", never the degree sign)
    items.push('Vi räknar på 21 grader inomhus och på radiatorer. Golvvärme ger värmepumpen något bättre verkningsgrad.');
    // 4. multi-system split
    if (b.isMultiSystem) {
      items.push('Värmer flera system delar vi kostnaden efter dina andelar. Komplementen täcker tillsammans högst 70 procent av värmen.');
    }
    // 5. measured demand — states the 5 000 kWh strip openly
    if (b.demandMeasured) {
      items.push('Du har angett husets årsförbrukning, så vi räknar på den i stället för schablonen. Vi drar av 5 000 kWh hushållsel och räknar resten som värme och varmvatten. Då smalnar spannet.');
    }
    // 6. field SPF
    items.push('Värmepumpars verkningsgrad räknar vi som fältmätt årsvärde, inte laboratorievärde. Att luftvärmepumpar tappar i sträng kyla ligger i siffran.');
    // 7. marginal price — SE3 anchor + the elområde adjustment stated
    items.push('Elpriset räknar vi som marginalpris: cirka 1,80 kr per kWh i SE3 med nät, skatt och moms, justerat efter ditt elområde och viktat mot vintern när värmen behövs.');
    // 8. fjärrvärme price — only when fjärrvärme is in the stack (dead olja/pellets/ved prices deleted)
    if (inStack('fjarrvarme')) {
      items.push('Fjärrvärme jämför vi på pris, inte verkningsgrad: cirka 1,20 kr per kWh, ett riksgenomsnitt. Din taxa kan ligga både över och under, kontrollera den på fakturan.');
    }
    // 9. kamin köpt-ved price + egen-ved candour — only when kamin is in the stack
    if (inStack('kamin')) {
      items.push('Braskaminen räknar vi på köpt ved, cirka 1,45 kr per kWh värme. Eldar du med egen ved blir kostnaden i kronor lägre, men ditt arbete räknar vi inte i pengar.');
    }
    // 10. waterborne inference — franluft now true in code (AR-1)
    items.push('Vattenburna element läser vi av från ditt värmesystem: fjärrvärme, vattenburen el, frånluftspumpar och vattenburna värmepumpar brukar ha det. Annars räknar vi utan, vilket ger en försiktigare kalkyl.');
    // 11. ROT + worked example for the lead option
    var rot = 'Investeringar visas efter ROT, 30 procent på arbetskostnaden. Grön teknik gäller inte värmepumpar.';
    if (rec && rec.lead.type === 'option') {
      var lo2 = optById(R, rec.lead.id);
      if (lo2 && lo2.results && lo2.results.ctx) {
        var c2 = lo2.results.ctx;
        rot += ' För ' + c2.pumpLabel.toLowerCase() + ': brutto ' + krStr(c2.gross, 500) + ', ROT ' + krStr(c2.rot, 100) + ', netto ' + krStr(c2.net, 500) + '. Förutsatt outnyttjat ROT-utrymme.';
      }
    }
    items.push(rot);
    // 12. the sort + the lead rule, described as the code actually decides (incl. the T7
    //     whole-house preference — the reviewer measured it deciding 23 % of option leads)
    items.push('Alternativen sorteras efter investeringsnivå och därefter kortast återbetalningstid, allt räknat efter ROT. Rekommendationen väljer vi på återbetalningstid. Har huset vattenburna element föredrar vi en lösning som värmer hela huset, om den är återbetald inom tio år. Inga poäng, inga vikter.');
    // 13. solar — branch on whether the offset actually applied (typed kWh ⇒ it did NOT)
    if (b.solarApplied) {
      items.push('Din solel sänker dagens kostnad med det du använder själv, försiktigt räknat. Såld överskottsel räknar vi inte in.');
    } else if (state.solarMode === 'finns' && b.demandMeasured) {
      items.push('Du har angett husets förbrukning, så din solel ligger redan i den siffran. Vi drar inte av den en gång till.');
    }
    // 14. battery — value-of-selfuse vs price-after-grön-teknik kept separate
    if (state.solarMode === 'finns') {
      items.push('Batterisiffran är värdet av ökad egenanvändning och prisstyrd laddning för ett vanligt villabatteri. Priset visas efter grön teknik, 50 procent. Stödtjänster räknar vi aldrig in i summan.');
    }
    // 15-17. effektavgift, borrhål, RSS spann
    items.push('Eventuell effektavgift från elnätsbolaget räknar vi inte med.');
    items.push('Bergvärme kräver borrhål och sker via partner.');
    items.push('Spannet i siffrorna kombinerar två osäkerheter: husets verkliga värmebehov och pumpens verkliga årsvärmefaktor. Vi räknar dem som oberoende, inte som staplade värstafall.');

    return '<ul class="ampy-ek__method-list">' +
      items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') +
      '</ul>' +
      '<p class="ampy-ek__method-legal">' + esc(S.methodLegal) + '</p>';
  }

  /* ========================================================================
   * INTERACTIONS — sliders, stepper, expander, share, lead form
   * ====================================================================== */
  function wireControls() {
    // sliders: label-first, recompute rides the rAF throttle (iOS drag perf)
    el('[data-input]').forEach(function (n) {
      var isRange = (n.type === 'range');
      n.addEventListener(isRange ? 'input' : 'change', function () {
        if (isRange) scheduleRecompute(); else recompute();
      });
      if (isRange) n.addEventListener('change', settleRecompute);
    });
    var area = $('#areaSlider'); area.addEventListener('input', function () { $('#areaOut').textContent = area.value + ' m²'; });

    // the own-figure slider (activation = assertion; bounds impossible to escape)
    var own = $('#ownSlider');
    if (own) {
      own.addEventListener('input', function () {
        state.ownKwh = +own.value;
        $('#ownOut').textContent = nf(state.ownKwh) + ' kWh per år';
        scheduleRecompute();
      });
      own.addEventListener('change', function () {
        settleRecompute();
        track('own_slider_set', { kwh_bucket: bucketKwh(state.ownKwh) });
      });
    }

    // the solar production slider
    var sol = $('#solarSlider');
    if (sol) {
      sol.addEventListener('input', function () {
        state.solarKwh = +sol.value;
        $('#solarOut').textContent = nf(state.solarKwh) + ' kWh per år';
        scheduleRecompute();
      });
      sol.addEventListener('change', settleRecompute);
    }

    // stepper (occupants) — m-m3: disabled at the 1/8 bounds; m-p1: real bump keyframe
    el('.ampy-ek__stepbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = $('#occupantsField'); var v = Math.max(1, Math.min(8, (+f.value) + (+b.dataset.dir)));
        f.value = v;
        syncStepBtns(v);
        var out = $('#occOut');
        out.textContent = v;
        if (!REDUCED) { out.classList.remove('bump'); void out.offsetWidth; out.classList.add('bump'); }
        recompute();
      });
    });
    syncStepBtns(+$('#occupantsField').value);

    // (Sparstaplarna rows wire their own tap-to-expand in renderSpark; no separate toggle)

    // share (AmpyCodec: house state only, NO identity, ever) — v30:
    // native sheet where navigator.share exists (THE premium mobile pattern);
    // otherwise a small anchored popover with Kopiera länk / mejl / Facebook.
    // The legacy button-label clipboard toast is DELETED.
    wireShare();

    // lead form (inline)
    $('#ctaBtn').addEventListener('click', openLead);
    $('#leadClose').addEventListener('click', closeLead);
    $('#leadForm').addEventListener('submit', submitLead);
    // validate-on-blur per field
    [['#leadName', validateName], ['#leadPhone', validatePhone], ['#leadZip', validateZip], ['#leadEmail', validateEmail]].forEach(function (pair) {
      var f = $(pair[0]); if (f) f.addEventListener('blur', function () { pair[1](true); });
    });
  }

  /* ---------- v30 share UX: native sheet OR anchored popover ---------- */
  function legacyCopy(url, done) {
    try {
      var tmp = document.createElement('textarea');
      tmp.value = url; document.body.appendChild(tmp); tmp.select();
      try { tmp.setSelectionRange(0, tmp.value.length); } catch (eSel) {}   // iOS textarea select quirk
      var ok = document.execCommand('copy');
      document.body.removeChild(tmp);
      if (ok) done();   // never show "Länk kopierad" when the copy actually failed
    } catch (e) {}
  }
  function wireShare() {
    var shareBtn = $('#shareBtn');
    if (!shareBtn || !CODEC) return;
    var pop = $('#sharePop');
    var popCloser = null;
    // the popup ARIA only holds where the popover path actually runs;
    // with navigator.share the button opens the native sheet instead
    if (navigator.share) {
      shareBtn.removeAttribute('aria-haspopup');
      shareBtn.removeAttribute('aria-expanded');
      shareBtn.removeAttribute('aria-controls');
    }
    function shareUrl() {
      var url = location.origin + location.pathname;
      var q = CODEC.encode(shareState());
      if (q) url += '?' + q;
      return url;
    }
    function closePop(refocus) {
      if (!pop || pop.hidden) return;
      pop.hidden = true;
      shareBtn.setAttribute('aria-expanded', 'false');
      if (popCloser) {   // remove the SAME set that openPop added
        document.removeEventListener('pointerdown', popCloser, true);
        document.removeEventListener('touchstart', popCloser, true);
        document.removeEventListener('mousedown', popCloser, true);
        popCloser = null;
      }
      if (refocus) { try { shareBtn.focus(); } catch (e) {} }
    }
    function openPop() {
      var url = shareUrl();
      var mail = $('#shareMail');
      if (mail) mail.href = 'mailto:?subject=' + encodeURIComponent(S.shareMailSubject) + '&body=' + encodeURIComponent(url);
      var fb = $('#shareFb');
      if (fb) fb.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
      pop.hidden = false;
      // flip below when the viewport space above the button is tight
      // (measure with the pop visible so offsetHeight is real)
      pop.classList.remove('ampy-ek__share-pop--below');
      var btnRect = shareBtn.getBoundingClientRect();
      if (btnRect.top < pop.offsetHeight + 12) pop.classList.add('ampy-ek__share-pop--below');
      shareBtn.setAttribute('aria-expanded', 'true');
      popCloser = function (ev) {
        if (!pop.contains(ev.target) && !shareBtn.contains(ev.target)) closePop(false);
      };
      // pointerdown = iOS 13+; the popover path serves exactly the OLDER devices
      // (no navigator.share) so fall back to touch/mouse there
      if (window.PointerEvent) document.addEventListener('pointerdown', popCloser, true);
      else { document.addEventListener('touchstart', popCloser, true); document.addEventListener('mousedown', popCloser, true); }
      var first = $('.ampy-ek__share-act', pop);
      if (first) { try { first.focus(); } catch (e) {} }
    }
    shareBtn.addEventListener('click', function () {
      track('share_click');
      if (navigator.share) {
        navigator.share({ title: S.shareTitle, text: S.shareText, url: shareUrl() }).catch(function () {});
        return;
      }
      if (!pop) return;
      if (pop.hidden) openPop(); else closePop(true);
    });
    if (!pop) return;
    // Escape closes; ArrowUp/Down walk the menu (role="menu" contract);
    // Home/End jump; Tab wraps lightly over the three rows
    pop.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closePop(true); return; }
      var items = el('.ampy-ek__share-act', pop);
      if (!items.length) return;
      var i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); return; }
      if (e.key === 'Home') { e.preventDefault(); items[0].focus(); return; }
      if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); return; }
      if (e.key === 'Tab') {
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
    var copyBtn = $('#shareCopy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = shareUrl();
        var done = function () {
          // inline confirmation swap ON THE ROW — no floating toast
          var lbl = $('.ampy-ek__share-act-lbl', copyBtn);
          if (lbl) {
            lbl.textContent = S.shareCopied;
            copyBtn.classList.add('is-done');
            setTimeout(function () { lbl.textContent = S.shareCopy; copyBtn.classList.remove('is-done'); }, 2000);
          }
          $('#shareLive').textContent = S.shareCopied;
          setTimeout(function () { $('#shareLive').textContent = ''; }, 2000);
          track('share_channel', { ch: 'copy' });
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done).catch(function () { legacyCopy(url, done); });
        } else {
          legacyCopy(url, done);
        }
      });
    }
    var mailA = $('#shareMail');
    if (mailA) mailA.addEventListener('click', function () { track('share_channel', { ch: 'mail' }); closePop(false); });
    var fbA = $('#shareFb');
    if (fbA) fbA.addEventListener('click', function () { track('share_channel', { ch: 'fb' }); closePop(false); });
  }

  /* ---------- v30 mobile jump-pill (fresh minimal build — the old #msum machinery
   * is long deleted; this shares nothing with it). v35: visible from LOAD on mobile
   * (owner call — the hesitant cold visitor is exactly who needs the hook; the old
   * arm-on-first-interaction gate hid it from them). Smooth-scrolls to #result,
   * hides while #result is in view (IO) and while the lead form is open. ---------- */
  var pillResultVisible = false;
  function pillUpdate() {
    var pill = document.getElementById('jumpPill'); if (!pill) return;
    var lead = $('#leadInline');
    var leadOpen = !!(lead && lead.classList.contains('open'));
    var mobile = window.matchMedia('(max-width:991px)').matches;
    var show = mobile && !pillResultVisible && !leadOpen;
    pill.classList.toggle('show', show);
    pill.tabIndex = show ? 0 : -1;
    pill.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  function wireJumpPill() {
    var pill = document.getElementById('jumpPill'), res = $('#result');
    if (!pill || !res) return;
    if (!('IntersectionObserver' in window)) { pill.remove(); return; }   // no IO → no pill, never a stuck one
    new IntersectionObserver(function (entries) {
      pillResultVisible = entries[0].isIntersecting;
      pillUpdate();
    }, { threshold: 0.12 }).observe(res);
    // show from load: rAF gives the entrance transition a frame on visible loads,
    // the timer is the belt for HIDDEN loads (FB in-app pre-render, background tab)
    // where rAF and IO callbacks are suspended until the page becomes visible
    requestAnimationFrame(function () { pillUpdate(); });
    setTimeout(pillUpdate, 400);
    pill.addEventListener('click', function () {
      track('jump_result');
      try { res.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); }
      catch (e) { res.scrollIntoView(); }
    });
  }

  function toggleEl(n, willOpen) { if (!n) return; n.classList.toggle('open', willOpen); }

  function syncStepBtns(v) {   // m-m3: 44px hit box kept; bound state disabled + dimmed
    el('.ampy-ek__stepbtn').forEach(function (b) {
      b.disabled = (+b.dataset.dir === -1) ? v <= 1 : v >= 8;
    });
  }

  /* DM1b sticky-BOTTOM fallback: when the input card outgrows the viewport, keep
   * position:sticky but pin its bottom edge via a negative inline top (the old
   * .static kill-switch silently killed sticky for the WHOLE session) */
  function checkStickyIntegrity() {
    var card = $('#inputForm');
    if (!card) return;
    if (window.matchMedia('(max-width:991px)').matches) { card.style.top = ''; return; }
    var tooTall = card.scrollHeight > (window.innerHeight - 48);
    card.style.top = tooTall ? (window.innerHeight - card.offsetHeight - 24) + 'px' : '';
  }

  /* ---------- the URL codec: share state out, prefill in (house state ONLY) ---------- */
  var ERA_TOKEN = { pre1940: 'e1', midcentury: 'e2', modern2010: 'e3', new2021: 'e4' };
  var TOKEN_ERA = { e1: 'pre1940', e2: 'midcentury', e3: 'modern2010', e4: 'new2021', x: 'x' };
  var M2_MID = { b1: 80, b2: 130, b3: 180, b4: 250 };

  function areaBand(a) { return a < 100 ? 'b1' : a <= 150 ? 'b2' : a <= 200 ? 'b3' : 'b4'; }

  function shareState() {
    var sel = heatSelection();
    var ownActive = state.ownMode === 'ja' && ownRowAllowed();
    return {
      sys: sel.primary,
      comps: sel.complements.map(function (c) {
        return { system: c.system, stop: (state.heat[c.system] && state.heat[c.system].stop != null) ? state.heat[c.system].stop : DEFAULT_STOP };
      }),
      m2: areaBand(+$('#areaSlider').value),
      era: state.era === 'x' ? 'x' : (ERA_TOKEN[state.era] || null),
      kwh: ownActive ? state.ownKwh : null,
      se: state.priceArea,
      sol: state.solarMode === 'planeras' ? { mode: 'p' }
         : state.solarMode === 'finns' ? { mode: 'f', kwh: state.solarKwh }
         : null
    };
  }

  function applyDecoded() {
    if (!CODEC) return false;
    var dec = CODEC.decode(location.search);
    var any = false;
    if (dec.sys && D.currentSystems[dec.sys]) {
      if (UI_HIDDEN_SYSTEMS[dec.sys]) {
        // UI-hidden system (olja/vedpellets) in an old share link: map to the
        // Vet inte state so no card-less selection can ever render (seeded, MB1)
        state.heat = {};
        state.heat[D.defaultCurrentSystem] = { on: true, stop: DEFAULT_STOP, assumed: true, seeded: true };
        state.vetinte = true;
        setHint(S.hintVetinte);
        any = true;
      } else {
        state.heat = {};
        state.heat[dec.sys] = { on: true, stop: DEFAULT_STOP, assumed: true };
        any = true;
      }
    }
    dec.comps.forEach(function (c) {
      // hidden systems are skipped; the Vet inte state stays pure (no complements)
      if (state.vetinte || UI_HIDDEN_SYSTEMS[c.system]) return;
      if (D.currentSystems[c.system] && c.system !== dec.sys) {
        state.heat[c.system] = { on: true, stop: c.stop, assumed: false };
        any = true;
      }
    });
    if (dec.m2 && M2_MID[dec.m2]) {
      $('#areaSlider').value = M2_MID[dec.m2];
      $('#areaOut').textContent = M2_MID[dec.m2] + ' m²';
      any = true;
    }
    if (dec.era && TOKEN_ERA[dec.era]) {
      state.era = TOKEN_ERA[dec.era] === 'x' ? 'x' : TOKEN_ERA[dec.era];
      state.eraTouched = dec.era !== 'x';
      any = true;
    }
    // v7: ?kwh honoured ONLY when the decoded stack is all-electric; clamped to the
    // slider band + rounded to step. Legacy ?kr / ?vb: decoded and DROPPED silently
    // (schablon + inference take over).
    if (dec.kwh && ownRowAllowed()) {
      var mn = (D.own && D.own.min) || 5000, mx = (D.own && D.own.max) || 60000, st = (D.own && D.own.step) || 500;
      state.ownMode = 'ja';
      state.ownKwh = clamp(roundTo(dec.kwh, st), mn, mx);
      var sl = $('#ownSlider');
      if (sl) { sl.value = state.ownKwh; }
      var out = $('#ownOut'); if (out) out.textContent = nf(state.ownKwh) + ' kWh per år';
      any = true;
    }
    if (dec.sol) {
      if (dec.sol.mode === 'p') { state.solarMode = 'planeras'; any = true; }
      else if (dec.sol.mode === 'f') {
        state.solarMode = 'finns';
        var smn = (D.solar && D.solar.prodMin) || 2000, smx = (D.solar && D.solar.prodMax) || 12000, sst = (D.solar && D.solar.prodStep) || 500;
        if (dec.sol.kwh) state.solarKwh = clamp(roundTo(dec.sol.kwh, sst), smn, smx);
        var ss = $('#solarSlider'); if (ss) ss.value = state.solarKwh;
        var so = $('#solarOut'); if (so) so.textContent = nf(state.solarKwh) + ' kWh per år';
        any = true;
      }
    }
    if (dec.se && D.priceAreas[dec.se]) { state.priceArea = dec.se; state.seTouched = true; any = true; }
    return any;
  }

  function syncAsmTags() {
    var e = $('#eraAsm'); if (e) e.hidden = state.era !== 'x';
  }

  /* ---------- lead validation (required: namn + telefon + postnr + e-post; consent via submit) ---------- */
  function setErr(fieldSel, errSel, msg) {
    var f = $(fieldSel), e = $(errSel);
    if (msg) { f.setAttribute('aria-invalid', 'true'); e.textContent = msg; e.hidden = false; return false; }
    f.removeAttribute('aria-invalid'); e.hidden = true; return true;
  }
  function validateName(live) {
    var v = $('#leadName').value.trim();
    if (!v && live !== 'silent') return setErr('#leadName', '#errName', S.err.name);
    if (!v) return false; return setErr('#leadName', '#errName', null);
  }
  function validatePhone(live) {
    var v = $('#leadPhone').value.trim();
    var ok = v.replace(/\D/g, '').length >= 7;   // m-m8: at least 7 DIGITS, punctuation-agnostic
    if (!ok) return setErr('#leadPhone', '#errPhone', S.err.phone);
    return setErr('#leadPhone', '#errPhone', null);
  }
  function validateZip(live) {
    var v = $('#leadZip').value.replace(/\s/g, '');
    if (!/^\d{5}$/.test(v)) return setErr('#leadZip', '#errZip', S.err.zip);
    return setErr('#leadZip', '#errZip', null);
  }
  function validateEmail(live) {
    var v = $('#leadEmail').value.trim();
    if (!v) return setErr('#leadEmail', '#errEmail', S.err.emailReq);   // now REQUIRED (owner)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return setErr('#leadEmail', '#errEmail', S.err.email);
    return setErr('#leadEmail', '#errEmail', null);
  }

  function openLead() {
    var w = $('#leadInline'); w.removeAttribute('hidden');
    // m-m2: after a sent lead, reopening shows the success state, never a blank re-submittable form
    $('#leadForm').hidden = leadSent;
    $('#leadSuccess').hidden = !leadSent;
    var cta = $('#ctaBtn'); var open = !w.classList.contains('open');
    toggleEl(w, open); cta.setAttribute('aria-expanded', open ? 'true' : 'false');
    pillUpdate();   // the jump-pill hides while the lead form is open
    if (open) {
      track('lead_open');
      cta.classList.add('is-close');
      cta.disabled = false;
      cta.innerHTML = 'Stäng ' + ICONS.chevUp;
      /* MB2: the form opens BELOW the fold — scroll it into view; auto-focus only
       * on pointer devices (on touch the iOS keyboard would cover the form) */
      setTimeout(function () {
        try { w.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'nearest' }); } catch (e) {}
        if (!window.matchMedia('(hover:none)').matches) {
          // focus AFTER the smooth scroll settles — focusing mid-scroll cancels it in some Chromium versions
          setTimeout(function () {
            try { $('#leadName').focus({ preventScroll: true }); } catch (e2) {}
          }, REDUCED ? 0 : 420);
        }
      }, REDUCED ? 0 : 240);
    } else {
      restoreCta();
    }
  }

  function closeLead() {
    var w = $('#leadInline');
    toggleEl(w, false);
    var cta = $('#ctaBtn'); cta.setAttribute('aria-expanded', 'false');
    restoreCta();
    pillUpdate();
    try { cta.focus(); } catch (e) {}
  }

  function restoreCta() {
    var cta = $('#ctaBtn');
    cta.classList.remove('is-close');
    if (leadSent) {
      // m-m2 sent-state: label + disabled until any input changes (recompute clears it)
      cta.textContent = S.cta.sent;
      cta.disabled = true;
    } else {
      cta.textContent = S.cta.plan;   // MM7: the ONE label, always solid
      cta.disabled = false;
    }
  }

  function submitLead(e) {
    e.preventDefault();
    if ($('#leadCompany').value) { return; } // honeypot tripped: silently drop
    var okName = validateName(true), okPhone = validatePhone(true), okZip = validateZip(true), okEmail = validateEmail(true);
    if (!(okName && okPhone && okZip && okEmail)) {
      var firstBad = $('[aria-invalid="true"]'); if (firstBad) firstBad.focus();
      return;
    }
    $('#leadErr').hidden = true;
    try {
      var R = lastRank, rec = lastRec;
      var sel = heatSelection();
      var ownActive = state.ownMode === 'ja' && ownRowAllowed();
      // the lead row's DISPLAYED numbers, so the advisor calls prepared (null-safe when action-lead)
      var leadOpt = (R && rec && rec.lead.type === 'option') ? optById(R, rec.lead.id) : null;
      // attribution: campaign params survive to the CRM (utm_*, fbclid, gclid) + referrer
      var attr = {};
      try {
        var q = new URLSearchParams(location.search);
        q.forEach(function (v, k) { if (/^(utm_|fbclid|gclid)/.test(k)) attr[k] = v; });
      } catch (eq) {}
      // webhook stays the console-logged owner-gated stub — but the payload is CRM-complete
      // pressing the submit button IS the consent (text under the button) — timestamp it
      var payload = {
        leadId: 'lm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
        consentTs: new Date().toISOString(),
        name: $('#leadName').value.trim(),
        phone: $('#leadPhone').value.trim(),
        email: $('#leadEmail').value.trim(),
        zip: $('#leadZip').value.trim(),
        hp_extra: $('#leadCompany').value,   // §8: honeypot travels so the server can drop bots too
        primary: sel.primary,
        complements: sel.complements.map(function (c) { return c.system; }),
        override: (R && R.baseline.overrideMode) || null,
        area: $('#areaSlider').value,
        era: state.era,                              // byggår band ('x' = vet inte)
        occupants: +$('#occupantsField').value,
        priceArea: state.priceArea,
        seAssumed: !state.seTouched,
        solarMode: state.solarMode,
        solarKwh: state.solarMode === 'finns' ? state.solarKwh : null,
        branch: R ? R.verdict.branch : null,
        recBranch: rec ? rec.branch : null,
        recLead: rec ? rec.lead.id : null,
        recLeadType: rec ? rec.lead.type : null,     // V10: option | action
        recLongPb: rec ? !!rec.longPb : null,        // V10: honest-payback flag
        recSavingLo: leadOpt ? Math.max(0, roundTo(leadOpt.saving[0], ROUND.stat)) : null,
        recSavingHi: leadOpt ? Math.max(0, roundTo(leadOpt.saving[2], ROUND.stat)) : null,
        recPaybackMid: (leadOpt && leadOpt.paybackMid != null) ? roundTo(leadOpt.paybackMid, ROUND.payback) : null,
        best: R ? R.verdict.bestOptionId : null,
        savingBucket: R ? bucketKr(R.verdict.bestSavingMid) : '0',
        kwhBucket: ownActive ? bucketKwh(state.ownKwh) : null,
        attribution: attr,
        referrer: document.referrer || null,
        page: location.href.split('?')[0]
      };
      postLead(payload);
      track('lead_submit', { branch: rec ? rec.branch : null });
      leadSent = true;   // m-m2: sent-state until the next input change
      $('#leadForm').hidden = true;
      var ok = $('#leadSuccess');
      ok.hidden = false;
      try { ok.focus(); } catch (e3) {}
    } catch (e2) {
      var err = $('#leadErr');
      err.textContent = S.leadErr;
      err.hidden = false;
    }
  }

  /* ---------- resize: re-place the sliding pills (bars are % width, no re-measure) ---------- */
  window.addEventListener('resize', function () {
    replaceAllPills();
    checkStickyIntegrity();
    pillUpdate();   // crossing the 991 breakpoint re-gates the jump-pill
  });

  /* ---------- boot ---------- */
  function boot() {
    // belt-and-braces: a throwing decode must NEVER stop the tool from rendering —
    // fall back to defaults (the codec itself also skips malformed params)
    var decodedAny = false;
    try { decodedAny = applyDecoded(); } catch (eBoot) {}   // ?-param prefill (house state only, no identity)
    buildInputs();
    syncAsmTags();
    wireControls();
    wireJumpPill();
    if (decodedAny) firstTouch(true);   // a shared link counts as touched (no assumed-state notes)
    recompute();
    booted = true;

    if (!REDUCED) {
      var res = $('#result');
      var bar = $('#storyBar');
      bar.classList.add('is-drawing');
      requestAnimationFrame(function () {
        res.classList.add('enter');
        requestAnimationFrame(function () {
          bar.classList.add('is-drawn');
          bar.classList.remove('is-drawing');
        });
        setTimeout(function () {
          res.classList.remove('enter');
          bar.classList.remove('is-drawn');
        }, 700);
      });
    }
  }
  function bootAll() {
    var roots = document.querySelectorAll('.ampy-ek');
    Array.prototype.forEach.call(roots, function (root) {
      if (root.dataset.booted === '1') return;
      root.dataset.booted = '1';
      ROOT = root;                            // scope every $/el default to THIS instance
      boot();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAll); else bootAll();

  /* font swap changes button widths: re-place every sliding pill once Outfit lands */
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(function () { replaceAllPills(); });
  }

})();
})();
