import pg from 'pg';
import './pg-type-parsers.js';

const { Client } = pg;
const STATEMENT_TIMEOUT_MS = 5000;

export type SmartBasketDatabase = pg.Client;

// Read-write kapcsolat: kizárólag a migráció és az importer használja
// (architektura.md 9. pont, konvenciok.md 7. pont). Az agent runSql toolja
// egy külön, read-only kapcsolaton fut, a smartbasket_ro Postgres-
// szerepkörön (tools/run-sql/db-readonly.ts, docs/db-migration-rationale.md).
export async function openReadWriteConnection(
  databaseUrl: string,
): Promise<SmartBasketDatabase> {
  const client = new Client({
    connectionString: databaseUrl,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    application_name: 'smartbasket-rw',
  });
  await client.connect();
  return client;
}
