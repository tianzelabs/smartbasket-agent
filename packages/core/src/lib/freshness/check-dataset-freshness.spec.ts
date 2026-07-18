import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openReadWriteConnection } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../database/test-database.js';
import { checkDatasetFreshness } from './check-dataset-freshness.js';

describe('checkDatasetFreshness', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
  });

  afterEach(async () => {
    await testDb.drop();
  });

  it('is false when there is no import_metadata row for today', async () => {
    await runMigrations(testDb.databaseUrl);
    expect(
      await checkDatasetFreshness(testDb.databaseUrlReadonly, '2026-07-12'),
    ).toBe(false);
  });

  it('is true when a successful import exists for today', async () => {
    await runMigrations(testDb.databaseUrl);
    const db = await openReadWriteConnection(testDb.databaseUrl);
    await db.query(
      `INSERT INTO import_metadata (import_date, source_url, downloaded_at, imported_at, imported_rows, checksum, status)
       VALUES ('2026-07-12', 'https://example.test', '2026-07-12T05:00:00Z', '2026-07-12T05:01:00Z', 100, 'abc', 'success')`,
    );
    await db.end();

    expect(
      await checkDatasetFreshness(testDb.databaseUrlReadonly, '2026-07-12'),
    ).toBe(true);
  });

  it("is false when today's import failed", async () => {
    await runMigrations(testDb.databaseUrl);
    const db = await openReadWriteConnection(testDb.databaseUrl);
    await db.query(
      `INSERT INTO import_metadata (import_date, source_url, downloaded_at, imported_at, imported_rows, checksum, status)
       VALUES ('2026-07-12', 'https://example.test', '2026-07-12T05:00:00Z', '2026-07-12T05:01:00Z', 0, 'abc', 'failed')`,
    );
    await db.end();

    expect(
      await checkDatasetFreshness(testDb.databaseUrlReadonly, '2026-07-12'),
    ).toBe(false);
  });

  it('is false when the successful import is from a previous day', async () => {
    await runMigrations(testDb.databaseUrl);
    const db = await openReadWriteConnection(testDb.databaseUrl);
    await db.query(
      `INSERT INTO import_metadata (import_date, source_url, downloaded_at, imported_at, imported_rows, checksum, status)
       VALUES ('2026-07-11', 'https://example.test', '2026-07-11T05:00:00Z', '2026-07-11T05:01:00Z', 100, 'abc', 'success')`,
    );
    await db.end();

    expect(
      await checkDatasetFreshness(testDb.databaseUrlReadonly, '2026-07-12'),
    ).toBe(false);
  });
});
