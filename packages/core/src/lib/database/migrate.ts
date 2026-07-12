import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openReadWriteConnection } from './connection.js';

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

interface AppliedMigrationRow {
  name: string;
}

// Kis, kézzel írt migrációs futtató (nincs ORM/migráció-framework - konvenciok.md
// 6. pont). Sima .sql fájlokat alkalmaz névsorrendben, egyenként tranzakcióban,
// és feljegyzi a schema_migrations táblába, hogy másodszorra ne fusson újra.
export function runMigrations(dbPath: string): void {
  const db = openReadWriteConnection(dbPath);

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const applied = new Set(
      (
        db
          .prepare('SELECT name FROM schema_migrations')
          .all() as AppliedMigrationRow[]
      ).map((row) => row.name),
    );

    const migrationFiles = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      if (applied.has(file)) {
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      const applyMigration = db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
      });
      applyMigration();
    }
  } finally {
    db.close();
  }
}
