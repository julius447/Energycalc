# Energikalkylatorn — Ampy (publiceringsklar, variant B · RÄKNINGSCHOCKEN)

En värmepumpskalkylator som jämför kundens **nuvarande uppvärmning** mot **luft-luft / luft-vatten /
bergvärme**, månad för månad, och visar besparingen som ett ärligt spann. Paid-first, svensk, candour-röst.

**Live:** https://julius447.github.io/Energycalc/
**A/B/C-bildspecs (wireframe-stadiet):** https://julius447.github.io/Energycalc/bildspecs/

## Vad den gör

- **Snabbsvar på load (N1):** komplett kr/år-spann från smarta defaults, noll inmatning. Bara tre N1-fält
  (nuvarande system · boyta · elområde), alla förifyllda.
- **Din profil (N2):** årlig förbrukning (kWh), antal boende, byggår/energiklass, vattenburet — alla
  frivilliga, var och en skärper svaret. Här dyker 4-systemsjämförelsen upp (klicka en stapel = byt pump).
- **Hela bilden (N3):** innetemp, värmedistribution, elnätsbolag (styr effektavgift-raden), solel-toggle som
  låser upp de märkta upside-raderna, samt metodiken.
- **Signaturen:** 12-månaderskurvan (nuvarande vs vald pump), med ett osäkerhetsband som vidgas på vintern
  där fält-SPF är minst säker, och vinterns topp utpekad.

## Candour, inbyggt i koden (inte dekoration)

- Hero-besparingen beräknas vid **stödtjänster = 0 OCH effektavgift = 0**. Solel/batteri/stödtjänster visas
  som separata, märkta upside-rader, aldrig inräknade i hjältesiffran.
- Pumpen visar **ROT 30 % på arbetet, aldrig grön teknik** (brutto → ROT → netto).
- **Verklig fält-SPF**, aldrig energimärkningens SCOP. Payback som **spann**, inte en punkt.
- Är nuvarande system redan effektivt (t.ex. ved/pellets) visar verktyget ärligt "liten eller ingen
  besparing" och mjukar upp CTA:n, i stället för att hitta på en vinst.
- Inga "1000+ kunder" / "5.0" / "hela Sverige". Footprint i dag: Stockholmsregionen.

## Arkitektur (5-lagers chassi, statiskt, körs på GitHub Pages)

`data.js` (datalagret, varje siffra källmärkt eller `[GAP]`) → `engine.js` (ren `calculate(inputs, D)`,
noll hårdkodade tal) → `app.js` (renderare + interaktion + SVG-kurvan) → `index.html` (skalet) +
`tool.css` (Ampy-tokens). Avrundning sker bara i renderaren.

## ⚠ Siffrorna är försiktiga schabloner — väntar signering

Verktyget är **byggt och klart**; de slutliga talen ska signeras av elektriker/ägare innan skarp drift.
Allt ligger i `data.js` så bytet är en enda fils ändring. Ranking (se
`energikalkylatorn/RAKNINGSCHOCKEN-DATA-DEEPENING.md` §6 i Ampy-arbetsytan):

1. `R4[GAP-1]` värmepumpens månadskurva (expert) · 2. `R3[GAP-4]` SE3-graddagsvektor (ägare; en vektor
launchar) · 3. `R1[GAP-1]` fält-SPF-punkt per system (expert) · 4. `R2[GAP-1]` Ampys egna frånpriser (ägare)
· 5. `R1[GAP-2]` zon/framledning-haircut · 6. `R3[GAP-2]` varmvattenkoefficient · 7. DSO-effektavgiftstatus
(Vattenfall/E.ON) · 8. `R3[GAP-5]` per-DSO CSV-spec (fidelity, ej N1-blocker) · 9. bergvärme i footprint ·
10. CO₂-faktor.

Källor till de befintliga schablonerna: Energimyndigheten (småhus-energistatistik, värmepumpstester/SP),
SMHI (graddagar/normalår), Skatteverket (ROT). Se `energikalkylatorn/dossier/` i Ampy-arbetsytan.
