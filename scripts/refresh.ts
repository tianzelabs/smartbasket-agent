import {
  ensureFreshDataset,
  loadDatabaseConfig,
  resolveSourceUrl,
} from '@smartbasket/core';

const { databaseUrl, databaseUrlReadonly } = loadDatabaseConfig();
const sourceUrl = resolveSourceUrl();

await ensureFreshDataset({ databaseUrl, databaseUrlReadonly, sourceUrl });

console.log('Az adatbázis friss.');
