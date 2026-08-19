import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openReadWriteConnection } from '../../database/connection.js';
import { runMigrations } from '../../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../../database/test-database.js';
import { getKnowledgeBaseStats } from './knowledge-base-stats.js';

const DIMENSIONS = 1024;

function vectorLiteral(distinctIndex: number): string {
  const values = new Array(DIMENSIONS).fill(0);
  values[distinctIndex] = 1;
  return `[${values.join(',')}]`;
}

describe('getKnowledgeBaseStats', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    await runMigrations(testDb.databaseUrl);
  });

  afterEach(async () => {
    await testDb.drop();
  });

  it('returns zero counts for an empty knowledge base', async () => {
    const stats = await getKnowledgeBaseStats(testDb.databaseUrlReadonly);

    expect(stats).toEqual({ documentCount: 0, chunkCount: 0 });
  });

  it('counts distinct documents and total chunks', async () => {
    const db = await openReadWriteConnection(testDb.databaseUrl);
    const { rows: doc1 } = await db.query<{ id: number }>(
      `INSERT INTO knowledge_documents (source_url, title, topic, format, content_hash, word_count)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      ['https://example.com/cikk-1', 'Cikk 1', 'tárolás', 'html', 'hash-1', 100],
    );
    const { rows: doc2 } = await db.query<{ id: number }>(
      `INSERT INTO knowledge_documents (source_url, title, topic, format, content_hash, word_count)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      ['https://example.com/cikk-2', 'Cikk 2', 'tárolás', 'html', 'hash-2', 80],
    );
    await db.query(
      `INSERT INTO knowledge_chunks (document_id, chunk_index, section_path, content, char_count, embedding)
       VALUES
         ($1, 0, 'Cikk 1 > Rész', 'Tartalom egy.', 13, $2::vector),
         ($1, 1, 'Cikk 1 > Rész 2', 'Tartalom kettő.', 15, $3::vector),
         ($4, 0, 'Cikk 2 > Rész', 'Tartalom három.', 15, $5::vector)`,
      [doc1[0].id, vectorLiteral(0), vectorLiteral(1), doc2[0].id, vectorLiteral(2)],
    );
    await db.end();

    const stats = await getKnowledgeBaseStats(testDb.databaseUrlReadonly);

    expect(stats).toEqual({ documentCount: 2, chunkCount: 3 });
  });
});
