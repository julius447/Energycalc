# Energycalc — Ampy energikalkylatorn (bildspecs A/B/C)

Tre testbara design-bildspecs för Ampys energikalkylator: en värmepumpsjämförelse
(nuvarande uppvärmning vs luft-luft / luft-vatten / bergvärme, med solel/batteri och full datavisning).

**Live:** https://julius447.github.io/Energycalc/

Samma skal, samma hjälte-siffra, samma inputs. Bara **signaturdevicen** skiljer, vilket är det enda som A/B/C-testas.

| Variant | Signaturdevice | Lins | Status |
|---|---|---|---|
| [A · systembytet](a.html) | 4-systemstapeln | "vilket system" | safe fallback / kontrollarm |
| [B · räkningschocken](b.html) | 12-månaderskurvan | "när det gör ont" | **rekommenderad** (med A:s känd-siffra som N1) |
| [C · hela hemmet](c.html) | energiflödet | "hur allt hänger ihop" | korsförsäljnings-brygga, ej N1-device |

## Viktigt

- Siffrorna är **platshållare** och väntar elektriker-/ägarsignering. De är märkta som sådana i varje bild.
- Candour-grind: hero vid **stödtjänster=0 och effektavgift=0**. Pumpen visar **ROT 30 %**, aldrig grön teknik.
- Tokens: teal `#00a991`, midnight `#090b32`, Outfit. Footprint = Stockholmsregionen idag (nationellt = framtid).
- Detta är **wireframe-bildspecs** (pipeline-steg 1–2), inte produktion.

Den fullständiga analysen, scorecorden och den djupa uppdateringen finns i Ampy-arbetsytan
(`ENERGIKALKYLATORN-DEEP-UPDATE.md`).
