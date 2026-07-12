-- products: napi GVH Árfigyelő snapshot (stack.md 8. pont).
-- A tábla minden import során teljesen lecserélődik (importer.ts), nincs történeti adat.
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_identifier TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category_identifier INTEGER,
  category_name TEXT NOT NULL,
  retailer_name TEXT NOT NULL,
  unit TEXT,
  package_size REAL,
  minimum_price REAL NOT NULL,
  maximum_price REAL NOT NULL,
  minimum_unit_price REAL,
  maximum_unit_price REAL,
  retailer_count INTEGER,
  available_store_count INTEGER,
  retailer_total_store_count INTEGER,
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_identifier_retailer ON products (product_identifier, retailer_name);
CREATE INDEX idx_products_category_name ON products (category_name);
CREATE INDEX idx_products_retailer_name ON products (retailer_name);
CREATE INDEX idx_products_product_name ON products (product_name);

-- import_metadata: a napi import állapotának nyilvántartása (stack.md 8. pont).
CREATE TABLE import_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_date DATE NOT NULL,
  source_url TEXT NOT NULL,
  downloaded_at DATETIME NOT NULL,
  imported_at DATETIME NOT NULL,
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
)
WHERE rn = 1;
