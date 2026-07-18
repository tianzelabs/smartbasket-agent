import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { openReadWriteConnection } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../database/test-database.js';
import { importDailyDataset } from './import-daily-dataset.js';

const HEADER = [
  'Termék azonosító',
  'Termék név',
  'Kategória azonosító',
  'Kategória név',
  'Üzletlánc név',
  'Egység',
  'Kiszerelés',
  'Minimum ár',
  'Maximum ár',
  'Minimum egységár',
  'Maximum egységár',
  'Hány üzletláncban elérhető',
  'Hány boltban elérhető',
  'Üzletlánc összes boltja',
];

function buildFixtureExcel(): Buffer {
  const sheet = utils.aoa_to_sheet([
    HEADER,
    [
      '0000000022989',
      'Sárgarépa',
      '36',
      'Zöldség',
      'Tesco',
      'db',
      '1',
      '499,0000',
      '499,0000',
      '499,0000',
      '499,0000',
      '1',
      '99',
      '197',
    ],
    [
      '0000000023023',
      'Karfiol',
      '45',
      'Zöldség',
      'Lidl',
      'db',
      '1',
      '649,0000',
      '649,0000',
      '649,0000',
      '649,0000',
      '1',
      '178',
      '197',
    ],
  ]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, 'Napi feltöltések - 2026-07-12');
  return write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('importDailyDataset', () => {
  let server: Server;
  let sourceUrl: string;
  let testDb: TestDatabase;

  beforeEach(async () => {
    const fixture = buildFixtureExcel();
    server = createServer((_req, res) => {
      res
        .writeHead(200, { 'content-type': 'application/octet-stream' })
        .end(fixture);
    });
    await new Promise<void>((resolvePromise) =>
      server.listen(0, resolvePromise),
    );
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('nem sikerült elindítani a teszt-szervert');
    }
    sourceUrl = `http://127.0.0.1:${address.port}/daily.xlsx`;

    testDb = await createTestDatabase();
    await runMigrations(testDb.databaseUrl);
  });

  afterEach(async () => {
    await new Promise<void>((resolvePromise) =>
      server.close(() => resolvePromise()),
    );
    await testDb.drop();
  });

  it('downloads, parses and writes the snapshot in one call', async () => {
    const result = await importDailyDataset({
      databaseUrl: testDb.databaseUrl,
      sourceUrl,
    });

    expect(result).toMatchObject({ importDate: '2026-07-12', importedRows: 2 });
    expect(result.checksum).toMatch(/^[0-9a-f]{64}$/);

    const db = await openReadWriteConnection(testDb.databaseUrl);
    const productCount = (
      await db.query<{ count: number }>(
        'SELECT COUNT(*) AS count FROM products',
      )
    ).rows[0].count;
    const metadataRow = (await db.query('SELECT * FROM import_metadata'))
      .rows[0] as Record<string, unknown>;
    await db.end();

    expect(productCount).toBe(2);
    expect(metadataRow).toMatchObject({
      import_date: '2026-07-12',
      source_url: sourceUrl,
      imported_rows: 2,
      status: 'success',
    });
  });
});
