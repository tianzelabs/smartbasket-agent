import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { openReadWriteConnection } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import { todayIsoDate } from './local-date.js';
import { ensureFreshDataset } from './ensure-fresh-dataset.js';

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

function buildFixtureExcel(sheetName: string): Buffer {
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
  ]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, sheetName);
  return write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('ensureFreshDataset', () => {
  let server: Server;
  let requestCount: number;
  let sourceUrl: string;
  let dir: string;
  let dbPath: string;

  beforeEach(async () => {
    requestCount = 0;
    const fixture = buildFixtureExcel(`Napi feltöltések - ${todayIsoDate()}`);
    server = createServer((_req, res) => {
      requestCount += 1;
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

    dir = mkdtempSync(join(tmpdir(), 'smartbasket-ensure-fresh-'));
    dbPath = join(dir, 'test.db');
    runMigrations(dbPath);
  });

  afterEach(async () => {
    await new Promise<void>((resolvePromise) =>
      server.close(() => resolvePromise()),
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('imports when there is no data for today yet', async () => {
    await ensureFreshDataset({ dbPath, sourceUrl });

    expect(requestCount).toBe(1);
    const db = openReadWriteConnection(dbPath);
    const productCount = (
      db.prepare('SELECT COUNT(*) AS count FROM products').get() as {
        count: number;
      }
    ).count;
    db.close();
    expect(productCount).toBe(1);
  });

  it('does not re-download when a successful import for today already exists', async () => {
    const db = openReadWriteConnection(dbPath);
    db.prepare(
      `INSERT INTO import_metadata (import_date, source_url, downloaded_at, imported_at, imported_rows, checksum, status)
       VALUES (@importDate, 'https://example.test', '2026-07-12T05:00:00Z', '2026-07-12T05:01:00Z', 100, 'abc', 'success')`,
    ).run({ importDate: todayIsoDate() });
    db.close();

    await ensureFreshDataset({ dbPath, sourceUrl });

    expect(requestCount).toBe(0);
  });
});
