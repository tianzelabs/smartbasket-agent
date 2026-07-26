import type { CohereClientV2 } from 'cohere-ai';
import type { SmartBasketDatabase } from '../../database/connection.js';
import { ingestDocument, type IngestResult } from './ingest-document.js';
import type { SourceEntry } from './source-manifest.js';

export interface SyncResult {
  results: IngestResult[];
  deletedSourceUrls: string[];
}

// A manifestben már nem szereplő dokumentumokat (és - ON DELETE CASCADE
// miatt - a chunkjaikat is) törli; a manifestben lévőket ingesteli/frissíti.
// Ez a válasz a docs/knowledge-base-architecture.md "mi történik a törölt
// dokumentum chunkjaival?" kérdésére: a manifestből való eltávolítás a
// trigger, nem egy külön "törlés" parancs.
export async function syncKnowledgeBase(
  db: SmartBasketDatabase,
  cohereClient: CohereClientV2,
  manifest: SourceEntry[],
  readRawBuffer: (entry: SourceEntry) => Buffer,
): Promise<SyncResult> {
  const results: IngestResult[] = [];
  for (const entry of manifest) {
    results.push(
      await ingestDocument(db, cohereClient, entry, readRawBuffer(entry)),
    );
  }

  const manifestUrls = manifest.map((entry) => entry.url);
  const { rows } = await db.query<{ source_url: string }>(
    manifestUrls.length > 0
      ? 'SELECT source_url FROM knowledge_documents WHERE source_url <> ALL($1)'
      : 'SELECT source_url FROM knowledge_documents',
    manifestUrls.length > 0 ? [manifestUrls] : [],
  );
  const deletedSourceUrls = rows.map((row) => row.source_url);

  if (deletedSourceUrls.length > 0) {
    await db.query('DELETE FROM knowledge_documents WHERE source_url = ANY($1)', [
      deletedSourceUrls,
    ]);
  }

  return { results, deletedSourceUrls };
}
