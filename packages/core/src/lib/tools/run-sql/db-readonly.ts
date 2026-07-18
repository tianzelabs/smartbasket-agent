import pg from 'pg';
import '../../database/pg-type-parsers.js';
import { loadDatabaseConfig } from '../../database/database-config.js';

const { Client } = pg;
const STATEMENT_TIMEOUT_MS = 5000;

export interface ReadOnlyQueryResult {
  rows: Record<string, unknown>[];
}

// Harmadik és negyedik védelmi réteg a sql-guard.ts (1.) és a smartbasket_ro
// Postgres-szerepkör (2.) mellett (docs/db-migration-rationale.md):
// 3) minden lekérdezés egy explicit READ ONLY tranzakcióban fut,
// 4) statement_timeout korlátozza az elszabadult/túl összetett lekérdezéseket.
// A runSql, a listCategories és a checkDatasetFreshness mind ezen keresztül
// olvas - egyikük sem éri el közvetlenül a RW kapcsolatot.
export async function runReadOnlyQuery(
  sql: string,
  databaseUrlReadonly?: string,
  params: unknown[] = [],
): Promise<ReadOnlyQueryResult> {
  const url = databaseUrlReadonly ?? loadDatabaseConfig().databaseUrlReadonly;
  const client = new Client({
    connectionString: url,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    application_name: 'smartbasket-agent-readonly',
  });

  await client.connect();
  try {
    await client.query('START TRANSACTION READ ONLY');
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return { rows: result.rows as Record<string, unknown>[] };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}
