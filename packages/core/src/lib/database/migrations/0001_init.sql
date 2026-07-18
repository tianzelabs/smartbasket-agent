-- products: napi GVH Árfigyelő snapshot (stack.md 8. pont).
-- A tábla minden import során teljesen lecserélődik (importer.ts), nincs történeti adat.
CREATE TABLE products (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_identifier TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category_identifier INTEGER,
  category_name TEXT NOT NULL,
  retailer_name TEXT NOT NULL,
  unit TEXT,
  package_size NUMERIC,
  minimum_price NUMERIC NOT NULL,
  maximum_price NUMERIC NOT NULL,
  minimum_unit_price NUMERIC,
  maximum_unit_price NUMERIC,
  retailer_count INTEGER,
  available_store_count INTEGER,
  retailer_total_store_count INTEGER,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_identifier_retailer ON products (product_identifier, retailer_name);
CREATE INDEX idx_products_category_name ON products (category_name);
CREATE INDEX idx_products_retailer_name ON products (retailer_name);
CREATE INDEX idx_products_product_name ON products (product_name);

-- import_metadata: a napi import állapotának nyilvántartása (stack.md 8. pont).
CREATE TABLE import_metadata (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  import_date DATE NOT NULL,
  source_url TEXT NOT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL,
  imported_rows INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE INDEX idx_import_metadata_import_date ON import_metadata (import_date);

-- Szemantikus view-k (konvenciok.md 6. pont): az agent SOHA nem éri el közvetlenül
-- a raw products táblát, csak ezeket - stabil séma, egyszerűbb oszlopnevek,
-- kisebb hallucination kockázat.

CREATE VIEW vw_products AS
SELECT
  product_identifier AS id,
  product_name AS name,
  category_name AS category,
  retailer_name AS retailer,
  unit,
  package_size,
  minimum_price AS min_price,
  maximum_price AS max_price,
  minimum_unit_price AS min_unit_price,
  maximum_unit_price AS max_unit_price,
  available_store_count,
  retailer_total_store_count,
  imported_at
FROM products;

CREATE VIEW vw_categories AS
SELECT DISTINCT category_name AS category
FROM products
ORDER BY category_name;

-- A legolcsóbb üzletlánc termékenként (BRS 4. és 7. pont: "Hol a legolcsóbb X?").
CREATE VIEW vw_best_prices AS
SELECT
  product_identifier AS id,
  product_name AS name,
  category_name AS category,
  retailer_name AS retailer,
  minimum_price AS price
FROM (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY product_identifier
      ORDER BY minimum_price ASC
    ) AS rn
  FROM products
) ranked
WHERE rn = 1;

-- Belső view a checkDatasetFreshness()-hez (freshness/check-dataset-freshness.ts):
-- ez determinisztikus alkalmazáslogika, NEM az LLM-nek szánt séma (nem szerepel a
-- system prompt <schema> blokkjában), de a smartbasket_ro kapcsolaton fut, ezért
-- neki is view-n keresztül kell olvasnia a raw import_metadata táblát.
CREATE VIEW vw_import_status AS
SELECT import_date, status
FROM import_metadata;

-- Read-only szerepkör jogosultságai (docs/db-migration-rationale.md):
-- NÉVSZERINT csak a három vw_ view-re, sosem a raw products/import_metadata
-- táblára - így a "sose a nyers táblát" szabályt (architektura.md,
-- konvenciok.md 6. pont) a DB szerver is kikényszeríti, nem csak a system
-- prompt. Szándékosan NINCS "GRANT SELECT ON ALL TABLES" vagy
-- "ALTER DEFAULT PRIVILEGES ... ON TABLES" - lásd docker/postgres/initdb/
-- 01-readonly-role.sql. A DO-blokk véd az ellen az eset ellen, ha valaki a
-- smartbasket_ro szerep nélkül futtatja a migrációt (pl. nem docker-es,
-- kézzel indított Postgres).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartbasket_ro') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO smartbasket_ro';
    EXECUTE 'GRANT SELECT ON vw_products, vw_categories, vw_best_prices, vw_import_status TO smartbasket_ro';
  ELSE
    RAISE NOTICE 'smartbasket_ro szerep nem létezik - read-only grant kihagyva.';
  END IF;
END
$$;
