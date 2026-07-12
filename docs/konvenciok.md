# SmartBasket Agent – Fejlesztési Konvenciók

# 1. Cél

Ez a dokumentum a SmartBasket Agent fejlesztési szabályait írja le.

A cél:

- egységes kódbázis
- könnyű karbantarthatóság
- AI agent számára könnyen érthető projekt
- reprodukálható fejlesztés

---

# 2. Általános alapelvek

Mindig:

- egyszerű megoldást válassz
- kis függvényeket írj
- egy függvény egy feladatot végezzen
- kerüld a felesleges absztrakciót
- előnyben részesítsd a determinisztikus működést

Kerüld:

- overengineering
- magic stringeket
- globális state-et
- duplikált logikát

---

# 3. Projekt nyelve

Kód:

angol

Adatbázis:

angol

Dokumentáció:

magyar

CLI:

magyar

Példa:

Product

Retailer

MinimumPrice

de

"Hasonlítsd össze a Tesco és a Lidl árait."

---

# 4. Naming Convention

Fájlok:

kebab-case

Példa:

run-sql.ts

check-dataset-freshness.ts

Excel-parser.ts

Osztályok:

PascalCase

SmartBasketAgent

ProductImporter

Függvények:

camelCase

checkDatasetFreshness()

downloadDailyExcel()

runSql()

Konstansok:

UPPER_SNAKE_CASE

---

# 5. SQL szabályok

Az AI agent kizárólag SQL segítségével kérdezheti le az adatbázist.

A runSql tool:

engedélyezi

SELECT

WITH

tiltja

INSERT

UPDATE

DELETE

DROP

ALTER

CREATE

ATTACH

PRAGMA

Egyszerre csak egy SQL statement engedélyezett.

---

# 6. Semantic Layer

Az agent nem közvetlenül a nyers táblákból dolgozik.

Mindig SQL View-kat használ.

Példa:

vw_products

vw_categories

vw_best_prices

Ennek oka:

- egyszerűbb SQL
- stabil séma
- kisebb hallucination kockázat
- könnyebb jövőbeni módosítás

Az LLM soha ne használja közvetlenül
a raw_products táblát.

---

# 7. SQLite konvenciók

Minden adat SQLite-ban található.

Nem használunk:

PostgreSQL

MySQL

DuckDB

Minden adat import során tranzakcióban frissül.

Sikertelen import esetén rollback történik.

---

# 8. Excel import

A parser mindig ugyanazt a folyamatot követi.

download

↓

validate

↓

parse

↓

normalize

↓

transaction

↓

replace snapshot

↓

commit

A parser nem tartalmaz üzleti logikát.

---

# 9. Error Handling

Minden hiba explicit.

Ne használjunk:

catch {}

Minden hiba:

- logolásra kerül
- újradobásra kerül
- ember által olvasható üzenetet ad

---

# 10. Logging

Minden agent futás naplózásra kerül.

JSONL formátum.

Minden log tartalmazza:

- timestamp
- prompt
- SQL
- tool-ok
- válasz
- futási idő

Ne logoljunk:

API kulcsot

.env tartalmát

személyes adatot

---

# 11. AI Agent szabályok

Az agent:

nem találhat ki adatokat

nem becsülhet árakat

nem módosíthat adatbázist

nem tölthet le adatot

A válasz kizárólag SQL eredményen alapulhat.

Ha nincs adat:

azt egyértelműen jelezze.

---

# 12. Freshness

Az agent előtt mindig lefut:

checkDatasetFreshness()

Ez alkalmazáslogika.

Nem LLM döntés.

---

# 13. Tool konvenciók

Minden tool:

egy feladat

egy input

egy output

Nincsenek "multi-purpose" toolok.

Példa:

runSql()

listCategories()

downloadDailyExcel()

parseExcel()

---

# 14. Tesztelés

Minden új modulhoz:

unit test

A kritikus komponensek:

SQL

parser

freshness

tool-ok

Agent válaszok

integration tesztet is kapnak.

---

# 15. Jövőbeli bővíthetőség

Az architektúra támogatja:

REST API

Web UI

MCP Tool

RAG

történeti árak

bevásárlókosár optimalizálás

útvonal optimalizálás

de ezek nem részei az első verziónak.

---

# 16. Claude Code konvenció

Claude Code minden módosítás előtt:

- olvassa el ezt a dokumentumot
- kövesse az architektúrát
- ne vezessen be új frameworköt
- ne módosítsa önkényesen az adatmodellt
- ne sértse meg a SQL-first megközelítést

Minden nagyobb döntést dokumentálni kell.

A cél nem a legbonyolultabb megoldás, hanem a legegyszerűbb, legolvashatóbb és legjobban karbantartható rendszer.
