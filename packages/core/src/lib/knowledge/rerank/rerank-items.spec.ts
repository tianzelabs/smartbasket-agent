import type { CohereClientV2 } from 'cohere-ai';
import { describe, expect, it, vi } from 'vitest';
import { rerankItems } from './rerank-items.js';

interface FakeChunk {
  id: number;
  content: string;
}

function fakeClient(results: { index: number; relevanceScore: number }[]): CohereClientV2 {
  return {
    rerank: vi.fn().mockResolvedValue({ id: 'rerank-1', results }),
  } as unknown as CohereClientV2;
}

describe('rerankItems', () => {
  it('maps rerank result indices back to the original items, preserving relevance order', async () => {
    const items: FakeChunk[] = [
      { id: 1, content: 'A hűtő hőmérséklete 0-5°C legyen.' },
      { id: 2, content: 'A bevásárlólista segít elkerülni a pazarlást.' },
      { id: 3, content: 'A minőségét megőrzi jelölés nem lejárati dátum.' },
    ];
    const client = fakeClient([
      { index: 2, relevanceScore: 0.9 },
      { index: 0, relevanceScore: 0.4 },
    ]);

    const reranked = await rerankItems(
      client,
      'Meddig ehető a lejárt tejtermék?',
      items,
      (item) => item.content,
      2,
    );

    expect(reranked).toEqual([
      { item: items[2], relevanceScore: 0.9 },
      { item: items[0], relevanceScore: 0.4 },
    ]);
  });

  it('returns an empty array without calling the API when there are no items', async () => {
    const client = fakeClient([]);

    const reranked = await rerankItems(client, 'kérdés', [], (item: string) => item, 5);

    expect(reranked).toEqual([]);
    expect(client.rerank).not.toHaveBeenCalled();
  });
});
