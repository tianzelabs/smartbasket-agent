import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openReadWriteConnection } from '../../database/connection.js';
import { runMigrations } from '../../database/migrate.js';
import { listCategories } from './list-categories-tool.js';

describe('listCategories', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'smartbasket-list-categories-'));
    dbPath = join(dir, 'test.db');
    runMigrations(dbPath);

    const db = openReadWriteConnection(dbPath);
    const insert = db.prepare(`
      INSERT INTO products (product_identifier, product_name, category_name, retailer_name, minimum_price, maximum_price)
      VALUES (@product_identifier, @product_name, @category_name, @retailer_name, @minimum_price, @maximum_price)
    `);
    insert.run({
      product_identifier: 'p1',
      product_name: 'Sárgarépa',
      category_name: 'Zöldség',
      retailer_name: 'Tesco',
      minimum_price: 499,
      maximum_price: 499,
    });
    insert.run({
      product_identifier: 'p2',
      product_name: 'Dove testápoló',
      category_name: 'Testápolás',
      retailer_name: 'Lidl',
      minimum_price: 990,
      maximum_price: 990,
    });
    insert.run({
      product_identifier: 'p3',
      product_name: 'Karfiol',
      category_name: 'Zöldség',
      retailer_name: 'Lidl',
      minimum_price: 649,
      maximum_price: 649,
    });
    db.close();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns the distinct set of categories, alphabetically', () => {
    const result = listCategories(dbPath);

    expect(result.categories).toEqual(['Testápolás', 'Zöldség']);
  });
});
