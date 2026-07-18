import { createHash } from 'node:crypto';
import { openReadWriteConnection } from '../database/connection.js';
import { parseGvhExcelBuffer } from '../parser/parse-gvh-excel.js';
import { downloadDailyExcel } from './download-daily-excel.js';
import { writeProductSnapshot } from './write-product-snapshot.js';

export interface ImportDailyDatasetOptions {
  databaseUrl: string;
  sourceUrl: string;
}

export interface ImportResult {
  importDate: string;
  importedRows: number;
  checksum: string;
}

// A teljes import folyamat (architektura.md 10. pont): letöltés -> validáció
// (Excel parse+Zod a parser modulban) -> tranzakciós snapshot-csere. Hiba
// esetén a hívó kapja meg a kivételt - nincs elnyelt hiba (konvenciok.md 9.).
export async function importDailyDataset(
  options: ImportDailyDatasetOptions,
): Promise<ImportResult> {
  const { buffer, downloadedAt } = await downloadDailyExcel(options.sourceUrl);
  const checksum = createHash('sha256').update(buffer).digest('hex');
  const { importDate, rows } = parseGvhExcelBuffer(buffer);

  const db = await openReadWriteConnection(options.databaseUrl);
  try {
    await writeProductSnapshot(db, rows, {
      importDate,
      sourceUrl: options.sourceUrl,
      downloadedAt,
      checksum,
    });
  } finally {
    await db.end();
  }

  return { importDate, importedRows: rows.length, checksum };
}
