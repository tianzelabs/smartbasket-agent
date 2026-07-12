import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

export type SmartBasketDatabase = InstanceType<typeof Database>;

// Read-write kapcsolat: kizárólag a migráció és az importer használja
// (architektura.md 9. pont, konvenciok.md 7. pont). Az agent runSql toolja
// egy külön, read-only kapcsolaton fut.
export function openReadWriteConnection(dbPath: string): SmartBasketDatabase {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
