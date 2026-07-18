import { loadDatabaseConfig, runMigrations } from '@smartbasket/core';

const { databaseUrl } = loadDatabaseConfig();
await runMigrations(databaseUrl);

console.log(`Migrálva: ${databaseUrl}`);
