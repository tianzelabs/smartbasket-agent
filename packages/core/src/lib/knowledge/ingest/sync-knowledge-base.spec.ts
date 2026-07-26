import type { CohereClientV2 } from 'cohere-ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openReadWriteConnection } from '../../database/connection.js';
import { runMigrations } from '../../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../../database/test-database.js';
import type { SmartBasketDatabase } from '../../database/connection.js';
import type { SourceEntry } from './source-manifest.js';
import { syncKnowledgeBase } from './sync-knowledge-base.js';

const ARTICLE_HTML = `
<html><body><article>
  <h1>Első cikk</h1>
  <p>Ez a bevezető bekezdés, ami elmagyarázza, miért fontos a tudatos
  vásárlás a mindennapi háztartási kiadások szempontjából ma és holnap is,
  és hogyan segít elkerülni a felesleges pazarlást a hétköznapokban.</p>
  <h2>Tervezés</h2>
  <p>Készíts heti menütervet és bevásárlólistát, mielőtt elindulsz a boltba,
  mert ez segít elkerülni az impulzusvásárlásokat és a felesleges kiadást.</p>
</article></body></html>
`;

function entry(url: string, title: string): SourceEntry {
  return { url, title, topic: 'tervezés', format: 'html', cacheKey: url };
}

function fakeCohereClient(): CohereClientV2 {
  return {
    embed: vi.fn().mockImplementation(({ texts }: { texts: string[] }) => ({
      id: 'embed-1',
      embeddings: { float: texts.map(() => new Array(1024).fill(0)) },
    })),
  } as unknown as CohereClientV2;
}

describe('syncKnowledgeBase', () => {
  let testDb: TestDatabase;
  let db: SmartBasketDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    await runMigrations(testDb.databaseUrl);
    db = await openReadWriteConnection(testDb.databaseUrl);
  });

  afterEach(async () => {
    await db.end();
    await testDb.drop();
  });

  it('ingests every manifest entry', async () => {
    const cohereClient = fakeCohereClient();
    const manifest = [
      entry('https://example.com/a', 'Első cikk'),
      entry('https://example.com/b', 'Első cikk'),
    ];

    const { results, deletedSourceUrls } = await syncKnowledgeBase(
      db,
      cohereClient,
      manifest,
      () => Buffer.from(ARTICLE_HTML),
    );

    expect(results.map((r) => r.status)).toEqual(['ingested', 'ingested']);
    expect(deletedSourceUrls).toEqual([]);
  });

  it('deletes a document (and its chunks, via cascade) that is no longer in the manifest', async () => {
    const cohereClient = fakeCohereClient();

    await syncKnowledgeBase(
      db,
      cohereClient,
      [entry('https://example.com/orphan', 'Első cikk')],
      () => Buffer.from(ARTICLE_HTML),
    );
    const beforeChunks = await db.query(
      'SELECT count(*) AS count FROM knowledge_chunks',
    );
    expect(Number(beforeChunks.rows[0].count)).toBeGreaterThan(0);

    const { deletedSourceUrls } = await syncKnowledgeBase(
      db,
      cohereClient,
      [], // az "orphan" már nincs a manifestben
      () => Buffer.from(ARTICLE_HTML),
    );

    expect(deletedSourceUrls).toEqual(['https://example.com/orphan']);

    const docs = await db.query('SELECT * FROM knowledge_documents');
    const chunks = await db.query('SELECT * FROM knowledge_chunks');
    expect(docs.rows).toHaveLength(0);
    expect(chunks.rows).toHaveLength(0);
  });

  it('leaves documents untouched when they are still in the manifest', async () => {
    const cohereClient = fakeCohereClient();
    const manifest = [entry('https://example.com/keep', 'Első cikk')];

    await syncKnowledgeBase(db, cohereClient, manifest, () =>
      Buffer.from(ARTICLE_HTML),
    );
    const { deletedSourceUrls } = await syncKnowledgeBase(
      db,
      cohereClient,
      manifest,
      () => Buffer.from(ARTICLE_HTML),
    );

    expect(deletedSourceUrls).toEqual([]);
    const docs = await db.query('SELECT * FROM knowledge_documents');
    expect(docs.rows).toHaveLength(1);
  });
});
