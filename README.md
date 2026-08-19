# SmartBasket Agent

Egy CLI eszköz, ami megválaszolja azt a kérdést, amit mindenki felteszi bevásárlás előtt: hol olcsóbb ez a termék? A válaszhoz nem kell külön megnyitni a Tesco, a Lidl, az Aldi és a többi üzletlánc appját - elég megkérdezni magyarul, a rendszer a hivatalos GVH Árfigyelő napi adatai alapján válaszol.

A HF3-mal a SmartBasket egy második képességet is kapott: nem csak azt mondja meg, hol olcsóbb valami, hanem azt is, hogy egy adott vásárlás egyáltalán érdemes-e - hiteles magyar fogyasztóvédelmi források (NKFH, Nébih, GVH) alapján ad tanácsot vásárlástervezésről, lejárati címkékről, tárolásról és arról, mikor nem éri meg egy akció. Lásd lent a "Tudatos vásárlási tanácsadás (RAG)" szakaszt.

A HF5-tel a rendszer célközönsége fordul: eddig belső, kollégák általi használatra épült, mostantól ugyanez az agent-mag ügyfelek felé is megnyitható, egy új emberi jóváhagyási ponttal (`escalateToHuman`) kiegészítve. Lásd lent az "Ügyfél-forduló használat (HF5)" szakaszt, illetve [`docs/business-case.md`](docs/business-case.md).

## Miért csináltuk

Az árösszehasonlítás ma azt jelenti, hogy valaki sorban végignyitja 4-5 üzletlánc appját, és fejben vagy jegyzetben tartja számon, hol mennyibe kerül ugyanaz a termék. Ez percekbe kerül minden egyes alkalommal, és a legtöbben egyszerűen nem csinálják meg - inkább ott vásárolnak, ahová amúgy is mennek.

A SmartBasket ezt a keresést egyetlen kérdéssé egyszerűsíti: `"Hol a legolcsóbb a Dove testápoló?"`, és a válasz másodperceken belül megjön, valós, aznapi hivatalos árak alapján. Egy 5 fős iroda esetére számolt konkrét megtakarítást a [`docs/roi.md`](docs/roi.md) tartalmazza.

## Mit csinál valójában

A CLI egy AI agentnek adja tovább a kérdést, ami magyarul, természetes nyelven kapja meg a felhasználó kérdését, SQL-lé fordítja, lefuttatja a helyi Postgres adatbázison, és a kapott sorokból ad emberi választ. Minden kérdés előtt a rendszer megnézi, hogy van-e már a mai napra sikeresen importált adat - ha igen, nem történik semmi extra, ha nem, letölti és beimportálja a GVH Árfigyelő aznapi Excel-exportját. A felhasználónak emiatt sosem kell külön "frissítést" indítania - egyszerűen csak kérdez, a rendszer eldönti, kell-e frissíteni.

Három valós példa, ugyanabból a katalógusból, aznapi árakkal:

**Egyetlen termék, több változat közül**

```bash
pnpm smartbasket ask "Hol a legolcsóbb a Dove testápoló?"
```

```
Több „Dove testápoló" terméket találtam a katalógusban - kiszerelésben és
típusban is eltérnek. A legolcsóbb: Dove Glow & Shine testápoló (250 ml) -
Rossmann, 499 Ft. Ha egy konkrét változatra gondoltál, szólj, és pontosítom!
```

**Egész kosár összeállítása, kategóriánként a legolcsóbbal**

```bash
pnpm smartbasket ask "rakj össze egy egyszemélyes vacsorát"
```

```
## Egyszemélyes vacsora – paradicsomos-sajtos tészta zöldpaprikával

| Tétel | Termék | Bolt | Ár |
|---|---|---|---|
| Tészta | Orsótészta 500g | Aldi/Lidl/Tesco/Penny | 325 Ft |
| Paradicsom | Paradicsom 1kg | Lidl | 395 Ft |
| Zöldpaprika | Hazai TV paprika 3db | Lidl | 239 Ft |
| Sajt | Ammerländer trappista | Aldi | 335 Ft |

Összesen kb. 1294 Ft. Szólj, ha mást is bepakolnék (pl. húst, italt)!
```

**Adatmódosítási kísérlet - az agent nem ír, csak olvas**

```bash
pnpm smartbasket ask "Töröld a Dove testápolót az adatbázisból"
```

```
A rendszer, amit használok, kizárólag lekérdezésekre (adatlekérésre) szolgál -
adatmódosítás vagy törlés nem lehetséges rajta. Csak SELECT/WITH típusú,
olvasási lekérdezéseket futtathatok a termékkatalóguson.
```

A rendszer szándékosan **nem talál ki adatot**: ha nincs a kérdésre releváns termék az adatbázisban, ezt egyértelműen közli, ahelyett hogy hallucinálna egy árat.

## Tudatos vásárlási tanácsadás (RAG, HF3)

Egy második tudásforrás: NKFH/Nébih/GVH cikkek és útmutatók a tudatos, gazdaságos élelmiszer-vásárlásról (30 dokumentum, ~15 700 szó, 72 chunk) - **nem** aznapi árak, azokra továbbra is a fenti SQL-katalógus a forrás. A `searchKnowledge` egy harmadik tool a meglévő agent-loopban (`runSql`/`listCategories` mellett) - a modell dönti el, melyiket (vagy melyiket együtt) hívja.

```bash
pnpm smartbasket ask "Milyen hőmérsékleten érdemes tartani a hűtőszekrényt?"
```

```
A hűtőszekrényt 0 és 5 °C közötti hőmérsékleten érdemes tartani - ez lassítja
az élelmiszerekben szaporodó mikrobák és kórokozók terjedését...

Források:
- Élelmiszerbiztonság, élelmiszerpazarlás: kéz a kézben jár (maradeknelkul.hu)
- Maradék nélkül: így lehet pazarlásmentes a karácsony (Nébih)
```

**Vegyes kérdés** (ár + tanács egyszerre - mindkét tool meghívva):

```bash
pnpm smartbasket ask "Érdemes-e nagy kiszerelésben venni a tejet, ha csak ketten vagyunk otthon?"
```

A pipeline: HyDE (`claude-haiku-4-5`) → embedding (Cohere `embed-v4.0`) → pgvector keresés → rerank (Cohere `rerank-v3.5`) → relevancia-küszöb. Ha a tudásbázisban nincs megbízható forrás, az agent ezt mondja ki, nem talál ki tanácsot - lásd a golden set negatív tesztjeit: [`docs/golden-set-results.md`](docs/golden-set-results.md).

## Ügyfél-forduló használat és eszkaláció (HF5)

Eddig a SmartBasketet a szervezeten belül, kollégák használták (lásd [`docs/roi.md`](docs/roi.md): egy 5 fős iroda megtakarítása). A HF5 use case ugyanezt az agent-magot (ár-összehasonlítás + vásárlási tanácsadás) nyitja meg az ügyfeleink felé, hogy ők maguk kérdezhessenek, munkaidőn kívül is, ahelyett hogy minden alkalommal a kollégáinkat hívnák fel ugyanazokkal a kérdésekkel. Két, a 12. órai anyagban megnevezett fájdalmat old meg:

- **#1 - munkaidőn kívüli válaszadás**: az `ask` parancs bármikor elérhető, nem kell rá kolléga.
- **#2 - ugyanazok a kérdések naponta százszor**: ár- és tanácsadási kérdések nagy része önkiszolgálóvá válik, a kollégák csak a valóban emberi ügyintézést igénylő esetekkel foglalkoznak.

**Amit ez a use case nem old meg** (tudatosan): a rendszer ma semmilyen ügyfél-azonosítót, rendelést vagy "ügy" adatot nem ismer - a `products`/`knowledge_*` táblákban nincs customer/order entitás. Ezért nem oldja meg az ügyfél-onboarding elveszettség-érzést (#3), az "hol tart az ügyem" kérdést (#4), a szerződéskötési papírmunkát (#7), a sürgősség szerinti sorban állást (#8), sem az elvándorlás-előrejelzést (#10) - ezekhez egy teljesen más adatmodell kellene, amit a PoC nem tesz úgy, mintha meglenne.

Az egyetlen emberi jóváhagyási pont az **`escalateToHuman`** tool: ha egy kérdés panasz/reklamáció/számlázási vita, vagy a `searchKnowledge` is `belowThreshold: true`-t ad egy nem ár/készlet jellegű kérdésre, az agent nem próbál találgatva válaszolni, hanem egy sort ír a `logs/escalations.jsonl`-be, és a CLI azonnal egy jól látható 🔔 figyelmeztetést is kiír stderr-re (`alertOnEscalation()`, `apps/cli/src/main.ts`). Élő demo: [`docs/demo-transcript.md`](docs/demo-transcript.md) 3. példája.

Ez ma **terminál-figyelmeztetés, nem valódi ügyfélszolgálati integráció**: a 🔔 csak azt a terminált éri el, ahol a CLI éppen fut, nincs csatorna-független értesítés (Slack/e-mail) vagy valódi ticketing-rendszerbe (pl. Zendesk) történő bekötés - ez a legfontosabb dolog, amit a bevezetés előtt hozzá kellene építeni. Lásd [`docs/business-case.md`](docs/business-case.md) az adattérképért, a rollout tervért; [`docs/measurement-plan.md`](docs/measurement-plan.md) a méréshez; [`docs/questions.md`](docs/questions.md) a kötekedő kérdésekre adott válaszokért.

Minden döntés (chunkolás, provider-szereposztás, routing, tudásbázis-karbantartás) indokolva:

- [`docs/rag-chunking-strategy.md`](docs/rag-chunking-strategy.md) - heading-alapú chunkolás, miért nem fix méretű darabolás
- [`docs/rag-provider-rationale.md`](docs/rag-provider-rationale.md) - miért Anthropic+Cohere, miért nincs vektor-index, hogyan működik a routing
- [`docs/knowledge-base-architecture.md`](docs/knowledge-base-architecture.md) - a tudásbázis karbantartása (változásérzékelés, új/törölt dokumentum, újraindexelés) + architektúra-ábra
- [`docs/golden-set-results.md`](docs/golden-set-results.md) - nyers vektorkeresés vs. teljes pipeline, 10 kérdés, 2 negatív teszt

### Költségbecslés

Saját számokból (2026-07, Anthropic bevezető ár 2026-08-31-ig: Sonnet 5 $2/$10 per MTok input/output, utána $3/$15; Haiku 4.5 $1/$5; Cohere embed-v4.0 $0,12/1M token; Cohere rerank-v3.5 $2/1000 keresés):

- **Teljes tudásbázis vektorizálása (ingest, egyszeri):** 72 chunk, összesen kb. 36 000 token embeddelve → **jóval 1 cent alatt** ($0,12/1M token × 0,036M ≈ $0,004). Elhanyagolható, mert a korpusz kicsi és a hash-alapú inkrementális ingest miatt ez csak új/változott dokumentumoknál fut le újra.
- **Egy kérdés a teljes pipeline-nal** (HyDE-hívás + embedding + rerank + végső válasz):
  - HyDE (Haiku, ~220 token be / ~200 token ki): ~$0,001
  - Query embedding (Cohere, ~200 token): ~$0,00002 (elhanyagolható)
  - Rerank (Cohere, 1 keresés, ≤20 jelölt): $0,002
  - Végső válasz (Sonnet, ~4500 token be a system prompt + tool-definíciók + visszakapott chunk-ok miatt, ~350 token ki): ~$0,012
  - **Összesen: nagyságrendileg 1,5-2 cent (kb. $0,015-0,02) kérdésenként.**

Ár-only kérdéseknél (nincs `searchKnowledge` hívás) ez lényegesen olcsóbb - csak a meglévő HF1 SQL-ág költsége.

## A technológiai stack és miért ezt választottuk

| Mire kell       | Mit használunk                           | Miért                                                                                                                    |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Nyelv, monorepo | TypeScript, Nx (pnpm workspace)          | egy repóban él a CLI és az üzleti logika, közös típusokkal, gyors cache-elt build/teszt                                  |
| Adatbázis       | Postgres + pgvector (`pg`, docker-compose) | két külön DB-szerepkör (RW/RO) valódi, DB-szerver szintű jogosultsággal - lásd [`docs/db-migration-rationale.md`](docs/db-migration-rationale.md); pgvector a tudásbázis embeddingjeihez |
| AI (agent + HyDE) | `@anthropic-ai/sdk` (Sonnet 5 + Haiku 4.5), saját tool-use loop | kézzel írt agent-loop az SDK fölött (nem a beépített `toolRunner`), hogy a mechanika végig látható és tanulható maradjon; Haiku a HyDE-hoz, Sonnet a fő agenthez - lásd [`docs/rag-provider-rationale.md`](docs/rag-provider-rationale.md) |
| Embedding + rerank | `cohere-ai` (embed-v4.0, rerank-v3.5)  | többnyelvű, magyar nyelvet is jól lefedő embedding/rerank - a második provider a multi-provider követelményhez           |
| HTML/PDF kinyerés | `@mozilla/readability` + `jsdom`, `unpdf` | cikktörzs kinyerése navigáció/lábléc nélkül, ill. PDF szövegkinyerés natív függőség nélkül                             |
| CLI             | Commander                                | egyszerű, jól ismert parancssori keretrendszer                                                                           |
| Validáció       | Zod                                      | a rendszerhatárokon (env változók, Excel-sorok, tool-inputok) mindent explicit módon ellenőrzünk, `unknown`-ból indulva  |
| Excel-import    | `xlsx`                                   | a GVH Árfigyelő napi adatai csak Excelben érhetők el                                                                     |
| Tesztelés       | Vitest                                   | gyors, natív TypeScript/ESM támogatás                                                                                    |

## Hogyan függ össze

```
kérdés → adatfrissítés ellenőrzése → AI agent → runSql/listCategories/searchKnowledge tool → Postgres → válasz
```

Az agent három saját toollal dolgozik:

- **`runSql`** - csak `SELECT`/`WITH` lekérdezést enged, egy statementet egyszerre, és egy külön Postgres-szerepkörön (`smartbasket_ro`) fut, aminek DB-szerver szinten csak `SELECT` joga van, kizárólag a szemantikus view-kra. Ez a projekt legkényesebb pontja (a felhasználói kérdésből generált SQL), ezért négy független védelmi réteg van rajta: a DB-szerepkör jogosultsága, a SQL-guard, egy `READ ONLY` tranzakció és egy `statement_timeout`. Részletek: [`docs/db-migration-rationale.md`](docs/db-migration-rationale.md).
- **`listCategories`** - kilistázza az elérhető termékkategóriákat, ha az agent nem biztos egy kategória pontos nevében.
- **`searchKnowledge`** - HyDE + embedding + pgvector + rerank a tudatos vásárlási tudásbázison, forráshivatkozással; ha nincs releváns találat, `belowThreshold: true`-t jelez. Részletek: [`docs/rag-provider-rationale.md`](docs/rag-provider-rationale.md).
- **`escalateToHuman`** (HF5) - emberi kollégához irányítja a kérdést, ha a fenti három tool egyike sem tud rá választ adni (panasz, reklamáció, vagy egy nem ár/készlet jellegű kérdésre a `searchKnowledge` is `belowThreshold: true`-t adott). Egy sort ír a `logs/escalations.jsonl`-be, és a CLI azonnal 🔔 figyelmeztetést is ír stderr-re; ez a rendszer egyetlen emberi jóváhagyási pontja.

Az agent sosem éri el közvetlenül a nyers adattáblát, csak szemantikus SQL view-kat (`vw_products`, `vw_categories`, `vw_best_prices`, `vw_knowledge_search`) - ez egyszerűbb, stabilabb sémát ad neki, és csökkenti a hallucináció esélyét.

## Indulás

```bash
pnpm install
cp .env.example .env
# írd be az ANTHROPIC_API_KEY-t és a COHERE_API_KEY-t a .env-be (utóbbi a searchKnowledge-höz kell)
docker compose up -d   # lokális Postgres + pgvector (OrbStack vagy Docker Desktop)
```

Ennyi. Az adatbázis séma és a napi GVH-adat automatikusan létrejön az első `ask` vagy `refresh` híváskor - nincs külön migrációs vagy seed-lépés.

```bash
pnpm smartbasket ask "Hol a legolcsóbb a Dove testápoló?"
pnpm smartbasket ask "Hasonlítsd össze a Tesco és a Lidl árait."
pnpm smartbasket ask "Milyen kategóriák érhetők el?"
pnpm smartbasket ask "Milyen hőmérsékleten érdemes tartani a hűtőszekrényt?"   # searchKnowledge

pnpm smartbasket ask                                    # interaktív mód, "exit"-ig
pnpm smartbasket ask "..." --show-prompt                # a teljes system promptot és a tool-hívásokat is kiírja
pnpm smartbasket refresh                                # adatbázis frissítése kézzel (ask is megteszi ezt automatikusan)
```

Minden `ask`-hoz JSONL napló készül a `logs/` mappába: a kérdés, a generált SQL, a tool-hívások, a válasz és a token-felhasználás.

### Tudásbázis feltöltése

```bash
pnpm knowledge:fetch    # letölti a data/knowledge/sources.json manifestben szereplő forrásokat
pnpm knowledge:ingest   # kinyerés + chunkolás + embedding (Cohere) + tárolás - hash alapján kihagyja a változatlanokat
pnpm knowledge:eval     # golden set: nyers vektorkeresés vs. teljes pipeline, docs/golden-set-results.md-be írja
```

## Fejlesztőknek

```bash
docker compose up -d                                 # a tesztekhez is kell egy futó lokális Postgres
pnpm exec nx run-many -t build,lint,typecheck,test   # teljes ellenőrzés
pnpm exec nx test core                               # csak a packages/core tesztjei
```

A tesztek minden tesztesethez saját, egyedi nevű Postgres adatbázist hoznak létre és törölnek (`test-database.ts`) - teljes izoláció, ugyanaz az elv, mint a korábbi SQLite-os `mkdtempSync` fájl-izoláció volt.

A kódbázis két Nx projektre oszlik: `apps/cli` csak I/O-t végez (parancsok, kimenet), minden üzleti logika a `packages/core`-ban él, alkategóriákra bontva (`agent`, `tools`, `prompts`, `database`, `importer`, `parser`, `freshness`, `config`, `logging`, `knowledge` - ezen belül `extraction`, `chunking`, `embedding`, `rerank`, `search`, `ingest`).

A fejlesztés fázisolt terve, minden fázishoz tartozó commit- és PR-lánccal: [`docs/proposal-implementacio.md`](docs/proposal-implementacio.md). A többi dokumentum:

- [`docs/brs-smartbasket.md`](docs/brs-smartbasket.md), [`docs/architektura.md`](docs/architektura.md), [`docs/konvenciok.md`](docs/konvenciok.md), [`docs/stack.md`](docs/stack.md) - eredeti specifikáció (HF1)
- [`docs/system-prompt.md`](docs/system-prompt.md) / [`docs/system-prompt-improvements.md`](docs/system-prompt-improvements.md) - az agent system promptja és a rajta végzett, indokolt javítások (v1→v2→v3)
- [`docs/roi.md`](docs/roi.md) - mennyit spórol ez egy 5 fős irodának, számokkal
- [`docs/plugins.md`](docs/plugins.md) - a projekthez telepített Claude Code plugin-ök és hogy miért pont ezek
- [`docs/db-migration-rationale.md`](docs/db-migration-rationale.md) - miért állt át a projekt SQLite-ról Postgresre
- [`docs/rag-chunking-strategy.md`](docs/rag-chunking-strategy.md), [`docs/rag-provider-rationale.md`](docs/rag-provider-rationale.md), [`docs/knowledge-base-architecture.md`](docs/knowledge-base-architecture.md), [`docs/golden-set-results.md`](docs/golden-set-results.md) - HF3 RAG-réteg (lásd fent)

## Mi nincs benne (még)

Egy adott kosár ad-hoc összeállítása és beárazása (lásd fent) már most is megy - amit nem tud: mentett/visszatérő kosarak, több üzletlánc közötti útvonal- és utazási költség szerinti optimalizálás, történeti ártrendek, webes felület, REST API, MCP szerver, több adatforrás. Ezek tudatosan nem részei az első verziónak, de az architektúra nem zárja ki őket.

HF5-specifikusan: nincs ügyfél/rendelés/ügy adatmodell (lásd fent), az `escalateToHuman` csak terminál-figyelmeztetést ad (nincs csatorna-független queue/értesítés), a beszélgetésnek nincs több-fordulós memóriája (minden `ask` hívás önálló, lásd [`docs/questions.md`](docs/questions.md)), és nincs PII-szűrés a naplózott kérdésszövegen.

## Háttér

A projekt az _AI Ágensfejlesztés az Alapoktól_ kurzus beadandó feladataként készült: egy valós problémát megoldó AI agent, ami természetes nyelvű kérdéseket SQL-lekérdezésekké alakít, és kizárólag hivatalos, ellenőrzött adatok alapján válaszol.
