import { randomUUID } from 'node:crypto';
import pg from 'pg';
import './pg-type-parsers.js';

const { Client } = pg;

const ADMIN_DATABASE_URL =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgresql://smartbasket:smartbasket@localhost:5432/smartbasket';

export interface TestDatabase {
  databaseUrl: string;
  databaseUrlReadonly: string;
  drop(): Promise<void>;
}

function withDatabaseName(url: string, dbName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

// Minden tesztfájl saját, egyedi nevű Postgres adatbázist kap - a korábbi
// mkdtempSync-es SQLite-fájl-izoláció Postgres-megfelelője
// (docs/db-migration-rationale.md). Előfeltétel: `docker compose up -d`
// fut lokálisan, mielőtt a tesztsuite elindul.
export async function createTestDatabase(): Promise<TestDatabase> {
  const dbName = `smartbasket_test_${randomUUID().replace(/-/g, '')}`;

  const admin = new Client({ connectionString: ADMIN_DATABASE_URL });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${dbName}"`);
    // A smartbasket_ro szerep globális, de a CONNECT jog adatbázisonként
    // külön - az elsődleges "smartbasket" DB-re szóló grantot (initdb
    // script) ki kell terjeszteni minden egyedi teszt-DB-re is.
    await admin.query(`GRANT CONNECT ON DATABASE "${dbName}" TO smartbasket_ro`);
  } finally {
    await admin.end();
  }

  const databaseUrl = withDatabaseName(ADMIN_DATABASE_URL, dbName);
  const roUrl = new URL(databaseUrl);
  roUrl.username = 'smartbasket_ro';
  roUrl.password = 'smartbasket_ro';

  return {
    databaseUrl,
    databaseUrlReadonly: roUrl.toString(),
    async drop() {
      const dropAdmin = new Client({ connectionString: ADMIN_DATABASE_URL });
      await dropAdmin.connect();
      try {
        await dropAdmin.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [dbName],
        );
        await dropAdmin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      } finally {
        await dropAdmin.end();
      }
    },
  };
}
