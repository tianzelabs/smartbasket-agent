# HF5 demo transcript

Három élő futás, valós adaton (mai GVH Árfigyelő snapshot + a HF3 tudásbázis),
`pnpm smartbasket ask "..."` paranccsal. Egyik válasz sem előre rögzített - a
teljes tool-hívási lánc (`--show-prompt` a 3. példánál) mutatja, hogy az agent
ténylegesen lefuttatta a toolt, nem a modell "találta ki" a választ.

## 1. Ár kérdés (`runSql`)

```
$ pnpm smartbasket ask "Hol a legolcsóbb a Dove testápoló?"
```

```
Több Dove testápoló is van a katalógusban, sokféle kiszereléssel/típussal. A legfontosabbak:

- Legolcsóbb: Dove Glow & Shine testápoló 250 ml – Rossmann, 499 Ft
- Dove Baby Testápoló 200 ml – Tesco, 795 Ft
- Dove Body Love Care+Visible Glow önbarnító 250 ml – Spar, 1049 Ft
- Dove Night Renew 400 ml – dm, 1215 Ft
- Dove Body Love (több variáns) 400 ml – Müller, 1255–1485 Ft

A pontos "legolcsóbb" attól függ, melyik konkrét variánst/kiszerelést keresed
(pl. 400 ml-es termékek közül a Müller-féle Body Love variánsok a
legkedvezőbbek 1255 Ft-tól). Ha meg tudod adni a pontos típust vagy
kiszerelést, pontosabb választ tudok adni.
```

## 2. Tanácsadás kérdés (`searchKnowledge`, RAG)

```
$ pnpm smartbasket ask "Milyen hőmérsékleten érdemes tartani a hűtőszekrényt?"
```

```
A hűtőszekrényt 0–5 °C közötti hőmérsékleten érdemes tartani (más forrás
szerint 0–4 °C is elegendő) – ez lassítja a károkozó mikrobák szaporodását és
a romlást, így egyszerre segíti az élelmiszerbiztonságot és csökkenti a
pazarlást.

Fontos kiegészítés: sem a hűtés, sem a fagyasztás nem pusztítja el a
kórokozókat, csak lassítja a szaporodásukat, ezért a maradékokat fogyasztás
előtt mindig alaposan fel kell forralni. Fagyasztott élelmiszerek esetén a
tárolási hőmérséklet nem emelkedhet -18 °C fölé.

Források:
- "Maradék nélkül: így lehet pazarlásmentes a karácsony" – https://portal.nebih.gov.hu/-/maradek-nelkul-igy-lehet-pazarlasmentes-a-karacsony
- "Élelmiszerbiztonság, élelmiszerpazarlás: kéz a kézben jár" – https://maradeknelkul.hu/elelmiszerbiztonsag-elelmiszerpazarlas-kez-a-kezben-jar/
```

## 3. Panasz - emberi jóváhagyási pont (`escalateToHuman`, HF5)

```
$ pnpm smartbasket ask "Reklamálni szeretnék, romlott terméket kaptam a rendelésemben, ki tudja ezt intézni?" --show-prompt
```

A modell a `runSql`/`listCategories`/`searchKnowledge` egyikét sem hívta meg -
felismerte, hogy ez panasz, és az `escalateToHuman` toolt hívta:

```json
{
  "name": "escalateToHuman",
  "input": {
    "question": "Reklamálni szeretnék, romlott terméket kaptam a rendelésemben, ki tudja ezt intézni?",
    "reason": "Panasz/reklamáció romlott termékkel kapcsolatban - ez nem ár/készlet vagy tanácsadási kérdés, a runSql/listCategories/searchKnowledge eszközök nem alkalmasak a kezelésére, emberi ügyintéző szükséges."
  },
  "result": {
    "escalated": true,
    "message": "Ezt a kérdést egy kollégánknak továbbítottuk, hamarosan felveszi veled a kapcsolatot."
  },
  "isError": false
}
```

Végső válasz a felhasználónak:

```
A romlott termékkel kapcsolatos reklamációt nem tudom automatikusan intézni,
ezért továbbítottam egy emberi kollégának – hamarosan felveszi veled a
kapcsolatot, és segít a reklamáció ügyintézésében.

Ha közben szükséged van tájékoztatásra arról, mik a fogyasztói jogaid
romlott/hibás élelmiszer esetén (pl. panasztétel módja, elállási jog), szólj,
és a tudásbázisból is tudok erről forrást keresni.
```

A hívás egy sort ír a `logs/escalations.jsonl`-be (timestamp, kérdés, indoklás)
- ez a rendszer egyetlen emberi jóváhagyási pontja, és ez a fájl a forrása a
mérési terv eszkalációs-arány sorának (`docs/measurement-plan.md`).

Emellett a CLI (`apps/cli/src/main.ts`, `alertOnEscalation()`) egy jól látható
figyelmeztetést is kiír stderr-re, hogy a kolléga ne csak akkor vegye észre az
esetet, ha véletlenül megnézi a log fájlt:

```
🔔 ESZKALÁCIÓ - emberi kolléga szükséges (Panasz/reklamáció jellegű ügy
(romlott termék), amely nem ár- vagy készletadat kérdés, így nem válaszolható
meg runSql/listCategories/searchKnowledge eszközökkel - emberi kollégának
kell kezelnie.)
```

Ez még mindig nem élő ügyfélszolgálati/ticketing-integráció (lásd
[`business-case.md`](business-case.md) 6. dia) - egy terminálablakot néző
kollégának szól, nem egy valódi értesítési csatornának -, de már nem csak
csendben egy fájlba írt sor: minden `ask` futás azonnal, láthatóan jelzi, ha
emberi beavatkozás kell.
