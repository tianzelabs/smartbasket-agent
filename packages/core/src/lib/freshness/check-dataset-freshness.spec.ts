import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openReadWriteConnection } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import { checkDatasetFreshness } from './check-dataset-freshness.js';

describe('checkDatasetFreshness', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'smartbasket-freshness-'));
    dbPath = join(dir, 'test.db');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('is false when the database file does not exist yet', () => {
    expect(checkDatasetFreshness(dbPath, '2026-07-12')).toBe(false);
  });

  it('is false when there is no import_metadata row for today', () => {
    runMigrations(dbPath);
    expect(checkDatasetFreshness(dbPath, '2026-07-12')).toBe(false);
  });

  it('is true when a successful import exists for today', () => {
    runMigrations(dbPath);
    const db = openReadWriteConnection(dbPath);
    db.prepare(
      `INSERT INTO import_metadata (import_date, source_url, downloaded_at, imported_at, imported_rows, checksum, status)
       VALUES ('2026-07-12', 'https://example.test', '2026-07-12T05:00:00Z', '2026-07-12T05:01:00Z', 100, 'abc', 'success')`,
    ).run();
    db.close();

    expect(checkDatasetFreshness(dbPath, '2026-07-12')).toBe(true);
  });

  it("is false when today's import failed", () => {
    runMigrations(dbPath);
    const db = openReadWriteConnection(dbPath);
    db.prepare(
      `INSERT INTO import_metadata (import_date, source_url, downloaded_at, imported_at, imported_rows, checksum, status)
       VALUES ('2026-07-12', 'https://example.test', '2026-07-12T05:00:00Z', '2026-07-12T05:01:00Z', 0, 'abc', 'failed')`,
    ).run();
    db.close();

    expect(checkDatasetFreshness(dbPath, '2026-07-12')).toBe(false);
  });

  it('is false when the successful import is from a previous day', () => {
    runMigrations(dbPath);
    const db = openReadWriteConnection(dbPath);
    db.prepare(
      `INSERT INTO import_metadata (import_date, source_url, downloaded_at, imported_at, imported_rows, checksum, status)
       VALUES ('2026-07-11', 'https://example.test', '2026-07-11T05:00:00Z', '2026-07-11T05:01:00Z', 100, 'abc', 'success')`,
    ).run();
    db.close();

    expect(checkDatasetFreshness(dbPath, '2026-07-12')).toBe(false);
  });
});
