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

  it('retries after a 429 rate-limit error and succeeds', async () => {
    vi.useFakeTimers();
    try {
      const rateLimitError = Object.assign(new Error('TooManyRequestsError'), {
        statusCode: 429,
      });
      const embed = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ id: 'embed-1', embeddings: { float: [[0.4, 0.5]] } });
      const client = { embed } as unknown as CohereClientV2;

      const resultPromise = embedTexts(client, ['szöveg'], 'search_document');
      await vi.advanceTimersByTimeAsync(65_000);
      const result = await resultPromise;

      expect(result).toEqual([[0.4, 0.5]]);
      expect(embed).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up and rethrows after exhausting retries on repeated 429s', async () => {
    vi.useFakeTimers();
    try {
      const rateLimitError = Object.assign(new Error('TooManyRequestsError'), {
        statusCode: 429,
      });
      const embed = vi.fn().mockRejectedValue(rateLimitError);
      const client = { embed } as unknown as CohereClientV2;

      const resultPromise = embedTexts(client, ['szöveg'], 'search_document');
      const assertion = expect(resultPromise).rejects.toThrow('TooManyRequestsError');
      await vi.advanceTimersByTimeAsync(65_000 * 6);
      await assertion;

      expect(embed).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry non-rate-limit errors', async () => {
    const otherError = Object.assign(new Error('AuthenticationError'), {
      statusCode: 401,
    });
    const embed = vi.fn().mockRejectedValue(otherError);
    const client = { embed } as unknown as CohereClientV2;

    await expect(embedTexts(client, ['szöveg'], 'search_document')).rejects.toThrow(
      'AuthenticationError',
    );
    expect(embed).toHaveBeenCalledTimes(1);
  });
});
