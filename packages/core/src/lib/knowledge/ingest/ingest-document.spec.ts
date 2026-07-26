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
import { ingestDocument } from './ingest-document.js';

const ARTICLE_HTML = `
<html>
  <body>
    <nav><a href="/">Főoldal</a></nav>
    <article>
      <h1>Tudatos vásárlás otthon</h1>
      <p>Ez a bevezető bekezdés, ami elmagyarázza, miért fontos a tudatos
      vásárlás a mindennapi háztartási kiadások szempontjából, és hogyan
      segíthet elkerülni a felesleges pazarlást a hétköznapokban.</p>
      <h2>Tervezés</h2>
      <p>Készíts heti menütervet és bevásárlólistát, mielőtt elindulsz a
      boltba, mert ez segít elkerülni az impulzusvásárlásokat.</p>
    </article>
  </body>
</html>
`;

function entry(overrides: Partial<SourceEntry> = {}): SourceEntry {
  return {
    url: 'https://example.com/cikk',
    title: 'Tudatos vásárlás otthon',
    topic: 'tervezés',
    format: 'html',
    cacheKey: 'abc123',
    ...overrides,
  };
}

function fakeCohereClient(): CohereClientV2 {
  return {
    embed: vi.fn().mockImplementation(({ texts }: { texts: string[] }) => ({
      id: 'embed-1',
      embeddings: {
        float: texts.map(() => new Array(1024).fill(0).map((_, i) => (i === 0 ? 1 : 0))),
      },
    })),
  } as unknown as CohereClientV2;
}

describe('ingestDocument', () => {
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

  it('extracts, chunks, embeds and writes a new HTML document', async () => {
    const cohereClient = fakeCohereClient();

    const result = await ingestDocument(
      db,
      cohereClient,
      entry(),
      Buffer.from(ARTICLE_HTML),
    );

    expect(result.status).toBe('ingested');
    expect(result.chunkCount).toBeGreaterThan(0);

    const { rows } = await db.query(
      'SELECT title, format, word_count FROM knowledge_documents WHERE source_url = $1',
      ['https://example.com/cikk'],
    );
    expect(rows[0]).toMatchObject({
      title: 'Tudatos vásárlás otthon',
      format: 'html',
    });
    expect(rows[0].word_count).toBeGreaterThan(0);
    expect(cohereClient.embed).toHaveBeenCalledWith(
      expect.objectContaining({ inputType: 'search_document' }),
    );
  });

  it('skips re-ingesting when the content hash is unchanged', async () => {
    const cohereClient = fakeCohereClient();
    const buffer = Buffer.from(ARTICLE_HTML);

    const first = await ingestDocument(db, cohereClient, entry(), buffer);
    expect(first.status).toBe('ingested');

    const second = await ingestDocument(db, cohereClient, entry(), buffer);
    expect(second.status).toBe('skipped-unchanged');
    expect(second.chunkCount).toBe(0);

    // A második híváskor az embed API-t sem szabad hívni - az a lényeg,
    // hogy változatlan tartalomnál ne vektorizáljunk újra.
    expect(cohereClient.embed).toHaveBeenCalledTimes(1);
  });

  it('re-ingests when the content actually changed (different hash)', async () => {
    const cohereClient = fakeCohereClient();

    await ingestDocument(db, cohereClient, entry(), Buffer.from(ARTICLE_HTML));
    const changed = await ingestDocument(
      db,
      cohereClient,
      entry(),
      Buffer.from(ARTICLE_HTML.replace('Tervezés', 'Tervezés (frissítve)')),
    );

    expect(changed.status).toBe('ingested');
    expect(cohereClient.embed).toHaveBeenCalledTimes(2);
  });
});
