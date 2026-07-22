<?php
// <Internal Doc Start>
/*
*
* @description:
* @tags:
* @group:
* @name: Ampy - Energikalkylator - Backend
* @type: PHP
* @status: published
* @created_by: 13
* @created_at: 2026-07-22 12:00:00
* @updated_at: 2026-07-22 12:00:00
* @is_valid: 1
* @updated_by: 13
* @priority: 10
* @run_at: all
* @load_as_file: 
* @load_in_block_editor:
* @condition: {"status":"no","run_if":"assertive","items":[[]]}
*/
?>
<?php if (!defined("ABSPATH")) { return;} // <Internal Doc End> ?>
<?php
/**
 * Energikalkylatorn — Fluent Snippet 2/3 (type: Functions – PHP).
 * Run Location: Frontend & Backend.
 * Registers [ampy_ek] (byte-identical markup + inline window.AMPY_DATA), the
 * data route GET /wp-json/ampy-ek/v1/data/{post_id}, and the honeypot-gated lead
 * route POST /wp-json/ampy-ek/v1/lead/{post_id}.
 *
 * INFRA PATTERN: mirrors the proven LED-kalkylator (ampy_led) — editable data +
 * webhook live in POST META on the lead-magnet post (metabox below); the webhook
 * URL never reaches the browser; no nonce (a honeypot drops bots). Lead delivery
 * priority: webhook -> email -> ALWAYS logged to _ampy_ek_leads (no lead lost).
 * Data precedence: _ampy_ek_calc_data (manual JSON) -> _ampy_ek_sheet_data
 * (parsed Excel, if present) -> ampy_ek_default_data() (baked default).
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/* The lead-magnet post that holds Energikalkylatorn's settings (webhook + fallback email).
 * Placeholder 0 = show the metabox on every lead-magnet + resolve/route by the tool's own post.
 * Set the real post id at deploy: define( 'AMPY_EK_POST_ID', 12345 ); */
if ( ! defined( 'AMPY_EK_POST_ID' ) ) { define( 'AMPY_EK_POST_ID', 60326 ); }

/* ── 1. Tool data (window.AMPY_DATA), inlined as JSON in a nowdoc (nothing interpolated).
 *      ampy_ek_default_data() is the baked default; ampy_ek_resolve_data() applies the
 *      LED precedence; ampy_ek_strip_internal() is the guard applied before output.
 *      No _-prefixed keys exist in data.js (verified); the strip step is a guard. */
if ( ! function_exists( 'ampy_ek_default_data' ) ) {
	function ampy_ek_default_data() {
		$json = <<<'AMPY_EK_DATA_EOF'
{"meta":{"rounding":{"hero":1000,"stat":500,"payback":0.5}},"intensityByEra":{"pre1940":125,"midcentury":110,"modern2010":50,"new2021":39},"defaultEra":"midcentury","pumps":{"luftluft":{"id":"luftluft","label":"Luft-luft","spf":2.7,"spfRange":[2.5,3],"isGround":false,"isComplement":true,"servedShare":0.7,"gross":28000,"laborShare":0.3,"requiresWaterborne":false},"luftvatten":{"id":"luftvatten","label":"Luft-vatten","spf":2.7,"spfRange":[2.5,3],"isGround":false,"isComplement":false,"servedShare":1,"gross":130000,"grossNoWaterborne":220000,"laborShare":0.3,"requiresWaterborne":true},"bergvarme":{"id":"bergvarme","label":"Bergvärme","spf":3,"spfRange":[2.7,3.2],"isGround":true,"isComplement":false,"servedShare":1,"gross":190000,"grossNoWaterborne":280000,"laborShare":0.35,"requiresWaterborne":true,"footprintFlag":"via partner"}},"defaultPump":"luftvatten","framledning":{"golvvarme":1.1,"radiator":1,"hogtemp":0.9},"defaultDistribution":"radiator","marginalPriceSE3":1.8,"priceAreas":{"SE1":{"id":"SE1","label":"SE1","factor":0.82},"SE2":{"id":"SE2","label":"SE2","factor":0.85},"SE3":{"id":"SE3","label":"SE3","factor":1},"SE4":{"id":"SE4","label":"SE4","factor":1.1}},"defaultPriceArea":"SE3","zoneFactor":{"SE1":{"demand":1.15,"airSpf":0.8},"SE2":{"demand":1.08,"airSpf":0.88},"SE3":{"demand":1,"airSpf":1},"SE4":{"demand":0.95,"airSpf":1.05}},"ddShape":{"SE3":[0.163,0.148,0.14,0.097,0.053,0.013,0,0.002,0.039,0.082,0.116,0.147]},"vvShape":[0.09,0.09,0.088,0.085,0.08,0.072,0.068,0.07,0.08,0.085,0.09,0.092],"months":["J","F","M","A","M","J","J","A","S","O","N","D"],"monthsLong":["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"],"priceShape":[1.35,1.35,1.2,1.05,0.85,0.7,0.65,0.68,0.82,0.98,1.15,1.3],"airSagStrength":1.4,"household":5000,"householdModel":{"baseKwh":3000,"perOccupantKwh":1000},"vvPerPerson":1000,"defaultOccupants":2,"tempSensitivity":0.04,"defaultIndoorTemp":21,"currentSystems":{"direktel":{"id":"direktel","label":"Direktverkande el","isElectric":true,"efficiency":1,"canComplement":true},"vattenburenEl":{"id":"vattenburenEl","label":"Vattenburen el","isElectric":true,"efficiency":0.95,"canComplement":true},"olja":{"id":"olja","label":"Oljepanna","isElectric":false,"efficiency":0.85,"canComplement":true},"vedpellets":{"id":"vedpellets","label":"Ved / pellets","isElectric":false,"efficiency":0.75,"canComplement":true},"franluft":{"id":"franluft","label":"Äldre frånluftspump","isElectric":true,"efficiency":1.5,"canComplement":false},"fjarrvarme":{"id":"fjarrvarme","label":"Fjärrvärme","isElectric":false,"efficiency":1,"isPrice":true,"canComplement":false},"luftluftCur":{"id":"luftluftCur","label":"Luft-luft (befintlig)","isElectric":true,"efficiency":2.5,"canComplement":true,"isComplementClass":true},"luftvattenCur":{"id":"luftvattenCur","label":"Luft-vatten (befintlig)","isElectric":true,"efficiency":2.7,"canComplement":true,"isComplementClass":true},"bergvarmeCur":{"id":"bergvarmeCur","label":"Bergvärme (befintlig)","isElectric":true,"efficiency":2.9,"canComplement":true,"isComplementClass":true},"kamin":{"id":"kamin","label":"Braskamin / vedspis","isElectric":false,"efficiency":0.7,"canComplement":true,"isComplementClass":true}},"defaultCurrentSystem":"direktel","fuelPrice":{"olja":2.4,"vedpellets":1.2,"fjarrvarme":1.25,"kamin":1.45},"solar":{"prodMin":2000,"prodMax":12000,"prodStep":500,"prodDefault":8000,"selfUseShare":0.3,"monthShape":[264,580,1337,1845,2100,2131,2110,1785,1360,807,334,186]},"own":{"min":5000,"max":60000,"step":500,"defaultKwh":20000},"rec":{"pbComfort":10,"pbActionMax":20,"pbMentionMax":15,"leadSavingFloor":3000,"partialShareMin":0.2,"merLuftluftEnabled":false,"merLuftluftMaxCov":0.6,"merLuftluftMinM2":140},"battery":{"grossFrom":33000,"greenTechRate":0.5},"waterborneAdder":[60000,120000],"rotRate":0.3,"rotCapPerPerson":50000,"upsideRates":{"effectiveCapacityKwh":7.5,"egenanvandning":320,"egenanvandningConsumptionRef":18000,"arbitrage":230,"effekttopp":150,"stodtjanster":480,"avoidedRetailPerKwh":2,"regionFactor":{"SE1":0.55,"SE2":0.7,"SE3":1,"SE4":1.55}},"dsoEffektavgift":{"vetej":false,"ellevio":false,"vattenfall":true,"eon":true},"co2PerKwhSaved":0.1,"demandSpread":0.15,"multi":{"defaultCoverage":{"kamin":0.4,"luftluftCur":0.4,"luftvattenCur":0.4,"bergvarmeCur":0.4,"direktel":0.4,"vattenburenEl":0.4,"olja":0.4,"vedpellets":0.4},"defaultCoverageFallback":0.4,"primaryFloor":0.3,"smallSavingThreshold":1500,"shareStops":[0.2,0.4,0.6]},"heatPumpCurrentIds":["luftluftCur","luftvattenCur","bergvarmeCur","franluft"],"measures":{"styrning":{"id":"styrning","label":"Smart styrning","signed":false,"invest":[3000,15000],"heatingCostCut":[0.05,0.1],"laborShare":null,"needsControllable":true}},"rank":{"rungs":[{"id":"r0","max":15000,"label":"0-15 tkr"},{"id":"r1","max":60000,"label":"20-55 tkr"},{"id":"r2","max":null,"label":"90+ tkr"}],"controllablePrimaries":["direktel","vattenburenEl","olja","fjarrvarme","franluft","luftluftCur","luftvattenCur","bergvarmeCur"],"waterborneImplies":["olja","fjarrvarme","vattenburenEl","luftvattenCur","bergvarmeCur","franluft"],"complementHeadroomMax":0.2,"maxRows":6},"combi":{"enabled":false,"keepable":["kamin"],"maxKeptShare":0.2,"spetsSentenceKey":"kaminSpets"}}
AMPY_EK_DATA_EOF;
		$data = json_decode( $json, true );
		return is_array( $data ) ? $data : array();
	}
	function ampy_ek_strip_internal( $arr ) {
		if ( ! is_array( $arr ) ) { return $arr; }
		$out = array();
		foreach ( $arr as $k => $v ) {
			if ( is_string( $k ) && strpos( $k, '_' ) === 0 ) { continue; }
			$out[ $k ] = is_array( $v ) ? ampy_ek_strip_internal( $v ) : $v;
		}
		return $out;
	}
	function ampy_ek_resolve_data( $post_id ) {
		$post_id = (int) $post_id;
		// Precedence: (1) manual JSON override, (2) parsed Excel sheet, (3) baked default.
		$json = get_post_meta( $post_id, '_ampy_ek_calc_data', true );
		if ( ! empty( $json ) ) {
			$d = json_decode( $json, true );
			if ( is_array( $d ) && ! empty( $d ) ) { return $d; }
		}
		$sheet = get_post_meta( $post_id, '_ampy_ek_sheet_data', true );
		if ( ! empty( $sheet ) ) {
			$d = json_decode( $sheet, true );
			if ( is_array( $d ) && ! empty( $d ) ) { return $d; }
		}
		return ampy_ek_default_data();
	}
}

/* ── 2. Shortcode [ampy_ek] — RETURNS markup + inline data + REST handshake (no nonce). ── */
if ( ! function_exists( 'ampy_ek_shortcode' ) ) {
	function ampy_ek_shortcode() {
		$pid  = AMPY_EK_POST_ID ? (int) AMPY_EK_POST_ID : (int) get_the_ID();
		$data = wp_json_encode( ampy_ek_strip_internal( ampy_ek_resolve_data( $pid ) ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		$rest = esc_url_raw( rest_url( 'ampy-ek/v1' ) );
		ob_start();
		?>
<div class="ampy-ek-outer">
  <div class="ampy-ek" id="ampyEk" lang="sv">

    <!-- the headline lives in the site-built hero above the tool; the standalone
         page keeps an sr-only h1 for a11y/SEO -->
    <h1 class="ampy-ek__sr-only">Energikalkylatorn</h1>

    <noscript><p class="ampy-ek__noscript-note">Kalkylatorn behöver JavaScript för att räkna. Slå på JavaScript i webbläsaren och ladda om sidan.</p></noscript>

    <div class="ampy-ek__panes">

      <!-- ============ LEFT: INPUT CARD (V7 — 7 controls, flat, zero keyboards) ============ -->
      <form class="ampy-ek__input" id="inputForm" autocomplete="off" novalidate>

        <div class="ampy-ek__gear" data-gear="n1">
          <div class="ampy-ek__gearhead">Ditt hus</div>

          <!-- 1. the ONE merged heat list (L2): all eleven cards, multi-select -->
          <fieldset class="ampy-ek__heatpicker" id="heatPicker">
            <legend class="ampy-ek__hp-legend">Vad värmer huset idag?<span class="ampy-ek__hp-legend-soft">Välj en eller flera</span></legend>
            <div class="ampy-ek__hp-grid" id="hpGrid" role="group" aria-describedby="hpHint"><!-- cards built by app.js --></div>
            <p class="ampy-ek__hp-hint" id="hpHint" role="status" aria-live="polite" hidden></p>
            <div class="ampy-ek__hp-shares" id="hpShares" hidden>
              <div class="ampy-ek__hp-shares-head">Hur mycket värmer var och en?</div>
              <p class="ampy-ek__hp-summary" id="hpSummary" role="status" aria-live="polite"></p>
            </div>
            <p class="ampy-ek__capnote" id="complementCapNote" role="status" aria-live="polite" hidden>Komplementen täcker tillsammans högst 70 % av värmen.</p>
          </fieldset>

          <!-- 2. boyta (KEEP) -->
          <div class="ampy-ek__lbl ampy-ek__lbl-row">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l4 4l-14 14l-4 -4z"/><path d="M16 7l-1.5 -1.5"/><path d="M13 10l-1.5 -1.5"/><path d="M10 13l-1.5 -1.5"/><path d="M7 16l-1.5 -1.5"/></svg>Boyta</span>
            <output id="areaOut" for="areaSlider" class="ampy-ek__lbl-val">150 m²</output>
          </div>
          <input type="range" id="areaSlider" data-input="area" class="ampy-ek__range"
                 min="40" max="400" step="10" value="150"
                 aria-label="Boyta i kvadratmeter">

          <!-- 3. byggår (KEEP) -->
          <div class="ampy-ek__lbl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/></svg>Byggår <span class="ampy-ek__lbl-soft">ungefär räcker</span> <span class="ampy-ek__antag" id="eraAsm">(antagande)</span></div>
          <div class="ampy-ek__seg ampy-ek__seg-wrap" id="eraSeg" role="radiogroup" aria-label="Byggår"></div>

          <!-- 4. boende (moved up from the dead reveal) -->
          <div class="ampy-ek__lbl ampy-ek__lbl-row">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0 -3 -3.85"/></svg>Boende <span class="ampy-ek__lbl-soft">styr varmvattnet</span></span>
            <span class="ampy-ek__stepper">
              <button type="button" class="ampy-ek__stepbtn" data-step="occupants" data-dir="-1" aria-label="Minska antal boende">−</button>
              <output id="occOut" class="ampy-ek__stepval" aria-live="polite">2</output>
              <button type="button" class="ampy-ek__stepbtn" data-step="occupants" data-dir="1" aria-label="Öka antal boende">+</button>
            </span>
          </div>
          <input type="hidden" id="occupantsField" data-input="occupants" value="2">

          <!-- 5. elområde (PROMOTED, relabelled) -->
          <div class="ampy-ek__lbl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/></svg>Var ligger huset? <span class="ampy-ek__lbl-soft">elområdet styr elpriset</span></div>
          <div class="ampy-ek__seg" id="priceAreaSeg" role="radiogroup" aria-label="Elområde"></div>
        </div>

        <div class="ampy-ek__gear" data-gear="n2">
          <div class="ampy-ek__gearhead">Din el</div>

          <!-- 6. the own-figure kWh slider (L4 — the rebuilt override; all-electric stacks only) -->
          <div id="ownRow">
            <div class="ampy-ek__lbl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/><path d="M11 7l-2.5 3.5h3l-2.5 3.5"/></svg>Vet du vad huset drar per år?</div>
            <div class="ampy-ek__seg" id="ownSeg" role="radiogroup" aria-label="Vet du husets årsförbrukning"></div>
            <div class="ampy-ek__gear ampy-ek__gear-collapsed" data-gear="own" id="gearOwn" hidden>
              <div class="ampy-ek__gear-inner">
                <div class="ampy-ek__lbl ampy-ek__lbl-row">
                  <span>Husets elförbrukning</span>
                  <output id="ownOut" for="ownSlider" class="ampy-ek__lbl-val">20 000 kWh per år</output>
                </div>
                <input type="range" id="ownSlider" class="ampy-ek__range"
                       min="5000" max="60000" step="500" value="20000"
                       aria-label="Husets elförbrukning i kilowattimmar per år">
                <p class="ampy-ek__gearcopy">Ett normalstort elvärmt hus drar 15 000-25 000 kWh om året. Siffran står på elnätsfakturan.</p>
              </div>
            </div>
          </div>

          <!-- 7. solceller (L6 — Nej / Finns / Planeras) -->
          <div class="ampy-ek__lbl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1"/><path d="M12 3v1"/><path d="M20 12h1"/><path d="M12 20v1"/><path d="M5.6 5.6l.7 .7"/><path d="M18.4 5.6l-.7 .7"/><path d="M17.7 17.7l.7 .7"/><path d="M6.3 17.7l-.7 .7"/></svg>Solceller <span class="ampy-ek__lbl-soft">påverkar dagens kostnad</span></div>
          <div class="ampy-ek__seg" id="solarSeg" role="radiogroup" aria-label="Solceller"></div>
          <div class="ampy-ek__gear ampy-ek__gear-collapsed" data-gear="sol" id="gearSol" hidden>
            <div class="ampy-ek__gear-inner">
              <div class="ampy-ek__lbl ampy-ek__lbl-row">
                <span>Ungefärlig produktion</span>
                <output id="solarOut" for="solarSlider" class="ampy-ek__lbl-val">8 000 kWh per år</output>
              </div>
              <input type="range" id="solarSlider" class="ampy-ek__range"
                     min="2000" max="12000" step="500" value="8000"
                     aria-label="Ungefärlig solelsproduktion i kilowattimmar per år">
              <p class="ampy-ek__gearcopy">En vanlig villaanläggning på 10 kW ger runt 9 000-11 000 kWh om året.</p>
            </div>
          </div>
        </div>
      </form>

      <!-- ============ RIGHT COLUMN: RESULT CARD + TRUST BLOCK ============ -->
      <div class="ampy-ek__rightcol">
      <div class="ampy-ek__result" id="result">

        <!-- A. head (#ownBadge deleted — R1) -->
        <div class="ampy-ek__eyebrow-row">
          <span class="ampy-ek__eyebrow" id="eyebrow">Så förbrukar ditt hus energi idag</span>
        </div>

        <!-- B. anchor (now the household-inclusive total, display only; breakdown = the legend below) -->
        <p class="ampy-ek__anchor-num" id="anchorNum">&#8212;</p>

        <!-- C. story bar (KEEP + member-line upgrade — R2) -->
        <div class="ampy-ek__storybar" id="storyBar" aria-hidden="true">
          <span class="ampy-ek__sb-seg ampy-ek__sb-heat"></span><span class="ampy-ek__sb-seg ampy-ek__sb-vv"></span><span class="ampy-ek__sb-seg ampy-ek__sb-house"></span>
        </div>
        <ul class="ampy-ek__sb-legend">
          <li><i class="ampy-ek__sb-dot ampy-ek__sb-dot-heat" aria-hidden="true"></i>Uppvärmning <b id="sbHeatKr">&#8212;</b></li>
          <li><i class="ampy-ek__sb-dot ampy-ek__sb-dot-vv" aria-hidden="true"></i>Varmvatten <b id="sbVvKr">&#8212;</b></li>
          <li class="ampy-ek__sb-house-row"><i class="ampy-ek__sb-dot ampy-ek__sb-dot-house" aria-hidden="true"></i>Hushållsel <b id="sbHouseKr">&#8212;</b></li>
        </ul>
        <p class="ampy-ek__sb-mix" id="sbMix" hidden></p>

        <!-- D+E. SPARSTAPLARNA — savings bars + tap-to-expand rec (replaces #compare + #recs) -->
        <section class="ampy-ek__spark" id="spark" aria-labelledby="sparkH">
          <h2 class="ampy-ek__spark-h" id="sparkH">Så mycket kan du spara per år</h2>
          <div class="ampy-ek__spark-list" id="sparkList" role="list"><!-- .sp-item rows built by app.js --></div>
        </section>

        <!-- sr-only live region (the ONE result announcer) -->
        <div class="ampy-ek__sr-only" id="resultLive" aria-live="polite" aria-atomic="true"></div>

        <!-- F. CTA BLOCK: dominant primary + quiet share (desktop share opens a popover) -->
        <div class="ampy-ek__ctablock">
          <button type="button" class="ampy-ek__cta ampy-ek__cta--primary" id="ctaBtn">Få kostnadsfri rådgivning</button>
          <div class="ampy-ek__share-wrap">
            <button type="button" class="ampy-ek__share-btn ampy-ek__share-btn--quiet" id="shareBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="sharePop">Dela din kalkyl</button>
            <div class="ampy-ek__share-pop" id="sharePop" role="menu" aria-label="Dela din kalkyl" hidden>
              <button type="button" class="ampy-ek__share-act" id="shareCopy" role="menuitem">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
                <span class="ampy-ek__share-act-lbl">Kopiera länk</span>
              </button>
              <a class="ampy-ek__share-act" id="shareMail" role="menuitem" href="#">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6l9 -6"/></svg>
                <span class="ampy-ek__share-act-lbl">Dela via mejl</span>
              </a>
              <a class="ampy-ek__share-act" id="shareFb" role="menuitem" href="#" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2h-3a5 5 0 0 0-5 5v3H6v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                <span class="ampy-ek__share-act-lbl">Dela på Facebook</span>
              </a>
            </div>
          </div>
        </div>
        <p class="ampy-ek__sr-only" id="shareLive" role="status"></p>

        <!-- F2. INLINE LEAD FORM (opens IN the midnight card, after CTA) -->
        <div class="ampy-ek__lead-inline ampy-ek__gear-collapsed" id="leadInline" hidden>
          <div class="ampy-ek__gear-inner">
            <div class="ampy-ek__lead-inline-body">
              <button type="button" class="ampy-ek__leadclose" id="leadClose" aria-label="Stäng formuläret"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg></button>
              <h3 class="ampy-ek__lead-title">En elektriker räknar på ditt hus</h3>
              <p class="ampy-ek__lead-sub">Vi hör av oss inom en arbetsdag och ger dig en kostnadsfri rådgivning.</p>
              <form id="leadForm" novalidate>
                <label class="ampy-ek__lead-lbl" for="leadName">Ditt namn <span class="ampy-ek__lead-req" aria-hidden="true">*</span></label>
                <input class="ampy-ek__lead-field" type="text" id="leadName" name="name" autocomplete="name" required aria-describedby="errName">
                <p class="ampy-ek__field-err ampy-ek__sr-only" id="errName" hidden></p>

                <label class="ampy-ek__lead-lbl" for="leadPhone">Telefonnummer <span class="ampy-ek__lead-req" aria-hidden="true">*</span></label>
                <input class="ampy-ek__lead-field" type="tel" id="leadPhone" name="phone" autocomplete="tel" required aria-describedby="errPhone">
                <p class="ampy-ek__field-err ampy-ek__sr-only" id="errPhone" hidden></p>

                <label class="ampy-ek__lead-lbl" for="leadZip">Postnummer <span class="ampy-ek__lead-req" aria-hidden="true">*</span></label>
                <input class="ampy-ek__lead-field" type="text" id="leadZip" name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="6" required aria-describedby="errZip">
                <p class="ampy-ek__field-err ampy-ek__sr-only" id="errZip" hidden></p>

                <label class="ampy-ek__lead-lbl" for="leadEmail">E-postadress <span class="ampy-ek__lead-req" aria-hidden="true">*</span></label>
                <input class="ampy-ek__lead-field" type="email" id="leadEmail" name="email" autocomplete="email" required aria-describedby="errEmail">
                <p class="ampy-ek__field-err ampy-ek__sr-only" id="errEmail" hidden></p>

                <!-- honeypot (hidden from humans) -->
                <div class="ampy-ek__hp" aria-hidden="true">
                  <label for="leadCompany">Lämna tomt</label>
                  <!-- name must NEVER be an autofill token (company/organization/website…) —
                       browser autofill can fill off-screen fields and silently drop real leads -->
                  <input type="text" id="leadCompany" name="hp_extra" tabindex="-1" autocomplete="off">
                </div>

                <!-- Submit label A/B: shipped = "Boka kostnadsfri rådgivning".
                     Documented alternative for a future A/B (message-match with the heading):
                     "Ja, räkna på mitt hus" — if swapped, the consent line MUST quote the new label verbatim. -->
                <button type="submit" class="ampy-ek__cta ampy-ek__lead-submit">Boka kostnadsfri rådgivning</button>
                <p class="ampy-ek__lead-consent">Genom att trycka på "Boka kostnadsfri rådgivning" samtycker jag till att Ampy behandlar mina personuppgifter enligt vår <a href="https://ampy.se/integritetspolicy/" target="_blank" rel="noopener">integritetspolicy</a>.</p>
                <p class="ampy-ek__lead-err" id="leadErr" role="alert" hidden></p>
              </form>
              <div class="ampy-ek__lead-success" id="leadSuccess" role="status" tabindex="-1" hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M9 12l2 2l4 -4"/></svg>
                <p>Tack. En elektriker hör av sig med ett förslag för ditt hus, oftast inom en arbetsdag. Under tiden kan du dela kalkylen med någon som borde se den.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- G. METHODOLOGY (bullets + legal — the curve is GONE, R10) -->
        <details class="ampy-ek__method">
          <summary><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6"/></svg> Så har vi räknat</summary>
          <div class="ampy-ek__method-body">
            <div id="methodBody"></div>
          </div>
        </details>

      </div>

      <!-- ============ TRUST BLOCK (extern trovärdighet — owner-sanctioned facts only) ============
           A real Ampy dusk photo (trust-elinstallation.webp) is the surface, under a left-weighted
           midnight veil (guarantees AA white text; lets the gold stars pop). Same radius/shadow
           family as the result card, so the seam reads seamless. Content is owner-sanctioned only:
           verbatim Google review + real public reviewer + 5/5 + 3 000+/year. -->
      <aside class="ampy-ek__trust" aria-label="Omdöme och erfarenhet">
        <img class="ampy-ek__trust-photo" src="/wp-content/uploads/ampy-ek/trust-elinstallation.webp" alt="" aria-hidden="true"
             width="1000" height="827" loading="lazy" decoding="async">
        <div class="ampy-ek__trust-veil" aria-hidden="true"></div>
        <div class="ampy-ek__trust-inner">
          <blockquote class="ampy-ek__trust-quote">
            <span class="ampy-ek__trust-mark" aria-hidden="true">&#8221;</span>
            <p>Från start till mål levererades en service i världsklass.</p>
            <cite class="ampy-ek__trust-cite">Hugo Grafström Olsson</cite>
          </blockquote>
          <div class="ampy-ek__trust-rating">
            <span class="ampy-ek__trust-stars" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.8 6 21l1.2-6.6L2.4 9.7l6.6-.9z"/></svg>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.8 6 21l1.2-6.6L2.4 9.7l6.6-.9z"/></svg>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.8 6 21l1.2-6.6L2.4 9.7l6.6-.9z"/></svg>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.8 6 21l1.2-6.6L2.4 9.7l6.6-.9z"/></svg>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.8 6 21l1.2-6.6L2.4 9.7l6.6-.9z"/></svg>
            </span>
            <span class="ampy-ek__trust-rating-txt">5 av 5 · Betyg på Google</span>
          </div>
          <div class="ampy-ek__trust-divider" aria-hidden="true"></div>
          <p class="ampy-ek__trust-stat">3&#160;000+ genomförda installationer om året</p>
        </div>
      </aside>

      </div>
    </div>
  </div>
</div>

<!-- mobile jump-pill (≤991): appears after the first input interaction, hides at the result -->
<button type="button" class="ampy-ek__jump-pill" id="jumpPill" tabindex="-1" aria-hidden="true">Se resultatet <span class="ampy-ek__jp-chip" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg></span></button>
		<script>
		  window.AMPY_DATA = <?php echo $data; ?>;
		  window.AmpyEK = { restUrl: <?php echo wp_json_encode( $rest ); ?>, postId: <?php echo (int) $pid; ?> };
		</script>
		<?php
		return ob_get_clean();   // shortcodes RETURN, never echo
	}
	add_shortcode( 'ampy_ek', 'ampy_ek_shortcode' );
}

/* ── 3. REST API (ampy-ek/v1): GET /data/{post_id}, POST /lead/{post_id}. No nonce. ── */
if ( ! function_exists( 'ampy_ek_register_routes' ) ) {
	function ampy_ek_register_routes() {
		register_rest_route( 'ampy-ek/v1', '/data/(?P<post_id>\d+)', array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'ampy_ek_api_get_data',
			'permission_callback' => '__return_true',
			'args'                => array( 'post_id' => array( 'sanitize_callback' => 'absint' ) ),
		) );
		register_rest_route( 'ampy-ek/v1', '/lead/(?P<post_id>\d+)', array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'ampy_ek_api_submit_lead',
			'permission_callback' => '__return_true',
			'args'                => array( 'post_id' => array( 'sanitize_callback' => 'absint' ) ),
		) );
	}
	add_action( 'rest_api_init', 'ampy_ek_register_routes' );
}

if ( ! function_exists( 'ampy_ek_api_get_data' ) ) {
	function ampy_ek_api_get_data( WP_REST_Request $req ) {
		$post_id = (int) $req['post_id'];
		if ( get_post_type( $post_id ) !== 'lead-magnet' ) {
			return new WP_Error( 'invalid_post', 'Post not found or wrong post type.', array( 'status' => 404 ) );
		}
		return rest_ensure_response( ampy_ek_strip_internal( ampy_ek_resolve_data( $post_id ) ) );
	}
}

if ( ! function_exists( 'ampy_ek_api_submit_lead' ) ) {
	function ampy_ek_api_submit_lead( WP_REST_Request $req ) {
		$post_id = (int) $req['post_id'];
		$p = $req->get_json_params();
		if ( ! is_array( $p ) || empty( $p ) ) {
			return new WP_Error( 'empty_payload', 'No JSON body received.', array( 'status' => 400 ) );
		}

		// Honeypot — real users never fill hp_extra / company_url. Pretend success, drop silently.
		if ( ! empty( $p['hp_extra'] ) || ! empty( $p['company_url'] ) ) {
			return rest_ensure_response( array( 'success' => true ) );
		}

		// Sanitized contact fields; the full payload rides along as CRM context.
		$lead = array(
			'tool'      => 'energikalkylatorn',
			'leadId'    => sanitize_text_field( $p['leadId'] ?? '' ),
			'consentTs' => sanitize_text_field( $p['consentTs'] ?? '' ),
			'name'      => sanitize_text_field( $p['name'] ?? '' ),
			'phone'     => sanitize_text_field( $p['phone'] ?? '' ),
			'email'     => sanitize_email( $p['email'] ?? '' ),
			'zip'       => sanitize_text_field( $p['zip'] ?? '' ),
			// full CRM enrichment (primary/complements/area/era/rec*/savingBucket/attribution/…)
			'context'   => is_array( $p['context'] ?? null ) ? $p['context'] : $p,
			'ip'        => isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '',
			'time'      => current_time( 'mysql' ),
		);

		$webhook = get_post_meta( $post_id, '_ampy_ek_webhook_url',  true );
		$notify  = get_post_meta( $post_id, '_ampy_ek_notify_email', true );

		if ( $webhook ) {
			// Non-blocking: never make the visitor wait on the CRM.
			wp_remote_post( $webhook, array(
				'headers'     => array( 'Content-Type' => 'application/json' ),
				'body'        => wp_json_encode( $lead ),
				'timeout'     => 10,
				'blocking'    => false,
				'data_format' => 'body',
			) );
		} elseif ( $notify && is_email( $notify ) ) {
			$subject = '[Energikalkylatorn] Ny lead: ' . ( $lead['name'] ?: '-' );
			$msg = "Ny rådgivningsförfrågan via Energikalkylatorn\n\n"
			     . 'Namn: ' . $lead['name'] . "\nTelefon: " . $lead['phone']
			     . "\nE-post: " . $lead['email'] . "\nPostnummer: " . $lead['zip']
			     . "\n\nIP: " . $lead['ip'] . "\nTid: " . $lead['time']
			     . "\n\nContext:\n" . print_r( $lead['context'], true );
			wp_mail( $notify, $subject, $msg );
		}

		// Always log (nothing lost even if webhook + email are both empty).
		$log_json = get_post_meta( $post_id, '_ampy_ek_leads', true );
		$log      = $log_json ? (array) json_decode( $log_json, true ) : array();
		array_unshift( $log, array(
			'time'    => $lead['time'],
			'contact' => array( 'name' => $lead['name'], 'email' => $lead['email'], 'phone' => $lead['phone'], 'zip' => $lead['zip'] ),
			'leadId'  => $lead['leadId'],
			'context' => $lead['context'],
		) );
		update_post_meta( $post_id, '_ampy_ek_leads', wp_json_encode( array_slice( $log, 0, 100 ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) );

		// CRM hook — the site owner attaches their handler here.
		do_action( 'ampy_ek_lead_received', $lead );

		return rest_ensure_response( array( 'success' => true ) );
	}
}

/* ── 4. Settings metabox on the lead-magnet CPT (webhook + fallback email + data override in
 *      POST META, never wp-admin Settings, never the browser). Mirrors led/40's ampy_led. ── */
add_action( 'add_meta_boxes', function ( $post_type, $post ) {
	if ( $post_type !== 'lead-magnet' ) { return; }
	if ( AMPY_EK_POST_ID && (int) $post->ID !== (int) AMPY_EK_POST_ID ) { return; }
	add_meta_box( 'ampy_ek_settings', 'Energikalkylatorn - Settings', 'ampy_ek_metabox_render', 'lead-magnet', 'normal', 'high' );
}, 10, 2 );

if ( ! function_exists( 'ampy_ek_metabox_render' ) ) {
	function ampy_ek_metabox_render( WP_Post $post ) {
		if ( AMPY_EK_POST_ID && (int) $post->ID !== (int) AMPY_EK_POST_ID ) {
			echo '<p>This box is locked to post ID ' . (int) AMPY_EK_POST_ID . '.</p>';
			return;
		}
		wp_nonce_field( 'ampy_ek_save', 'ampy_ek_nonce' );

		$webhook = esc_attr( get_post_meta( $post->ID, '_ampy_ek_webhook_url', true ) );
		$notify  = esc_attr( get_post_meta( $post->ID, '_ampy_ek_notify_email', true ) );
		$data    = get_post_meta( $post->ID, '_ampy_ek_calc_data', true );
		$src      = ! empty( $data ) ? 'manual JSON override'
			: ( get_post_meta( $post->ID, '_ampy_ek_sheet_data', true ) ? 'parsed Excel sheet' : 'built-in default' );
		$log     = get_post_meta( $post->ID, '_ampy_ek_leads', true );
		$log_arr = $log ? (array) json_decode( $log, true ) : array();

		echo '<p style="color:#666;margin:0 0 12px;">Rådgivningsförfrågan levereras server-side till denna n8n/Make-webhook. URL:en lämnar aldrig servern. Lämna tomt för att falla tillbaka på e-post.</p>';

		echo '<p><label><strong>Lead webhook URL</strong> (optional)</label><br>';
		echo '<input type="url" name="ampy_ek_webhook_url" value="' . $webhook . '" class="large-text" placeholder="https://your-n8n.com/webhook/..."></p>';

		echo '<p><label><strong>Notification email</strong> (used if no webhook)</label><br>';
		echo '<input type="email" name="ampy_ek_notify_email" value="' . $notify . '" class="regular-text" placeholder="' . esc_attr( get_option( 'admin_email' ) ) . '"></p>';

		// Live readout of which data source is active right now.
		echo '<p style="color:#555;">Active data source: <strong>' . esc_html( $src ) . '</strong></p>';

		// Advanced: raw JSON override (developer escape hatch; wins over the sheet).
		echo '<hr><p><label><strong>Advanced: raw JSON override</strong> - leave empty to use the sheet/default. When filled, this overrides everything.</label><br>';
		echo '<textarea name="ampy_ek_calc_data" rows="5" class="large-text code" placeholder="(advanced) paste a full data JSON to override everything...">' . esc_textarea( $data ) . '</textarea></p>';

		if ( $log_arr ) {
			echo '<hr><p><strong>Recent leads (' . count( $log_arr ) . ')</strong></p><ol style="margin-left:1.2em;">';
			foreach ( array_slice( $log_arr, 0, 10 ) as $row ) {
				$c = $row['contact'] ?? array();
				echo '<li>' . esc_html( $row['time'] ?? '' ) . ' - ' . esc_html( $c['name'] ?? '' )
				   . ' (' . esc_html( $c['email'] ?? '' ) . ') - ' . esc_html( $c['phone'] ?? '' )
				   . ', ' . esc_html( $c['zip'] ?? '' ) . '</li>';
			}
			echo '</ol>';
		}
	}
}

add_action( 'save_post_lead-magnet', function ( $post_id ) {
	if ( AMPY_EK_POST_ID && (int) $post_id !== (int) AMPY_EK_POST_ID ) { return; }
	if ( ! isset( $_POST['ampy_ek_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['ampy_ek_nonce'] ), 'ampy_ek_save' ) ) { return; }
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) { return; }
	if ( ! current_user_can( 'edit_post', $post_id ) ) { return; }

	update_post_meta( $post_id, '_ampy_ek_webhook_url',  esc_url_raw(    wp_unslash( $_POST['ampy_ek_webhook_url'] ?? '' ) ) );
	update_post_meta( $post_id, '_ampy_ek_notify_email', sanitize_email( wp_unslash( $_POST['ampy_ek_notify_email'] ?? '' ) ) );

	// Raw JSON override: empty -> built-in default; otherwise store the raw textarea value
	// (validated as JSON) exactly as typed, so no re-encode/slash round-trip mangles it.
	$raw = wp_unslash( $_POST['ampy_ek_calc_data'] ?? '' );
	if ( trim( $raw ) === '' ) {
		delete_post_meta( $post_id, '_ampy_ek_calc_data' );
	} elseif ( json_decode( $raw, true ) !== null ) {
		update_post_meta( $post_id, '_ampy_ek_calc_data', $raw );
	}
} );
