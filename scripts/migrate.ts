import { resolveDatabasePath, runMigrations } from '@smartbasket/core';

const dbPath = resolveDatabasePath();
runMigrations(dbPath);

console.log(`Migrated ${dbPath}`);
