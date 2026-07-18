import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openReadWriteConnection } from './connection.js';
import { runMigrations } from './migrate.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

interface NameRow {
  table_name: string;
}

describe('runMigrations', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
  });

  afterEach(async () => {
    await testDb.drop();
  });

  it('creates the products and import_metadata tables', async () => {
    await runMigrations(testDb.databaseUrl);

    const db = await openReadWriteConnection(testDb.databaseUrl);
    const { rows } = await db.query<NameRow>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
    );
    await db.end();

    expect(rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(['products', 'import_metadata']),
    );
  });

  it('creates the semantic views the agent is allowed to query', async () => {
    await runMigrations(testDb.databaseUrl);

    const db = await openReadWriteConnection(testDb.databaseUrl);
    const { rows } = await db.query<NameRow>(
      "SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name",
    );
    await db.end();

    expect(rows.map((row) => row.table_name)).toEqual([
      'vw_best_prices',
      'vw_categories',
      'vw_import_status',
      'vw_products',
    ]);
  });

  it('is idempotent - running twice applies each migration only once', async () => {
    await runMigrations(testDb.databaseUrl);
    await expect(runMigrations(testDb.databaseUrl)).resolves.not.toThrow();

    const db = await openReadWriteConnection(testDb.databaseUrl);
    const { rows } = await db.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM schema_migrations',
    );
    await db.end();

    expect(rows[0].count).toBe(1);
  });

  it('vw_best_prices picks the single cheapest retailer per product', async () => {
    await runMigrations(testDb.databaseUrl);
    const db = await openReadWriteConnection(testDb.databaseUrl);
    await db.query(
      `INSERT INTO products (product_identifier, product_name, category_name, retailer_name, minimum_price, maximum_price)
       VALUES ($1, $2, $3, $4, $5, $6), ($1, $2, $3, $7, $8, $9)`,
      [
        'p1',
        'Dove testápoló',
        'Testápolás',
        'Tesco',
        1200,
        1200,
        'Lidl',
        990,
        990,
      ],
    );

    const { rows } = await db.query(
      'SELECT retailer, price FROM vw_best_prices WHERE id = $1',
      ['p1'],
    );
    await db.end();

    expect(rows[0]).toEqual({ retailer: 'Lidl', price: 990 });
  });
});
