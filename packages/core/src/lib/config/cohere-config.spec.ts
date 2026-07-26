import { describe, expect, it } from 'vitest';
import { loadCohereConfig } from './cohere-config.js';

describe('loadCohereConfig', () => {
  it('reads the api key', () => {
    const config = loadCohereConfig({
      COHERE_API_KEY: 'co-test-123',
    } as NodeJS.ProcessEnv);

    expect(config.cohereApiKey).toBe('co-test-123');
  });

  it('throws a clear, human-readable error when COHERE_API_KEY is missing', () => {
    expect(() => loadCohereConfig({} as NodeJS.ProcessEnv)).toThrow(
      /COHERE_API_KEY/,
    );
  });
});
