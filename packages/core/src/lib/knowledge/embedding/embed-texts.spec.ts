import type { CohereClientV2 } from 'cohere-ai';
import { describe, expect, it, vi } from 'vitest';
import { embedTexts } from './embed-texts.js';

function fakeClient(embeddings: number[][] | undefined): CohereClientV2 {
  return {
    embed: vi.fn().mockResolvedValue({
      id: 'embed-1',
      embeddings: { float: embeddings },
    }),
  } as unknown as CohereClientV2;
}

describe('embedTexts', () => {
  it('requests embed-v4.0 at 1024 dimensions with the given inputType', async () => {
    const client = fakeClient([[0.1, 0.2]]);

    await embedTexts(client, ['hűtőszekrény hőmérséklete'], 'search_document');

    expect(client.embed).toHaveBeenCalledWith({
      texts: ['hűtőszekrény hőmérséklete'],
      model: 'embed-v4.0',
      inputType: 'search_document',
      outputDimension: 1024,
      embeddingTypes: ['float'],
    });
  });

  it('returns the float embeddings from the response', async () => {
    const client = fakeClient([[0.1, 0.2, 0.3]]);

    const result = await embedTexts(client, ['szöveg'], 'search_query');

    expect(result).toEqual([[0.1, 0.2, 0.3]]);
  });

  it('returns an empty array without calling the API when there is no text', async () => {
    const client = fakeClient([]);

    const result = await embedTexts(client, [], 'search_document');

    expect(result).toEqual([]);
    expect(client.embed).not.toHaveBeenCalled();
  });

  it('throws a clear error when the response has no float embeddings', async () => {
    const client = fakeClient(undefined);

    await expect(embedTexts(client, ['szöveg'], 'search_query')).rejects.toThrow(
      /float embeddinget/,
    );
  });
});
