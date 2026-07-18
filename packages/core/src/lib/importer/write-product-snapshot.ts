import type { SmartBasketDatabase } from '../database/connection.js';
import type { GvhProductRow } from '../parser/gvh-product-row.js';

export interface ImportMetadata {
  importDate: string;
  sourceUrl: string;
  downloadedAt: string;
  checksum: string;
}

const PRODUCT_COLUMNS = [
  'product_identifier',
  'product_name',
  'category_identifier',
  'category_name',
  'retailer_name',
  'unit',
  'package_size',
  'minimum_price',
  'maximum_price',
  'minimum_unit_price',
  'maximum_unit_price',
  'retailer_count',
  'available_store_count',
  'retailer_total_store_count',
] as const;

// Postgres paraméterlimitje (65535) miatt kötegelve szúrjuk be a sorokat -
// egyetlen sor-per-INSERT 25000+ terméknél túl sok round-trip lenne.
const BATCH_SIZE = 500;

function toRowValues(row: GvhProductRow): unknown[] {
  return [
    row.productIdentifier,
    row.productName,
    row.categoryIdentifier,
    row.categoryName,
    row.retailerName,
    row.unit,
    row.packageSize,
    row.minimumPrice,
    row.maximumPrice,
    row.minimumUnitPrice,
    row.maximumUnitPrice,
    row.retailerCount,
    row.availableStoreCount,
    row.retailerTotalStoreCount,
  ];
}

async function insertProductBatch(
  db: SmartBasketDatabase,
  batch: GvhProductRow[],
): Promise<void> {
  const values: unknown[] = [];
  const placeholders = batch
    .map((row, rowIndex) => {
      const rowValues = toRowValues(row);
      values.push(...rowValues);
      const base = rowIndex * PRODUCT_COLUMNS.length;
      const placeholderGroup = rowValues
        .map((_, colIndex) => `$${base + colIndex + 1}`)
        .join(', ');
      return `(${placeholderGroup})`;
    })
    .join(', ');

  await db.query(
    `INSERT INTO products (${PRODUCT_COLUMNS.join(', ')}) VALUES ${placeholders}`,
    values,
  );
}

// A teljes napi snapshot cseréje EGY tranzakcióban (architektura.md 10. pont,
// konvenciok.md 8. pont): régi termékek törlése, új sorok kötegelt beszúrása,
// majd az import_metadata bejegyzés - ha bármelyik lépés hibázik, a teljes
// tranzakció rollback-el, a DB az előző állapotban marad.
export async function writeProductSnapshot(
  db: SmartBasketDatabase,
  rows: GvhProductRow[],
  metadata: ImportMetadata,
): Promise<void> {
  await db.query('BEGIN');
  try {
    await db.query('DELETE FROM products');

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await insertProductBatch(db, rows.slice(i, i + BATCH_SIZE));
    }

    await db.query(
      `INSERT INTO import_metadata (
        import_date, source_url, downloaded_at, imported_at, imported_rows, checksum, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        metadata.importDate,
        metadata.sourceUrl,
        metadata.downloadedAt,
        new Date().toISOString(),
        rows.length,
        metadata.checksum,
        'success',
      ],
    );

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
