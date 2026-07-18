import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openReadWriteConnection } from '../../database/connection.js';
import { runMigrations } from '../../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../../database/test-database.js';
import { UnsafeSqlError } from './sql-guard.js';
import { runSql } from './run-sql-tool.js';

describe('runSql', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
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
    await db.end();
  });

  afterEach(async () => {
    await testDb.drop();
  });

  it('runs a SELECT against a semantic view and returns real rows', async () => {
    const result = await runSql(
      testDb.databaseUrlReadonly,
      "SELECT retailer, price FROM vw_best_prices WHERE id = 'p1'",
    );

    expect(result.rowCount).toBe(1);
    expect(result.rows).toEqual([{ retailer: 'Lidl', price: 990 }]);
    expect(result.truncated).toBe(false);
  });

  it('rejects a mutating query before it ever touches the connection', async () => {
    await expect(
      runSql(testDb.databaseUrlReadonly, "DELETE FROM products WHERE id = 'p1'"),
    ).rejects.toThrow(UnsafeSqlError);

    const db = await openReadWriteConnection(testDb.databaseUrl);
    const count = (
      await db.query<{ count: number }>(
        'SELECT COUNT(*) AS count FROM products',
      )
    ).rows[0].count;
    await db.end();
    expect(count).toBe(2);
  });

  it('rejects a raw table SELECT even though the guard would allow it (defense in depth)', async () => {
    // A guard csak a statement ALAKJÁT vizsgálja (SELECT, egy statement) -
    // a "sose a nyers products táblát" szabályt a smartbasket_ro szerepkör
    // DB-szerver szintű jogosultsága kényszeríti ki (docs/db-migration-rationale.md),
    // nem a guard.
    await expect(
      runSql(testDb.databaseUrlReadonly, 'SELECT * FROM products'),
    ).rejects.toThrow(/permission denied/i);
  });

  it('rejects a mutating query even if the connection itself were somehow reached (defense in depth)', async () => {
    // A guard-nak korábban kell hibáznia, de ha valahogy megkerülnék, a
    // smartbasket_ro szerepkörnek DB-szinten sincs írási joga - lásd
    // db-readonly.spec.ts a közvetlen bizonyítékért.
    await expect(
      runSql(testDb.databaseUrlReadonly, 'PRAGMA table_info(products)'),
    ).rejects.toThrow(UnsafeSqlError);
  });
});
