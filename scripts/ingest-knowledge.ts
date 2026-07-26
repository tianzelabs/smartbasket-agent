import { CohereClientV2 } from 'cohere-ai';
import {
  loadCohereConfig,
  loadDatabaseConfig,
  loadSourceManifest,
  openReadWriteConnection,
  rawCachePath,
  readRawCache,
  syncKnowledgeBase,
} from '@smartbasket/core';

const MANIFEST_PATH = 'data/knowledge/sources.json';
const CACHE_DIR = 'data/knowledge/raw';

const manifest = loadSourceManifest(MANIFEST_PATH);
const { databaseUrl } = loadDatabaseConfig();
const cohereClient = new CohereClientV2({
  token: loadCohereConfig().cohereApiKey,
});

const db = await openReadWriteConnection(databaseUrl);
try {
  const { results, deletedSourceUrls } = await syncKnowledgeBase(
    db,
    cohereClient,
    manifest,
    (entry) => readRawCache(rawCachePath(CACHE_DIR, entry.cacheKey, entry.format)),
  );

  for (const result of results) {
    const label =
      result.status === 'ingested' ? 'Ingesztálva' : 'Változatlan, kihagyva';
    console.log(`${label}: ${result.sourceUrl} (${result.chunkCount} chunk)`);
  }
  for (const url of deletedSourceUrls) {
    console.log(`Törölve (nincs már a manifestben): ${url}`);
  }
  console.log(
    `Kész: ${results.length} forrás feldolgozva, ${deletedSourceUrls.length} törölve.`,
  );
} finally {
  await db.end();
}
