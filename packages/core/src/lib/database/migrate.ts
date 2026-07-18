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

// Kis, kézzel írt migrációs futtató (nincs ORM/migráció-framework -
// konvenciok.md 6. pont). Sima .sql fájlokat alkalmaz névsorrendben,
// egyenként tranzakcióban, és feljegyzi a schema_migrations táblába, hogy
// másodszorra ne fusson újra.
export async function runMigrations(databaseUrl: string): Promise<void> {
  const db = await openReadWriteConnection(databaseUrl);

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const { rows } = await db.query<AppliedMigrationRow>(
      'SELECT name FROM schema_migrations',
    );
    const applied = new Set(rows.map((row) => row.name));

    const migrationFiles = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      if (applied.has(file)) {
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

      await db.query('BEGIN');
      try {
        await db.query(sql);
        await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
          file,
        ]);
        await db.query('COMMIT');
      } catch (error) {
        await db.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    }
  } finally {
    await db.end();
  }
}
