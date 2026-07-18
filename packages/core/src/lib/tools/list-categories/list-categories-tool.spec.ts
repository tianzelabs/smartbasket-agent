import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openReadWriteConnection } from '../../database/connection.js';
import { runMigrations } from '../../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../../database/test-database.js';
import { listCategories } from './list-categories-tool.js';

describe('listCategories', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    await runMigrations(testDb.databaseUrl);

    const db = await openReadWriteConnection(testDb.databaseUrl);
    await db.query(
      `INSERT INTO products (product_identifier, product_name, category_name, retailer_name, minimum_price, maximum_price)
       VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12), ($13, $14, $15, $16, $17, $18)`,
      [
        'p1',
        'Sárgarépa',
        'Zöldség',
        'Tesco',
        499,
        499,
        'p2',
        'Dove testápoló',
        'Testápolás',
        'Lidl',
        990,
        990,
        'p3',
        'Karfiol',
        'Zöldség',
        'Lidl',
        649,
        649,
      ],
    );
    await db.end();
  });

  afterEach(async () => {
    await testDb.drop();
  });

  it('returns the distinct set of categories, alphabetically', async () => {
    const result = await listCategories(testDb.databaseUrlReadonly);

    expect(result.categories).toEqual(['Testápolás', 'Zöldség']);
  });
});
