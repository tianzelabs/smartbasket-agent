import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  openReadWriteConnection,
  type SmartBasketDatabase,
} from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../database/test-database.js';
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
  let testDb: TestDatabase;
  let db: SmartBasketDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    await runMigrations(testDb.databaseUrl);
    db = await openReadWriteConnection(testDb.databaseUrl);
  });

  afterEach(async () => {
    await db.end();
    await testDb.drop();
  });

  it('inserts the rows and an import_metadata row', async () => {
    await writeProductSnapshot(db, [carrot, cauliflower], {
      importDate: '2026-07-12',
      sourceUrl: 'https://example.test/daily.xlsx',
      downloadedAt: '2026-07-12T05:00:00.000Z',
      checksum: 'abc123',
    });

    const productCount = (
      await db.query<{ count: number }>(
        'SELECT COUNT(*) AS count FROM products',
      )
    ).rows[0].count;
    expect(productCount).toBe(2);

    const metadata = (await db.query('SELECT * FROM import_metadata'))
      .rows[0] as Record<string, unknown>;
    expect(metadata).toMatchObject({
      source_url: 'https://example.test/daily.xlsx',
      imported_rows: 2,
      checksum: 'abc123',
      status: 'success',
    });
  });

  it('fully replaces the previous snapshot, not appends to it', async () => {
    await writeProductSnapshot(db, [carrot], {
      importDate: '2026-07-11',
      sourceUrl: 'https://example.test/daily.xlsx',
      downloadedAt: '2026-07-11T05:00:00.000Z',
      checksum: 'day1',
    });

    await writeProductSnapshot(db, [cauliflower], {
      importDate: '2026-07-12',
      sourceUrl: 'https://example.test/daily.xlsx',
      downloadedAt: '2026-07-12T05:00:00.000Z',
      checksum: 'day2',
    });

    const products = (
      await db.query<{ product_name: string }>(
        'SELECT product_name FROM products',
      )
    ).rows;
    expect(products.map((row) => row.product_name)).toEqual(['Karfiol']);

    const metadataCount = (
      await db.query<{ count: number }>(
        'SELECT COUNT(*) AS count FROM import_metadata',
      )
    ).rows[0].count;
    expect(metadataCount).toBe(2);
  });

  it('rolls back the whole snapshot if a row is invalid', async () => {
    const invalidRow = {
      ...cauliflower,
      categoryName: null,
    } as unknown as GvhProductRow;

    await writeProductSnapshot(db, [carrot], {
      importDate: '2026-07-11',
      sourceUrl: 'https://example.test/daily.xlsx',
      downloadedAt: '2026-07-11T05:00:00.000Z',
      checksum: 'day1',
    });

    await expect(
      writeProductSnapshot(db, [invalidRow], {
        importDate: '2026-07-12',
        sourceUrl: 'https://example.test/daily.xlsx',
        downloadedAt: '2026-07-12T05:00:00.000Z',
        checksum: 'day2',
      }),
    ).rejects.toThrow();

    const products = (
      await db.query<{ product_name: string }>(
        'SELECT product_name FROM products',
      )
    ).rows;
    expect(products.map((row) => row.product_name)).toEqual(['Sárgarépa']);
    const metadataCount = (
      await db.query<{ count: number }>(
        'SELECT COUNT(*) AS count FROM import_metadata',
      )
    ).rows[0].count;
    expect(metadataCount).toBe(1);
  });
});
