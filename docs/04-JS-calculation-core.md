# 04 — JS Calculation Core (the frozen layer)

**Audience:** Chris (WordPress / Bricks / FluentSnippets developer)
**Scope:** the three JavaScript files that compute every number the Energikalkylator shows.
**Files covered:**
- `vB/data.js` (427 lines) — the data layer (every coefficient)
- `vB/engine.js` (648 lines) — the pure calculation engine
- `vB/rank.js` (525 lines) — the ranking / recommendation / URL-codec layer

> Cross-reference: the WordPress port of these files is documented in **doc 06**. This document explains *what they are and what they expose*; doc 06 explains *how to wire them into Bricks*. A one-line port summary is at the end of this file (§7).

---

## 1. The frozen layer — the one rule that governs everything here

These three files are **audited and frozen**. The numbers in `data.js` are signed off (or explicitly `[GAP]`-tagged pending sign-off) in a **separate** process. `engine.js` and `rank.js` are **pure logic with zero hardcoded numbers** — every value they use is read from the `D` object (which *is* `window.AMPY_DATA`, defined in `data.js`).

**The rule, stated plainly:**

| To change… | Edit… | Never touch… |
|---|---|---|
| a number, price, rate, coefficient, SPF, gross cost | **`data.js` only** | engine.js, rank.js |
| calculation behaviour / logic | (frozen — do not) | — |

`engine.js` header states it directly (lines 2–4): *"PURE CALCULATION. No DOM. No hardcoded numbers (everything comes from D = AMPY_DATA). Same inputs + same D → same outputs."* `rank.js` header (line 12): *"engine.js math is FROZEN; this file only calls it. data.js owns every number."*

**What this means for Chris:** you do **not** modify these files' logic. You **connect** them — load them so the globals exist, then call the public API from your renderer. If a number is ever wrong, the fix is a one-line edit in `data.js`, made by the owner/expert who signs it, never a code change in engine/rank.

**Confirmed:** there are **no `_`-prefixed internal/private keys** in `data.js` — every key is a real, read intended coefficient.

---

## 2. The public API (the four global handles)

Loading the three scripts (in order: `data.js`, `engine.js`, `rank.js`) attaches four globals to `window`. These are the entire surface Chris interacts with.

### 2.1 `window.AMPY_DATA`
The data object itself (see §3). Passed as the second argument `D` to every engine/rank function. Assigned at `data.js:19`.

### 2.2 `window.AmpyEngine`
Mounted at `engine.js:646` (`.calculate`) and extended at `rank.js:521` (`.rankOptions`).

| Function | Signature | Returns |
|---|---|---|
| `AmpyEngine.calculate` | `calculate(inputs, D)` | the full results object (§2.6) — one scenario, one chosen pump |
| `AmpyEngine.rankOptions` | `rankOptions(inputs, D)` | the ranked-options object (§5.1) — every option compared |

`rankOptions` is defined in `rank.js` but **attached onto `AmpyEngine`** at `rank.js:521` (`if (global.AmpyEngine) global.AmpyEngine.rankOptions = rankOptions;`). This is why `rank.js` must load **after** `engine.js`.

### 2.3 `window.AmpyRank`
Mounted at `rank.js:522`. Four functions:

| Function | Signature | Returns |
|---|---|---|
| `rankOptions` | `rankOptions(inputs, D)` | same as `AmpyEngine.rankOptions` (the truth table — every option, deterministic sort) |
| `recommend` | `recommend(R, inputs, D)` | the advice layer (§5.2). `R` is the **object returned by `rankOptions`** |
| `costSplit` | `costSplit(base, inputs, D)` | `{ heatingKr, vvKr, householdKr }` for the anchor decomposition. `base` is a `calculate()` result |
| `netInvestRange` | `netInvestRange(pu, wb, D)` | `[netLow, netHigh]` kr — resolves the waterborne tri-state honestly. `pu` = a pump record, `wb` = `true`/`false`/`null` |

### 2.4 `window.AmpyCodec`
Mounted at `rank.js:523`. The URL codec (§5.3):

| Function | Signature | Returns |
|---|---|---|
| `encode` | `encode(state)` | a query string (no leading `?`), e.g. `sys=direktel&kmp=kamin.2&m2=b3&era=e2&kwh=18000&se=SE3` |
| `decode` | `decode(search)` | a plain state object `{ sys, comps, m2, era, vb, kwh, kr, se, sol }` (all nullable) |

### 2.5 The `inputs` object (what you feed `calculate`)
Documented at `engine.js:81–91`. All fields optional except the N1 inputs, which default in `app.js`. Shape:

```
inputs = {
  // V3 current-state model:
  current: {
    primary:     '<currentSystem id>',        // single, defaulted to D.defaultCurrentSystem
    complements: [ { system:'<id≠primary>', coverage:0..1 }, ... ],  // 0..N
    actual:      { mode:'kwh'|'cost'|null, kwh:Number|null, cost:Number|null,
                   includesHousehold:true|undefined }  // flag-gated household strip
  },
  // Legacy (still accepted; internally shimmed):
  currentSystem: '<id>',    // string  → becomes current.primary
  annualKwh:     Number,    // → becomes current.actual = {mode:'kwh', kwh:...}
  // Shared house fields:
  area, priceArea, occupants, era, indoorTemp, distribution, pump,
  hasWaterborne,            // true | false | null/undefined ("vet ej")
  dso,                      // 'vetej'|'ellevio'|'vattenfall'|'eon'
  hasSolar,                 // boolean → adds the solar/battery upside rows
  solarKwh,                 // Number  → the L6 solar self-consumption OFFSET (current-side)
  // rank/recommend-only extras:
  solarPlanned, vetinte     // booleans that steer recommend() branches
}
```

Note the two different solar fields: `hasSolar` (boolean, drives the *upside* rows) and `solarKwh` (a number, drives the *current-side self-consumption offset*, gated off when demand is measured — see §4).

### 2.6 The `calculate()` return object (read `engine.js:603–642`)
A flat object of **raw floats** — the renderer does all rounding. Key members:

| Member | Line | What it is |
|---|---|---|
| `ctx` | 605–621 | resolved context for labels/footnotes: `currentLabel`, `currentDisplayLabel`, `primaryId`, `primaryShare`, `isMultiSystem`, `pumpLabel`, `pumpId`, `servedShare`, `priceArea`, `era`, `gross`, `rot`, `net`, `rotRate`, `laborShare`, `spfBase`, `spfRange`, `isGround`, `usedTypedKwh`, `overrideMode`, `demandMeasured`, `solarApplied`, `solarKwh`, `footprintFlag`, `householdCostStripped` |
| `combined`, `spaceHeat`, `vv` | 623 | demand in kWh (total heat+VV, space-only, hot-water) |
| `monthHeat`, `currentCost`, `pumpCost` | 625 | the 12-month arrays (kr) — **the chart data** |
| `spaceHeatMonthly`, `vvMonthly` | 627 | the two terms of `monthHeat` (for the exact cost split) |
| `pumpCostLow`, `pumpCostHigh`, `SPFeff`, `price` | 628 | the confidence ribbon + monthly SPF + monthly price |
| `currentBreakdown` | 630 | the blended current-state split (stacked area + readout) |
| `currentAnnual`, `pumpAnnual` | 632 | the two annual totals (kr) |
| `heroSaving`, `heroLow`, `heroHigh` | 633 | **the hero number** + its ± band (kr/yr) |
| `payback`, `paybackLow`, `paybackHigh` | 635 | payback (years) mid + range |
| `efficientFlag`, `noSaving` | 637 | the honest verdict branches |
| `solarOffsetAnnual` | 639 | applied annual solar offset (kr) |
| `comparison`, `upside`, `co2Tons`, `savedKwh` | 641 | the per-system comparison, labelled upside rows, CO₂ placeholder |

**The load-bearing guarantee (engine.js:6–8):**
`heroSaving === currentAnnual − pumpAnnual === (sum of the monthly curve gaps)`. The chart endpoints and the hero number are the same math. Do not recompute the hero in the renderer — read `heroSaving`.

---

## 3. `data.js` section by section

`data.js` is a single object literal assigned to `window.AMPY_DATA` (line 19). Provenance tags: **`[FACT]`** = sourced, **`[DERIVED]`** = computed from a sourced method, **`[MODEL]`** = modelling assumption, **`[GAP-x]`** = needs owner/expert sign-off (lines 15–16).

### 3.1 `meta.rounding` (lines 22–24)
| Key | Value | Unit | Provenance |
|---|---|---|---|
| `hero` | 1000 | kr | rounding step, renderer only |
| `stat` | 500 | kr | rounding step, renderer only |
| `payback` | 0.5 | years | rounding step, renderer only |

Comment (line 23): *"round only in the renderer."* The engine never rounds; these tell the renderer how.

### 3.2 `intensityByEra` (lines 32–37) + `defaultEra` (line 39)
Heat-demand intensity, **kWh/m²·yr** (heating + VV combined for a ~2-person baseline home).

| Key | Value | Provenance |
|---|---|---|
| `pre1940` | 125 | `[FACT]` conservative high end of 110–125 |
| `midcentury` | 110 | `[FACT]` 1970–1990-tal el-villa |
| `modern2010` | 50 | `[FACT]` 2010-tal |
| `new2021` | 39 | `[FACT]` 2021+ |
| `defaultEra` | `'midcentury'` | `[MODEL]` |

Source: Energimyndigheten energistatistik för småhus (2016 + 2024/2025). Open: `[GAP-R3-1]` firm the era×fuel split before printing exact.

### 3.3 `pumps` (lines 49–90) + `defaultPump` (line 91)
Field SPF (verklig årsvärmefaktor — **conservative field SPF, not energimärkning SCOP**) plus per-pump gross cost and labour share. Three records:

| id | label | `spf` | `spfRange` | `gross` (kr) | `grossNoWaterborne` (kr) | `laborShare` | flags |
|---|---|---|---|---|---|---|---|
| `luftluft` | Luft-luft | 2.7 | [2.5, 3.0] | 28000 | — | 0.30 | `isComplement:true`, `servedShare:0.7`, `requiresWaterborne:false` |
| `luftvatten` | Luft-vatten | 2.7 | [2.5, 3.0] | 130000 | 220000 | 0.30 | `requiresWaterborne:true`, `servedShare:1.0` |
| `bergvarme` | Bergvärme | 3.0 | [2.7, 3.2] | 190000 | 280000 | 0.35 | `isGround:true`, `requiresWaterborne:true`, `footprintFlag:'via partner'` |

Units: `spf` dimensionless; `gross`/`grossNoWaterborne` = kr installed; `laborShare` = fraction of gross that is ROT-eligible labour; `servedShare` = fraction of home a komplement heats.
Provenance: SPF points `[FACT]`/`[GAP-R1-1]`; gross figures `[GAP-R2-1]`; `servedShare 0.7` `[MODEL]`+`[GAP]`; bergvärme footprint `[GAP-R2-4]`. `defaultPump = 'luftvatten'` `[MODEL]` (line 91). Candour invariant 6 is encoded in `isComplement`/`servedShare` (luft-luft is a komplement, never whole-house).

### 3.4 `framledning` (lines 98–102) + `defaultDistribution` (line 103)
Distribution-temperature SPF factor (lower supply temp → higher SPF).

| Key | Value | Provenance |
|---|---|---|
| `golvvarme` | 1.10 | `[FACT]` / `[GAP-R1-5]` |
| `radiator` | 1.00 | baseline / default |
| `hogtemp` | 0.90 | `[FACT]` / `[GAP-R1-5]` |
| `defaultDistribution` | `'radiator'` | `[MODEL]` conservative |

### 3.5 Electricity price + region factors (lines 113–127)
| Key | Value | Unit | Provenance |
|---|---|---|---|
| `marginalPriceSE3` | 1.80 | kr/kWh, all-in marginal, annual | `[FACT]` (corroborated varmekalkyl.se 2026); `[GAP-R-price]` owner signs |
| `priceAreas.SE1.factor` | 0.82 | multiplier on marginal price | `[FACT]` / `[GAP-price-region]` |
| `priceAreas.SE2.factor` | 0.85 | " | `[FACT]` / `[GAP-price-region]` |
| `priceAreas.SE3.factor` | 1.00 | " (baseline) | `[FACT]` |
| `priceAreas.SE4.factor` | 1.10 | " | `[FACT]` |
| `defaultPriceArea` | `'SE3'` | — | `[FACT]` live footprint = Stockholm = SE3 |

**Important:** these price-region factors (SE1 0.82 / SE2 0.85 / SE3 1.00 / SE4 1.10) are a **different physical quantity** from the battery arbitrage region factors in `upsideRates.regionFactor` (SE1 0.55 / SE2 0.70 / SE3 1.00 / SE4 1.55). They are deliberately kept separate (lines 117–120).

### 3.6 `zoneFactor` (lines 133–138)
Air-source SPF haircut + demand-per-m² north/south adjustment, keyed by elområde.

| Zone | `demand` | `airSpf` | Provenance |
|---|---|---|---|
| SE1 | 1.15 | 0.80 | `[FACT]`/`[GAP-R1-2]` coldest |
| SE2 | 1.08 | 0.88 | " |
| SE3 | 1.00 | 1.00 | baseline |
| SE4 | 0.95 | 1.05 | " mildest |

### 3.7 Monthly shape vectors (lines 146–173)
All are 12-element arrays, order **J F M A M J J A S O N D**; the engine normalises them.

| Key | Line | What / unit | Provenance |
|---|---|---|---|
| `ddShape.SE3` | 147 | degree-day heating shape (Σ→1) — the februari-stapeln | `[DERIVED]` HDD base 17°C SMHI; `[GAP-R3-4]` per-elområde vector owed (SE1/2/4 fall back to SE3) |
| `vvShape` | 154 | hot-water monthly factor (near-flat) | `[MODEL]` |
| `months` / `monthsLong` | 157–158 | month labels | — |
| `priceShape` | 165 | winter-heavier price multiplier (normalised to mean = marginalPriceSE3) | `[MODEL]` / `[GAP-R-price]` |
| `airSagStrength` | 173 | 1.4 — deep-winter air-SPF sag strength | `[INFERENCE]` / `[GAP-R4-1]` |

### 3.8 Household electricity (lines 178–182)
The strip constant that separates heating from appliances.

| Key | Value | Unit | Provenance |
|---|---|---|---|
| `household` | 5000 | kWh/yr | STRIP CONSTANT — engine kWh-strip; `[GAP-R3]`. **"do NOT change (re-signs savings)"** |
| `householdModel.baseKwh` | 3000 | kWh | DISPLAY-ONLY (read by `rank.js costSplit`); `[GAP-HH-1]` |
| `householdModel.perOccupantKwh` | 1000 | kWh/occupant | " (2 occ → 5000 == strip constant) |

`household` (5000) feeds the *savings* math (engine strip); `householdModel` feeds only the *anchor display decomposition* in `costSplit` — never a saving/payback.

### 3.9 Hot water + indoor temp (lines 188–195)
| Key | Value | Unit | Provenance |
|---|---|---|---|
| `vvPerPerson` | 1000 | kWh/person·yr | `[FACT]` / `[GAP-R3-2]` |
| `defaultOccupants` | 2 | persons | — |
| `tempSensitivity` | 0.04 | fraction per +1°C | `[FACT]` (degree-day balance point) |
| `defaultIndoorTemp` | 21 | °C | — |

### 3.10 `currentSystems` (lines 202–220) + `defaultCurrentSystem` (line 221)
The replaced (current) system efficiencies. Primary systems + complement-capable classes.

| id | label | `isElectric` | `efficiency` | flags | Provenance |
|---|---|---|---|---|---|
| `direktel` | Direktverkande el | true | 1.00 | canComplement | `[FACT]` |
| `vattenburenEl` | Vattenburen el | true | 0.95 | canComplement | `[GAP-R1-3]` |
| `olja` | Oljepanna | false | 0.85 | canComplement, fuelPrice path | `[GAP-R1-3]` |
| `vedpellets` | Ved / pellets | false | 0.75 | canComplement, fuelPrice path | `[GAP-R1-3]` |
| `franluft` | Äldre frånluftspump | true | 1.5 | — | `[GAP-E7-4]` |
| `fjarrvarme` | Fjärrvärme | false | 1.00 | `isPrice:true` (PRICE comparison, not a 3× efficiency claim) | `[FACT]` |
| `luftluftCur` | Luft-luft (befintlig) | true | 2.5 | isComplementClass | `[GAP-R1-1]` |
| `luftvattenCur` | Luft-vatten (befintlig) | true | 2.7 | isComplementClass | `[GAP-R1-1]` |
| `bergvarmeCur` | Bergvärme (befintlig) | true | 2.9 | isComplementClass | `[GAP-R1-1]` |
| `kamin` | Braskamin / vedspis | false | 0.70 | isComplementClass, fuelPrice path | `[GAP-R1-3]` |

`defaultCurrentSystem = 'direktel'` `[MODEL]` (line 221). `efficiency` is dimensionless (kWh heat out per kWh in; for fuels, of delivered heat). `isPrice:true` on fjärrvärme routes it through the fuel-price path as a **price** comparison (candour invariant 8), never an efficiency claim.

### 3.11 `fuelPrice` (lines 232–237)
kr/kWh **delivered heat**, incl. moms, for non-electric current systems.

| Key | Value | Provenance |
|---|---|---|
| `olja` | 2.40 | `[GAP-E7-3]` |
| `vedpellets` | 1.20 | `[GAP-E7-3]` |
| `fjarrvarme` | 1.25 | `[GAP-E7-3]` (2026 riks ~1.30, conservative-exact 1.25) |
| `kamin` | 1.45 | `[GAP-E7-3]` (köpt ved ÷ stove eff) |

### 3.12 `solar` (lines 244–251)
Solar self-consumption model (feeds the L6 production slider + the engine's current-cost offset).

| Key | Value | Unit | Provenance |
|---|---|---|---|
| `prodMin/Max/Step/Default` | 2000 / 12000 / 500 / 8000 | kWh/yr | `[GAP-E7-5]` slider band |
| `selfUseShare` | 0.30 | fraction | `[GAP-E7-6]` conservative low end of 30–40% |
| `monthShape` | `[264,580,1337,1845,2100,2131,2110,1785,1360,807,334,186]` | kWh/month (J..D), normalised in engine | `[FACT R4 §1.1]` Otovo Stockholm 15 kWp |

Never folds in surplus/export (60-öre abolished 2026, `[FACT]`).

### 3.13 `own` (line 257)
The own-figure kWh slider bounds (replaces the dead free-text override).

| Key | Value | Provenance |
|---|---|---|
| `min` / `max` / `step` / `defaultKwh` | 5000 / 60000 / 500 / 20000 | `[GAP-L4]` |

### 3.14 `rec` — recommendation constitution (lines 261–273)
Policy constants (owner P1–P5), not physics. A signature is a one-file edit here.

| Key | Value | Meaning | Provenance |
|---|---|---|---|
| `pbComfort` | 10 | comfort payback bar (years); above it verdict states payback plainly, ★ stays ON | `[GAP-V7-1]` |
| `pbActionMax` | 20 | ceiling (years): above it a pump stops being the ★ lead (numbers stay visible) | `[GAP-V10-2]` |
| `pbMentionMax` | 15 | mention band (years) | — |
| `leadSavingFloor` | 3000 | kr/yr WORDING boundary (litenBesparing register), never a gate | — |
| `partialShareMin` | 0.20 | delvisLost still yields a real lead | — |
| `merLuftluftEnabled` | false | addOn gate — OFF until signed | `[GAP-V7-8]` |
| `merLuftluftMaxCov` | 0.60 | " | `[GAP-V7-8]` |
| `merLuftluftMinM2` | 140 | " | `[GAP-V7-8]` |

### 3.15 `battery` (lines 279–282)
| Key | Value | Unit | Provenance |
|---|---|---|---|
| `grossFrom` | 33000 | kr, cheapest catalogue från-pris | `[FACT foretagsdata §3.2]` |
| `greenTechRate` | 0.50 | fraction, grön teknik battery | `[FACT]` 2026 owner-confirmed canon |

### 3.16 `waterborneAdder` + ROT (lines 288–295)
| Key | Value | Unit | Provenance |
|---|---|---|---|
| `waterborneAdder` | `[60000, 120000]` | kr range (copy slot only) | `[FACT R2 §1b]` |
| `rotRate` | 0.30 | fraction of arbetskostnad-schablon | `[FACT]` (NEVER grön teknik on pumps) |
| `rotCapPerPerson` | 50000 | kr/person/yr | `[FACT]` |

### 3.17 `upsideRates` (lines 301–311)
Solar/battery/EV upside rates — labelled rows, **never the hero**.

| Key | Value | Unit | Provenance / tier |
|---|---|---|---|
| `effectiveCapacityKwh` | 7.5 | kWh (~10 nominal → effective) | `[MODEL]` / `[GAP-R4-4]` |
| `egenanvandning` | 320 | kr/kWh/yr, solar-gated | `[durable]` |
| `egenanvandningConsumptionRef` | 18000 | kWh reference | — |
| `arbitrage` | 230 | kr/kWh/yr × regionFactor | `[durable]` |
| `effekttopp` | 150 | kr/kWh/yr, DSO-gated | `[om effektavgift]` |
| `stodtjanster` | 480 | kr/kWh/yr — **OFF the hero by law** | `[tillval, osäker]` (candour invariant 1) |
| `avoidedRetailPerKwh` | 2.00 | kr/kWh self-consumed | `[durable]` |
| `regionFactor` | SE1 0.55 / SE2 0.70 / SE3 1.00 / SE4 1.55 | multiplier (battery arbitrage) | `[FACT R4 §1.3]` |

### 3.18 `dsoEffektavgift` (lines 317–322)
Gates the `effekttopp` upside row only; never the hero.

| Key | Value | Provenance |
|---|---|---|
| `vetej` | false | default OFF |
| `ellevio` | false | `[FACT]` removed 1 Jun 2026 |
| `vattenfall` | true | `[GAP-R4-7]` confirm |
| `eon` | true | `[GAP-R4-7]` confirm |

### 3.19 Miscellaneous coefficients (lines 328–371)
| Key | Line | Value | Provenance |
|---|---|---|---|
| `co2PerKwhSaved` | 328 | 0.10 kg CO₂/kWh avoided | `[GAP-CO2]` placeholder |
| `demandSpread` | 333 | 0.15 (±15% band) | `[MODEL]` / `[GAP-R3-3]` |
| `multi.defaultCoverage.*` | 351–360 | 0.40 each (the "En del ~40%" stop) | `[GAP-MULTI-1]` |
| `multi.defaultCoverageFallback` | 361 | 0.40 | `[GAP-MULTI-1]` |
| `multi.primaryFloor` | 362 | 0.30 (primary keeps ≥30%) | `[GAP-MULTI-2]` |
| `multi.smallSavingThreshold` | 363 | 1500 kr/yr → "liten besparing" | `[GAP-MULTI-3]` |
| `multi.shareStops` | 364 | `[0.20, 0.40, 0.60]` (Lite/En del/Mycket) | `[MODEL]` |
| `heatPumpCurrentIds` | 371 | `['luftluftCur','luftvattenCur','bergvarmeCur','franluft']` | `[MODEL]` |

### 3.20 V4 ranked-options registry (lines 380–424) — read only by `rank.js`
| Key | Line | Value | Provenance |
|---|---|---|---|
| `measures.styrning.signed` | 386 | **false** (until flipped, the row emits `numeric:false`, no kr) | `[GAP-V4-2]` |
| `measures.styrning.invest` | 387 | `[3000, 15000]` kr | `[GAP-V4-1]` |
| `measures.styrning.heatingCostCut` | 388 | `[0.05, 0.10]` (share of space-heating cost) | `[GAP-V4-2]` |
| `measures.styrning.laborShare` | 389 | null (⇒ no ROT) | `[GAP-V4-1]` |
| `rank.rungs` | 398–402 | r0 ≤15000, r1 ≤60000, r2 Infinity | `[GAP-V4-5]` |
| `rank.controllablePrimaries` | 405–406 | list (all but ved/pellets-primary) | `[MODEL]`/`[GAP-V4-2]` |
| `rank.waterborneImplies` | 411 | `['olja','fjarrvarme','vattenburenEl','luftvattenCur','bergvarmeCur','franluft']` | `[MODEL]`/`[GAP-V10-1]` |
| `rank.complementHeadroomMax` | 413 | 0.20 | `[GAP-V4-9]` |
| `rank.maxRows` | 415 | 6 | `[MODEL]` |
| `combi.enabled` | 420 | **false** (v1: kamin-spets is a verdict sentence) | — |
| `combi.keepable` | 421 | `['kamin']` | `[MODEL]` |
| `combi.maxKeptShare` | 422 | 0.20 | `[GAP-V4-7]` |
| `combi.spetsSentenceKey` | 423 | `'kaminSpets'` | `[GAP-V4-6]` |

---

## 4. `engine.js` — the calculate() pipeline (high level)

`calculate(inputs, D)` is a pure function (no DOM, no `Date`, no globals beyond `D`). Same inputs + same `D` → identical output. Pipeline, in code order:

0. **Back-compat shim (lines 96–115).** If `inputs.current` is absent, reconstruct it from legacy flat fields (`currentSystem`, `annualKwh`). Empty complements + legacy `annualKwh` ⇒ byte-identical to the old single-system engine.
1. **Resolve inputs to data records (lines 117–138)** with defaults (primary system, pump, price area, zone, distribution factor, area/occupants/era/indoor temp; resolve the kWh/cost override).
2. **Build the system stack (lines 140–176).** Primary holds the residual share `1 − Σ(complements)`, floored at `multi.primaryFloor` (0.30). Coverage splits **who pays**, never how much heat exists (candour invariant, line 21–22 header).
3. **Heat-demand engine (lines 178–235).** `demand = intensity(era) × area × zone.demand × tempAdj + occupant-VV`, split into space heat (follows `ddShape` degree-days) and hot water (follows `vvShape`). When a real kWh is typed on an all-electric stack, strip `D.household` (5000) so the comparison is *heating*, not appliances (line 208).
4. **Field SPF per month (lines 237–270).** Bergvärme flat (`isGround`); air-source sags in winter via `airSagStrength`, **renormalised so the heat-weighted annual mean is exactly 1.0** (line 255) — the field SPF is treated as an annual average, no double-count.
5. **Monthly price (lines 272–279).** `price[m] = marginalPriceSE3 × pa.factor × priceNorm[m]`, annual mean = the marginal price × area factor.
6. **Blended current cost (lines 291–357).** Each stack member costs its heat share ÷ efficiency × price (electric) or × fuelPrice (fuel). The single-system stack reduces exactly to the root math.
7. **Cost override (lines 360–403).** For fjärrvärme/olja/ved customers who know kr not kWh: back-solve the demand so the schablon-priced blend matches the typed bill, re-blend, then `pinSumTo` the annual so the real bill is never silently changed.
8. **Solar offset (lines 405–409).** Lowers the current side's electric cost by the self-consumed share of stated production — **gated OFF when demand is measured** (double-deduction guard, `solarActive = isFinitePos(inputs.solarKwh) && !demandMeasured`).
9. **Pump monthly cost (lines 411–424).** `pumpCost[m] = monthHeat[m] / SPFeff[m] × price[m]`. A komplement (luft-luft) blends back toward the current cost by `1 − servedShare` (0.7 served, 0.3 stays current) — its saving is capped to the area it actually heats.
10. **Annuals + the hero (lines 426–431).** `heroSaving = currentAnnual − pumpAnnual`, computed with **no stödtjänster and no effektavgift line added** — the candour invariant, encoded in the math.
11. **Investment (lines 433–446).** `rot = min(gross × laborShare × rotRate, rotCapPerPerson)`; `net = gross − rot`. ROT 30% on the labour schablon, **never grön teknik**. A direktel house lacking a waterborne system uses `grossNoWaterborne`.
12. **± band (lines 448–496).** Recomputes the hero at the SPF range ends and at demand ±spread, combined **in quadrature (RSS)** around the mid (line 491). When demand is measured, the demand spread collapses to 0.
13. **System comparison (lines 512–541).** Annual cost for each pump + the blended current row.
14. **Upside (lines 543–572).** Solar/battery/EV labelled rows — **never folded into the hero**.
15. **CO₂ (lines 574–588).** Placeholder `[GAP-CO2]`.
16. **Efficient / no-saving branch (lines 590–598).** `efficientFlag` when the saving is tiny or the primary is already a heat pump; `noSaving` when the pump doesn't beat the current cost.

**The candour invariants Chris must not undermine** (they live in the math, not the copy):
- Hero saving derived at **stödtjänster = 0 AND effektavgift = 0**.
- Pump net investment uses **ROT 30% on labour, never grön teknik**.
- Solar/battery/EV upside kept **out** of the hero (`results.upside` only).
- Luft-luft saving **capped to its served share** (0.7).
- A typed real bill is **never silently changed** (`pinSumTo`).

---

## 5. `rank.js` — options, advice, and the URL codec

Pure additive layer above `engine.js` (no DOM, no rounding, no `Date`). Frozen invariant (line 13): `option.saving[1] === option.results.heroSaving === baseline.currentAnnual − option.futureAnnual`.

### 5.1 `rankOptions(inputs, D)` — the truth table
Runs **one `calculate()` per candidate measure**, applies feasibility gates (**grey WITH a reason, never hide**), then a **deterministic** rung/payback sort. Structure (lines 131–324):

- **4.0 Baseline (line 135):** one `calculate()` with the default pump — the current side is pump-independent.
- **4.2 Candidate generation (lines 147–240):** S0 `behall` (identity on the baseline, always present); S1 `styrning` (derived row — emits `numeric:false` and **no kr fields** while `measures.styrning.signed === false`); S2/S3/S4 = the three pumps (one `calculate()` each). Eligibility gates set `eligible:false` + `ineligibleReason` (e.g. `redanVarmepump` for an existing whole-house pump primary).
- **4.5 Verdict branch (lines 242–256):** `redanEffektiv` / `ingenBesparing` / `litenBesparing` / `standard`. `behallFirst` is a **constant `false`** (owner P1 — behåll never pins first).
- **4.6 Rung + sort (lines 258–285):** assign each option to a rung by net-invest midpoint, then sort: rung → eligible-before-greyed → shorter mid-payback → narrower honest range. Qualitative (unsigned styrning) rows carry no kr and sit in r0.
- **behåll placement (lines 287–295):** always the **end of rung r0** — a context card, never the lead.
- **Returns (lines 310–323):** `{ baseline, verdict, options, rungs }`.

**Deterministic sort = printable, reproducible ranking.** No randomness, no time dependency.

### 5.2 `recommend(R, inputs, D)` — the advice layer (lines 339–435)
`R` is the object returned by `rankOptions`. Pure + deterministic; **does not mutate `R`**. Owner law P1–P5 (lines 333–337):

- **The ★ lead is ALWAYS a real, purchasable action.** `'Behåll det du har'` may exist as a context row but **never carries the ★ and never leads**.
- **Option-lead vs action-lane (lines 374–408):** if the primary is already truly optimal, or no candidate clears `pbActionMax` (20 yr), fall to the **action lane** (batteri / solplan / styrning / service — always a real next step). Otherwise the **pump lane** picks the honest best tradeoff by mid payback.
- **Long payback is flagged honestly, not hidden (line 396):** `longPb = L.paybackMid > D.rec.pbComfort` (10 yr) ⇒ the verdict **states the payback plainly** and the ★ stays on. `pbActionMax` only reroutes the ★; it never hides numbers.
- Branch names (lines 398–407): `uppgradering`, `heltackning`, `fjarrvarmePris`, `komfortKrona`, `delvisLost`, `litenBesparing`, `standardLang`, `standard`.
- Add-ons (lines 410–419): `batteri`, `kaminSpets`, `endOfLife`, `styrning`, etc.

### 5.3 `AmpyCodec.{encode, decode}` — the URL codec (lines 437–518)
One codec, two jobs: **share links** and **ad deep-links**. **House state ONLY — no identity, no tracking fields, ever** (line 440). Params present ⇒ answers pre-filled, not assumed.

URL shape: `?sys=direktel&kmp=kamin.2,luftluft.2&m2=b3&era=e2&kwh=18000&se=SE3` (or `kr=` / `sol=p` / `sol=f.<kwh>`). `vb`/`kr` are decode-only legacy params (never emitted).

**v33 hardening — the reason the codec is robust against corrupt ad traffic:**
- **try/catch around `decodeURIComponent` per param (lines 494–495):** a malformed `%`-sequence (e.g. `?utm_campaign=50%rabatt`, a truncated ad/share link) **skips that one param** and never throws a `URIError` that would kill boot. Ad traffic *is* query strings, so this cannot be allowed to crash.
- **`\d+` validation on numeric params (lines 509–510):** `kwh` and `kr` only accept `/^\d+$/`, so `'1.5e4'` cannot silently become `1`. Parsed values must be `> 0`.
- Other params are regex-guarded too (`m2` `/^b[1-4]$/`, `era` `/^(e[1-4]|x)$/`, `se` `/^SE[1-4]$/`, `sol` `/^f\.\d+$/`).

---

## 6. Load order (mandatory)

```
1. data.js   → defines window.AMPY_DATA
2. engine.js → defines window.AmpyEngine.calculate
3. rank.js   → attaches AmpyEngine.rankOptions, defines window.AmpyRank + window.AmpyCodec
```

`rank.js` **must** load after `engine.js` (it reads `global.AmpyEngine` at line 521 and calls `ENGINE.calculate` at lines 135/197). All three are plain ES5 wrapped in an IIFE (`engine.js:30`, `rank.js:17`), so they run unchanged in any script context.

---

## 7. The WordPress port (short — full detail in doc 06)

The three files port **as-is**. Two equivalent options:

1. **Files verbatim in the JS snippet.** Paste `data.js` + `engine.js` + `rank.js` into the FluentSnippets JS block, in that order, inside the scoped IIFE. They attach to `window`; nothing changes.
2. **`data.js` injected inline via PHP.** Emit `window.AMPY_DATA = <?php echo wp_json_encode($ampy_data); ?>;` from PHP (data lives server-side), then load `engine.js` + `rank.js` unchanged — they read `window.AMPY_DATA` and expose their globals exactly as before.

Either way: `engine.js` and `rank.js` are read via the `window` globals and stay **byte-unchanged** inside a scoped IIFE. The frozen-layer rule holds in WordPress too — number changes go in the `data.js` payload (or the PHP array), never in engine/rank. See **doc 06** for the Bricks/FluentSnippets wiring, shortcode, and cache-bust mechanics.
