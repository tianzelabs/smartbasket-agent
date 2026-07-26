import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openReadWriteConnection } from '../../database/connection.js';
import { runMigrations } from '../../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../../database/test-database.js';
import type { SmartBasketDatabase } from '../../database/connection.js';
import { writeKnowledgeDocument } from './write-knowledge-document.js';

const DIMENSIONS = 1024;

function vector(distinctIndex: number): number[] {
  const values = new Array(DIMENSIONS).fill(0);
  values[distinctIndex] = 1;
  return values;
}

describe('writeKnowledgeDocument', () => {
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

  it('inserts a new document with its chunks', async () => {
    await writeKnowledgeDocument(
      db,
      {
        sourceUrl: 'https://example.com/cikk',
        title: 'Cikk',
        topic: 'tervezés',
        format: 'html',
        contentHash: 'hash-1',
        wordCount: 42,
      },
      [
        {
          sectionPath: 'Cikk > Tervezés',
          content: 'Első chunk.',
          charCount: 11,
          chunkIndex: 0,
          embedding: vector(0),
        },
        {
          sectionPath: 'Cikk > Tárolás',
          content: 'Második chunk.',
          charCount: 14,
          chunkIndex: 1,
          embedding: vector(1),
        },
      ],
    );

    const { rows } = await db.query(
      `SELECT c.chunk_index, c.section_path, c.content
       FROM knowledge_chunks c
       JOIN knowledge_documents d ON d.id = c.document_id
       WHERE d.source_url = $1
       ORDER BY c.chunk_index`,
      ['https://example.com/cikk'],
    );

    expect(rows).toEqual([
      { chunk_index: 0, section_path: 'Cikk > Tervezés', content: 'Első chunk.' },
      { chunk_index: 1, section_path: 'Cikk > Tárolás', content: 'Második chunk.' },
    ]);
  });

  it('replaces all chunks and updates metadata on re-ingest of the same source_url', async () => {
    const write = (contentHash: string, chunkCount: number) =>
      writeKnowledgeDocument(
        db,
        {
          sourceUrl: 'https://example.com/cikk',
          title: 'Cikk v2',
          topic: 'tervezés',
          format: 'html',
          contentHash,
          wordCount: 99,
        },
        Array.from({ length: chunkCount }, (_, i) => ({
          sectionPath: `Cikk > Rész ${i}`,
          content: `Chunk ${i}`,
          charCount: 7,
          chunkIndex: i,
          embedding: vector(i),
        })),
      );

    await write('hash-1', 3);
    await write('hash-2', 1);

    const doc = await db.query(
      'SELECT title, content_hash FROM knowledge_documents WHERE source_url = $1',
      ['https://example.com/cikk'],
    );
    const chunks = await db.query(
      `SELECT count(*) AS count FROM knowledge_chunks c
       JOIN knowledge_documents d ON d.id = c.document_id
       WHERE d.source_url = $1`,
      ['https://example.com/cikk'],
    );

    expect(doc.rows[0]).toEqual({ title: 'Cikk v2', content_hash: 'hash-2' });
    expect(chunks.rows[0].count).toBe(1);
  });

  it('rolls back everything if a chunk insert fails', async () => {
    await expect(
      writeKnowledgeDocument(
        db,
        {
          sourceUrl: 'https://example.com/hibas',
          title: 'Hibás',
          topic: 'x',
          format: 'html',
          contentHash: 'hash-x',
          wordCount: 1,
        },
        [
          {
            sectionPath: 'Hibás',
            content: 'chunk',
            charCount: 5,
            chunkIndex: 0,
            embedding: new Array(10).fill(0), // rossz dimenzió (nem 1024)
          },
        ],
      ),
    ).rejects.toThrow();

    const { rows } = await db.query(
      'SELECT * FROM knowledge_documents WHERE source_url = $1',
      ['https://example.com/hibas'],
    );
    expect(rows).toHaveLength(0);
  });
});
