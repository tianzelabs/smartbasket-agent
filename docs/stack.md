# SmartBasket Agent – Technical Stack

## 1. Cél

A SmartBasket Agent egy lokálisan futó, TypeScript alapú AI agent,
amely természetes nyelvű kérdésekre válaszol SQL segítségével.

A projekt elsődleges célja egy egyszerű, reprodukálható,
agent-barát fejlesztői környezet létrehozása.

---

# 2. Tervezési alapelvek

A technológiai stack kiválasztásánál az alábbi szempontokat vettük figyelembe:

- egyszerű lokális fejlesztés
- Docker nélküli futtatás
- minimális infrastruktúra
- gyors fejlesztési ciklus
- könnyen használható Claude Code-dal
- könnyű reprodukálhatóság
- SQL-first megközelítés

---

# 3. Technológiai stack

| Komponens       | Technológia    |
| --------------- | -------------- |
| Nyelv           | TypeScript     |
| Runtime         | Node.js LTS    |
| Package manager | pnpm           |
| Monorepo        | Nx             |
| CLI             | Commander      |
| AI SDK          | Anthropic SDK  |
| Validáció       | Zod            |
| Adatbázis       | Postgres (docker-compose) |
| Postgres Driver | pg             |
| Excel import    | xlsx           |
| Teszt           | Vitest         |
| Formázás        | Prettier       |
| Linter          | ESLint         |

---

# 4. Adatbázis: Postgres (korábban SQLite volt)

A kurzus példája PostgreSQL-t használ.

A projekt egy ideig SQLite-ot használt helyette - egyfelhasználós, lokális,
konkurens írás nélküli CLI-hez ez védhető döntés volt (nem kell Docker,
egyetlen fájl az adatbázis). Ezt a tanári visszajelzés vetette fel: SQLite-on
nincs Postgres-szerű szerepkör-alapú (role-based) hozzáférés-vezérlés, így a
`runSql` read-only kapcsolata és a SQL-guard ugyanabban a Node-folyamatban
futott - nem volt tőle teljesen független, DB-szerver szintű védelem.

A projekt ezért visszaállt a kurzus alapértelmezett Postgresére, lokálisan,
docker-compose-zal futtatva, két külön DB-szerepkörrel:

- **smartbasket** (RW) - migráció, napi import.
- **smartbasket_ro** (RO) - az agent `runSql`/`listCategories` toolja, DB-szerver
  szinten kizárólag `SELECT` joggal, csak a szemantikus view-kra.

Az ORM-mentesség (nincs Prisma, sima SQL migrációk) változatlan maradt - ez
külön, továbbra is érvényes döntés (`konvenciok.md` "SQL-first" pontja).

Részletek: [`docs/db-migration-rationale.md`](db-migration-rationale.md).

---

# 5. Projekt struktúra

A projekt Nx monorepo formában készül.

packages/

- core

apps/

- cli

docs/

- projekt dokumentáció

data/

- letöltött Excel fájlok

logs/

- agent futási naplók

---

# 6. Adatforrás

A rendszer hivatalos GVH Árfigyelő adatokat használ.

Forrás:

https://cdnarfigyeloprodweu.azureedge.net/excel/arfigyelo_napi_termekadatok.xlsx

A letöltött adatokat minden import során
Postgres adatbázisba tölti.

Az AI agent kizárólag a lokális adatbázisból olvas.

---

# 7. Adatfrissítés

Minden kérdés előtt a rendszer ellenőrzi,
hogy az adatbázis tartalmazza-e a mai adatokat.

Ha nem:

1. letölti a napi Excel fájlt
2. törli az előző snapshotot
3. újraimportálja az adatokat
4. frissíti az import_metadata táblát

Ez a folyamat determinisztikus,
nem az LLM dönti el.

---

# 8. Postgres séma

## products

A napi Árfigyelő snapshot tárolása.

| Oszlop                     | Típus       |
| --------------------------- | ----------- |
| product_identifier         | TEXT        |
| product_name               | TEXT        |
| category_identifier        | INTEGER     |
| category_name              | TEXT        |
| retailer_name              | TEXT        |
| unit                       | TEXT        |
| package_size               | NUMERIC     |
| minimum_price              | NUMERIC     |
| maximum_price              | NUMERIC     |
| minimum_unit_price         | NUMERIC     |
| maximum_unit_price         | NUMERIC     |
| retailer_count             | INTEGER     |
| available_store_count      | INTEGER     |
| retailer_total_store_count | INTEGER     |
| imported_at                | TIMESTAMPTZ |

Composite index:

(product_identifier, retailer_name)

Index:

- category_name
- retailer_name
- product_name

---

## import_metadata

A napi import állapotának nyilvántartása.

| Oszlop        | Típus       |
| ------------- | ----------- |
| import_date   | DATE        |
| source_url    | TEXT        |
| downloaded_at | TIMESTAMPTZ |
| imported_at   | TIMESTAMPTZ |
| imported_rows | INTEGER     |
| checksum      | TEXT        |
| status        | TEXT        |

---

# 9. SQL View-k

Az AI agent nem közvetlenül a nyers táblát kérdezi.

Létrejön három szemantikus nézet:

- vw_products
- vw_categories
- vw_best_prices

Ez egyszerűbb oszlopneveket biztosít.

Például:

minimum_price

↓

min_price

retailer_name

↓

retailer

category_name

↓

category

Ez csökkenti az LLM hibázási lehetőségét.

A smartbasket_ro (RO) DB-szerepkör DB-szerver szinten kizárólag ezekre a
view-kra kap SELECT jogot - a nyers products/import_metadata táblákra soha
(docs/db-migration-rationale.md).

---

# 10. Tool-ok

A projekt az alábbi toolokat tartalmazza.

runSql

Feladata:

- SELECT lekérdezések futtatása
- kizárólag olvasási jogosultság

listCategories

Feladata:

- SELECT DISTINCT category_name

checkDatasetFreshness

Feladata:

- import_metadata ellenőrzése

refreshDataset

Feladata:

- Excel letöltése
- importálása

A refreshDataset nem közvetlenül az LLM által hívható,
hanem az alkalmazás automatikusan futtatja.

---

# 11. Agent architektúra

Felhasználó

↓

CLI

↓

checkDatasetFreshness()

↓

Postgres

↓

askAgent()

↓

runSql()

↓

Postgres

↓

Természetes nyelvű válasz

---

# 12. Naplózás

Minden agent futás naplózásra kerül.

A log tartalmazza:

- kérdés
- generált SQL
- tool hívások
- válasz
- futási idő

A logok JSONL formátumban kerülnek mentésre.
