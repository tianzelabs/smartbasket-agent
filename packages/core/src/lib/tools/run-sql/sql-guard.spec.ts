import { describe, expect, it } from 'vitest';
import { assertSafeSelect, UnsafeSqlError } from './sql-guard.js';

describe('assertSafeSelect', () => {
  it('allows a plain SELECT', () => {
    expect(() =>
      assertSafeSelect('SELECT * FROM vw_products LIMIT 10'),
    ).not.toThrow();
  });

  it('allows a WITH ... SELECT', () => {
    expect(() =>
      assertSafeSelect(
        'WITH cheap AS (SELECT * FROM vw_best_prices) SELECT * FROM cheap LIMIT 5',
      ),
    ).not.toThrow();
  });

  it('allows a single trailing semicolon', () => {
    expect(() =>
      assertSafeSelect('SELECT * FROM vw_categories;'),
    ).not.toThrow();
  });

  it('rejects an empty query', () => {
    expect(() => assertSafeSelect('   ')).toThrow(UnsafeSqlError);
  });

  it('rejects a query that does not start with SELECT/WITH', () => {
    expect(() => assertSafeSelect('EXPLAIN SELECT * FROM vw_products')).toThrow(
      UnsafeSqlError,
    );
  });

  it.each([
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'ALTER',
    'CREATE',
    'ATTACH',
    'PRAGMA',
  ])('rejects a query containing %s', (keyword) => {
    expect(() =>
      assertSafeSelect(`SELECT * FROM vw_products; ${keyword} products`),
    ).toThrow(UnsafeSqlError);
  });

  it('rejects a mutating query smuggled after the FROM clause', () => {
    expect(() => assertSafeSelect('DELETE FROM products WHERE 1=1')).toThrow(
      UnsafeSqlError,
    );
  });

  it('rejects multiple statements separated by a semicolon', () => {
    expect(() => assertSafeSelect('SELECT 1; SELECT 2')).toThrow(
      UnsafeSqlError,
    );
  });

  it('does not false-positive on column names containing forbidden substrings', () => {
    expect(() =>
      assertSafeSelect('SELECT created_at FROM vw_products LIMIT 1'),
    ).not.toThrow();
  });
});
