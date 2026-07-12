# SmartBasket Agent

Egy CLI eszköz, ami megválaszolja azt a kérdést, amit mindenki felteszi bevásárlás előtt: hol olcsóbb ez a termék? A válaszhoz nem kell külön megnyitni a Tesco, a Lidl, az Aldi és a többi üzletlánc appját - elég megkérdezni magyarul, a rendszer a hivatalos GVH Árfigyelő napi adatai alapján válaszol.

## Miért csináltuk

Az árösszehasonlítás ma azt jelenti, hogy valaki sorban végignyitja 4-5 üzletlánc appját, és fejben vagy jegyzetben tartja számon, hol mennyibe kerül ugyanaz a termék. Ez percekbe kerül minden egyes alkalommal, és a legtöbben egyszerűen nem csinálják meg - inkább ott vásárolnak, ahová amúgy is mennek.

A SmartBasket ezt a keresést egyetlen kérdéssé egyszerűsíti: `"Hol a legolcsóbb a Dove testápoló?"`, és a válasz másodperceken belül megjön, valós, aznapi hivatalos árak alapján. Egy 5 fős iroda esetére számolt konkrét megtakarítást a [`docs/roi.md`](docs/roi.md) tartalmazza.

## Mit csinál valójában

A CLI egy AI agentnek adja tovább a kérdést, ami magyarul, természetes nyelven kapja meg a felhasználó kérdését, SQL-lé fordítja, lefuttatja a helyi SQLite adatbázison, és a kapott sorokból ad emberi választ. Az adatbázis minden kérdés előtt automatikusan frissül a GVH Árfigyelő aznapi Excel-exportjából, tehát a felhasználónak sosem kell külön "frissítést" indítania - egyszerűen csak kérdez.

Nem csak egyetlen termékre kérdezhetünk rá - az agent egy egész kosarat is összeállít, kategóriánként a legolcsóbb tétellel:

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

A rendszer szándékosan **nem talál ki adatot**: ha nincs a kérdésre releváns termék az adatbázisban, ezt egyértelműen közli, ahelyett hogy hallucinálna egy árat.

## A technológiai stack és miért ezt választottuk

| Mire kell       | Mit használunk                           | Miért                                                                                                                    |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Nyelv, monorepo | TypeScript, Nx (pnpm workspace)          | egy repóban él a CLI és az üzleti logika, közös típusokkal, gyors cache-elt build/teszt                                  |
| Adatbázis       | SQLite (`better-sqlite3`)                | egyfelhasználós, helyi CLI-nek nem kell Postgres/Docker - egy fájl, nulla üzemeltetés                                    |
| AI              | `@anthropic-ai/sdk`, saját tool-use loop | kézzel írt agent-loop az SDK fölött (nem a beépített `toolRunner`), hogy a mechanika végig látható és tanulható maradjon |
| CLI             | Commander                                | egyszerű, jól ismert parancssori keretrendszer                                                                           |
| Validáció       | Zod                                      | a rendszerhatárokon (env változók, Excel-sorok, tool-inputok) mindent explicit módon ellenőrzünk, `unknown`-ból indulva  |
| Excel-import    | `xlsx`                                   | a GVH Árfigyelő napi adatai csak Excelben érhetők el                                                                     |
| Tesztelés       | Vitest                                   | gyors, natív TypeScript/ESM támogatás                                                                                    |

## Hogyan függ össze

```
kérdés → adatfrissítés ellenőrzése → AI agent → runSql/listCategories tool → SQLite → válasz
```

Az agent két saját toollal dolgozik:

- **`runSql`** - csak `SELECT`/`WITH` lekérdezést enged, egy statementet egyszerre, és egy külön, ténylegesen read-only SQLite-kapcsolaton fut. Ez a projekt legkényesebb pontja (a felhasználói kérdésből generált SQL), ezért két független védelmi réteg van rajta: a guard és maga a kapcsolat jogosultsága.
- **`listCategories`** - kilistázza az elérhető termékkategóriákat, ha az agent nem biztos egy kategória pontos nevében.

Az agent sosem éri el közvetlenül a nyers adattáblát, csak szemantikus SQL view-kat (`vw_products`, `vw_categories`, `vw_best_prices`) - ez egyszerűbb, stabilabb sémát ad neki, és csökkenti a hallucináció esélyét.

## Indulás

```bash
pnpm install
cp .env.example .env
# írd be az ANTHROPIC_API_KEY-t a .env-be
```

Ennyi. Az adatbázis séma és a napi GVH-adat automatikusan létrejön az első `ask` vagy `refresh` híváskor - nincs külön migrációs vagy seed-lépés.

```bash
pnpm smartbasket ask "Hol a legolcsóbb a Dove testápoló?"
pnpm smartbasket ask "Hasonlítsd össze a Tesco és a Lidl árait."
pnpm smartbasket ask "Milyen kategóriák érhetők el?"

pnpm smartbasket ask                                    # interaktív mód, "exit"-ig
pnpm smartbasket ask "..." --show-prompt                # a teljes system promptot és a tool-hívásokat is kiírja
pnpm smartbasket refresh                                # adatbázis frissítése kézzel (ask is megteszi ezt automatikusan)
```

Minden `ask`-hoz JSONL napló készül a `logs/` mappába: a kérdés, a generált SQL, a tool-hívások, a válasz és a token-felhasználás.

## Fejlesztőknek

```bash
pnpm exec nx run-many -t build,lint,typecheck,test   # teljes ellenőrzés
pnpm exec nx test core                               # csak a packages/core tesztjei
```

A kódbázis két Nx projektre oszlik: `apps/cli` csak I/O-t végez (parancsok, kimenet), minden üzleti logika a `packages/core`-ban él, alkategóriákra bontva (`agent`, `tools`, `prompts`, `database`, `importer`, `parser`, `freshness`, `config`, `logging`).

A fejlesztés fázisolt terve, minden fázishoz tartozó commit- és PR-lánccal: [`docs/proposal-implementacio.md`](docs/proposal-implementacio.md). A többi dokumentum:

- [`docs/brs-smartbasket.md`](docs/brs-smartbasket.md), [`docs/architektura.md`](docs/architektura.md), [`docs/konvenciok.md`](docs/konvenciok.md), [`docs/stack.md`](docs/stack.md) - eredeti specifikáció
- [`docs/system-prompt.md`](docs/system-prompt.md) / [`docs/system-prompt-improvements.md`](docs/system-prompt-improvements.md) - az agent system promptja és a rajta végzett, indokolt javítások
- [`docs/roi.md`](docs/roi.md) - mennyit spórol ez egy 5 fős irodának, számokkal
- [`docs/plugins.md`](docs/plugins.md) - a projekthez telepített Claude Code plugin-ök és hogy miért pont ezek

## Mi nincs benne (még)

Egy adott kosár ad-hoc összeállítása és beárazása (lásd fent) már most is megy - amit nem tud: mentett/visszatérő kosarak, több üzletlánc közötti útvonal- és utazási költség szerinti optimalizálás, történeti ártrendek, webes felület, REST API, MCP szerver, több adatforrás. Ezek tudatosan nem részei az első verziónak, de az architektúra nem zárja ki őket.

## Háttér

A projekt az _AI Ágensfejlesztés az Alapoktól_ kurzus beadandó feladataként készült: egy valós problémát megoldó AI agent, ami természetes nyelvű kérdéseket SQL-lekérdezésekké alakít, és kizárólag hivatalos, ellenőrzött adatok alapján válaszol.
