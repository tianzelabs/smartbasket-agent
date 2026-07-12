import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

interface NameRow {
  name: string;
}

describe('runMigrations', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'smartbasket-db-'));
    dbPath = join(dir, 'test.db');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the products and import_metadata tables', () => {
    runMigrations(dbPath);

    const db = new Database(dbPath, { readonly: true });
    const tables = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        )
        .all() as NameRow[]
    ).map((row) => row.name);
    db.close();

    expect(tables).toEqual(
      expect.arrayContaining(['products', 'import_metadata']),
    );
  });

  it('creates the semantic views the agent is allowed to query', () => {
    runMigrations(dbPath);

    const db = new Database(dbPath, { readonly: true });
    const views = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name",
        )
        .all() as NameRow[]
    ).map((row) => row.name);
    db.close();

    expect(views).toEqual(['vw_best_prices', 'vw_categories', 'vw_products']);
  });

  it('is idempotent - running twice applies each migration only once', () => {
    runMigrations(dbPath);
    expect(() => runMigrations(dbPath)).not.toThrow();

    const db = new Database(dbPath, { readonly: true });
    const { count } = db
      .prepare('SELECT COUNT(*) AS count FROM schema_migrations')
      .get() as {
      count: number;
    };
    db.close();

    expect(count).toBe(1);
  });

  it('vw_best_prices picks the single cheapest retailer per product', () => {
    runMigrations(dbPath);
    const db = new Database(dbPath);
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

    const cheapest = db
      .prepare('SELECT retailer, price FROM vw_best_prices WHERE id = ?')
      .get('p1') as {
      retailer: string;
      price: number;
    };
    db.close();

    expect(cheapest).toEqual({ retailer: 'Lidl', price: 990 });
  });
});
