-- SmartBasket Agent — READ-ONLY szerepkör az agent runSql/listCategories
-- toolokjaihoz (docs/db-migration-rationale.md). A docker-entrypoint ezt a
-- POSTGRES_USER (smartbasket) néven, a POSTGRES_DB-n futtatja, a Postgres
-- első indulásakor (üres adatkönyvtár).

CREATE ROLE smartbasket_ro WITH LOGIN PASSWORD 'smartbasket_ro';

-- Csatlakozás a public sémához - de SEMMI automatikus SELECT.
GRANT CONNECT ON DATABASE smartbasket TO smartbasket_ro;
GRANT USAGE ON SCHEMA public TO smartbasket_ro;

-- SZÁNDÉKOSAN NINCS "GRANT SELECT ON ALL TABLES" vagy "ALTER DEFAULT
-- PRIVILEGES ... ON TABLES" itt: az architektura.md/konvenciok.md 6. pontja
-- szerint az agent SOHA nem érheti el a nyers products/import_metadata
-- táblát, csak a vw_ view-ket. Ha a smartbasket_ro alapértelmezésben minden
-- jövőbeli táblára SELECT-et kapna, ez a szabály csak a system prompton
-- (LLM-fegyelmen) múlna - a DB-szerver semmit nem kényszerítene ki.
-- Ehelyett a séma-migráció (0001_init.sql) a séma létrehozása UTÁN,
-- NÉVSZERINT csak a három vw_ view-re ad SELECT jogot a smartbasket_ro
-- szerepnek - a raw táblákra sosem.
--
-- FONTOS: ez a script csak a container ELSŐ indulásakor fut le (üres
-- adatkönyvtárnál, docker-entrypoint-initdb.d). Ha a Postgres-kötetet
-- törlöd és újraépíted (`docker compose down -v`), újra lefut. Ha viszont
-- a séma máshogy épül újra (pl. kézzel futtatott DROP SCHEMA), a
-- view-grantok elvesznek — ezért a 0001_init.sql migráció végén egy védő
-- DO-blokk újra alkalmazza ezeket, ha a smartbasket_ro szerep létezik.
