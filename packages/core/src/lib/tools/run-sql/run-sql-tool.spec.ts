import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openReadWriteConnection } from '../../database/connection.js';
import { runMigrations } from '../../database/migrate.js';
import { UnsafeSqlError } from './sql-guard.js';
import { runSql } from './run-sql-tool.js';

describe('runSql', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'smartbasket-run-sql-'));
    dbPath = join(dir, 'test.db');
    runMigrations(dbPath);

    const db = openReadWriteConnection(dbPath);
    const insert = db.prepare(`
      INSERT INTO products (product_identifier, product_name, category_name, retailer_name, minimum_price, maximum_price)
      VALUES (@product_identifier, @product_name, @category_name, @retailer_name, @minimum_price, @maximum_price)
    `);
    insert.run({
      product_identifier: 'p1',
      product_name: 'Dove testápoló',
      category_name: 'Testápolás',
      retailer_name: 'Tesco',
      minimum_price: 1200,
      maximum_price: 1200,
    });
    insert.run({
      product_identifier: 'p1',
      product_name: 'Dove testápoló',
      category_name: 'Testápolás',
      retailer_name: 'Lidl',
      minimum_price: 990,
      maximum_price: 990,
    });
    db.close();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('runs a SELECT against a semantic view and returns real rows', () => {
    const result = runSql(
      dbPath,
      "SELECT retailer, price FROM vw_best_prices WHERE id = 'p1'",
    );

    expect(result.rowCount).toBe(1);
    expect(result.rows).toEqual([{ retailer: 'Lidl', price: 990 }]);
    expect(result.truncated).toBe(false);
  });

  it('rejects a mutating query before it ever touches the connection', () => {
    expect(() =>
      runSql(dbPath, "DELETE FROM products WHERE id = 'p1'"),
    ).toThrow(UnsafeSqlError);

    const db = openReadWriteConnection(dbPath);
    const count = (
      db.prepare('SELECT COUNT(*) AS count FROM products').get() as {
        count: number;
      }
    ).count;
    db.close();
    expect(count).toBe(2);
  });

  it('rejects a mutating query even if the connection itself were somehow reached (defense in depth)', () => {
    // A read-only kapcsolat is elutasítaná, de a guard-nak korábban kell hibáznia.
    expect(() => runSql(dbPath, 'PRAGMA table_info(products)')).toThrow(
      UnsafeSqlError,
    );
  });
});
