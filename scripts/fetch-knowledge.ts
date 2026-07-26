import {
  fetchSourceBytes,
  loadSourceManifest,
  rawCachePath,
  writeRawCache,
} from '@smartbasket/core';

const MANIFEST_PATH = 'data/knowledge/sources.json';
const CACHE_DIR = 'data/knowledge/raw';

const manifest = loadSourceManifest(MANIFEST_PATH);
console.log(`${manifest.length} forrás a manifestben (${MANIFEST_PATH}).`);

for (const entry of manifest) {
  const { buffer } = await fetchSourceBytes(entry.url);
  const path = rawCachePath(CACHE_DIR, entry.cacheKey, entry.format);
  writeRawCache(path, buffer);
  console.log(`Letöltve: ${entry.title} -> ${path} (${buffer.length} byte)`);
}
