import type Anthropic from '@anthropic-ai/sdk';
import type { CohereClientV2 } from 'cohere-ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openReadWriteConnection } from '../../database/connection.js';
import { runMigrations } from '../../database/migrate.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../../database/test-database.js';
import { searchKnowledge } from './search-knowledge.js';

const DIMENSIONS = 1024;

function vectorLiteral(distinctIndex: number): string {
  const values = new Array(DIMENSIONS).fill(0);
  values[distinctIndex] = 1;
  return `[${values.join(',')}]`;
}

function fakeAnthropicClient(): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          { type: 'text', text: 'A hűtőt 0-5°C között érdemes tartani.', citations: null },
        ],
      }),
    },
  } as unknown as Anthropic;
}

function fakeCohereClient(rerankResults: { index: number; relevanceScore: number }[]): CohereClientV2 {
  return {
    embed: vi.fn().mockResolvedValue({
      id: 'embed-1',
      embeddings: { float: [new Array(DIMENSIONS).fill(0).map((_, i) => (i === 0 ? 1 : 0))] },
    }),
    rerank: vi.fn().mockResolvedValue({ id: 'rerank-1', results: rerankResults }),
  } as unknown as CohereClientV2;
}

describe('searchKnowledge', () => {
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
       VALUES ($1, 0, 'Hűtés és tárolás > Hűtő', 'Tartsd a hűtőt 0-5°C között.', 27, $2::vector)`,
      [documentId, vectorLiteral(0)],
    );
    await db.end();
  });

  afterEach(async () => {
    await testDb.drop();
  });

  it('runs the full pipeline and returns grounded chunks above the relevance threshold', async () => {
    const anthropicClient = fakeAnthropicClient();
    const cohereClient = fakeCohereClient([{ index: 0, relevanceScore: 0.8 }]);

    const result = await searchKnowledge('Milyen hőmérsékleten tartsam a hűtőt?', {
      anthropicClient,
      cohereClient,
      databaseUrlReadonly: testDb.databaseUrlReadonly,
    });

    expect(result.belowThreshold).toBe(false);
    expect(result.chunks).toEqual([
      {
        content: 'Tartsd a hűtőt 0-5°C között.',
        title: 'Hűtés és tárolás',
        sourceUrl: 'https://example.com/huto-cikk',
        sectionPath: 'Hűtés és tárolás > Hűtő',
        relevanceScore: 0.8,
      },
    ]);
    // A rerank az EREDETI kérdéssel fut, nem a HyDE-szöveggel.
    expect(cohereClient.rerank).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'Milyen hőmérsékleten tartsam a hűtőt?' }),
    );
  });

  it('reports belowThreshold and no chunks when the best rerank score is too low', async () => {
    const anthropicClient = fakeAnthropicClient();
    const cohereClient = fakeCohereClient([{ index: 0, relevanceScore: 0.05 }]);

    const result = await searchKnowledge('Mennyi lesz a tej ára 2027 januárjában?', {
      anthropicClient,
      cohereClient,
      databaseUrlReadonly: testDb.databaseUrlReadonly,
    });

    expect(result.belowThreshold).toBe(true);
    expect(result.chunks).toEqual([]);
  });

  it('reports belowThreshold without calling rerank when there are no candidate chunks at all', async () => {
    await testDb.drop();
    testDb = await createTestDatabase();
    await runMigrations(testDb.databaseUrl);

    const anthropicClient = fakeAnthropicClient();
    const cohereClient = fakeCohereClient([]);

    const result = await searchKnowledge('Van készleten zabtej a Váci úti Aldiban?', {
      anthropicClient,
      cohereClient,
      databaseUrlReadonly: testDb.databaseUrlReadonly,
    });

    expect(result.belowThreshold).toBe(true);
    expect(result.chunks).toEqual([]);
    expect(cohereClient.rerank).not.toHaveBeenCalled();
  });
});
