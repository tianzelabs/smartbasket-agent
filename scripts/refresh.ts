import {
  ensureFreshDataset,
  resolveDatabasePath,
  resolveSourceUrl,
} from '@smartbasket/core';

const dbPath = resolveDatabasePath();
const sourceUrl = resolveSourceUrl();

await ensureFreshDataset({ dbPath, sourceUrl });

console.log(`Az adatbázis friss: ${dbPath}`);
