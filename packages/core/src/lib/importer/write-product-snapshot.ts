import type { SmartBasketDatabase } from '../database/connection.js';
import type { GvhProductRow } from '../parser/gvh-product-row.js';

export interface ImportMetadata {
  importDate: string;
  sourceUrl: string;
  downloadedAt: string;
  checksum: string;
}

const insertProductSql = `
  INSERT INTO products (
    product_identifier, product_name, category_identifier, category_name,
    retailer_name, unit, package_size, minimum_price, maximum_price,
    minimum_unit_price, maximum_unit_price, retailer_count,
    available_store_count, retailer_total_store_count
  ) VALUES (
    @productIdentifier, @productName, @categoryIdentifier, @categoryName,
    @retailerName, @unit, @packageSize, @minimumPrice, @maximumPrice,
    @minimumUnitPrice, @maximumUnitPrice, @retailerCount,
    @availableStoreCount, @retailerTotalStoreCount
  )
`;

const insertMetadataSql = `
  INSERT INTO import_metadata (
    import_date, source_url, downloaded_at, imported_at, imported_rows, checksum, status
  ) VALUES (
    @importDate, @sourceUrl, @downloadedAt, @importedAt, @importedRows, @checksum, @status
  )
`;

// A teljes napi snapshot cseréje EGY tranzakcióban (architektura.md 10. pont,
// konvenciok.md 8. pont): régi termékek törlése, új sorok beszúrása, majd az
// import_metadata bejegyzés - ha bármelyik lépés hibázik, a better-sqlite3
// transaction() automatikusan rollback-el, a DB az előző állapotban marad.
export function writeProductSnapshot(
  db: SmartBasketDatabase,
  rows: GvhProductRow[],
  metadata: ImportMetadata,
): void {
  const insertProduct = db.prepare(insertProductSql);
  const insertMetadata = db.prepare(insertMetadataSql);

  const applySnapshot = db.transaction(() => {
    db.exec('DELETE FROM products');
    for (const row of rows) {
      insertProduct.run(row);
    }
    insertMetadata.run({
      importDate: metadata.importDate,
      sourceUrl: metadata.sourceUrl,
      downloadedAt: metadata.downloadedAt,
      importedAt: new Date().toISOString(),
      importedRows: rows.length,
      checksum: metadata.checksum,
      status: 'success',
    });
  });

  applySnapshot();
}
