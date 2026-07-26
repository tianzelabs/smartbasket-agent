import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openReadWriteConnection } from '../../database/connection.js';
import { runMigrations } from '../../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../../database/test-database.js';
import { vectorSearch } from './vector-search.js';

const DIMENSIONS = 1024;

function vectorArray(distinctIndex: number): number[] {
  const values = new Array(DIMENSIONS).fill(0);
  values[distinctIndex] = 1;
  return values;
}

function vectorLiteral(distinctIndex: number): string {
  return `[${vectorArray(distinctIndex).join(',')}]`;
}

describe('vectorSearch', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    await runMigrations(testDb.databaseUrl);

    const db = await openReadWriteConnection(testDb.databaseUrl);
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO knowledge_documents (source_url, title, topic, format, content_hash, word_count)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      ['https://example.com/huto-cikk', 'Hűtés és tárolás', 'tárolás', 'html', 'hash-a', 120],
    );
    const documentId = rows[0].id;

    await db.query(
      `INSERT INTO knowledge_chunks (document_id, chunk_index, section_path, content, char_count, embedding)
       VALUES
         ($1, 0, 'Hűtés és tárolás > Hűtő', 'Tartsd a hűtőt 0-5°C között.', 27, $2::vector),
         ($1, 1, 'Hűtés és tárolás > Fagyasztás', 'Fagyaszd le, ha nem fogyasztod el hamar.', 40, $3::vector)`,
      [documentId, vectorLiteral(0), vectorLiteral(1)],
    );
    await db.end();
  });

  afterEach(async () => {
    await testDb.drop();
  });

  it('orders chunks by vector distance, closest first, with grounding metadata attached', async () => {
    const results = await vectorSearch(
      testDb.databaseUrlReadonly,
      vectorArray(0),
      10,
    );

    expect(results).toHaveLength(2);
    expect(results[0].content).toBe('Tartsd a hűtőt 0-5°C között.');
    expect(results[0].sectionPath).toBe('Hűtés és tárolás > Hűtő');
    expect(results[0].title).toBe('Hűtés és tárolás');
    expect(results[0].sourceUrl).toBe('https://example.com/huto-cikk');
    expect(results[1].content).toBe('Fagyaszd le, ha nem fogyasztod el hamar.');
  });

  it('respects the limit parameter', async () => {
    const results = await vectorSearch(
      testDb.databaseUrlReadonly,
      vectorArray(0),
      1,
    );

    expect(results).toHaveLength(1);
  });
});
