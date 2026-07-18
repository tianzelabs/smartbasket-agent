# SmartBasket Agent – Architektúra

## 1. Architektúra célja

A SmartBasket Agent moduláris felépítésű AI alkalmazás.

Az architektúra célja:

- egyszerű bővíthetőség
- jól elkülönített felelősségi körök
- determinisztikus adatkezelés
- jól tesztelhető komponensek
- agent-barát struktúra

A projekt CLI alkalmazásként fut.

---

# 2. Magas szintű architektúra

```

Felhasználó

↓

CLI

↓

Dataset Freshness Check

↓

Postgres

↓

Agent

↓

Tool Loop

↓

runSql()

↓

Postgres

↓

Természetes nyelvű válasz

```

Az LLM kizárólag az adatbázisból olvas.

Minden adatfrissítés determinisztikus alkalmazáslogika.

---

# 3. Projekt struktúra

```

smartbasket/

├── apps/
│   └── cli/
│
├── packages/
│   └── core/
│
├── docs/
│
├── data/
│
├── logs/
│
├── scripts/
│
└── package.json

```

---

# 4. apps/cli

Feladata:

- CLI parancsok
- felhasználói input
- stdout
- hibakezelés

Nem tartalmaz üzleti logikát.

Példák:

```

smartbasket ask "Hol a legolcsóbb a tej?"

```

```

smartbasket refresh

```

---

# 5. packages/core

A teljes üzleti logika itt található.

```

core/

```

tartalmazza:

- AI agent
- SQL tool
- importer
- Postgres
- prompt
- parser

Semmilyen CLI specifikus kód nincs benne.

---

# 6. Core modulok

```

core/

├── agent/
├── tools/
├── database/
├── importer/
├── parser/
├── freshness/
├── prompts/
└── logging/

```

---

# 7. Agent

Feladata:

- kérdés feldolgozása
- tool használata
- válasz generálása

Nem:

- tölt le adatot
- ír adatbázisba
- módosít adatokat

---

# 8. Tool-ok

## runSql

Feladata:

Postgres SELECT végrehajtása, a smartbasket_ro szerepkörön.

Csak olvasási művelet - négy független rétegben (docs/db-migration-rationale.md):

1. smartbasket_ro szerepkör: DB-szerver szinten csak SELECT jog, csak a vw_ view-kre.
2. SQL-guard: csak egyetlen SELECT/WITH statement, tiltott kulcsszavak.
3. READ ONLY tranzakció minden lekérdezésen.
4. statement_timeout (5s).

Tiltott (guard-szinten):

- INSERT
- UPDATE
- DELETE
- DROP
- ALTER
- PRAGMA
- ATTACH

---

## listCategories

Feladata:

```

SELECT DISTINCT category_name

```

Az agent ezt használja,
ha nem biztos a kategóriában.

---

# 9. Freshness modul

Ez a projekt egyik legfontosabb komponense.

Feladata:

- import_metadata ellenőrzése
- napi frissítés szükségességének eldöntése

Az LLM ezt nem vezérli.

```

Felhasználó

↓

ensureFreshDataset()

↓

Mai adat?

↓

igen --------→ askAgent()

↓

nem

↓

download Excel

↓

import Postgres

↓

askAgent()

```

Ez biztosítja,
hogy az agent mindig aktuális adatokkal dolgozzon.

---

# 10. Importer

Feladata:

- Excel letöltése
- Excel olvasása
- Postgres feltöltése (a smartbasket RW szerepkörön)

Import során:

1.

letöltés

↓

2.

validáció

↓

3.

tranzakció indítása

↓

4.

régi snapshot törlése

↓

5.

új adatok importja

↓

6.

metadata frissítése

↓

7.

commit

Ha hiba történik,

rollback.

---

# 11. Parser

Feladata:

A GVH Excel normalizálása.

Például:

```

Minimum ár

↓

minimum_price

```

```

Üzletlánc név

↓

retailer_name

```

Így a teljes rendszer
angol mezőneveket használ.

---

# 12. Database

Postgres adatbázis, lokálisan docker-compose-zal futtatva.

Két szerepkör, két kapcsolat (docs/db-migration-rationale.md):

- **smartbasket** (RW) - migráció, napi import.
- **smartbasket_ro** (RO) - agent runSql/listCategories/checkDatasetFreshness,
  DB-szerver szinten kizárólag SELECT jog a vw_ view-kre, sosem a raw táblákra.

Fő táblák:

- products
- import_metadata

Szemantikus view-k (amit az agent lát):

- vw_products
- vw_categories
- vw_best_prices
- vw_import_status (belső, freshness-check)

A jövőben bővíthető:

- stores
- user_settings
- import_history

---

# 13. Logging

Minden futás naplózva lesz.

```

logs/

```

JSONL formátumban.

Tartalom:

- timestamp
- kérdés
- SQL
- tool hívások
- válasz
- idő

---

# 14. Konfiguráció

A konfiguráció .env fájlban található.

Példák:

```

ANTHROPIC_API_KEY

```

```

ARFIGYELO_DAILY_XLSX_URL

```

Az adatbázis-kapcsolatok is itt vannak (docker compose up -d után):

```

DATABASE_URL
DATABASE_URL_READONLY

```

---

# 15. Döntések

## Postgres (korábban SQLite volt)

A projekt eredetileg SQLite-ot használt (nem kellett Docker, egyszerűbb és
gyorsabb lokális fejlesztés) - ez egy tudatos, dokumentált eltérés volt a
stack.md-től, egyfelhasználós, konkurens írás nélküli CLI-hez védhető döntés.

A tanári visszajelzés rámutatott, hogy SQLite-on nincs Postgres-szerű
szerepkör-alapú (role-based) védelem: a read-only kapcsolat és a SQL-guard
mindkettő ugyanabban a Node-folyamatban futott. Erre válaszul a projekt
áttért lokális Postgresre (docker-compose), két különálló DB-szerepkörrel
(smartbasket RW, smartbasket_ro RO) - a smartbasket_ro DB-szerver szinten,
a klienskódtól függetlenül csak SELECT-et kap, kizárólag a vw_ view-kre.
Részletek: docs/db-migration-rationale.md.

---

## Snapshot alapú import

Nem tárolunk teljes történeti adatbázist.

Minden nap egy aktuális snapshot.

Egyszerűbb.

Gyorsabb.

---

## SQL-first

Az agent SQL segítségével dolgozik.

Nem ORM-en keresztül.

Ez közelebb áll a kurzus céljához.

---

## Determinisztikus adatfrissítés

Az LLM nem dönt arról,
hogy mikor kell adatot frissíteni.

Ez alkalmazáslogika.

Így:

- reprodukálható
- tesztelhető
- megbízható

---

# 16. Későbbi bővítések

A jelenlegi architektúra támogatja:

- történeti árak
- több adatforrás
- útvonal optimalizálás
- kosár optimalizálás
- web frontend
- REST API
- MCP tool
- több agent
- RAG
