import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openReadWriteConnection } from '../../database/connection.js';
import { runMigrations } from '../../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../../database/test-database.js';
import { runReadOnlyQuery } from './db-readonly.js';

// Ez a spec KÖZVETLENÜL a smartbasket_ro Postgres-szerepkört teszteli, a
// sql-guard.ts megkerülésével - bizonyíték arra, hogy a tanári visszajelzésre
// (docs/db-migration-rationale.md) válaszul bevezetett DB-szerepkör
// valóban egy második, a klienskódtól teljesen független védelmi réteg,
// nem csak egy második, ugyanúgy hibázható alkalmazáskód-ellenőrzés.
describe('runReadOnlyQuery - a smartbasket_ro szerepkör önmagában', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    await runMigrations(testDb.databaseUrl);
    const db = await openReadWriteConnection(testDb.databaseUrl);
    await db.query(
      `INSERT INTO products (product_identifier, product_name, category_name, retailer_name, minimum_price, maximum_price)
       VALUES ('p1', 'Dove testápoló', 'Testápolás', 'Lidl', 990, 990)`,
    );
    await db.end();
  });

  afterEach(async () => {
    await testDb.drop();
  });

  it('reads from a semantic view (guard megkerülve, csak a szerepkör véd)', async () => {
    const { rows } = await runReadOnlyQuery(
      'SELECT retailer, price FROM vw_best_prices',
      testDb.databaseUrlReadonly,
    );
    expect(rows).toEqual([{ retailer: 'Lidl', price: 990 }]);
  });

  it('a DB-szerver maga utasítja el az INSERT-et - a guard megkerülésével sem lehet írni', async () => {
    // A READ ONLY tranzakció (3. réteg) és a smartbasket_ro szerepkör hiányzó
    // INSERT-joga (1. réteg) egymástól függetlenül is elutasítaná - melyik
    // hibázik előbb, az implementációs részlet (itt: a tranzakció-szintű
    // ellenőrzés fut le korábban).
    await expect(
      runReadOnlyQuery(
        "INSERT INTO products (product_identifier, product_name, category_name, retailer_name, minimum_price, maximum_price) VALUES ('x','x','x','x',1,1)",
        testDb.databaseUrlReadonly,
      ),
    ).rejects.toThrow(/permission denied|read-only transaction/i);
  });

  it('a DB-szerver a nyers products táblát sem engedi, csak a vw_ view-ket', async () => {
    await expect(
      runReadOnlyQuery('SELECT * FROM products', testDb.databaseUrlReadonly),
    ).rejects.toThrow(/permission denied/i);
  });
});
