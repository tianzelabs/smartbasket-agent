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

SQLite

↓

Agent

↓

Tool Loop

↓

runSql()

↓

SQLite

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
- SQLite
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

SQLite SELECT végrehajtása.

Csak olvasási művelet.

Tiltott:

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

import SQLite

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
- SQLite feltöltése

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

SQLite adatbázis.

Fájl:

```

data/smartbasket.db

```

Fő táblák:

- products
- import_metadata

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

Az adatbázis elérési útja is konfigurálható.

---

# 15. Döntések

## SQLite

Nem szükséges Docker.

Egyszerűbb fejlesztés.

Gyorsabb lokális futás.

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
