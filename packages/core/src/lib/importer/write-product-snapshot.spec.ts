import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  openReadWriteConnection,
  type SmartBasketDatabase,
} from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import type { GvhProductRow } from '../parser/gvh-product-row.js';
import { writeProductSnapshot } from './write-product-snapshot.js';

const carrot: GvhProductRow = {
  productIdentifier: '0000000022989',
  productName: 'Sárgarépa',
  categoryIdentifier: 36,
  categoryName: 'Zöldség',
  retailerName: 'Tesco',
  unit: 'db',
  packageSize: 1,
  minimumPrice: 499,
  maximumPrice: 499,
  minimumUnitPrice: 499,
  maximumUnitPrice: 499,
  retailerCount: 1,
  availableStoreCount: 99,
  retailerTotalStoreCount: 197,
};

const cauliflower: GvhProductRow = {
  ...carrot,
  productIdentifier: '0000000023023',
  productName: 'Karfiol',
  retailerName: 'Lidl',
  minimumPrice: 649,
  maximumPrice: 649,
};

describe('writeProductSnapshot', () => {
  let dir: string;
  let dbPath: string;
  let db: SmartBasketDatabase;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'smartbasket-snapshot-'));
    dbPath = join(dir, 'test.db');
    runMigrations(dbPath);
    db = openReadWriteConnection(dbPath);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('inserts the rows and an import_metadata row', () => {
    writeProductSnapshot(db, [carrot, cauliflower], {
      importDate: '2026-07-12',
      sourceUrl: 'https://example.test/daily.xlsx',
      downloadedAt: '2026-07-12T05:00:00.000Z',
      checksum: 'abc123',
    });

    const productCount = (
      db.prepare('SELECT COUNT(*) AS count FROM products').get() as {
        count: number;
      }
    ).count;
    expect(productCount).toBe(2);

    const metadata = db
      .prepare('SELECT * FROM import_metadata')
      .get() as Record<string, unknown>;
    expect(metadata).toMatchObject({
      import_date: '2026-07-12',
      source_url: 'https://example.test/daily.xlsx',
      imported_rows: 2,
      checksum: 'abc123',
      status: 'success',
    });
  });

  it('fully replaces the previous snapshot, not appends to it', () => {
    writeProductSnapshot(db, [carrot], {
      importDate: '2026-07-11',
      sourceUrl: 'https://example.test/daily.xlsx',
      downloadedAt: '2026-07-11T05:00:00.000Z',
      checksum: 'day1',
    });

    writeProductSnapshot(db, [cauliflower], {
      importDate: '2026-07-12',
      sourceUrl: 'https://example.test/daily.xlsx',
      downloadedAt: '2026-07-12T05:00:00.000Z',
      checksum: 'day2',
    });

    const products = db.prepare('SELECT product_name FROM products').all() as {
      product_name: string;
    }[];
    expect(products.map((row) => row.product_name)).toEqual(['Karfiol']);

    const metadataCount = (
      db.prepare('SELECT COUNT(*) AS count FROM import_metadata').get() as {
        count: number;
      }
    ).count;
    expect(metadataCount).toBe(2);
  });

  it('rolls back the whole snapshot if a row is invalid', () => {
    const invalidRow = {
      ...cauliflower,
      categoryName: null,
    } as unknown as GvhProductRow;

    writeProductSnapshot(db, [carrot], {
      importDate: '2026-07-11',
      sourceUrl: 'https://example.test/daily.xlsx',
      downloadedAt: '2026-07-11T05:00:00.000Z',
      checksum: 'day1',
    });

    expect(() =>
      writeProductSnapshot(db, [invalidRow], {
        importDate: '2026-07-12',
        sourceUrl: 'https://example.test/daily.xlsx',
        downloadedAt: '2026-07-12T05:00:00.000Z',
        checksum: 'day2',
      }),
    ).toThrow();

    const products = db.prepare('SELECT product_name FROM products').all() as {
      product_name: string;
    }[];
    expect(products.map((row) => row.product_name)).toEqual(['Sárgarépa']);
    const metadataCount = (
      db.prepare('SELECT COUNT(*) AS count FROM import_metadata').get() as {
        count: number;
      }
    ).count;
    expect(metadataCount).toBe(1);
  });
});
