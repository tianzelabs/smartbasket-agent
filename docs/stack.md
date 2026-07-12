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

| Komponens | Technológia |
|------------|-------------|
| Nyelv | TypeScript |
| Runtime | Node.js LTS |
| Package manager | pnpm |
| Monorepo | Nx |
| CLI | Commander |
| AI SDK | Anthropic SDK |
| Validáció | Zod |
| Adatbázis | SQLite |
| SQLite Driver | better-sqlite3 |
| Excel import | xlsx |
| Teszt | Vitest |
| Formázás | Prettier |
| Linter | ESLint |

---

# 4. Miért SQLite?

A kurzus példája PostgreSQL-t használ.

A SmartBasket Agent azonban:

- lokálisan fut
- egyfelhasználós CLI alkalmazás
- nem igényel hálózati adatbázist
- nem igényel párhuzamos írást
- minden adat egyetlen napi Excel fájlból származik

Ezért a SQLite egyszerűbb és jobban illeszkedik
a projekt céljaihoz.

Előnyei:

- nincs szükség Dockerre
- nincs szükség külön adatbázis szerverre
- egyetlen fájl az adatbázis
- teljes SQL támogatás
- könnyű verziókezelés
- gyors lokális fejlesztés

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

- SQLite adatbázis
- letöltött Excel fájlok

logs/

- agent futási naplók

---

# 6. Adatforrás

A rendszer hivatalos GVH Árfigyelő adatokat használ.

Forrás:

https://cdnarfigyeloprodweu.azureedge.net/excel/arfigyelo_napi_termekadatok.xlsx

A letöltött adatokat minden import során
SQLite adatbázisba tölti.

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

# 8. SQLite séma

## products

A napi Árfigyelő snapshot tárolása.

| Oszlop | Típus |
|---------|-------|
| product_identifier | TEXT |
| product_name | TEXT |
| category_identifier | INTEGER |
| category_name | TEXT |
| retailer_name | TEXT |
| unit | TEXT |
| package_size | REAL |
| minimum_price | REAL |
| maximum_price | REAL |
| minimum_unit_price | REAL |
| maximum_unit_price | REAL |
| retailer_count | INTEGER |
| available_store_count | INTEGER |
| retailer_total_store_count | INTEGER |
| imported_at | DATETIME |

Composite index:

(product_identifier, retailer_name)

Index:

- category_name
- retailer_name
- product_name

---

## import_metadata

A napi import állapotának nyilvántartása.

| Oszlop | Típus |
|---------|-------|
| import_date | DATE |
| source_url | TEXT |
| downloaded_at | DATETIME |
| imported_at | DATETIME |
| imported_rows | INTEGER |
| checksum | TEXT |
| status | TEXT |

---

# 9. SQL View

Az AI agent nem közvetlenül a nyers táblát kérdezi.

Létrejön egy szemantikus nézet:

product_prices

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

SQLite

↓

askAgent()

↓

runSql()

↓

SQLite

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